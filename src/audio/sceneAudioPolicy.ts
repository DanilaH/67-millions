export type SceneAmbienceKind =
  | 'city'
  | 'casino'
  | 'work';

export type PersistentSceneAudioState =
  | 'casino'
  | 'work'
  | 'barry';

export type SceneAudioCue =
  | 'barry'
  | 'lowNeeds'
  | 'sleep'
  | 'wake'
  | 'dumpster'
  | 'cashSpend'
  | 'cashGain'
  | 'casinoEnter'
  | 'dishesScrub'
  | 'dishesSuccess'
  | 'dishesFail'
  | 'trashGrab'
  | 'trashBin'
  | 'trashFail'
  | 'courierDraw'
  | 'courierSuccess'
  | 'courierFail';

export interface SceneAudioToneSpec {
  frequency: number;
  endFrequency?: number;
  durationMs: number;
  gain: number;
  waveform: OscillatorType;
  variation: number;
  minIntervalMs: number;
}

export const resolveSceneAudioPersistentState = (
  ambience: SceneAmbienceKind,
  barryPending: boolean,
): PersistentSceneAudioState | null => {
  if (barryPending) return 'barry';
  return ambience === 'city' ? null : ambience;
};

export const SCENE_AUDIO_TONES: Readonly<
  Record<SceneAudioCue, SceneAudioToneSpec>
> = {
  barry: { frequency:118,endFrequency:72,durationMs:240,gain:0.07,waveform:'sawtooth',variation:0.018,minIntervalMs:1000 },
  lowNeeds: { frequency:270,endFrequency:180,durationMs:150,gain:0.038,waveform:'triangle',variation:0.03,minIntervalMs:1200 },
  sleep: { frequency:340,endFrequency:180,durationMs:260,gain:0.04,waveform:'sine',variation:0.018,minIntervalMs:300 },
  wake: { frequency:260,endFrequency:620,durationMs:180,gain:0.045,waveform:'sine',variation:0.018,minIntervalMs:300 },
  dumpster: { frequency:105,endFrequency:72,durationMs:130,gain:0.038,waveform:'sawtooth',variation:0.08,minIntervalMs:250 },
  cashSpend: { frequency:430,endFrequency:290,durationMs:84,gain:0.032,waveform:'square',variation:0.035,minIntervalMs:70 },
  cashGain: { frequency:520,endFrequency:900,durationMs:125,gain:0.038,waveform:'sine',variation:0.035,minIntervalMs:70 },
  casinoEnter: { frequency:58,endFrequency:82,durationMs:520,gain:0.024,waveform:'triangle',variation:0.018,minIntervalMs:700 },
  dishesScrub: { frequency:185,durationMs:30,gain:0.018,waveform:'triangle',variation:0.2,minIntervalMs:42 },
  dishesSuccess: { frequency:560,endFrequency:820,durationMs:150,gain:0.048,waveform:'triangle',variation:0.025,minIntervalMs:300 },
  dishesFail: { frequency:170,endFrequency:105,durationMs:170,gain:0.046,waveform:'sawtooth',variation:0.02,minIntervalMs:300 },
  trashGrab: { frequency:125,endFrequency:155,durationMs:55,gain:0.028,waveform:'triangle',variation:0.1,minIntervalMs:85 },
  trashBin: { frequency:95,endFrequency:62,durationMs:100,gain:0.05,waveform:'square',variation:0.06,minIntervalMs:90 },
  trashFail: { frequency:150,endFrequency:90,durationMs:160,gain:0.045,waveform:'sawtooth',variation:0.025,minIntervalMs:300 },
  courierDraw: { frequency:310,durationMs:26,gain:0.015,waveform:'triangle',variation:0.18,minIntervalMs:48 },
  courierSuccess: { frequency:610,endFrequency:940,durationMs:155,gain:0.05,waveform:'triangle',variation:0.025,minIntervalMs:300 },
  courierFail: { frequency:155,endFrequency:88,durationMs:175,gain:0.048,waveform:'sawtooth',variation:0.025,minIntervalMs:300 },
};

export const SCENE_AUDIO_VOICE_LIMIT = 6;
export const SCENE_AUDIO_MASTER_GAIN = 0.72;
export const SCENE_AUDIO_MAX_TRANSIENT_GAIN = Math.max(
  ...Object.values(SCENE_AUDIO_TONES).map((tone) => tone.gain),
);
export const SCENE_AUDIO_WORST_CASE_POST_MASTER_GAIN =
  SCENE_AUDIO_VOICE_LIMIT *
  SCENE_AUDIO_MAX_TRANSIENT_GAIN *
  SCENE_AUDIO_MASTER_GAIN;

export const SCENE_AUDIO_AMBIENCE_GAIN: Readonly<
  Record<SceneAmbienceKind, number>
> = {
  city: 0.04,
  casino: 0.045,
  work: 0.032,
};

export const SCENE_AUDIO_COMPRESSOR = {
  thresholdDb: -8,
  kneeDb: 10,
  ratio: 4,
  attackSeconds: 0.004,
  releaseSeconds: 0.18,
} as const;

export const SCENE_AUDIO_BARRY_DUCK = {
  multiplier: 0.2,
  attackMs: 35,
  holdMs: 120,
  releaseMs: 260,
} as const;

export const SCENE_AUDIO_LOW_NEEDS_DUCK = {
  multiplier: 0.55,
  attackMs: 30,
  holdMs: 80,
  releaseMs: 220,
} as const;

export interface SceneNeedsSnapshot {
  health: number;
  satiety: number;
  energy: number;
  happiness: number;
}

export const deriveLowNeedKeys = (
  needs: SceneNeedsSnapshot,
  lowThreshold: number,
): Array<keyof SceneNeedsSnapshot> =>
  (
    Object.entries(needs) as Array<
      [keyof SceneNeedsSnapshot, number]
    >
  )
    .filter(([, value]) => value <= lowThreshold)
    .map(([key]) => key);

