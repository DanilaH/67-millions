import { describe, expect, it } from 'vitest';

import {
  PLINKO_AUDIO_LIMITS,
  PLINKO_AUDIO_MAX_THEORETICAL_MIX_GAIN,
  PLINKO_SPECIAL_CUE_SIGNATURES,
  SpecialCueGate,
  type SpecialCueKind,
} from '../src/audio/PlinkoAudio';

describe('Plinko special-pin audio prototype', () => {
  it('keeps Amplifier, Splitter, and Return cue signatures distinct', () => {
    const signatures = Object.values(PLINKO_SPECIAL_CUE_SIGNATURES);
    const serialized = signatures.map((signature) =>
      JSON.stringify(signature),
    );

    expect(new Set(serialized).size).toBe(3);
    expect(
      PLINKO_SPECIAL_CUE_SIGNATURES.amplifier.startFrequency,
    ).toBeLessThan(
      PLINKO_SPECIAL_CUE_SIGNATURES.amplifier.endFrequency!,
    );
    expect(
      PLINKO_SPECIAL_CUE_SIGNATURES.return.startFrequency,
    ).toBeGreaterThan(
      PLINKO_SPECIAL_CUE_SIGNATURES.return.endFrequency!,
    );
  });

  it('groups repeated same-kind special hits during a 24-ball burst', () => {
    const kinds: readonly SpecialCueKind[] = [
      'amplifier',
      'splitter',
      'return',
    ];

    for (const kind of kinds) {
      const gate = new SpecialCueGate();
      const accepted = Array.from(
        { length: 24 },
        () => gate.tryTrigger(kind, 1_000),
      ).filter(Boolean).length;

      expect(accepted).toBe(1);
    }
  });

  it('allows each distinct special cue through independently at the same instant', () => {
    const gate = new SpecialCueGate();

    expect(gate.tryTrigger('amplifier', 2_000)).toBe(true);
    expect(gate.tryTrigger('splitter', 2_000)).toBe(true);
    expect(gate.tryTrigger('return', 2_000)).toBe(true);
  });

  it('releases a grouped cue again once its kind-specific window expires', () => {
    const gate = new SpecialCueGate();
    const start = 5_000;

    expect(gate.tryTrigger('splitter', start)).toBe(true);
    expect(
      gate.tryTrigger(
        'splitter',
        start + PLINKO_AUDIO_LIMITS.specialRepeatMs.splitter - 1,
      ),
    ).toBe(false);
    expect(
      gate.tryTrigger(
        'splitter',
        start + PLINKO_AUDIO_LIMITS.specialRepeatMs.splitter,
      ),
    ).toBe(true);
  });

  it('keeps theoretical simultaneous oscillator gain below clipping', () => {
    expect(PLINKO_AUDIO_MAX_THEORETICAL_MIX_GAIN).toBeLessThan(1);
    expect(PLINKO_AUDIO_MAX_THEORETICAL_MIX_GAIN).toBeCloseTo(
      0.6,
      6,
    );
  });
});
