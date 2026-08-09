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

  /* Two carved sets of the same seven pieces. Every figure shares the same
   * 100x120 box and stands on the same baseline near y=118, because .p-fig
   * bottom-aligns them on the tile. Weight is never carried by colour alone:
   * height, bulk and the pips under the piece all say it too.
   *
   * Gradient ids are prefixed per set (ck-, tk-) — the document holds one copy
   * of the art per piece on the board, so unprefixed ids would collide. */

  var ART_SETS = {};

  /* ---- carved: the storybook figures. Bell-shaped robes and rounded stock
   * rather than the old flat-sided ones, a rim light down the lit side, and a
   * warm outline instead of a near-black one. Note that the stylesheet gives
   * every svg a currentColor stroke, so fill-only shapes must say stroke="none"
   * or they pick up a cream outline. ---- */

  ART_SETS.carved = {
    king:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-kg" x1=".18" y1="0" x2=".86" y2="1">' +
      '<stop offset="0" stop-color="#fdf5e4"/><stop offset=".52" stop-color="#e8d9ba"/>' +
      '<stop offset="1" stop-color="#c0a882"/></linearGradient></defs>' +
      '<ellipse cx="50" cy="114" rx="25" ry="5.5" fill="#af9a75" stroke="#6b5a3d" stroke-width="1.8"/>' +
      '<path d="M50 67 c-11 0-16.5 8-18 20.5 -1.2 10-3 18.5-5.5 27 h47 c-2.5-8.5-4.3-17-5.5-27 -1.5-12.5-7-20.5-18-20.5 z" ' +
      'fill="url(#ck-kg)" stroke="#6b5a3d" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M35 78 c9 5.5 21 5.5 30 0" fill="none" stroke="#6b5a3d" stroke-width="1.7" opacity=".75"/>' +
      '<path d="M37 85 c-2 11-3.4 20-5 29" fill="none" stroke="#fffaf0" stroke-width="2.4" opacity=".5"/>' +
      '<circle cx="50" cy="55" r="13.5" fill="url(#ck-kg)" stroke="#6b5a3d" stroke-width="2"/>' +
      '<path d="M35.5 42 c-1.2-9-2-16-2-22.5 l11.5 9.5 L50 15 l5 14 11.5-9.5 c0 6.5-.8 13.5-2 22.5 z" ' +
      'fill="#d8ad52" stroke="#7d5f22" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M35.5 42 c9.5 3 19.5 3 29 0" fill="none" stroke="#7d5f22" stroke-width="2.6"/>' +
      '<circle cx="50" cy="13" r="2.7" fill="#f0dc9e" stroke="#7d5f22" stroke-width="1.2"/>' +
      '<path d="M40.5 47.5 a13.5 13.5 0 0 1 4.5-10" fill="none" stroke="#fffaf0" stroke-width="2.2" opacity=".6"/>' +
      '<circle cx="45" cy="55" r="1.9" fill="#5c4a30" stroke="none"/>' +
      '<circle cx="55.5" cy="55" r="1.9" fill="#5c4a30" stroke="none"/>' +
      '<path d="M46 61.5 c2.2 1.8 6 1.8 8.2 0" fill="none" stroke="#5c4a30" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>',

    queen:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-qg" x1=".18" y1="0" x2=".86" y2="1">' +
      '<stop offset="0" stop-color="#fcf0f9"/><stop offset=".52" stop-color="#e2cbdd"/>' +
      '<stop offset="1" stop-color="#b596b1"/></linearGradient></defs>' +
      '<ellipse cx="50" cy="115" rx="21" ry="5" fill="#a68ba3" stroke="#5f4a5e" stroke-width="1.7"/>' +
      '<path d="M50 71 c-9 0-13.5 7.5-15 19.5 -1 9-2.4 16.5-4.5 24.5 h39 c-2.1-8-3.5-15.5-4.5-24.5 -1.5-12-6-19.5-15-19.5 z" ' +
      'fill="url(#ck-qg)" stroke="#5f4a5e" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M38 81 c7.5 4.5 16.5 4.5 24 0" fill="none" stroke="#5f4a5e" stroke-width="1.6" opacity=".75"/>' +
      '<path d="M39.5 88 c-1.6 9.5-2.8 17.5-4.2 26" fill="none" stroke="#fff4fc" stroke-width="2.2" opacity=".45"/>' +
      '<circle cx="50" cy="60" r="11.5" fill="url(#ck-qg)" stroke="#5f4a5e" stroke-width="2"/>' +
      '<path d="M39 48.5 c-.8-7.5-1.4-13.5-1.4-18.5 l7 7 L50 25 l5.4 12 7-7 c0 5-.6 11-1.4 18.5 z" ' +
      'fill="#d8ad52" stroke="#7d5f22" stroke-width="1.9" stroke-linejoin="round"/>' +
      '<path d="M39 48.5 c7.5 2.6 15.5 2.6 22 0" fill="none" stroke="#7d5f22" stroke-width="2.3"/>' +
      '<circle cx="50" cy="22.5" r="3" fill="#f6ecf4" stroke="#7d5f22" stroke-width="1.5"/>' +
      '<path d="M41.5 53.5 a11.5 11.5 0 0 1 4-8.5" fill="none" stroke="#fff4fc" stroke-width="2" opacity=".6"/>' +
      '<circle cx="46" cy="60" r="1.7" fill="#584252" stroke="none"/>' +
      '<circle cx="55" cy="60" r="1.7" fill="#584252" stroke="none"/>' +
      '<path d="M46.6 66 c2 1.6 5.2 1.6 7.2 0" fill="none" stroke="#584252" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>',

    barrel:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-bg" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#c08d52"/><stop offset=".42" stop-color="#a3743f"/>' +
      '<stop offset="1" stop-color="#7d5730"/></linearGradient></defs>' +
      '<path d="M50 54 c-11 0-18 2-20 4 -4 18-4 36 0 56 2 2 9 4 20 4 s18-2 20-4 c4-20 4-38 0-56 -2-2-9-4-20-4 z" ' +
      'fill="url(#ck-bg)" stroke="#4a3018" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M37 60 c-3.5 18-3.5 36 0 54" fill="none" stroke="#d8ab6e" stroke-width="3" opacity=".5"/>' +
      '<path d="M28.6 74 c14 3 28.8 3 42.8 0 M28.6 96 c14 3 28.8 3 42.8 0" fill="none" stroke="#5c4526" stroke-width="4"/>' +
      '<path d="M43 57 c-1.4 20-1.4 40 0 60 M57 57 c1.4 20 1.4 40 0 60" fill="none" stroke="#7d5730" stroke-width="1.5" opacity=".7"/>' +
      '<ellipse cx="50" cy="55" rx="20" ry="6.5" fill="#cb9a58" stroke="#4a3018" stroke-width="2.2"/>' +
      '</svg>',

    stone:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-sg" x1=".2" y1="0" x2=".85" y2="1">' +
      '<stop offset="0" stop-color="#b3afa6"/><stop offset=".55" stop-color="#928e85"/>' +
      '<stop offset="1" stop-color="#6f6c65"/></linearGradient></defs>' +
      '<path d="M33 52 h34 c5 0 9 4 10 10 l3 40 c.4 6-3 10-9 10 H29 c-6 0-9.4-4-9-10 l3-40 c.4-6 5-10 10-10 z" ' +
      'fill="url(#ck-sg)" stroke="#3f3d38" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M33 52 c-4 6-6 12-6 18 h46 c0-6-2-12-6-18" fill="#b8b4ab" stroke="#3f3d38" stroke-width="2"/>' +
      '<path d="M31 56 c-3 5-4.6 10-4.6 15" fill="none" stroke="#d5d1c8" stroke-width="2.4" opacity=".55"/>' +
      '<path d="M22.4 92 c18 2.4 37.2 2.4 55.2 0" fill="none" stroke="#5f5c55" stroke-width="2" opacity=".65"/>' +
      '<path d="M44 71 v41 M61 71 v41" fill="none" stroke="#5f5c55" stroke-width="1.5" opacity=".5"/>' +
      '</svg>',

    iron:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-ig" x1=".2" y1="0" x2=".85" y2="1">' +
      '<stop offset="0" stop-color="#5b6272"/><stop offset=".5" stop-color="#434958"/>' +
      '<stop offset="1" stop-color="#2b303b"/></linearGradient></defs>' +
      '<path d="M38 58 c0-15 24-15 24 0" fill="none" stroke="#191d24" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M38 58 c0-15 24-15 24 0" fill="none" stroke="#7d8598" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M27 62 h46 c3 0 5 2 5.4 5 l3.6 44 c.3 4-2 7-6 7 H24 c-4 0-6.3-3-6-7 l3.6-44 c.4-3 2.4-5 5.4-5 z" ' +
      'fill="url(#ck-ig)" stroke="#171a20" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M22 74 c18.6 2.6 37.4 2.6 56 0" fill="none" stroke="#5f6779" stroke-width="2.4" opacity=".6"/>' +
      '<path d="M27 68 l-3.4 46" fill="none" stroke="#828b9e" stroke-width="2.6" opacity=".55"/>' +
      '<circle cx="27" cy="108" r="2.2" fill="#20242c" stroke="none"/>' +
      '<circle cx="73" cy="108" r="2.2" fill="#20242c" stroke="none"/>' +
      '<text x="50" y="102" font-size="26" font-family="Georgia,serif" fill="#98a0b2" stroke="none" text-anchor="middle">IV</text>' +
      '</svg>',

    marble:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><radialGradient id="ck-mg" cx=".34" cy=".28" r=".85">' +
      '<stop offset="0" stop-color="#fbfeff"/><stop offset=".38" stop-color="#a6d2e9"/>' +
      '<stop offset=".82" stop-color="#4c7d9c"/><stop offset="1" stop-color="#2c5573"/></radialGradient></defs>' +
      '<circle cx="50" cy="84" r="30" fill="url(#ck-mg)" stroke="#22485f" stroke-width="2.4"/>' +
      '<path d="M23 92 a30 30 0 0 0 52 12" fill="none" stroke="#cfeafa" stroke-width="2.6" opacity=".4"/>' +
      '<ellipse cx="39" cy="71" rx="9.5" ry="6" fill="#ffffff" stroke="none" opacity=".9" transform="rotate(-28 39 71)"/>' +
      '<circle cx="62" cy="96" r="3.4" fill="#ffffff" stroke="none" opacity=".35"/>' +
      '</svg>',

    statue:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="ck-tg" x1=".2" y1="0" x2=".85" y2="1">' +
      '<stop offset="0" stop-color="#5b616d"/><stop offset=".55" stop-color="#454a54"/>' +
      '<stop offset="1" stop-color="#2c3038"/></linearGradient></defs>' +
      '<path d="M20 118 h60 c1.6 0 2-1 1.4-2.4 l-4-9.6 H22.6 l-4 9.6 C18 117 18.4 118 20 118 z" ' +
      'fill="#2b2e35" stroke="#14161a" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M50 55 c-9 0-13 6-14 16 l-4 35 h36 l-4-35 c-1-10-5-16-14-16 z" ' +
      'fill="url(#ck-tg)" stroke="#14161a" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M37.5 73 c-1.6 11-2.8 22-3.6 32" fill="none" stroke="#79818f" stroke-width="2.4" opacity=".6"/>' +
      '<circle cx="50" cy="42" r="12" fill="url(#ck-tg)" stroke="#14161a" stroke-width="2.4"/>' +
      '<path d="M41.5 35.5 a12 12 0 0 1 4-8" fill="none" stroke="#828a98" stroke-width="2.2" opacity=".65"/>' +
      '<path d="M38.5 30.5 c7.5-3 15.5-3 23 0" fill="none" stroke="#14161a" stroke-width="2.4"/>' +
      '<path d="M38 74 c8 2 16 2 24 0 M36.6 88 c9 2 18 2 27 0" fill="none" stroke="#252931" stroke-width="2" opacity=".9"/>' +
      '</svg>',

    /* A brass key, propped upright against nothing in particular. Small and
     * slight, because it is the lightest thing in the kingdom — and brass, so
     * it belongs to the same family of fittings as the gate and the lock. */
    key:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<ellipse cx="50" cy="115" rx="13" ry="3.6" fill="#a08a5e" stroke="#6b501a" stroke-width="1.4"/>' +
      '<path d="M50 58 v54" fill="none" stroke="#7d5f22" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M50 58 v54" fill="none" stroke="#d8ad52" stroke-width="4.6" stroke-linecap="round"/>' +
      '<path d="M53 88 h13 v7 h-13 z M53 102 h9 v7 h-9 z" ' +
      'fill="#d8ad52" stroke="#7d5f22" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="44" r="16" fill="#d8ad52" stroke="#7d5f22" stroke-width="3"/>' +
      '<circle cx="50" cy="44" r="7.5" fill="#efe2c4" stroke="#7d5f22" stroke-width="2.4"/>' +
      '<path d="M40 36 a16 16 0 0 1 8-6.5" fill="none" stroke="#f6e3b0" stroke-width="2.8" ' +
      'opacity=".75" stroke-linecap="round"/>' +
      '</svg>'
  };

  /* ---- token: medallions. Shape carries the meaning, not only colour ----
   * royals are round, freight is round, the immovable statue is the only
   * square one — so it is still identifiable in greyscale. */

  ART_SETS.token = {
    king:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="70" r="34" fill="#f0e3c4" stroke="#8a6f34" stroke-width="5"/>' +
      '<circle cx="50" cy="70" r="26" fill="none" stroke="#d0a84f" stroke-width="2.4" opacity=".9"/>' +
      '<path d="M35 82 l-4-25 11 8 8-15 8 15 11-8 -4 25 z" fill="#c69a3f" stroke="#6b501a" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M31 60 a34 34 0 0 1 16-18" stroke="#fffaee" stroke-width="4" opacity=".7" fill="none" stroke-linecap="round"/>' +
      '<path d="M32 112 h36 v-6 H32 z" fill="#a8946e" stroke="#6b5a3d" stroke-width="2.2"/>' +
      '</svg>',

    queen:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="72" r="30" fill="#f0dced" stroke="#8a5f80" stroke-width="5"/>' +
      '<circle cx="50" cy="72" r="22" fill="none" stroke="#c48fb8" stroke-width="2.4" opacity=".9"/>' +
      '<path d="M38 82 l-3-21 8 7 7-13 7 13 8-7 -3 21 z" fill="#c69a3f" stroke="#6b501a" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="55" r="2.6" fill="#c69a3f" stroke="none"/>' +
      '<path d="M33 64 a30 30 0 0 1 14-16" stroke="#fff6fd" stroke-width="3.6" opacity=".7" fill="none" stroke-linecap="round"/>' +
      '<path d="M34 112 h32 v-6 H34 z" fill="#9c839a" stroke="#5f4a5e" stroke-width="2.2"/>' +
      '</svg>',

    barrel:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="78" r="26" fill="#c08e52" stroke="#4a3018" stroke-width="4.5"/>' +
      '<path d="M28 68 h44 M28 88 h44" stroke="#4a3018" stroke-width="3.4" opacity=".85" fill="none"/>' +
      '<path d="M50 52 v52" stroke="#4a3018" stroke-width="2.4" opacity=".55" fill="none"/>' +
      '<path d="M32 70 a26 26 0 0 1 12-14" stroke="#eec894" stroke-width="3.4" opacity=".7" fill="none" stroke-linecap="round"/>' +
      '</svg>',

    stone:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="74" r="30" fill="#a5a199" stroke="#3f3d38" stroke-width="4.5"/>' +
      '<path d="M38 62 h24 v24 h-24 z" fill="#c0bcb2" stroke="#3f3d38" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M38 74 h24 M50 62 v24" stroke="#3f3d38" stroke-width="2.2" opacity=".7" fill="none"/>' +
      '<path d="M32 66 a30 30 0 0 1 14-17" stroke="#dedad0" stroke-width="3.6" opacity=".6" fill="none" stroke-linecap="round"/>' +
      '</svg>',

    iron:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="70" r="34" fill="#3f4450" stroke="#12151a" stroke-width="5"/>' +
      '<circle cx="50" cy="70" r="26" fill="none" stroke="#727a8c" stroke-width="2.4" opacity=".8"/>' +
      '<text x="50" y="82" font-size="30" font-family="Georgia,serif" fill="#aab2c4" ' +
      'stroke="none" text-anchor="middle">IV</text>' +
      '<path d="M30 58 a34 34 0 0 1 16-18" stroke="#8b93a5" stroke-width="4" opacity=".7" fill="none" stroke-linecap="round"/>' +
      '</svg>',

    marble:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><radialGradient id="tk-mg" cx=".36" cy=".3" r=".82">' +
      '<stop offset="0" stop-color="#f8fdff"/><stop offset=".45" stop-color="#96c8e2"/>' +
      '<stop offset="1" stop-color="#33607f"/></radialGradient></defs>' +
      '<circle cx="50" cy="80" r="26" fill="url(#tk-mg)" stroke="#22485f" stroke-width="4.5"/>' +
      '<ellipse cx="41" cy="70" rx="7" ry="5" fill="#fff" stroke="none" opacity=".85" transform="rotate(-28 41 70)"/>' +
      '</svg>',

    statue:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<path d="M20 40 h60 v60 h-60 z" fill="#3a3f49" stroke="#0f1114" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M40 92 l3-38 h14 l3 38 z" fill="#565c68" stroke="#0f1114" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M32 100 h36" stroke="#0f1114" stroke-width="4" fill="none"/>' +
      '<path d="M26 46 h20" stroke="#767e8c" stroke-width="3.4" opacity=".7" fill="none" stroke-linecap="round"/>' +
      '</svg>',

    /* The smallest medallion on the board, and the only one struck in brass. */
    key:
      '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<circle cx="50" cy="82" r="23" fill="#e8d3a0" stroke="#8a6f34" stroke-width="4.5"/>' +
      '<circle cx="43" cy="74" r="7.5" fill="none" stroke="#7d5f22" stroke-width="4"/>' +
      '<path d="M48 79 l14 14" fill="none" stroke="#7d5f22" stroke-width="4.6" stroke-linecap="round"/>' +
      '<path d="M56 87 l4 4 M60 91 l4 4" fill="none" stroke="#7d5f22" stroke-width="4.6" ' +
      'stroke-linecap="round"/>' +
      '<path d="M34 74 a23 23 0 0 1 11-12" stroke="#fff6df" stroke-width="3.4" opacity=".7" ' +
      'fill="none" stroke-linecap="round"/>' +
      '</svg>'
  };

  var PIECE_SETS = ['carved', 'token'];
  var ART = ART_SETS.carved;

  var ARROW_ART =
    '<svg class="ledge" viewBox="0 0 40 40" aria-hidden="true">' +
    '<path d="M13 10 L25 20 L13 30" stroke-width="4"/>' +
    '<path d="M24 10 L36 20 L24 30" stroke-width="4" opacity=".45"/></svg>';

  var PORTCULLIS_ART =
    '<div class="gate-frame"></div><div class="gate-bars">' +
    '<i></i><i></i><i></i><i></i></div>';

  /* A barred block with a keyhole. Nothing shifts it: a royal has to walk up
   * with a key and spend it, and then it is plain floor for good. */
  var LOCK_ART =
    '<div class="lock-slab"><i></i><i></i><i></i></div>' +
    '<svg class="lock-plate" viewBox="0 0 40 40" aria-hidden="true">' +
    '<path d="M14.5 17 v-3.5 a5.5 5.5 0 0 1 11 0 V17" class="lock-shackle" fill="none"/>' +
    '<rect x="10" y="17" width="20" height="15" rx="2.6" class="lock-body"/>' +
    '<circle cx="20" cy="23.5" r="2.6" class="lock-hole"/>' +
    '<path d="M20 25 l-1.8 5.4 h3.6 z" class="lock-hole"/></svg>';

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
    this.set = 'carved';
  }

  Renderer.prototype.artFor = function (p) {
    var set = ART_SETS[this.set] || ART_SETS.carved;
    return set[p.type] || set.stone || ART_SETS.carved.stone;
  };

  /* Swap the carving. Only the figure is redrawn — position, selection, pips
   * and the stack badge all belong to the piece element around it. */
  Renderer.prototype.setPieceSet = function (name) {
    if (!ART_SETS[name] || name === this.set) return;
    this.set = name;
    var self = this;
    Object.keys(this.pieceEls).forEach(function (id) {
      var el = self.pieceEls[id];
      var fig = el.querySelector('.p-fig');
      if (fig) fig.innerHTML = ART_SETS[name][el.dataset.type] || ART_SETS[name].stone;
    });
  };

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
        /* also as custom properties: the board-wide grain needs to know where
           on the slab this tile sits so the texture lines up across tiles */
        el.style.setProperty('--col', c);
        el.style.setProperty('--row', r);
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
        } else if (cell.t === 'lock') {
          top.innerHTML = LOCK_ART;
          el.setAttribute('aria-label', 'Locked block');
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

  /* Slide the fulcrum under the board. The column is the level's own and does
   * not change during play, so this runs once per level, on mount. */
  Renderer.prototype.setPivot = function (col, instant) {
    if (col === this.pivot) return;
    this.pivot = col;
    if (instant) this.scene.classList.add('no-pivot-anim');
    this.scene.style.setProperty('--pivot-col', String(col));
    if (instant) {
      void this.scene.offsetWidth;
      this.scene.classList.remove('no-pivot-anim');
    }
  };

  Renderer.prototype.cellAt = function (c, r) {
    return this.cells[r * GRID + c];
  };

  /* Floors that have given way, portcullises that are up, and locks that have
   * been spent — a spent one is ordinary floor and says so. */
  Renderer.prototype.applyTiles = function (broken, gates, opened) {
    var self = this, level = this.level;
    for (var i = 0; i < level.fragiles.length; i++) {
      var f = level.fragiles[i];
      self.cellAt(f.col, f.row).classList.toggle('broken', !!(broken && broken[f.col + ',' + f.row]));
    }
    for (var j = 0; j < level.doors.length; j++) {
      var d = level.doors[j];
      self.cellAt(d.col, d.row).classList.toggle('open', !!gates);
    }
    for (var k = 0; k < level.locks.length; k++) {
      var lk = level.locks[k];
      var cell = self.cellAt(lk.col, lk.row);
      var done = !!(opened && opened[lk.col + ',' + lk.row]);
      cell.classList.toggle('unlocked', done);
      cell.setAttribute('aria-label', done ? 'Opened lock' : 'Locked block');
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
      el.dataset.type = p.type;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', E.movableP(p) ? '0' : '-1');
      el.setAttribute('aria-label',
        (p.label || type.name) + ', weight ' + E.weightOf(p) +
        (p.type === 'key' ? ', for the King or Queen to carry'
                          : E.movableP(p) ? '' : ', immovable'));

      var pips = '';
      for (var i = 0; i < E.weightOf(p); i++) pips += '<i></i>';

      el.innerHTML =
        '<div class="p-shadow"></div>' +
        '<div class="p-ring"></div>' +
        '<div class="p-fig">' + self.artFor(p) + '</div>' +
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
    if (opts.broken !== undefined || opts.gates !== undefined || opts.opened !== undefined) {
      this.applyTiles(opts.broken, opts.gates, opts.opened);
    }
    this.applyPlates(pieces);

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
        /* a key in hand rides small and close, rather than standing about */
        el.classList.toggle('carried', !!p.held);

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
    /* the lean, signed and unsigned, for anything that has to shift with the
       light rather than rotate with the frame: cast shadows, contact shadows */
    this.scene.style.setProperty('--lean', clamped.toFixed(3));
    this.scene.style.setProperty('--lean-abs', Math.abs(clamped).toFixed(3));
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
      c.classList.remove('target', 'shove', 'risky', 'crumbles', 'unlocks');
    });
    if (!moves) return;

    moves.forEach(function (m, i) {
      var cell = self.cellAt(m.col, m.row);
      cell.classList.add('target');
      /* the options bloom outward in the order the engine listed them, which
         is a beat of life for something that would otherwise all appear at once */
      cell.style.setProperty('--i', i);
      if (m.pushes && m.pushes.length) cell.classList.add('shove');
      if (m.breaks) cell.classList.add('crumbles');
      if (m.opens) cell.classList.add('unlocks');
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
    ART_SETS: ART_SETS,
    PIECE_SETS: PIECE_SETS,
    CROWN_ART: CROWN_ART,
    HEART_ART: HEART_ART,
    MAX_TILT: MAX_TILT
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
