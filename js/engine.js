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
    statue: { w: 3, movable: false, rolls: false, name: 'Statue',  cls: 'fixed'  },
    /* The key is nobody's to shove. It lies where it was left until a royal
     * walks onto it, and from then on it rides with them — one more weight
     * hanging off whichever column they are standing in. */
    key:    { w: 1, movable: false, rolls: false, name: 'Key',     cls: 'light'  }
  };

  /* Royals are the pieces the level is about: every one of them has to be
   * standing at the gate before it counts, and stranding any one of them
   * loses. They are also the only pieces allowed to share the gate tile —
   * and the only ones who can carry a key. */
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
    'L': { t: 'lock'    },
    '1': { t: 'plate', need: 1 },
    '2': { t: 'plate', need: 2 },
    '4': { t: 'plate', need: 4 },
    '>': { t: 'oneway', dc:  1, dr:  0 },
    '<': { t: 'oneway', dc: -1, dr:  0 },
    '^': { t: 'oneway', dc:  0, dr: -1 },
    'v': { t: 'oneway', dc:  0, dr:  1 }
  };

  function buildLevel(def) {
    var cells = [], exit = null, plates = [], doors = [], fragiles = [], locks = [], r, c;

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
        if (cell.t === 'lock') locks.push({ col: c, row: r });
      }
      cells.push(row);
    }
    if (!exit) throw new Error('Level ' + def.id + ' has no exit');
    if (doors.length && !plates.length) {
      throw new Error('Level ' + def.id + ' has a door but no plate to open it');
    }

    var keys = def.pieces.filter(function (p) { return p.type === 'key'; }).length;
    if (locks.length && !keys) {
      throw new Error('Level ' + def.id + ' has a lock but no key to spend on it');
    }
    if (keys && !locks.length) {
      throw new Error('Level ' + def.id + ' has a key but nothing to unlock');
    }

    var pieces = def.pieces.map(function (p, i) {
      var out = { id: p.id || (p.type[0] + i), type: p.type, col: p.col, row: p.row };
      if (p.w != null) out.w = p.w;
      if (p.movable != null) out.movable = p.movable;
      if (p.rolls != null) out.rolls = p.rolls;
      if (p.label) out.label = p.label;
      if (p.held) out.held = p.held;
      return out;
    });
    if (!pieces.some(function (p) { return p.type === 'king'; })) {
      throw new Error('Level ' + def.id + ' has no king');
    }
    /* A level may hand a royal their key to begin with. Nobody else can hold
     * one, and the key starts wherever they are standing. */
    pieces.forEach(function (p) {
      if (!p.held) return;
      var by = byId(pieces, p.held);
      if (p.type !== 'key' || !by || !isRoyal(by)) {
        throw new Error('Level ' + def.id + ': only a royal can be holding a key');
      }
    });
    syncCarried(pieces);

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
      locks: locks,
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
      if (p.held) q.held = p.held;
      out[i] = q;
    }
    return out;
  }

  function cloneBroken(broken) {
    var out = {};
    for (var k in broken) if (broken[k]) out[k] = true;
    return out;
  }

  /* Opened locks are the same shape as broken floors: a set of "col,row". */
  function cloneOpened(opened) { return cloneBroken(opened); }

  function initState(level) {
    return {
      pieces: clonePieces(level.pieces),
      broken: {}, opened: {},
      moves: 0, status: 'play'
    };
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

  /* Who is standing on a tile in their own right. A carried key is riding on
   * its bearer rather than standing anywhere, so it is never in the way — but
   * it is still very much there for anything that weighs the tile, which is
   * why plates and torque go on using piecesAt. */
  function standingAt(pieces, c, r) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (p.held) continue;
      if (p.col === c && p.row === r) out.push(p);
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

  /* Which royal, if any, is carrying this key — and what a given royal has
   * in hand. A carried key has no position of its own, so its weight counts
   * from wherever its bearer is standing. */
  function keyHeldBy(pieces, id) {
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].type === 'key' && pieces[i].held === id) return pieces[i];
    }
    return null;
  }

  /* Put every carried key back on its bearer's tile. Called after anything
   * that moves pieces, so a key never drifts away from the hand holding it. */
  function syncCarried(pieces) {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (!p.held) continue;
      var by = byId(pieces, p.held);
      if (!by) { delete p.held; continue; }
      p.col = by.col;
      p.row = by.row;
    }
  }

  function torqueOf(level, pieces) {
    var pivot = level.pivot, t = 0;
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

  /* A lock is a wall with a keyhole: solid until it has been opened, plain
   * floor forever after. Like a portcullis it is not handled in floorOpen,
   * because whether you may enter depends on who you are and what you are
   * carrying, not on the tile alone. */
  function lockShut(level, opened, c, r) {
    return level.cells[r][c].t === 'lock' && !(opened && opened[c + ',' + r]);
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

  /* A loose key answers to one thing only: a royal with an empty hand walking
   * onto it. Anyone else finds it as immovable as a statue, and a royal who is
   * already carrying one has no hand free for a second. */
  function keyTaker(pieces, arriving, occ) {
    if (occ.length !== 1 || occ[0].type !== 'key' || occ[0].held) return null;
    for (var i = 0; i < arriving.length; i++) {
      if (isRoyal(arriving[i]) && !keyHeldBy(pieces, arriving[i].id)) return arriving[i];
    }
    return null;
  }

  /* Walk the push chain. Returns { pieces, opened }, or null if blocked.
   * Rules:
   *   - walls, holes, off-board and one-way tiles taken backwards stop everything
   *   - an immovable piece stops everything
   *   - a shut lock stops everything, unless the piece doing the walking is a
   *     royal with a key: they spend it and the tile is floor from then on
   *   - a loose key is collected by an arriving empty-handed royal
   *   - a CRADLE tile accepts a piece on top of whatever is already there
   *   - any other occupied tile pushes its occupants one further along
   *   - a gate has to be up in the *resulting* position for anyone to end under it
   */
  function planMove(level, state, id, dc, dr) {
    var pieces = state.pieces, broken = state.broken, opened = state.opened;
    var mover = byId(pieces, id);
    if (!mover || !movableP(mover)) return null;
    if ((dc === 0) === (dr === 0)) return null;

    var moving = [id];
    var arriving = [mover];   /* whoever ends up on the tile under inspection */
    var c = mover.col + dc, r = mover.row + dr;
    var guard = 0;
    var spend = null;         /* the lock this move opens, and on which key */
    var take = null;          /* the key this move collects, and who takes it */

    while (true) {
      if (guard++ > GRID) return null;
      if (!floorOpen(level, broken, c, r, dc, dr)) return null;

      /* Only the piece actually doing the walking can turn a key, so a lock
       * can never be opened by something shoved into it from behind. */
      if (lockShut(level, opened, c, r)) {
        if (guard > 1 || !isRoyal(mover)) return null;
        var carried = keyHeldBy(pieces, mover.id);
        if (!carried) return null;
        spend = { col: c, row: r, keyId: carried.id };
        break;
      }

      var occ = [], all = standingAt(pieces, c, r);
      for (var i = 0; i < all.length; i++) {
        if (moving.indexOf(all[i].id) < 0) occ.push(all[i]);
      }
      if (!occ.length) break;

      var taker = keyTaker(pieces, arriving, occ);
      if (taker) { take = { keyId: occ[0].id, by: taker.id }; break; }

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

    if (take) byId(next, take.keyId).held = take.by;

    var nextOpened = opened;
    if (spend) {
      nextOpened = cloneOpened(opened);
      nextOpened[spend.col + ',' + spend.row] = true;
      /* the key is left in the lock: its weight leaves the board with it */
      next = next.filter(function (p) { return p.id !== spend.keyId; });
    }
    syncCarried(next);

    if (level.doors.length) {
      var underGate = false;
      for (var n = 0; n < moving.length; n++) {
        var q = byId(next, moving[n]);
        if (cellAt(level, q.col, q.row).t === 'door') underGate = true;
      }
      /* Leaving a doorway is always allowed; only arriving needs the gate up. */
      if (underGate && !doorsOpen(level, next)) return null;
    }
    return { pieces: next, opened: nextOpened };
  }

  function pushedBy(level, state, id, dc, dr) {
    /* which pieces (other than the mover) this move would shove */
    var before = state.pieces, plan = planMove(level, state, id, dc, dr);
    if (!plan) return null;
    var out = [];
    for (var i = 0; i < before.length; i++) {
      if (before[i].id === id) continue;
      if (before[i].held) continue;          /* a key in hand is not a shove */
      var a = byId(plan.pieces, before[i].id);
      if (!a) continue;                      /* a key just spent on a lock */
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
      var plan = planMove(level, state, id, d.dc, d.dr);
      if (!plan) continue;
      var self = byId(state.pieces, id);
      var willBreak = crumble(level, state.pieces, plan.pieces, state.broken) !== state.broken;
      out.push({
        dc: d.dc, dr: d.dr, key: d.key,
        col: self.col + d.dc, row: self.row + d.dr,
        pushes: pushedBy(level, state, id, d.dc, d.dr),
        breaks: willBreak,
        opens: plan.opened !== state.opened,
        ratio: ratioOf(level, plan.pieces)
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
  function settle(level, pieces, broken, opened) {
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
        if (lockShut(level, opened, nc, p.row)) continue;
        if (cellAt(level, nc, p.row).t === 'door' && !gatesUp) continue;
        /* a bearer's key has not been put back on their new tile yet, and it
           would never have blocked anything anyway */
        if (standingAt(next, nc, p.row).length) continue;
        p.col = nc;
        moved = true;
      }
      if (!moved) break;
      syncCarried(next);
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

  function frameOf(level, pieces, broken, opened, kind) {
    var t = torqueOf(level, pieces);
    var ratio = t / level.capacity;
    return {
      kind: kind,
      pieces: clonePieces(pieces),
      broken: cloneBroken(broken),
      opened: cloneOpened(opened),
      gates: doorsOpen(level, pieces),
      torque: t,
      ratio: ratio,
      zone: zoneOf(ratio).key
    };
  }

  /* Play one full turn. Returns { ok, frames, state }. `frames` is the
   * animation script: one board snapshot per visible sub-step. */
  function step(level, state, id, dc, dr) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    var plan = planMove(level, state, id, dc, dr);
    if (!plan) return { ok: false, reason: 'blocked' };

    var opened = plan.opened;
    var broken = crumble(level, state.pieces, plan.pieces, state.broken);
    var frames = [frameOf(level, plan.pieces, broken, opened, 'move')];

    var s = settle(level, plan.pieces, broken, opened);
    for (var i = 0; i < s.frames.length; i++) {
      frames.push(frameOf(level, s.frames[i].pieces, s.frames[i].broken, opened, 'slide'));
    }

    var pieces = s.pieces;
    broken = s.broken;
    var ratio = ratioOf(level, pieces);
    var next = {
      pieces: pieces, broken: broken, opened: opened,
      moves: state.moves + 1, status: 'play'
    };

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

  function keyOf(pieces, broken, opened) {
    var parts = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      parts.push(p.id + ':' + p.col + ',' + p.row + (p.held ? '@' + p.held : ''));
    }
    parts.sort();
    var holes = [];
    for (var k in broken) if (broken[k]) holes.push(k);
    var open = [];
    for (var o in opened) if (opened[o]) open.push(o);
    return parts.join('|') +
           (holes.length ? '#' + holes.sort().join('#') : '') +
           (open.length ? '+' + open.sort().join('+') : '');
  }

  /* Breadth-first search for the shortest solution. Used by tools/verify.mjs
   * to prove every shipped level is solvable and to set the crown targets. */
  function solve(level, opts) {
    opts = opts || {};
    var limit = opts.limit || 600000;
    var start = initState(level);
    var seen = Object.create(null);
    var queue = [{
      pieces: start.pieces, broken: start.broken, opened: start.opened,
      depth: 0, prev: null, move: null
    }];
    seen[keyOf(start.pieces, start.broken, start.opened)] = true;
    var head = 0, visited = 0;

    while (head < queue.length && visited < limit) {
      var node = queue[head++];
      visited++;
      var here = {
        pieces: node.pieces, broken: node.broken, opened: node.opened,
        moves: node.depth, status: 'play'
      };

      for (var i = 0; i < node.pieces.length; i++) {
        var p = node.pieces[i];
        if (!movableP(p)) continue;
        for (var d = 0; d < DIRS.length; d++) {
          var res = step(level, here, p.id, DIRS[d].dc, DIRS[d].dr);
          if (!res.ok) continue;
          if (res.state.status === 'tipped' || res.state.status === 'stranded') continue;

          var child = {
            pieces: res.state.pieces, broken: res.state.broken, opened: res.state.opened,
            depth: node.depth + 1, prev: node, move: { id: p.id, dir: DIRS[d].key }
          };
          if (res.state.status === 'won') {
            var path = [], cur = child;
            while (cur && cur.move) { path.unshift(cur.move); cur = cur.prev; }
            return { solved: true, moves: child.depth, path: path, visited: visited };
          }
          var kk = keyOf(res.state.pieces, res.state.broken, res.state.opened);
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
    isRoyal: isRoyal, keyHeldBy: keyHeldBy,
    buildLevel: buildLevel, initState: initState,
    byId: byId, piecesAt: piecesAt, king: king, royals: royals,
    torqueOf: torqueOf, ratioOf: ratioOf, zoneOf: zoneOf,
    standingAt: standingAt,
    cellAt: cellAt, isWall: isWall, inBounds: inBounds, floorOpen: floorOpen,
    doorsOpen: doorsOpen, plateLoad: plateLoad, crumble: crumble, lockShut: lockShut,
    royalsCanReachGate: royalsCanReachGate, allRoyalsHome: allRoyalsHome,
    planMove: planMove, legalMoves: legalMoves, step: step,
    clonePieces: clonePieces, cloneBroken: cloneBroken, cloneOpened: cloneOpened,
    keyOf: keyOf, solve: solve
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
