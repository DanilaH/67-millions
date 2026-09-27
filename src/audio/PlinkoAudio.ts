import { applyBoundedPitchVariation } from '@danilah/mini-games-kit/audio';

import { VoiceBudget } from './VoiceBudget';

type ToneKind = 'bounce' | 'pocket' | 'good' | 'bad';

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
};

const unitFromCounter = (counter: number): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

export class PlinkoAudio {
  private context: AudioContext | null = null;
  private disposed = false;
  private cueCounter = 0;
  private lastBounceAtMs = -Infinity;

  private readonly bounceBudget = new VoiceBudget(6);
  private readonly accentBudget = new VoiceBudget(4);

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
