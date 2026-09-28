# BOARD_LAYOUT_V0 special-pin placement evidence

Status: **accepted as T034 placement seed**

This report records the physical-placement evidence for `balance.v0.json -> plinko.specialPinLayout`. It does **not** claim that Amplifier / Return / Splitter upgrade EV is balanced; actual effect-level milestone reports belong to T035.

## Provenance

- layout id: `BOARD_LAYOUT_V0`
- accepted bare-board physics: Balance V0
- unique-hit probe runs: **100,000 Drops**
- gameplay RNG seed: **67034000**
- GitHub Actions run: **36394940889**
- code revision: `06bf023a4b3c62172ad6c8659ddd8a01ef6776ff`
- probe artifact id: `10957493003`
- artifact SHA-256: `8fb05e9a761fe29418f6b6692d5e3eecc96fa2a333c5077e6a379a96620842ae`

A peg hit-rate is the fraction of Drops that touched that physical peg at least once. For a mirrored pair, a Drop counts once when it touches either member.

## Accepted seed slots

### Amplifier

| Physical count | Peg ids | Bare union hit-rate |
| ---: | --- | ---: |
| 1 | `r6c3` | **28.398%** |
| 2 | `r3c0 + r3c3` | **31.157%** |
| 3 | `r6c3 + r3c0 + r3c3` | **58.256%** |

The 1/2/3-pin sets are mirror-symmetric. Count=3 has high exposure; this is intentionally treated as a **T035 balance risk**, not silently tuned during placement.

### Return

| Level | Peg ids | Config target | Measured bare hit-rate | Absolute delta |
| ---: | --- | ---: | ---: | ---: |
| 1 | `r7c1 + r7c6` | 7.000% | **7.391%** | 0.391% |
| 2 | `r4c0 + r4c4` | 11.000% | **11.997%** | 0.997% |
| 3 | `r6c1 + r6c5` | 15.000% | **16.805%** | 1.805% |
| 4 | `r8c2 + r8c6` | 20.000% | **18.125%** | 1.875% |

This gives a monotonic physical-frequency ladder close to the configured Return targets without hidden proc-probability routing.

### Splitter

- peg ids: `r8c4`
- measured bare hit-rate: **27.870%**
- the single peg is centerline/self-mirrored.

The Splitter seed is deliberately only a placement seed. Child value, repeated descendant interaction, depth cap and 24-ball cap can materially change effective EV and cascade duration; T035/T049 must measure them.

## Symmetric slot reference

| Slot | Bare hit-rate |
| --- | ---: |
| `r0c0` | 100.000% |
| `r1c0+r1c1` | 100.000% |
| `r3c1+r3c2` | 68.843% |
| `r5c2+r5c3` | 56.739% |
| `r4c1+r4c3` | 54.428% |
| `r7c3+r7c4` | 53.920% |
| `r2c1` | 52.428% |
| `r6c2+r6c4` | 52.206% |
| `r8c3+r8c5` | 48.120% |
| `r2c0+r2c2` | 47.572% |
| `r5c1+r5c4` | 38.393% |
| `r7c2+r7c5` | 36.684% |
| `r4c2` | 33.575% |
| `r3c0+r3c3` | 31.157% |
| `r6c3` | 28.398% |
| `r8c4` | 27.870% |
| `r8c2+r8c6` | 18.125% |
| `r6c1+r6c5` | 16.805% |
| `r4c0+r4c4` | 11.997% |
| `r7c1+r7c6` | 7.391% |
| `r5c0+r5c5` | 4.868% |
| `r8c1+r8c7` | 4.359% |
| `r6c0+r6c6` | 2.368% |
| `r7c0+r7c7` | 1.805% |
| `r8c0+r8c8` | 0.999% |

## Acceptance interpretation

T034 is satisfied when positions are data-driven, symmetric, reproducible and backed by physical measurements. That condition is met here.

This report does **not** freeze special-pin economics. T035 must enable real Amplifier / Return / Splitter behavior in the physical runner and report EV, payout tails, child-ball count, Return count, cascade duration, stuck incidence and cap/depth behavior before those effects are accepted.
