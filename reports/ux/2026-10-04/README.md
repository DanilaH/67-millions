# Interface clarity pass

User-authorized UX revision; no economy, physics, scheduler or save-rule changes.

- Shared HUD on the city and casino: clock, cash, next Barry amount; detailed countdown only within three game hours or on tap. Main debt is a compact goal with an explanation on tap.
- Needs use readable bars with low-state labels. Tap retains exact values and adds recovery guidance. City locations gain short functional labels and a contextual highlight for low needs/smell.
- Casino bets display actual capped rouble amounts; the launch button keeps the amount even while launch is temporarily unavailable. Percent fractions and cash deductions are unchanged.
- Three compact upgrade rows, one-row scrolling using wheel or up/down controls, stable order, dedicated purchase buttons. Pending cascades get one neutral shared explanation instead of repeated red warnings.
- Results lead with stake-adjusted net outcome; gross payout and stake remain visible, and insurance remains explicitly included.
- Action panels narrow; one-action panels shrink vertically. Sleep shows wake time and projected need values. Tutorial copy follows the new purchase and bet controls.

Verification: unit assertions and browser scenario coordinates updated for the explicitly changed presentation contract. Browser checks still cover every upgrade row, no purchase on navigation/title/selection, single purchase, and active-cascade purchase locking. Full release evidence is the GitHub Actions run for this revision.

Follow-up: animated need forecasts and targeted upgrade highlights are now implemented. Richer building art interactions remain outside this pass. No claim of user-tested UX or improved full-run pacing.

## Follow-up feedback

Recovery cards expose a separate forecast button (also preview on mouse hover). Needs bars show current → projected values with an animated change marker; closing or paging the panel clears it. Forecast uses the existing needs/completion rules, does not consume RNG or mutate game state, stops before Barry interrupts, and is explicitly an estimate without random events. Sleep copy distinguishes full sleep from Barry interruption.

Successful, saved upgrade purchases briefly highlight the affected pocket labels, special pins, deflectors or stake controls. The bounded visual overlay does not alter the physics world. Unaffordable casino upgrades show the exact missing amount.

Local validation: 365 unit tests, typecheck and release audit passed. Browser suite now checks that forecast toggling does not charge, start an action or consume RNG, and captures forecast/purchase feedback screenshots. Browser waits have a 30-second default timeout so a missing element cannot hang indefinitely.

## Small-screen readability

Increased recovery descriptions from 19 to 22 logical pixels with primary text contrast, forecast buttons from 16 to 22, expanded help from 16 to 22, and forecast values from 11 to 16. Forecast values use compact arrows and move the current-value bars below the numbers. Low-need labels are larger; the forecast caption has an opaque backing. Help stays open for six seconds to allow reading. Existing panel geometry, actions, and economy remain unchanged. Desktop/touch screenshots and the existing browser scenarios are the visual/interaction gate.

## Full viewport and casino space

User-authorized presentation revision: landscape now fills the available browser viewport by expanding the camera's visible world around the unchanged 1280×720 gameplay coordinates. Uniform scaling preserves board geometry and input transforms. Full-scene art covers the visible area; the map markers and entrance hit targets follow normalized coordinates in the same painted image, including after resizing. Labels connect to entrances and selected entrances receive an outline.

The casino uses the complete painted machine surface within a separate dim room with wall panels, lamps, floor perspective and neighbouring cabinets. The betting controls sit below the board. Upgrades use one compact, continuously scrollable list with a visible scrollbar, wheel and touch/mouse dragging. Scroll gestures cannot buy; purchases still use authoritative validation. The list anchors to the right edge on wide screens. Shared HUD backing expands to the viewport edges.

Validation adds viewport geometry cases, drag/wheel/no-spend checks and 844×390 map/casino screenshots with a real launch after resizing. Existing paid-drop restore, purchase locking and gameplay scenarios remain required.

Browser validation exposed idle clock lag on the software renderer: Phaser smoothDelta clamps slow frames during startup, so 3 real seconds no longer meant one idle game minute. Map and idle casino now consume loop.rawDelta; the activity coordinator resets that delta before waking the loop, excluding background/advertising/orientation pauses. Paid cascade timing remains fixed-tick based and unchanged. The static room is baked into one texture per viewport size.

The painted cabinet plus room are composited once into the canvas CSS backdrop on entry/resize. The transparent WebGL foreground retains the board and interface; this avoids shading static full-screen art during every paid physics tick on software renderers. Other scene entry clears the backdrop, and pending-map art covers it while balls continue.

## Context and visit results follow-up

Advances E16/T056–T057: map captions show effective food prices (including event modifiers), shower price and free recovery options. The existing single need highlight now explains hunger, low energy, smell or low happiness beside its destination. Work lock copy points to sleep or shower instead of naming only the missing resource/status.

Casino shows a compact net total for completed drops during the current visit. Tap reveals stakes and payouts; pending drops are excluded until settled. This is transient presentation: resets on scene re-entry/reload, includes restored drops when they complete, excludes upgrade purchases and Barry payments. It is not lifetime profit or a change to saved economic state.

Local verification: 371 tests passed, Pages build passed. Tests cover event-adjusted map prices and single-need priority without state mutation. Browser/deployment verification is recorded by the commit's Pages workflow. No physics/config/economy changes.
