import type { BalanceConfig } from '../../config/balance.schema';
import {
  deriveBarePlinkoLayout,
  type PlinkoPeg,
} from './boardLayout';

export type AmplifierPinCount = 1 | 2 | 3;

const resolvePegIds = (
  config: BalanceConfig,
  pegIds: readonly string[],
): PlinkoPeg[] => {
  const layout = deriveBarePlinkoLayout(config);
  const byId = new Map(layout.pegs.map((peg) => [peg.id, peg] as const));

  return pegIds.map((id) => {
    const peg = byId.get(id);
    if (!peg) throw new Error(`Unknown special-pin peg id: ${id}`);
    return peg;
  });
};

export const getAmplifierPins = (
  config: BalanceConfig,
  count: AmplifierPinCount,
): PlinkoPeg[] =>
  resolvePegIds(
    config,
    config.plinko.specialPinLayout.amplifierByCount[String(count) as '1' | '2' | '3'],
  );

export const getReturnPins = (
  config: BalanceConfig,
  level: number,
): PlinkoPeg[] => {
  const entry = config.plinko.specialPinLayout.returnByLevel.find(
    (candidate) => candidate.level === level,
  );
  if (!entry) throw new RangeError(`Unknown Return layout level ${level}`);
  return resolvePegIds(config, entry.pegIds);
};

export const getSplitterPins = (
  config: BalanceConfig,
): PlinkoPeg[] =>
  resolvePegIds(config, config.plinko.specialPinLayout.splitterPegIds);

export const isMirrorSymmetricPinSet = (
  pins: readonly Pick<PlinkoPeg, 'row' | 'column'>[],
): boolean => {
  const ids = new Set(
    pins.map((pin) => `r${pin.row}c${pin.column}`),
  );

  return pins.every((pin) =>
    ids.has(`r${pin.row}c${pin.row - pin.column}`),
  );
};
