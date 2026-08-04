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

function gateReachable(level) {
  return E.royalsCanReachGate(level, E.initState(level));
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

  if (!gateReachable(level)) {
    console.log(`L${def.id} ${def.title}: gate is walled off from a royal`);
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

  /* Can the royals simply walk it alone? If so the level teaches nothing. */
  const royalIds = new Set(
    level.pieces.filter((p) => E.isRoyal(p)).map((p) => p.id)
  );
  const soloIds = new Set(res.path.map((m) => m.id));
  const kingOnly = [...soloIds].every((id) => royalIds.has(id));

  rows.push({
    ch: level.chapter,
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

console.log('\n  ch  lvl  capacity  optimal  three  two   kingOnly  start   states     ms   title');
for (const r of rows) {
  const parOk = r.par && r.par.three === r.moves ? ' ' : '*';
  console.log(
    `  ${String(r.ch).padStart(2)}  ${String(r.id).padStart(3)}  ${String(r.cap).padStart(8)}  ` +
    `${String(r.moves).padStart(7)}${parOk} ${String(r.par?.three ?? '-').padStart(5)} ` +
    `${String(r.par?.two ?? '-').padStart(4)}   ${r.kingOnly ? 'YES ' : 'no  '}     ` +
    `${r.startRatio.toFixed(2).padStart(5)}  ${String(r.states).padStart(7)}  ` +
    `${String(r.ms).padStart(5)}  ${r.title}`
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
