import Phaser from 'phaser';
import {
  PresentationAudioMixer,
  applyBoundedPitchVariation,
  createManagedAudioLayer,
  type ManagedAudioLayer,
} from '@danilah/mini-games-kit/audio';

import { VoiceBudget } from './VoiceBudget';
import { GAME_AUDIO_BLOCKED_EVENT } from './audioLifecycle';

export type SceneAmbienceKind =
  | 'city'
  | 'casino'
  | 'work';

export type SceneAudioCue =
  | 'barry'
  | 'lowNeeds'
  | 'sleep'
  | 'wake'
  | 'dumpster'
  | 'cashSpend'
  | 'cashGain'
  | 'dishesScrub'
  | 'dishesSuccess'
  | 'dishesFail'
  | 'trashGrab'
  | 'trashBin'
  | 'trashFail'
  | 'courierDraw'
  | 'courierSuccess'
  | 'courierFail';

interface ToneSpec {
  frequency: number;
  endFrequency?: number;
  durationMs: number;
  gain: number;
  waveform: OscillatorType;
  variation: number;
  minIntervalMs: number;
}

const TONES: Record<SceneAudioCue, ToneSpec> = {
  barry: {
    frequency: 118,
    endFrequency: 72,
    durationMs: 240,
    gain: 0.07,
    waveform: 'sawtooth',
    variation: 0.018,
    minIntervalMs: 1_000,
  },
  lowNeeds: {
    frequency: 270,
    endFrequency: 180,
    durationMs: 150,
    gain: 0.038,
    waveform: 'triangle',
    variation: 0.03,
    minIntervalMs: 1_200,
  },
  sleep: {
    frequency: 340,
    endFrequency: 180,
    durationMs: 260,
    gain: 0.04,
    waveform: 'sine',
    variation: 0.018,
    minIntervalMs: 300,
  },
  wake: {
    frequency: 260,
    endFrequency: 620,
    durationMs: 180,
    gain: 0.045,
    waveform: 'sine',
    variation: 0.018,
    minIntervalMs: 300,
  },
  dumpster: {
    frequency: 105,
    endFrequency: 72,
    durationMs: 130,
    gain: 0.038,
    waveform: 'sawtooth',
    variation: 0.08,
    minIntervalMs: 250,
  },
  cashSpend: {
    frequency: 430,
    endFrequency: 290,
    durationMs: 84,
    gain: 0.032,
    waveform: 'square',
    variation: 0.035,
    minIntervalMs: 70,
  },
  cashGain: {
    frequency: 520,
    endFrequency: 900,
    durationMs: 125,
    gain: 0.038,
    waveform: 'sine',
    variation: 0.035,
    minIntervalMs: 70,
  },
  dishesScrub: {
    frequency: 185,
    durationMs: 30,
    gain: 0.018,
    waveform: 'triangle',
    variation: 0.2,
    minIntervalMs: 42,
  },
  dishesSuccess: {
    frequency: 560,
    endFrequency: 820,
    durationMs: 150,
    gain: 0.048,
    waveform: 'triangle',
    variation: 0.025,
    minIntervalMs: 300,
  },
  dishesFail: {
    frequency: 170,
    endFrequency: 105,
    durationMs: 170,
    gain: 0.046,
    waveform: 'sawtooth',
    variation: 0.02,
    minIntervalMs: 300,
  },
  trashGrab: {
    frequency: 125,
    endFrequency: 155,
    durationMs: 55,
    gain: 0.028,
    waveform: 'triangle',
    variation: 0.1,
    minIntervalMs: 85,
  },
  trashBin: {
    frequency: 95,
    endFrequency: 62,
    durationMs: 100,
    gain: 0.05,
    waveform: 'square',
    variation: 0.06,
    minIntervalMs: 90,
  },
  trashFail: {
    frequency: 150,
    endFrequency: 90,
    durationMs: 160,
    gain: 0.045,
    waveform: 'sawtooth',
    variation: 0.025,
    minIntervalMs: 300,
  },
  courierDraw: {
    frequency: 310,
    durationMs: 26,
    gain: 0.015,
    waveform: 'triangle',
    variation: 0.18,
    minIntervalMs: 48,
  },
  courierSuccess: {
    frequency: 610,
    endFrequency: 940,
    durationMs: 155,
    gain: 0.05,
    waveform: 'triangle',
    variation: 0.025,
    minIntervalMs: 300,
  },
  courierFail: {
    frequency: 155,
    endFrequency: 88,
    durationMs: 175,
    gain: 0.048,
    waveform: 'sawtooth',
    variation: 0.025,
    minIntervalMs: 300,
  },
};

