import {
  applyBoundedPitchVariation,
  getAccumulationPitchMultiplier,
} from '@danilah/mini-games-kit/audio';

import {
  SPECIAL_PIN_VOICE_LIMIT,
  SpecialPinAudioPolicy,
  type SpecialPinAudioKind,
} from './SpecialPinAudioPolicy';
import { VoiceBudget } from './VoiceBudget';

export type PlinkoPocketAudioKind =
  | 'pocket'
  | 'badPocket'
  | 'jackpotEdge';

type ToneKind =
  | 'bounce'
  | PlinkoPocketAudioKind
  | 'good'
  | 'bad'
  | 'payoutTick'
  | 'bigJackpot'
  | 'insurance'
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
  badPocket: {
    frequency: 180,
    endFrequency: 112,
    durationMs: 105,
    gain: 0.052,
    waveform: 'sawtooth',
    variation: 0.035,
  },
  jackpotEdge: {
    frequency: 760,
    endFrequency: 1280,
    durationMs: 145,
    gain: 0.068,
    waveform: 'triangle',
    variation: 0.025,
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
  payoutTick: {
    frequency: 620,
    durationMs: 44,
    gain: 0.018,
    waveform: 'sine',
    variation: 0.012,
  },
  bigJackpot: {
    frequency: 520,
    endFrequency: 1560,
    durationMs: 320,
    gain: 0.08,
    waveform: 'triangle',
    variation: 0.018,
  },
  insurance: {
    frequency: 300,
    endFrequency: 900,
    durationMs: 220,
    gain: 0.045,
    waveform: 'sine',
    variation: 0.018,
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

export const PLINKO_PAYOUT_COUNT_TICKS = 3;
export const PLINKO_PAYOUT_TICK_INTERVAL_MS = 52;
export const PLINKO_PAYOUT_PITCH_PROFILE = {
  startMultiplier: 0.92,
  endMultiplier: 1.2,
  jitterAmount: 0.01,
} as const;

export const PLINKO_AUDIO_VOICE_LIMITS = {
  bounce: 6,
  accent: 4,
  special: SPECIAL_PIN_VOICE_LIMIT,
  transfer: PLINKO_PAYOUT_COUNT_TICKS,
} as const;

export const PLINKO_AUDIO_MAX_GAINS = {
  bounce: TONES.bounce.gain,
  accent: Math.max(
    TONES.pocket.gain,
    TONES.badPocket.gain,
    TONES.jackpotEdge.gain,
    TONES.good.gain,
    TONES.bad.gain,
    TONES.bigJackpot.gain,
    TONES.insurance.gain,
  ),
  special: Math.max(
    TONES.amplifier.gain,
    TONES.splitter.gain,
    TONES.return.gain,
  ),
  transfer: TONES.payoutTick.gain,
} as const;

export const PLINKO_AUDIO_WORST_CASE_PEAK_GAIN =
  PLINKO_AUDIO_VOICE_LIMITS.bounce *
    PLINKO_AUDIO_MAX_GAINS.bounce +
  PLINKO_AUDIO_VOICE_LIMITS.accent *
    PLINKO_AUDIO_MAX_GAINS.accent +
  PLINKO_AUDIO_VOICE_LIMITS.special *
    PLINKO_AUDIO_MAX_GAINS.special +
  PLINKO_AUDIO_VOICE_LIMITS.transfer *
    PLINKO_AUDIO_MAX_GAINS.transfer;

export const PLINKO_AUDIO_MASTER_GAIN = 0.82;

export const PLINKO_AUDIO_COMPRESSOR = {
  thresholdDb: -6,
  kneeDb: 8,
  ratio: 4,
  attackSeconds: 0.003,
  releaseSeconds: 0.16,
} as const;

export const PLINKO_AUDIO_WORST_CASE_POST_MASTER_GAIN =
  PLINKO_AUDIO_WORST_CASE_PEAK_GAIN *
  PLINKO_AUDIO_MASTER_GAIN;

export const classifyPlinkoPocketAudio = (
  multiplier: number,
  jackpotEdge: boolean,
): PlinkoPocketAudioKind => {
  if (jackpotEdge) return 'jackpotEdge';
  return multiplier < 1 ? 'badPocket' : 'pocket';
};

export const shouldUseBigJackpotStinger = (
  resultMultiplier: number,
  bigResultThreshold: number,
): boolean =>
  Number.isFinite(resultMultiplier) &&
  Number.isFinite(bigResultThreshold) &&
  bigResultThreshold > 0 &&
  resultMultiplier >= bigResultThreshold;

const unitFromCounter = (counter: number): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

export class PlinkoAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private blocked = false;
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
  private readonly transferBudget = new VoiceBudget(
    PLINKO_AUDIO_VOICE_LIMITS.transfer,
  );
  private readonly specialPolicy = new SpecialPinAudioPolicy(
    PLINKO_AUDIO_VOICE_LIMITS.special,
  );

  public constructor(
    private readonly isMuted: () => boolean,
    private readonly nowMs: () => number = () => performance.now(),
  ) {}

  public prime(): void {
    if (
      this.disposed ||
      this.blocked ||
      this.isMuted()
    ) {
      return;
    }

    const context = this.getContext();
    if (!context) return;

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  }

  public setBlocked(blocked: boolean): void {
    if (this.disposed || blocked === this.blocked) {
      return;
    }

    this.blocked = blocked;
    const context = this.context;

    if (blocked) {
      if (context?.state === 'running') {
        void context.suspend().catch(() => undefined);
      }
      return;
    }

    if (
      context?.state === 'suspended' &&
      !this.isMuted()
    ) {
      void context.resume().catch(() => undefined);
    }
  }

  public bounce(): void {
    const now = this.nowMs();
    if (now - this.lastBounceAtMs < 12) return;
    this.lastBounceAtMs = now;
    this.play('bounce', this.bounceBudget);
  }

  public pocket(
    multiplier: number,
    jackpotEdge: boolean,
  ): void {
    const kind = classifyPlinkoPocketAudio(
      multiplier,
      jackpotEdge,
    );
    const normalizedBoost =
      kind === 'pocket'
        ? Math.min(
            1.35,
            1 + Math.max(0, multiplier - 1) * 0.025,
          )
        : 1;

    this.play(
      kind,
      this.accentBudget,
      normalizedBoost,
    );
  }

  public payoutCount(): void {
    if (
      this.disposed ||
      this.blocked ||
      this.isMuted()
    ) return;

    for (
      let index = 0;
      index < PLINKO_PAYOUT_COUNT_TICKS;
      index += 1
    ) {
      const progress =
        PLINKO_PAYOUT_COUNT_TICKS <= 1
          ? 1
          : index /
            (PLINKO_PAYOUT_COUNT_TICKS - 1);
      const pitch = getAccumulationPitchMultiplier(
        progress,
        PLINKO_PAYOUT_PITCH_PROFILE,
        unitFromCounter(
          this.cueCounter + index + 1,
        ),
      );

      this.play(
        'payoutTick',
        this.transferBudget,
        pitch,
        index * PLINKO_PAYOUT_TICK_INTERVAL_MS,
      );
    }
  }

  public result(
    losing: boolean,
    bigJackpot: boolean,
  ): void {
    this.play(
      !losing && bigJackpot
        ? 'bigJackpot'
        : losing
          ? 'bad'
          : 'good',
      this.accentBudget,
    );
  }

  public insuranceActivation(): void {
    this.play('insurance', this.accentBudget);
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

    try {
      this.masterGain?.disconnect();
    } catch {
      // already disconnected
    }
    try {
      this.compressor?.disconnect();
    } catch {
      // already disconnected
    }
    this.masterGain = null;
    this.compressor = null;

    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    if (
      this.disposed ||
      typeof AudioContext === 'undefined'
    ) {
      return null;
    }

    try {
      this.context = new AudioContext();

      const masterGain =
        this.context.createGain();
      masterGain.gain.value =
        PLINKO_AUDIO_MASTER_GAIN;

      const compressor =
        this.context.createDynamicsCompressor();
      compressor.threshold.value =
        PLINKO_AUDIO_COMPRESSOR.thresholdDb;
      compressor.knee.value =
        PLINKO_AUDIO_COMPRESSOR.kneeDb;
      compressor.ratio.value =
        PLINKO_AUDIO_COMPRESSOR.ratio;
      compressor.attack.value =
        PLINKO_AUDIO_COMPRESSOR.attackSeconds;
      compressor.release.value =
        PLINKO_AUDIO_COMPRESSOR.releaseSeconds;

      masterGain.connect(compressor);
      compressor.connect(
        this.context.destination,
      );

      this.masterGain = masterGain;
      this.compressor = compressor;

      return this.context;
    } catch {
      this.context = null;
      this.masterGain = null;
      this.compressor = null;
      return null;
    }
  }

  private playSpecial(kind: SpecialPinAudioKind): void {
    if (
      this.disposed ||
      this.blocked ||
      this.isMuted()
    ) return;
    if (
      !this.specialPolicy.trySchedule(
        kind,
        this.nowMs(),
      )
    ) {
      return;
    }

    this.play(kind, this.specialBudget);
  }

  private play(
    kind: ToneKind,
    budget: VoiceBudget,
    frequencyMultiplier = 1,
    delayMs = 0,
  ): void {
    if (
      this.disposed ||
      this.blocked ||
      this.isMuted() ||
      !budget.tryAcquire()
    ) {
      return;
    }

    const context = this.getContext();
    if (!context || context.state !== 'running') {
      budget.release();
      return;
    }

    const spec = TONES[kind];
    const now =
      context.currentTime +
      Math.max(0, delayMs) / 1000;
    const durationSeconds =
      spec.durationMs / 1000;
    const pitch = applyBoundedPitchVariation(
      spec.variation,
      unitFromCounter(++this.cueCounter),
    );

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = spec.waveform;
    oscillator.frequency.setValueAtTime(
      spec.frequency *
        frequencyMultiplier *
        pitch,
      now,
    );
    if (spec.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        spec.endFrequency *
          frequencyMultiplier *
          pitch,
        now + durationSeconds,
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(
      spec.gain,
      now + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.012, durationSeconds),
    );

    oscillator.connect(gain);
    gain.connect(
      this.masterGain ?? context.destination,
    );

    const cleanup = (): void => {
      oscillator.removeEventListener(
        'ended',
        cleanup,
      );
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
    oscillator.stop(
      now + durationSeconds + 0.02,
    );
  }
}
