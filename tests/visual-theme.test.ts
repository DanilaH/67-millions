import { describe, expect, it } from 'vitest';

import {
  SPECIAL_PIN_STYLE,
  VISUAL_METRICS,
  VISUAL_MOTION_MS,
  VISUAL_SURFACE,
  visualColor,
  visualHex,
} from '../src/game/visual/visualTheme';

describe('M5 visual theme contract', () => {
  it('keeps mobile interaction/readability minima explicit', () => {
    expect(VISUAL_METRICS.touchTargetMin).toBeGreaterThanOrEqual(44);
    expect(VISUAL_METRICS.mobileCriticalFontMin).toBeGreaterThanOrEqual(14);
  });

  it('keeps motion bands bounded and ordered', () => {
    expect(VISUAL_MOTION_MS.microMin).toBeLessThan(
      VISUAL_MOTION_MS.microMax,
    );
    expect(VISUAL_MOTION_MS.uiMin).toBeLessThan(
      VISUAL_MOTION_MS.uiMax,
    );
    expect(VISUAL_MOTION_MS.installMin).toBeLessThan(
      VISUAL_MOTION_MS.installMax,
    );
  });

  it('exposes stable critical hierarchy colours', () => {
    expect(visualHex('textMain')).toBe('#F1F0E8');
    expect(visualHex('mustard')).toBe('#D0A74B');
    expect(visualHex('warning')).toBe('#C86755');
    expect(visualColor('inkDeep')).toBe(0x0d1012);
  });

  it('keeps special systems visually distinguishable by accent', () => {
    const colors = [
      SPECIAL_PIN_STYLE.amplifier.color,
      SPECIAL_PIN_STYLE.return.color,
      SPECIAL_PIN_STYLE.splitter.color,
      SPECIAL_PIN_STYLE.jackpotBias.color,
      SPECIAL_PIN_STYLE.insurance.color,
    ];

    expect(new Set(colors).size).toBe(colors.length);
  });

  it('gives Barry, Casino, and map distinct visual accents', () => {
    expect(VISUAL_SURFACE.barry.accent).not.toBe(
      VISUAL_SURFACE.casino.accent,
    );
    expect(VISUAL_SURFACE.map.accent).not.toBe(
      VISUAL_SURFACE.barry.accent,
    );
  });
});
