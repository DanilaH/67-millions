import type { GameState, NeedsState, TerminalReason } from './GameState';

export interface NeedsDelta {
  health?: number;
  satiety?: number;
  energy?: number;
  happiness?: number;
}

export interface StateMutationResult {
  state: GameState;
  terminalTransition: TerminalReason | null;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const applyNeed = (
  current: number,
  delta: number | undefined,
  min: number,
  max: number,
): number => clamp(current + (delta ?? 0), min, max);

export const applyNeedsDelta = (
  state: GameState,
  delta: NeedsDelta,
  range: { min: number; max: number },
): StateMutationResult => {
  const needs: NeedsState = {
    health: applyNeed(state.needs.health, delta.health, range.min, range.max),
    satiety: applyNeed(state.needs.satiety, delta.satiety, range.min, range.max),
    energy: applyNeed(state.needs.energy, delta.energy, range.min, range.max),
    happiness: applyNeed(state.needs.happiness, delta.happiness, range.min, range.max),
  };

  if (state.terminalReason !== null) {
    return {
      state: { ...state, needs },
      terminalTransition: null,
    };
  }

  if (needs.health <= range.min) {
    return {
      state: { ...state, needs, terminalReason: 'HEALTH_ZERO' },
      terminalTransition: 'HEALTH_ZERO',
    };
  }

  return {
    state: { ...state, needs },
    terminalTransition: null,
  };
};

export const markTerminal = (
  state: GameState,
  reason: TerminalReason,
): StateMutationResult => {
  if (state.terminalReason !== null) {
    return { state, terminalTransition: null };
  }

  return {
    state: { ...state, terminalReason: reason },
    terminalTransition: reason,
  };
};
