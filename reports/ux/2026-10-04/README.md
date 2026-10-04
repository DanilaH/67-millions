# Interface clarity pass

User-authorized UX revision; no economy, physics, scheduler or save-rule changes.

- Shared HUD on the city and casino: clock, cash, next Barry amount; detailed countdown only within three game hours or on tap. Main debt is a compact goal with an explanation on tap.
- Needs use readable bars with low-state labels. Tap retains exact values and adds recovery guidance. City locations gain short functional labels and a contextual highlight for low needs/smell.
- Casino bets display actual capped rouble amounts; the launch button keeps the amount even while launch is temporarily unavailable. Percent fractions and cash deductions are unchanged.
- Three compact upgrade rows, one-row scrolling using wheel or up/down controls, stable order, dedicated purchase buttons. Pending cascades get one neutral shared explanation instead of repeated red warnings.
- Results lead with stake-adjusted net outcome; gross payout and stake remain visible, and insurance remains explicitly included.
- Action panels narrow; one-action panels shrink vertically. Sleep shows wake time and projected need values. Tutorial copy follows the new purchase and bet controls.

Verification: unit assertions and browser scenario coordinates updated for the explicitly changed presentation contract. Browser checks still cover every upgrade row, no purchase on navigation/title/selection, single purchase, and active-cascade purchase locking. Full release evidence is the GitHub Actions run for this revision.

Deferred: animated need forecasts, targeted board-part upgrade highlights and richer building art interactions. No claim of user-tested UX or improved full-run pacing.
