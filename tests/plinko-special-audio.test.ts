import { describe, expect, it } from 'vitest';

import {
  PLINKO_AUDIO_MAX_GAINS,
  PLINKO_AUDIO_VOICE_LIMITS,
  PLINKO_AUDIO_WORST_CASE_PEAK_GAIN,
  PLINKO_PAYOUT_COUNT_TICKS,
  PLINKO_PAYOUT_TICK_INTERVAL_MS,
  classifyPlinkoPocketAudio,
  shouldUseBigJackpotStinger,
} from '../src/audio/PlinkoAudio';
import {
  SPECIAL_PIN_CUE_TIMINGS,
  SPECIAL_PIN_VOICE_LIMIT,
  SpecialPinAudioPolicy,
  type SpecialPinAudioKind,
} from '../src/audio/SpecialPinAudioPolicy';

describe('Plinko production audio policy', () => {
  it('keeps worst-case summed voice gain below digital full scale', () => {
    expect(PLINKO_AUDIO_VOICE_LIMITS).toEqual({
      bounce: 6,
      accent: 4,
      special: 5,
      transfer: 3,
    });

    expect(
      PLINKO_AUDIO_MAX_GAINS.special,
    ).toBeLessThanOrEqual(0.05);
    expect(
      PLINKO_AUDIO_MAX_GAINS.accent,
    ).toBeLessThanOrEqual(0.08);
    expect(
      PLINKO_AUDIO_WORST_CASE_PEAK_GAIN,
    ).toBeCloseTo(0.774);
    expect(
      PLINKO_AUDIO_WORST_CASE_PEAK_GAIN,
    ).toBeLessThan(1);
  });

  it('keeps all three special cue families readable in a 24-body burst without exceeding the voice cap', () => {
    const policy = new SpecialPinAudioPolicy();
    const kinds: readonly SpecialPinAudioKind[] = [
      'amplifier',
      'splitter',
      'return',
    ];

    for (let index = 0; index < 72; index += 1) {
      const kind = kinds[index % kinds.length]!;
      policy.trySchedule(kind, index * 9);
    }

    const during = policy.snapshot(72 * 9);

    expect(
      during.maxObservedActiveVoices,
    ).toBeLessThanOrEqual(
      SPECIAL_PIN_VOICE_LIMIT,
    );
    expect(
      during.accepted.amplifier,
    ).toBeGreaterThan(0);
    expect(
      during.accepted.splitter,
    ).toBeGreaterThan(0);
    expect(
      during.accepted.return,
    ).toBeGreaterThan(0);
    expect(
      during.rejectedByCooldown +
        during.rejectedByVoiceLimit,
    ).toBeGreaterThan(0);

    expect(
      policy.snapshot(2_000).activeVoices,
    ).toBe(0);
  });

  it('gives Amplifier, Splitter, and Return different cadence envelopes', () => {
    expect(
      SPECIAL_PIN_CUE_TIMINGS.amplifier,
    ).not.toEqual(
      SPECIAL_PIN_CUE_TIMINGS.splitter,
    );
    expect(
      SPECIAL_PIN_CUE_TIMINGS.splitter,
    ).not.toEqual(
      SPECIAL_PIN_CUE_TIMINGS.return,
    );
    expect(
      SPECIAL_PIN_CUE_TIMINGS.return.durationMs,
    ).toBeGreaterThan(
      SPECIAL_PIN_CUE_TIMINGS.splitter.durationMs,
    );
  });

  it('coalesces repeated same-kind impacts inside its cue-specific cooldown', () => {
    const policy = new SpecialPinAudioPolicy();

    expect(
      policy.trySchedule('splitter', 0),
    ).toBe(true);
    expect(
      policy.trySchedule('splitter', 10),
    ).toBe(false);
    expect(
      policy.trySchedule('splitter', 47),
    ).toBe(false);
    expect(
      policy.trySchedule('splitter', 48),
    ).toBe(true);

    const snapshot = policy.snapshot(48);
    expect(snapshot.accepted.splitter).toBe(2);
    expect(snapshot.rejectedByCooldown).toBe(2);
  });

  it('separates bad pockets, ordinary pockets, and jackpot edges', () => {
    expect(
      classifyPlinkoPocketAudio(0.25, false),
    ).toBe('badPocket');
    expect(
      classifyPlinkoPocketAudio(1, false),
    ).toBe('pocket');
    expect(
      classifyPlinkoPocketAudio(4, false),
    ).toBe('pocket');
    expect(
      classifyPlinkoPocketAudio(12, true),
    ).toBe('jackpotEdge');
  });

  it('uses the config-derived big-result threshold inclusively', () => {
    expect(
      shouldUseBigJackpotStinger(11.99, 12),
    ).toBe(false);
    expect(
      shouldUseBigJackpotStinger(12, 12),
    ).toBe(true);
    expect(
      shouldUseBigJackpotStinger(18, 12),
    ).toBe(true);
    expect(
      shouldUseBigJackpotStinger(
        Number.NaN,
        12,
      ),
    ).toBe(false);
  });

  it('bounds payout-count layering to its dedicated transfer budget', () => {
    expect(PLINKO_PAYOUT_COUNT_TICKS).toBe(3);
    expect(
      PLINKO_AUDIO_VOICE_LIMITS.transfer,
    ).toBe(PLINKO_PAYOUT_COUNT_TICKS);
    expect(
      PLINKO_PAYOUT_TICK_INTERVAL_MS,
    ).toBeGreaterThanOrEqual(40);
  });
});
