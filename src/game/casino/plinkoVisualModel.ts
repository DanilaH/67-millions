import type { BalanceConfig } from '../../config/balance.schema';
import type { PendingDrop } from '../../core/plinko-rules/drop';
import {
  deriveActiveSpecialPins,
  type ActiveSpecialPins,
} from '../../core/plinko-rules/cascade';
import {
  derivePocketMultipliers,
  getPocketUpgradeLevels,
  getSpecialUpgradeLevels,
  type PocketUpgradeLevels,
  type SpecialUpgradeLevels,
} from '../../core/plinko-rules/progression';
import type { GameState } from '../../core/state/GameState';

export type PlinkoPegVisualRole =
  | 'regular'
  | 'amplifier'
  | 'return'
  | 'splitter';

export type PlinkoPocketVisualRole =
  | 'jackpot'
  | 'outer'
  | 'mid'
  | 'inner'
  | 'center';

export type PlinkoPegVisualRoles = Readonly<
  Record<string, PlinkoPegVisualRole>
>;

export interface PlinkoVisualSnapshot {
  pocketLevels: PocketUpgradeLevels;
  specialLevels: SpecialUpgradeLevels;
  activePins: ActiveSpecialPins;
  pegRoles: PlinkoPegVisualRoles;
  pocketMultipliers: number[];
  maxBetLevel: number;
  insuranceLevel: number;
  insuranceArmed: boolean;
  progressionUnits: number;
}

export const derivePegVisualRoles = (
  activePins: ActiveSpecialPins,
): PlinkoPegVisualRoles => {
  const roles: Record<string, PlinkoPegVisualRole> = {};

  const assign = (
    pegIds: readonly string[] | undefined,
    role: Exclude<PlinkoPegVisualRole, 'regular'>,
  ): void => {
    for (const pegId of pegIds ?? []) {
      const previous = roles[pegId];
      if (previous !== undefined) {
        throw new Error(
          `Special pin ${pegId} has overlapping visual roles: ${previous}, ${role}`,
        );
      }
      roles[pegId] = role;
    }
  };

  assign(activePins.amplifier?.pegIds, 'amplifier');
  assign(activePins.return?.pegIds, 'return');
  assign(activePins.splitter?.pegIds, 'splitter');

  return roles;
};

export const derivePlinkoVisualSnapshot = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): PlinkoVisualSnapshot => {
  const pocketLevels =
    pendingDrop?.pocketLevelsAtCommit ??
    getPocketUpgradeLevels(state);
  const specialLevels =
    pendingDrop?.specialLevelsAtCommit ??
    getSpecialUpgradeLevels(state);

  const maxBetLevel =
    pendingDrop?.maxBetLevel ??
    state.plinkoMaxBetLevel;
  const insuranceLevel = state.plinkoInsuranceLevel;
  const insuranceArmed =
    pendingDrop?.insuranceAtCommit !== null &&
    pendingDrop?.insuranceAtCommit !== undefined
      ? true
      : state.plinkoInsuranceArmed !== null;

  const progressionUnits =
    maxBetLevel +
    pocketLevels.centerLevel +
    pocketLevels.midLevel +
    pocketLevels.jackpotLevel +
    specialLevels.amplifierLevel +
    specialLevels.returnLevel +
    specialLevels.splitterLevel +
    specialLevels.jackpotBiasLevel +
    insuranceLevel;

  const activePins = deriveActiveSpecialPins(
    config,
    specialLevels,
  );

  return {
    pocketLevels,
    specialLevels,
    activePins,
    pegRoles: derivePegVisualRoles(activePins),
    pocketMultipliers: derivePocketMultipliers(
      config,
      pocketLevels,
    ),
    maxBetLevel,
    insuranceLevel,
    insuranceArmed,
    progressionUnits,
  };
};

export const getPegVisualRole = (
  pegId: string,
  roles: PlinkoPegVisualRoles,
): PlinkoPegVisualRole =>
  roles[pegId] ?? 'regular';

export const getPocketVisualRole = (
  index: number,
  config: BalanceConfig,
): PlinkoPocketVisualRole => {
  const families = config.plinko.pocketFamilies;

  if (families.edge.includes(index)) {
    return 'jackpot';
  }
  if (families.outerStatic.includes(index)) {
    return 'outer';
  }
  if (families.mid.includes(index)) {
    return 'mid';
  }
  if (families.inner.includes(index)) {
    return 'inner';
  }
  if (families.center.includes(index)) {
    return 'center';
  }

  throw new RangeError(
    `Pocket index ${index} is not assigned to a visual family`,
  );
};
