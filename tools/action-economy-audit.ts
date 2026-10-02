import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { balance as config } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { startWork, purchaseJobUpgrade } from '../src/core/work/work';
import { completeWorkSkill } from '../src/core/work/skillCompletion';
import { WorkMinigameClock } from '../src/core/work/WorkMinigameClock';
import { advanceRunTime } from '../src/core/time/runTime';
import { startFood, startEntertainment, settleRecoveryAction } from '../src/core/actions/foodEntertainment';

// Deterministic action comparison, not a full-run policy or a win-rate estimate.
const seed = 671002;
const controlled = structuredClone(config);
controlled.events.chancePerCheckpoint = 0;
const jobs = Object.entries(config.work.jobs).flatMap(([job, entry]) => entry.levels.map((level, index) => ({
  job, ...level, rublesPerGameHour: level.payout / (level.durationMinutes / 60),
  shiftsToRecoupIncrement: index ? Math.ceil(level.upgradePrice / (level.payout - entry.levels[index - 1]!.payout)) : null,
})));
const recovery = (smelly: boolean) => {
  const state = createInitialGameState(controlled, seed);
  state.cash = 100000; state.needs = { health: 80, satiety: 25, energy: 50, happiness: 25 }; state.statuses.SMELLY = smelly;
  return [...controlled.food, ...controlled.entertainment].map(entry => {
    const started = 'satiety' in entry ? startFood(state, null, null, controlled, entry.id) : startEntertainment(state, null, null, controlled, entry.id);
    const advanced = advanceRunTime(started.state, started.action, entry.durationMinutes, controlled);
    const end = settleRecoveryAction(advanced.state, started.action, controlled);
    return { id: entry.id, price: state.cash - end.cash, minutes: entry.durationMinutes,
      netNeeds: Object.fromEntries(Object.entries(end.needs).map(([key, value]) => [key, +(value - state.needs[key as keyof typeof state.needs]).toFixed(3)])) };
  });
};
let state = createInitialGameState(controlled, seed);
const opening = [{ action: 'start', cash: state.cash, minute: state.clock.minuteOfDay }];
const shift = () => {
  const started = startWork(state, controlled, 'courier', state.jobLevels.courier);
  const played = new WorkMinigameClock(controlled).advance(started.state, 21000, controlled);
  const completed = completeWorkSkill(played.state, started.action, 'SUCCESS', controlled);
  if (!completed.shiftCompleted) throw new Error('Opening fixture did not complete');
  state = completed.state;
  opening.push({ action: `courier L${state.jobLevels.courier} success`, cash: state.cash, minute: state.clock.minuteOfDay });
};
shift();
state = purchaseJobUpgrade(state, null, null, controlled, 'courier');
opening.push({ action: 'buy courier L2', cash: state.cash, minute: state.clock.minuteOfDay });
shift();
console.log(JSON.stringify({ model: 'action-economy-audit-v1', configHash: createHash('sha256').update(readFileSync('balance.v0.json')).digest('hex'),
  baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), seed,
  assumptions: ['Core transactions; events disabled only in comparison fixtures', 'Successful shifts; no sleep/event payout penalties', 'Opening assumes 7 game minutes of skill input plus normative shift duration', 'Recovery starts HP80/satiety25/energy50/happiness25; caps and passive decay included', 'No Plinko, human success probability, performance, or full-run win-rate measured'],
  jobs, recovery: recovery(false), smellyRecovery: recovery(true), opening }, null, 2));
