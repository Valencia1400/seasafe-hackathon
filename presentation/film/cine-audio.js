// Builds the film's sound mix offline: the supplied narration (unchanged) + a restrained synthesized music bed + subtle maritime effects.
// Everything except the narration is generated here with Web Audio, so there are no third-party audio files.
const SR = 48000;
const N = { C2: 65.41, D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, C5: 523.25, D1: 36.71, F1: 43.65, Bb1: 58.27, C1: 32.7, D5: 587.33 };
const CH = { Dm: ['D2', 'A2', 'D3', 'F3', 'A3'], Dm9: ['D2', 'A2', 'F3', 'A3', 'E4'], Bb: ['Bb1', 'F2', 'Bb2', 'D3', 'F3'], F: ['F1', 'C3', 'F3', 'A3', 'C4'], C: ['C2', 'G2', 'C3', 'E3', 'G3'],
  Gm: ['G2', 'D3', 'G3', 'Bb3'], Dlow: ['D1', 'D2', 'A2'], Fhi: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4', 'A4'] };

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(2, seconds * SR, SR); let s = 1234567;
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; } }
  return b;
}
function impulse(ctx, seconds, decay) {
  const b = ctx.createBuffer(2, seconds * SR, SR); let s = 987654321;
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; const n = s / 2147483648 - 1; lp += (n - lp) * 0.35; d[i] = lp * Math.pow(1 - i / d.length, decay); } }
  return b;
}

/** plan = { DUR, OFF, cuts:{A..I}, chords:[[t, name, level, cutoff]], thunder:[t], whoosh:[t], ticks:[t], booms:[t], riser:[t0,t1], harbour:[[t0,t1,level]], storm:[t0,t1], pulse:[[t0,t1,level]], motor:[[t0,t1]] } */
export async function buildBed(plan) {
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.DUR * SR), SR);
  const master = ctx.createGain(); master.connect(ctx.destination);
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 3.2, 2.6); const revG = ctx.createGain(); revG.gain.value = 0.55; rev.connect(revG).connect(master);
  const noise = noiseBuffer(ctx, 6);
  let nk = 0; const nsrc = (t0, t1) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(Math.max(0, t0), (nk++ * 0.731) % 3); s.stop(t1); return s; };
  const env = (g, pts) => { g.gain.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) g.gain.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); };

  /* ---- pad chords */
  const music = ctx.createGain(); music.gain.value = 1; music.connect(master); music.connect(rev);
  plan.chords.forEach(([t0, name, level, cutoff], i) => {
    const t1 = (plan.chords[i + 1] ? plan.chords[i + 1][0] : plan.DUR) + 1.6, a = t0 - 1.2;
    const g = ctx.createGain(); env(g, [[a, 0], [t0 + 1.4, level], [t1 - 2.4, level], [t1, 0]]);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.4; f.frequency.setValueAtTime(cutoff * 0.7, Math.max(0, a)); f.frequency.linearRampToValueAtTime(cutoff, t0 + 3);
    f.connect(g).connect(music);
    CH[name].forEach((n, k) => { for (const det of [-6, 7]) { const o = ctx.createOscillator(); o.type = k < 2 ? 'triangle' : 'sawtooth'; o.frequency.value = N[n]; o.detune.value = det + k;
      const og = ctx.createGain(); og.gain.value = (k < 2 ? 0.5 : 0.16) / CH[name].length * 2.2; const pan = ctx.createStereoPanner(); pan.pan.value = (det < 0 ? -1 : 1) * (0.25 + 0.1 * k);
      o.connect(og).connect(pan).connect(f); o.start(Math.max(0, a)); o.stop(t1 + 0.1); } });
  });
  /* ---- soft pulse (arpeggio) that builds in the engineering section */
  for (const [t0, t1, lvl] of plan.pulse) {
    for (let t = t0, i = 0; t < t1; t += 0.5, i++) {
      const ch = [...plan.chords].reverse().find((c) => c[0] <= t + 0.01) || plan.chords[0], notes = CH[ch[1]].slice(2), f = N[notes[i % notes.length]] * 2;
      const k = (t - t0) / (t1 - t0), o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * (0.45 + 0.55 * k), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
      const pan = ctx.createStereoPanner(); pan.pan.value = i % 2 ? 0.35 : -0.35; o.connect(g).connect(pan); pan.connect(music); o.start(t); o.stop(t + 1);
    }
  }
  /* ---- storm: wind, rain, thunder */
  const [s0, s1] = plan.storm;
  { const w = nsrc(0, s1 + 4), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 420;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.21; const lg = ctx.createGain(); lg.gain.value = 190; lfo.connect(lg).connect(bp.frequency); lfo.start(0); lfo.stop(s1 + 4);
    const g = ctx.createGain(); env(g, [[0, 0], [s0 + 0.8, 0.55], [s1 - 1.5, 0.5], [s1 + 3.5, 0]]); w.connect(bp).connect(g).connect(master);
    const r = nsrc(0, s1 + 3), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; const rg = ctx.createGain(); env(rg, [[0, 0], [s0 + 0.6, 0.11], [s1 - 1, 0.1], [s1 + 2.5, 0]]); r.connect(hp).connect(rg).connect(master); }
  for (const t of plan.thunder) { const s = nsrc(t, t + 4.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + 2.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.04); g.gain.exponentialRampToValueAtTime(0.25, t + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + 4.3);
    s.connect(lp).connect(g); g.connect(master); g.connect(rev); }
  /* ---- harbour water lapping */
  for (const [t0, t1, lvl] of plan.harbour) { const s = nsrc(t0 - 1, t1 + 1.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
    const g = ctx.createGain(); env(g, [[t0 - 1, 0], [t0 + 0.8, lvl], [t1 - 0.5, lvl], [t1 + 1.4, 0]]); const sw = ctx.createGain(); sw.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.27; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(sw.gain); lfo.start(Math.max(0, t0 - 1)); lfo.stop(t1 + 1.5);
    s.connect(hp).connect(lp).connect(sw).connect(g).connect(master); }
  /* ---- quiet electric-motor hum when the vessel is under way */
  for (const [t0, t1] of plan.motor) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, Math.max(0, t0)); o.frequency.linearRampToValueAtTime(96, t0 + 1.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 330; const g = ctx.createGain(); env(g, [[t0, 0], [t0 + 1, 0.05], [t1 - 1, 0.05], [t1, 0]]); o.connect(lp).connect(g).connect(master); o.start(Math.max(0, t0)); o.stop(t1 + 0.1); }
  /* ---- transitions, hits, ticks, riser */
  for (const t of plan.whoosh) { const s = nsrc(t - 0.6, t + 0.9), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.setValueAtTime(240, Math.max(0, t - 0.6)); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.1); bp.frequency.exponentialRampToValueAtTime(500, t + 0.8);
    const g = ctx.createGain(); env(g, [[t - 0.6, 0], [t, 0.2], [t + 0.85, 0]]); s.connect(bp).connect(g); g.connect(master); g.connect(rev); }
  for (const t of plan.booms) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(64, t); o.frequency.exponentialRampToValueAtTime(33, t + 1.6); const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4); o.connect(g).connect(master); o.start(t); o.stop(t + 2.5); }
  for (const t of plan.ticks) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.09); const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22); o.connect(g); g.connect(master); g.connect(rev); o.start(t); o.stop(t + 0.25); }
  if (plan.riser) { const [t0, t1] = plan.riser, s = nsrc(t0, t1 + 0.3), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(300, t0); hp.frequency.exponentialRampToValueAtTime(5200, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t1); g.gain.linearRampToValueAtTime(0, t1 + 0.25); s.connect(hp).connect(g); g.connect(master); g.connect(rev); }
  // overall fade at the very end
  master.gain.setValueAtTime(1, plan.DUR - 1.6); master.gain.linearRampToValueAtTime(0, plan.DUR - 0.05);
  return ctx.startRendering();
}

