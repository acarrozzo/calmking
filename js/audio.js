/* Calm King — small synthesised sound kit. No audio files, no music bed.
 * Everything is a short physical noise: wood, stone, brass, a creak.
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, enabled = true, volume = 0.7;

  function ready() {
    if (ctx) return ctx.state !== 'closed';
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return true;
  }

  /* the browser wants a gesture before it will make noise */
  function unlock() {
    if (!ready()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function env(node, t0, attack, hold, release, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    node.connect(g);
    g.connect(master);
    return g;
  }

  function tone(freq, type, t0, attack, hold, release, peak, bendTo) {
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (bendTo) o.frequency.exponentialRampToValueAtTime(bendTo, t0 + attack + hold + release);
    env(o, t0, attack, hold, release, peak);
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.05);
    return o;
  }

  var noiseBuf = null;
  function noise(t0, dur, peak, filterType, freq, q) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      /* deterministic pseudo-noise: the game promises no randomness anywhere */
      var s = 12345;
      for (var i = 0; i < d.length; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (s / 0x3fffffff) - 1;
      }
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 1;
    src.connect(f);
    env(f, t0, 0.002, dur * 0.25, dur, peak);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  var SFX = {
    select: function (t) { tone(720, 'sine', t, 0.004, 0.01, 0.09, 0.10); },
    deny:   function (t) { tone(150, 'sine', t, 0.004, 0.02, 0.10, 0.11, 120); },

    /* wooden knock — a light piece finding its tile */
    wood: function (t) {
      tone(240, 'triangle', t, 0.002, 0.008, 0.10, 0.16, 190);
      noise(t, 0.05, 0.06, 'bandpass', 1500, 1.2);
    },
    /* stone tap */
    stone: function (t) {
      tone(170, 'sine', t, 0.002, 0.01, 0.16, 0.20, 130);
      noise(t, 0.06, 0.05, 'bandpass', 700, 0.8);
    },
    /* iron — heavier, longer, a hint of ring */
    iron: function (t) {
      tone(96, 'sine', t, 0.003, 0.02, 0.34, 0.26, 74);
      tone(287, 'sine', t, 0.003, 0.02, 0.22, 0.05);
      noise(t, 0.09, 0.05, 'lowpass', 380, 0.6);
    },
    /* marble rolling one tile */
    roll: function (t) {
      noise(t, 0.13, 0.05, 'bandpass', 2200, 2.4);
      tone(430, 'sine', t, 0.01, 0.03, 0.10, 0.05, 520);
    },
    /* board creak as the frame takes up a new angle */
    creak: function (t, amount) {
      var a = Math.min(1, Math.max(0, amount || 0.5));
      noise(t, 0.20 + a * 0.2, 0.012 + a * 0.03, 'bandpass', 300 + a * 260, 7);
      tone(58 + a * 26, 'sine', t, 0.05, 0.05, 0.30, 0.03 + a * 0.03);
    },
    warn: function (t) {
      tone(392, 'sine', t, 0.03, 0.05, 0.36, 0.055);
      tone(588, 'sine', t + 0.02, 0.03, 0.04, 0.30, 0.028);
    },
    tip: function (t) {
      tone(210, 'sine', t, 0.01, 0.04, 0.55, 0.16, 62);
      noise(t + 0.03, 0.45, 0.07, 'lowpass', 900, 0.6);
      tone(150, 'triangle', t + 0.10, 0.01, 0.03, 0.40, 0.08, 48);
    },
    win: function (t) {
      /* a warm open fifth, then the octave */
      [[392, 0], [587.33, 0.09], [783.99, 0.19]].forEach(function (n) {
        tone(n[0], 'sine', t + n[1], 0.02, 0.10, 0.85, 0.12);
        tone(n[0] * 2, 'sine', t + n[1], 0.02, 0.06, 0.55, 0.03);
      });
    },
    crown: function (t) { tone(1046.5, 'sine', t, 0.01, 0.04, 0.45, 0.09); },
    gate:  function (t) { noise(t, 0.30, 0.05, 'bandpass', 520, 3); tone(196, 'sine', t, 0.02, 0.08, 0.5, 0.06); }
  };

  var API = {
    unlock: unlock,
    setEnabled: function (v) { enabled = !!v; },
    setVolume: function (v) { volume = v; if (master) master.gain.value = v; },
    play: function (name, arg, delay) {
      if (!enabled || !ready()) return;
      if (ctx.state === 'suspended') ctx.resume();
      var fn = SFX[name];
      if (!fn) return;
      try { fn(ctx.currentTime + (delay || 0), arg); } catch (e) { /* never break play */ }
    },
    /* map a piece to the material it sounds like */
    forPiece: function (type) {
      if (type === 'iron' || type === 'statue') return 'iron';
      if (type === 'stone') return 'stone';
      if (type === 'marble') return 'roll';
      return 'wood';
    }
  };

  root.CK = root.CK || {};
  root.CK.audio = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
