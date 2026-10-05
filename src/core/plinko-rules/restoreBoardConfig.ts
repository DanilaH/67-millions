import type { BalanceConfig } from '../../config/balance.schema';
import legacyPairs from '../../config/plinko-deflectors-2026-10-02.json';
import legacySpecials from '../../config/plinko-specials-2026-10-05.json';
import legacyPhysics from '../../config/plinko-physics-2026-10-03.json';
import { createBoardFingerprint, type PendingDrop } from './drop';

/** Finish paid shots on a known historical board without rewriting their save. */
export const resolvePendingBoardConfig = (
  config: BalanceConfig,
  pending: PendingDrop | null,
): BalanceConfig => {
  if (!pending) return config;
  const matches = (candidate: BalanceConfig) => pending.boardFingerprint ===
    createBoardFingerprint(candidate, pending.pocketLevelsAtCommit, pending.specialLevelsAtCommit);
  if (matches(config)) return config;
  const legacy = structuredClone(config);
  legacy.plinko.specialPinLayout = structuredClone(legacySpecials.layout) as BalanceConfig['plinko']['specialPinLayout'];
  legacy.plinko.splitter = structuredClone(legacySpecials.splitter);
  if (matches(legacy)) return legacy;
  legacy.plinko.physicsSeed = structuredClone(legacyPhysics);
  if (matches(legacy)) return legacy;
  legacy.plinko.jackpotBias.forEach((level, index) => {
    level.deflectorPairs = structuredClone(legacyPairs[index]!);
  });
  return matches(legacy) ? legacy : config; // Compatibility validation rejects unknown boards.
};
