# Independent break audit — recovered report, 2026-10-10

## Recovery notice

This document was reconstructed from the preceding conversation after automatic workspace maintenance removed the local repository. The original unpublished audit commits (last short SHA f10cdd8), raw traces, runner changes, validation logs, source snapshots and screenshots could not be recovered. The original branch was absent on GitHub; Library searches did not locate a backup.

The measurements below were run in the preceding work session and recorded in that conversation. They have NOT been rerun in this recovery session. This document preserves reported findings, not a complete reproducible evidence bundle. Do not claim the original raw artifacts, manifest, parity proof or screenshots are available from this branch.

The user explicitly authorized publishing the audit branch on 2026-10-10. Only this report is published. Runtime, config, main and Pages remain unchanged.

## Audited baseline

- Runtime revision: 5ab2579570bde7b59faceed1536d608dd22ecfd2.
- Config version: 0.9-ladder30k-playtest.
- Raw config SHA256: 5d8447e21f7a73df8ca5cbb90aec8ddf272c8484a034f1092256d3552c22d02f.
- Original baseline CI run: 37979581556, success.
- Original baseline Pages run: 37979582038, success.
- Recovery session independently checked that remote main still points to the audited revision.

These findings inform OPEN T070/T071. They do not close human pacing or actual mobile performance gates.

## Confirmed live defect: stale tabs overwrite progress

Observed on live Pages using two disposable test tabs sharing a save:

1. Both tabs loaded a save with 3,125 ₽.
2. In tab B, the intentional Pages playtest panel added 10,000 ₽. After closing the panel, the rendered balance became 13,125 ₽.
3. Tab A retained 3,125 ₽. Performing the ordinary free courtyard rest in its entertainment menu saved A's state.
4. Reloading B restored 3,125 ₽ and A's later clock, losing B's newer money.

Debug currency was a reproducible fixture; the overwriting action was normal gameplay. The final screenshot was saved during the original session but is now unavailable. Single-tab restoration checks do not cover competing save writers.

Original source inspection found complete snapshot writes to the shared 67m.save key through src/core/save/repository.ts, without a project-level stale-writer guard.

Priority: protect competing save ownership/conflicts before economy tuning; inspect the pinned mini-games-kit primitives first. Do not independently merge cash while ignoring RNG, clock and pending economic transactions. Reproduce again and add regression coverage before implementing the fix.

## Reported fresh balance experiment

564 qualified full-game runs on 52 distinct SHA256-derived game seeds:
72 selection, 288 holdout, 132 ordinary-pace, 72 recovery.

Selection used four seeds. Holdout used 24 new matched seeds; ordinary pace used its first 12 seeds. Recovery used another 24 matched seeds. A cold income-ranking cache measured 407 boards × 64 independent physical probe seeds = 26,048 roots. Probe seeds are not full-game sessions.

The original audit validated config/source hashes, unique seeds, starting cash, purchase counts, legal capacity/body bounds, and explicit overrides. Those validation outputs and raw traces were lost during cleanup.

Full refusal of the Splitter branch was an adaptive follow-up. The existing policy named skip-splitter skips ONLY its final level; it must not be interpreted as full branch refusal.

| Policy | Fast wins / 24 | Fast winner median, min | Ordinary wins / 12 | Ordinary winner median, min |
| --- | ---: | ---: | ---: | ---: |
| Cheapest available upgrade | 24 | 16.15 | 12 | 22.82 |
| Skip only final Splitter V | 24 | 15.85 | 12 | 22.56 |
| Refuse entire Splitter branch | 24 | 17.23 | 12 | 22.62 |
| Skip all final upgrade levels | 24 | 16.57 | 12 | 23.59 |
| Insurance first | 24 | 16.13 | 12 | 21.27 |
| Repeated insurance cycle | 9 | 33.85 | 2 | 40.33 |
| Quarter bets | 0 | — | 0 | — |
| Full bets, no cash reserve | 11 | 17.36 | 5 | 20.08 |
| No capacity upgrades | 24 | 23.80 | 12 | 29.11 |
| No edge guides | 24 | 23.33 | 12 | 29.50 |
| Ignore needs | 0 | — | 0 | — |

Winner-only medians exclude losses and cannot establish dominance.

