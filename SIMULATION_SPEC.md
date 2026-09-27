# SIMULATION SPEC

## 1. Two simulation layers

1. **Physical Plinko runner** — uses real board geometry/physics and measures actual payout distribution.
2. **Full-game economy runner** — pure core simulation of whole runs using measured/derived Plinko outcome models.

Both consume the same `balance.v0.json` version/hash as production.

## 2. Evidence rule

No historical win-rate number is treated as proof for the current config. A valid report records:
- config hash/version;
- code commit SHA;
- bot policy version;
- seed range / run count;
- output artifact.

## 3. Reproducibility

Every run is seeded. Save anomaly seeds for manual replay. Same config + policy + seed must produce the same core outcome.

## 4. Full-game state modeled

At minimum:
- cash;
- Barry payment index/modifier;
- game time/day;
- health/satiety/energy/happiness;
- sleep debt;
- statuses;
- work levels/temporary locks;
- event modifiers/pending event;
- Plinko board/max-bet/Insurance state;
- dumpster streak;
- RNG state.

Skill minigame success is represented by explicit policy failure probability; this runner is an economy diagnostic, not a forecast of human dexterity.

## 5. Bot archetypes

### CAUTIOUS
Large reserve, small bets, lots of work, actively services needs.

### BASELINE_GROWTH
Keeps Barry/life buffer, buys EV-oriented Plinko upgrades, gradually reduces work reliance.

### AGGRESSIVE
Smaller reserve, larger bets, faster max-bet progression.

### DEGENERATE
Prioritizes jackpot/bias/splitter and accepts high bankroll variance.

### WORKER
Relies excessively on work and uses Plinko minimally.

### RECKLESS_NEEDS
Sacrifices sleep/food/happiness for gambling and uses emergency recovery late.

## 6. Required metrics

- win rate;
- Barry loss rate;
- HP death rate;
- median/p10/p90 victory game day;
- median loss day;
- **estimated/actual real session duration**;
- work shifts;
- Plinko Drops;
- food/sleep/entertainment actions;
- events resolved;
- dumpster searches;
- dumpster comeback count;
- dumpster HP deaths;
- recoveries from near-zero cash;
- max bankroll drawdown;
- income share by work / Plinko / dumpster;
- share of wins dominated by one giant payout;
- upgrade-order frequencies.

## 7. Dumpster diagnostics

- use rate;
- rescue rate from cash≈0;
- avg/p95 searches;
- deaths after search chains;
- expected value per game hour;
- compare against worst regular work.

Dumpster must remain worse than ordinary work as a normal income strategy.

## 8. Initial calibration hypotheses

These are targets to test, not facts:
- BASELINE_GROWTH roughly 30–45% wins is a reasonable starting corridor;
- CAUTIOUS/WORKER should usually lose to Barry growth;
- AGGRESSIVE/DEGENERATE should have faster successful runs but lower reliability;
- no strategy should approach guaranteed victory without a clearly intentional late-game exploit state;
- successful runs should fit the ~30-real-minute product target;
- initial 25–50 work-shift corridor is secondary to session duration and should be reduced if it creates repetition;
- events should materially change outcomes without acting as direct scripted death.

## 9. Dominant-build test

If one strategy simultaneously dominates win rate, victory speed, drawdown and event robustness, treat it as a balance defect unless explicitly intended.

## 10. When the full-game runner must exist

Basic runner is an **M3 requirement**, before production minigame polish. M6 uses it for large final runs and balance freeze; M6 must not be the first time the runner is implemented.

## 11. Reporting

Generate per balance revision:
- JSON summary;
- CSV strategy table;
- anomaly seed list;
- Markdown report;
- config hash + commit SHA.
