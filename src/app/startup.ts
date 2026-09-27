import { detectPreferredRuntimeImageFormat, type RuntimeImageFormat } from '@danilah/mini-games-kit/runtime-assets';
import { StartupTimeline } from '@danilah/mini-games-kit/startup';

import { setRuntimeImageFormat } from './runtimeImages';

export type BootstrapStartupPhase = 'platformReady' | 'artFormatReady' | 'gamePresentable' | 'ready';

export const startupTimeline = new StartupTimeline<BootstrapStartupPhase>();

export const isDebugBuild = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_PANEL === 'true';

export const detectRuntimeImageFormat = async (): Promise<RuntimeImageFormat> => {
  const format = await detectPreferredRuntimeImageFormat({ overrideEnabled: isDebugBuild() });
  setRuntimeImageFormat(format);
  startupTimeline.mark('artFormatReady');
  return format;
};

export const afterPaintFrames = async (count = 2): Promise<void> => {
  if (typeof requestAnimationFrame === 'undefined') return;
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

export const getStartupSnapshot = (runtimeImageFormat: RuntimeImageFormat) => ({
  runtimeImageFormat,
  timings: startupTimeline.snapshot({
    moduleToPlatformMs: ['start', 'platformReady'],
    moduleToArtFormatMs: ['start', 'artFormatReady'],
    moduleToPresentableMs: ['start', 'gamePresentable'],
    moduleToReadyMs: ['start', 'ready'],
    presentableToReadyMs: ['gamePresentable', 'ready'],
  }),
});
