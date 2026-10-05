# Upgrade contribution and casino clarity — 2026-10-05

Advances T057/T059 (clear controls and feedback), T069/T070 (measurement). No economy, physics, geometry, save format or balance configuration was changed. The following findings block balance acceptance; they do not authorize an unreviewed redesign.

## Implemented UX changes

- The max-bet card explains that it increases the allowed stake, not the odds. The first-upgrade hint distinguishes it from increasing pocket payouts.
- The bet explanation states that ×1 returns the stake and below ×1 loses money.
- Visit totals and the latest launch are clearly labelled. Expanding totals hides the latest-result card instead of overlapping it; status messages also take precedence. Pending throws remain excluded from completed totals.
- An unchanged event modal retains its existing choice objects during passive-clock redraws. Previously `show()` destroyed and recreated the touch targets every game minute. This creates a race between touch-down and release; the previous hosted smoke failed on a touch event choice. The regression now holds a choice through a clock advance on mouse and touch, then checks it resolves. No retry, timeout increase or disabled assertion was added.

## Measurement

35 variants × 1,000 independent paid roots = **35,000 roots**. Each root uses `createSharedWorld`, production board construction, the Phaser Matter fork and Phaser resolver initialization. Every variant starts from identical root seeds. Work, purchase prices, concurrent launch strategy, insurance and max-bet upgrades are intentionally excluded: this isolates board effects, not a whole-game strategy.

Runtime baseline: `472c0dfdfe58abe563c77d51b02d6971ab71a7e9`. The new diagnostic source is included in this report's commit; the adapter is unchanged from that baseline. Config SHA-256 is recorded in `summary.json` and remains `7fe6c5c2a3ae98cbb1c1eaf81172097d0bd7cfbd259fee499f9c593214a3cd2c`.

Reproduce:

```
node --import tsx simulation/full-game/upgradeAudit.ts 1000
```

Root seeds are successive states from one xorshift32 stream starting at 67106000, reused for each variant. They are not adjacent integers: adjacent seeds gave first-draw samples confined to 0.316–0.391 and were discarded before this report. `samples.csv.gz` records every root seed, stake, payout and duration. No stuck roots occurred; unresolved roots cause the command to fail.

## Findings

Gross return includes the stake. Standard errors in the raw summary describe sample mean uncertainty, not a certified RTP. These are one-root samples, not human win probabilities.

| Board | Mean gross return | Median | Losing roots |
|---|---:|---:|---:|
| Bare | 1.992× | 1.000× | 40.9% |
| Only center L2 | 2.066× | 1.050× | 40.9% |
| Only middle L3 | 2.328× | 1.400× | 40.9% |
| Only edge payout L1 | 3.149× | 1.000× | 40.9% |
| Only edge payout L3 | 9.824× | 1.000× | 40.9% |
| Only splitter L5 | 2.002× | 1.000× | 40.9% |
| All seven board tracks max | 42.935× | 0.744× | 50.9% |
| Maximum without edge-payout upgrades | 5.816× | 0.744× | 50.9% |

The bare sample contains 89 edge outcomes out of 1,000 (8.9%), identified unambiguously by its unique 12× payout. Its mean standard error is 0.104×; the observed profitability is much larger than that sampling error. **The intended negative → roughly fair → profitable board progression is not currently established.** Correct bare-board physics comes before changing upgrade prices. The max-bet ladder increases the allowed stake fivefold per level; the inference is that it scales an already profitable starting board before the player needs meaningful physical upgrades. This is not a separate measured max-bet strategy experiment.

Edge payout upgrades account for the largest sampled increase: removing them from the maximum board changes mean gross return from 42.935× to 5.816×. This is an ablation, not an additive attribution: effects interact. The full maximum's mean standard error is 2.138×, and its median is still below the stake. Large rare payouts coexist with frequent losses.

Splitter alone changes the mean from 1.992× to 2.002× across all five paid levels. On the maximum board removing it changes the mean by only 0.031×. This suggests weak economic differentiation in this configuration; its visual/cascade value still needs human testing. Do not simply buff it without inspecting where balls contact its pins.

Return is non-monotonic in this sample: L1 2.455×, L2 2.072×, L3 2.892×, L4 2.971×. Level 2 deserves a paired trajectory/contact investigation before claiming each purchase improves expected return. More return contacts alone do not guarantee better outcomes.

## Product direction

The clearest existing promise is **turning a shabby machine into an absurd money machine while staying ahead of Barry**. Work funds the beginning and recovery; it should not consume most of the interesting decisions. Needs create trade-offs, but repetitive maintenance is not progression by itself.

Minimum next step: remeasure and calibrate the bare production board, then re-evaluate edge payout growth and the weak splitter/return levels on that baseline. Preserve exact paid-save compatibility. Do not raise all prices or add chores to stretch fast runs toward 30 minutes.

One promising addition beyond the current presentation scope is visible machine transformation at meaningful upgrade milestones: a few distinct cabinet/light/sound states, tied to existing upgrades. It could make progression tangible without new currencies, inventories, jobs or another menu. This is a proposal, not an implemented feature or a commitment to produce new art. Mutually exclusive machine builds could add choices later, but would require a separate design and balance decision; they are not a fix for the current baseline.

## Verification status

377 unit tests passed and the Pages build passed locally. The diagnostic entrypoint was explicitly typechecked. Local Chromium installation failed, so browser checks ran through GitHub Actions. [Run 37286661736](https://github.com/DanilaH/67-millions/actions/runs/37286661736) passed build, deployment and live verification on `cfd94bf704f8322adaea72d3ca00e0a72246f8f1`. The live manifest matched that revision, with zero page errors or failed requests. Mouse and touch held-choice regressions passed. Node/Phaser parity also passed from the first solver tick, alongside the six-root base/max-board fixtures. Desktop controls and mobile expanded-result screenshots were visually inspected: the totals no longer overlap the last-result card. Evidence: `pages-live-smoke`, artifact 11335203669. CI run 37286661629 passed. This Markdown follow-up changes no executable source.
