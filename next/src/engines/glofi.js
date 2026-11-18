// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { cur, once, tr } from './gcore.js';

// src/lofi.js
const LOFI_SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10] };
// src/lofi.js
const LOFI_PROGS = {
  maj: [[1, 4, 0, 5], [0, 5, 1, 4], [3, 2, 1, 0], [3, 4, 2, 5], [5, 3, 0, 4], [1, 4, 0, 0], [3, 0, 1, 5], [0, 2, 3, 4], [3, 4, 5, 0]],
  min: [[0, 5, 2, 6], [0, 3, 6, 2], [5, 6, 0, 0], [3, 6, 2, 5], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 5, 3], [5, 3, 0, 6]],
  dor: [[0, 3, 0, 3], [0, 1, 2, 1], [0, 3, 0, 4], [0, 2, 3, 3], [0, 6, 3, 0]]
};
// src/lofi.js
const LOFI_PENT = { maj: [0, 1, 2, 4, 5], min: [0, 2, 3, 4, 6], dor: [0, 2, 3, 4, 6] };
// src/lofi.js
const LOFI_KICKS = [[0, 10], [0, 7, 10], [0, 3, 10], [0, 8, 11], [0, 6, 10], [0, 10, 15], [0, 5, 10]];
// src/lofi.js
const LOFI_STYLES = [
  { id: 'rain', name: 'Rainy window', bpm: [66, 74], modes: ['min', 'dor', 'maj', 'min'], keys: ['rhodes'], mel: ['bell', 'vibes'], kit: ['brush', 'rim'], amb: 'rain', swing: [.56, .6], cut: 2700, wow: 1, comp: ['hold', 'push', 'lazy'], pad: .5, dens: .8 },
  { id: 'library', name: 'Late library', bpm: [74, 82], modes: ['maj', 'min', 'dor'], keys: ['piano'], mel: ['lead', 'vibes', 'bell'], kit: ['rim', 'snare'], amb: 'vinyl', swing: [.55, .6], cut: 3000, wow: 1, comp: ['push', 'lazy', 'two'], pad: 0, dens: .9 },
  { id: 'coffee', name: 'Morning coffee', bpm: [82, 92], modes: ['maj', 'maj', 'dor'], keys: ['guitar', 'rhodes'], mel: ['bell', 'pluck', 'vibes'], kit: ['snare', 'rim'], amb: 'vinyl', swing: [.54, .58], cut: 3900, wow: .7, comp: ['push', 'two', 'arp'], pad: 0, dens: 1 },
  { id: 'night', name: 'Night bus', bpm: [68, 76], modes: ['min', 'min', 'dor'], keys: ['rhodes'], mel: ['lead', 'bell'], kit: ['clap', 'snare'], amb: 'vinyl', swing: [.56, .62], cut: 2300, wow: 1.2, comp: ['hold', 'lazy'], pad: 1, dens: .7, half: 1 },
  { id: 'tape', name: 'Sunday tape', bpm: [76, 84], modes: ['maj', 'min', 'dor', 'maj'], keys: ['piano', 'rhodes'], mel: ['bell', 'pluck'], kit: ['brush', 'snare'], amb: 'vinyl2', swing: [.56, .6], cut: 2400, wow: 2.2, comp: ['push', 'lazy', 'arp'], pad: .4, dens: .9 },
  { id: 'garden', name: 'Garden', bpm: [86, 96], modes: ['maj', 'dor', 'maj'], keys: ['guitar'], mel: ['vibes', 'lead', 'bell'], kit: ['rim'], amb: 'none', swing: [.5, .52], cut: 4300, wow: .6, comp: ['bossa', 'arp'], pad: 0, dens: 1, bossa: 1 },
  { id: 'blue', name: 'Blue hour', bpm: [80, 88], modes: ['dor', 'min', 'dor'], keys: ['rhodes', 'piano'], mel: ['vibes', 'lead'], kit: ['snare', 'brush'], amb: 'vinyl', swing: [.6, .64], cut: 3400, wow: 1, comp: ['push', 'two'], pad: 0, dens: 1, walk: 1 },
  { id: 'quiet', name: 'Quiet desk', bpm: [60, 70], modes: ['maj', 'min', 'dor', 'maj'], keys: ['piano', 'rhodes', 'guitar'], mel: ['bell', 'vibes'], kit: [], amb: 'rain', swing: [.5, .5], cut: 2600, wow: 1.2, comp: ['arp', 'hold'], pad: 1, dens: .6, nodrums: 1 }
];
// src/lofi.js
function lofiRng(seed) {   // mulberry32: the same seed always gives the same track
  let a = (seed >>> 0) || 1;
  return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// src/lofi.js
function lofiNear(pc, c) { let m = c - (((c - pc) % 12) + 12) % 12; if (c - m > 6) m += 12; return m; }
// src/lofi.js
function lofiCompose(seed, styleId) {
  const r = lofiRng(seed), pick = a => a[Math.floor(r() * a.length)], rr = (a, b) => a + r() * (b - a);
  const S = LOFI_STYLES.find(s => s.id === styleId) || pick(LOFI_STYLES);
  const mode = pick(S.modes), sc = LOFI_SCALES[mode], tonic = Math.floor(r() * 12);
  const bpm = Math.round(rr(S.bpm[0], S.bpm[1])), swing = rr(S.swing[0], S.swing[1]);
  const cl = bpm >= 84 && r() < .5 ? 2 : 1;   // bars a chord lasts
  const progA = pick(LOFI_PROGS[mode]); let progB = pick(LOFI_PROGS[mode]); if (progB === progA) progB = LOFI_PROGS[mode][(LOFI_PROGS[mode].indexOf(progA) + 1) % LOFI_PROGS[mode].length];
  const centre = 59 + Math.floor(r() * 6), comp = pick(S.comp), kit = S.kit.length ? pick(S.kit) : '', kick = pick(LOFI_KICKS);
  const keys = pick(S.keys), mel = pick(S.mel), strum = rr(.02, .06);
  const pc = d => (tonic + sc[((d % 7) + 7) % 7]) % 12;
  const chord = d => {
    const root = pc(d), ninth = pc(d + 1), tones = [pc(d + 2), pc(d + 4), pc(d + 6), ((ninth - root + 12) % 12) === 2 ? ninth : root];
    return { root, tones, notes: [...new Set(tones.map(p => lofiNear(p, centre)))].sort((a, b) => a - b), bass: 38 + ((root - 38) % 12 + 12) % 12 };
  };
  const ev = [], put = (t, k, n, d, v) => ev.push([Math.max(0, t), k, n, d, Math.round(Math.min(1, Math.max(.05, v)) * 100) / 100]);
  // Swing: the second and fourth sixteenth of each beat arrive late.
  const sw = step => Math.floor(step / 4) + [0, swing / 2, .5, .5 + swing / 2][step % 4];
  const hum = () => (r() - .5) * .025;

  // The tune: five-note scale, a two-bar idea that comes back, and an answer that ends at home.
  const melLo = mel === 'lead' ? 62 : 67, pent = [];
  for (let m = melLo; m <= melLo + 19; m++) if (LOFI_PENT[mode].some(d => (tonic + sc[d]) % 12 === m % 12)) pent.push(m);
  const walk = (i) => { const hi = pent.length - 1; let j = i + pick(i > hi - 2 ? [-2, -1, -1, 0] : i < 2 ? [2, 1, 1, 0] : [-2, -1, -1, 1, 1, 2, 0]); return Math.min(hi, Math.max(0, j)); };
  const phrase = () => {
    const rhy = [];
    for (let b = 0; b < 2; b++) for (let s = 0; s < 8; s++) {
      let w = (s === 0 ? .6 : s === 4 ? .45 : s % 2 === 0 ? .32 : .22) * S.dens;
      if (b === 1 && s >= 5) w *= .2;
      if (r() < w) rhy.push(b * 8 + s);
    }
    for (const s of [0, 3, 6, 10]) if (rhy.length < 4 && !rhy.includes(s)) rhy.push(s);
    rhy.sort((a, b) => a - b);
    let i = 1 + Math.floor(r() * (pent.length - 2));
    const first = rhy.map(s => ({ s, i: (i = walk(i)) })), bar3 = first.filter(n => n.s < 8).map(n => ({ s: n.s + 16, i: n.i }));
    i = bar3.length ? bar3[bar3.length - 1].i : i;
    const bar4 = first.filter(n => n.s >= 8).map(n => ({ s: n.s + 16, i: (i = walk(i)) }));
    const all = first.concat(bar3, bar4), last = all[all.length - 1];
    // The answer ends on the home note or the fifth, whichever is nearer.
    let best = last.i, bd = 99; pent.forEach((m, k) => { const p = (m - tonic + 120) % 12; if ((p === 0 || p === 7) && Math.abs(k - last.i) < bd) { bd = Math.abs(k - last.i); best = k; } }); last.i = best;
    all.forEach((n, k) => { n.len = k < all.length - 1 ? Math.min(all[k + 1].s - n.s, 4) : Math.min(32 - n.s, 6); });
    return all;
  };
  const tunes = [phrase(), phrase()]; tunes[2] = tunes[0].map(n => ({ s: n.s, len: n.len, i: Math.min(pent.length - 1, n.i + 1) }));
  const sing = (bar0, tune, prog, vel) => {
    for (const n of tune) {
      let m = pent[n.i];
      if (n.s % 8 === 0) {   // a note on the first beat of a bar leans on the chord under it
        const c = chord(prog[Math.floor((bar0 + Math.floor(n.s / 8)) / cl) % prog.length]), ok = c.tones.concat(c.root);
        let bd = 99; pent.forEach((p, k) => { if (Math.abs(k - n.i) <= 2 && ok.includes(p % 12) && Math.abs(k - n.i) < bd) { bd = Math.abs(k - n.i); m = p; } });
      }
      put(bar0 * 4 + n.s / 2 + .03 + hum(), 'm', m, n.len / 2 * .92, vel * rr(.75, 1));
    }
  };

  const L = 4 * cl, sections = [
    { bars: 4, keys: 1, soft: 1 },
    { bars: 8, keys: 1, bass: 1, drums: 1 },
    { bars: 8, keys: 1, bass: 1, drums: 1, mel: 0 },
    { bars: L === 4 && r() < .5 ? 4 : 8, keys: 1, bass: 1, drums: 2, mel: 1, prog: progB, arp: 1 },
    { bars: 8, keys: 1, bass: 1, drums: 1, mel: 0 },
    { bars: 8, keys: 1, bass: 1, drums: 1, mel: 2 },
    { bars: 4, keys: 1, soft: 1 }
  ];
  let bar = 0;
  for (const sec of sections) {
    const prog = sec.prog || progA, at = b => chord(prog[Math.floor(b / cl) % prog.length]);
    for (let b = 0; b < sec.bars; b++) {
      const t = (bar + b) * 4, c = at(b), nx = at(b + 1), again = cl === 2 && b % 2 === 1, how = sec.arp && comp !== 'arp' && r() < .6 ? 'arp' : comp, kv = sec.soft ? .5 : .62;
      if (sec.keys) {
        const hit = (bt, d, v) => c.notes.forEach((n, i) => put(t + bt + i * strum * rr(.7, 1.2) + hum(), 'k', n, d, v * rr(.85, 1) * (i === c.notes.length - 1 ? 1.08 : 1)));
        if (how === 'hold') { hit(0, again ? 3 : 3.8, kv); if (again && r() < .6) hit(2.5, 1.3, kv * .7); }
        else if (how === 'push') { hit(0, 1.4, kv); hit(1.5, 2.2, kv * .8); if (r() < .3) hit(3.5, .4, kv * .55); }
        else if (how === 'lazy') { hit(0, 2.4, kv); hit(2.5, 1.3, kv * .72); }
        else if (how === 'two') { hit(0, 1.8, kv); hit(2, 1.8, kv * .8); }
        else if (how === 'bossa') { for (const [bt, d, v] of [[0, 1.3, 1], [1.5, .9, .75], [2.5, .9, .85], [3.5, .5, .6]]) hit(bt, d, kv * v); }
        else {   // arp: the chord one note at a time, up and partly back
          const ns = c.notes, order = [0, 1, 2, 3, 2, 1, 3, 2].map(i => ns[Math.min(i, ns.length - 1)]);
          order.forEach((n, i) => { if (i < 4 || r() < .75) put(t + i * .5 + hum(), 'k', i === 6 ? n + 12 : n, i < 4 ? 4 - i * .5 : .9, kv * (i % 2 ? .7 : .9) * rr(.85, 1)); });
        }
        if (S.pad && b % cl === 0) c.notes.slice(0, 3).forEach(n => put(t, 'p', n, 4 * cl + .5, S.pad * (sec.soft ? .7 : .55)));
      }
      if (sec.bass) {
        const v = .7;
        if (S.walk && sec.drums === 1) {   // walking: root, a chord note, the fifth, then a step into the next chord
          const steps = [c.bass, lofiNear(c.tones[0], c.bass + 4), lofiNear(c.tones[1], c.bass + 5), nx.bass + (r() < .5 ? 1 : -2)];
          steps.forEach((n, i) => { if (i === 0 || r() < .8) put(t + i + hum(), 'b', n, .9, v * (i ? .8 : 1)); });
        } else if (S.bossa) { put(t, 'b', c.bass, 1.4, v); put(t + 1.5, 'b', c.bass + 7, .5, v * .7); put(t + 2, 'b', c.bass + 7, 1.4, v * .85); put(t + 3.5, 'b', c.bass, .5, v * .7); }
        else {
          put(t + hum(), 'b', c.bass, 2.3, v);
          if (r() < .7) put(t + 2.5 + hum(), 'b', r() < .3 ? c.bass + 7 : c.bass, r() < .5 ? .9 : 1.3, v * .8);
          if (r() < .35 && nx.bass !== c.bass) put(t + 3.5, 'b', nx.bass + (r() < .5 ? -2 : 2), .45, v * .65);
        }
      }
      if (sec.drums && kit) {
        const fill = b % 8 === 7, light = sec.drums === 2;
        if (S.bossa) {
          for (const s of [0, 6, 8, 14]) put(sw(s) + t + hum(), 'K', 0, 0, s % 8 ? .5 : .75);
          if (!light) for (const s of [3, 6, 10, 12]) put(sw(s) + t + hum(), 'S', 0, 0, .5 * rr(.8, 1));
        } else {
          if (!light) for (const s of kick) if (!(fill && s > 8) && (s === 0 || r() < .9)) put(sw(s) + t + hum() * .5, 'K', 0, 0, s === 0 ? .95 : .7 * rr(.8, 1));
          if (!light) for (const s of (S.half ? [8] : [4, 12])) put(sw(s) + t + .02 + hum() * .5, 'S', 0, 0, .8 * rr(.85, 1));   // the backbeat drags a little
          if (!light && fill) { for (const s of [13, 14, 15]) if (r() < .6) put(sw(s) + t + hum(), 'S', 0, 0, .3 * rr(.6, 1)); }
          else if (!light && r() < .2) put(sw(pick([7, 9, 15])) + t, 'S', 0, 0, .22);   // a ghost note now and then
        }
        for (let s = 0; s < 16; s++) {
          const eighth = s % 2 === 0;
          if (eighth || r() < (light ? .05 : .18)) put(sw(s) + t + hum(), s === 14 && r() < .25 ? 'O' : 'H', 0, 0, (eighth ? (s % 4 === 0 ? .55 : .8) : .35) * rr(.7, 1) * (light ? .7 : 1));
        }
      }
      if (sec.mel !== undefined && b % 4 === 0 && (b % 8 === 0 || r() < .65 * S.dens)) sing(bar + b, tunes[sec.mel], prog, .7);
    }
    bar += sec.bars;
  }
  ev.sort((a, b) => a[0] - b[0]);
  return { seed, style: S.id, bpm, swing, mode, tonic, beats: bar * 4, ev, keys, mel, kit, amb: S.amb, cut: S.cut, wow: S.wow };
}
// src/lofi.js
const lofiHz = m => 440 * Math.pow(2, (m - 69) / 12);
// src/lofi.js
function lofiEngine(ctx) {
  const E = { ctx, plk: {} }, sr = ctx.sampleRate;
  E.out = ctx.createGain(); E.out.gain.value = 1;
  E.comp = ctx.createDynamicsCompressor(); E.comp.threshold.value = -14; E.comp.knee.value = 10; E.comp.ratio.value = 2.5; E.comp.attack.value = .01; E.comp.release.value = .25;
  E.comp.connect(E.out); E.out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, sr * 2, sr), nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  E.noise = noise;
  const ir = ctx.createBuffer(2, Math.floor(sr * 2.4), sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const k = 1 - i / d.length; lp += ((Math.random() * 2 - 1) - lp) * .35; d[i] = lp * k * k * k; } }
  E.ir = ir;
  // A record's surface: faint hiss and pops at uneven moments.
  const vin = ctx.createBuffer(1, Math.floor(sr * 6.3), sr), vd = vin.getChannelData(0); let pop = 0;
  for (let i = 0; i < vd.length; i++) { if (Math.random() < 1 / 2600) pop = (Math.random() * 2 - 1) * (Math.random() < .12 ? .5 : .2); vd[i] = (Math.random() * 2 - 1) * .018 + pop; pop *= .55; }
  E.vinyl = vin;
  const wave = [0, 1, .5, .22, .1, .06, .03]; E.piano = ctx.createPeriodicWave(new Float32Array(wave.length), new Float32Array(wave));
  const curve = new Float32Array(1025); for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
  E.curve = curve;
  return E;
}
// src/lofi.js
function lofiPluck(E, n) {
  if (E.plk[n]) return E.plk[n];
  const sr = E.ctx.sampleRate, N = Math.round(sr / lofiHz(n)), buf = E.ctx.createBuffer(1, Math.floor(sr * 2.2), sr), d = buf.getChannelData(0);
  let lp = 0; for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * .45; d[i] = lp; }
  for (let i = N + 1; i < d.length; i++) d[i] = (d[i - N] + d[i - N - 1]) * .4975;
  return (E.plk[n] = { buf, rate: lofiHz(n) * N / sr });
}
// src/lofi.js
function lofiTrack(E, tr, t0) {
  const c = E.ctx, g = (v, to) => { const n = c.createGain(); n.gain.value = v; if (to) n.connect(to); return n; };
  const flt = (type, f, to, q) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; if (to) n.connect(to); return n; };
  const T = { tr, t0, i: 0, spb: 60 / tr.bpm, live: [] }, end = t0 + tr.beats * T.spb, intro = 16 * T.spb;
  T.end = end;
  T.out = g(0, E.comp);
  T.out.gain.setValueAtTime(0, t0); T.out.gain.linearRampToValueAtTime(1, t0 + 1.2);
  T.out.gain.setValueAtTime(1, end - intro * .5); T.out.gain.linearRampToValueAtTime(0, end + .5);
  // Tape: a little drive, a dull top end that opens over the intro and closes over the ending, and a pitch that drifts.
  const shape = c.createWaveShaper(); shape.curve = E.curve; shape.oversample = '2x'; shape.connect(T.out);
  const lp = flt('lowpass', tr.cut, shape, .4);
  lp.frequency.setValueAtTime(700, t0); lp.frequency.exponentialRampToValueAtTime(tr.cut, t0 + intro * .9);
  lp.frequency.setValueAtTime(tr.cut, end - intro * .8); lp.frequency.exponentialRampToValueAtTime(600, end);
  const tape = c.createDelay(.1); tape.delayTime.value = .02; tape.connect(lp);
  const lfo = (hz, depth, param) => { const o = c.createOscillator(), a = g(depth); o.frequency.value = hz; o.connect(a); a.connect(param); o.start(t0); o.stop(end + 3); T.live.push(o); };
  lfo(.31 + (tr.seed % 7) * .02, .0014 * tr.wow, tape.delayTime); lfo(5.9, .00004 * tr.wow, tape.delayTime);
  T.mix = g(.6, tape);
  T.duck = g(1, T.mix);   // the music leans back a touch under each kick
  const verb = c.createConvolver(); verb.buffer = E.ir; const wet = g(.5, T.mix); verb.connect(flt('lowpass', 2400, wet)); T.verb = verb;
  const bus = (level, send) => { const b = g(level, T.duck); if (send) b.connect(g(send, verb)); return b; };
  T.keys = c.createStereoPanner ? c.createStereoPanner() : g(1); T.keys.connect(bus(1, .28));
  if (T.keys.pan) lfo(.23, .3, T.keys.pan);
  T.mel = bus(.8, .45); T.pad = bus(.9, .35); T.bass = bus(1, 0);
  T.drum = flt('lowpass', Math.min(6500, tr.cut * 1.7), g(.5, T.mix)); T.dverb = g(.08, verb);
  // What is in the room. It does not pass through the tape, so it stays steady while the music drifts.
  T.amb = g(lofi.amb ? 1 : 0, T.out);
  const loop = (buf, rate) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(t0, Math.random() * buf.duration); s.stop(end + 3); T.live.push(s); return s; };
  if (tr.amb === 'vinyl' || tr.amb === 'vinyl2') loop(E.vinyl, 1).connect(flt('highpass', 900, flt('lowpass', 7000, g(tr.amb === 'vinyl2' ? .55 : .3, T.amb))));
  if (tr.amb === 'rain') {
    const rain = g(.05, T.amb); loop(E.noise, .93).connect(flt('highpass', 500, flt('lowpass', 3200, rain))); lfo(.07, .015, rain.gain);
    loop(E.noise, .61).connect(flt('lowpass', 380, g(.09, T.amb)));
    loop(E.vinyl, .7).connect(flt('bandpass', 2600, g(.3, T.amb), .8));   // single drops
  }
  return T;
}
// src/lofi.js
function lofiNote(E, T, e) {
  const c = E.ctx, tr = T.tr, t = T.t0 + e[0] * T.spb, k = e[1], v = e[4], dur = e[3] * T.spb, f = lofiHz(e[2]);
  const osc = (type, hz, to, det) => { const o = c.createOscillator(); if (type === 'piano') o.setPeriodicWave(E.piano); else o.type = type; o.frequency.value = hz; if (det) o.detune.value = det; o.connect(to); o.start(t); return o; };
  const gain = to => { const n = c.createGain(); n.gain.value = 0; n.connect(to); return n; };
  // Attack, fall towards a held level, then let go at the end of the note.
  const env = (n, a, peak, fall, hold, rel, stop) => { const p = n.gain, e2 = Math.max(t + a + .01, t + dur); p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(peak * hold, t + a, fall / 3); p.setTargetAtTime(0, e2, rel / 3); for (const o of stop) o.stop(e2 + rel * 2.2); };
  const hitNoise = (to, len) => { const s = c.createBufferSource(); s.buffer = E.noise; s.connect(to); s.start(t, Math.random() * 1.5, len + .05); return s; };
  const lpf = (hz, to) => { const n = c.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = hz; n.connect(to); return n; };
  const voice = (kind, to, oct) => {
    const hz = f * (oct || 1), a = gain(to);
    if (kind === 'rhodes') {
      const car = osc('sine', hz, a), mg = c.createGain(), mod = osc('sine', hz, mg); mg.connect(car.frequency);
      mg.gain.setValueAtTime(hz * (.7 + 1.7 * v), t); mg.gain.setTargetAtTime(hz * .16, t, .13);
      const b = gain(to), tine = osc('sine', hz * 4.01, b); b.gain.setValueAtTime(v * .035, t); b.gain.setTargetAtTime(0, t, .05); tine.stop(t + .5);
      env(a, .004, v * .27, 1.5, .3, .35, [car, mod]);
    } else if (kind === 'piano') {
      const l = lpf(700, a); l.frequency.setValueAtTime(700 + 2800 * v, t); l.frequency.setTargetAtTime(520, t, .4);
      env(a, .012, v * .2, 1.9, .14, .4, [osc('piano', hz, l, -4), osc('piano', hz, l, 5)]);
    } else if (kind === 'guitar' || kind === 'pluck') {
      const p = lofiPluck(E, e[2] + (oct === 2 ? 12 : 0)), s = c.createBufferSource(); s.buffer = p.buf; s.playbackRate.value = p.rate; s.connect(lpf(1500 + 2200 * v, a)); s.start(t);
      env(a, .003, v * 1.4, 3, .5, .3, [s]);
    } else if (kind === 'bell') {
      const b = gain(to), hi = osc('sine', hz * 3, b); b.gain.setValueAtTime(v * .07, t); b.gain.setTargetAtTime(0, t, .06); hi.stop(t + .6);
      env(a, .003, v * .4, .9, 0, .5, [osc('sine', hz, a)]);
    } else if (kind === 'vibes') {
      const b = gain(to), hi = osc('sine', hz * 4, b); b.gain.setValueAtTime(v * .04, t); b.gain.setTargetAtTime(0, t, .1); hi.stop(t + .8);
      const o = osc('sine', hz, a), tg = c.createGain(), trem = osc('sine', 4.6, tg); tg.gain.value = v * .05; tg.connect(a.gain);
      env(a, .004, v * .24, 2.2, 0, .6, [o, trem]);
    } else if (kind === 'lead') {
      const o = osc('triangle', hz, lpf(1500, a)), vg = c.createGain(), vib = osc('sine', 5.1, vg); vg.connect(o.frequency);
      vg.gain.setValueAtTime(0, t); vg.gain.setTargetAtTime(hz * .005, t + .22, .15);
      env(a, .05, v * .21, .6, .75, .25, [o, vib]);
    }
  };
  if (k === 'k') voice(tr.keys, T.keys);
  else if (k === 'm') voice(tr.mel === 'pluck' ? 'pluck' : tr.mel, T.mel);
  else if (k === 'p') {
    const a = gain(T.pad), l = lpf(620, a);
    env(a, 1.1, v * .05, 1, 1, 1.6, [osc('sawtooth', f, l, -9), osc('sawtooth', f, l, 8)]);
  } else if (k === 'b') {
    const a = gain(T.bass), l = lpf(480, a), tri = c.createGain(); tri.gain.value = .3; tri.connect(l);
    env(a, .012, v * .2, .7, .6, .12, [osc('sine', f, l), osc('triangle', f, tri)]);
  } else if (k === 'K') {
    const a = gain(T.drum), o = osc('sine', 48, a); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(46, t + .09);
    a.gain.setValueAtTime(v * .85, t); a.gain.setTargetAtTime(0, t + .03, .085); o.stop(t + .7);
    T.duck.gain.setTargetAtTime(1 - .3 * v, t, .008); T.duck.gain.setTargetAtTime(1, t + .05, .11);
  } else if (k === 'S') {
    const a = gain(T.drum); a.connect(T.dverb);
    const bp = (hz, q) => { const n = c.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = hz; n.Q.value = q; n.connect(a); return n; };
    if (tr.kit === 'rim') { hitNoise(bp(2400, 1.5), .04); const o = osc('triangle', 470, a); o.stop(t + .1); a.gain.setValueAtTime(v * .4, t); a.gain.setTargetAtTime(0, t + .004, .018); }
    else if (tr.kit === 'brush') { hitNoise(bp(3200, .6), .4); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(v * .28, t + .012); a.gain.setTargetAtTime(0, t + .02, .075); }
    else if (tr.kit === 'clap') { hitNoise(bp(1500, 1), .4); for (const d of [0, .011, .022]) { a.gain.setValueAtTime(v * .5, t + d); a.gain.setTargetAtTime(v * .12, t + d + .001, .004); } a.gain.setTargetAtTime(0, t + .03, .06); }
    else { hitNoise(bp(1900, .7), .4); const o = osc('triangle', 185, a); o.stop(t + .12); a.gain.setValueAtTime(v * .42, t); a.gain.setTargetAtTime(0, t + .01, .055); }
  } else if (k === 'H' || k === 'O') {
    const a = gain(T.drum), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800; hp.connect(a); hitNoise(hp, .4);
    a.gain.setValueAtTime(v * .16, t); a.gain.setTargetAtTime(0, t + .004, k === 'O' ? .09 : .02);
  }
}
// src/lofi.js
function lofiSchedule(E, T, until) { const ev = T.tr.ev; while (T.i < ev.length && T.t0 + ev[T.i][0] * T.spb < until) lofiNote(E, T, ev[T.i++]); }
// src/lofi.js
const lofi = { E: null, on: false, vol: .5, amb: false, style: 'mix', cur: null, old: [], timer: 0, last: '', seed: 0, onTrack: null };
// src/lofi.js
const LOFI_AHEAD = 3;   // seconds written ahead, so a tab in the background (timers once a second) never runs dry
// src/lofi.js
function lofiLevel(v) { return Math.pow(v, 1.6); }
// src/lofi.js
function lofiPickStyle() {
  if (lofi.style !== 'mix' && LOFI_STYLES.some(s => s.id === lofi.style)) return lofi.style;
  const rest = LOFI_STYLES.filter(s => s.id !== lofi.last); return rest[Math.floor(Math.random() * rest.length)].id;
}
// src/lofi.js
function lofiBegin(at) {
  const E = lofi.E, id = lofiPickStyle(); lofi.last = id;
  lofi.seed = (Math.random() * 4294967296) >>> 0;
  lofi.cur = lofiTrack(E, lofiCompose(lofi.seed, id), at);
  if (lofi.onTrack) try { lofi.onTrack(lofi.cur.tr); } catch { }
}
// src/lofi.js
function lofiDrop(T, fade) {   // let a track go: quickly fade what is sounding, then take its parts apart
  const c = lofi.E.ctx, now = c.currentTime; T.i = T.tr.ev.length;
  try { T.out.gain.cancelScheduledValues(now); T.out.gain.setTargetAtTime(0, now, fade / 3); } catch { }
  setTimeout(() => { try { T.out.disconnect(); for (const o of T.live) o.stop(); } catch { } }, (fade + .3) * 1000);
}
// src/lofi.js
function lofiTick() {
  const E = lofi.E; if (!E || !lofi.on || !lofi.cur) return;
  const now = E.ctx.currentTime, T = lofi.cur;
  lofiSchedule(E, T, now + LOFI_AHEAD);
  for (const o of lofi.old) lofiSchedule(E, o, now + LOFI_AHEAD);
  lofi.old = lofi.old.filter(o => { if (now < o.end + 4) return true; try { o.out.disconnect(); } catch { } return false; });
  if (now + LOFI_AHEAD > T.end - 1.5) { lofi.old.push(T); lofiBegin(Math.max(now + .1, T.end - 1.5)); lofiSchedule(E, lofi.cur, now + LOFI_AHEAD); }
}
// src/lofi.js
function lofiPlay() {
  try {
    if (!lofi.E) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return false; lofi.E = lofiEngine(new C()); lofi.E.out.gain.value = lofiLevel(lofi.vol); }
    const c = lofi.E.ctx; if (c.state === 'suspended') c.resume();
    lofi.on = true;
    if (!lofi.cur) lofiBegin(c.currentTime + .15);
    if (!lofi.timer) lofi.timer = setInterval(lofiTick, 250);
    lofiTick(); return true;
  } catch { return false; }
}
// src/lofi.js
function lofiPause() { lofi.on = false; if (lofi.timer) { clearInterval(lofi.timer); lofi.timer = 0; } try { if (lofi.E) lofi.E.ctx.suspend(); } catch { } }
// src/lofi.js
function lofiNext() {
  if (!lofi.E || !lofi.cur) return lofiPlay();
  lofiDrop(lofi.cur, .5); for (const o of lofi.old) lofiDrop(o, .3); lofi.old = [];
  lofiBegin(lofi.E.ctx.currentTime + .35); if (lofi.on) lofiTick();
}
// src/lofi.js
function lofiStop() { lofiPause(); try { if (lofi.E) lofi.E.ctx.close(); } catch { } lofi.E = null; lofi.cur = null; lofi.old = []; }
// src/lofi.js
function lofiVolume(v) { lofi.vol = Math.min(1, Math.max(0, +v || 0)); if (lofi.E) lofi.E.out.gain.setTargetAtTime(lofiLevel(lofi.vol), lofi.E.ctx.currentTime, .03); }
// src/lofi.js
function lofiStyle(id) { const was = lofi.style; lofi.style = id; if (id !== was && lofi.cur && id !== 'mix' && lofi.cur.tr.style !== id) lofiNext(); }
// src/lofi.js
function lofiAmb(on) { lofi.amb = !!on; if (lofi.E && lofi.cur) for (const T of [lofi.cur, ...lofi.old]) T.amb.gain.setTargetAtTime(on ? 1 : 0, lofi.E.ctx.currentTime, .2); }
// src/lofi.js
function lofiRender(ctx, tr) {
  const E = lofiEngine(ctx), T = lofiTrack(E, tr, .1), len = ctx.length / ctx.sampleRate;
  const step = at => { lofiSchedule(E, T, at + LOFI_AHEAD); if (at + 2 < len) ctx.suspend(at + 2).then(() => { step(at + 2); ctx.resume(); }); };
  step(0); return T;
}
export { LOFI_STYLES, lofi, lofiCompose, lofiPlay, lofiPause, lofiNext, lofiStop, lofiVolume, lofiStyle, lofiAmb, lofiRender };
