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
    barrel: { w: 1, movable: true,  rolls: false, name: 'Barrel',  cls: 'light'  },
    marble: { w: 1, movable: true,  rolls: true,  name: 'Marble',  cls: 'light'  },
    stone:  { w: 2, movable: true,  rolls: false, name: 'Stone',   cls: 'medium' },
    iron:   { w: 4, movable: true,  rolls: false, name: 'Iron',    cls: 'heavy'  },
    statue: { w: 3, movable: false, rolls: false, name: 'Statue',  cls: 'fixed'  }
  };

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

  var CHARS = { '.': 'floor', '#': 'wall', 'o': 'cradle', '~': 'slick', 'E': 'floor' };

  function buildLevel(def) {
    var cells = [], exit = null, r, c;
    for (r = 0; r < GRID; r++) {
      var row = [];
      for (c = 0; c < GRID; c++) {
        var ch = def.map[r][c];
        var t = CHARS[ch];
        if (t == null) throw new Error('Level ' + def.id + ': bad map char "' + ch + '"');
        row.push({ t: t });
        if (ch === 'E') exit = { col: c, row: r };
      }
      cells.push(row);
    }
    if (!exit) throw new Error('Level ' + def.id + ' has no exit');

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
      title: def.title,
      teach: def.teach || '',
      teachUntil: def.teachUntil || 'move',
      hint: def.hint || '',
      idea: def.idea || '',
      pivot: def.pivot == null ? 3 : def.pivot,
      capacity: def.capacity,
      par: def.par || null,
      cells: cells,
      exit: exit,
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

  function initState(level) {
    return { pieces: clonePieces(level.pieces), moves: 0, status: 'play' };
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

  function torqueOf(level, pieces) {
    var t = 0;
    for (var i = 0; i < pieces.length; i++) {
      t += weightOf(pieces[i]) * (pieces[i].col - level.pivot);
    }
    return t;
  }

  function ratioOf(level, pieces) {
    return torqueOf(level, pieces) / level.capacity;
  }

  function inBounds(c, r) { return c >= 0 && c < GRID && r >= 0 && r < GRID; }
  function cellAt(level, c, r) { return level.cells[r][c]; }
  function isWall(level, c, r) { return !inBounds(c, r) || level.cells[r][c].t === 'wall'; }

  /* ---------------------------------------------------------------- moving */

  /* Walk the push chain. Returns the new piece array, or null if blocked.
   * Rules:
   *   - walls and off-board stop everything
   *   - an immovable piece stops everything
   *   - a CRADLE tile accepts a piece on top of whatever is already there
   *   - any other occupied tile pushes its occupants one further along
   */
  function planMove(level, pieces, id, dc, dr) {
    var mover = byId(pieces, id);
    if (!mover || !movableP(mover)) return null;
    if ((dc === 0) === (dr === 0)) return null;

    var moving = [id];
    var c = mover.col + dc, r = mover.row + dr;
    var guard = 0;

    while (true) {
      if (guard++ > GRID) return null;
      if (isWall(level, c, r)) return null;

      var occ = [], all = piecesAt(pieces, c, r);
      for (var i = 0; i < all.length; i++) {
        if (moving.indexOf(all[i].id) < 0) occ.push(all[i]);
      }
      if (!occ.length) break;
      for (var j = 0; j < occ.length; j++) if (!movableP(occ[j])) return null;
      if (cellAt(level, c, r).t === 'cradle') break; /* share the tile */

      for (var k = 0; k < occ.length; k++) moving.push(occ[k].id);
      c += dc; r += dr;
    }

    var next = clonePieces(pieces);
    for (var m = 0; m < moving.length; m++) {
      var p = byId(next, moving[m]);
      p.col += dc; p.row += dr;
    }
    return next;
  }

  function pushedBy(level, pieces, id, dc, dr) {
    /* which pieces (other than the mover) this move would shove */
    var before = pieces, after = planMove(level, pieces, id, dc, dr);
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

  function legalMoves(level, pieces, id) {
    var out = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      var after = planMove(level, pieces, id, d.dc, d.dr);
      if (!after) continue;
      var self = byId(pieces, id);
      out.push({
        dc: d.dc, dr: d.dr, key: d.key,
        col: self.col + d.dc, row: self.row + d.dr,
        pushes: pushedBy(level, pieces, id, d.dc, d.dr),
        ratio: ratioOf(level, after)
      });
    }
    return out;
  }

  /* -------------------------------------------------------------- settling */

  function slidesNow(level, p, absRatio) {
    if (!movableP(p)) return false;
    var t = cellAt(level, p.col, p.row).t;
    if (t === 'cradle') return false;            /* a cradle catches things */
    if (t === 'slick') return absRatio >= SLIDE_SLICK;
    return rollsP(p) && absRatio >= SLIDE_ROLL;
  }

  /* Everything that can slide rolls downhill one tile at a time until the
   * board is calm enough or nothing can move. Fully deterministic. */
  function settle(level, pieces) {
    var frames = [], guard = 0;
    while (guard++ < 24) {
      var ratio = ratioOf(level, pieces);
      if (Math.abs(ratio) < SLIDE_SLICK) break;
      var dir = ratio > 0 ? 1 : -1;

      var movers = [];
      for (var i = 0; i < pieces.length; i++) {
        if (slidesNow(level, pieces[i], Math.abs(ratio))) movers.push(pieces[i]);
      }
      if (!movers.length) break;
      /* resolve the downhill-most piece first so trains of pieces slide cleanly */
      movers.sort(function (a, b) { return (b.col - a.col) * dir; });

      var next = clonePieces(pieces), moved = false;
      for (var m = 0; m < movers.length; m++) {
        var p = byId(next, movers[m].id);
        var nc = p.col + dir;
        if (isWall(level, nc, p.row)) continue;
        if (piecesAt(next, nc, p.row).length) continue;
        p.col = nc;
        moved = true;
      }
      if (!moved) break;
      pieces = next;
      frames.push(clonePieces(pieces));
    }
    return { pieces: pieces, frames: frames };
  }

  /* ------------------------------------------------------------------ turn */

  function frameOf(level, pieces, kind) {
    var t = torqueOf(level, pieces);
    var ratio = t / level.capacity;
    return {
      kind: kind,
      pieces: clonePieces(pieces),
      torque: t,
      ratio: ratio,
      zone: zoneOf(ratio).key
    };
  }

  /* Play one full turn. Returns { ok, frames, state }. `frames` is the
   * animation script: one board snapshot per visible sub-step. */
  function step(level, state, id, dc, dr) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    var after = planMove(level, state.pieces, id, dc, dr);
    if (!after) return { ok: false, reason: 'blocked' };

    var frames = [frameOf(level, after, 'move')];
    var s = settle(level, after);
    for (var i = 0; i < s.frames.length; i++) frames.push(frameOf(level, s.frames[i], 'slide'));

    var pieces = s.pieces;
    var ratio = ratioOf(level, pieces);
    var k = king(pieces);
    /* The King has to arrive on a board that is still standing, so a tip
     * beats a gate landing. Anything else would make the last move of a
     * tight level a coin flip between two rules. */
    var status = 'play';
    if (Math.abs(ratio) >= 1) status = 'tipped';
    else if (k.col === level.exit.col && k.row === level.exit.row) status = 'won';

    frames[frames.length - 1].status = status;
    return {
      ok: true,
      frames: frames,
      state: { pieces: pieces, moves: state.moves + 1, status: status }
    };
  }

  /* --------------------------------------------------------------- solving */

  function keyOf(pieces) {
    var parts = [];
    for (var i = 0; i < pieces.length; i++) {
      parts.push(pieces[i].id + ':' + pieces[i].col + ',' + pieces[i].row);
    }
    return parts.sort().join('|');
  }

  /* Breadth-first search for the shortest solution. Used by tools/verify.mjs
   * to prove every shipped level is solvable and to set the crown targets. */
  function solve(level, opts) {
    opts = opts || {};
    var limit = opts.limit || 400000;
    var start = initState(level);
    var seen = Object.create(null);
    var queue = [{ pieces: start.pieces, depth: 0, prev: null, move: null }];
    seen[keyOf(start.pieces)] = true;
    var head = 0, visited = 0;

    while (head < queue.length && visited < limit) {
      var node = queue[head++];
      visited++;
      for (var i = 0; i < node.pieces.length; i++) {
        var p = node.pieces[i];
        if (!movableP(p)) continue;
        for (var d = 0; d < DIRS.length; d++) {
          var res = step(level, { pieces: node.pieces, moves: node.depth, status: 'play' },
                         p.id, DIRS[d].dc, DIRS[d].dr);
          if (!res.ok) continue;
          if (res.state.status === 'tipped') continue;
          var kk = keyOf(res.state.pieces);
          var child = { pieces: res.state.pieces, depth: node.depth + 1, prev: node,
                        move: { id: p.id, dir: DIRS[d].key } };
          if (res.state.status === 'won') {
            var path = [], cur = child;
            while (cur && cur.move) { path.unshift(cur.move); cur = cur.prev; }
            return { solved: true, moves: child.depth, path: path, visited: visited };
          }
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
    GRID: GRID, TYPES: TYPES, ZONES: ZONES, DIRS: DIRS,
    SLIDE_ROLL: SLIDE_ROLL, SLIDE_SLICK: SLIDE_SLICK,
    typeOf: typeOf, weightOf: weightOf, movableP: movableP, rollsP: rollsP,
    buildLevel: buildLevel, initState: initState,
    byId: byId, piecesAt: piecesAt, king: king,
    torqueOf: torqueOf, ratioOf: ratioOf, zoneOf: zoneOf,
    cellAt: cellAt, isWall: isWall, inBounds: inBounds,
    planMove: planMove, legalMoves: legalMoves, step: step,
    clonePieces: clonePieces, keyOf: keyOf, solve: solve
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
