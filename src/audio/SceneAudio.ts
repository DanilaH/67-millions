import Phaser from 'phaser';
import {
  PresentationAudioMixer,
  applyBoundedPitchVariation,
  createManagedAudioLayer,
  type ManagedAudioLayer,
  type PersistentAudioLayerSpec,
} from '@danilah/mini-games-kit/audio';

import { VoiceBudget } from './VoiceBudget';
import { GAME_AUDIO_BLOCKED_EVENT } from './audioLifecycle';

import {
  SCENE_AUDIO_AMBIENCE_GAIN,
  SCENE_AUDIO_BARRY_DUCK,
  SCENE_AUDIO_COMPRESSOR,
  SCENE_AUDIO_LOW_NEEDS_DUCK,
  SCENE_AUDIO_TONES,
  SCENE_AUDIO_VOICE_LIMIT,
  deriveLowNeedKeys,
  getSceneAudioMasterGain,
  resolveSceneAudioPersistentState,
  type PersistentSceneAudioState,
  type SceneAmbienceKind,
  type SceneAudioCue,
  type SceneNeedsSnapshot,
} from './sceneAudioPolicy';

const unitFromCounter = (
  counter: number,
): number => {
  const golden = 0.6180339887498949;
  return (counter * golden) % 1;
};

const createNoiseBuffer = (
  context: AudioContext,
  seed: number,
): AudioBuffer => {
  const length = Math.max(
    1,
    Math.round(context.sampleRate),
  );
  const buffer = context.createBuffer(
    1,
    length,
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);
  let state = seed >>> 0;

  for (
    let index = 0;
    index < channel.length;
    index += 1
  ) {
    state =
      (Math.imul(state, 1_664_525) +
        1_013_904_223) >>>
      0;
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
          waveform:
            'triangle' as OscillatorType,
          seed: 0xca51_0001,
        }
      : kind === 'work'
        ? {
            humHz: 64,
            noiseFilterHz: 720,
            noiseGain: 0.105,
            humGain: 0.048,
            waveform:
              'sine' as OscillatorType,
            seed: 0x70a0_0001,
          }
        : {
            humHz: 47,
            noiseFilterHz: 520,
            noiseGain: 0.11,
            humGain: 0.045,
            waveform:
              'sine' as OscillatorType,
            seed: 0xc171_0001,
          };

  const noise = context.createBufferSource();
  noise.buffer = createNoiseBuffer(
    context,
    profile.seed,
  );
  noise.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value =
    profile.noiseFilterHz;

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

class SharedSceneAudioRuntime {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor:
    | DynamicsCompressorNode
    | null = null;
  private mixer:
    | PresentationAudioMixer<PersistentSceneAudioState>
    | null = null;

  private readonly transientBudget =
    new VoiceBudget(SCENE_AUDIO_VOICE_LIMIT);
  private readonly lastCueAtMs =
    new Map<SceneAudioCue, number>();
  private readonly nowMs = (): number =>
    performance.now();

  private cueCounter = 0;
  private primed = false;
  private nextOwnerId = 1;
  private activeOwnerId = 0;
  private ambience: SceneAmbienceKind = 'city';
  private blocked = false;
  private muted = false;
  private barryPending = false;
  private lowNeeds =
    new Set<keyof SceneNeedsSnapshot>();
  private disposed = false;

  public diagnostics(): Record<string, number | string> {
    return { context: this.context?.state ?? 'unprimed', transientVoices: this.transientBudget.getActiveCount(), activeOwner: this.activeOwnerId === 0 ? 0 : 1 };
  }

  public attach(
    ambience: SceneAmbienceKind,
  ): number {
    if (this.disposed) return 0;

    const ownerId = this.nextOwnerId++;
    this.activeOwnerId = ownerId;
    this.ambience = ambience;
    this.syncPersistentState();

    return ownerId;
  }

  public detach(ownerId: number): void {
    if (
      this.disposed ||
      ownerId === 0 ||
      ownerId !== this.activeOwnerId
    ) {
      return;
    }

    this.activeOwnerId = 0;
    this.ambience = 'city';
    this.barryPending = false;
    this.syncPersistentState();
  }

  public setBlocked(blocked: boolean): void {
    if (
      this.disposed ||
      blocked === this.blocked
    ) {
      return;
    }

    this.blocked = blocked;
    this.mixer?.setBlocked(blocked);
    this.syncMasterGain();

    const context = this.context;
    if (blocked) {
      if (context?.state === 'running') {
        void context
          .suspend()
          .catch(() => undefined);
      }
      return;
    }

    if (
      context?.state === 'suspended' &&
      !this.muted
    ) {
      void context
        .resume()
        .catch(() => undefined);
    }
  }

  public setMuted(muted: boolean): void {
    if (
      this.disposed ||
      muted === this.muted
    ) {
      return;
    }

    this.muted = muted;
    this.mixer?.setMuted(muted);
    this.syncMasterGain();
  }

  public prime(): void {
    if (
      this.disposed ||
      this.blocked ||
      this.muted
    ) {
      return;
    }

    this.primed = true;
    this.ensureGraph();
    this.mixer?.setBlocked(this.blocked);
    this.mixer?.setMuted(this.muted);
    this.syncPersistentState();
    this.mixer?.prime();

    if (
      this.context?.state === 'suspended'
    ) {
      void this.context
        .resume()
        .catch(() => undefined);
    }
  }

  public play(cue: SceneAudioCue): void {
    if (
      this.disposed ||
      !this.primed ||
      this.blocked ||
      this.muted
    ) {
      return;
    }

    this.ensureGraph();

    const context = this.context;
    const masterGain = this.masterGain;
    if (!context || !masterGain) return;

    if (context.state !== 'running') {
      if (context.state === 'suspended') {
        void context
          .resume()
          .then(() => {
            if (
              !this.disposed &&
              !this.blocked &&
              !this.muted
            ) {
              this.play(cue);
            }
          })
          .catch(() => undefined);
      }
      return;
    }

    const spec = SCENE_AUDIO_TONES[cue];
    const nowMs = this.nowMs();
    const last =
      this.lastCueAtMs.get(cue) ?? -Infinity;

    if (
      nowMs - last < spec.minIntervalMs ||
      !this.transientBudget.tryAcquire()
    ) {
      return;
    }

    this.lastCueAtMs.set(cue, nowMs);

    const now = context.currentTime;
    const duration =
      spec.durationMs / 1000;
    const pitch =
      applyBoundedPitchVariation(
        spec.variation,
        unitFromCounter(++this.cueCounter),
      );

    const oscillator =
      context.createOscillator();
    const gain = context.createGain();

    oscillator.type = spec.waveform;
    oscillator.frequency.setValueAtTime(
      spec.frequency * pitch,
      now,
    );

    if (
      spec.endFrequency !== undefined
    ) {
      oscillator.frequency
        .exponentialRampToValueAtTime(
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
    gain.connect(masterGain);

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
    oscillator.stop(
      now + duration + 0.02,
    );
  }

  public syncBarry(pending: boolean): void {
    if (
      this.disposed ||
      pending === this.barryPending
    ) {
      return;
    }

    this.barryPending = pending;
    this.syncPersistentState();

    if (pending) {
      this.mixer?.duckBase(
        SCENE_AUDIO_BARRY_DUCK,
      );
      this.play('barry');
    }
  }

  public syncNeeds(
    needs: SceneNeedsSnapshot,
    lowThreshold: number,
  ): void {
    if (this.disposed) return;

    const next = new Set(
      deriveLowNeedKeys(
        needs,
        lowThreshold,
      ),
    );

    const newlyLow = [...next].some(
      (key) => !this.lowNeeds.has(key),
    );

    this.lowNeeds = next;

    if (newlyLow) {
      this.mixer?.duckBase(
        SCENE_AUDIO_LOW_NEEDS_DUCK,
      );
      this.play('lowNeeds');
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.mixer?.dispose();
    this.mixer = null;

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

    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.compressor = null;

    if (
      context &&
      context.state !== 'closed'
    ) {
      void context
        .close()
        .catch(() => undefined);
    }
  }

  private ensureGraph(): void {
    if (
      this.disposed ||
      this.context !== null
    ) {
      return;
    }

    try {
      const context = new AudioContext();
      const masterGain =
        context.createGain();
      masterGain.gain.value =
        getSceneAudioMasterGain(
          this.blocked,
          this.muted,
        );

      const compressor =
        context.createDynamicsCompressor();
      compressor.threshold.value =
        SCENE_AUDIO_COMPRESSOR.thresholdDb;
      compressor.knee.value =
        SCENE_AUDIO_COMPRESSOR.kneeDb;
      compressor.ratio.value =
        SCENE_AUDIO_COMPRESSOR.ratio;
      compressor.attack.value =
        SCENE_AUDIO_COMPRESSOR.attackSeconds;
      compressor.release.value =
        SCENE_AUDIO_COMPRESSOR.releaseSeconds;

      masterGain.connect(compressor);
      compressor.connect(
        context.destination,
      );

      const mixer =
        new PresentationAudioMixer<PersistentSceneAudioState>({
          context,
          destination: masterGain,
          base: {
            gain:
              SCENE_AUDIO_AMBIENCE_GAIN.city,
            fadeInMs: 420,
            create: (
              audioContext,
              output,
            ) =>
              createAmbienceLayer(
                audioContext,
                output,
                'city',
              ),
          },
          resolvePersistent: (
            state,
          ): PersistentAudioLayerSpec<PersistentSceneAudioState> => {
            if (state === 'barry') {
              return {
                gain: 0.16,
                baseMixMultiplier: 0.3,
                fadeInMs: 70,
                fadeOutMs: 180,
                create: (
                  audioContext,
                  output,
                ) =>
                  createBarryPressureLayer(
                    audioContext,
                    output,
                  ),
              };
            }

            const kind:
              | 'casino'
              | 'work' = state;

            return {
              gain:
                SCENE_AUDIO_AMBIENCE_GAIN[
                  kind
                ],
              baseMixMultiplier:
                kind === 'casino'
                  ? 0.34
                  : 0.48,
              fadeInMs: 260,
              fadeOutMs: 220,
              create: (
                audioContext,
                output,
              ) =>
                createAmbienceLayer(
                  audioContext,
                  output,
                  kind,
                ),
            };
          },
        });

      this.context = context;
      this.masterGain = masterGain;
      this.compressor = compressor;
      this.mixer = mixer;

      mixer.setBlocked(this.blocked);
      mixer.setMuted(this.muted);
      this.syncPersistentState();
    } catch {
      this.context = null;
      this.masterGain = null;
      this.compressor = null;
      this.mixer = null;
    }
  }

  private syncMasterGain(): void {
    if (!this.masterGain) return;

    this.masterGain.gain.value =
      getSceneAudioMasterGain(
        this.blocked,
        this.muted,
      );
  }

  private syncPersistentState(): void {
    const mixer = this.mixer;
    if (!mixer) return;

    const state =
      resolveSceneAudioPersistentState(
        this.ambience,
        this.barryPending,
      );

    if (state === null) {
      mixer.clearPersistentState();
      return;
    }

    mixer.setPersistentState(state);
  }
}

let sharedRuntime:
  | SharedSceneAudioRuntime
  | null = null;

const getSharedRuntime =
  (): SharedSceneAudioRuntime => {
    sharedRuntime ??=
      new SharedSceneAudioRuntime();
    return sharedRuntime;
  };

export const disposeSceneAudioRuntime =
  (): void => {
    sharedRuntime?.dispose();
    sharedRuntime = null;
  };

export class SceneAudio {
  private readonly runtime =
    getSharedRuntime();
  private readonly ownerId: number;
  private disposed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    ambience: SceneAmbienceKind,
  ) {
    this.ownerId =
      this.runtime.attach(ambience);
    this.runtime.setMuted(
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
  }

  public diagnostics(): Record<string, number | string> { return this.runtime.diagnostics(); }

  public prime(): void {
    if (this.disposed) return;
    this.runtime.setMuted(
      this.scene.game.sound.mute,
    );
    this.runtime.prime();
  }

  public play(cue: SceneAudioCue): void {
    if (this.disposed) return;
    this.runtime.setMuted(
      this.scene.game.sound.mute,
    );
    this.runtime.play(cue);
  }

  public syncBarry(pending: boolean): void {
    if (this.disposed) return;
    this.runtime.syncBarry(pending);
  }

  public syncNeeds(
    needs: SceneNeedsSnapshot,
    lowThreshold: number,
  ): void {
    if (this.disposed) return;
    this.runtime.syncNeeds(
      needs,
      lowThreshold,
    );
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
    this.runtime.detach(this.ownerId);
  }

  private readonly handlePrime =
    (): void => {
      this.prime();
    };

  private readonly handleBlocked = (
    blocked: boolean,
  ): void => {
    this.runtime.setMuted(
      this.scene.game.sound.mute,
    );
    this.runtime.setBlocked(blocked);
  };
}
