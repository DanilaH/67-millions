# T050 — Special-pin audio prototype

Status: **prototype implemented; structural stress gate defined for M3/E14.**

## Scope

This task makes Amplifier, Splitter, and Return audibly distinguishable in the current Plinko prototype while keeping stress-state voice load bounded.

It is **not** the final production audio pass. Final timbre, mixing, real-device listening, jackpot hierarchy, and production assets remain T064.

## Cue signatures

| Special pin | Prototype signature | Duration | Peak gain |
| --- | --- | ---: | ---: |
| Amplifier | bright rising triangle, 920 → 1320 Hz | 130 ms | 0.048 |
| Splitter | short descending square, 390 → 235 Hz | 115 ms | 0.050 |
| Return | longer rising sine, 260 → 620 Hz | 185 ms | 0.045 |

The three cues intentionally differ in pitch contour, waveform, and envelope duration rather than relying on loudness alone.

## Stress admission policy

Special-pin cues use a separate burst policy:

- global special-voice limit: **5**
- Amplifier minimum interval: **42 ms**
- Splitter minimum interval: **48 ms**
- Return minimum interval: **70 ms**
- excess same-kind hits inside the interval are coalesced;
- excess simultaneous special voices are dropped rather than accumulated.

The existing budgets remain:

- bounce voices: **6**
- pocket/result accent voices: **4**
- special-pin voices: **5**

Worst-case summed configured peak gain across all three budgets is **0.70**, below digital full scale **1.0** before any downstream browser/device gain.

## Runtime integration

The cue is emitted only when the corresponding gameplay effect actually procs:

- Amplifier cue after a valid lineage amplification;
- Return cue after a valid lineage Return;
- Splitter cue after a valid physical split creates the two child bodies.

Ordinary peg bounce audio remains separately rate-limited.

## Automated acceptance

`tests/plinko-special-audio.test.ts` covers:

- worst-case configured peak headroom remains below 1.0;
- a 72-event synthetic burst representing heavy 24-body cascade activity still admits all three cue families;
- special active voices never exceed 5;
- cooldown coalescing rejects burst spam;
- all scheduled voices drain back to zero.

## Interpretation

T050 acceptance is satisfied at the prototype/engineering level:

- Amplifier / Splitter / Return have deliberately distinct signatures;
- stress-state cue scheduling is bounded;
- the configured voice/gain model has explicit clipping headroom.

Subjective mix/readability on real speakers and final audio asset quality are intentionally deferred to T064.
