import { describe, expect, it } from 'vitest';
import { resolveBarryPayment } from '../src/core/barry/barry';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { commitBareDrop, settleAggregateDrop, type PendingDrop } from '../src/core/plinko-rules/drop';
import { activeDrops, appendDrop, canLaunchDrop, findBallDrop, recordDropPayout, removeSettledDrop } from '../src/core/plinko-rules/concurrentDrops';
import { advancePendingDropTime, settleAggregatePendingDropAndResumeTime } from '../src/core/plinko-rules/dropTiming';
import { createSaveState, parseSaveState } from '../src/core/save/SaveState';
import { migrateSaveState } from '../src/core/save/migrations';
import { applyDebugCommand } from '../src/core/state/debugCommands';

const initial = () => ({ ...createInitialGameState(balance, 831), cash: 100_000 });
const shot = (id: string, fraction: 0.25 | 0.5 | 1 = 1) => commitBareDrop(initial(), null, balance, id, fraction).pendingDrop;

describe('independent concurrent paid launches', () => {
  it('preserves different stakes and partial payouts through root rotation and a save round trip', () => {
    let pending = appendDrop(shot('first', 0.25), shot('second', 1));
    pending = recordDropPayout(pending, 'first', 31);
    pending = recordDropPayout(pending, 'second', 1000);
    const save = parseSaveState(JSON.parse(JSON.stringify({ ...createSaveState(initial()), pendingDrop: pending })));
    expect(findBallDrop(save.pendingDrop!, 'first:root').originalStake).toBe(125);
    expect(findBallDrop(save.pendingDrop!, 'second:root').originalStake).toBe(500);
    const rotated = removeSettledDrop(save.pendingDrop!, 'first')!;
    expect(rotated.dropId).toBe('second');
    expect(rotated.physics?.alreadySettledPayout).toBe(1000);
    expect(rotated.additionalDrops).toEqual([]);
    expect(removeSettledDrop(rotated, 'second')).toBeNull();
  });

  it('bounds pending entries even across a continuous sequence of launches', () => {
    let pending: PendingDrop | null = shot('start');
    for (let i = 0; i < 100; i += 1) {
      pending = appendDrop(pending, shot(`shot-${i}`));
      expect(activeDrops(pending)).toHaveLength(2);
      pending = removeSettledDrop(pending, pending.dropId);
    }
    for (let i = 0; i < 5; i += 1) pending = appendDrop(pending, shot(`cap-${i}`));
    expect(canLaunchDrop(pending, balance)).toBe(false);
  });

  it('waits for the final paid lineage at Barry and carries remaining action time', () => {
    let state = { ...initial(), clock: { gameDayIndex: 0, minuteOfDay: 8 * 60 + 30 } };
    const a = commitBareDrop(state, null, balance, 'a');
    const at = advancePendingDropTime(a.state, a.pendingDrop, balance);
    const b = commitBareDrop(at.state, null, balance, 'b');
    const bt = advancePendingDropTime(b.state, b.pendingDrop, balance);
    expect(bt.state.barryInterruptPending).toBe(true);
    expect(() => commitBareDrop(bt.state, null, balance, 'c')).toThrow();
    const world = appendDrop(at.pendingDrop, bt.pendingDrop);
    const settled = settleAggregateDrop(bt.state, bt.pendingDrop, 750, balance);
    expect(settled.state.barryInterruptPending).toBe(true);
    expect(settled.state.totalBarryPaid).toBe(0);
    const remaining = removeSettledDrop(world, 'b')!;
    const final = settleAggregatePendingDropAndResumeTime(settled.state, remaining, 1000, balance);
    expect(final.state.barryInterruptPending).toBe(false);
    expect(final.state.totalBarryPaid).toBeGreaterThan(0);
  });

  it('does not consume a newly armed shield when an older uninsured shot finishes', () => {
    const state = { ...initial(), plinkoInsuranceLevel: 1, plinkoInsuranceArmed: { level: 1, floor: 0.5 } };
    const result = settleAggregateDrop(state, shot('uninsured'), 1000, balance);
    expect(result.state.plinkoInsuranceArmed).toEqual(state.plinkoInsuranceArmed);
    const next = commitBareDrop(result.state, null, balance, 'insured');
    expect(next.pendingDrop.insuranceAtCommit).toEqual(state.plinkoInsuranceArmed);
    expect(next.state.plinkoInsuranceArmed).toBeNull();
  });

  it('migrates v14 without changing a committed stake', () => {
    const old = { ...createSaveState(initial()), version: 14, pendingDrop: shot('legacy') };
    const migrated = migrateSaveState(old);
    expect(migrated.version).toBe(15);
    expect(migrated.pendingDrop).toEqual(old.pendingDrop);
    expect(migrated.game.cash).toBe(old.game.cash);
  });
});

