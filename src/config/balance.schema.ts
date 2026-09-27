import { z } from 'zod';

const timeString = z.string().regex(/^\d{2}:\d{2}$/);

const workLevelSchema = z.object({
  level: z.number().int().positive(),
  payout: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  energyCost: z.number().nonnegative(),
  happinessCost: z.number().nonnegative(),
  window: z.string().min(1),
  upgradePrice: z.number().int().nonnegative(),
});

const jobSchema = z.object({
  minigame: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  levels: z.array(workLevelSchema).min(1),
});

const eventChoiceSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

const eventDefinitionSchema = z.object({
  id: z.string().min(1),
  a: eventChoiceSchema,
  b: eventChoiceSchema,
  eligibility: z.string().min(1),
});

const plinkoLevelSchema = z.object({
  level: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
}).passthrough();

export const balanceSchema = z.object({
  meta: z.object({
    version: z.string().min(1),
    date: z.string().min(1),
    sourceOfTruth: z.literal(true),
    targetMedianSuccessfulRealMinutes: z.number().positive(),
    balanceEvidence: z.string().min(1),
    moneyRounding: z.literal('nearestInteger'),
  }),
  time: z.object({
    realSecondsPerGameMinute: z.number().positive(),
    gameDayBoundary: timeString,
    offlineProgression: z.literal(false),
    navigationTimeMinutes: z.number().int().nonnegative(),
    plinkoDropTimeMinutes: z.number().int().positive(),
    eventCheckpoints: z.array(timeString),
    eventChecksDuringSleep: z.boolean(),
  }),
  game: z.object({
    mainDebt: z.number().int().positive(),
    startCash: z.number().int().nonnegative(),
    startTime: timeString,
    startHealth: z.number(),
    startSatiety: z.number(),
    startEnergy: z.number(),
    startHappiness: z.number(),
    restartResetsEverything: z.literal(true),
    permanentMetaprogression: z.literal(false),
  }),
  barry: z.object({
    time: timeString,
    payments: z.array(z.number().int().positive()).min(1),
    afterLastMultiplier: z.number().positive(),
    mainDebtPaymentsReducePrincipal: z.literal(false),
  }),
  needs: z.object({
    min: z.number(),
    max: z.number(),
    satietyPerHour: z.number(),
    energyAwakePerHour: z.number(),
    happinessAwakePerHour: z.number(),
    lowThreshold: z.number(),
    hpLossPerLowNeedPerHour: z.number().nonnegative(),
    extraHpLossPerZeroNeedPerHour: z.number().nonnegative(),
    plinkoLosingDropHappiness: z.number(),
  }),
  sleep: z.object({
    fullSleepHours: z.number().positive(),
    fullSleepHealthRestore: z.number().nonnegative(),
    workPenaltyPerMissingHour: z.number().min(0).max(1),
    workPayoutFloorMultiplier: z.number().min(0).max(1),
    barryStopsSleep: z.literal(true),
  }),
  work: z.object({
    requiresEnergyAtLeastCost: z.literal(true),
    windowChecksStartOnly: z.literal(true),
    failure: z.object({
      payoutMultiplier: z.number().nonnegative(),
      fineAsPotentialPayout: z.number().min(0),
      extraHappiness: z.number(),
    }),
    jobs: z.object({
      dishes: jobSchema,
      trash: jobSchema,
      courier: jobSchema,
    }),
  }),
  food: z.array(z.object({
    id: z.string().min(1),
    price: z.number().int().nonnegative(),
    satiety: z.number(),
    happiness: z.number(),
    energy: z.number(),
    hp: z.number(),
    durationMinutes: z.number().int().positive(),
  })).min(1),
  entertainment: z.array(z.object({
    id: z.string().min(1),
    price: z.number().int().nonnegative(),
    happiness: z.number(),
    durationMinutes: z.number().int().positive(),
  })).min(1),
  statuses: z.object({
    SMELLY: z.object({
      blocksJobs: z.array(z.string()),
      paidEntertainmentMultiplier: z.number().min(0),
    }),
  }),
  shower: z.object({
    price: z.number().int().nonnegative(),
    durationMinutes: z.number().int().positive(),
    removes: z.array(z.string()),
  }),
  dumpster: z.object({
    durationMinutes: z.number().int().positive(),
    energyCost: z.number().nonnegative(),
    energyShortfallToHappiness: z.number().min(0),
    happinessShortfallToHp: z.number().min(0),
    emptyChanceByConsecutiveSearch: z.array(z.number().min(0).max(1)).min(1),
    emptyChanceCap: z.number().min(0).max(1),
    resetStreakAtGameDayBoundary: z.boolean(),
    resetStreakAfterSleep: z.boolean(),
    appliesStatus: z.string(),
    inventoryEnabled: z.literal(false),
    loot: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
    lootRollMode: z.string().min(1),
  }),
  events: z.object({
    chancePerCheckpoint: z.number().min(0).max(1),
    maxPerGameDay: z.number().int().nonnegative(),
    noImmediateRepeat: z.boolean(),
    sameModifierStacks: z.boolean(),
    definitions: z.array(eventDefinitionSchema).min(1),
    pendingLimit: z.number().int().nonnegative(),
    suppressRollsWhilePending: z.boolean(),
    payChoiceRequiresCash: z.boolean(),
  }),
  plinko: z.object({
    casinoAlwaysOpen: z.boolean(),
    rows: z.number().int().positive(),
    basePockets: z.array(z.number().positive()).min(2),
    pocketFamilies: z.object({
      edge: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
      outerStatic: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
      mid: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
      inner: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
      center: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
    }),
    targetBareEV: z.number().positive(),
    payoutMultiplierMeansTotalReturn: z.literal(true),
    spawn: z.object({
      mode: z.literal('centerWithSeededJitter'),
      manualAim: z.literal(false),
    }),
    quickBetFractions: z.array(z.number().positive().max(1)).min(1),
    maxActiveBalls: z.number().int().positive(),
    maxSplitDepth: z.number().int().nonnegative(),
    maxBetLevels: z.array(plinkoLevelSchema.extend({
      maxBet: z.number().int().positive(),
    })).min(1),
    centerUpgrades: z.array(plinkoLevelSchema),
    midUpgrades: z.array(plinkoLevelSchema),
    jackpotUpgrades: z.array(plinkoLevelSchema),
    amplifier: z.array(plinkoLevelSchema),
    return: z.array(plinkoLevelSchema),
    splitter: z.array(plinkoLevelSchema),
    jackpotBias: z.array(plinkoLevelSchema),
    insurance: z.array(plinkoLevelSchema),
    boardChangesLockedWhileDropActive: z.boolean(),
    maxBetPriceStatus: z.string(),
    otherUpgradePriceStatus: z.string(),
    pendingDropLocksAllOtherCashMutations: z.literal(true),
    clockFreezesAtBarryBoundaryUntilActiveCascadeResolves: z.literal(true),
    geometry: z.object({
      logicalViewportWidth: z.number().positive(),
      logicalViewportHeight: z.number().positive(),
      boardAreaWidth: z.number().positive(),
      boardAreaHeight: z.number().positive(),
      centerX: z.number(),
      topPegY: z.number(),
      horizontalPegSpacing: z.number().positive(),
      verticalPegSpacing: z.number().positive(),
      ballRadius: z.number().positive(),
      pegRadius: z.number().positive(),
      pocketCenterSpacing: z.number().positive(),
      fixedTimestepHz: z.number().positive(),
      spawnHorizontalJitterPx: z.number().nonnegative(),
    }),
    physicsSeed: z.object({
      gravityY: z.number(),
      ballRestitution: z.number(),
      pegRestitution: z.number(),
      friction: z.number(),
      frictionAir: z.number(),
      wallRestitution: z.number(),
    }),
  }),
  ads: z.object({
    interstitialRequired: z.boolean(),
    v0SafePlacements: z.array(z.string()),
    rewardedCoreBalance: z.literal(false),
  }),
  actions: z.object({
    timedPaidAction: z.object({
      cashCostTiming: z.literal('START'),
      effectTiming: z.literal('COMPLETION'),
    }),
    work: z.object({
      stateCostTiming: z.literal('START'),
      payoutFineTiming: z.literal('COMPLETION'),
    }),
    dumpster: z.object({
      stateCostTiming: z.literal('START'),
      lootTiming: z.literal('COMPLETION'),
    }),
    sleep: z.object({
      restoreMode: z.literal('LINEAR_OVER_SLEPT_GAME_TIME'),
    }),
  }),
}).superRefine((value, context) => {
  if (value.needs.min >= value.needs.max) {
    context.addIssue({
      code: 'custom',
      path: ['needs'],
      message: 'needs.min must be lower than needs.max',
    });
  }
  if (value.plinko.basePockets.length !== value.plinko.rows + 1) {
    context.addIssue({
      code: 'custom',
      path: ['plinko', 'basePockets'],
      message: 'Plinko must have rows + 1 pockets',
    });
  }

  const pocketCount = value.plinko.basePockets.length;
  const familyIndices = Object.values(value.plinko.pocketFamilies).flat();
  const uniqueIndices = new Set(familyIndices);

  if (
    familyIndices.length !== pocketCount ||
    uniqueIndices.size !== pocketCount ||
    familyIndices.some((index) => index < 0 || index >= pocketCount)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['plinko', 'pocketFamilies'],
      message: 'Pocket families must cover each valid pocket index exactly once',
    });
  }

  for (const [family, pair] of Object.entries(value.plinko.pocketFamilies)) {
    if (pair[0] + pair[1] !== pocketCount - 1) {
      context.addIssue({
        code: 'custom',
        path: ['plinko', 'pocketFamilies', family],
        message: 'Pocket family pairs must be mirror-symmetric',
      });
    }
  }
});

export type BalanceConfig = z.infer<typeof balanceSchema>;
