import {
  resolveRuntimeImageRequestPath,
  type RuntimeImageFormat,
} from '@danilah/mini-games-kit/runtime-assets';

let selectedRuntimeImageFormat: RuntimeImageFormat = 'webp';

export const setRuntimeImageFormat = (format: RuntimeImageFormat): void => {
  selectedRuntimeImageFormat = format;
};

export const getRuntimeImageFormat = (): RuntimeImageFormat => selectedRuntimeImageFormat;

export const runtimeImageRequestPath = (fallbackWebpPath: string): string =>
  resolveRuntimeImageRequestPath(fallbackWebpPath, selectedRuntimeImageFormat);
