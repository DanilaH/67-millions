import { applyBoundedPitchVariation } from '@danilah/mini-games-kit/audio';

import { VoiceBudget } from './VoiceBudget';

type ToneKind =
  | 'bounce'
  | 'pocket'
  | 'good'
  | 'bad'
  | 'amplifier'
  | 'splitter'
  | 'return';

interface ToneSpec {
  frequency: number;
  endFrequency?: number;
  durationMs: number;
  gain: number;
  waveform: OscillatorType;
  variation: number;
}

const TONES: Record<ToneKind, ToneSpec> = {
  bounce: {
    frequency: 180,
    durationMs: 34,
    gain: 0.025,
    waveform: 'triangle',
    variation: 0.16,
  },
  pocket: {
    frequency: 520,
    endFrequency: 680,
    durationMs: 85,
    gain: 0.055,
    waveform: 'sine',
    variation: 0.08,
  },
  good: {
    frequency: 680,
    endFrequency: 1040,
    durationMs: 150,
    gain: 0.075,
    waveform: 'triangle',
    variation: 0.035,
  },
  bad: {
    frequency: 150,
    endFrequency: 92,
    durationMs: 170,
    gain: 0.065,
    waveform: 'sawtooth',
    variation: 0.025,
  },
  amplifier: {
    frequency: 420,
    endFrequency: 880,
    durationMs: 105,
    gain: 0.045,
    waveform: 'triangle',
    variation: 0.04,
  },
  splitter: {
    frequency: 260,
    endFrequency: 520,
    durationMs: 95,
    gain: 0.05,
    waveform: 'square',
    variation: 0.055,
  },
  return: {
    frequency: 920,
    endFrequency: 460,
    durationMs: 125,
    gain: 0.045,
    waveform: 'sine',
    variation: 0.03,
  },
};

const unitFromCounter = (counter: number): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

export type SpecialCueKind = 'amplifier' | 'splitter' | 'return';

export const PLINKO_AUDIO_LIMITS = {
  bounceVoices: 6,
  accentVoices: 4,
  specialVoices: 3,
  specialRepeatMs: {
    amplifier: 26,
    splitter: 32,
    return: 40,
  } satisfies Record<SpecialCueKind, number>,
} as const;

export const PLINKO_AUDIO_MAX_THEORETICAL_MIX_GAIN =
  PLINKO_AUDIO_LIMITS.bounceVoices * TONES.bounce.gain +
  PLINKO_AUDIO_LIMITS.accentVoices *
    Math.max(TONES.pocket.gain, TONES.good.gain, TONES.bad.gain) +
  PLINKO_AUDIO_LIMITS.specialVoices *
    Math.max(
      TONES.amplifier.gain,
      TONES.splitter.gain,
      TONES.return.gain,
    );

export const PLINKO_SPECIAL_CUE_SIGNATURES = {
  amplifier: {
    startFrequency: TONES.amplifier.frequency,
    endFrequency: TONES.amplifier.endFrequency,
    waveform: TONES.amplifier.waveform,
    durationMs: TONES.amplifier.durationMs,
  },
  splitter: {
    startFrequency: TONES.splitter.frequency,
    endFrequency: TONES.splitter.endFrequency,
    waveform: TONES.splitter.waveform,
    durationMs: TONES.splitter.durationMs,
  },
  return: {
    startFrequency: TONES.return.frequency,
    endFrequency: TONES.return.endFrequency,
    waveform: TONES.return.waveform,
    durationMs: TONES.return.durationMs,
  },
} as const;

export class SpecialCueGate {
  private readonly lastAt = new Map<SpecialCueKind, number>();

  public tryTrigger(kind: SpecialCueKind, nowMs: number): boolean {
    const previous = this.lastAt.get(kind) ?? -Infinity;
    if (
      nowMs - previous <
      PLINKO_AUDIO_LIMITS.specialRepeatMs[kind]
    ) {
      return false;
    }

    this.lastAt.set(kind, nowMs);
    return true;
  }
}

export class PlinkoAudio {
  private context: AudioContext | null = null;
  private disposed = false;
  private cueCounter = 0;
  private lastBounceAtMs = -Infinity;

  private readonly bounceBudget = new VoiceBudget(
    PLINKO_AUDIO_LIMITS.bounceVoices,
  );
  private readonly accentBudget = new VoiceBudget(
    PLINKO_AUDIO_LIMITS.accentVoices,
  );
  private readonly specialBudget = new VoiceBudget(
    PLINKO_AUDIO_LIMITS.specialVoices,
  );
  private readonly specialCueGate = new SpecialCueGate();

  public constructor(
    private readonly isMuted: () => boolean,
    private readonly nowMs: () => number = () => performance.now(),
  ) {}

  public prime(): void {
    if (this.disposed || this.isMuted()) return;
    const context = this.getContext();
    if (context?.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  }

  public bounce(): void {
    const now = this.nowMs();
    if (now - this.lastBounceAtMs < 12) return;
    this.lastBounceAtMs = now;
    this.play('bounce', this.bounceBudget);
  }

  public pocket(multiplier: number): void {
    const normalizedBoost = Math.min(1.35, 1 + Math.max(0, multiplier - 1) * 0.025);
    this.play('pocket', this.accentBudget, normalizedBoost);
  }

  public result(losing: boolean): void {
    this.play(losing ? 'bad' : 'good', this.accentBudget);
  }

  public amplifier(): void {
    this.special('amplifier');
  }

  public splitter(): void {
    this.special('splitter');
  }

  public returnCue(): void {
    this.special('return');
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    if (this.disposed || typeof AudioContext === 'undefined') return null;

    try {
      this.context = new AudioContext();
      return this.context;
    } catch {
      return null;
    }
  }

  private special(kind: SpecialCueKind): void {
    const now = this.nowMs();
    if (!this.specialCueGate.tryTrigger(kind, now)) return;
    this.play(kind, this.specialBudget);
  }

  private play(
    kind: ToneKind,
    budget: VoiceBudget,
    frequencyMultiplier = 1,
  ): void {
    if (this.disposed || this.isMuted() || !budget.tryAcquire()) return;

    const context = this.getContext();
    if (!context || context.state !== 'running') {
      budget.release();
      return;
    }

    const spec = TONES[kind];
    const now = context.currentTime;
    const durationSeconds = spec.durationMs / 1000;
    const pitch = applyBoundedPitchVariation(
      spec.variation,
      unitFromCounter(++this.cueCounter),
    );

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = spec.waveform;
    oscillator.frequency.setValueAtTime(
      spec.frequency * frequencyMultiplier * pitch,
      now,
    );
    if (spec.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        spec.endFrequency * frequencyMultiplier * pitch,
        now + durationSeconds,
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(spec.gain, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.012, durationSeconds),
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    const cleanup = (): void => {
      oscillator.removeEventListener('ended', cleanup);
      try {
        oscillator.disconnect();
      } catch {
        // already disconnected
      }
      try {
        gain.disconnect();
      } catch {
        // already disconnected
      }
      budget.release();
    };

    oscillator.addEventListener('ended', cleanup);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.02);
  }
}
