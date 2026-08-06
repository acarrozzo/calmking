# CLAUDE.md

## Project

Calm King is a deterministic, turn-based balance puzzle for the browser. The player moves the King and other weighted pieces through a 7x7 maze balanced on a pivot. Each piece contributes torque according to its weight and horizontal distance from the pivot. Every royal — the King, and the Queen once she appears — must reach the gate without tipping the board.

Keep the project intentionally simple:

- Plain HTML, CSS, and JavaScript
- No build step, package manager, or runtime dependencies
- Ordered browser `<script>` tags rather than ES modules
- Node used only for level-analysis tools

Do not introduce frameworks, bundlers, TypeScript, transpilers, or third-party libraries unless explicitly requested.

## Run and verify

```sh
open index.html
python3 -m http.server 8000
```

Open a specific level with `index.html?level=7`.

After changing game rules, movement, level data, or solver behavior, run:

```sh
node tools/verify.mjs
```

Additional tools:

```sh
node tools/verify.mjs --sweep     # which capacities each level is still solvable at
node tools/path.mjs 12            # optimal route for level 12
node tools/path.mjs 12 6          # the same level re-solved at capacity 6
```

`verify.mjs` must pass. It checks level construction, 7x7 maps, initial balance, gate reachability, solvability, and that every `par.three` equals the solver-proven optimum. Never guess `par.three`.

## Repository map

```text
index.html          Markup, HUD, controls, menus, overlays, script order
css/style.css       All visuals, responsive behavior, and board presentation
js/engine.js        Pure deterministic rules and breadth-first solver
js/levels.js        Fifty handcrafted levels and the five chapter headings
js/audio.js         Synthesized sound effects
js/render.js        DOM rendering, tiles, pieces, animation, and tilt
js/ui.js            Input, turn playback, undo, progress, options, and menus
tools/verify.mjs    Validates and solves all levels
tools/path.mjs      Prints an optimal path for one level
README.md           Player-facing and contributor introduction
```

`README.md` covers some of the same ground for humans. Keep the two from contradicting each other when rules change.

## Architecture boundaries

### `js/engine.js` — authoritative rules

The engine must stay independent of the DOM, timers, animation, audio, storage, and browser input. It attaches to `globalThis.CK.engine` so it can run both in the browser and in Node's `vm` module.

Keep these responsibilities in the engine:

- Level construction and validation
- Piece types, movement, pushing, and stacking
- Torque, balance ratios, zones, and which column the frame currently hangs from
- Doors, plates, one-way ledges, fragile floors, ice, rolling, and pivot pins
- Which pieces count as royal, and what the royal party has to do to win
- Full-turn resolution and animation snapshots
- Win, tipped, and stranded outcomes
- State cloning, solver keys, and breadth-first solving

A move should be resolved through `engine.step(...)`. UI and rendering code must consume its result rather than reimplementing rules.

### `js/render.js` — presentation only

The renderer owns visible DOM but no authoritative game state. Keep board construction, piece DOM, tile states, selection indicators, tilt, hints, and transitions here.

Do not calculate legal moves, balance outcomes, or victory conditions in the renderer.

### `js/ui.js` — orchestration

The UI connects input, engine results, renderer, audio, animation playback, progress, menus, and `localStorage`.

Keep selection, undo history, controls, timers, tutorials, progression, crowns, options, and overlays here. Do not duplicate movement or balance rules.

### `js/levels.js` — declarative content

Every map is exactly 7 rows of 7 characters.

```text
.  floor       #  wall       E  gate (exit)   o  cradle
~  ice         x  fragile    d  portcullis    1/2/4  pressure plate
A  pivot pin   > < ^ v  one-way ledges
```

The engine cell type for `d` is `door`; prose in the game calls it a portcullis.

Common level fields are `id`, `chapter`, `title`, `teach`, `teachUntil`, `idea`, `pivot`, `capacity`, `map`, `pieces`, and `par`. Only `id`, `map`, `pieces`, and `capacity` really have to be right per level: `pivot` defaults to column 3, `chapter` to 1, and `teachUntil` to `move`.

`teachUntil` is a closed set, defined by `TEACH_DONE` in `js/ui.js`:

```text
move  other  push  stack  slide  oneway  break  gate  pin  royal
```

An unrecognised key silently falls back to `move`, so the teach line disappears after one move instead of erroring. Add the key to `TEACH_DONE` before using it in a level.

Chapter headings live in `CHAPTERS` at the foot of the file, one entry per chapter number used by the levels.

## Core invariants

### Determinism

There is no randomness. The same state and move must always produce the same result. Undo, animation playback, solver output, and verification depend on this.

### Pieces

Defined by `TYPES` in `js/engine.js`. The weights are load-bearing: pressure plates ask for 1, 2, or 4.

```text
type    weight  movable  rolls  notes
king       2      yes     no    royal; every level has one
queen      1      yes     no    royal; chapter V
barrel     1      yes     no
marble     1      yes     yes   rolls once the board really leans
stone      2      yes     no
iron       4      yes     no    the only piece that alone satisfies a 4-plate
statue     3      no      no    immovable; stops push chains
```

A level may override `w`, `movable`, or `rolls` per piece, but prefer plain types.

### Balance

```text
torque = sum(piece weight * (piece column - pivot column))
ratio  = torque / capacity
```

The board tips when `abs(ratio) >= 1`. Distance from the pivot matters as much as weight.

The pivot column is **not** fixed. `engine.pivotOf(level, pieces)` derives it from the current arrangement:

