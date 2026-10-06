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
    maxConcurrentDrops: z.number().int().min(1).max(6),
    maxSplitDepth: z.number().int().nonnegative(),
    maxBetLevels: z.array(plinkoLevelSchema.extend({
      maxBet: z.number().int().positive(),
    })).min(1),
    centerUpgrades: z.array(plinkoLevelSchema.extend({
      center: z.number().positive(),
      inner: z.number().positive().optional(),
    })),
    midUpgrades: z.array(plinkoLevelSchema.extend({
      mid: z.number().positive(),
      inner: z.number().positive().optional(),
    })),
    jackpotUpgrades: z.array(plinkoLevelSchema.extend({
      edge: z.number().positive(),
    })),
    amplifier: z.array(plinkoLevelSchema.extend({
      count: z.number().int().min(1).max(3),
      multiplier: z.number().positive(),
    })),
    return: z.array(plinkoLevelSchema.extend({
      targetFrequency: z.number().min(0).max(1),
    })),
    splitter: z.array(plinkoLevelSchema.extend({
      childValue: z.number().positive(),
    })),
    jackpotBias: z.array(plinkoLevelSchema.extend({
      deflectorPairs: z.array(z.object({
        deflectorOffsetX: z.number().positive(),
        deflectorY: z.number(),
        length: z.number().positive(),
        thickness: z.number().positive(),
        angleDegrees: z.number().positive().lt(90),
        restitution: z.number().min(0).max(1),
      })).min(1).max(4),
    })),
    insurance: z.array(plinkoLevelSchema.extend({
      lossesNeeded: z.number().int().positive(),
      floor: z.number().min(0).max(1),
    })),
    splitterPhysics: z.object({
      childHorizontalOffsetPx: z.number().positive(),
      childHorizontalVelocityDelta: z.number().positive(),
      childVerticalVelocityMultiplier: z.number().positive().max(1),
    }),
    returnPhysics: z.object({
      horizontalRetention: z.number().min(0).max(1),
      horizontalRetentionByLevel: z.array(z.number().min(0).max(1)).length(4).optional(),
      resetVelocity: z.literal(true),
    }),
    stuckWatchdog: z.object({
      speedEpsilon: z.number().positive(),
      stationaryTicks: z.number().int().positive(),
      horizontalVelocity: z.number().positive(),
      downwardVelocity: z.number().positive(),
    }),
    ballBallCollisions: z.literal(false),
    specialPinLayout: z.object({
      id: z.enum(['BOARD_LAYOUT_V0', 'BOARD_LAYOUT_V1']),
      calibrationSeed: z.number().int().positive(),
      calibrationRuns: z.number().int().min(100_000),
      amplifierByCount: z.object({
        '1': z.tuple([z.string().min(1)]),
        '2': z.tuple([z.string().min(1), z.string().min(1)]),
        '3': z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
      }),
      returnByLevel: z.array(z.object({
        level: z.number().int().positive(),
        pegIds: z.tuple([z.string().min(1), z.string().min(1)]),
        targetFrequency: z.number().min(0).max(1),
        measuredBareHitRate: z.number().min(0).max(1),
      })).min(1),
      splitterPegIds: z.tuple([z.string().min(1)]),
    }),
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
      pocketDividerPegOverlapPx: z.number().nonnegative(),
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


  const parsePegId = (id: string): { row: number; column: number } | null => {
    const match = /^r(\d+)c(\d+)$/.exec(id);
    if (!match) return null;
    return { row: Number(match[1]), column: Number(match[2]) };
  };

  const mirrorPegId = (id: string): string | null => {
    const parsed = parsePegId(id);
    if (!parsed) return null;
    return `r${parsed.row}c${parsed.row - parsed.column}`;
  };

  const allSpecialIds = [
    ...value.plinko.specialPinLayout.amplifierByCount['3'],
    ...value.plinko.specialPinLayout.returnByLevel.flatMap((entry) => entry.pegIds),
    ...value.plinko.specialPinLayout.splitterPegIds,
  ];

  for (const id of allSpecialIds) {
    const parsed = parsePegId(id);
    if (
      !parsed ||
      parsed.row < 0 ||
      parsed.row >= value.plinko.rows ||
      parsed.column < 0 ||
      parsed.column > parsed.row
    ) {
      context.addIssue({
        code: 'custom',
        path: ['plinko', 'specialPinLayout'],
        message: `Invalid Plinko peg id: ${id}`,
      });
    }
  }

  for (const [count, ids] of Object.entries(value.plinko.specialPinLayout.amplifierByCount)) {
    const set = new Set(ids);
    if (
      set.size !== ids.length ||
      ids.some((id) => {
        const mirror = mirrorPegId(id);
        return mirror === null || !set.has(mirror);
      })
    ) {
      context.addIssue({
        code: 'custom',
        path: ['plinko', 'specialPinLayout', 'amplifierByCount', count],
        message: 'Amplifier pin set must be unique and mirror-symmetric',
      });
    }
  }

  const expectedReturnLevels = value.plinko.return.map((entry) => entry.level);
  const actualReturnLevels = value.plinko.specialPinLayout.returnByLevel.map((entry) => entry.level);
  if (
    expectedReturnLevels.length !== actualReturnLevels.length ||
    expectedReturnLevels.some((level, index) => actualReturnLevels[index] !== level)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['plinko', 'specialPinLayout', 'returnByLevel'],
      message: 'Return layout must define every Return level in config order',
    });
  }

  for (const [index, entry] of value.plinko.specialPinLayout.returnByLevel.entries()) {
    const set = new Set(entry.pegIds);
    const configured = value.plinko.return[index];
    if (
      set.size !== entry.pegIds.length ||
      entry.pegIds.some((id) => {
        const mirror = mirrorPegId(id);
        return mirror === null || !set.has(mirror);
      })
    ) {
      context.addIssue({
        code: 'custom',
        path: ['plinko', 'specialPinLayout', 'returnByLevel', index, 'pegIds'],
        message: 'Return peg pair must be unique and mirror-symmetric',
      });
    }
    if (configured && configured.targetFrequency !== entry.targetFrequency) {
      context.addIssue({
        code: 'custom',
        path: ['plinko', 'specialPinLayout', 'returnByLevel', index, 'targetFrequency'],
        message: 'Return layout targetFrequency must match the configured Return level',
      });
    }
  }

  const splitterSet = new Set(value.plinko.specialPinLayout.splitterPegIds);
  if (
    value.plinko.specialPinLayout.splitterPegIds.some((id) => {
      const mirror = mirrorPegId(id);
      return mirror === null || !splitterSet.has(mirror);
    })
  ) {
    context.addIssue({
      code: 'custom',
      path: ['plinko', 'specialPinLayout', 'splitterPegIds'],
      message: 'Splitter seed pins must be mirror-symmetric',
    });
  }

  const mutuallyExclusiveAtRuntime = [
    ...value.plinko.specialPinLayout.amplifierByCount['3'],
    ...value.plinko.specialPinLayout.returnByLevel.flatMap((entry) => entry.pegIds),
    ...value.plinko.specialPinLayout.splitterPegIds,
  ];
  if (new Set(mutuallyExclusiveAtRuntime).size !== mutuallyExclusiveAtRuntime.length) {
    context.addIssue({
      code: 'custom',
      path: ['plinko', 'specialPinLayout'],
      message: 'Special-pin seed slots must not overlap across systems',
    });
  }
});

export type BalanceConfig = z.infer<typeof balanceSchema>;
