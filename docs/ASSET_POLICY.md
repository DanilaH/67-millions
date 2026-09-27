# Runtime asset policy

Use the pinned mini-games-kit asset/runtime-image tooling and playbooks as the implementation baseline.

67M-specific constraints:
- visual direction is hand-painted dirty cartoon / black comedy;
- landscape desktop + mobile readability is mandatory;
- Plinko board state must remain readable at the 24-ball cap;
- canonical asset ids use fallback WebP paths and resolve AVIF at the loader boundary;
- no numeric codec/DPR budget is copied from Signal 2000 without measurement.

Before production art scale-up, record per-category presentation size, DPR cap, source/master provenance, trim/logical-frame policy, encoded/RGBA budgets, startup/session/deferred loading classes and target-host acceptance evidence.
