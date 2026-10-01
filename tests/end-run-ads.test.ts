import { describe, expect, it, vi } from 'vitest';
import { EndRunAds } from '../src/app/EndRunAds';
import { YandexAdsAdapter } from '@danilah/mini-games-kit/yandex';
import { GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import { balance } from '../src/config/balance';
import { createSaveState } from '../src/core/save/SaveState';
import { createInitialGameState } from '../src/core/state/GameState';
import { commitBareDrop } from '../src/core/plinko-rules/drop';

const save = () => createSaveState(createInitialGameState(balance,67));
const ads = (showInterstitial: () => Promise<{status:'closed';wasShown:boolean}>) => ({ showInterstitial, showRewarded:vi.fn(), setStickyBannerVisible:vi.fn() });

describe('safe end-of-run ads', () => {
  it('rejects live runs and active cascades', async () => {
    const show=vi.fn(async()=>({status:'closed' as const,wasShown:true}));const gate=new EndRunAds(ads(show));const restart=vi.fn();
    expect(await gate.beforeRestart(save(),restart)).toBe(false);
    const active=save();active.game.terminalReason='HEALTH_ZERO';active.pendingDrop=commitBareDrop(save().game,null,balance,'d',1).pendingDrop;
    expect(await gate.beforeRestart(active,restart)).toBe(false);
    expect(show).not.toHaveBeenCalled();expect(restart).not.toHaveBeenCalled();
  });
  it('waits for close, prevents concurrent restart and continues after failures', async () => {
    let close!:()=>void;const pending=new Promise<{status:'closed';wasShown:boolean}>(resolve=>{close=()=>resolve({status:'closed',wasShown:true});});
    const gate=new EndRunAds(ads(()=>pending));const terminal=save();terminal.game.terminalReason='HEALTH_ZERO';const restart=vi.fn();
    const first=gate.beforeRestart(terminal,restart);
    expect(await gate.beforeRestart(terminal,restart)).toBe(false);expect(restart).not.toHaveBeenCalled();close();await first;expect(restart).toHaveBeenCalledOnce();
    const failing=new EndRunAds(ads(async()=>{throw new Error('network')}));
    expect(await failing.beforeRestart(terminal,restart)).toBe(true);
  });
  it('uses the kit pause contract without releasing independent background blockers', async () => {
    const activity=new GameplayActivityCoordinator(vi.fn(),vi.fn());activity.setGameplayDesired(true);
    let callbacks: {onOpen?:()=>void;onClose?:(shown:boolean)=>void} = {};
    const sdk={adv:{showFullscreenAdv:vi.fn((options:{callbacks:typeof callbacks})=>{callbacks=options.callbacks;}), showRewardedVideo:vi.fn(),showBannerAdv:vi.fn(),hideBannerAdv:vi.fn(),getBannerAdvStatus:vi.fn()}};
    const adapter=new YandexAdsAdapter(sdk,activity);const gate=new EndRunAds(adapter);const terminal=save();terminal.game.terminalReason='HEALTH_ZERO';const restart=vi.fn();
    const task=gate.beforeRestart(terminal,restart);callbacks.onOpen?.();
    expect(activity.isBlocked()).toBe(true);activity.setBlocked('visibility',true);callbacks.onClose?.(true);await task;
    expect(activity.isBlocked()).toBe(true);activity.setBlocked('visibility',false);expect(activity.isBlocked()).toBe(false);expect(restart).toHaveBeenCalledOnce();
  });
});
