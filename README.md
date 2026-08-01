# Calm King

A turn-based balance puzzle played on a maze that is balanced on a pivot.

Guide the King to the gate. Every piece on the board — the King included — has
weight, and every weight pulls on the frame according to how far it sits from
the centre. Move anything and the whole kingdom leans. Lean too far and it goes
over.

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
- **Marbles** roll downhill once the board leans hard. **Ice** lets anything
  standing on it slide much sooner.
- The King has to arrive at the gate on a board that is still standing. A tip
  on the final move is still a tip.
- Undo (`Z`) reverses a whole turn, including any sliding it caused. Restart is
  `R`. Nothing is timed and nothing is random.

## Controls

| | |
|---|---|
| Select a piece | click / tap it |
| Move | click a lit tile, drag toward it, or use arrow keys / WASD |
| Cycle pieces | `Tab` |
| Undo / Restart | `Z` / `R` |
| Levels | `Esc` |
| How to play | `H` — also on the title card and the `?` button in the HUD |

Selection stays on the piece you last moved, so a counterweight can be walked
several tiles without reselecting it.

Level III is where the game says out loud that *any* piece can be moved, not
just the King: its hint line stays on screen until you actually move something
else, and the other pieces glow on arrival until you have done that once.

## Layout

```
index.html          markup and overlays
css/style.css       everything visual, including the 3D board
js/engine.js        pure rules: balance, movement, pushing, sliding, solver
js/levels.js        the 13 handcrafted levels
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

| | Level | Idea |
|---|---|---|
| I | The Quiet Gate | Move, and watch the board answer |
| II | A Little Lean | Distance from the pivot changes the tilt |
| III | The Counterweight | The direct route tips it; move the stone first |
| IV | Farther Matters More | One barrel at the rim beats a statue near the centre |
| V | The Heavy Stone | The obstacle is the counterweight |
| VI | Share the Load | Two barrels in one cradle |
| VII | The Push | Shoving a piece that is going your way anyway |
| VIII | Back Before Forward | The gate is east; the only road runs west |
| IX | Edge of the Kingdom | Opens in the warning zone and stays there |
| X | The First Trial | Everything so far, in one chamber |
| XI | The Rolling Court | Secure the marble before the board leans |
| XII | Stone and Silence | Fixed statues; the iron only travels while the King holds the far side |
| XIII | The King's Long Walk | Cross the ice while the board is level |

## Accessibility

Weight is shown three ways at once — piece size, silhouette, and a row of pips
under each piece — so nothing depends on colour. Options cover sound, volume,
animation on/off, animation speed, board shake, and a high-contrast board.
`prefers-reduced-motion` is respected without touching the options.

Progress lives in `localStorage` under `calmking.v1` and can be erased from
Options.
