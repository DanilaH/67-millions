const PALETTE = {
  inkDeep: '#0D1012',
  inkPanel: '#171C20',
  inkRaised: '#242B31',
  lineDirty: '#4A5358',
  paperOld: '#C8B98D',
  textMain: '#F1F0E8',
  textMuted: '#A6ADB0',
  rust: '#9A563C',
  mustard: '#D0A74B',
  mold: '#60735A',
  bruise: '#66546E',
  warning: '#C86755',
  good: '#6F966D',
  cold: '#66808A',
} as const;

export type VisualColorToken = keyof typeof PALETTE;

const toNumber = (value: string): number =>
  Number.parseInt(value.slice(1), 16);

export const visualHex = (
  token: VisualColorToken,
): string => PALETTE[token];

export const visualColor = (
  token: VisualColorToken,
): number => toNumber(PALETTE[token]);

export const VISUAL_METRICS = {
  touchTargetMin: 44,
  panelRadius: 18,
  cardRadius: 14,
  hudDepth: 500,
  overlayDepth: 1_800,
  terminalDepth: 2_000,
  barryDepth: 10_000,
  mobileCriticalFontMin: 14,
} as const;

export const VISUAL_MOTION_MS = {
  microMin: 80,
  microMax: 180,
  uiMin: 160,
  uiMax: 260,
  installMin: 250,
  installMax: 450,
} as const;

export const VISUAL_FONT = {
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
} as const;

export type VisualSurface =
  | 'map'
  | 'hud'
  | 'panel'
  | 'event'
  | 'barry'
  | 'casino'
  | 'work';

export const VISUAL_SURFACE = {
  map: {
    fill: visualColor('inkDeep'),
    raised: visualColor('inkPanel'),
    line: visualColor('lineDirty'),
    accent: visualColor('mustard'),
  },
  hud: {
    fill: visualColor('inkPanel'),
    raised: visualColor('inkRaised'),
    line: visualColor('lineDirty'),
    accent: visualColor('paperOld'),
  },
  panel: {
    fill: visualColor('inkPanel'),
    raised: visualColor('inkRaised'),
    line: visualColor('lineDirty'),
    accent: visualColor('paperOld'),
  },
  event: {
    fill: visualColor('inkPanel'),
    raised: visualColor('inkRaised'),
    line: visualColor('rust'),
    accent: visualColor('paperOld'),
  },
  barry: {
    fill: visualColor('inkPanel'),
    raised: visualColor('rust'),
    line: visualColor('paperOld'),
    accent: visualColor('warning'),
  },
  casino: {
    fill: visualColor('inkDeep'),
    raised: visualColor('inkPanel'),
    line: visualColor('cold'),
    accent: visualColor('mustard'),
  },
  work: {
    fill: visualColor('inkDeep'),
    raised: visualColor('inkPanel'),
    line: visualColor('lineDirty'),
    accent: visualColor('paperOld'),
  },
} satisfies Record<
  VisualSurface,
  {
    fill: number;
    raised: number;
    line: number;
    accent: number;
  }
>;

export const SPECIAL_PIN_STYLE = {
  amplifier: {
    color: visualColor('mustard'),
    label: 'AMP',
  },
  return: {
    color: visualColor('cold'),
    label: 'RETURN',
  },
  splitter: {
    color: visualColor('rust'),
    label: 'SPLIT',
  },
  jackpotBias: {
    color: visualColor('paperOld'),
    label: 'BIAS',
  },
  insurance: {
    color: visualColor('good'),
    label: 'INS',
  },
} as const;
