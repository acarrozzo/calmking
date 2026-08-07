/* Calm King — glue. Input, turn playback, progress, menus. */
(function (root) {
  'use strict';

  var E = root.CK.engine, R = root.CK.render, A = root.CK.audio;
  var LEVELS = root.CK.LEVELS.map(E.buildLevel);
  var STORE_KEY = 'calmking.v1';

  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  ['app', 'board', 'rig', 'scene', 'stage', 'hud-num', 'hud-name', 'meter', 'meter-needle',
   'meter-label', 'stat-moves', 'stat-time', 'btn-levels',
   'teach', 'toast', 'ov-win', 'ov-fail', 'ov-levels', 'ov-options', 'ov-title',
   'win-crowns', 'win-title', 'win-moves', 'win-time', 'win-best', 'win-note',
   'win-replay', 'win-select', 'win-next', 'fail-title', 'fail-note', 'fail-undo',
   'fail-retry', 'level-grid', 'levels-close', 'btn-settings', 'options', 'options-close',
   'btn-wipe', 'total-crowns', 'title-play', 'title-levels',
   'btn-help', 'ov-help', 'help-close', 'title-help',
   'pad', 'pad-dir', 'pad-prev', 'pad-next', 'pad-undo', 'pad-restart'
  ].forEach(function (id) { el[id.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = $(id); });

  /* ---------------------------------------------------------- persistence */

  /* The two skins. Keys are the CSS class suffix and the render.js art set
     name, so nothing has to translate between them. */
  var PIECE_SETS = [
    { key: 'carved', name: 'Carved' },
    { key: 'token',  name: 'Token' }
  ];
  var BOARD_THEMES = [
    { key: 'parchment', name: 'Parchment' },
    { key: 'slate',     name: 'Slate' },
    { key: 'marquetry', name: 'Marquetry' },
    { key: 'marble',    name: 'Marble' },
    { key: 'ink',       name: 'Ink' }
  ];

  /* A saved skin that no longer exists falls back to the first one rather
     than leaving the board unstyled — retiring a set must not strand anyone
     who had it selected. */
  function optionKey(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return key;
    return list[0].key;
  }

  var DEFAULT_OPTS = { sound: true, volume: 0.7, motion: true, shake: true,
                       contrast: false, speed: 1, pad: null, unlockAll: false,
                       pieces: 'carved', board: 'parchment' };
  var store = loadStore();

  function loadStore() {
    var base = { v: 1, unlocked: 1, best: {}, learned: {}, opts: Object.assign({}, DEFAULT_OPTS) };
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && raw.v === 1) {
        base.unlocked = raw.unlocked || 1;
        base.best = raw.best || {};
        base.learned = raw.learned || {};
        base.opts = Object.assign({}, DEFAULT_OPTS, raw.opts || {});
      }
    } catch (e) { /* a corrupt save is just a new game */ }
    return base;
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ }
  }

  /* Coarse pointer with no hover is the standard touch signal. */
  function isTouch() {
    return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }
  function padVisible() {
    return store.opts.pad == null ? isTouch() : !!store.opts.pad;
  }

  function applyOpts() {
    var o = store.opts;
    el.app.classList.toggle('calm-motion', !o.motion);
    el.app.classList.toggle('no-shake', !o.shake);
    el.app.classList.toggle('contrast', !!o.contrast);
    document.documentElement.style.setProperty('--anim', (1 / o.speed).toFixed(3));
    A.setEnabled(o.sound);
    A.setVolume(o.volume);

    /* Only the direction half is optional. The action column carries undo and
       restart, so it stays whatever the setting says. */
    var pad = padVisible();
    el.padDir.hidden = !pad;
    el.pad.classList.toggle('no-dir', !pad);
    el.app.classList.toggle('has-pad', pad);

    applySkins();
  }

  /* The board theme is pure CSS; the piece set is the renderer's carving.
     Both are named on .app so the two stay in step. */
  function applySkins() {
    var pieces = optionKey(PIECE_SETS, store.opts.pieces);
    var board = optionKey(BOARD_THEMES, store.opts.board);

    PIECE_SETS.forEach(function (s) { el.app.classList.toggle('pieces-' + s.key, s.key === pieces); });
    BOARD_THEMES.forEach(function (s) { el.app.classList.toggle('board-' + s.key, s.key === board); });
    renderer.setPieceSet(pieces);
  }

  function setSkin(which, key) {
    store.opts[which] = key;
    applySkins();
    saveStore();
    if (!el.ovOptions.hidden) buildOptions();
  }

  /* Playtest switch: opens the whole map without touching recorded progress. */
  function unlockedAt(i) {
    return store.opts.unlockAll || i + 1 <= store.unlocked;
  }

  /* ---------------------------------------------------------------- state */

  var renderer = new R.Renderer(el.board, el.rig, el.scene);
  var g = {
    index: 0,
    level: null,
    gs: null,
    history: [],
    selected: null,
    busy: false,
    started: 0,
    elapsed: 0,
    ticking: false,
    lastZone: 'stable',
    lastMoved: null,
    did: {}
  };

  /* A level's teach line stays up until its idea has actually been shown, not
     merely until the player has touched something. */
  var TEACH_DONE = {
    move:  function () { return g.gs.moves > 0; },
    other: function () { return !!g.did.other; },
    push:  function () { return !!g.did.push; },
    stack: function () { return !!g.did.stack; },
    slide: function () { return !!g.did.slide; },
    oneway: function () { return !!g.did.oneway; },
    'break': function () { return !!g.did['break']; },
    gate: function () { return !!g.did.gate; },
    pin:  function () { return !!g.did.pin; },
    royal: function () { return !!g.did.royal; }
  };

  function refreshTeach() {
    if (!g.level.teach) { el.teach.classList.remove('show'); return; }
    var done = TEACH_DONE[g.level.teachUntil] || TEACH_DONE.move;
    el.teach.textContent = g.level.teach;
    el.teach.classList.toggle('show', !done());
  }
  var tickTimer = 0;

  function tileState() {
    return { broken: g.gs.broken, gates: E.doorsOpen(g.level, g.gs.pieces) };
  }

  function hasQueen() {
    return !!g.level && g.level.pieces.some(function (p) { return p.type === 'queen'; });
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function now() { return Date.now(); }

  function startClock() {
    g.started = now() - g.elapsed;
    g.ticking = true;
    clearInterval(tickTimer);
    tickTimer = setInterval(function () {
      if (!g.ticking) return;
      g.elapsed = now() - g.started;
      el.statTime.textContent = fmtTime(g.elapsed);
    }, 250);
  }
  function stopClock() {
    if (g.ticking) g.elapsed = now() - g.started;
    g.ticking = false;
    clearInterval(tickTimer);
  }

  /* ----------------------------------------------------------------- meter */

  function updateMeter(ratio, zoneKey) {
    var clamped = Math.max(-1.18, Math.min(1.18, ratio));
    var w = el.meter.clientWidth || 200;
    el.meterNeedle.style.transform = 'translateX(' + (clamped * (w / 2 - 3)).toFixed(1) + 'px)';
    el.meterLabel.textContent = zoneOf(zoneKey).label;
    el.meter.parentNode.className = 'hud-meter zone-' + zoneKey;
  }

  function zoneOf(key) {
    for (var i = 0; i < E.ZONES.length; i++) if (E.ZONES[i].key === key) return E.ZONES[i];
    return E.ZONES[0];
  }

  var toastTimer = 0;
  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = 'toast'; }, 1700);
  }

  /* ------------------------------------------------------------ level flow */

  function startLevel(index, keepTime) {
    g.index = Math.max(0, Math.min(LEVELS.length - 1, index));
    g.level = LEVELS[g.index];
    g.gs = E.initState(g.level);
    g.history = [];
    g.selected = null;
    g.busy = false;
    g.lastZone = 'stable';
    g.lastMoved = null;
    g.did = {};
    if (!keepTime) { g.elapsed = 0; }

    hideAll();
    renderer.resetTip();
    renderer.mount(g.level);
    renderer.draw(g.gs.pieces, Object.assign({ instant: true }, tileState()));
    var ratio = E.ratioOf(g.level, g.gs.pieces);
    renderer.setTilt(ratio, true);
    updateMeter(ratio, E.zoneOf(ratio).key);

    el.hudNum.textContent = 'Level ' + g.level.id;
    el.hudName.textContent = g.level.title;
    el.statMoves.textContent = '0';
    el.statTime.textContent = fmtTime(g.elapsed);
    el.padUndo.disabled = true;

    refreshTeach();

    /* auto-select the King so a first-time player has something obvious to move */
    select(E.king(g.gs.pieces).id, true);

    /* Until the player has moved something other than the King, the other
       pieces glow on arrival — the board itself has to say "these move too". */
    if (!store.learned.other) {
      renderer.hint(g.gs.pieces.filter(function (p) {
        return E.movableP(p) && p.type !== 'king';
      }).map(function (p) { return p.id; }));
    }
    startClock();
  }

  function select(id, quiet) {
    var p = E.byId(g.gs.pieces, id);
    if (!p || !E.movableP(p)) {
      if (p) { renderer.nudge(id); A.play('deny'); toast(E.typeOf(p).name + ' will not budge.'); }
      return;
    }
    g.selected = id;
    renderer.setSelection(id, E.legalMoves(g.level, g.gs, id));
    if (!quiet) A.play('select');
  }

  function deselect() {
    g.selected = null;
    renderer.setSelection(null, null);
  }

  function snapshot() {
    return {
      pieces: E.clonePieces(g.gs.pieces),
      broken: E.cloneBroken(g.gs.broken),
      moves: g.gs.moves,
      status: g.gs.status,
      selected: g.selected
    };
  }

  /* ------------------------------------------------------------ pad echo */

  /* Every input path funnels through tryMove, cycle, undo and restartLevel,
     so lighting the pad from inside them echoes the action however it was
     asked for — key, tile click, drag or the button itself. */
  var FLASH_MS = 170;

  function flash(node) {
    if (!node || node.disabled) return;
    node.classList.remove('lit');
    void node.offsetWidth;              /* restart the fade on a fast repeat */
    node.classList.add('lit');
    clearTimeout(node.ckFlash);
    node.ckFlash = setTimeout(function () { node.classList.remove('lit'); }, FLASH_MS);
  }

  /* Filled in beside the direction listeners below. */
  var DIR_BTN = {};

  /* Pressing on during a slide used to drop the keystroke on the floor. Snap
     the animation to its end instead, so a quick player never loses a move. */
  function tryMove(id, dc, dr) {
    flash(DIR_BTN[dc + ',' + dr]);
    if (g.busy) skipAnimation();
    if (g.busy || g.gs.status !== 'play') return;
    var res = E.step(g.level, g.gs, id, dc, dr);
    if (!res.ok) {
      renderer.nudge(id);
      A.play('deny');
      toast('Blocked.');
      return;
    }
    g.history.push(snapshot());
    if (g.history.length > 300) g.history.shift();
    el.padUndo.disabled = false;

    var moved = E.byId(g.gs.pieces, id);
    var sfx = A.forPiece(moved.type);
    var fromRatio = E.ratioOf(g.level, g.gs.pieces);
    var before = g.gs.pieces;

    if (moved.type !== 'king') {
      g.did.other = true;
      if (!store.learned.other) { store.learned.other = true; saveStore(); }
    }
    if (E.isRoyal(moved) && moved.type !== 'king') g.did.royal = true;
    if (res.frames[0].pieces.some(function (p) {
      var was = p.id !== id && E.byId(before, p.id);
      return was && (was.col !== p.col || was.row !== p.row);
    })) g.did.push = true;
    if (res.frames.length > 1) g.did.slide = true;
    var landed = E.byId(res.frames[0].pieces, id);
    if (E.cellAt(g.level, landed.col, landed.row).t === 'oneway') g.did.oneway = true;
    for (var bk in res.state.broken) if (res.state.broken[bk]) g.did.break = true;
    if (g.level.plates.length && E.doorsOpen(g.level, res.state.pieces)) g.did.gate = true;
    /* the pin has taught its lesson once the frame has actually re-hung itself */
    if (g.level.pins.length &&
        E.pivotOf(g.level, res.state.pieces) !== E.pivotOf(g.level, before)) g.did.pin = true;
    res.state.pieces.forEach(function (p) {
      if (E.piecesAt(res.state.pieces, p.col, p.row).length > 1) g.did.stack = true;
    });

    g.lastMoved = id;
    g.gs = res.state;
    g.busy = true;
    deselect();
    refreshTeach();

    el.statMoves.textContent = String(g.gs.moves);
    el.statMoves.classList.remove('bump');
    void el.statMoves.offsetWidth;
    el.statMoves.classList.add('bump');

    playFrames(res.frames, sfx, fromRatio, function () {
      g.busy = false;
      finishTurn();
    });
  }

  var skipAnimation = function () {};

  function playFrames(frames, firstSfx, fromRatio, done) {
    var i = 0;
    var speed = 1 / store.opts.speed;
    var prevRatio = fromRatio;
    var timer = 0, over = false;

    function land(f) {
      renderer.draw(f.pieces, { broken: f.broken, gates: f.gates });
      renderer.setTilt(f.ratio);
      updateMeter(f.ratio, f.zone);
      g.lastZone = f.zone;
    }

    skipAnimation = function () {
      if (over) return;
      over = true;
      clearTimeout(timer);
      land(frames[frames.length - 1]);
      done();
    };

    function step() {
      var f = frames[i];
      renderer.draw(f.pieces, { sliding: f.kind === 'slide', broken: f.broken, gates: f.gates });
      renderer.setTilt(f.ratio);
      updateMeter(f.ratio, f.zone);

      if (i === 0) A.play(firstSfx);
      else A.play('roll');

      var swing = Math.abs(f.ratio - prevRatio);
      if (swing > 0.28) A.play('creak', Math.min(1, swing), 0.05);
      prevRatio = f.ratio;

      if (f.zone === 'warning' && g.lastZone !== 'warning' && g.lastZone !== 'critical') {
        A.play('warn', null, 0.12);
        toast('Careful…', 'warn');
      } else if (f.zone === 'critical' && g.lastZone !== 'critical') {
        A.play('warn', null, 0.1);
        toast('The frame is groaning.', 'warn');
        renderer.jolt();
      }
      g.lastZone = f.zone;

      i++;
      if (i < frames.length) {
        timer = setTimeout(step, (f.kind === 'slide' ? 190 : 210) * speed);
      } else {
        timer = setTimeout(function () {
          if (over) return;
          over = true;
          done();
        }, 260 * speed);
      }
    }
    step();
  }

  function finishTurn() {
    if (g.gs.status === 'won') return winSequence();
    if (g.gs.status === 'tipped' || g.gs.status === 'stranded') return onFail();
    /* stay on the piece the player is working with, so a counterweight can be
       walked several tiles without reselecting it every turn */
    if (g.lastMoved && E.byId(g.gs.pieces, g.lastMoved)) select(g.lastMoved, true);
  }

  /* ------------------------------------------------------------- win / fail */

  function crownsFor(level, moves) {
    if (!level.par) return 1;
    if (moves <= level.par.three) return 3;
    if (moves <= level.par.two) return 2;
    return 1;
  }

  /* When both royals make it, they get a beat to themselves at the gate before
   * the scoring card comes up. Only for a level that actually has a pair —
   * the King arriving alone still resolves immediately. */
  function winSequence() {
    if (!hasQueen()) return onWin();
    stopClock();
    deselect();
    A.play('gate');
    renderer.cheer(g.level.exit.col, g.level.exit.row);
    var at = g.index;
    setTimeout(function () {
      /* undo, restart or a jump to another level during the beat cancels it */
      if (g.index === at && g.gs && g.gs.status === 'won') onWin({ quiet: true });
    }, 1150);
  }

  function onWin(opts) {
    stopClock();
    deselect();
    if (!(opts && opts.quiet)) A.play('gate');
    A.play('win', null, 0.18);

    var moves = g.gs.moves, time = g.elapsed;
    var crowns = crownsFor(g.level, moves);
    var key = String(g.level.id);
    var prev = store.best[key];
    var improved = !prev || moves < prev.moves || (moves === prev.moves && time < prev.time);
    if (improved) store.best[key] = { moves: moves, time: time, crowns: crowns };
    else store.best[key].crowns = Math.max(store.best[key].crowns, crowns);
    if (g.index + 2 > store.unlocked) store.unlocked = Math.min(LEVELS.length, g.index + 2);
    saveStore();

    el.winMoves.textContent = String(moves);
    el.winTime.textContent = fmtTime(time);
    var best = store.best[key];
    el.winBest.textContent = best.moves + ' · ' + fmtTime(best.time);

    el.winTitle.textContent = crowns === 3 ? 'Perfectly balanced.'
      : crowns === 2 ? (hasQueen() ? 'They are both through.' : 'The King is through.')
      : 'Safe, and that is enough.';

    el.winNote.textContent = crowns === 3
      ? (g.level.idea || 'Nothing wasted.')
      : 'Three crowns at ' + g.level.par.three + ' move' + (g.level.par.three === 1 ? '' : 's') + '.';

    el.winCrowns.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var span = document.createElement('span');
      span.innerHTML = R.CROWN_ART;
      el.winCrowns.appendChild(span.firstChild);
    }
    var svgs = el.winCrowns.children;
    for (var j = 0; j < 3; j++) {
      (function (n) {
        setTimeout(function () {
          if (n < crowns) {
            svgs[n].classList.add('on', 'pop');
            A.play('crown');
          }
        }, 320 + n * 220);
      })(j);
    }

    el.winNext.textContent = g.index + 1 < LEVELS.length ? 'Next' : 'Finish';
    show(el.ovWin);
  }

  var FAIL_LINES = [
    'The kingdom leaned a little too far.',
    'The crown landed slightly crooked.',
    'A tiny royal sigh.',
    'Everything slid into a neat little pile.'
  ];

  function onFail() {
    stopClock();
    deselect();
    var stranded = g.gs.status === 'stranded';
    var ratio = E.ratioOf(g.level, g.gs.pieces);

    if (stranded) {
      el.failTitle.textContent = 'The road to the gate is gone.';
      el.failNote.textContent = (hasQueen()
        ? 'One of them can no longer reach the gate. '
        : 'Nothing is left standing between the King and the gate. ') +
        'Undo, and spend that crossing on someone else.';
      A.play('deny');
    } else {
      renderer.tipOver(ratio);
      A.play('tip');
      if (store.opts.shake) renderer.jolt();
      el.failTitle.textContent = FAIL_LINES[g.gs.moves % FAIL_LINES.length];
      el.failNote.textContent = 'Too much weight out to the ' + (ratio > 0 ? 'east' : 'west') +
                                '. Undo one move and try another order.';
    }
    setTimeout(function () { show(el.ovFail); }, (stranded ? 260 : 620) / store.opts.speed);
  }

  /* ---------------------------------------------------------------- undo */

  function undo() {
    flash(el.padUndo);
    if (g.busy) skipAnimation();
    if (g.busy || !g.history.length) return;
    var snap = g.history.pop();
    g.gs = { pieces: snap.pieces, broken: snap.broken, moves: snap.moves, status: snap.status };
    hideAll();
    renderer.resetTip();
    renderer.clearCheer();
    renderer.draw(g.gs.pieces, tileState());
    var ratio = E.ratioOf(g.level, g.gs.pieces);
    renderer.setTilt(ratio);
    updateMeter(ratio, E.zoneOf(ratio).key);
    g.lastZone = E.zoneOf(ratio).key;
    el.statMoves.textContent = String(g.gs.moves);
    el.padUndo.disabled = !g.history.length;
    A.play('select');
    if (!g.ticking) startClock();
    var keep = (g.lastMoved && E.byId(g.gs.pieces, g.lastMoved)) ? g.lastMoved : E.king(g.gs.pieces).id;
    select(keep, true);
  }

  /* Replaying the level the player is on, as opposed to loading another one,
     which is what startLevel does everywhere else. */
  function restartLevel() {
    flash(el.padRestart);
    startLevel(g.index);
  }

  /* --------------------------------------------------------------- input */

  el.board.addEventListener('pointerdown', onPointerDown);

  var drag = null;
  function onPointerDown(ev) {
    A.unlock();
    if (g.busy) skipAnimation();
    if (g.busy || g.gs.status !== 'play') return;

    var pieceEl = ev.target.closest('.piece');
    var cellEl = ev.target.closest('.cell');

    /* a target tile with a piece standing on it is still a move (a shove) */
    if (pieceEl) {
      var p = E.byId(g.gs.pieces, pieceEl.dataset.id);
      var onTarget = p && cellIsTarget(p.col, p.row);
      if (onTarget) { moveToTile(p.col, p.row); return; }
    }

    if (pieceEl) {
      drag = { id: pieceEl.dataset.id, x: ev.clientX, y: ev.clientY, moved: false };
      try { pieceEl.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a nicety */ }
      el.board.addEventListener('pointermove', onPointerMove);
      el.board.addEventListener('pointerup', onPointerUp);
      el.board.addEventListener('pointercancel', onPointerUp);
      return;
    }

    if (cellEl && cellEl.classList.contains('target')) {
      moveToTile(+cellEl.dataset.col, +cellEl.dataset.row);
      return;
    }
    deselect();
  }

  function onPointerMove(ev) {
    if (!drag || drag.moved) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    drag.moved = true;
    var dc = 0, dr = 0;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
    else dr = dy > 0 ? 1 : -1;
    tryMove(drag.id, dc, dr);
    endDrag();
  }

  function onPointerUp() {
    if (drag && !drag.moved) {
      if (g.selected === drag.id) deselect();
      else select(drag.id);
    }
    endDrag();
  }

  function endDrag() {
    drag = null;
    el.board.removeEventListener('pointermove', onPointerMove);
    el.board.removeEventListener('pointerup', onPointerUp);
    el.board.removeEventListener('pointercancel', onPointerUp);
  }

  function cellIsTarget(c, r) {
    var cell = renderer.cellAt(c, r);
    return cell && cell.classList.contains('target');
  }

  function moveToTile(c, r) {
    if (!g.selected) return;
    var cell = renderer.cellAt(c, r);
    if (!cell || !cell.classList.contains('target')) return;
    tryMove(g.selected, +cell.dataset.dc, +cell.dataset.dr);
  }

  var KEYDIR = {
    ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0],
    w: [0, -1], d: [1, 0], s: [0, 1], a: [-1, 0]
  };

  document.addEventListener('keydown', function (ev) {
    A.unlock();
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (!el.ovHelp.hidden) return closeSheet(el.ovHelp);
      if (!el.ovOptions.hidden) return closeSheet(el.ovOptions);
      if (!el.ovLevels.hidden) return closeSheet(el.ovLevels);
      if (!el.ovWin.hidden || !el.ovFail.hidden || !el.ovTitle.hidden) return;
      return openLevels();
    }
    if (!el.ovWin.hidden) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.winNext.click(); }
      return;
    }
    if (!el.ovFail.hidden) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.failRetry.click(); }
      if (ev.key.toLowerCase() === 'z') { ev.preventDefault(); el.failUndo.click(); }
      return;
    }
    if (!el.ovHelp.hidden) { if (ev.key === 'Enter' || ev.key === ' ') el.helpClose.click(); return; }
    if (!el.ovTitle.hidden || !el.ovLevels.hidden || !el.ovOptions.hidden) return;
    if (ev.key === 'h' || ev.key === 'H' || ev.key === '?') { ev.preventDefault(); return openHelp(); }

    if (g.busy) skipAnimation();

    var k = ev.key;
    if (k === 'Enter' || k === ' ') {
      var focused = document.activeElement && document.activeElement.closest &&
                    document.activeElement.closest('.piece');
      if (focused) { ev.preventDefault(); select(focused.dataset.id); return; }
    }
    if (KEYDIR[k]) {
      ev.preventDefault();
      moveSelected(KEYDIR[k][0], KEYDIR[k][1]);
      return;
    }
    if (k.toLowerCase() === 'z') { ev.preventDefault(); undo(); }
    else if (k.toLowerCase() === 'r') { ev.preventDefault(); restartLevel(); }
    else if (k === 'Tab') { ev.preventDefault(); cycle(ev.shiftKey ? -1 : 1); }
  });

  function moveSelected(dc, dr) {
    if (!g.gs || g.gs.status !== 'play') return;
    if (!g.selected) {
      var kg = E.king(g.gs.pieces);
      if (kg) select(kg.id, true);
    }
    if (g.selected) tryMove(g.selected, dc, dr);
  }

  function cycle(dir) {
    flash(dir < 0 ? el.padPrev : el.padNext);
    var movables = g.gs.pieces.filter(function (p) { return E.movableP(p); });
    if (!movables.length) return;
    var at = movables.findIndex(function (p) { return p.id === g.selected; });
    var next = movables[((at + dir) % movables.length + movables.length) % movables.length];
    select(next.id);
  }

  /* -------------------------------------------------------------- overlays */

  function show(node) { node.hidden = false; }
  function hideAll() {
    [el.ovWin, el.ovFail].forEach(function (n) { n.hidden = true; });
  }
  function closeSheet(node) {
    node.hidden = true;
    if (el.ovLevels.hidden && el.ovOptions.hidden && el.ovTitle.hidden && el.ovHelp.hidden &&
        el.ovWin.hidden && el.ovFail.hidden && g.gs && g.gs.status === 'play') startClock();
  }

  function openHelp() { stopClock(); show(el.ovHelp); }
  el.btnHelp.addEventListener('click', openHelp);
  el.helpClose.addEventListener('click', function () { closeSheet(el.ovHelp); });

  Array.prototype.forEach.call(el.padDir.querySelectorAll('.pad-btn'), function (b) {
    DIR_BTN[b.dataset.dc + ',' + b.dataset.dr] = b;
    b.addEventListener('click', function () {
      A.unlock();
      moveSelected(+b.dataset.dc, +b.dataset.dr);
    });
  });
  function padCycle(dir) {
    return function () {
      A.unlock();
      if (g.busy) skipAnimation();
      if (g.gs && g.gs.status === 'play') cycle(dir);
    };
  }
  el.padPrev.addEventListener('click', padCycle(-1));
  el.padNext.addEventListener('click', padCycle(1));
  el.padUndo.addEventListener('click', function () { A.unlock(); undo(); });
  el.padRestart.addEventListener('click', function () { A.unlock(); restartLevel(); });

  el.btnLevels.addEventListener('click', openLevels);
  el.failUndo.addEventListener('click', function () { undo(); });
  el.failRetry.addEventListener('click', function () { restartLevel(); });
  el.winReplay.addEventListener('click', function () { restartLevel(); });
  el.winSelect.addEventListener('click', openLevels);
  el.winNext.addEventListener('click', function () {
    if (g.index + 1 < LEVELS.length) startLevel(g.index + 1);
    else openLevels();
  });
  el.levelsClose.addEventListener('click', function () { closeSheet(el.ovLevels); });
  el.optionsClose.addEventListener('click', function () { closeSheet(el.ovOptions); });
  el.btnSettings.addEventListener('click', openOptions);
  el.titlePlay.addEventListener('click', function () {
    A.unlock();
    el.ovTitle.hidden = true;
    startLevel(Math.min(store.unlocked - 1, LEVELS.length - 1));
  });
  el.titleHelp.addEventListener('click', function () { A.unlock(); show(el.ovHelp); });
  el.titleLevels.addEventListener('click', function () {
    A.unlock();
    el.ovTitle.hidden = true;
    startLevel(0);
    openLevels();
  });

  /* --------------------------------------------------------- level select */

  function openLevels() {
    stopClock();
    buildLevelGrid();
    show(el.ovLevels);
  }

  function buildLevelGrid() {
    el.levelGrid.innerHTML = '';
    var total = 0;
    var chapters = root.CK.CHAPTERS || [{ n: 1, title: '', note: '' }];

    chapters.forEach(function (ch) {
      var levels = LEVELS.filter(function (lv) { return (lv.chapter || 1) === ch.n; });
      if (!levels.length) return;

      var done = levels.filter(function (lv) { return store.best[String(lv.id)]; }).length;
      var reached = levels.some(function (lv) { return unlockedAt(LEVELS.indexOf(lv)); });

      var head = document.createElement('div');
      head.className = 'chapter-head' + (reached ? '' : ' locked');
      head.innerHTML =
        '<h3>' + escapeHtml(ch.title) + '</h3>' +
        '<span>' + (reached ? escapeHtml(ch.note) : 'Sealed') + '</span>' +
        '<em>' + done + '/' + levels.length + '</em>';
      el.levelGrid.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'chapter-grid';
      el.levelGrid.appendChild(grid);
      levels.forEach(function (lv) { grid.appendChild(levelCard(lv)); });
    });

    LEVELS.forEach(function (lv) {
      var b = store.best[String(lv.id)];
      if (b) total += b.crowns;
    });
    el.totalCrowns.textContent = total + ' / ' + (LEVELS.length * 3) + ' crowns';
  }

  function levelCard(lv) {
    var i = LEVELS.indexOf(lv);
    var best = store.best[String(lv.id)];
    var locked = !unlockedAt(i);

    var b = document.createElement('button');
    b.className = 'lvl';
    b.disabled = locked;
    b.innerHTML =
      '<span class="lvl-n">Level ' + lv.id + '</span>' +
      '<span class="lvl-t">' + (locked ? '· · ·' : escapeHtml(lv.title)) + '</span>' +
      '<span class="lvl-c">' +
        (locked ? '<span class="lvl-lock">Locked</span>' : crownRow(best ? best.crowns : 0)) +
      '</span>' +
      '<span class="lvl-b">' +
        (best ? 'Best ' + best.moves + ' · ' + fmtTime(best.time) : (locked ? '' : 'Unplayed')) +
      '</span>';
    b.addEventListener('click', function () {
      el.ovLevels.hidden = true;
      startLevel(i);
    });
    return b;
  }

  function crownRow(n) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      out += R.CROWN_ART.replace('<svg ', '<svg class="' + (i < n ? 'on' : '') + '" ');
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* -------------------------------------------------------------- options */

  var OPTIONS = [
    { key: 'pieces', type: 'choice', label: 'Pieces', note: 'How the court is carved.', list: PIECE_SETS },
    { key: 'board', type: 'choice', label: 'Board', note: 'What the maze is built from.', list: BOARD_THEMES },
    { key: 'sound', type: 'switch', label: 'Sound', note: 'Wood, stone and brass.' },
    { key: 'volume', type: 'range', label: 'Volume', note: '', min: 0, max: 1, step: 0.05 },
    { key: 'motion', type: 'switch', label: 'Animation', note: 'Off snaps pieces straight into place.' },
    { key: 'speed', type: 'range', label: 'Animation speed', note: 'Slower gives you longer to read the board.', min: 0.5, max: 2, step: 0.1 },
    { key: 'shake', type: 'switch', label: 'Board shake', note: 'The jolt when the frame goes critical.' },
    { key: 'contrast', type: 'switch', label: 'High contrast', note: 'Brighter floors, darker walls.' },
    { key: 'pad', type: 'pad', label: 'On-screen controls',
      note: 'A direction pad below the board. On by default with a touch screen.' },
    { key: 'unlockAll', type: 'switch', label: 'Unlock every level',
      note: 'Opens the whole map for playtesting. Your crowns and best scores are untouched.' }
  ];

  function openOptions() { stopClock(); buildOptions(); show(el.ovOptions); }

  function buildOptions() {
    el.options.innerHTML = '';
    OPTIONS.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'opt';
      var left = document.createElement('div');
      left.className = 'opt-l';
      left.innerHTML = '<b>' + o.label + '</b>' + (o.note ? '<span>' + o.note + '</span>' : '');
      row.appendChild(left);

      if (o.type === 'choice') {
        row.classList.add('opt-wide');
        var seg = document.createElement('div');
        seg.className = 'seg';
        seg.setAttribute('role', 'radiogroup');
        seg.setAttribute('aria-label', o.label);
        var live = optionKey(o.list, store.opts[o.key]);
        o.list.forEach(function (choice) {
          var b = document.createElement('button');
          b.className = 'seg-b';
          b.type = 'button';
          b.textContent = choice.name;
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(choice.key === live));
          b.addEventListener('click', function () {
            if (store.opts[o.key] === choice.key) return;
            setSkin(o.key, choice.key);
            A.play('select');
          });
          seg.appendChild(b);
        });
        row.appendChild(seg);
      } else if (o.type === 'pad') {
        var ps = document.createElement('button');
        ps.className = 'switch';
        ps.setAttribute('role', 'switch');
        ps.setAttribute('aria-label', o.label);
        ps.setAttribute('aria-checked', String(padVisible()));
        ps.addEventListener('click', function () {
          store.opts.pad = !padVisible();
          ps.setAttribute('aria-checked', String(store.opts.pad));
          applyOpts(); saveStore();
        });
        row.appendChild(ps);
      } else if (o.type === 'switch') {
        var sw = document.createElement('button');
        sw.className = 'switch';
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-label', o.label);
        sw.setAttribute('aria-checked', String(!!store.opts[o.key]));
        sw.addEventListener('click', function () {
          store.opts[o.key] = !store.opts[o.key];
          sw.setAttribute('aria-checked', String(store.opts[o.key]));
          applyOpts(); saveStore();
          if (o.key === 'sound' && store.opts.sound) { A.unlock(); A.play('select'); }
          if (o.key === 'unlockAll') buildLevelGrid();
        });
        row.appendChild(sw);
      } else {
        var rg = document.createElement('input');
        rg.type = 'range';
        rg.className = 'range';
        rg.min = o.min; rg.max = o.max; rg.step = o.step;
        rg.value = store.opts[o.key];
        rg.setAttribute('aria-label', o.label);
        rg.addEventListener('input', function () {
          store.opts[o.key] = parseFloat(rg.value);
          applyOpts();
        });
        rg.addEventListener('change', function () {
          saveStore();
          if (o.key === 'volume') { A.unlock(); A.play('wood'); }
        });
        row.appendChild(rg);
      }
      el.options.appendChild(row);
    });
  }

  el.btnWipe.addEventListener('click', function () {
    if (el.btnWipe.dataset.armed !== '1') {
      el.btnWipe.dataset.armed = '1';
      el.btnWipe.textContent = 'Tap again to erase everything';
      setTimeout(function () {
        el.btnWipe.dataset.armed = '0';
        el.btnWipe.textContent = 'Erase all progress';
      }, 4000);
      return;
    }
    store = { v: 1, unlocked: 1, best: {}, learned: {}, opts: store.opts };
    saveStore();
    el.btnWipe.dataset.armed = '0';
    el.btnWipe.textContent = 'Erase all progress';
    closeSheet(el.ovOptions);
    buildLevelGrid();
    startLevel(0);
  });

  /* pause the clock while the player is reading a menu */
  window.addEventListener('blur', stopClock);
  window.addEventListener('focus', function () {
    if (g.gs && g.gs.status === 'play' && el.ovLevels.hidden && el.ovOptions.hidden &&
        el.ovTitle.hidden && el.ovWin.hidden && el.ovFail.hidden && el.ovHelp.hidden) startClock();
  });
  window.addEventListener('resize', function () {
    if (g.gs) updateMeter(E.ratioOf(g.level, g.gs.pieces), E.zoneOf(E.ratioOf(g.level, g.gs.pieces)).key);
  });

  /* ----------------------------------------------------------------- boot */

  applyOpts();
  el.app.hidden = false;

  /* ?level=7 jumps straight in — handy for testing and for sharing a puzzle */
  var jump = /[?&]level=(\d+)/.exec(location.search);
  if (jump) {
    var want = LEVELS.findIndex(function (l) { return l.id === +jump[1]; });
    startLevel(want < 0 ? 0 : want);
  } else {
    startLevel(Math.min(store.unlocked - 1, LEVELS.length - 1));
    stopClock();
    show(el.ovTitle);
  }

  root.CK.game = { start: startLevel, state: g, store: store };
})(typeof globalThis !== 'undefined' ? globalThis : this);
