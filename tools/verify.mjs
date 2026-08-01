/* Proves every shipped level is solvable and reports the numbers used to set
 * crown targets. Run:  node tools/verify.mjs  [--sweep]
 *
 * --sweep also reports, for each level, which capacities are solvable. The
 * hardest interesting capacity is the smallest one that still has a solution.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

for (const f of ['js/engine.js', 'js/levels.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}

const E = globalThis.CK.engine;
const DEFS = globalThis.CK.LEVELS;
const sweep = process.argv.includes('--sweep');

function reachableTiles(level) {
  /* flood fill from the king so we can catch maps with an unreachable gate */
  const k = level.pieces.find((p) => p.type === 'king');
  const seen = new Set([k.col + ',' + k.row]);
  const q = [[k.col, k.row]];
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of E.DIRS) {
      const nc = c + d.dc, nr = r + d.dr;
      if (E.isWall(level, nc, nr)) continue;
      const key = nc + ',' + nr;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push([nc, nr]);
    }
  }
  return seen;
}

let bad = 0;
const rows = [];

for (const def of DEFS) {
  let level;
  try {
    level = E.buildLevel(def);
  } catch (err) {
    console.log(`L${def.id} ${def.title}: BUILD FAILED — ${err.message}`);
    bad++;
    continue;
  }

  for (const [i, row] of def.map.entries()) {
    if (row.length !== 7) {
      console.log(`L${def.id}: map row ${i} is ${row.length} chars, expected 7`);
      bad++;
    }
  }

  const reach = reachableTiles(level);
  if (!reach.has(level.exit.col + ',' + level.exit.row)) {
    console.log(`L${def.id} ${def.title}: gate is walled off from the King`);
    bad++;
  }

  const startRatio = E.ratioOf(level, level.pieces);
  if (Math.abs(startRatio) >= 1) {
    console.log(`L${def.id} ${def.title}: starts already tipped (${startRatio.toFixed(2)})`);
    bad++;
  }

  const t0 = Date.now();
  const res = E.solve(level);
  const ms = Date.now() - t0;

  if (!res.solved) {
    console.log(`L${def.id} ${def.title}: NO SOLUTION (${res.visited} states, ` +
                `${res.exhausted ? 'search exhausted' : 'hit the limit'})`);
    bad++;
    continue;
  }

  /* Can the King simply walk it alone? If so the level teaches nothing. */
  const soloIds = new Set(res.path.map((m) => m.id));
  const kingOnly = soloIds.size === 1 && soloIds.has('k');

  rows.push({
    id: def.id,
    title: def.title,
    cap: level.capacity,
    moves: res.moves,
    pieces: res.path.map((m) => m.id).join(''),
    states: res.visited,
    ms,
    kingOnly,
    startRatio,
    par: def.par
  });
}

console.log('\n  lvl  capacity  optimal  three  two   kingOnly  start   states   ms   title');
for (const r of rows) {
  const parOk = r.par && r.par.three === r.moves ? ' ' : '*';
  console.log(
    `  ${String(r.id).padStart(3)}  ${String(r.cap).padStart(8)}  ` +
    `${String(r.moves).padStart(7)}${parOk} ${String(r.par?.three ?? '-').padStart(5)} ` +
    `${String(r.par?.two ?? '-').padStart(4)}   ${r.kingOnly ? 'YES ' : 'no  '}     ` +
    `${r.startRatio.toFixed(2).padStart(5)}  ${String(r.states).padStart(7)}  ` +
    `${String(r.ms).padStart(4)}  ${r.title}`
  );
}
console.log('  (* = par.three does not match the optimal move count)\n');

if (sweep) {
  console.log('capacity sweep — smallest solvable capacity is the tightest puzzle\n');
  for (const def of DEFS) {
    const out = [];
    for (let cap = 2; cap <= 22; cap++) {
      const level = E.buildLevel({ ...def, capacity: cap });
      if (Math.abs(E.ratioOf(level, level.pieces)) >= 1) { out.push(`${cap}:tipped`); continue; }
      const r = E.solve(level, { limit: 200000 });
      out.push(`${cap}:${r.solved ? r.moves : 'x'}`);
    }
    console.log(`  L${String(def.id).padStart(2)}  ${def.title}`);
    console.log(`        ${out.join('  ')}`);
  }
  console.log('');
}

if (bad) {
  console.log(`${bad} problem(s) found.`);
  process.exit(1);
}
console.log('All levels build, are reachable, and have a solution.');
