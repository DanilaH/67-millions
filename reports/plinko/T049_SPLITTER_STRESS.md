# T049 — 24-ball / Splitter stress evidence

Status: **accepted synthetic stress gate for M3/E14.**

## Scope

This is deliberately a **synthetic worst-case concurrency harness**. It starts one Drop with the configured production cap of **24 active balls** already present, under maxed special-pin geometry, then lets normal physical Splitter / Return / Amplifier rules run.

It does **not** claim that the current V0 board naturally reaches 24 simultaneous balls. The purpose is to prove that the runtime cap, lineage/depth guards, Matter simulation, watchdog, and reporting remain stable at the configured worst-case active-body count before M4.

## Provenance

- GitHub Actions workflow: **T049 Splitter stress**
- workflow run: **36542333155**
- measured head: `864e9abe3d625563b207e353f4e9408144b423d6`
- artifact: `t049-splitter-stress`
- artifact id: `11020284084`
- artifact digest: `sha256:01fecd5c8843e9db394f0c1bd2a636dff52cbcbc1a3558eaced5ecf4e7bd8222`
- runs: **1,000**
- seed: **67049000**
- board hash: `a2693868a04e7cd8fc6530ebd384a051729f4f07593fbacf44ff173288590abe`
- batch size: **1**
- synthetic initial active balls per Drop: **24**
- max active-ball config: **24**
- max split depth: **2**
- pocket levels: center L2 / mid L3 / jackpot L3
- special levels: Amplifier L5 / Return L4 / Splitter L5 / Jackpot Bias L4
- ball-ball collisions: **disabled**, matching V0 config

## Gate results

| Metric | Result |
| --- | ---: |
| Resolved | **1,000 / 1,000** |
| Stuck/watchdog failures | **0** |
| Max active balls observed | **24** |
| Mean max-active balls | **24.0000** |
| Mean terminal balls | **29.2050** |
| Max terminal balls | **35** |
| Theoretical terminal bound | **96** |
| Mean cascade duration | **6.565 s** |
| p95 cascade duration | **7.417 s** |
| Max cascade duration | **8.883 s** |

The terminal-ball count is allowed to exceed 24 because the cap is **concurrent active bodies**, not lifetime descendants: after some balls settle, remaining lineages may legally Split while staying at or below 24 simultaneously. With 24 synthetic root lineages and max split depth 2, the conservative theoretical lifetime-terminal bound is `24 × 2² = 96`; observed max was **35**.

## Runner performance on GitHub-hosted Linux

| Metric | Result |
| --- | ---: |
| Wall elapsed | **18,733.7 ms** |
| Wall ms / synthetic Drop | **18.734 ms** |
| Wall ms / terminal ball | **0.641 ms** |
| Synthetic Drops / second | **53.38** |
| Terminal balls / second | **1,558.96** |

These are **headless Node/Matter throughput measurements on the GitHub-hosted runner**, not a real-device frame-time claim. They are useful as a reproducible regression baseline. Real-device/max-cascade acceptance still belongs to the later device gate.

## Acceptance

T049 acceptance is satisfied by this run:

- configured concurrent cap is reached and never exceeded;
- sequential Splitter activity remains bounded by split depth;
- all 1,000 synthetic worst-case Drops resolve;
- no runaway/stuck bodies are observed;
- a reproducible performance measurement is captured before M4.

Default production simulation behavior remains `initialBallCount=1`; the multi-root input exists only for stress tooling.
