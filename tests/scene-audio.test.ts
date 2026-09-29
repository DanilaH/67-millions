import { describe, expect, it } from 'vitest';

import {
  SCENE_AUDIO_AMBIENCE_GAIN,
  SCENE_AUDIO_BARRY_DUCK,
  SCENE_AUDIO_COMPRESSOR,
  SCENE_AUDIO_LOW_NEEDS_DUCK,
  SCENE_AUDIO_MASTER_GAIN,
  SCENE_AUDIO_TONES,
  SCENE_AUDIO_VOICE_LIMIT,
  SCENE_AUDIO_WORST_CASE_POST_MASTER_GAIN,
  deriveLowNeedKeys,
  resolveSceneAudioPersistentState,
  shouldBlockSceneAudio,
} from '../src/audio/sceneAudioPolicy';

describe('T065 scene audio policy', () => {
  it('keeps worst-case transient headroom below full scale', () => {
    expect(SCENE_AUDIO_VOICE_LIMIT).toBe(6);
    expect(SCENE_AUDIO_MASTER_GAIN).toBeLessThan(1);
    expect(
      SCENE_AUDIO_WORST_CASE_POST_MASTER_GAIN,
    ).toBeLessThan(1);
    expect(
      SCENE_AUDIO_COMPRESSOR.thresholdDb,
    ).toBeLessThan(0);
    expect(
      SCENE_AUDIO_COMPRESSOR.ratio,
    ).toBeGreaterThan(1);
  });

  it('defines distinct world/work/casino ambience buses', () => {
    expect(
      SCENE_AUDIO_AMBIENCE_GAIN.city,
    ).toBeGreaterThan(0);
    expect(
      SCENE_AUDIO_AMBIENCE_GAIN.work,
    ).toBeGreaterThan(0);
    expect(
      SCENE_AUDIO_AMBIENCE_GAIN.casino,
    ).toBeGreaterThan(0);

    expect(
      new Set(
        Object.values(
          SCENE_AUDIO_AMBIENCE_GAIN,
        ),
      ).size,
    ).toBe(3);
  });

  it('gives Barry priority over the current ambience layer', () => {
    expect(
      resolveSceneAudioPersistentState(
        'city',
        false,
      ),
    ).toBeNull();
    expect(
      resolveSceneAudioPersistentState(
        'work',
        false,
      ),
    ).toBe('work');
    expect(
      resolveSceneAudioPersistentState(
        'casino',
        false,
      ),
    ).toBe('casino');
    expect(
      resolveSceneAudioPersistentState(
        'city',
        true,
      ),
    ).toBe('barry');
    expect(
      resolveSceneAudioPersistentState(
        'work',
        true,
      ),
    ).toBe('barry');
  });

  it('ducks ambience harder for Barry than for a low-needs warning', () => {
    expect(
      SCENE_AUDIO_BARRY_DUCK.multiplier,
    ).toBeLessThan(
      SCENE_AUDIO_LOW_NEEDS_DUCK.multiplier,
    );
    expect(
      SCENE_AUDIO_BARRY_DUCK.releaseMs,
    ).toBeGreaterThanOrEqual(
      SCENE_AUDIO_LOW_NEEDS_DUCK.releaseMs,
    );
  });

  it('only emits low-needs keys at or below the configured threshold', () => {
    expect(
      deriveLowNeedKeys(
        {
          health: 20,
          satiety: 19.9,
          energy: 21,
          happiness: 0,
        },
        20,
      ).sort(),
    ).toEqual(
      ['happiness', 'health', 'satiety'].sort(),
    );
  });

  it('blocks shared ambience for either platform pause or scene-local suppression', () => {
    expect(
      shouldBlockSceneAudio(false, false),
    ).toBe(false);
    expect(
      shouldBlockSceneAudio(true, false),
    ).toBe(true);
    expect(
      shouldBlockSceneAudio(false, true),
    ).toBe(true);
    expect(
      shouldBlockSceneAudio(true, true),
    ).toBe(true);
  });

  it('keeps tactile cues rate-limited and semantically distinct', () => {
    for (const cue of [
      'dishesScrub',
      'trashGrab',
      'trashBin',
      'courierDraw',
      'barry',
      'lowNeeds',
      'cashGain',
      'cashSpend',
    ] as const) {
      expect(
        SCENE_AUDIO_TONES[cue].minIntervalMs,
      ).toBeGreaterThan(0);
      expect(
        SCENE_AUDIO_TONES[cue].gain,
      ).toBeGreaterThan(0);
    }

    expect(
      SCENE_AUDIO_TONES.barry.frequency,
    ).not.toBe(
      SCENE_AUDIO_TONES.lowNeeds.frequency,
    );
    expect(
      SCENE_AUDIO_TONES.cashGain.endFrequency,
    ).toBeGreaterThan(
      SCENE_AUDIO_TONES.cashGain.frequency,
    );
    expect(
      SCENE_AUDIO_TONES.cashSpend.endFrequency,
    ).toBeLessThan(
      SCENE_AUDIO_TONES.cashSpend.frequency,
    );
  });
});
