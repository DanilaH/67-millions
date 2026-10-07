import { getLaunchCapacity } from './progression';
import type { GameState } from '../state/GameState';
import type { BalanceConfig } from '../../config/balance.schema';
import type { PendingDrop, PendingShot } from './drop';

/** The first outstanding launch also carries the shared world checkpoint. */
export const activeDrops = (pending: PendingDrop | null): PendingShot[] =>
  pending ? [pending, ...(pending.additionalDrops ?? [])] : [];

export const canLaunchDrop = (pending: PendingDrop | null, config: BalanceConfig, state: Pick<GameState, 'plinkoCapacityLevel'>): boolean =>
  activeDrops(pending).length < getLaunchCapacity(config, state) &&
  (pending?.physics?.balls.length ?? 0) < config.plinko.maxActiveBalls;

export const findBallDrop = (pending: PendingDrop, lineageId: string): PendingShot => {
  const shot = activeDrops(pending).find((entry) => `${entry.dropId}:root` === lineageId);
  if (!shot) throw new Error(`Unknown paid ball lineage: ${lineageId}`);
  return shot;
};

export const appendDrop = (pending: PendingDrop | null, shot: PendingShot): PendingDrop =>
  pending ? { ...pending, additionalDrops: [...(pending.additionalDrops ?? []), shot] } : shot;

export const recordDropPayout = (pending: PendingDrop, dropId: string, payout: number): PendingDrop => {
  const update = (shot: PendingShot): PendingShot => shot.dropId !== dropId ? shot : {
    ...shot,
    physics: { fixedTicksElapsed: 0, balls: [], ...shot.physics, alreadySettledPayout: payout },
  };
  return { ...pending, ...update(pending), additionalDrops: pending.additionalDrops?.map(update) ?? [] };
};

/** Remove a settled launch immediately so an endless stream cannot grow the save. */
export const removeSettledDrop = (pending: PendingDrop, dropId: string): PendingDrop | null => {
  const finished = activeDrops(pending).find((shot) => shot.dropId === dropId);
  if (!finished) throw new Error('Cannot settle an unknown Drop');
  const remaining = activeDrops(pending).filter((shot) => shot.dropId !== dropId);
  const first = remaining[0];
  if (!first) return null;
  return {
    ...first,
    remainingActionMinutes: first.remainingActionMinutes + finished.remainingActionMinutes,
    physics: pending.physics ? {
      ...pending.physics,
      alreadySettledPayout: first.physics?.alreadySettledPayout ?? 0,
    } : null,
    additionalDrops: remaining.slice(1),
  };
};
