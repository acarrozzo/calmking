/* Calm King — everything you can see. Builds the board, draws the pieces,
 * and leans the whole rig. It owns no game state; ui.js hands it snapshots.
 */
(function (root) {
  'use strict';

  var E = root.CK.engine;
  var GRID = E.GRID;
  var MAX_TILT = 15;      /* degrees at |ratio| = 1 */
  var OVER_TILT = 26;     /* degrees once the board has gone over */

  /* ------------------------------------------------------------------ art */

  var ART = {
    king:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fbf1dc"/><stop offset="1" stop-color="#cdb994"/></linearGradient></defs>' +
      '<path d="M28 118 h44 l-5-12 H33 z" fill="#b9a480" stroke="#6b5a3d" stroke-width="2"/>' +
      '<path d="M34 106 c-2-16 4-22 4-34 h24 c0 12 6 18 4 34 z" fill="url(#kg)" stroke="#6b5a3d" stroke-width="2"/>' +
      '<ellipse cx="50" cy="70" rx="14" ry="5" fill="#e2d3b2" stroke="#6b5a3d" stroke-width="2"/>' +
      '<circle cx="50" cy="55" r="13" fill="url(#kg)" stroke="#6b5a3d" stroke-width="2"/>' +
      '<path d="M34 42 l3-24 11 10 L50 14 l6 14 11-10 3 24 z" fill="#d8ad52" stroke="#7d5f22" stroke-width="2"/>' +
      '<path d="M34 42 h32" stroke="#7d5f22" stroke-width="3"/>' +
      '<circle cx="45" cy="54" r="1.9" fill="#5c4a30" stroke="none"/>' +
      '<circle cx="56" cy="54" r="1.9" fill="#5c4a30" stroke="none"/>' +
      '</svg>',

    queen:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f6e6f2"/><stop offset="1" stop-color="#c1a2bd"/></linearGradient></defs>' +
      '<path d="M31 118 h38 l-4-11 H35 z" fill="#ab90a8" stroke="#5f4a5e" stroke-width="2"/>' +
      '<path d="M36 107 c-4-18 5-24 5-37 h18 c0 13 9 19 5 37 z" fill="url(#qg)" stroke="#5f4a5e" stroke-width="2"/>' +
      '<ellipse cx="50" cy="72" rx="11" ry="4" fill="#e8d6e4" stroke="#5f4a5e" stroke-width="1.8"/>' +
      '<circle cx="50" cy="60" r="11" fill="url(#qg)" stroke="#5f4a5e" stroke-width="2"/>' +
      '<path d="M38 48 l2-19 6 8 4-11 4 11 6-8 2 19 z" fill="#d8ad52" stroke="#7d5f22" stroke-width="1.9"/>' +
      '<circle cx="50" cy="24" r="3" fill="#e8d6e4" stroke="#7d5f22" stroke-width="1.6"/>' +
      '<circle cx="46" cy="59" r="1.7" fill="#584252" stroke="none"/>' +
      '<circle cx="55" cy="59" r="1.7" fill="#584252" stroke="none"/>' +
      '</svg>',

    barrel:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<path d="M30 116 c-8-22-8-40 0-62 h40 c8 22 8 40 0 62 z" fill="#9a6c3d" stroke="#4a3018" stroke-width="2.4"/>' +
      '<path d="M27 96 h46 M27 74 h46" stroke="#5c4526" stroke-width="4" fill="none"/>' +
      '<path d="M42 55 v61 M58 55 v61" stroke="#7d5730" stroke-width="1.6" fill="none" opacity=".8"/>' +
      '<ellipse cx="50" cy="55" rx="20" ry="6" fill="#b9884f" stroke="#4a3018" stroke-width="2.2"/>' +
      '</svg>',

    stone:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<path d="M24 114 l-4-34 14-26 h32 l14 26 -4 34 z" fill="#8d8a81" stroke="#3f3d38" stroke-width="2.4"/>' +
      '<path d="M34 54 l-8 26 h48 l-8-26 z" fill="#a5a199" stroke="#3f3d38" stroke-width="2"/>' +
      '<path d="M26 96 h48" stroke="#5f5c55" stroke-width="2" opacity=".7"/>' +
      '<path d="M44 80 v34 M60 80 v34" stroke="#5f5c55" stroke-width="1.6" opacity=".55"/>' +
      '</svg>',

    iron:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<path d="M20 116 h60 l-6-52 H26 z" fill="#3f4450" stroke="#171a20" stroke-width="2.6"/>' +
      '<path d="M26 64 h48 l-3-8 H29 z" fill="#5a6070" stroke="#171a20" stroke-width="2"/>' +
      '<path d="M38 56 c0-16 24-16 24 0" fill="none" stroke="#20242c" stroke-width="6"/>' +
      '<path d="M38 56 c0-16 24-16 24 0" fill="none" stroke="#727a8c" stroke-width="2.4"/>' +
      '<path d="M32 108 h36" stroke="#20242c" stroke-width="3" opacity=".8"/>' +
      '<text x="50" y="98" font-size="26" font-family="Georgia,serif" fill="#8b93a5" stroke="none" text-anchor="middle">IV</text>' +
      '</svg>',

    marble:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><radialGradient id="mg" cx=".36" cy=".3" r=".8">' +
      '<stop offset="0" stop-color="#f4fbff"/><stop offset=".45" stop-color="#8fc2dd"/>' +
      '<stop offset="1" stop-color="#3d6c8c"/></radialGradient></defs>' +
      '<circle cx="50" cy="84" r="30" fill="url(#mg)" stroke="#22485f" stroke-width="2.4"/>' +
      '<ellipse cx="39" cy="72" rx="9" ry="6" fill="#ffffff" stroke="none" opacity=".8" transform="rotate(-28 39 72)"/>' +
      '</svg>',

    statue:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<path d="M22 118 h56 l-6-12 H28 z" fill="#2f3239" stroke="#14161a" stroke-width="2.4"/>' +
      '<path d="M32 106 l4-52 h28 l4 52 z" fill="#454a53" stroke="#14161a" stroke-width="2.4"/>' +
      '<circle cx="50" cy="42" r="12" fill="#525863" stroke="#14161a" stroke-width="2.4"/>' +
      '<path d="M38 30 h24" stroke="#14161a" stroke-width="2.4"/>' +
      '<path d="M40 66 h20 M40 80 h20" stroke="#2a2d33" stroke-width="2" opacity=".9"/>' +
      '</svg>'
  };

  var ARROW_ART =
    '<svg class="ledge" viewBox="0 0 40 40" aria-hidden="true">' +
    '<path d="M13 10 L25 20 L13 30" stroke-width="4"/>' +
    '<path d="M24 10 L36 20 L24 30" stroke-width="4" opacity=".45"/></svg>';

  var PORTCULLIS_ART =
    '<div class="gate-frame"></div><div class="gate-bars">' +
    '<i></i><i></i><i></i><i></i></div>';

  /* A socket in the floor. Stand on it and the frame re-hangs itself here. */
  var PIN_ART =
    '<svg class="pin-art" viewBox="0 0 40 40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="11" class="pin-socket"/>' +
    '<path d="M20 9 L29 25 H11 z" class="pin-wedge"/></svg>';

  var GATE_ART =
    '<svg class="gate" viewBox="0 0 40 40" aria-hidden="true">' +
    '<path d="M8 34 V16 a12 12 0 0 1 24 0 v18" stroke-width="2.6"/>' +
    '<path d="M20 34 V6 M8 24 h24" stroke-width="1.8" opacity=".75"/>' +
    '<path d="M4 34 h32" stroke-width="3"/></svg>';

  var HEART_ART =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 21s-8-5.1-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.4C20 15.9 12 21 12 21z"/></svg>';

  var CROWN_ART =
    '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M5 22 L2 6 l9 6 L20 1 l9 11 l9 -6 l-3 16 z" ' +
    'fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="2"/></svg>';

  /* ---------------------------------------------------------------- board */

  function Renderer(boardEl, rigEl, sceneEl) {
    this.board = boardEl;
    this.rig = rigEl;
    /* the fulcrum is a sibling of the rig, so the pivot column lives on the
       scene where both of them can read it */
    this.scene = sceneEl || rigEl.parentNode;
    this.cells = [];
    this.pieceEls = {};
    this.level = null;
    this.pivot = null;
  }

  Renderer.prototype.mount = function (level) {
    this.level = level;
    this.board.textContent = '';
    this.cells = [];
    this.pieceEls = {};

    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var cell = level.cells[r][c];
        var el = document.createElement('div');
        var isExit = (level.exit.col === c && level.exit.row === r);
        el.className = 'cell ' + cell.t + (isExit ? ' exit' : '');
        el.style.left = 'calc(' + c + ' * var(--tile))';
        el.style.top = 'calc(' + r + ' * var(--tile))';
        el.dataset.col = c;
        el.dataset.row = r;

        var top = document.createElement('div');
        top.className = 'cell-top';
        if (isExit) {
          top.innerHTML = GATE_ART;
        } else if (cell.t === 'oneway') {
          el.classList.add(cell.dc === 1 ? 'way-e' : cell.dc === -1 ? 'way-w'
                                        : cell.dr === 1 ? 'way-s' : 'way-n');
          top.innerHTML = ARROW_ART;
        } else if (cell.t === 'plate') {
          top.innerHTML = '<span class="plate-need">' + cell.need + '</span>';
          el.setAttribute('aria-label', 'Pressure plate, needs weight ' + cell.need);
        } else if (cell.t === 'door') {
          top.innerHTML = PORTCULLIS_ART;
        } else if (cell.t === 'pin') {
          top.innerHTML = PIN_ART;
          el.setAttribute('aria-label', 'Pivot pin');
        }
        el.appendChild(top);

        if (cell.t === 'wall') {
          var face = document.createElement('div');
          face.className = 'cell-face';
          el.appendChild(face);
        } else {
          var dot = document.createElement('div');
          dot.className = 'dot';
          el.appendChild(dot);
        }

        this.board.appendChild(el);
        this.cells.push(el);
      }
    }
    this.pivot = null;
    this.setPivot(level.pivot, true);
    this.setTilt(0, true);
  };

  /* Slide the fulcrum under the board and swing the rig about the new column.
   * Instant on mount, animated afterwards — the frame visibly re-hanging
   * itself is the whole point of a pin. */
  Renderer.prototype.setPivot = function (col, instant) {
    if (col === this.pivot) return;
    this.pivot = col;
    if (instant) this.scene.classList.add('no-pivot-anim');
    this.scene.style.setProperty('--pivot-col', String(col));
    if (instant) {
      void this.scene.offsetWidth;
      this.scene.classList.remove('no-pivot-anim');
    }
    if (!this.level || !this.level.pins.length) return;
    for (var i = 0; i < this.level.pins.length; i++) {
      var pin = this.level.pins[i];
      this.cellAt(pin.col, pin.row).classList.toggle('holding', pin.col === col);
    }
  };

  Renderer.prototype.cellAt = function (c, r) {
    return this.cells[r * GRID + c];
  };

  /* Floors that have given way, and whether the portcullises are up. */
  Renderer.prototype.applyTiles = function (broken, gates) {
    var self = this, level = this.level;
    for (var i = 0; i < level.fragiles.length; i++) {
      var f = level.fragiles[i];
      self.cellAt(f.col, f.row).classList.toggle('broken', !!(broken && broken[f.col + ',' + f.row]));
    }
    for (var j = 0; j < level.doors.length; j++) {
      var d = level.doors[j];
      self.cellAt(d.col, d.row).classList.toggle('open', !!gates);
    }
  };

  /* `loaded` means something is standing here; `holding` means this pin is the
   * one the frame is actually hanging from. Load two and every pin is loaded
   * but none is holding, which is exactly what the player needs to see. */
  Renderer.prototype.applyPins = function (pieces) {
    var level = this.level;
    for (var i = 0; i < level.pins.length; i++) {
      var pin = level.pins[i];
      var on = E.piecesAt(pieces, pin.col, pin.row).length;
      this.cellAt(pin.col, pin.row).classList.toggle('loaded', on > 0);
    }
  };

  Renderer.prototype.applyPlates = function (pieces) {
    var level = this.level;
    for (var i = 0; i < level.plates.length; i++) {
      var pl = level.plates[i];
      var load = E.plateLoad(level, pieces, pl);
      var cell = this.cellAt(pl.col, pl.row);
      cell.classList.toggle('pressed', load >= pl.need);
      cell.classList.toggle('partial', load > 0 && load < pl.need);
    }
  };

  /* --------------------------------------------------------------- pieces */

  Renderer.prototype.syncPieces = function (pieces) {
    var self = this;
    var wanted = {};

    pieces.forEach(function (p) {
      wanted[p.id] = true;
      if (self.pieceEls[p.id]) return;

      var type = E.typeOf(p);
      var el = document.createElement('div');
      el.className = 'piece piece-' + p.type + (E.movableP(p) ? '' : ' fixed');
      el.dataset.id = p.id;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', E.movableP(p) ? '0' : '-1');
      el.setAttribute('aria-label',
        (p.label || type.name) + ', weight ' + E.weightOf(p) +
        (E.movableP(p) ? '' : ', immovable'));

      var pips = '';
      for (var i = 0; i < E.weightOf(p); i++) pips += '<i></i>';

      el.innerHTML =
        '<div class="p-shadow"></div>' +
        '<div class="p-ring"></div>' +
        '<div class="p-fig">' + (ART[p.type] || ART.stone) + '</div>' +
        '<div class="p-pips">' + pips + '</div>' +
        '<div class="hit"></div>';

      self.board.appendChild(el);
      self.pieceEls[p.id] = el;
    });

    Object.keys(this.pieceEls).forEach(function (id) {
      if (wanted[id]) return;
      self.pieceEls[id].remove();
      delete self.pieceEls[id];
    });
  };

  /* Position every piece. Pieces sharing a tile fan out slightly and the
   * tile gets a count badge, so a shared tile can never be mistaken for one. */
  Renderer.prototype.draw = function (pieces, opts) {
    opts = opts || {};
    var self = this;
    this.syncPieces(pieces);
    if (opts.broken !== undefined || opts.gates !== undefined) {
      this.applyTiles(opts.broken, opts.gates);
    }
    this.applyPlates(pieces);
    if (this.level.pins.length) {
      this.applyPins(pieces);
      this.setPivot(E.pivotOf(this.level, pieces), opts.instant);
    }

    var groups = {};
    pieces.forEach(function (p) {
      var k = p.col + ',' + p.row;
      (groups[k] = groups[k] || []).push(p);
    });

    Object.keys(groups).forEach(function (k) {
      var group = groups[k];
      group.sort(function (a, b) { return E.weightOf(b) - E.weightOf(a); });

      group.forEach(function (p, i) {
        var el = self.pieceEls[p.id];
        var n = group.length;
        var spread = n > 1 ? 1 : 0;
        var offX = spread ? (i - (n - 1) / 2) * 13 : 0;
        var offY = spread ? (i - (n - 1) / 2) * -5 : 0;

        el.style.setProperty('--c', p.col);
        el.style.setProperty('--r', p.row);
        el.style.setProperty('--sx', offX.toFixed(1) + 'px');
        el.style.setProperty('--sy', offY.toFixed(1) + 'px');
        el.style.zIndex = String(10 + p.row * 2 + (i ? 1 : 0));
        el.classList.toggle('sliding', !!opts.sliding);

        var badge = el.querySelector('.stack-badge');
        if (n > 1 && i === 0) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'stack-badge';
            el.appendChild(badge);
          }
          var total = group.reduce(function (s, q) { return s + E.weightOf(q); }, 0);
          badge.textContent = '⚖' + total;
          badge.title = n + ' pieces here, ' + total + ' together';
        } else if (badge) {
          badge.remove();
        }
      });
    });

    /* the gate wakes up when either royal is beside it */
    var exit = this.level.exit;
    var exitCell = this.cellAt(exit.col, exit.row);
    var near = E.royals(pieces).some(function (p) {
      return Math.abs(p.col - exit.col) + Math.abs(p.row - exit.row) <= 1;
    });
    exitCell.classList.toggle('lit', near);
  };

  /* ----------------------------------------------------------------- tilt */

  Renderer.prototype.setTilt = function (ratio, instant) {
    var clamped = Math.max(-1, Math.min(1, ratio));
    var deg = clamped * MAX_TILT;
    if (Math.abs(ratio) > 1) deg = (ratio > 0 ? 1 : -1) * OVER_TILT;
    this.rig.style.setProperty('--tilt', deg.toFixed(2) + 'deg');
    if (instant) {
      var was = this.rig.style.transition;
      this.rig.style.transition = 'none';
      void this.rig.offsetWidth;
      this.rig.style.transition = was;
    }
  };

  Renderer.prototype.tipOver = function (ratio) {
    var dir = ratio > 0 ? 1 : -1;
    this.rig.classList.add('tipped', dir > 0 ? 'fall-east' : 'fall-west');
    this.rig.style.setProperty('--tilt', (dir * 46) + 'deg');
  };

  Renderer.prototype.resetTip = function () {
    this.rig.classList.remove('tipped', 'fall-east', 'fall-west');
  };

  Renderer.prototype.jolt = function () {
    var rig = this.rig;
    rig.classList.remove('jolt');
    void rig.offsetWidth;
    rig.classList.add('jolt');
  };

  /* ------------------------------------------------------------ selection */

  Renderer.prototype.setSelection = function (id, moves) {
    var self = this;
    if (id && this.pieceEls[id]) this.pieceEls[id].classList.remove('hint');
    Object.keys(this.pieceEls).forEach(function (pid) {
      self.pieceEls[pid].classList.toggle('selected', pid === id);
    });
    this.cells.forEach(function (c) {
      c.classList.remove('target', 'shove', 'risky', 'crumbles');
    });
    if (!moves) return;

    moves.forEach(function (m) {
      var cell = self.cellAt(m.col, m.row);
      cell.classList.add('target');
      if (m.pushes && m.pushes.length) cell.classList.add('shove');
      if (m.breaks) cell.classList.add('crumbles');
      if (Math.abs(m.ratio) >= 0.88) cell.classList.add('risky');
      cell.dataset.dc = m.dc;
      cell.dataset.dr = m.dr;
    });
  };

  /* A short glow on the given pieces: used once, early, to say "these are
     yours to move too". Cleared as soon as the player selects anything. */
  Renderer.prototype.hint = function (ids) {
    var self = this;
    clearTimeout(this.hintTimer);
    this.clearHint();
    ids.forEach(function (id) {
      if (self.pieceEls[id]) self.pieceEls[id].classList.add('hint');
    });
    this.hintTimer = setTimeout(function () { self.clearHint(); }, 6000);
  };

  Renderer.prototype.clearHint = function () {
    var self = this;
    Object.keys(this.pieceEls).forEach(function (id) {
      self.pieceEls[id].classList.remove('hint');
    });
  };

  /* The King and Queen are home and standing in the same doorway. Let them
   * have a moment. Rides on the board so it leans with everything else. */
  Renderer.prototype.cheer = function (col, row) {
    var el = document.createElement('div');
    el.className = 'cheer';
    el.innerHTML = HEART_ART;
    el.style.setProperty('--c', col);
    el.style.setProperty('--r', row);
    this.board.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
    return el;
  };

  /* undo during the moment takes the moment back too */
  Renderer.prototype.clearCheer = function () {
    var all = this.board.querySelectorAll ? this.board.querySelectorAll('.cheer') : [];
    for (var i = 0; i < all.length; i++) all[i].remove();
  };

  Renderer.prototype.nudge = function (id) {
    var el = this.pieceEls[id];
    if (!el) return;
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
  };

  root.CK.render = {
    Renderer: Renderer,
    ART: ART,
    CROWN_ART: CROWN_ART,
    HEART_ART: HEART_ART,
    MAX_TILT: MAX_TILT
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
