import type { BalanceConfig } from '../../config/balance.schema';
import legacyPairs from '../../config/plinko-deflectors-2026-10-02.json';
import { createBoardFingerprint, type PendingDrop } from './drop';

/** Finish paid pre-calibration shots on their original geometry. Never rewrite
 * their fingerprint or solver checkpoint, and never accept arbitrary geometry. */
export const resolvePendingBoardConfig = (
  config: BalanceConfig,
  pending: PendingDrop | null,
): BalanceConfig => {
  if (!pending || pending.boardFingerprint === createBoardFingerprint(
    config, pending.pocketLevelsAtCommit, pending.specialLevelsAtCommit,
  )) return config;
  const legacy = structuredClone(config);
  legacy.plinko.jackpotBias.forEach((level, index) => {
    level.deflectorPairs = structuredClone(legacyPairs[index]!);
  });
  return pending.boardFingerprint === createBoardFingerprint(
    legacy, pending.pocketLevelsAtCommit, pending.specialLevelsAtCommit,
  ) ? legacy : config; // Existing compatibility validation still rejects unknown boards.
};