const rms = (buf, t0, t1) => { let s = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = Math.floor(t0 * SR); i < Math.min(d.length, t1 * SR); i++) { s += d[i] * d[i]; n++; } } return Math.sqrt(s / Math.max(1, n)); };

/** Returns { mix: AudioBuffer (stereo 48 kHz, DUR long), info }. Narration is placed at OFF and never altered; the bed is scaled to sit `bedDb` below it. */
export async function buildMix(narrationUrl, plan, bedDb = -15) {
  const raw = await (await fetch(narrationUrl)).arrayBuffer();
  const tmp = new OfflineAudioContext(2, 1, SR), voice = await tmp.decodeAudioData(raw);
  const bed = await buildBed(plan);
  // voice level measured only where the narrator is speaking
  let vs = 0, vn = 0; for (const [a, b] of plan.speech) { const r = rms(voice, a, b); vs += r * r * (b - a); vn += b - a; }
  const vRms = Math.sqrt(vs / vn), bRms = rms(bed, plan.OFF + plan.speech[3][0], plan.DUR - 3), bedGain = vRms * Math.pow(10, bedDb / 20) / Math.max(1e-6, bRms);
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.DUR * SR), SR);
  const out = ctx.createGain(); out.connect(ctx.destination);
  const v = ctx.createBufferSource(); v.buffer = voice; v.connect(out); v.start(plan.OFF);
  const b = ctx.createBufferSource(); b.buffer = bed; const bg = ctx.createGain(); bg.gain.value = bedGain; b.connect(bg).connect(out); b.start(0);
  const mixed = await ctx.startRendering();
  let peak = 0; for (let c = 0; c < 2; c++) { const d = mixed.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const norm = Math.min(1.6, 0.89 / peak); for (let c = 0; c < 2; c++) { const d = mixed.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= norm; }
  return { mix: mixed, info: { narrationSeconds: voice.duration, voiceRms: vRms, bedRms: bRms * bedGain, bedGain, peakBefore: peak, norm } };
}
export { SR };
