# 67M — Visual Bible V1

**Status:** production direction for M5 / E18  
**Scope:** T061 visual language + key-art target  
**Gameplay authority:** none. This document does not change game rules, balance, timing, RNG, or progression.

This is the production visual source for **Map / Barry / Casino / UI / minigame presentation**.  
`ART_AUDIO_DIRECTION.md` remains the high-level art/audio intent; this file makes the visual side concrete enough to implement and review.

---

## 1. One-line target

**A hand-painted dirty cartoon about surviving debt in a cheap, worn-out city where every useful surface looks repaired, reused, stained, or improvised — but gameplay information stays extremely readable.**

The game should feel:
- poor but not grey mush;
- dirty but not visually noisy;
- funny but not childish;
- grotesque but not horror;
- tactile but not photorealistic;
- compact and legible on mobile landscape.

The visual joke is that every system takes itself seriously while the environment visibly does not.

---

## 2. Non-goals

Do not drift into:
- pixel art;
- glossy mobile-casino neon;
- cyberpunk purple/blue;
- clean corporate dashboard UI;
- cute toy-box cartoon;
- realistic grimdark;
- Soviet/real-country political parody;
- real marketplace branding;
- direct composition copies from references.

References define roles, not assets to imitate.

---

## 3. Core visual hierarchy

At any gameplay moment the eye should resolve in this order:

1. **Immediate obligation / interrupt** — Barry, Game Over, event choice.
2. **Money state** — cash, next Barry payment, principal 67M.
3. **Current interactive task** — work target, Plinko ball/board, choice button.
4. **Risk / needs** — HP and depleted needs.
5. **Secondary flavour** — grime, signage, decorative props, jokes.

If decoration competes with steps 1–4, decoration loses.

---

## 4. Palette

The world uses warm dirt + oxidized metal + stale paper.  
System-critical UI is allowed cleaner contrast than the environment.

### Base tokens

| Token | Hex | Use |
| --- | --- | --- |
| `ink.deep` | `#0D1012` | deepest background / silhouettes |
| `ink.panel` | `#171C20` | main UI panels |
| `ink.raised` | `#242B31` | cards / interactive rows |
| `line.dirty` | `#4A5358` | neutral outlines |
| `paper.old` | `#C8B98D` | worn labels / receipts |
| `text.main` | `#F1F0E8` | primary text |
| `text.muted` | `#A6ADB0` | secondary text |
| `rust` | `#9A563C` | danger-adjacent world accent |
| `mustard` | `#D0A74B` | money / reward / selected |
| `mold` | `#60735A` | recovery / safe success |
| `bruise` | `#66546E` | night / tired / low mood flavour |
| `warning` | `#C86755` | loss / low need / invalid |
| `good` | `#6F966D` | success / recovery |
| `cold` | `#66808A` | neutral machine / casino metal |

### Contrast rule

Text and gameplay labels must not rely on texture alone.  
Any text over painted art gets either:
- a solid/near-solid backing shape;
- a dark edge/shadow;
- or a deliberately quiet local background.

No distressed font treatment on small text.

---

## 5. Line, shape, and material language

### Lines

Hand-painted assets:
- outer contour: irregular, confident, slightly thick;
- interior detail: thinner and less contrasty;
- avoid uniform vector-perfect borders;
- silhouettes must survive downscaling before texture does.

UI:
- geometry can be clean enough for layout;
- edges should be slightly asymmetric through corner treatment, texture, taped labels, screws, torn-paper tabs, or imperfect inset borders;
- never distort interaction hit areas.

### Shape families

**Map**
- broad blocky silhouettes;
- crooked rectangles;
- patched roofs;
- signs attached at visibly bad angles;
- street paths simple enough to parse in one glance.

**Barry**
- large top-heavy silhouette;
- coat/jacket shapes with too-small accessories;
- one instantly readable face/gesture per state;
- must read from torso-up on mobile.

**Casino**
- industrial chute / pegboard / maintenance-machine language;
- metal, cheap bulbs, taped labels, painted numbers;
- progression makes it denser and more absurd, not cleaner.

### Materials

Primary:
- chipped painted metal;
- stained laminate;
- yellowed paper;
- cheap plastic;
- cracked tile;
- greasy glass;
- damp concrete;
- electrical tape;
- hand-painted signage.

Avoid:
- brushed luxury metal;
- pristine glassmorphism;
- high-end casino velvet/gold;
- sci-fi holograms.

---

## 6. Typography

