// SeaGuardian – 16:9 film in the reference-video style, synced to the narration.
// Every beat is anchored to a word of audio/voiceover.wav (see sync.js), so voice, subtitles and visuals stay connected.
import * as THREE from 'three';
import { createHarbour, createStudio } from './world.js';
import { D2R, clamp, lerp, smooth, easeOut, track, KEY_S1, KEY_S2, KEY_S6, path, ramp, usvState, povPose, s4Offsets, POV_OFFS,
  storm, after, dusk, VO_OFFSET as OFF } from './shared.js';
import { WORDS } from './sync.js';

const SW = 1920, SH = 1080, CW = 1240, CH = 680, FEEDW = 700;
const $ = (id) => document.getElementById(id);
const easeBack = (x) => { x = clamp(x); return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); };

/* ---------------------------------------------------------------- narration anchors (film time = audio time + OFF) */
const norm = (s) => s.replace(/[.,:]/g, '');
const find = (w, n) => { let c = 0; for (const x of WORDS) if (norm(x[0]) === w && c++ === n) return x; throw new Error('anchor word not found: ' + w); };
const A = (w, n = 0) => find(w, n)[1] + OFF;      // start of word
const E = (w, n = 0) => find(w, n)[2] + OFF;      // end of word

// scene cuts sit in the pauses between narration sections
const C1 = (11.56 + 12.48) / 2 + OFF;             // after "…above average."
const C2 = (17.14 + 17.28) / 2 + OFF;             // before "Meet SeaGuardian."
const C3 = (27.42 + 27.54) / 2 + OFF;             // after "…remote observation."
const C4 = A('Our', 1) - 0.15;                    // "Our dashboard…"
const C5 = (44.34 + 45.04) / 2 + OFF;             // before "The goal:"
const DUR = E('ahead') + 2.4;
const CUTS = [0, C1, C2, C3, C4, C5, DUR];
const WARP = [[0, 0], [C1, 9], [C2, 17], [C3, 30], [C4, 42], [C5, 53], [DUR, 60]];     // film time → internal scene time (scenes 1,2,4,5,6)
function warp(tf) { tf = clamp(tf, 0, DUR); for (let i = 0; i < WARP.length - 1; i++) { const [a, ta] = WARP[i], [b, tb] = WARP[i + 1]; if (tf <= b) return ta + (tf - a) / (b - a) * (tb - ta); } return 60; }

