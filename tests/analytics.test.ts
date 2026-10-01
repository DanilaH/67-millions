import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsAdapter, AnalyticsParams } from '@danilah/mini-games-kit/platform';
import { balance } from '../src/config/balance';
import { GameAnalytics } from '../src/app/analytics/GameAnalytics';
import { parseMetricaCounterId, createGameAnalyticsAdapter } from '../src/app/analytics/platformAnalytics';
import { createSaveState } from '../src/core/save/SaveState';
import { createSaveRepository } from '../src/core/save/repository';
import { createInitialGameState } from '../src/core/state/GameState';
import { startWork } from '../src/core/work/work';
import { commitBareDrop } from '../src/core/plinko-rules/drop';

const fixture = () => {
  const events: { event: string; params: AnalyticsParams }[] = [];
  const adapter: AnalyticsAdapter = { track: (event, params) => events.push({event, params: params ?? {}}) };
  const analytics = new GameAnalytics(adapter, balance);
  const save = createSaveState(createInitialGameState(balance, 67));
  return { events, analytics, save };
};

describe('game analytics', () => {
  it('does not repeat run, Barry, debt or terminal events on writes or scene loads', () => {
    const { events, analytics, save } = fixture();
    analytics.loaded(save); analytics.loaded(save);
    const due = structuredClone(save); due.game.barryInterruptPending = true;
    analytics.committed(due); analytics.committed(due);
    const paid = structuredClone(due); paid.game.barryInterruptPending = false; paid.game.totalBarryPaid = 100; paid.game.barryPaymentIndex = 1;
    analytics.committed(paid);
    const rich = structuredClone(paid); rich.game.cash = rich.game.mainDebt;
    analytics.committed(rich); analytics.committed(rich);
    const won = structuredClone(rich); won.game.mainDebt = 0; won.game.victory = true; won.game.cash = 0;
    analytics.committed(won); analytics.committed(won); analytics.loaded(won);
    expect(events.map(x => x.event)).toEqual(['game_start','barry_due','barry_paid','main_debt_ready','main_debt_paid','victory']);
    analytics.committed(save);
    expect(events.at(-1)?.event).toBe('game_start');
  });

  it('uses actual skill result and emits once at settlement', () => {
    const { events, analytics, save } = fixture(); analytics.loaded(save);
    save.game.clock.minuteOfDay = 18 * 60;
    const started = startWork(save.game, balance, 'dishes', 1);
    const active = {...save, game: started.state, activeAction: started.action};
    analytics.committed(active);
    const skill = {...active, activeAction: {...started.action, result: 'SUCCESS' as const}};
    analytics.committed(skill);
    analytics.committed({...skill, activeAction: null, game: {...skill.game, cash: skill.game.cash + 500}});
    expect(events.filter(x => x.event.startsWith('work_')).map(x=>x.event)).toEqual(['work_started','work_completed']);
    expect(events.at(-1)?.params.cash_delta).toBe(500);
  });

  it('emits deterministic committed Drop identity and does not repeat on physics checkpoints', () => {
    const { events, analytics, save } = fixture(); analytics.loaded(save);
    const drop = commitBareDrop(save.game, null, balance, 'drop-67', 1);
    const committed = {...save, game: drop.state, pendingDrop: drop.pendingDrop};
    analytics.committed(committed); analytics.committed(committed);
    const drops = events.filter(x=>x.event==='plinko_drop');
    expect(drops).toHaveLength(1);
    expect(drops[0]?.params).toMatchObject({ schema_version: 1, drop_id:'drop-67', seed:67, board_hash:drop.pendingDrop.boardFingerprint, cash_before:save.game.cash, cash_after:drop.state.cash, bet:drop.pendingDrop.originalStake });
  });

  it('reports presentation once, including when Barry temporarily hides the same event', () => {
    const { events, analytics, save } = fixture(); analytics.loaded(save);
    analytics.eventShown('EVENT_01',save.game); analytics.eventShown('EVENT_01',save.game);
    analytics.eventShown(null,save.game); analytics.eventShown('EVENT_01',save.game);
    expect(events.filter(x=>x.event==='event_shown')).toHaveLength(1);
  });

  it('does not emit a transition before successful persistence and survives adapter failure', async () => {
    const { analytics, save, events } = fixture();
    const storage = {getItem: async()=>null, setItem: vi.fn(async()=>{}), removeItem: async()=>{}};
    const repository = createSaveRepository(storage, ()=>save.game, analytics);
    await repository.load();
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    const due = {...save, game:{...save.game, barryInterruptPending:true}};
    await expect(repository.write(due)).rejects.toThrow('disk full');
    expect(events.map(x=>x.event)).toEqual(['game_start']);
    await repository.write(due);
    expect(events.at(-1)?.event).toBe('barry_due');
    const bad = new GameAnalytics({track:()=>{throw new Error('offline')}},balance);
    const original=structuredClone(save);bad.loaded(save);bad.committed(due);
    expect(save).toEqual(original);
  });

  it('rejects invalid configuration and boots without a counter or browser APIs', () => {
    for (const value of [undefined,'','0','-1','1.5','fake','123x','9007199254740992']) expect(parseMetricaCounterId(value)).toBeNull();
    expect(parseMetricaCounterId('12345678')).toBe(12345678);
    expect(()=>createGameAnalyticsAdapter(true,undefined,false).track('game_start')).not.toThrow();
    expect(()=>createGameAnalyticsAdapter(true,'12345678',false).track('game_start')).not.toThrow();
  });
});