Use system fonts at runtime until/unless a licensed production font is added.

### Runtime hierarchy

- **Money / timers / multipliers:** monospace or tabular-number capable font.
- **Headings / buttons:** bold system sans.
- **Body / explanations:** regular system sans.
- **Decorative signage:** baked into art only when it is non-critical flavour.

Critical player-facing copy must remain live text, not rasterized inside art.

### Case

- top-level labels / locations / interrupts: uppercase;
- descriptions: sentence case;
- money labels: uppercase key + tabular value;
- avoid all-caps paragraphs.

---

## 7. Main Map visual language

The map is not a geographic simulation. It is a **compact survival board**.

### Composition

- persistent HUD remains top + left;
- interactive city occupies the central/right field;
- 7 locations stay spatially stable;
- roads/paths are visual glue only;
- every location gets a distinct silhouette and one dominant material/accent.

### Location identity

| Location | Visual anchor | Dominant material | Accent |
| --- | --- | --- | --- |
| Подработки | loading bay + three job signs | corrugated metal | cold blue-grey |
| Закусочная | greasy lit window | tile + plastic menu | mustard |
| Комната | tiny lit window / mattress silhouette | peeling wall + cloth | bruise |
| Квартал отдыха | broken marquee / arcade glow | cheap plastic + poster paper | faded teal |
| Задний двор | bins, fence, puddle | wet concrete + rust | mold |
| Банный блок | pipes + steam icon | cracked tile | cold cyan-grey |
| Кривое казино | crooked Plinko marquee / machine tower | painted metal + bulbs | mustard + rust |

### Interaction states

Every location needs:
- idle;
- hover/focus;
- selected;
- disabled/locked.

State change must be readable without colour alone:
- outline weight;
- brightness/value shift;
- small motion or sign nudge;
- disabled state reduces saturation/contrast and input affordance.

No animated background elements that compete with Barry countdown or need warnings.

---

## 8. Barry visual language

Barry Wild is not a mascot and not a realistic gangster.

### Read

At first glance:
- annoying authority;
- cheap self-importance;
- physically present;
- slightly ridiculous;
- threatening because the rules are real, not because he is monstrous.

### Silhouette

Lock:
- broad upper body;
- narrow lower crop when used as bust;
- oversized coat/collar;
- small notebook/receipt/phone/clipboard prop;
- one strong hand gesture.

### Face

Lock:
- asymmetrical eyebrows/eyes;
- tired, unimpressed mouth;
- visible age/wear;
- avoid clown grin;
- avoid realistic celebrity resemblance.

### Required states

1. **Due / interrupt** — neutral-demanding, palm/receipt forward.
2. **Paid** — dismissive satisfaction, already turning away.
3. **Failed** — flat disappointment/authority, not gore or rage.
4. **Tutorial/reference** — neutral readable portrait.

### Barry panel

Barry interrupts may cover the world, but the payment number must remain the clearest object on screen.

Panel language:
- old invoice / warehouse notice;
- large due amount;
- cash-on-hand directly adjacent;
- one primary pay button;
- no decorative secondary actions.

---

## 9. Casino / Plinko visual language

The Plinko machine is the visual progression hero.

### Base machine

Start state should feel:
- functional but cheap;
- mostly empty;
- visibly repaired;
- slightly unsafe;
- still readable.

Base materials:
- painted dark metal;
- exposed screws;
- dirty clear cover;
- faded pocket labels;
- weak bulbs;
- taped maintenance notes.

### Pocket labels

Pocket multiplier text is authoritative gameplay UI.

Rules:
- high contrast;
- fixed baseline;
- no perspective distortion;
- values update immediately after upgrade;
- edge jackpots may gain framing/glow, but number remains primary.

### Special pin identity

Must remain distinct at full late-game density.

**Amplifier**
- visual motif: coil / transformer / hot filament;
- shape: ringed peg;
- accent: warm amber;
- cue: brief expansion/pulse.

**Return**
- visual motif: bent arrow / spring / rebound plate;
- shape: bracketed peg;
- accent: cold desaturated cyan;
- cue: directional snap upward.

**Splitter**
- visual motif: fork / Y-junction;
- shape: split cap;
- accent: dirty red-orange;
- cue: two-direction burst.

**Jackpot Bias**
- visible mechanical deflectors, not invisible probability magic;
- slightly cleaner metal than surrounding board so the added geometry reads;
- cumulative pairs must look physically installed.

