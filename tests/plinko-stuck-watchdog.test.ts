import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  getPlinkoWatchdogVelocity,
  isPlinkoBodyTechnicallyStuck,
} from '../src/core/plinko-rules/stuckWatchdog';

describe('Plinko stuck-body watchdog', () => {
  it('does not fire before the configured stationary threshold', () => {
    const threshold = balance.plinko.stuckWatchdog.stationaryTicks;

    expect(
      isPlinkoBodyTechnicallyStuck(
        0,
        0,
        threshold - 1,
        balance,
      ),
    ).toBe(false);

    expect(
      isPlinkoBodyTechnicallyStuck(
        balance.plinko.stuckWatchdog.speedEpsilon * 2,
        0,
        threshold,
        balance,
      ),
    ).toBe(false);
  });

  it('fires only for sustained near-zero velocity and nudges downward away from center', () => {
    const threshold = balance.plinko.stuckWatchdog.stationaryTicks;

    expect(
      isPlinkoBodyTechnicallyStuck(0, 0, threshold, balance),
    ).toBe(true);

    const left = getPlinkoWatchdogVelocity(
      balance.plinko.geometry.centerX - 10,
      balance,
    );
    const right = getPlinkoWatchdogVelocity(
      balance.plinko.geometry.centerX + 10,
      balance,
    );

    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.y).toBeGreaterThan(0);
    expect(right.y).toBeGreaterThan(0);
  });
});
