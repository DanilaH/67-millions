import { describe, expect, it } from 'vitest';

import {
  acknowledgeTutorialInfo,
  applyTutorialMilestone,
  createInitialTutorialProgress,
  deriveTutorialStep,
  parseTutorialProgress,
} from '../src/game/tutorial/tutorialProgress';
import {
  buildTutorialCard,
  type TutorialSurface,
} from '../src/game/tutorial/tutorialUiModel';

describe('T059 contextual tutorial progression', () => {
  it('follows the required first-day sequence', () => {
    let progress = createInitialTutorialProgress();

    expect(deriveTutorialStep(progress)).toBe('BARRY');

    progress = acknowledgeTutorialInfo(progress, 'BARRY');
    expect(deriveTutorialStep(progress)).toBe('FIRST_WORK');

    progress = applyTutorialMilestone(
      progress,
      'WORK_COMPLETED',
    );
    expect(deriveTutorialStep(progress)).toBe('FIRST_DROP');

    progress = applyTutorialMilestone(
      progress,
      'DROP_RESOLVED',
    );
    expect(deriveTutorialStep(progress)).toBe('CHEAP_UPGRADE');

    progress = applyTutorialMilestone(
      progress,
      'UPGRADE_BOUGHT',
    );
    expect(deriveTutorialStep(progress)).toBe('NEEDS');

    progress = acknowledgeTutorialInfo(progress, 'NEEDS');
    expect(deriveTutorialStep(progress)).toBe('RECOVERY');

    progress = applyTutorialMilestone(
      progress,
      'RECOVERY_USED',
    );
    expect(deriveTutorialStep(progress)).toBe(
      'FIRST_BARRY_PAYMENT',
    );

    progress = applyTutorialMilestone(
      progress,
      'BARRY_PAID',
    );
    expect(deriveTutorialStep(progress)).toBe('DONE');
  });

  it('remembers milestones completed early instead of forcing repetition', () => {
    let progress = createInitialTutorialProgress();

    for (const milestone of [
      'WORK_COMPLETED',
      'DROP_RESOLVED',
      'UPGRADE_BOUGHT',
      'RECOVERY_USED',
      'BARRY_PAID',
    ] as const) {
      progress = applyTutorialMilestone(
        progress,
        milestone,
      );
    }

    expect(deriveTutorialStep(progress)).toBe('BARRY');

    progress = acknowledgeTutorialInfo(progress, 'BARRY');
    expect(deriveTutorialStep(progress)).toBe('NEEDS');

    progress = acknowledgeTutorialInfo(progress, 'NEEDS');
    expect(deriveTutorialStep(progress)).toBe('DONE');
  });

  it('falls back safely when persisted tutorial UI data is corrupt', () => {
    expect(
      parseTutorialProgress('{ definitely not json'),
    ).toEqual(createInitialTutorialProgress());

    expect(
      parseTutorialProgress(
        JSON.stringify({
          version: 999,
          barryAcknowledged: true,
        }),
      ),
    ).toEqual(createInitialTutorialProgress());
  });

  it('uses contextual map/casino copy rather than a blocking text wall', () => {
    const surfaces: readonly TutorialSurface[] = [
      'map',
      'casino',
    ];
    const steps = [
      'BARRY',
      'FIRST_WORK',
      'FIRST_DROP',
      'CHEAP_UPGRADE',
      'NEEDS',
      'RECOVERY',
      'FIRST_BARRY_PAYMENT',
    ] as const;

    for (const surface of surfaces) {
      for (const step of steps) {
        const card = buildTutorialCard(step, surface);
        expect(card).not.toBeNull();
        expect(card!.title.length).toBeLessThanOrEqual(24);
        expect(card!.body.length).toBeLessThanOrEqual(180);
      }
    }

    expect(
      buildTutorialCard('FIRST_DROP', 'map')?.body,
    ).toContain('КАЗИНО');
    expect(
      buildTutorialCard('FIRST_DROP', 'casino')?.body,
    ).toContain('25%');
    expect(
      buildTutorialCard('CHEAP_UPGRADE', 'casino')?.body,
    ).toContain('500 ₽');
    expect(
      buildTutorialCard('NEEDS', 'map')?.acknowledge,
    ).toBe('NEEDS');
    expect(
      buildTutorialCard('NEEDS', 'casino')?.acknowledge,
    ).toBeNull();
    expect(buildTutorialCard('DONE', 'map')).toBeNull();
  });
});