**Insurance**
- not a physical trajectory element;
- represented as a stamped/tagged machine-state indicator near bet/result UI;
- when armed, visible before Drop commit;
- when applied, result UI shows the protection clearly.

### Progression principle

Upgrades should make the machine:
- denser;
- more modified;
- more valuable-looking in a cheap improvised way;
- more animated;
- more mechanically legible.

They should **not** turn it into a luxury casino machine.

---

## 10. Work minigame visual language

All three work games share:
- same dirty-city material family;
- one dominant interaction target;
- strong success/failure read;
- minimal decorative motion while input is active.

### Dishes

- enamel/cheap ceramic plates;
- brown/green grime;
- wet highlights;
- cleaned area should reveal a visibly brighter material;
- scrub cursor/brush radius readable but not laser-like.

### Trash

- dull bags with one warm held-state accent;
- target bin clearly larger/darker than background;
- accepted bag feedback: strong impact + disappear/settle;
- floor decoration must not look like draggable bags.

### Courier

- paper/map or street-sign feel rather than abstract vector puzzle;
- start green and finish cool-blue remain semantically distinct;
- obstacles read as world hazards, not generic red boxes;
- player route remains the brightest continuous line on screen.

---

## 11. UI chrome

UI should look like pieces collected from the world, but layout stays disciplined.

### Persistent HUD

- top strip = invoice/status rail;
- left needs column = meter board;
- cash / Barry / debt are three separate visual blocks even if sharing one rail;
- `67,000,000 ₽` principal gets a heavier frame than routine cash;
- low needs use icon/label + colour, never colour alone.

### Panels

Action/event/upgrade panels:
- dark physical substrate;
- local header strip;
- 1px/2px imperfect border;
- selected/affordable uses mustard;
- blocked uses warning rust;
- maxed uses muted stamped treatment.

### Buttons

Minimum mobile target:
- interactive visual height >= 44 logical px where layout allows;
- invisible hit area may be larger than painted shape;
- selected state cannot be only a 1px colour change.

---

## 12. Events visual language

Events are interruptions, not collectible cards.

Presentation:
- one compact illustrated vignette slot is allowed;
- event title + body + two choices remain dominant;
- choice A/B consequences are explicit text;
- unaffordable pay choice looks unavailable before tap.

Do not create a unique full-screen background for each event in V0.  
Reuse one event frame and swap small vignette/prop art where useful.

---

## 13. Needs / status visual language

Needs are not RPG stats; they are pressure gauges.

### HP
- hardest warning treatment;
- low HP may pulse slowly, never flash rapidly.

### Satiety
- dull warm food icon / meter.

### Energy
- cool electric/physical labour motif.

### Happiness
- bruised/muted emotional motif; avoid cute smiley-face UI.

### SMELLY
- dirty green-brown status tag;
- small stink-wave icon is acceptable;
- must be legible without animation.

---

## 14. Motion and juice

Motion supports state change.

Preferred:
- short overshoot on money gain;
- tiny panel thump on purchase;
- board element mechanical pop-in;
- payout count roll;
- pocket hit squash/flash;
- Barry panel hard cut/slam;
- success: one clean burst;
- failure: short sag/drop.

Avoid:
- constant floating;
- idle particle carpets;
- screen shake on routine actions;
- confetti except genuinely exceptional payout/victory;
- long blocking transitions.

### Duration bands

- micro feedback: 80–180 ms;
- normal UI transition: 160–260 ms;
- purchase/install: 250–450 ms;
- big payout/victory: may exceed 500 ms if input is not needlessly blocked.

---

## 15. Mobile readability rules

Target logical canvas remains 1280×720 landscape.

At mobile downscale:
- all critical text remains live and scalable;
- thin decorative lines may disappear without information loss;
- icons use simple silhouettes;
- no critical text baked below equivalent ~14 px runtime size;
- Plinko special elements need shape + colour distinction;
- late-game board must remain readable with legal 24-ball cap;
- action buttons keep forgiving hit areas;
- HUD may compress spacing before reducing numeric text size.

Visual review must include:
1. 1280×720 reference;
2. mobile landscape viewport;
3. max legal Plinko density;
4. low-need warning state;
5. Barry interrupt over busy screen;
6. event overlay over map.

---

## 16. Asset production contract

### Source masters

Every production raster asset must have:
- editable source/master provenance recorded;
- clean logical bounds;
- transparent background when composition requires it;
- no baked gameplay text unless explicitly decorative;
- no unexplained third-party material.

### Runtime formats