- No pin tiles on the map, or no pin occupied: the level's own `pivot`.
- Exactly one occupied pin column: the frame hangs from that column instead.
- Two or more occupied pins in different columns: the frame has nothing to choose between them and swings back to the level's `pivot`.

It is derived purely from piece positions, so it needs no state and costs the solver nothing. Anything computing torque must go through `pivotOf` rather than reading `level.pivot`.

### Turn order

A turn starts with one movable piece moving one orthogonal tile. It may push a chain. Then:

1. Vacated fragile floors may crumble.
2. Marbles and pieces on ice may slide downhill.
3. Sliding continues deterministically until settled.
4. Final balance and status are evaluated.

A tip takes precedence over reaching the gate on the same turn.

### Outcomes

`state.status` is one of `play`, `tipped`, `won`, or `stranded`, decided in that order at the end of every turn:

- `tipped` — `abs(ratio) >= 1`. Checked first, so a tip beats a gate landing.
- `won` — every royal is standing on the gate tile at once. With a lone King this is the old rule, so chapters I–IV are unaffected.
- `stranded` — some royal can no longer reach the gate. Reachability is deliberately generous: pieces are assumed pushable out of the way and every gate assumed openable, so a false alarm is impossible. Only one-way ledges and crumbled floors can actually trigger it. Stranding the Queen loses just as surely as stranding the King.

### Movement

- Only orthogonal movement is legal.
- Immovable pieces stop push chains.
- Cradles can hold multiple pieces.
- Occupied ordinary tiles continue a push chain.
- One-way ledges may only be entered in their indicated direction.
- Entering a portcullis requires all plates to be loaded in the resulting arrangement.
- Leaving a portcullis tile is always allowed.
- Royals may share the gate tile: a royal walking into a royal already home joins them rather than pushing them off. No other piece may share it, and a non-royal is pushed onward as usual.

### Sliding

- Marbles roll at the engine's rolling threshold.
- Any movable piece on ice slides at the lower slick threshold.
- Cradles catch sliding pieces.
- Downhill direction follows the sign of the board ratio.

### Undo and solver compatibility

Undo restores a whole turn, including pushes, slides, broken floors, selection, and status.

Any new stateful mechanic must be represented in:

- Engine state and cloning
- Solver state keys
- Turn resolution
- Undo snapshots
- Render snapshots when visually relevant

A browser-only rule the solver cannot reproduce is incomplete.

## Code style

Match the surrounding file instead of modernizing unrelated code.

Browser files use:

- IIFEs and `'use strict'`
- `var` and function declarations
- The shared `globalThis.CK` namespace
- Semicolons
- Small procedural helpers
- Section comments for navigation

Node tools use `.mjs` and modern JavaScript where useful.

Prefer small, targeted changes. Do not reformat or rewrite unrelated areas.

## Script order

The order in `index.html` is significant:

```html
<script src="js/engine.js"></script>
<script src="js/levels.js"></script>
<script src="js/audio.js"></script>
<script src="js/render.js"></script>
<script src="js/ui.js"></script>
```

Later scripts depend on namespaces created by earlier scripts.

## Level workflow

When adding or changing a level:

1. Keep the map exactly 7x7.
2. Include a King and a gate. Chapter V levels also need the Queen home.
3. Ensure the starting board is not tipped.
4. State the intended lesson in `idea` and, when useful, `teach`.
5. If you set `teachUntil`, use a key `TEACH_DONE` already knows.
6. Run `node tools/verify.mjs`.
7. Set `par.three` to the solver's optimum; `verify.mjs` fails until it matches.
8. Inspect the optimal route with `tools/path.mjs`.
9. Play manually and test undo.

A solvable level is not automatically a good level. Confirm that its natural or optimal solution demonstrates the intended concept rather than an accidental exploit.

## Accessibility and interaction

Preserve the current accessibility approach:

- Do not communicate weight through color alone.
- Keep size, silhouette, and weight pips meaningful.
- Preserve keyboard, pointer, drag, and touch controls.
- Give controls and pieces useful accessible labels.
- Respect reduced-motion and in-game motion settings.
- Keep high-contrast mode functional.
- Give new visual mechanics a non-color-only cue.

## Persistence

Progress is stored in `localStorage` under `calmking.v1`:

```text
{ v: 1, unlocked: <highest level reached>, best: { <levelId>: { moves, time, crowns } },
  learned: { <concept>: true },
  opts: { sound, volume, motion, shake, contrast, speed, pad, unlockAll } }
```

`loadStore` accepts a save only when `raw.v === 1` and otherwise starts a new game, so **bumping the version silently wipes every player's progress**. Prefer additive, backward-compatible fields, which the existing defaults merge already. If a version bump is genuinely needed, write a migration from the old shape first.

The “unlock every level” playtest option is a view over progression (`opts.unlockAll`), not a write to it. Keep it that way: it must not overwrite genuine progression or crown records.

## Before finishing

Use the relevant checks:

- Exercise the changed behavior in the browser.
- Test keyboard and pointer input.
- Test undo after the changed behavior.
- Test restart and level transitions.
- Check reduced-motion behavior when animation changes.
- Check touch and responsive layouts when UI changes.
- Run `node tools/verify.mjs` for rules or level changes.
- Confirm no accidental dependency or build requirement was added.
- Confirm `engine.js` remains free of DOM, timers, audio, storage, and randomness.

Favor changes that remain deterministic, legible, undoable, solver-reproducible, and consistent with the game's quiet tactile presentation.