### Findings

- No reliable cheap bypass was found in the tested matrix. Refusing capacity or edge guides cost about seven minutes in matched winners. Full-bet/no-reserve policies failed 13/24 fast and 7/12 ordinary games.
- Splitter V cost 5.4 million ₽ and had weak end-of-run purchase value. Skipping ONLY V was faster in all 24 fast and all 12 ordinary matched games; paired median saving 0.246 / 0.386 minutes, about 15 / 23 seconds.
- Refusing the ENTIRE Splitter branch was slower by paired median 0.853 / 0.261 minutes. The branch remained useful. Ordinary group median and paired median have different meanings.
- Quarter bets lost every tested game. All-run median elapsed time: 37.64 fast / 46.95 ordinary model minutes.
- Insurance cycles won only 9/24 fast and 2/12 ordinary; all-run medians were 37.65 / 46.98 model minutes, reaching 52.52 ordinary minutes. Inspect long losing paths and make weak progression understandable before adding punishment or globally raising prices.
- Fast lucky finishes remained possible: cheapest holdout minimum 9.85 model minutes; skipping final Splitter reached 9.77. No five-minute finish was reproduced; this is not an impossibility proof.
- Fresh income ranking did not dominate cheapest: 23/24 wins and winner median 15.22, but paired common-winner median was 0.547 minutes slower, faster in only 9/23. Group medians alone are misleading.
- Zero cash alone was recoverable under the tested policy: ordinary recovery control won 23/24; fresh zero-cash starts won 24/24, median 21.48 minutes. Starting-condition interventions do not cover every post-loss state.
- Critical starts (cash 0, health 25, other needs 10) failed 24/24: the heuristic chose two dumpster searches and died. This proves that heuristic failed, not that every human recovery route is impossible.

## Reported correctness and manual checks

Original assertions passed without failures across:

- 64 interrupted/uninterrupted Plinko cases, 772 actual serialize/restore operations, exact final state equality including RNG, cash, clock and needs.
- 180 Barry boundaries: 20 payment indices × three modifiers × cash below/equal/above due. Checked exact charge/index, terminal state and no second charge.
- 2,048 insurance settlements: mixed stakes/outcomes, cash conservation and one-use consumption.
- 10,000 generated courier routes: valid completion and fixed three-second travel.

Live checks in the preceding session:

- With 500 ₽ and a forced 3,000 ₽ Barry bill, defeat occurred and persisted after reload.
- A paid 2,500 ₽ root survived reload.
- A forbidden concurrent upgrade was not charged.
- Queued city exit settled before leaving: initial 5,000 − 2,500 + 625 = 3,125 ₽.
- Competing-tab persistence FAILED as described above.

These were correctness fixtures, not human balance playtests.

Reported validation: 431 tests / 75 files passed; Yandex production build/typecheck passed; standalone strict audit TypeScript check passed. Tests excluded reports/** because previously materialized evidence contained historical copied tests. Canonical tests were unchanged. The audit runner's default parity rerun matched the existing current-config promotion run, including trace, sessions and result. Logs and parity artifacts are now unavailable.

## Limitations and exclusions

Times are bot model times, not measured human play. Fast decisions: 0.25 s; jobs 6/5/8 s. Ordinary decisions: 2 s; jobs 12/15/18 s. Model job failure rate: 8%; root launch spacing: 0.25 s.

Renderer/load/save/navigation/hesitation and the production three-second dumpster animation were not added. No new low-end-device performance measurement or exhaustive strategy optimization was done.

An initial recovery diagnostic used ignored initialCash instead of startCash; its 24 games were excluded. One default parity rerun was excluded. Qualified runs asserted the first trace cash equaled parsed game.startCash.

## Minimal next steps

1. Reproduce and fix competing save writers; verify two live tabs and active paid roots.
2. Measure final Splitter V payback near the finish before choosing a price/effect adjustment.
3. Review long losing quarter/insurance paths and recovery decisions; improve actionable feedback before punitive random events.
4. Keep human ordinary-pace and worst-case mobile performance gates open.

Because the raw evidence is unavailable, numerical tuning should wait for a fresh reproducible experiment. This recovered report must not be cited as a complete evidence bundle.
