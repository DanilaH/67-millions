# T067 analytics contract (schema v1)

Transport: pinned mini-games-kit AnalyticsAdapter; development uses ConsoleAnalyticsAdapter. Yandex builds install the Metrica tag and send reachGoal events only when VITE_METRICA_COUNTER_ID is a positive safe integer. Counter 113254061 was supplied by the project owner. Missing/invalid configuration, script failures and adapter exceptions never change gameplay or prevent boot. Counter IDs are public configuration, not credentials. Override with .env.yandex.local or a build environment variable.

All semantic events carry schema_version=1, config_version, run_sequence (session-local), game_day, game_minute and cash. No player/account identifiers are collected. Seed on a Drop is its committed RNG state, not an invented original run seed. Session run_sequence is not a cross-device identity.

Events follow successful save writes through a single shared observer. Re-rendering and scene reloads do not generate state transition events. A browser reload emits game_start but does not replay historical purchases/payments/terminal events; exactly-once delivery across network/browser crashes is not claimed.

| Event | Additional fields / trigger |
| --- | --- |
| game_start | entry=load_or_new + rng_state on the first repository load; restored=false + rng_state after terminal restart |
| game_over | reason, first terminal transition |
| victory / main_debt_paid | manual principal settlement; amount on main_debt_paid |
| barry_due | payment_index, pending interrupt (also when due/payment occur in one saved transition) |
| barry_paid | amount, payment_index after successful debit |
| work_started | job_id, level after reserved costs |
| work_completed / work_failed | job_id, level, cash_delta after normative settlement; actual persisted skill result |
| plinko_drop / plinko_resolved | bet, payout, board_hash, cash_before/after, seed, drop_id, cascade_fixed_ticks, cascade_active_balls; insurance_top_up on resolve |
| upgrade_bought | upgrade_id, level, cost; includes job and Plinko upgrades |
| food_used / entertainment_used | food_id / entertainment_id after effect completion |
| sleep_started / sleep_completed | start checkpoint / slept_minutes at completion or Barry wake |
| dumpster_search | cash_delta, smelly after completion |
| event_shown / event_choice | event_id at a presentable safe point; choice on committed resolution |
| near_bankruptcy | downward crossing of the first configured Barry payment (threshold), once per crossing; suppressed after terminal/principal settlement |
| main_debt_ready | becomes payable with no active transaction or Barry flow |

Plinko cash_before is cash before stake reservation; cash_after is after settlement and any immediately mandatory Barry payment. cascade_fixed_ticks is elapsed physics ticks; cascade_active_balls must be zero after normal settlement. These are measured cascade statistics, not fabricated per-pin historical counts.

Validation: tests/analytics.test.ts covers transitions, repeated loads/writes, actual skill outcome, deterministic Drop identity, event presentation, rejected persistence, adapter failure and counter parsing. Hosted Metrica receipt still requires Yandex DRAFT and access to the counter goals dashboard.
