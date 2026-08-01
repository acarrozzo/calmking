/* Print the optimal solution for one level, with the balance after each move.
 * Usage: node tools/path.mjs 5  [capacityOverride]
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

const id = Number(process.argv[2] || 1);
const capOverride = process.argv[3] ? Number(process.argv[3]) : null;
const def = globalThis.CK.LEVELS.find((l) => l.id === id);
if (!def) { console.log('no such level'); process.exit(1); }

const level = E.buildLevel(capOverride ? { ...def, capacity: capOverride } : def);
const res = E.solve(level);
if (!res.solved) { console.log('unsolvable at capacity ' + level.capacity); process.exit(1); }

const DIRV = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
let state = E.initState(level);

function show(label) {
  const grid = [];
  for (let r = 0; r < 7; r++) {
    let line = '';
    for (let c = 0; c < 7; c++) {
      const here = E.piecesAt(state.pieces, c, r);
      if (here.length > 1) line += String(here.length);
      else if (here.length === 1) line += here[0].id.toUpperCase();
      else if (E.isWall(level, c, r)) line += '#';
      else if (c === level.exit.col && r === level.exit.row) line += 'E';
      else line += E.cellAt(level, c, r).t === 'cradle' ? 'o'
                 : E.cellAt(level, c, r).t === 'slick' ? '~' : '.';
    }
    grid.push(line);
  }
  const ratio = E.ratioOf(level, state.pieces);
  const bar = '·'.repeat(10);
  const pos = Math.max(0, Math.min(20, Math.round((ratio + 1) * 10)));
  const meter = (bar + '|' + bar).slice(0, pos) + '#' + (bar + '|' + bar).slice(pos + 1);
  console.log(`${label.padEnd(16)} ${grid.join('  ')}  ${meter} ` +
              `${ratio.toFixed(2).padStart(6)}  ${E.zoneOf(ratio).key}`);
}

console.log(`\nL${id} ${def.title} — capacity ${level.capacity}, optimal ${res.moves} moves\n`);
show('start');
res.path.forEach((m, i) => {
  const [dc, dr] = DIRV[m.dir];
  const out = E.step(level, state, m.id, dc, dr);
  state = out.state;
  show(`${i + 1}. ${m.id} ${m.dir}`);
});
console.log(`\nfinal: ${state.status}\n`);
