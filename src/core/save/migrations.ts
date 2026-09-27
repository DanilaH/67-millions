import { z } from 'zod';

import { SAVE_VERSION, parseSaveState, type SaveState } from './SaveState';

const versionProbeSchema = z.object({
  version: z.number().int().nonnegative(),
}).passthrough();

export class UnsupportedSaveVersionError extends Error {
  public constructor(public readonly version: number) {
    super(`Unsupported save version: ${version}`);
    this.name = 'UnsupportedSaveVersionError';
  }
}

export const migrateSaveState = (value: unknown): SaveState => {
  const { version } = versionProbeSchema.parse(value);

  if (version === SAVE_VERSION) {
    return parseSaveState(value);
  }

  throw new UnsupportedSaveVersionError(version);
};
