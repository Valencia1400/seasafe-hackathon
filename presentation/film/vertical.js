// SeaGuardian – vertical 9:16 cut (1080×1920). Same scenes, script and voiceover as film.js, restyled as a floating-card social video.
import * as THREE from 'three';
import { createHarbour, createStudio } from './world.js';
import { DUR, D2R, clamp, lerp, smooth, easeOut, track, KEY_S1, KEY_S2, KEY_S3, KEY_S6, path, ramp, usvState, povPose, s4Offsets, POV_OFFS,
  storm, after, dusk, VO_OFFSET, WARP, warp } from './shared.js';

const SW = 1080, SH = 1920, CW = 900, CH = 1050, FEEDH = 420;
const $ = (id) => document.getElementById(id);
const easeBack = (x) => { x = clamp(x); return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); };

/* ---------------------------------------------------------------- renderer (sized to the card) */
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(CW, CH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const harbour = createHarbour(renderer), studio = createStudio(renderer);
const cam = new THREE.PerspectiveCamera(40, CW / CH, 0.1, 2000), pov = new THREE.PerspectiveCamera(60, CW / FEEDH, 0.1, 2000);
const ov = $('ov').getContext('2d'), mapG = $('map').getContext('2d');

/* ---------------------------------------------------------------- cues */
const mk = (list, id, tin, tout, o = {}) => list.push({ el: $(id), tin, tout, fi: o.fi ?? 0.55, fo: o.fo ?? 0.35, rot: o.rot ?? 0, dy: o.dy ?? 40, float: o.float ?? 0 });
const cuesI = [], cuesF = [];                               // internal-scene time / film time
const FILM_CUTS = [0, 12.8, 19.35, 26.8, 34.3, 43.5, 60];
FILM_CUTS.slice(0, 6).forEach((a, i) => mk(cuesF, 'cap' + (i + 1), a + (i ? 0.45 : 0.5), FILM_CUTS[i + 1] - 0.3, { dy: -30, rot: 0, fi: 0.5 }));
mk(cuesI, 'ill', 0.8, 16.5, { dy: 0 }); mk(cuesI, 'stat', 3.1, 8.8, { rot: -3, fi: 0.7 }); mk(cuesI, 'await', 13.0, 16.7, { rot: -3, float: 1 });
mk(cuesI, 'c3a', 21.4, 29.6, { rot: -3, float: 1 }); mk(cuesI, 'c3b', 24.8, 29.6, { rot: 3, float: 1 }); mk(cuesI, 'c3c', 26.0, 29.7, { rot: -2, float: 1 }); mk(cuesI, 'c3d', 26.5, 29.7, { rot: 3, float: 1 });
mk(cuesI, 'concept', 30.9, 41.7, { dy: 0 }); mk(cuesI, 'simtag', 43.0, 52.8, { dy: 0 });
mk(cuesI, 'titleCard', 54.2, 59.3, { rot: 1.5, fi: 0.8, dy: 80 });
mk(cuesI, 'tiles', 42.2, 52.8, { dy: 0, fi: 0.3 });
[['tDet', 43.0], ['tGps', 43.4], ['tImu', 43.9], ['tPro', 44.3], ['tRud', 44.7], ['tCom', 45.1], ['saf', 45.6]].forEach(([id, t]) => mk(cuesI, id, t, 52.8, { dy: 30, fi: 0.5 }));
function applyCues(list, t) {
  for (const c of list) {
    const a = clamp((t - c.tin) / c.fi) * (1 - smooth((t - (c.tout - c.fo)) / c.fo)), s = c.el.style;
    const pop = easeBack((t - c.tin) / c.fi) * (1 - smooth((t - (c.tout - c.fo)) / c.fo));
    s.opacity = a.toFixed(3); s.visibility = a < 0.003 ? 'hidden' : 'visible';
    const fl = c.float ? Math.sin(t * 2.0 + c.tin) * 9 : 0;
    s.transform = `translateY(${((1 - pop) * c.dy + fl).toFixed(1)}px) rotate(${(c.rot * pop).toFixed(2)}deg) scale(${(0.78 + 0.22 * pop).toFixed(3)})`;
  }
}

/* narration captions (film time). *word* = highlighted */
const SUBS = [[1.05, 5.9, "In 2023, *Storm Babet* struck Sweden's southern coast."], [6.6, 12.35, 'At Simrishamn, water levels reached *126 centimetres* above average.'],
  [13.3, 17.05, 'After storms, harbour operators need a clearer picture of what requires *inspection*.'], [17.5, 19.05, 'Meet *SeaGuardian*.'],
  [19.65, 22.9, 'Our prototype combines a *twin-hull* design, two propellers,'], [22.9, 26.55, 'a rudder, and an electronics platform built for remote observation.'],
  [27.1, 30.3, 'A *camera* sends footage to a laptop,'], [30.3, 33.7, 'where *computer vision* highlights visible objects for an operator to review.'],
  [34.95, 38.5, 'Our *dashboard* brings together camera observations, AI detections,'], [38.5, 43.3, 'sensor information, and vessel controls in one interface.'],
  [43.75, 45.2, 'The goal:'], [45.85, 51.25, 'better *preliminary information* before specialist inspections.'], [52.05, 53.7, 'SeaGuardian is a *prototype*,'], [54.15, 55.95, 'with *field testing* still ahead.']];
let lastSub = -1; const subEl = $('sub');
function updateSub(tf) {
  const i = SUBS.findIndex(([a, b]) => tf >= a && tf < b);
  if (i !== lastSub) { lastSub = i; subEl.innerHTML = i < 0 ? '' : '<span>' + SUBS[i][2].replace(/\*(.+?)\*/g, '<em>$1</em>') + '</span>'; }
  if (i < 0) { subEl.style.opacity = 0; return; }
  const [a, b] = SUBS[i], k = clamp((tf - a) / 0.22) * (1 - clamp((tf - (b - 0.12)) / 0.12));
  subEl.style.opacity = k.toFixed(2); subEl.style.transform = `translateY(${((1 - easeBack((tf - a) / 0.3)) * 26).toFixed(1)}px) scale(${(0.94 + 0.06 * easeBack((tf - a) / 0.3)).toFixed(3)})`;
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
function drawFeed(g, r, t, t0, camera) {
  const a = easeOut((t - t0) / 0.8); if (a < 0.001) return; const sc = 0.9;
  g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.globalAlpha = a;
  const m = 26; bracket(g, r.x + m, r.y + m, r.w - 2 * m, r.h - 2 * m, 38, 'rgba(255,255,255,.9)', 3);
  g.fillStyle = '#ff4d5a'; g.beginPath(); g.arc(r.x + m + 22, r.y + m + 26, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = '800 22px Inter,sans-serif'; g.textBaseline = 'middle'; g.fillText('CAMERA VIEW', r.x + m + 42, r.y + m + 26);
  g.textAlign = 'right'; g.fillText('CONCEPT', r.x + r.w - m - 18, r.y + m + 26); g.textAlign = 'left';
  camera.updateMatrixWorld();
  for (const [label, obj, d] of [['BOAT', harbour.targets.boat, 1.2], ['PERSON', harbour.targets.person, 2.8]]) {
    const k = easeOut((t - t0 - d) / 0.6); if (k < 0.01) continue; const b = boxOf(obj, camera, r); if (!b) continue;
    const pad = 14 + (1 - k) * 40, x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + 2 * pad, h = b.y1 - b.y0 + 2 * pad;
    if (w < 6 || h < 6 || x > r.x + r.w || y > r.y + r.h || x + w < r.x || y + h < r.y) continue;
    g.globalAlpha = a * k; bracket(g, x, y, w, h, Math.min(w, h) * 0.28, '#38bdf0', 4); g.fillStyle = 'rgba(56,189,240,.12)'; g.fillRect(x, y, w, h);
    g.font = '900 22px Inter,sans-serif'; const tw = g.measureText(label).width + 24; g.fillStyle = '#38bdf0'; g.fillRect(x, y - 34, tw, 34); g.fillStyle = '#04121e'; g.fillText(label, x + 12, y - 17);
  }
  g.globalAlpha = a * 0.35; const sy = r.y + ((t * 0.28) % 1) * r.h, gr = g.createLinearGradient(0, sy - 50, 0, sy);
  gr.addColorStop(0, 'rgba(56,189,240,0)'); gr.addColorStop(1, 'rgba(56,189,240,.6)'); g.fillStyle = gr; g.fillRect(r.x, sy - 50, r.w, 50); g.restore(); g.globalAlpha = 1;
}

/* ---------------------------------------------------------------- dashboard values (all simulated) */
const set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
function drawMap(t, st) {
  const g = mapG, w = 435, h = 172; g.fillStyle = '#0a1b2e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(56,189,240,.10)'; for (let x = 0; x <= w; x += 29) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 29) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = '#12304a'; g.fillRect(0, 0, w, 30); g.fillRect(270, 24, 24, 90); g.strokeStyle = '#2b4d72'; g.strokeRect(0, 0, w, 30); g.strokeRect(270, 24, 24, 90);
  const mx = (x) => 50 + (x + 20) / 40 * 330, my = (z) => 160 - (z + 8) / 52 * 128, prog = clamp((t - 42.5) / 10.5) * 0.93;
  g.strokeStyle = '#38bdf0'; g.lineWidth = 2.5; g.setLineDash([2, 6]); g.beginPath();
  for (let i = 0; i <= 60; i++) { const p = path.getPointAt(clamp(i / 60 * Math.min(0.93, 0.93 * (0.55 + prog)))); i ? g.lineTo(mx(p.x), my(p.z)) : g.moveTo(mx(p.x), my(p.z)); }
  g.stroke(); g.setLineDash([]); const ring = (t * 1.4) % 1; g.strokeStyle = `rgba(242,177,52,${1 - ring})`; g.lineWidth = 2; g.beginPath(); g.arc(mx(st.x), my(st.z), 6 + ring * 18, 0, 7); g.stroke();
  g.fillStyle = '#f2b134'; g.beginPath(); g.arc(mx(st.x), my(st.z), 5, 0, 7); g.fill();
}
function updateDash(t) {
  if (t < 42.4 || t > 53.2) return; const st = usvState(Math.min(t, 53));
  const roll = 3.2 * Math.sin(t * 1.3), pitch = 1.8 * Math.sin(t * 0.9 + 1), hdg = ((-st.heading / D2R) % 360 + 360) % 360;
  set('iR', roll.toFixed(1) + '°'); set('iP', pitch.toFixed(1) + '°'); set('iY', Math.round(hdg) + '°');
  $('iRb').style.cssText = `left:${50 + Math.min(0, roll / 15 * 50)}%;width:${Math.abs(roll / 15 * 50)}%`; $('iPb').style.cssText = `left:${50 + Math.min(0, pitch / 15 * 50)}%;width:${Math.abs(pitch / 15 * 50)}%`; $('iYb').style.cssText = `left:0;width:${hdg / 360 * 100}%`;
  const steer = st.rudder / 0.52 * 22, mL = clamp(48 + steer, 0, 100), mR = clamp(48 - steer, 0, 100);
  set('mL', Math.round(mL) + '%'); set('mR', Math.round(mR) + '%'); $('mLb').style.width = mL + '%'; $('mRb').style.width = mR + '%';
  const deg = st.rudder / D2R, ang = clamp(deg, -30, 30); $('rNeedle').setAttribute('transform', `rotate(${ang * 1.5} 0 100)`); set('rVal', (deg >= 0 ? '+' : '−') + Math.abs(deg).toFixed(0) + '°');
  const a0 = -Math.PI / 2, a1 = a0 + ang * 1.5 * D2R; $('rArc').setAttribute('d', `M ${100 * Math.cos(a0)} ${100 + 100 * Math.sin(a0)} A 100 100 0 0 ${a1 > a0 ? 1 : 0} ${100 * Math.cos(a1)} ${100 + 100 * Math.sin(a1)}`);
  $('gpsTxt').textContent = `${(56.1612 + (st.z - 20) * -0.000009).toFixed(5)}° N  ${(15.5869 + st.x * 0.000016).toFixed(5)}° E`; drawMap(t, st);
  set('cLat', Math.round(24 + 4 * Math.sin(t * 2.2)) + ' ms'); set('cSig', '−' + Math.round(58 + 3 * Math.sin(t * 0.8)) + ' dBm'); $('hb').style.opacity = Math.sin(t * 6.28) > 0 ? 1 : 0.25;
  const nb = clamp((t - 44.5) / 0.7), np = clamp((t - 46.0) / 0.7); set('dBoatN', nb > 0.5 ? '1' : '0'); set('dPersN', np > 0.5 ? '1' : '0'); $('dBoat').style.width = nb * 100 + '%'; $('dPers').style.width = np * 100 + '%';
  $('bStop').style.boxShadow = t > 49 ? `0 0 ${16 * (0.5 + 0.5 * Math.sin(t * 3))}px rgba(255,77,90,.55)` : 'none';
}

/* ---------------------------------------------------------------- background + card choreography */
const BG = [[255, 106, 31], [217, 72, 15], [11, 107, 203], [14, 143, 140], [10, 26, 44], [28, 126, 214]];   // orange · burnt · ocean · teal · navy · cyan-blue
const TILT = [[-10, 5, -2], [8, 4, 2], [-6, 6, -1.5], [7, 4, 1.5], [-3, 3, 0], [5, 5, -1.5]];             // rotateY, rotateX, rotateZ
const sceneOf = (tf) => { let i = 0; while (i < 5 && tf >= FILM_CUTS[i + 1]) i++; return i; };
function bgAt(tf) {
  const i = sceneOf(tf); let c = BG[i].slice();
  if (i > 0) { const k = clamp((tf - FILM_CUTS[i]) / 0.5); c = c.map((v, j) => lerp(BG[i - 1][j], v, smooth(k))); }
  return `rgb(${c.map(Math.round).join(',')})`;
}

/* ---------------------------------------------------------------- frame */
const stage = $('stage'), card = $('card'), cardIn = $('cardIn'), fade = $('fade');
const orbit = (c, [az, el, d, tx, ty, tz]) => { const a = az * D2R, e = el * D2R; c.position.set(tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(a) * Math.cos(e)); c.lookAt(tx, ty, tz); };

function frame(tf) {
  tf = clamp(tf, 0, DUR); const t = clamp(warp(tf), 0, DUR - 1e-4), si = sceneOf(tf), scene = si + 1;
  stage.style.background = bgAt(tf);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, CW, CH); renderer.setClearColor(0x050d18, scene === 5 ? 0 : 1); renderer.clear(); ov.clearRect(0, 0, CW, CH);
  cam.aspect = CW / CH; cam.clearViewOffset(); cardIn.classList.toggle('dash', scene === 5);
  if (scene === 1 || scene === 2) {
    const k = track(scene === 1 ? KEY_S1 : KEY_S2, t), sh = scene === 1 ? 0.07 + 0.06 * smooth(t / 3) : 0.012;
    cam.position.set(k[0] + Math.sin(t * 7.3) * sh + Math.sin(t * 3.1) * sh, k[1] + Math.sin(t * 9.1) * sh * 0.8, k[2]); cam.lookAt(k[3], k[4], k[5]);
    cam.fov = Math.min(70, k[6] * 1.18); cam.updateProjectionMatrix(); cam.rotation.z += Math.sin(t * 1.3) * (scene === 1 ? 0.012 : 0.004);
    harbour.update(scene === 1 ? storm(t) : after(t), cam.position); renderer.render(harbour.scene, cam);
  } else if (scene === 3 || scene === 6) {
    const k = track(scene === 3 ? KEY_S3 : KEY_S6, t); orbit(cam, k); cam.fov = scene === 3 ? 40 : 32;
    if (scene === 6) cam.setViewOffset(CW, CH, 0, 120, CW, CH); cam.updateProjectionMatrix();
    const rud = scene === 3 ? Math.sin((t - 24) * 1.5) * 0.52 * smooth((t - 24) / 1.2) * (1 - smooth((t - 29.2) / 0.8)) : Math.sin((t - 53) * 1.1) * 0.26 * smooth((t - 53.5) / 1.5);
    studio.update({ t, reveal: scene === 3 ? smooth((t - 17.2) / 4.6) : 1, propAngle: scene === 3 ? ramp(t, 20.4, 2.5, 20) : ramp(t, 53, 1.6, 12), rudder: rud });
    renderer.render(studio.scene, cam);
  } else if (scene === 4) {
    povPose(t, usvState(t), cam, s4Offsets(t)); cam.fov = Math.min(80, cam.fov * 1.2); cam.updateProjectionMatrix();
    harbour.update(dusk(t), cam.position); renderer.render(harbour.scene, cam); drawFeed(ov, { x: 0, y: 0, w: CW, h: CH }, t, 36.2, cam);
  } else {
    const st = usvState(Math.min(t, 53)); povPose(t, st, pov, POV_OFFS); pov.aspect = CW / FEEDH; pov.updateProjectionMatrix(); harbour.update(dusk(t), pov.position);
    const ry = CH - FEEDH; renderer.setScissorTest(true); renderer.setScissor(0, ry, CW, FEEDH); renderer.setViewport(0, ry, CW, FEEDH);
    renderer.render(harbour.scene, pov); renderer.setScissorTest(false); renderer.setViewport(0, 0, CW, CH);
    drawFeed(ov, { x: 0, y: 0, w: CW, h: FEEDH }, t, 35.6, pov); updateDash(t);
  }
  $('tiles').style.display = scene === 5 ? 'grid' : 'none';

  // card pose: base tilt per scene + sway + flip in/out around each cut
  const [ry, rx, rz] = TILT[si]; const tin = FILM_CUTS[si], tout = FILM_CUTS[si + 1];
  const enter = si === 0 ? easeOut((tf - 0.1) / 0.8) : easeBack((tf - tin) / 0.7), leave = si === 5 ? 0 : smooth((tf - (tout - 0.28)) / 0.28);
  const dir = si % 2 ? 1 : -1, op = clamp(enter * 1.6) * (1 - leave);
  card.style.opacity = op.toFixed(3);
  cardIn.style.transform = `translateY(${(Math.sin(tf * 1.1) * 12 + (1 - enter) * 120).toFixed(1)}px) rotateY(${(ry + Math.sin(tf * 0.9) * 2.5 + (1 - enter) * 70 * dir + leave * -70 * dir).toFixed(2)}deg) rotateX(${(rx + Math.cos(tf * 0.7) * 1.5).toFixed(2)}deg) rotateZ(${(rz + Math.sin(tf * 0.6) * 0.7).toFixed(2)}deg) scale(${(0.88 + 0.12 * enter).toFixed(3)})`;

  set('statNum', '+' + Math.round(126 * easeOut((t - 3.4) / 3.2)));
  applyCues(cuesI, t); applyCues(cuesF, tf); updateSub(tf);
  $('progFill').style.width = (tf / DUR * 100).toFixed(2) + '%'; set('progT', `0:${String(Math.floor(tf)).padStart(2, '0')}`);
  fade.style.opacity = Math.max(1 - smooth(tf / 0.5), smooth((tf - 59) / 1)).toFixed(3);
}

/* ---------------------------------------------------------------- player (same controls as film.js) */
let playing = false, tNow = 0, last = 0, hasVO = false;
const vo = $('vo'), seek = $('seek'), clock = $('clock'), bPlay = $('bPlay');
vo.addEventListener('canplaythrough', () => { hasVO = true; $('bAud').textContent = 'Voice: on'; });
$('bAud').onclick = () => { vo.muted = !vo.muted; $('bAud').textContent = hasVO ? (vo.muted ? 'Voice: muted' : 'Voice: on') : 'Voice: n/a'; };
function setTime(t) { tNow = clamp(t, 0, DUR); frame(tNow); seek.value = tNow; const s = Math.floor(tNow); clock.textContent = `0:${String(s).padStart(2, '0')}.${Math.floor((tNow - s) * 10)} / 1:00`; }
function syncAudio(force) { if (!hasVO || !playing) return; const want = tNow - VO_OFFSET; if (want < 0) { vo.pause(); return; }
  if (force || vo.paused || Math.abs(vo.currentTime - want) > 0.25) vo.currentTime = want; if (vo.paused) vo.play().catch(() => {}); }
const play = () => { playing = true; if (typeof poster !== 'undefined' && poster) { poster = false; setTime(0); } bPlay.textContent = 'Pause ❚❚'; last = performance.now(); syncAudio(true); };
const pause = () => { playing = false; bPlay.textContent = 'Play ▸'; vo.pause(); };
bPlay.onclick = () => (playing ? pause() : (tNow >= DUR - 0.05 && setTime(0), play()));
$('bRestart').onclick = () => { setTime(0); play(); };
seek.oninput = () => { poster = false; setTime(+seek.value); syncAudio(true); };
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); bPlay.click(); } if (e.key === 'ArrowRight') setTime(tNow + 1); if (e.key === 'ArrowLeft') setTime(tNow - 1); if (e.key.toLowerCase() === 'c') { document.body.classList.toggle('clean'); fit(); } });
function loop(now) { requestAnimationFrame(loop); if (playing) { tNow += (now - last) / 1000; last = now; if (tNow >= DUR) { tNow = DUR; pause(); } setTime(tNow); syncAudio(false); } }
function fit() { const w = $('wrap'), k = Math.min(w.clientWidth / SW, w.clientHeight / SH); stage.style.transform = `scale(${k})`; }
addEventListener('resize', fit); new ResizeObserver(fit).observe($('wrap')); fit();
$('bRec').onclick = async () => { try {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: 1080, height: 1920 }, audio: true, preferCurrentTab: true });
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 14e6 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { stream.getTracks().forEach((s) => s.stop()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = 'seaguardian-vertical.webm'; a.click(); };
  document.body.classList.add('clean'); fit(); setTime(0); rec.start(); play(); const iv = setInterval(() => { if (tNow >= DUR - 0.05) { clearInterval(iv); setTimeout(() => rec.stop(), 400); } }, 200);
} catch (e) { console.warn('record cancelled', e); } };
const q = new URLSearchParams(location.search); if (q.has('clean')) document.body.classList.add('clean');
let poster = !q.has('t'); fit(); setTime(q.has('t') ? +q.get('t') : 7.2); requestAnimationFrame(loop); if (q.has('autoplay')) play();
window.FILM = { frame, setTime, DUR, play, pause };