export const SCENE_AUDIO_VOICE_LIMIT = 6;
export const SCENE_AUDIO_MASTER_GAIN = 0.72;
export const SCENE_AUDIO_MAX_TRANSIENT_GAIN =
  Math.max(...Object.values(TONES).map((tone) => tone.gain));
export const SCENE_AUDIO_WORST_CASE_POST_MASTER_GAIN =
  SCENE_AUDIO_VOICE_LIMIT *
  SCENE_AUDIO_MAX_TRANSIENT_GAIN *
  SCENE_AUDIO_MASTER_GAIN;

const AMBIENCE_GAIN: Record<SceneAmbienceKind, number> = {
  city: 0.04,
  casino: 0.045,
  work: 0.032,
};

const unitFromCounter = (counter: number): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

const createNoiseBuffer = (
  context: AudioContext,
  seed: number,
): AudioBuffer => {
  const length = Math.max(1, Math.round(context.sampleRate));
  const buffer = context.createBuffer(
    1,
    length,
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);
  let state = seed >>> 0;

  for (let index = 0; index < channel.length; index += 1) {
    state =
      (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    channel[index] =
      ((state / 0xffff_ffff) * 2 - 1) * 0.5;
  }

  return buffer;
};

const createAmbienceLayer = (
  context: AudioContext,
  output: AudioNode,
  kind: SceneAmbienceKind,
): ManagedAudioLayer => {
  const profile =
    kind === 'casino'
      ? {
          humHz: 58,
          noiseFilterHz: 1_050,
          noiseGain: 0.12,
          humGain: 0.055,
          waveform: 'triangle' as OscillatorType,
          seed: 0xca51_0001,
        }
      : kind === 'work'
        ? {
            humHz: 64,
            noiseFilterHz: 720,
            noiseGain: 0.105,
            humGain: 0.048,
            waveform: 'sine' as OscillatorType,
            seed: 0x70a0_0001,
          }
        : {
            humHz: 47,
            noiseFilterHz: 520,
            noiseGain: 0.11,
            humGain: 0.045,
            waveform: 'sine' as OscillatorType,
            seed: 0xc171_0001,
          };

  const noise = context.createBufferSource();
  noise.buffer = createNoiseBuffer(context, profile.seed);
  noise.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = profile.noiseFilterHz;

  const noiseGain = context.createGain();
  noiseGain.gain.value = profile.noiseGain;

  const hum = context.createOscillator();
  hum.type = profile.waveform;
  hum.frequency.value = profile.humHz;

  const humGain = context.createGain();
  humGain.gain.value = profile.humGain;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(output);

  hum.connect(humGain);
  humGain.connect(output);

  noise.start();
  hum.start();

  return createManagedAudioLayer(
    [noise, hum],
    [filter, noiseGain, humGain],
  );
};

const createBarryPressureLayer = (
  context: AudioContext,
  output: AudioNode,
): ManagedAudioLayer => {
  const hum = context.createOscillator();
  hum.type = 'triangle';
  hum.frequency.value = 74;

  const gain = context.createGain();
  gain.gain.value = 0.16;

  hum.connect(gain);
  gain.connect(output);
  hum.start();

  return createManagedAudioLayer(
    [hum],
    [gain],
  );
};

export interface SceneNeedsSnapshot {
  health: number;
  satiety: number;
  energy: number;
  happiness: number;
}

export class SceneAudio {
  private readonly context: AudioContext | null;
  private readonly masterGain: GainNode | null;
  private readonly compressor: DynamicsCompressorNode | null;
  private readonly mixer: PresentationAudioMixer<'barry'> | null;
  private readonly transientBudget =
    new VoiceBudget(SCENE_AUDIO_VOICE_LIMIT);
  private readonly lastCueAtMs =
    new Map<SceneAudioCue, number>();

  private cueCounter = 0;
  private disposed = false;
  private barryPending = false;
  private lowNeeds = new Set<keyof SceneNeedsSnapshot>();

  public constructor(
    private readonly scene: Phaser.Scene,
    ambience: SceneAmbienceKind,
    private readonly nowMs: () => number = () => performance.now(),
  ) {
    let context: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let compressor: DynamicsCompressorNode | null = null;

    try {
      context = new AudioContext();
      masterGain = context.createGain();
      masterGain.gain.value = SCENE_AUDIO_MASTER_GAIN;

      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -8;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      masterGain.connect(compressor);
      compressor.connect(context.destination);
    } catch {
      context = null;
      masterGain = null;
      compressor = null;
    }

    this.context = context;
    this.masterGain = masterGain;
    this.compressor = compressor;

    this.mixer =
      context && masterGain
        ? new PresentationAudioMixer<'barry'>({
            context,
            destination: masterGain,
            base: {
              gain: AMBIENCE_GAIN[ambience],
              fadeInMs: 420,
              create: (audioContext, output) =>
                createAmbienceLayer(
                  audioContext,
                  output,
                  ambience,
                ),
            },
            resolvePersistent: () => ({
              gain: 0.16,
              baseMixMultiplier: 0.42,
              fadeInMs: 90,
              fadeOutMs: 180,
              create: (audioContext, output) =>
                createBarryPressureLayer(
                  audioContext,
                  output,
                ),
            }),
          })
        : null;

    this.mixer?.setBlocked(
      this.scene.game.sound.mute,
    );

    this.scene.input.on(
      'pointerdown',
      this.handlePrime,
    );
    this.scene.game.events.on(
      GAME_AUDIO_BLOCKED_EVENT,
      this.handleBlocked,
    );

    this.mixer?.prime();
  }

  public prime(): void {
    if (this.disposed) return;
    this.mixer?.prime();

    if (
      this.context?.state === 'suspended' &&
      !this.scene.game.sound.mute
    ) {
      void this.context
        .resume()
        .catch(() => undefined);
    }
  }

  public play(cue: SceneAudioCue): void {
    if (
      this.disposed ||
      this.scene.game.sound.mute ||
      !this.context ||
      !this.masterGain
    ) {
      return;
    }

    const spec = TONES[cue];
    const nowMs = this.nowMs();
    const last =
      this.lastCueAtMs.get(cue) ?? -Infinity;
    if (nowMs - last < spec.minIntervalMs) {
      return;
    }

    if (!this.transientBudget.tryAcquire()) {
      return;
    }

    if (this.context.state !== 'running') {
      this.transientBudget.release();
      this.prime();
      return;
    }

    this.lastCueAtMs.set(cue, nowMs);

    const now = this.context.currentTime;
    const duration = spec.durationMs / 1000;
    const pitch = applyBoundedPitchVariation(
      spec.variation,
      unitFromCounter(++this.cueCounter),
    );

    const oscillator =
      this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = spec.waveform;
    oscillator.frequency.setValueAtTime(
      spec.frequency * pitch,
      now,
    );

    if (spec.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        spec.endFrequency * pitch,
        now + duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(
      spec.gain,
      now + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.012, duration),
    );

    oscillator.connect(gain);
    gain.connect(this.masterGain);

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
      this.transientBudget.release();
    };

    oscillator.addEventListener(
      'ended',
      cleanup,
    );
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  public syncBarry(pending: boolean): void {
    if (this.disposed || pending === this.barryPending) {
      return;
    }

    this.barryPending = pending;

    if (pending) {
      this.mixer?.setPersistentState('barry');
      this.mixer?.duckBase({
        multiplier: 0.2,
        attackMs: 35,
        holdMs: 120,
        releaseMs: 260,
      });
      this.play('barry');
    } else {
      this.mixer?.clearPersistentState();
    }
  }

  public syncNeeds(
    needs: SceneNeedsSnapshot,
    lowThreshold: number,
  ): void {
    if (this.disposed) return;

    const next = new Set<keyof SceneNeedsSnapshot>();
    const entries = Object.entries(needs) as Array<
      [keyof SceneNeedsSnapshot, number]
    >;

    for (const [key, value] of entries) {
      if (value <= lowThreshold) {
        next.add(key);
      }
    }

    const newlyLow = [...next].some(
      (key) => !this.lowNeeds.has(key),
    );

    this.lowNeeds = next;

    if (newlyLow) {
      this.mixer?.duckBase({
        multiplier: 0.55,
        attackMs: 30,
        holdMs: 80,
        releaseMs: 220,
      });
      this.play('lowNeeds');
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.scene.input.off(
      'pointerdown',
      this.handlePrime,
    );
    this.scene.game.events.off(
      GAME_AUDIO_BLOCKED_EVENT,
      this.handleBlocked,
    );

    this.mixer?.dispose();

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

    if (
      this.context &&
      this.context.state !== 'closed'
    ) {
      void this.context
        .close()
        .catch(() => undefined);
    }
  }

  private readonly handlePrime = (): void => {
    this.prime();
  };

  private readonly handleBlocked = (
    blocked: boolean,
  ): void => {
    this.mixer?.setBlocked(blocked);
  };
}
