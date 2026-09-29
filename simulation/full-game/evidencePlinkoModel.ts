import type { BalanceConfig } from '../../src/config/balance.schema';
import { roundMoney } from '../../src/core/economy/money';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import {
  derivePocketMultipliers,
} from '../../src/core/plinko-rules/progression';
import type {
  PlinkoOutcomeModel,
} from './runner';

export const EVIDENCE_MODEL_ID =
  'physical-evidence-derived-rtp-v1';

export const EVIDENCE_MODEL_NOTES = [
  'Base pocket probabilities are the accepted BARE_BOARD_V0 100k physical frequencies.',
  'Pocket-upgrade payouts use the production pocket multipliers with the accepted bare physical frequencies.',
  'Amplifier/Return/Splitter intermediate levels interpolate RTP factors between accepted T035 L1 and max 100k milestones.',
  'Jackpot Bias uses accepted T036 per-level RTP factors.',
  'Multiple special effects are approximated by multiplying evidence-derived RTP factors; combined-max is anchored to the accepted T036 combined-max RTP.',
  'This economy model does not reproduce special-effect payout tails or Bias pocket redistribution and must not be treated as final physical balance evidence.',
] as const;

const BARE_POCKET_FREQUENCIES = [
  0.00585,
  0.01488,
  0.04778,
  0.17512,
  0.26211,
  0.25977,
  0.16899,
  0.04553,
  0.01421,
  0.00576,
] as const;

const T035_BASELINE_RTP = 0.856828;
const T035_AMPLIFIER_L1_RTP = 0.879656;
const T035_AMPLIFIER_MAX_RTP = 1.176129;
const T035_RETURN_L1_RTP = 0.941598;
const T035_RETURN_MAX_RTP = 1.196845;
const T035_SPLITTER_L1_RTP = 0.85403;
const T035_SPLITTER_MAX_RTP = 0.868017;

const T036_BIAS_RTP = [
  0.862298,
  0.936498,
  1.002343,
  1.238,
  1.310413,
] as const;
const T036_COMBINED_MAX_RTP = 2.307978;

const factor = (rtp: number, baseline: number): number =>
  rtp / baseline;

const interpolatedFactor = (
  level: number,
  maxLevel: number,
  level1Rtp: number,
  maxRtp: number,
): number => {
  if (level <= 0) return 1;
  if (maxLevel <= 1 || level >= maxLevel) {
    return factor(maxRtp, T035_BASELINE_RTP);
  }

  const l1 = factor(level1Rtp, T035_BASELINE_RTP);
  const max = factor(maxRtp, T035_BASELINE_RTP);
  const t = (level - 1) / (maxLevel - 1);
  return l1 + (max - l1) * t;
};

const maxConfiguredLevel = (
  levels: readonly { level: number }[],
): number => Math.max(...levels.map((entry) => entry.level));

const getSpecialRtpScale = (
  config: BalanceConfig,
  amplifierLevel: number,
  returnLevel: number,
  splitterLevel: number,
  biasLevel: number,
): number => {
  const amplifierFactor = interpolatedFactor(
    amplifierLevel,
    maxConfiguredLevel(config.plinko.amplifier),
    T035_AMPLIFIER_L1_RTP,
    T035_AMPLIFIER_MAX_RTP,
  );
  const returnFactor = interpolatedFactor(
    returnLevel,
    maxConfiguredLevel(config.plinko.return),
    T035_RETURN_L1_RTP,
    T035_RETURN_MAX_RTP,
  );
  const splitterFactor = interpolatedFactor(
    splitterLevel,
    maxConfiguredLevel(config.plinko.splitter),
    T035_SPLITTER_L1_RTP,
    T035_SPLITTER_MAX_RTP,
  );

  const biasRtp = T036_BIAS_RTP[biasLevel];
  if (biasRtp === undefined) {
    throw new RangeError(`Unsupported Jackpot Bias level ${biasLevel}`);
  }
  const biasFactor = factor(biasRtp, T036_BIAS_RTP[0]);

  const allMax =
    amplifierLevel === maxConfiguredLevel(config.plinko.amplifier) &&
    returnLevel === maxConfiguredLevel(config.plinko.return) &&
    splitterLevel === maxConfiguredLevel(config.plinko.splitter) &&
    biasLevel === maxConfiguredLevel(config.plinko.jackpotBias);

  if (allMax) {
    return T036_COMBINED_MAX_RTP / T035_BASELINE_RTP;
  }

  return (
    amplifierFactor *
    returnFactor *
    splitterFactor *
    biasFactor
  );
};

const samplePocketIndex = (roll: number): number => {
  let remaining = roll;
  for (
    let index = 0;
    index < BARE_POCKET_FREQUENCIES.length;
    index += 1
  ) {
    remaining -= BARE_POCKET_FREQUENCIES[index]!;
    if (remaining < 0) return index;
  }
  return BARE_POCKET_FREQUENCIES.length - 1;
};

export const createEvidenceDerivedPlinkoModel =
  (): PlinkoOutcomeModel => ({
    id: EVIDENCE_MODEL_ID,
    resolve: ({ state, pendingDrop, config }) => {
      const rng = new SeededRandom(state.rngState);
      const pocketIndex = samplePocketIndex(rng.next());
      const pockets = derivePocketMultipliers(
        config,
        pendingDrop.pocketLevelsAtCommit,
      );
      const pocketMultiplier = pockets[pocketIndex];
      if (pocketMultiplier === undefined) {
        throw new RangeError('Evidence model sampled invalid pocket');
      }

      const special = pendingDrop.specialLevelsAtCommit;
      const specialScale = getSpecialRtpScale(
        config,
        special.amplifierLevel,
        special.returnLevel,
        special.splitterLevel,
        special.jackpotBiasLevel,
      );

      return {
        aggregatePayout: roundMoney(
          pendingDrop.originalStake *
            pocketMultiplier *
            specialScale,
        ),
        nextRngState: rng.snapshot().state,
      };
    },
  });
