import type { GameState } from './GameState';

export type StatusId = keyof GameState['statuses'];

const parseStatusId = (statusId: string): StatusId => {
  if (statusId === 'SMELLY') return statusId;
  throw new Error(`Unsupported status: ${statusId}`);
};

export const hasStatus = (
  state: GameState,
  statusId: StatusId,
): boolean => state.statuses[statusId];

export const applyStatus = (
  state: GameState,
  statusId: string,
): GameState => {
  const parsed = parseStatusId(statusId);
  if (state.statuses[parsed]) return state;

  return {
    ...state,
    statuses: {
      ...state.statuses,
      [parsed]: true,
    },
  };
};

export const removeStatus = (
  state: GameState,
  statusId: string,
): GameState => {
  const parsed = parseStatusId(statusId);
  if (!state.statuses[parsed]) return state;

  return {
    ...state,
    statuses: {
      ...state.statuses,
      [parsed]: false,
    },
  };
};
