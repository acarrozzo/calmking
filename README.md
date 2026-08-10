# Calm King

A turn-based balance puzzle played on a maze that is balanced on a pivot.

Guide the King to the gate. Every piece on the board — the King included — has
weight, and every weight pulls on the frame according to how far it sits from
the centre. Move anything and the whole kingdom leans. Lean too far and it goes
over.

Later on the road starts asking to be unlocked, and the King stops travelling alone.

## Running it

No build step, no dependencies. Open `index.html`.

```
open index.html                 # works straight off the filesystem
python3 -m http.server 8000     # or serve it, if you prefer
```

`index.html?level=7` jumps straight to a level, skipping the title card.

## Rules

- **A turn** is one piece moving one tile, orthogonally. You may move any
  movable piece, not just the King.
- **Balance** is `sum of (weight × distance from the pivot column)`. Each level
  has a capacity; reach it and the board tips. The meter shows Steady →
  Leaning → Careful → Critical before that happens.
- **Distance matters as much as weight.** A light barrel out at the rim holds
  as much as a heavy statue near the middle.
- **Pushing**: walk into a piece and it gets shoved along, and so does anything
  behind it. One move, several pieces. Statues never move.
- **Cradles** (the carved stone dishes) hold more than one piece at a time.
  Their weights add up, and a cradle will catch a rolling marble.
- **Marbles** roll downhill once the board leans hard. **Ice** only holds while
  the meter reads Steady — past that, whatever is on it goes downhill.
- **One-way ledges** (`> < ^ v`) may only be entered moving the way they point.
  Anything that crosses one is on that side for good.
- **Fragile floor** gives way the moment the last piece steps off it. Pushing a
  piece across keeps the tile alive, because someone is always standing on it.
- **Pressure plates** are stamped with the weight they need. While every plate
  on the board is loaded, every **portcullis** is up. A gate only has to be up
  at the moment you step under it.
- **Locked blocks** are walls with one answer. A **key** lies somewhere on the
  floor, weighing 1, and nothing on the board can shift it except the King or
  the Queen — walk one of them onto it and they pick it up. From then on the
  key rides with them, so its weight hangs off whichever column they are
  standing in. Walk into a locked block carrying one and the key is spent: the
  block becomes plain floor for good, the weight leaves the board, and they
  step through. A royal shoved into a block opens nothing.
- **The Queen** weighs 1, against the King's 2. She travels almost free and can
  hold almost nothing down. Both royals have to be standing at the gate before
  it counts, and the gate holds them both. Strand either one and the level ends.
- The royals have to arrive at the gate on a board that is still standing. A tip
  on the final move is still a tip.
- Undo (`Z`) reverses a whole turn — sliding, crumbling and all. Restart is `R`.
  Nothing is timed and nothing is random.
- Strand a royal with no route left to the gate and the level ends gently, the
  same as a tip.

## Controls

| | |
|---|---|
| Select a piece | click / tap it |
| Move | click a lit tile, drag toward it, or use arrow keys / WASD |
| Cycle pieces | `Tab` forward, `Shift`+`Tab` back |
| Undo / Restart | `Z` / `R` |
| Levels | `Esc` |
| How to play | `H` — also on the title card and the `?` button in the HUD |
| Settings | the gear at the top right of the HUD |

Below the board is a bar of buttons that is always available: **Undo** and
**Restart** stacked at the left, **Prev piece** and **Next piece** stacked at
the right. When the on-screen pad is on, a direction cross sits between them,
centred on the same line as the fulcrum — by default on touch screens, and
forced either way under Settings → On-screen controls. With the pad off the
two groups lie flat, so no button moves when you toggle it. Below roughly
540px the labels drop and every button becomes a square key.

The bar echoes whatever you do rather than only what you press on it: moving
by key, tile click or drag lights the matching direction, `Tab` and
`Shift`+`Tab` light Next and Prev piece, and `Z` / `R` light Undo and Restart.

Selection stays on the piece you last moved, so a counterweight can be walked
several tiles without reselecting it.

Level III is where the game says out loud that *any* piece can be moved, not
just the King: its hint line stays on screen until you actually move something
else, and the other pieces glow on arrival until you have done that once.

Pressing on during an animation snaps it to the end rather than dropping the
input, so quick play never loses a move.

## Layout

```
index.html          markup and overlays
css/style.css       everything visual, including the 3D board
js/engine.js        pure rules: balance, movement, pushing, sliding, solver
js/levels.js        the 50 handcrafted levels, in five chapters
js/render.js        board and piece rendering, tilt
js/audio.js         synthesised sound (no audio files)
js/ui.js            input, turn playback, progress, menus
tools/verify.mjs    proves every level is solvable
tools/path.mjs      prints the optimal solution for one level
```

`engine.js` has no DOM dependency, which is what lets the tools run it in Node.

## Verifying the levels

Every level is brute-forced before it ships. The three-crown target on each
level *is* the proven optimum — no guesswork.

```
node tools/verify.mjs           # builds, reachability, solvability, optimum vs par
node tools/verify.mjs --sweep   # which capacities are solvable, per level
node tools/path.mjs 12          # walk the optimal solution with the balance meter
```

`verify.mjs` exits non-zero if a level fails to build, starts already tipped,
has an unreachable gate, or has no solution.

## The levels

Fifty levels in five chapters. The number after each is its proven optimum —
the three-crown target.

**I · The Quiet Kingdom** — weight, distance, and a board that answers