describe('preview commands use game rules', () => {
  it('clamps deductions and rejects invalid numbers', () => {
    expect(applyDebugCommand(initial(), { kind: 'cash', amount: -1_000_000 }, balance).cash).toBe(0);
    expect(() => applyDebugCommand(initial(), { kind: 'cash', amount: NaN }, balance)).toThrow();
    expect(() => applyDebugCommand(initial(), { kind: 'time', amount: -1 }, balance)).toThrow();
  });
  it('stops a time jump at Barry rather than bypassing payment', () => {
    const state = { ...initial(), clock: { gameDayIndex: 0, minuteOfDay: 8 * 60 + 50 } };
    const result = applyDebugCommand(state, { kind: 'time', amount: 120 }, balance);
    expect(result.clock.minuteOfDay).toBe(540);
    expect(result.barryInterruptPending).toBe(true);
    expect(result.totalBarryPaid).toBe(0);
  });
});


describe('Barry exact cash boundary after concurrent payouts', () => {
  it.each([2999, 3000, 3001])('settles all six saved roots before checking %i cash', (finalCash) => {
    let state = {...initial(), cash: 3000};
    let pending: PendingDrop | null = null;
    for (let i=0;i<6;i++) {
      const paid = commitBareDrop(state, null, balance, `boundary-${i}`, 1);
      state = paid.state; pending = appendDrop(pending, paid.pendingDrop);
    }
    state = {...state, barryInterruptPending:true};
    for (let i=0;i<5;i++) {
      const root = activeDrops(pending)[0]!;
      state = settleAggregateDrop(state, root, 0, balance).state;
      pending = removeSettledDrop(pending!, root.dropId);
      expect(state.totalBarryPaid).toBe(0);
      expect(state.terminalReason).toBeNull();
    }
    const saved = parseSaveState(JSON.parse(JSON.stringify({...createSaveState(state), pendingDrop:pending})));
    const result = settleAggregatePendingDropAndResumeTime(saved.game,saved.pendingDrop!,finalCash,balance);
    expect(result.state.terminalReason).toBe(finalCash < 3000 ? 'BARRY_PAYMENT_FAILED' : null);
    expect(result.state.cash).toBe(finalCash < 3000 ? finalCash : finalCash-3000);
    expect(result.state.totalBarryPaid).toBe(finalCash < 3000 ? 0 : 3000);
    expect(result.state.barryPaymentIndex).toBe(finalCash < 3000 ? 0 : 1);
    expect(result.state.mainDebt).toBe(67000000);
  });
  it('debug Barry uses the real insufficient-funds rule without gifting cash', () => {
    const state = {...initial(),cash:2999};
    const due = applyDebugCommand(state,{kind:'barry'},balance);
    expect(due.cash).toBe(2999);
    expect(due.clock).toEqual(state.clock);
    expect(due.barryInterruptPending).toBe(true);
    expect(resolveBarryPayment(due,balance).terminalReason).toBe('BARRY_PAYMENT_FAILED');
  });
});
