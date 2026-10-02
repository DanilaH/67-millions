# Free launches and playtest presentation — 2026-10-02

User-authorized continuation of the existing game, extending the casino/UI/persistence work. Base revision: `1114d336e158aa06d5cae6ebf73b4cacef38e6f6`.

## Shipped behavior

- Repeated clicks launch separately paid balls without waiting for the previous cascade. Capacity: six concurrent Drops / existing 24-body cap, both in parsed config. Different fractions/stakes settle independently. Upgrades and non-Plinko economic actions remain locked until the whole board is empty.
- Save v15 retains one exact shared Matter solver and a bounded outstanding-launch ledger; completed entries are removed/rotated atomically with payouts. v14 migration preserves existing stakes. Barry blocks new launches and waits for all already-paid lineages. An earned shield remains available for the next launch.
- Bounded trails, impact rings and floating pocket returns; no effect changes physics or RNG.
- Full-screen city map and small location tags. Four vector need icons, values/bars and tap details replace the left stat panel. Empty status text is hidden. Pending-cascade map inspection uses the same compact HUD.
- Render backing follows viewport size × DPR, capped at 2× logical resolution; camera/input stay in logical 1280×720 coordinates. Text density uses the pinned kit helper. Modals and minigames use logical dimensions.
- Preview debug: `?debug=1`, expandable panel, gameplay pause, add/remove cash, scheduler-based minute advance, explicit reset confirmation. Commands require idle map. Production Yandex cannot enable the panel with that URL parameter.

## Actual local verification

- `npm test`: 360 tests / 62 files passed.
- `npm run typecheck`: passed.
- `npm run release:check`: production build and upload-root audit passed.
- `npm run build:pages`: passed.
- `npm run smoke:pages`: real Chromium, mouse 1280×720 and CDP touch 640×360; all existing action/reload/Barry/event/scene-entry checks passed; no page errors, failed requests or hosted-service calls.
- `npm run smoke:playtest`: 1920×1080 backing/input; six mixed-stake launches; seventh click at capacity does not debit; exact cash/RNG/clock restore; no duplicate settlement; max-special multi-cascade exact restore; courier reaches the endpoint through real 1080p pointer input; debug add/remove/time/reset; collapsed debug leaves the casino exit usable at 640×360. Passed, no page errors.
- Screenshots inspected: full-screen 1080p map, compact HUD, six-ball board. Screenshots and machine-readable results are uploaded by the Pages workflow.

Config SHA-256: `efc0e32a1e328ee2f453022ea344475531f16d1acbd343c8c229aa21d880b994`.

## Publication and limits

Pages workflow now gates deployment on both browser suites, then runs the existing live smoke against the exact published revision. Deployment result is to be recorded after the workflow finishes.

This is a playtest build, not an accepted RC. No real-device performance claim, new RTP/EV result or 30-minute pacing claim. Existing raster art has not been repainted; the rendering and framing are improved. Debug commands intentionally do not modify an in-flight job or paid cascade; finish it and return to the map first. Reset replaces the run while retaining tutorial preferences.