| | Level | | Idea |
|---|---|---|---|
| I | The Quiet Gate | 4 | Move, and watch the board answer |
| II | A Little Lean | 7 | Distance from the pivot changes the tilt |
| III | The Counterweight | 6 | The direct route tips it; move the stone first |
| IV | Farther Matters More | 7 | One barrel at the rim beats a statue near the centre |
| V | The Heavy Stone | 10 | The obstacle is the counterweight |
| VI | Share the Load | 9 | Two barrels in one cradle |
| VII | The Push | 9 | Shoving a piece that is going your way anyway |
| VIII | Back Before Forward | 11 | The gate is east; the only road runs west |
| IX | Edge of the Kingdom | 13 | Opens in the warning zone and stays there |
| X | The First Trial | 9 | Everything so far, in one chamber |

**II · Loose Ground** — floors that slide, crumble, and only go one way

| | Level | | Idea |
|---|---|---|---|
| XI | The Rolling Court | 8 | Secure the marble before the board leans |
| XII | Stone and Silence | 15 | Statues never move; the iron travels only while the King holds the east |
| XIII | The King's Long Walk | 10 | Cross the ice while the board reads Steady |
| XIV | No Way Back | 11 | The short way east is one-way, so the iron walks the long way |
| XV | The Wrong Side | 7 | The stone is trapped behind a ledge; only the barrel can reach the rim |
| XVI | Thin Floors | 8 | Two travellers, opposite ways, exactly two crossings |
| XVII | Carry It With You | 8 | Push it and you cross together; send it ahead and the floor goes too |
| XVIII | The Long Way Round | 12 | The iron must walk the whole ring, shoving everything ahead of it |
| XIX | Steady Underfoot | 6 | Level the board before the first step onto ice |
| XX | The Second Trial | 12 | One ring, one crossing that crumbles, one marble that will not wait |

**III · The Locked Halls** — gates that want paying for

| | Level | | Idea |
|---|---|---|---|
| XXI | The Weighted Gate | 8 | The plate sits at the rim, so the gate is never free |
| XXII | Do Not Move That | 7 | The barrel is already doing its job |
| XXIII | The Iron Key | 15 | Only the iron is heavy enough, and the plate is where iron is worth nothing |
| XXIV | Heavy Enough | 19 | The near piece will never be heavy enough |
| XXV | The Short Hall | 7 | The gate only has to be up as you step under it |
| XXVI | Two Locks | 17 | Every plate must be loaded before anything opens |
| XXVII | One Trip Only | 16 | Whatever you send to that plate is never coming back |
| XXVIII | Across and Staying | 11 | The floor to the plate holds for one crossing |
| XXIX | Every Door Costs | 12 | A crumbling bridge east, a ledge west, a gate in between |
| XXX | The Whole Kingdom | 28 | Everything, in one room, with nothing to spare |

**IV · The Brass Keys** — blocks that only a royal hand can open

Every level here turns on a detour: the key is never on the way, and nobody
else can go and fetch it. The rooms are wide and busy — four pieces to shift
rather than two — so the work is holding the whole board in your head at once.

| | Level | | Idea |
|---|---|---|---|
| XXXI | The Key and the Block | 10 | The key is behind you and the gate is in front |
| XXXII | The Wide Mouth | 11 | It opens as it falls away south, and everything rolls that way |
| XXXIII | The Gate Behind You | 11 | Home is west; everything you know about leaning is backwards |
| XXXIV | The Narrows | 12 | Two broad halls, one pinched waist, four things to shift |
| XXXV | The Neck | 14 | The room narrows to one cold tile, and you come back heavier |
| XXXVI | Among the Pillars | 14 | Two cradles, one marble, and a block that wants your hands full |
| XXXVII | The Four Arms | 15 | The gate is up the north arm, the weight is out on the others |
| XXXVIII | Two Shores | 19 | The key is on the wrong shore and the bridge is the block |
| XXXIX | Between the Teeth | 21 | Whatever you leave standing in a tooth is staying there |
| XL | The Third Trial | 16 | A plate, a portcullis and a block, down shafts that never line up |

The move counts stop climbing here, and that is deliberate. A room with four
pieces in it is wider rather than longer: there is more to work out and fewer
moves to spend once you have. Level XL has exactly one best line through it and
some seven thousand slower ways to reach the same gate.

**V · The Queen's Road** — two crowns, one frame, one gate

Both royals have to be standing in the gate together. She weighs half what he
does, which makes her cheap to move and useless as a counterweight. The rooms
keep changing shape: a moat, a cave, a ladder of ice, a zigzag of one-way
ledges, four corner rooms, a gate in the north wall, and an inner keep.

| | Level | | Idea |
|---|---|---|---|
| XLI | The Queen | 15 | The gate holds them both, and wants both |
| XLII | Every Crown Costs | 14 | A plate, a portcullis, a block and one key, for two |
| XLIII | After You | 15 | The floor holds for one of them; decide early which |
| XLIV | The Long Slide | 16 | The ice delivers her; he is the hard part |
| XLV | Separate Roads | 17 | Both ledges drop, and neither comes back to help |
| XLVI | Two Crowns, One Frame | 18 | Whichever of them moves, the other one pays |
| XLVII | One Trip, Two Crowns | 19 | The gate is in the north wall and the marble leans that way |
| XLVIII | Her Weight in Nothing | 20 | The plate will not notice her standing on it |
| XLIX | Up the Shaft | 21 | One key between them, and only one can be carrying it |
| L | The Calm King | 13 | Everything the kingdom has, in the widest room it has |

## Accessibility

Weight is shown three ways at once — piece size, silhouette, and a row of pips
under each piece — so nothing depends on colour. Settings cover sound, volume,
animation on/off, animation speed, board shake, and a high-contrast board.
`prefers-reduced-motion` is respected without touching the settings.

Progress lives in `localStorage` under `calmking.v1` and can be erased from
Settings.

**Settings → Unlock every level** opens the whole map for playtesting without
touching recorded crowns or best scores, so you can jump straight to a level
and still switch back to check the real progression.