/* ---------------------------------------------------------------- renderer (sized to the card) */
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(CW, CH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const harbour = createHarbour(renderer), studio = createStudio(renderer);
const cam = new THREE.PerspectiveCamera(40, CW / CH, 0.1, 2000), pov = new THREE.PerspectiveCamera(60, FEEDW / CH, 0.1, 2000);
const ov = $('ov').getContext('2d'), mapG = $('map').getContext('2d');

/* ---------------------------------------------------------------- scene 3 studio camera, keyed to the words of the prototype sentence */
const K3 = [
  [C2, 205, 7, 66, 0, 7, 0],                                              // "Meet SeaGuardian." – silhouette
  [20.0, 192, 14, 56, 0, 7, 0],
  [A('twin-hull') - 0.3, 180, 21, 44, 0, 7, 0],                            // "twin-hull design" – both pontoons from the bow
  [A('twin-hull') + 1.0, 250, 20, 38, 0, 9, 4],
  [A('propellers') + 0.1, 335, 17, 30, 0, 10, 10],                        // "two propellers" – stern, both props
  [E('propellers') + 0.5, 352, 14, 26, 0, 10, 12],
  [A('rudder') + 0.1, 5, 8, 21, 0, 5, 13],                                // "a rudder" – low behind the rudder
  [E('rudder') + 0.6, 8, 9, 22, 0, 5, 13],
  [A('electronics') + 0.1, 40, 28, 32, 0, 13, -2],                        // "electronics platform" – the enclosure
  [E('platform') + 0.5, 52, 30, 30, 0, 13, -2],
  [A('observation') + 0.3, 70, 20, 52, 0, 7, 0],                          // "remote observation" – pull back
  [C3 + 0.05, 78, 19, 56, 0, 7, 0]];
const rudS3 = (tf) => Math.sin((tf - (A('rudder') - 0.1)) * 2.6) * 0.52 * smooth((tf - (A('rudder') - 0.1)) / 0.4) * (1 - smooth((tf - (E('rudder') + 0.4)) / 0.5));

/* ---------------------------------------------------------------- cues (film time unless noted) */
const mk = (list, id, tin, tout, o = {}) => list.push({ el: $(id), tin, tout, fi: o.fi ?? 0.55, fo: o.fo ?? 0.35, rot: o.rot ?? 0, dy: o.dy ?? 40, float: o.float ?? 0 });
const cuesI = [], cuesF = [];                                             // internal-scene time / film time
CUTS.slice(0, 6).forEach((a, i) => mk(cuesF, 'cap' + (i + 1), a + (i ? 0.4 : 0.5), CUTS[i + 1] - 0.3, { dy: -30, fi: 0.5 }));
mk(cuesI, 'ill', 0.8, 16.5, { dy: 0 });
mk(cuesF, 'stat', A('water') - 0.9, C1 - 0.2, { rot: -3, fi: 0.7 });
mk(cuesF, 'await', A('clearer') - 0.2, C2 - 0.08, { rot: -3, float: 1 });
mk(cuesF, 'c3a', A('propellers') - 0.2, E('propellers') + 1.0, { rot: -3, float: 1 });                // DUAL PROPULSION
mk(cuesF, 'c3b', A('rudder') - 0.1, E('rudder') + 1.1, { rot: 3, float: 1 });                         // RUDDER STEERING
mk(cuesF, 'c3e', A('electronics') - 0.1, E('platform') + 1.0, { rot: 2, float: 1 });                  // ELECTRONICS PLATFORM
mk(cuesF, 'c3c', A('remote') - 0.1, C3 - 0.12, { rot: -2, float: 1 });                                // REMOTE OBSERVATION
mk(cuesF, 'c3d', A('camera') - 0.05, A('vision') + 0.4, { rot: -2, float: 1 });                       // CAMERA SYSTEM (scene 4)
mk(cuesF, 'concept', C3 + 0.3, C4 - 0.3, { dy: 0 });
mk(cuesF, 'simtag', C4 + 0.4, C5 - 0.3, { dy: 0 });
mk(cuesF, 'c5a', A('sensor') - 0.1, C5 - 0.4, { rot: 2, float: 1 });                                  // GPS + IMU
mk(cuesF, 'titleCard', A('SeaGuardian', 1) - 0.2, DUR - 0.5, { rot: 1.5, fi: 0.8, dy: 80 });
mk(cuesF, 'tiles', C4 + 0.1, C5 - 0.3, { dy: 0, fi: 0.3 });
mk(cuesF, 'tDet', A('AI') - 0.15, C5 - 0.3, { dy: 30, fi: 0.5 });
mk(cuesF, 'tGps', A('sensor') - 0.1, C5 - 0.3, { dy: 30, fi: 0.5 }); mk(cuesF, 'tImu', A('sensor') + 0.25, C5 - 0.3, { dy: 30, fi: 0.5 });
mk(cuesF, 'tPro', A('vessel') - 0.1, C5 - 0.3, { dy: 30, fi: 0.5 }); mk(cuesF, 'tRud', A('vessel') + 0.2, C5 - 0.3, { dy: 30, fi: 0.5 });
mk(cuesF, 'saf', A('controls') - 0.05, C5 - 0.3, { dy: 30, fi: 0.5 }); mk(cuesF, 'tCom', A('interface') - 0.15, C5 - 0.3, { dy: 30, fi: 0.4 });
function applyCues(list, t) {
  for (const c of list) {
    const k = 1 - smooth((t - (c.tout - c.fo)) / c.fo), a = clamp((t - c.tin) / c.fi) * k, pop = easeBack((t - c.tin) / c.fi) * k, s = c.el.style;
    s.opacity = a.toFixed(3); s.visibility = a < 0.003 ? 'hidden' : 'visible';
    s.transform = `translateY(${((1 - pop) * c.dy + (c.float ? Math.sin(t * 2.0 + c.tin) * 9 : 0)).toFixed(1)}px) rotate(${(c.rot * pop).toFixed(2)}deg) scale(${(0.78 + 0.22 * pop).toFixed(3)})`;
  }
}

/* ---------------------------------------------------------------- karaoke subtitles: each word lights up exactly when it is spoken */
const KW = new Set(['Babet', '126', 'SeaGuardian', 'SeaGuardian.', 'twin-hull', 'propellers,', 'rudder,', 'electronics', 'camera', 'computer', 'dashboard', 'preliminary', 'prototype,', 'testing', 'inspection.']);
const LINES = []; { let cur = [];
  WORDS.forEach((w, i) => { cur.push(i); const brk = /[.:]$/.test(w[0]) || (/,$/.test(w[0]) && cur.length >= 3) || cur.length >= 11;
    if (brk || i === WORDS.length - 1) { LINES.push({ idx: cur, t0: WORDS[cur[0]][1] + OFF - 0.12, t1: WORDS[cur[cur.length - 1]][2] + OFF + 0.9 }); cur = []; } });
  LINES.forEach((l, i) => { if (LINES[i + 1]) l.t1 = Math.min(l.t1, LINES[i + 1].t0 - 0.02); }); }
const subEl = $('sub'); let curLine = -2, spans = [];
function updateSub(tf) {
  let li = -1; for (let i = 0; i < LINES.length; i++) if (tf >= LINES[i].t0 && tf < LINES[i].t1) { li = i; break; }
  if (li !== curLine) { curLine = li; subEl.innerHTML = ''; spans = [];
    if (li >= 0) { const sp = document.createElement('span'); LINES[li].idx.forEach((wi) => { const e = document.createElement('i'); e.textContent = WORDS[wi][0] + ' '; if (KW.has(WORDS[wi][0])) e.className = 'k'; sp.appendChild(e); spans.push([e, WORDS[wi][1] + OFF]); }); subEl.appendChild(sp); } }
  if (li < 0) { subEl.style.opacity = 0; return; }
  const L = LINES[li], k = clamp((tf - L.t0) / 0.18) * (1 - clamp((tf - (L.t1 - 0.2)) / 0.2));
  subEl.style.opacity = k.toFixed(2); subEl.style.transform = `translateY(${((1 - easeBack((tf - L.t0) / 0.3)) * 22).toFixed(1)}px)`;
  for (const [e, t0] of spans) { const on = tf >= t0 - 0.03; if (e.classList.contains('on') !== on) e.classList.toggle('on', on); }
}

/* ---------------------------------------------------------------- 2D overlay (viewfinder + conceptual detections) */
const toPx = (v, camera, r) => { const p = v.clone().project(camera); return { x: r.x + (p.x * 0.5 + 0.5) * r.w, y: r.y + (-p.y * 0.5 + 0.5) * r.h, z: p.z }; };
const boxOf = (obj, camera, r) => { const b = new THREE.Box3().setFromObject(obj), pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(toPx(new THREE.Vector3(x, y, z), camera, r));
  if (pts.some((p) => p.z > 1)) return null; const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
function bracket(g, x, y, w, h, l, col, lw) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  g.moveTo(x, y + l); g.lineTo(x, y); g.lineTo(x + l, y); g.moveTo(x + w - l, y); g.lineTo(x + w, y); g.lineTo(x + w, y + l);
  g.moveTo(x, y + h - l); g.lineTo(x, y + h); g.lineTo(x + l, y + h); g.moveTo(x + w - l, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - l); g.stroke(); }
const T_HUD = A('computer') - 0.3, T_BOAT = A('vision'), T_PERSON = A('objects');
function drawFeed(g, r, tf, camera) {
  const a = easeOut((tf - T_HUD) / 0.8); if (a < 0.001) return;
  g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.globalAlpha = a;
  const m = 26; bracket(g, r.x + m, r.y + m, r.w - 2 * m, r.h - 2 * m, 38, 'rgba(255,255,255,.9)', 3);
  g.fillStyle = '#ff4d5a'; g.beginPath(); g.arc(r.x + m + 22, r.y + m + 26, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = '800 22px Inter,sans-serif'; g.textBaseline = 'middle'; g.fillText('CAMERA VIEW', r.x + m + 42, r.y + m + 26);
  g.textAlign = 'right'; g.fillText('CONCEPT', r.x + r.w - m - 18, r.y + m + 26); g.textAlign = 'left';
  camera.updateMatrixWorld();
  for (const [label, obj, t0] of [['BOAT', harbour.targets.boat, T_BOAT], ['PERSON', harbour.targets.person, T_PERSON]]) {
    const k = easeOut((tf - t0) / 0.6); if (k < 0.01) continue; const b = boxOf(obj, camera, r); if (!b) continue;
    const pad = 14 + (1 - k) * 40, x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + 2 * pad, h = b.y1 - b.y0 + 2 * pad;
    if (w < 6 || h < 6 || x > r.x + r.w || y > r.y + r.h || x + w < r.x || y + h < r.y) continue;
    g.globalAlpha = a * k; bracket(g, x, y, w, h, Math.min(w, h) * 0.28, '#38bdf0', 4); g.fillStyle = 'rgba(56,189,240,.12)'; g.fillRect(x, y, w, h);
    g.font = '900 22px Inter,sans-serif'; const tw = g.measureText(label).width + 24; g.fillStyle = '#38bdf0'; g.fillRect(x, y - 34, tw, 34); g.fillStyle = '#04121e'; g.fillText(label, x + 12, y - 17);
  }
  g.globalAlpha = a * 0.35; const sy = r.y + ((tf * 0.28) % 1) * r.h, gr = g.createLinearGradient(0, sy - 50, 0, sy);
  gr.addColorStop(0, 'rgba(56,189,240,0)'); gr.addColorStop(1, 'rgba(56,189,240,.6)'); g.fillStyle = gr; g.fillRect(r.x, sy - 50, r.w, 50); g.restore(); g.globalAlpha = 1;
}

/* ---------------------------------------------------------------- dashboard values (all simulated) */
const set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
function drawMap(t, st) {
  const g = mapG, w = 255, h = 190; g.fillStyle = '#0a1b2e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(56,189,240,.10)'; for (let x = 0; x <= w; x += 25) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 25) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = '#12304a'; g.fillRect(0, 0, w, 26); g.fillRect(160, 22, 18, 100); g.strokeStyle = '#2b4d72'; g.strokeRect(0, 0, w, 26); g.strokeRect(160, 22, 18, 100);
  const mx = (x) => 30 + (x + 20) / 40 * 190, my = (z) => 172 - (z + 8) / 52 * 140, prog = clamp((t - 42.5) / 10.5) * 0.93;
  g.strokeStyle = '#38bdf0'; g.lineWidth = 2.5; g.setLineDash([2, 6]); g.beginPath();
  for (let i = 0; i <= 60; i++) { const p = path.getPointAt(clamp(i / 60 * Math.min(0.93, 0.93 * (0.55 + prog)))); i ? g.lineTo(mx(p.x), my(p.z)) : g.moveTo(mx(p.x), my(p.z)); }
  g.stroke(); g.setLineDash([]); const ring = (t * 1.4) % 1; g.strokeStyle = `rgba(242,177,52,${1 - ring})`; g.lineWidth = 2; g.beginPath(); g.arc(mx(st.x), my(st.z), 6 + ring * 18, 0, 7); g.stroke();
  g.fillStyle = '#f2b134'; g.beginPath(); g.arc(mx(st.x), my(st.z), 5, 0, 7); g.fill();
}
function updateDash(t, tf) {
  if (t < 41.9 || t > 53.2) return; const st = usvState(Math.min(t, 53));
  const roll = 3.2 * Math.sin(t * 1.3), pitch = 1.8 * Math.sin(t * 0.9 + 1), hdg = ((-st.heading / D2R) % 360 + 360) % 360;
  set('iR', roll.toFixed(1) + '°'); set('iP', pitch.toFixed(1) + '°'); set('iY', Math.round(hdg) + '°');
  $('iRb').style.cssText = `left:${50 + Math.min(0, roll / 15 * 50)}%;width:${Math.abs(roll / 15 * 50)}%`; $('iPb').style.cssText = `left:${50 + Math.min(0, pitch / 15 * 50)}%;width:${Math.abs(pitch / 15 * 50)}%`; $('iYb').style.cssText = `left:0;width:${hdg / 360 * 100}%`;
  const steer = st.rudder / 0.52 * 22, mL = clamp(48 + steer, 0, 100), mR = clamp(48 - steer, 0, 100);
  set('mL', Math.round(mL) + '%'); set('mR', Math.round(mR) + '%'); $('mLb').style.width = mL + '%'; $('mRb').style.width = mR + '%';
  const deg = st.rudder / D2R, ang = clamp(deg, -30, 30); $('rNeedle').setAttribute('transform', `rotate(${ang * 1.5} 0 100)`); set('rVal', (deg >= 0 ? '+' : '−') + Math.abs(deg).toFixed(0) + '°');
  const a0 = -Math.PI / 2, a1 = a0 + ang * 1.5 * D2R; $('rArc').setAttribute('d', `M ${100 * Math.cos(a0)} ${100 + 100 * Math.sin(a0)} A 100 100 0 0 ${a1 > a0 ? 1 : 0} ${100 * Math.cos(a1)} ${100 + 100 * Math.sin(a1)}`);
  $('gpsTxt').textContent = `${(56.1612 + (st.z - 20) * -0.000009).toFixed(5)}° N  ${(15.5869 + st.x * 0.000016).toFixed(5)}° E`; drawMap(t, st);
  set('cLat', Math.round(24 + 4 * Math.sin(t * 2.2)) + ' ms'); set('cSig', '−' + Math.round(58 + 3 * Math.sin(t * 0.8)) + ' dBm'); $('hb').style.opacity = Math.sin(t * 6.28) > 0 ? 1 : 0.25;
  const nb = clamp((tf - A('AI')) / 0.7), np = clamp((tf - A('AI') - 0.6) / 0.7); set('dBoatN', nb > 0.5 ? '1' : '0'); set('dPersN', np > 0.5 ? '1' : '0'); $('dBoat').style.width = nb * 100 + '%'; $('dPers').style.width = np * 100 + '%';
  $('bStop').style.boxShadow = tf > A('controls') ? `0 0 ${16 * (0.5 + 0.5 * Math.sin(tf * 3))}px rgba(255,77,90,.55)` : 'none';
}

/* ---------------------------------------------------------------- background + card choreography (dark palette) */
const BG = [[8, 26, 48], [20, 36, 52], [11, 79, 156], [10, 88, 104], [10, 26, 44], [14, 72, 140]];   // navy · slate · ocean · deep teal · navy · blue
const TILT = [[-10, 5, -2], [8, 4, 2], [-6, 6, -1.5], [7, 4, 1.5], [-3, 3, 0], [5, 5, -1.5]];
const sceneOf = (tf) => { let i = 0; while (i < 5 && tf >= CUTS[i + 1]) i++; return i; };
function bgAt(tf) { const i = sceneOf(tf); let c = BG[i].slice(); if (i > 0) { const k = clamp((tf - CUTS[i]) / 0.5); c = c.map((v, j) => lerp(BG[i - 1][j], v, smooth(k))); } return `rgb(${c.map(Math.round).join(',')})`; }

/* ---------------------------------------------------------------- frame */
const stage = $('stage'), card = $('card'), cardIn = $('cardIn'), fade = $('fade');
const orbit = (c, [az, el, d, tx, ty, tz]) => { const a = az * D2R, e = el * D2R; c.position.set(tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(a) * Math.cos(e)); c.lookAt(tx, ty, tz); };

function frame(tf) {
  tf = clamp(tf, 0, DUR); const t = clamp(warp(tf), 0, 60 - 1e-4), si = sceneOf(tf), scene = si + 1;
  stage.style.background = bgAt(tf);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, CW, CH); renderer.setClearColor(0x050d18, scene === 5 ? 0 : 1); renderer.clear(); ov.clearRect(0, 0, CW, CH);
  cam.aspect = CW / CH; cam.clearViewOffset(); cardIn.classList.toggle('dash', scene === 5);
  if (scene === 1 || scene === 2) {
    const k = track(scene === 1 ? KEY_S1 : KEY_S2, t), sh = scene === 1 ? 0.07 + 0.06 * smooth(t / 3) : 0.012;
    cam.position.set(k[0] + Math.sin(t * 7.3) * sh + Math.sin(t * 3.1) * sh, k[1] + Math.sin(t * 9.1) * sh * 0.8, k[2]); cam.lookAt(k[3], k[4], k[5]);
    cam.fov = k[6]; cam.updateProjectionMatrix(); cam.rotation.z += Math.sin(t * 1.3) * (scene === 1 ? 0.012 : 0.004);
    harbour.update(scene === 1 ? storm(t) : after(t), cam.position); renderer.render(harbour.scene, cam);
  } else if (scene === 3) {
    orbit(cam, track(K3, tf)); cam.fov = 30; cam.updateProjectionMatrix();
    studio.update({ t: tf, reveal: smooth((tf - C2 - 0.2) / (A('twin-hull') - C2 - 0.5)), propAngle: ramp(tf, A('twin-hull') + 0.4, 1.5, 20), rudder: rudS3(tf) });
    renderer.render(studio.scene, cam);
  } else if (scene === 6) {
    orbit(cam, track(KEY_S6, t)); cam.fov = 27; cam.updateProjectionMatrix();
    studio.update({ t, reveal: 1, propAngle: ramp(t, 53, 1.6, 12), rudder: Math.sin((t - 53) * 1.1) * 0.26 * smooth((t - 53.5) / 1.5) });
    renderer.render(studio.scene, cam);
  } else if (scene === 4) {
    povPose(t, usvState(t), cam, s4Offsets(t)); harbour.update(dusk(t), cam.position); renderer.render(harbour.scene, cam);
    drawFeed(ov, { x: 0, y: 0, w: CW, h: CH }, tf, cam);
  } else {
    const st = usvState(Math.min(t, 53)); povPose(t, st, pov, POV_OFFS); pov.aspect = FEEDW / CH; pov.updateProjectionMatrix(); harbour.update(dusk(t), pov.position);
    renderer.setScissorTest(true); renderer.setScissor(0, 0, FEEDW, CH); renderer.setViewport(0, 0, FEEDW, CH);
    renderer.render(harbour.scene, pov); renderer.setScissorTest(false); renderer.setViewport(0, 0, CW, CH);
    drawFeed(ov, { x: 0, y: 0, w: FEEDW, h: CH }, tf, pov); updateDash(t, tf);
  }
  $('tiles').style.display = scene === 5 ? 'grid' : 'none';

  // card pose: tilt per scene + sway + flip in/out around each cut
  const [ry, rx, rz] = TILT[si], tin = CUTS[si], tout = CUTS[si + 1];
  const enter = si === 0 ? easeOut((tf - 0.1) / 0.8) : easeBack((tf - tin) / 0.7), leave = si === 5 ? smooth((tf - (DUR - 0.8)) / 0.8) : smooth((tf - (tout - 0.28)) / 0.28);
  const dir = si % 2 ? 1 : -1; card.style.opacity = (clamp(enter * 1.6) * (1 - leave)).toFixed(3);
  cardIn.style.transform = `translateY(${(Math.sin(tf * 1.1) * 12 + (1 - enter) * 120).toFixed(1)}px) rotateY(${(ry + Math.sin(tf * 0.9) * 2.5 + (1 - enter) * 70 * dir + (si === 5 ? 0 : leave * -70 * dir)).toFixed(2)}deg) rotateX(${(rx + Math.cos(tf * 0.7) * 1.5).toFixed(2)}deg) rotateZ(${(rz + Math.sin(tf * 0.6) * 0.7).toFixed(2)}deg) scale(${(0.88 + 0.12 * enter).toFixed(3)})`;

  // "+126 cm" counts up while the narrator says "water levels reached 126 centimetres"
  set('statNum', '+' + Math.round(126 * easeOut((tf - A('water')) / (E('126') - A('water')))));
  applyCues(cuesI, t); applyCues(cuesF, tf); updateSub(tf);
  $('progFill').style.width = (tf / DUR * 100).toFixed(2) + '%'; set('progT', fmt(tf));
  fade.style.opacity = Math.max(1 - smooth(tf / 0.5), smooth((tf - (DUR - 1)) / 1)).toFixed(3);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------------------------------------------------------------- player */
let playing = false, tNow = 0, last = 0, hasVO = false;
const vo = $('vo'), seek = $('seek'), clock = $('clock'), bPlay = $('bPlay'); seek.max = DUR;
vo.addEventListener('canplaythrough', () => { hasVO = true; $('bAud').textContent = 'Voice: on'; });
$('bAud').onclick = () => { vo.muted = !vo.muted; $('bAud').textContent = hasVO ? (vo.muted ? 'Voice: muted' : 'Voice: on') : 'Voice: n/a'; };
function setTime(t) { tNow = clamp(t, 0, DUR); frame(tNow); seek.value = tNow; clock.textContent = `${fmt(tNow)}.${Math.floor((tNow % 1) * 10)} / ${fmt(DUR)}`; }
function syncAudio(force) { if (!hasVO || !playing) return; const want = tNow - OFF; if (want < 0) { if (!vo.paused) vo.pause(); return; }
  if (force) vo.currentTime = want; if (vo.paused) vo.play().catch(() => {}); }
let poster = true;
const play = () => { if (poster) { poster = false; setTime(0); } playing = true; bPlay.textContent = 'Pause ❚❚'; last = performance.now(); syncAudio(true); };
const pause = () => { playing = false; bPlay.textContent = 'Play ▸'; vo.pause(); };
bPlay.onclick = () => (playing ? pause() : (tNow >= DUR - 0.05 && setTime(0), play()));
$('bRestart').onclick = () => { poster = false; setTime(0); play(); };
seek.oninput = () => { poster = false; setTime(+seek.value); syncAudio(true); };
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); bPlay.click(); } if (e.key === 'ArrowRight') setTime(tNow + 1); if (e.key === 'ArrowLeft') setTime(tNow - 1); if (e.key.toLowerCase() === 'c') { document.body.classList.toggle('clean'); fit(); } });
function loop(now) { requestAnimationFrame(loop); if (!playing) return;
  const dt = (now - last) / 1000; last = now;
  if (hasVO && !vo.paused && vo.currentTime > 0.05) tNow = vo.currentTime + OFF;     // audio is the master clock → no drift
  else tNow += dt;                                                                    // lead-in before the voice starts (and fallback)
  if (tNow >= DUR) { tNow = DUR; pause(); } setTime(tNow); if (vo.paused) syncAudio(false); }
