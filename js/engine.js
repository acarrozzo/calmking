/* Calm King — deterministic puzzle engine.
 * Pure logic: no DOM, no timers, no randomness.
 * Attaches to globalThis.CK.engine so it works as a plain <script> and inside Node (vm).
 */
(function (root) {
  'use strict';

  var GRID = 7;

  /* ---------------------------------------------------------------- pieces */

  var TYPES = {
    king:   { w: 2, movable: true,  rolls: false, name: 'King',    cls: 'medium' },
    queen:  { w: 1, movable: true,  rolls: false, name: 'Queen',   cls: 'light'  },
    barrel: { w: 1, movable: true,  rolls: false, name: 'Barrel',  cls: 'light'  },
    marble: { w: 1, movable: true,  rolls: true,  name: 'Marble',  cls: 'light'  },
    stone:  { w: 2, movable: true,  rolls: false, name: 'Stone',   cls: 'medium' },
    iron:   { w: 4, movable: true,  rolls: false, name: 'Iron',    cls: 'heavy'  },
    statue: { w: 3, movable: false, rolls: false, name: 'Statue',  cls: 'fixed'  }
  };

  /* Royals are the pieces the level is about: every one of them has to be
   * standing at the gate before it counts, and stranding any one of them
   * loses. They are also the only pieces allowed to share the gate tile. */
  var ROYAL = { king: true, queen: true };
  function isRoyal(p) { return !!ROYAL[p.type]; }

  function typeOf(p) { return TYPES[p.type] || TYPES.stone; }
  function weightOf(p) { return p.w == null ? typeOf(p).w : p.w; }
  function movableP(p) { return p.movable == null ? typeOf(p).movable : p.movable; }
  function rollsP(p) { return p.rolls == null ? typeOf(p).rolls : p.rolls; }

  /* --------------------------------------------------------------- balance */

  /* |ratio| thresholds. Anything at or past 1 has tipped over. */
  var ZONES = [
    { key: 'stable',   max: 0.34, label: 'Steady'   },
    { key: 'leaning',  max: 0.68, label: 'Leaning'  },
    { key: 'warning',  max: 0.88, label: 'Careful…' },
    { key: 'critical', max: 1.00, label: 'Critical' },
    { key: 'tipped',   max: Infinity, label: 'Tipped' }
  ];

  var SLIDE_ROLL = 0.68;  /* marbles start rolling once the board really leans */
  var SLIDE_SLICK = 0.34; /* anything standing on ice slides much sooner       */

  function zoneOf(ratio) {
    var a = Math.abs(ratio);
    for (var i = 0; i < ZONES.length; i++) if (a < ZONES[i].max) return ZONES[i];
    return ZONES[ZONES.length - 1];
  }

  /* ----------------------------------------------------------------- level */

  /* One entry per legal map character. See js/levels.js for the legend. */
  var CHARS = {
    '.': { t: 'floor'   },
    'E': { t: 'floor'   },
    '#': { t: 'wall'    },
    'o': { t: 'cradle'  },
    '~': { t: 'slick'   },
    'x': { t: 'fragile' },
    'd': { t: 'door'    },
    'A': { t: 'pin'     },
    '1': { t: 'plate', need: 1 },
    '2': { t: 'plate', need: 2 },
    '4': { t: 'plate', need: 4 },
    '>': { t: 'oneway', dc:  1, dr:  0 },
    '<': { t: 'oneway', dc: -1, dr:  0 },
    '^': { t: 'oneway', dc:  0, dr: -1 },
    'v': { t: 'oneway', dc:  0, dr:  1 }
  };

  function buildLevel(def) {
    var cells = [], exit = null, plates = [], doors = [], fragiles = [], pins = [], r, c;

    for (r = 0; r < GRID; r++) {
      var row = [];
      for (c = 0; c < GRID; c++) {
        var ch = def.map[r][c];
        var spec = CHARS[ch];
        if (!spec) throw new Error('Level ' + def.id + ': bad map char "' + ch + '"');

        var cell = { t: spec.t };
        if (spec.need != null) cell.need = spec.need;
        if (spec.dc != null) { cell.dc = spec.dc; cell.dr = spec.dr; }
        row.push(cell);

        if (ch === 'E') exit = { col: c, row: r };
        if (cell.t === 'plate') plates.push({ col: c, row: r, need: cell.need });
        if (cell.t === 'door') doors.push({ col: c, row: r });
        if (cell.t === 'fragile') fragiles.push({ col: c, row: r });
        if (cell.t === 'pin') pins.push({ col: c, row: r });
      }
      cells.push(row);
    }
    if (!exit) throw new Error('Level ' + def.id + ' has no exit');
    if (doors.length && !plates.length) {
      throw new Error('Level ' + def.id + ' has a door but no plate to open it');
    }

    var pieces = def.pieces.map(function (p, i) {
      var out = { id: p.id || (p.type[0] + i), type: p.type, col: p.col, row: p.row };
      if (p.w != null) out.w = p.w;
      if (p.movable != null) out.movable = p.movable;
      if (p.rolls != null) out.rolls = p.rolls;
      if (p.label) out.label = p.label;
      return out;
    });
    if (!pieces.some(function (p) { return p.type === 'king'; })) {
      throw new Error('Level ' + def.id + ' has no king');
    }

    return {
      id: def.id,
      chapter: def.chapter || 1,
      title: def.title,
      teach: def.teach || '',
      teachUntil: def.teachUntil || 'move',
      idea: def.idea || '',
      pivot: def.pivot == null ? 3 : def.pivot,
      capacity: def.capacity,
      par: def.par || null,
      cells: cells,
      exit: exit,
      plates: plates,
      doors: doors,
      fragiles: fragiles,
      pins: pins,
      pieces: pieces
    };
  }

  /* ----------------------------------------------------------------- state */

  function clonePieces(pieces) {
    var out = new Array(pieces.length);
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var q = { id: p.id, type: p.type, col: p.col, row: p.row };
      if (p.w != null) q.w = p.w;
      if (p.movable != null) q.movable = p.movable;
      if (p.rolls != null) q.rolls = p.rolls;
      if (p.label) q.label = p.label;
      out[i] = q;
    }
    return out;
  }

  function cloneBroken(broken) {
    var out = {};
    for (var k in broken) if (broken[k]) out[k] = true;
    return out;
  }

  function initState(level) {
    return { pieces: clonePieces(level.pieces), broken: {}, moves: 0, status: 'play' };
  }

  function byId(pieces, id) {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].id === id) return pieces[i];
    return null;
  }

  function piecesAt(pieces, c, r) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].col === c && pieces[i].row === r) out.push(pieces[i]);
    }
    return out;
  }

  function king(pieces) {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].type === 'king') return pieces[i];
    return null;
  }

  function royals(pieces) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) if (isRoyal(pieces[i])) out.push(pieces[i]);
    return out;
  }

  function allRoyal(list) {
    for (var i = 0; i < list.length; i++) if (!isRoyal(list[i])) return false;
    return true;
  }

  function atExit(level, p) {
    return p.col === level.exit.col && p.row === level.exit.row;
  }

  function isExit(level, c, r) {
    return level.exit.col === c && level.exit.row === r;
  }

  /* Every royal has to be standing at the gate at once. With one royal that
   * is exactly the old rule, so chapters I–III are untouched. */
  function allRoyalsHome(level, pieces) {
    var rs = royals(pieces);
    if (!rs.length) return false;
    for (var i = 0; i < rs.length; i++) if (!atExit(level, rs[i])) return false;
    return true;
  }

  /* Where the frame is hanging from right now.
   *
   * A pin tile takes the pivot while something is standing on it. Load two
   * pins in different columns and the frame has nowhere to choose between
   * them, so it swings back to the level's own post — which is the only way
   * some rooms can be levelled at all.
   *
   * Derived purely from where the pieces are, so it needs no history and
   * costs the solver no extra state. */
  function pivotOf(level, pieces) {
    if (!level.pins || !level.pins.length) return level.pivot;
    var col = -1;
    for (var i = 0; i < level.pins.length; i++) {
      var pin = level.pins[i];
      if (!piecesAt(pieces, pin.col, pin.row).length) continue;
      if (col >= 0 && col !== pin.col) return level.pivot;
      col = pin.col;
    }
    return col < 0 ? level.pivot : col;
  }

  function torqueOf(level, pieces) {
    var pivot = pivotOf(level, pieces), t = 0;
    for (var i = 0; i < pieces.length; i++) {
      t += weightOf(pieces[i]) * (pieces[i].col - pivot);
    }
    return t;
  }

  function ratioOf(level, pieces) {
    return torqueOf(level, pieces) / level.capacity;
  }

  function inBounds(c, r) { return c >= 0 && c < GRID && r >= 0 && r < GRID; }
  function cellAt(level, c, r) { return level.cells[r][c]; }
  function isWall(level, c, r) { return !inBounds(c, r) || level.cells[r][c].t === 'wall'; }

  /* --------------------------------------------------------- doors & floor */

  /* Every plate must carry the weight stamped on it, and then every door on
   * the board is up. One shared circuit — simple to read off the board. */
  function doorsOpen(level, pieces) {
    for (var i = 0; i < level.plates.length; i++) {
      var pl = level.plates[i], w = 0;
      var on = piecesAt(pieces, pl.col, pl.row);
      for (var j = 0; j < on.length; j++) w += weightOf(on[j]);
      if (w < pl.need) return false;
    }
    return true;
  }

  function plateLoad(level, pieces, pl) {
    var w = 0, on = piecesAt(pieces, pl.col, pl.row);
    for (var j = 0; j < on.length; j++) w += weightOf(on[j]);
    return w;
  }

  /* Can a tile be stepped onto at all, ignoring who is standing there and
   * ignoring doors (those depend on where everything ends up, so they are
   * checked against the finished arrangement instead). */
  function floorOpen(level, broken, c, r, dc, dr) {
    if (!inBounds(c, r)) return false;
    var cell = level.cells[r][c];
    if (cell.t === 'wall') return false;
    if (broken && broken[c + ',' + r]) return false;
    if (cell.t === 'oneway' && (cell.dc !== dc || cell.dr !== dr)) return false;
    return true;
  }

  /* A fragile tile gives way the moment the last piece steps off it. */
  function crumble(level, before, after, broken) {
    if (!level.fragiles.length) return broken;
    var out = null;
    for (var i = 0; i < level.fragiles.length; i++) {
      var f = level.fragiles[i], k = f.col + ',' + f.row;
      if (broken[k]) continue;
      if (!piecesAt(before, f.col, f.row).length) continue;
      if (piecesAt(after, f.col, f.row).length) continue;
      if (!out) out = cloneBroken(broken);
      out[k] = true;
    }
    return out || broken;
  }

  /* ---------------------------------------------------------------- moving */

  /* Walk the push chain. Returns the new piece array, or null if blocked.
   * Rules:
   *   - walls, holes, off-board and one-way tiles taken backwards stop everything
   *   - an immovable piece stops everything
   *   - a CRADLE tile accepts a piece on top of whatever is already there
   *   - any other occupied tile pushes its occupants one further along
   *   - a gate has to be up in the *resulting* position for anyone to end under it
   */
  function planMove(level, state, id, dc, dr) {
    var pieces = state.pieces, broken = state.broken;
    var mover = byId(pieces, id);
    if (!mover || !movableP(mover)) return null;
    if ((dc === 0) === (dr === 0)) return null;

    var moving = [id];
    var arriving = [mover];   /* whoever ends up on the tile under inspection */
    var c = mover.col + dc, r = mover.row + dr;
    var guard = 0;

    while (true) {
      if (guard++ > GRID) return null;
      if (!floorOpen(level, broken, c, r, dc, dr)) return null;

      var occ = [], all = piecesAt(pieces, c, r);
      for (var i = 0; i < all.length; i++) {
        if (moving.indexOf(all[i].id) < 0) occ.push(all[i]);
      }
      if (!occ.length) break;
      for (var j = 0; j < occ.length; j++) if (!movableP(occ[j])) return null;
      if (cellAt(level, c, r).t === 'cradle') break; /* share the tile */
      /* The gate holds the royal family and nobody else, so the second one
       * home joins the first instead of shoving them back out of it. */
      if (isExit(level, c, r) && allRoyal(arriving) && allRoyal(occ)) break;

      for (var k = 0; k < occ.length; k++) moving.push(occ[k].id);
      arriving = occ;
      c += dc; r += dr;
    }

    var next = clonePieces(pieces);
    for (var m = 0; m < moving.length; m++) {
      var p = byId(next, moving[m]);
      p.col += dc; p.row += dr;
    }

    if (level.doors.length) {
      var underGate = false;
      for (var n = 0; n < moving.length; n++) {
        var q = byId(next, moving[n]);
        if (cellAt(level, q.col, q.row).t === 'door') underGate = true;
      }
      /* Leaving a doorway is always allowed; only arriving needs the gate up. */
      if (underGate && !doorsOpen(level, next)) return null;
    }
    return next;
  }

  function pushedBy(level, state, id, dc, dr) {
    /* which pieces (other than the mover) this move would shove */
    var before = state.pieces, after = planMove(level, state, id, dc, dr);
    if (!after) return null;
    var out = [];
    for (var i = 0; i < before.length; i++) {
      if (before[i].id === id) continue;
      var a = byId(after, before[i].id);
      if (a.col !== before[i].col || a.row !== before[i].row) out.push(before[i].id);
    }
    return out;
  }

  var DIRS = [
    { dc: 0, dr: -1, key: 'up' },
    { dc: 1, dr: 0, key: 'right' },
    { dc: 0, dr: 1, key: 'down' },
    { dc: -1, dr: 0, key: 'left' }
  ];

  function legalMoves(level, state, id) {
    var out = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      var after = planMove(level, state, id, d.dc, d.dr);
      if (!after) continue;
      var self = byId(state.pieces, id);
      var willBreak = crumble(level, state.pieces, after, state.broken) !== state.broken;
      out.push({
        dc: d.dc, dr: d.dr, key: d.key,
        col: self.col + d.dc, row: self.row + d.dr,
        pushes: pushedBy(level, state, id, d.dc, d.dr),
        breaks: willBreak,
        ratio: ratioOf(level, after)
      });
    }
    return out;
  }

  /* -------------------------------------------------------------- settling */

  function slidesNow(level, broken, p, absRatio) {
    if (!movableP(p)) return false;
    var t = cellAt(level, p.col, p.row).t;
    if (t === 'cradle') return false;            /* a cradle catches things */
    if (t === 'slick') return absRatio >= SLIDE_SLICK;
    return rollsP(p) && absRatio >= SLIDE_ROLL;
  }

  /* Everything that can slide rolls downhill one tile at a time until the
   * board is calm enough or nothing can move. Fully deterministic. */
  function settle(level, pieces, broken) {
    var frames = [], guard = 0;
    while (guard++ < 24) {
      var ratio = ratioOf(level, pieces);
      if (Math.abs(ratio) < SLIDE_SLICK) break;
      var dir = ratio > 0 ? 1 : -1;

      var movers = [];
      for (var i = 0; i < pieces.length; i++) {
        if (slidesNow(level, broken, pieces[i], Math.abs(ratio))) movers.push(pieces[i]);
      }
      if (!movers.length) break;
      /* resolve the downhill-most piece first so trains of pieces slide cleanly */
      movers.sort(function (a, b) { return (b.col - a.col) * dir; });

      var gatesUp = doorsOpen(level, pieces);
      var next = clonePieces(pieces), moved = false;
      for (var m = 0; m < movers.length; m++) {
        var p = byId(next, movers[m].id);
        var nc = p.col + dir;
        if (!floorOpen(level, broken, nc, p.row, dir, 0)) continue;
        if (cellAt(level, nc, p.row).t === 'door' && !gatesUp) continue;
        if (piecesAt(next, nc, p.row).length) continue;
        p.col = nc;
        moved = true;
      }
      if (!moved) break;
      broken = crumble(level, pieces, next, broken);
      pieces = next;
      frames.push({ pieces: clonePieces(pieces), broken: cloneBroken(broken) });
    }
    return { pieces: pieces, broken: broken, frames: frames };
  }

  /* ------------------------------------------------------------- dead ends */

  /* Generous reachability: pieces are assumed movable out of the way and every
   * gate assumed openable, so a false alarm is impossible. If a royal cannot
   * reach the gate even under those assumptions, the level really is lost —
   * which one-way ledges and crumbling floors make possible. */
  function canReachGate(level, broken, from) {
    var seen = {}, queue = [[from.col, from.row]];
    seen[from.col + ',' + from.row] = true;
    while (queue.length) {
      var at = queue.shift(), c = at[0], r = at[1];
      if (c === level.exit.col && r === level.exit.row) return true;
      for (var i = 0; i < DIRS.length; i++) {
        var d = DIRS[i], nc = c + d.dc, nr = r + d.dr;
        if (!floorOpen(level, broken, nc, nr, d.dc, d.dr)) continue;
        var key = nc + ',' + nr;
        if (seen[key]) continue;
        seen[key] = true;
        queue.push([nc, nr]);
      }
    }
    return false;
  }

  /* Strand any one of them and the level is over, so the Queen walking herself
   * into a dead end loses just as surely as the King doing it. */
  function royalsCanReachGate(level, state) {
    var rs = royals(state.pieces);
    if (!rs.length) return false;
    for (var i = 0; i < rs.length; i++) {
      if (!canReachGate(level, state.broken, rs[i])) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ turn */

  function frameOf(level, pieces, broken, kind) {
    var t = torqueOf(level, pieces);
    var ratio = t / level.capacity;
    return {
      kind: kind,
      pieces: clonePieces(pieces),
      broken: cloneBroken(broken),
      gates: doorsOpen(level, pieces),
      pivot: pivotOf(level, pieces),
      torque: t,
      ratio: ratio,
      zone: zoneOf(ratio).key
    };
  }

  /* Play one full turn. Returns { ok, frames, state }. `frames` is the
   * animation script: one board snapshot per visible sub-step. */
  function step(level, state, id, dc, dr) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    var after = planMove(level, state, id, dc, dr);
    if (!after) return { ok: false, reason: 'blocked' };

    var broken = crumble(level, state.pieces, after, state.broken);
    var frames = [frameOf(level, after, broken, 'move')];

    var s = settle(level, after, broken);
    for (var i = 0; i < s.frames.length; i++) {
      frames.push(frameOf(level, s.frames[i].pieces, s.frames[i].broken, 'slide'));
    }

    var pieces = s.pieces;
    broken = s.broken;
    var ratio = ratioOf(level, pieces);
    var next = { pieces: pieces, broken: broken, moves: state.moves + 1, status: 'play' };

    /* The royals have to arrive on a board that is still standing, so a tip
     * beats a gate landing. Anything else would make the last move of a
     * tight level a coin flip between two rules. */
    if (Math.abs(ratio) >= 1) next.status = 'tipped';
    else if (allRoyalsHome(level, pieces)) next.status = 'won';
    else if (!royalsCanReachGate(level, next)) next.status = 'stranded';

    frames[frames.length - 1].status = next.status;
    return { ok: true, frames: frames, state: next };
  }

  /* --------------------------------------------------------------- solving */

  function keyOf(pieces, broken) {
    var parts = [];
    for (var i = 0; i < pieces.length; i++) {
      parts.push(pieces[i].id + ':' + pieces[i].col + ',' + pieces[i].row);
    }
    parts.sort();
    var holes = [];
    for (var k in broken) if (broken[k]) holes.push(k);
    return parts.join('|') + (holes.length ? '#' + holes.sort().join('#') : '');
  }

  /* Breadth-first search for the shortest solution. Used by tools/verify.mjs
   * to prove every shipped level is solvable and to set the crown targets. */
  function solve(level, opts) {
    opts = opts || {};
    var limit = opts.limit || 600000;
    var start = initState(level);
    var seen = Object.create(null);
    var queue = [{ pieces: start.pieces, broken: start.broken, depth: 0, prev: null, move: null }];
    seen[keyOf(start.pieces, start.broken)] = true;
    var head = 0, visited = 0;

    while (head < queue.length && visited < limit) {
      var node = queue[head++];
      visited++;
      var here = { pieces: node.pieces, broken: node.broken, moves: node.depth, status: 'play' };

      for (var i = 0; i < node.pieces.length; i++) {
        var p = node.pieces[i];
        if (!movableP(p)) continue;
        for (var d = 0; d < DIRS.length; d++) {
          var res = step(level, here, p.id, DIRS[d].dc, DIRS[d].dr);
          if (!res.ok) continue;
          if (res.state.status === 'tipped' || res.state.status === 'stranded') continue;

          var child = {
            pieces: res.state.pieces, broken: res.state.broken,
            depth: node.depth + 1, prev: node, move: { id: p.id, dir: DIRS[d].key }
          };
          if (res.state.status === 'won') {
            var path = [], cur = child;
            while (cur && cur.move) { path.unshift(cur.move); cur = cur.prev; }
            return { solved: true, moves: child.depth, path: path, visited: visited };
          }
          var kk = keyOf(res.state.pieces, res.state.broken);
          if (seen[kk]) continue;
          seen[kk] = true;
          queue.push(child);
        }
      }
    }
    return { solved: false, visited: visited, exhausted: head >= queue.length };
  }

  root.CK = root.CK || {};
  root.CK.engine = {
    GRID: GRID, TYPES: TYPES, ZONES: ZONES, DIRS: DIRS, CHARS: CHARS,
    SLIDE_ROLL: SLIDE_ROLL, SLIDE_SLICK: SLIDE_SLICK,
    typeOf: typeOf, weightOf: weightOf, movableP: movableP, rollsP: rollsP,
    isRoyal: isRoyal,
    buildLevel: buildLevel, initState: initState,
    byId: byId, piecesAt: piecesAt, king: king, royals: royals,
    torqueOf: torqueOf, ratioOf: ratioOf, zoneOf: zoneOf, pivotOf: pivotOf,
    cellAt: cellAt, isWall: isWall, inBounds: inBounds, floorOpen: floorOpen,
    doorsOpen: doorsOpen, plateLoad: plateLoad, crumble: crumble,
    royalsCanReachGate: royalsCanReachGate, allRoyalsHome: allRoyalsHome,
    planMove: planMove, legalMoves: legalMoves, step: step,
    clonePieces: clonePieces, cloneBroken: cloneBroken, keyOf: keyOf, solve: solve
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
