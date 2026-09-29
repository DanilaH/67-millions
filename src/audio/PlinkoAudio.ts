import { applyBoundedPitchVariation } from '@danilah/mini-games-kit/audio';

import {
  SPECIAL_PIN_VOICE_LIMIT,
  SpecialPinAudioPolicy,
  type SpecialPinAudioKind,
} from './SpecialPinAudioPolicy';
import { VoiceBudget } from './VoiceBudget';

type ToneKind =
  | 'bounce'
  | 'pocket'
  | 'good'
  | 'bad'
  | SpecialPinAudioKind;

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
    frequency: 920,
    endFrequency: 1320,
    durationMs: 130,
    gain: 0.048,
    waveform: 'triangle',
    variation: 0.025,
  },
  splitter: {
    frequency: 390,
    endFrequency: 235,
    durationMs: 115,
    gain: 0.05,
    waveform: 'square',
    variation: 0.02,
  },
  return: {
    frequency: 260,
    endFrequency: 620,
    durationMs: 185,
    gain: 0.045,
    waveform: 'sine',
    variation: 0.02,
  },
};

export const PLINKO_AUDIO_VOICE_LIMITS = {
  bounce: 6,
  accent: 4,
  special: SPECIAL_PIN_VOICE_LIMIT,
} as const;

export const PLINKO_AUDIO_MAX_GAINS = {
  bounce: TONES.bounce.gain,
  accent: Math.max(
    TONES.pocket.gain,
    TONES.good.gain,
    TONES.bad.gain,
  ),
  special: Math.max(
    TONES.amplifier.gain,
    TONES.splitter.gain,
    TONES.return.gain,
  ),
} as const;

export const PLINKO_AUDIO_WORST_CASE_PEAK_GAIN =
  PLINKO_AUDIO_VOICE_LIMITS.bounce * PLINKO_AUDIO_MAX_GAINS.bounce +
  PLINKO_AUDIO_VOICE_LIMITS.accent * PLINKO_AUDIO_MAX_GAINS.accent +
  PLINKO_AUDIO_VOICE_LIMITS.special * PLINKO_AUDIO_MAX_GAINS.special;

const unitFromCounter = (counter: number): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

export class PlinkoAudio {
  private context: AudioContext | null = null;
  private disposed = false;
  private cueCounter = 0;
  private lastBounceAtMs = -Infinity;

  private readonly bounceBudget = new VoiceBudget(
    PLINKO_AUDIO_VOICE_LIMITS.bounce,
  );
  private readonly accentBudget = new VoiceBudget(
    PLINKO_AUDIO_VOICE_LIMITS.accent,
  );
  private readonly specialBudget = new VoiceBudget(
    PLINKO_AUDIO_VOICE_LIMITS.special,
  );
  private readonly specialPolicy = new SpecialPinAudioPolicy(
    PLINKO_AUDIO_VOICE_LIMITS.special,
  );

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
    this.playSpecial('amplifier');
  }

  public splitter(): void {
    this.playSpecial('splitter');
  }

  public returnCue(): void {
    this.playSpecial('return');
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

  private playSpecial(kind: SpecialPinAudioKind): void {
    if (this.disposed || this.isMuted()) return;
    if (!this.specialPolicy.trySchedule(kind, this.nowMs())) return;

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