function fit() { const w = $('wrap'), k = Math.min(w.clientWidth / SW, w.clientHeight / SH); stage.style.transform = `scale(${k})`; }
addEventListener('resize', fit); new ResizeObserver(fit).observe($('wrap')); fit();
$('bRec').onclick = async () => { try {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: 1920, height: 1080 }, audio: true, preferCurrentTab: true });
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 16e6 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { stream.getTracks().forEach((s) => s.stop()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = 'seaguardian-film-styled.webm'; a.click(); };
  document.body.classList.add('clean'); fit(); poster = false; setTime(0); rec.start(); play(); const iv = setInterval(() => { if (tNow >= DUR - 0.05) { clearInterval(iv); setTimeout(() => rec.stop(), 400); } }, 200);
} catch (e) { console.warn('record cancelled', e); } };
const q = new URLSearchParams(location.search); if (q.has('clean')) document.body.classList.add('clean');
if (q.has('t')) poster = false;
fit(); for (const wt of [3, 14, 23, 31, 41, 50]) frame(wt);   // pre-warm: compile every shader up front so playback never hitches
setTime(q.has('t') ? +q.get('t') : 9.6); requestAnimationFrame(loop); if (q.has('autoplay')) play();
window.FILM = { frame, setTime, DUR, play, pause, CUTS, A, E };
