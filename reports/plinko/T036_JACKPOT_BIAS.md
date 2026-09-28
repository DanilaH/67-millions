# T036 — Jackpot Bias physical evidence

Status: **accepted for M3/T036 implementation semantics**

This report records the physical evidence for the V0 Jackpot Bias geometry on `BOARD_LAYOUT_V0`.

## Provenance

- final measured code head: `1fda7bf050a59a0731d6e025229620f8b55b6d22`
- final CI: workflow run **36455202398**
- paired 10k Bias sweep: workflow run **36455202213**
- final 100k Bias sweep: workflow run **36455202124**
- combined-max + Bias L4 100k: workflow run **36455202156**
- synthetic mobile performance smoke: workflow run **36455202144**
- final Bias sweep seed: **67036200**
- combined interaction seed: **67036400**
- all Bias behavior is Matter geometry; no hidden edge-probability routing exists

## Geometry

Bias is a cumulative set of mirrored angled deflector pairs derived only from `balance.v0.json`.

- L0: no deflectors
- L1: outer pair at approximately row 7
- L2: L1 + outer pair at approximately row 6
- L3: L2 + outer pair at approximately row 5
- L4: L3 + upper outer pair at approximately row 4
- each pair is mirror-symmetric around board center
- final seed uses 36 px length, 5 px thickness, 25° angle and 0.75 restitution
- the L4 pair uses `deflectorOffsetX=110`; the adjacent 109 px candidate was rejected because it produced a threshold jump to roughly 1.67x bare EV in the tuning probe

The first circular-bumper experiment was rejected because some levels created severe stuck incidence and others failed to improve edge probability. Single angled-deflector probes then established a stable redirect shape; cumulative pair count became the progression mechanism because angle, restitution and small offset changes behaved mostly as threshold controls rather than smooth strength controls.

## Final 100k per-level physical report

| Bias | Deflector pairs | Edge probability | EV / RTP | Combined center | Symmetry delta | Stuck | p95 duration | Max duration |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| L0 | 0 | **1.102%** | **0.862298x** | 52.097% | 0.195% | **0 / 100k** | 5.700s | 7.717s |
| L1 | 1 | **1.982%** | **0.936498x** | 52.097% | 0.195% | **0 / 100k** | 5.700s | 7.717s |
| L2 | 2 | **2.627%** | **1.002343x** | 52.097% | 0.187% | **0 / 100k** | 5.700s | 7.717s |
| L3 | 3 | **4.867%** | **1.238000x** | 52.038% | 0.196% | **0 / 100k** | 5.700s | 7.717s |
| L4 | 4 | **5.589%** | **1.310413x** | 52.503% | 0.166% | **0 / 100k** | 5.700s | 7.717s |

The edge effect is strictly monotonic from L0 through L4 in the final 100k run, while stuck incidence remains zero and symmetry remains tight.

## Combined-max interaction stress

The physical interaction gate used Amplifier L5 + Return L4 + Splitter L5 + Jackpot Bias L4 for 100,000 Drops.

- resolved: **100,000 / 100,000**
- stuck: **0**
- EV: **2.307978x**
- median aggregate multiplier: **0.464x**
- P(<1x): **63.513%**
- P(>=2x): **11.811%**
- P(>=5x): **9.672%**
- P(>=10x): **9.335%**
- mean terminal balls: **1.37386**
- mean child balls: **0.74772**
- mean Return procs: **0.15163**
- mean Amplifier procs: **0.61262**
- max active balls observed: **2**
- mean cascade duration: **5.042s**
- p95 cascade duration: **6.283s**
- max cascade duration: **8.717s**

The high combined EV is an input to E13 full-game economy/dominant-strategy simulation, not a price/economy freeze. T036 acceptance concerns physical geometry, measured edge impact and runtime stability.

## Performance screening

Synthetic Chromium mobile-context / touch profile with 4x CPU throttling:

- median frame: **16.7ms**
- p95 frame: **33.4ms**
- max frame: **50ms**
- frames over 50ms: **0%**
- active balls after resolve: **0**

This is a CI screening profile, not real-device evidence. Real-device/max-cascade acceptance remains in E22/T072.

## Acceptance

T036 is satisfied:

- Jackpot Bias is real, visible, symmetric physical geometry;
- geometry is config-derived and included in the committed Drop fingerprint;
- active-Drop reload cannot silently change Bias geometry;
- edge probability increases physically and monotonically across L1-L4;
- final 100k per-level runs have zero stuck outcomes;
- combined max special-pin interaction has zero stuck outcomes;
- no hidden probability or payout override was introduced.

Upgrade prices and final economy remain TUNABLE pending E13/E21.