Canonical runtime id points to WebP fallback.  
Loader may resolve AVIF at boundary when supported.

Do not add PNG/JPEG runtime duplicates unless required for platform compatibility or tooling.

### Category matrix

| Category | Logical presentation | Source/master recommendation | DPR cap | Trim policy | Load class |
| --- | ---: | --- | ---: | --- | --- |
| Map background | 1006×520 region | >= 2012×1040 painted master | 2× | no trim | startup |
| Map location vignette | ~184×108 each | >= 368×216 | 2× | consistent logical frame | startup |
| Barry bust | ~420×430 max | >= 840×860 | 2× | shared logical frame across states | startup |
| Casino machine/backplate | ~900×560 | >= 1800×1120 | 2× | no trim | startup |
| Plinko special overlays | peg-scale | 2×/3× master | 2× runtime | consistent center anchor | deferred with casino |
| Work backgrounds | ~1080×525 | >= 2160×1050 | 2× | no trim | scene/session |
| Work interactables | variable | 2× master | 2× | logical frame preserved | scene/session |
| Event vignette | <= 220×140 | >= 440×280 | 2× | shared frame | deferred |
| UI texture slices | small repeatable | 2× master | 2× | 9-slice safe | startup |
| Key art | store/marketing only | >= 2560×1440 master | n/a | no trim | not runtime |

### Memory rule

Before merging production raster batches:
- inspect encoded size;
- estimate decoded RGBA footprint;
- avoid loading every scene's art at startup;
- preserve mobile headroom for Plinko physics/audio;
- measure before introducing stricter numeric budgets.

---

## 17. Key art composition lock

The final key art is a **marketing asset**, not a gameplay screenshot.

### Master composition

16:9 landscape master.

Foreground:
- player seen from 3/4 back or side, small enough that the world still matters;
- worn seller/work clothing;
- holding a cheap phone/receipt/bag.

Center:
- crooked Plinko machine dominates;
- one bright ball in motion;
- visible but readable special pins;
- a few money-number hints, not a UI screenshot.

Right/upper-right:
- Barry Wild leaning into frame or standing behind the machine with invoice/receipt;
- readable silhouette;
- expression: unimpressed ownership, not rage.

Background:
- compressed dirty city/warehouse/casino hybrid;
- hints of loading bay, greasy food window, trash yard;
- no real logos;
- no national flags or political iconography.

Text-safe zones:
- keep upper-left relatively quiet for title/logo treatment;
- keep lower corners usable for store/platform badges if later needed.

### Emotional read

The image should communicate in under two seconds:
**“I am broke, this machine might save me, and this unpleasant man wants money.”**

### Colour read

- environment: dark dirty neutral;
- Plinko / money: mustard warm focal light;
- Barry: rust/brown authority block;
- player: cooler/less saturated separation.

### Do not

- make Barry the protagonist;
- make the game look like a pure casino simulator;
- show luxury;
- imply real marketplace branding;
- use photorealistic currency;
- turn the player into a heroic action pose;
- make the image so dark that mobile store thumbnail loses the machine.

---

## 18. Key art deliverables

T061 visual direction is considered **fully done only when the actual painted key-art master exists and has been reviewed against this brief**.

Required final files when produced:
- editable source/master provenance;
- 2560×1440 or larger 16:9 master;
- clean exported WebP/JPEG marketing derivative as required by store pipeline;
- optional textless master preferred;
- thumbnail check at approximately 320 px wide.

Until those files exist, this document locks the target but does **not** claim the key-art bitmap is finished.

---

## 19. Review checklist

A visual change should be rejected if any answer is “no”:

- Does cash / next Barry / 67M remain immediately distinguishable?
- Is the interactive target clearer than the decoration?
- Does the style feel dirty, cheap, hand-painted, and adult rather than cute?
- Does it avoid real brands/politics?
- Does the mobile downscale preserve the intended read?
- Does Plinko progression remain physically legible?
- Are special pins distinguishable by shape as well as colour?
- Does Barry remain original and non-celebrity-like?
- Are important words/numbers still live UI text?
- Is the asset loading/memory cost appropriate for the scene?

---

## 20. Implementation order after T061

1. Build shared visual tokens / texture primitives.
2. Production Main Map + persistent HUD skin.
3. Barry production portrait/panel states.
4. Casino machine/backplate + special-pin art.
5. Work minigame environment/interactable pass.
6. Event frame/vignette pass.
7. Late-game Plinko readability pass.
8. Actual key-art master review/export.
