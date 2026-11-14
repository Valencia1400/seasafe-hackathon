// SeaGuardian – 60 s animated product film. Deterministic: frame(t) draws everything for time t (seconds).
import * as THREE from 'three';
import { createHarbour, createStudio, waveH } from './world.js';

const W = 1920, H = 1080, DUR = 60, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;

/* ---------------------------------------------------------------- renderer */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const harbour = createHarbour(renderer);
const studio = createStudio(renderer);
const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);
const pov = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);

/* ---------------------------------------------------------------- smooth keyframe tracks (Catmull-Rom in time) */
function track(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0].slice(1);
  if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const dt = k2[0] - k1[0], s = (t - k1[0]) / dt, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const out = [];
  for (let j = 1; j < k1.length; j++) {
    const m1 = (k2[j] - k0[j]) / Math.max(1e-6, k2[0] - k0[0]) * dt, m2 = (k3[j] - k1[j]) / Math.max(1e-6, k3[0] - k1[0]) * dt;
    out.push(h00 * k1[j] + h10 * m1 + h01 * k2[j] + h11 * m2);
  }
  return out;
}

/* harbour camera keys: [t, px,py,pz, tx,ty,tz, fov] */
const KEY_S1 = [[0, -34, 4.6, 27, 8, 3.2, -12, 46], [3, -20, 4.0, 21, 11, 3, -14, 44], [5.4, -1, 3.2, 8, 9, 2.2, -24, 38], [7.8, 5.2, 2.8, -15.0, 8, 1.5, -30, 32], [9.6, 6.4, 2.5, -21.0, 8, 1.4, -30, 29]];
const KEY_S2 = [[9, 36, 6.2, 20, 18, 2.2, -8, 46], [12, 25, 4.2, 8, 18, 1.8, -8, 44], [14.6, 15.6, 2.4, -5, 18, 1.4, 4, 44], [17.4, 13.5, 0.95, 9, 13, 0.35, 30, 52]];
/* studio camera keys: [t, azimuth°, elevation°, distance, tx,ty,tz] (azimuth 0 = from stern, 90 = from grey side) */
const KEY_S3 = [[17, 205, 7, 64, 0, 7, 0], [21, 255, 13, 58, 0, 7, 0], [24, 325, 20, 52, 0, 7, 1], [26.6, 372, 17, 35, 0, 8, 6], [28.6, 392, 23, 22, 2, 9, 13], [30.4, 402, 25, 19, 2, 9, 13]];
const KEY_S6 = [[53, 318, 15, 92, 0, 7, 0], [56.5, 392, 19, 84, 0, 7, 0], [60.4, 462, 13, 88, 0, 7, 0]];

/* ---------------------------------------------------------------- mission path (illustrative) */
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-17, 0, 34), new THREE.Vector3(-9, 0, 22), new THREE.Vector3(-2, 0, 12), new THREE.Vector3(4.5, 0, 5), new THREE.Vector3(9.5, 0, -1.5)
], false, 'catmullrom', 0.5);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const ramp = (t, t0, R, v) => { const x = t - t0; if (x <= 0) return 0; const s = x / R; return s < 1 ? v * R * (s * s * s - s * s * s * s / 2) : v * (R * 0.5 + x - R); };
function usvState(t) {
  const u = clamp((t - 30) / 23) * 0.93, p = path.getPointAt(u), T = path.getTangentAt(u);
  const hd = (uu) => { const q = path.getTangentAt(clamp(uu, 0, 1)); return Math.atan2(-q.x, -q.z); };
  const heading = hd(u), dh = angDiff(hd(u + 0.012), hd(u - 0.012));
  const rudder = clamp(-dh * 16, -0.5, 0.5) + 0.13 * Math.sin(t * 1.5);
  return { x: p.x, z: p.z, heading, rudder, T: new THREE.Vector3(T.x, 0, T.z).normalize(), propAngle: ramp(t, 29, 2, 22) };
}
const TMP = new THREE.Vector3();
function povPose(t, st, cameraObj, offs) {
  const fwd = st.T, right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const [ox, oy, of, look, fov] = offs;
  const lvl = harbourLevel(t);
  const base = new THREE.Vector3(st.x, lvl, st.z);
  cameraObj.position.copy(base).addScaledVector(right, ox).addScaledVector(fwd, of).setY(lvl + oy);
  const center = base.clone().setY(lvl + 0.55);
  const pan = Math.sin(t * 0.45) * 0.05;
  const ahead = base.clone().addScaledVector(fwd, 22).addScaledVector(right, pan * 22).setY(lvl + 0.9);
  ahead.lerp(new THREE.Vector3(16.8, lvl + 1.3, -10.5), 0.62 * smooth((t - 37) / 7) * look);   // operator turns the camera toward the pier
  cameraObj.lookAt(TMP.copy(center).lerp(ahead, look));
  cameraObj.fov = fov; cameraObj.updateProjectionMatrix();
}
function s4Offsets(t) {
  const [ox, oy, of, look, fov] = track([[30, 4.6, 3.3, -8.5, 0, 40], [33.4, 3.2, 2.0, -5.2, 0, 42], [35.1, 0.9, 1.7, 0.4, 0.4, 50], [36.3, 0, 0.9, 1.5, 1, 60], [53, 0, 0.9, 1.5, 1, 60]], t);
  return [ox, oy, of, clamp(look), fov];
}
const POV_OFFS = [0, 0.9, 1.5, 1, 60];

/* ---------------------------------------------------------------- environment parameter sets */
const storm = (t) => {
  const f = [2.35, 5.4, 7.25].reduce((a, e) => a + (t >= e ? Math.exp(-(t - e) * 7) * (0.75 + 0.25 * Math.sin(t * 90)) : 0), 0)
          + [2.55, 5.65].reduce((a, e) => a + (t >= e ? Math.exp(-(t - e) * 11) * 0.6 : 0), 0);
  const lvl = 1.26 * smooth((t - 0.4) / 8.3);
  return { t, level: lvl + Math.sin(t * 1.7) * 0.03, amp: lerp(0.62, 0.95, smooth(t / 9)), foam: 1, rain: 1, wind: 0.42, flash: clamp(f, 0, 1.4),
    skyTop: 0x090e15, skyBot: 0x3a4650, cloudCol: 0x11161c, cloud: 1.15, fog: 0x2c3842, fogDensity: 0.014,
    sun: 0.55, sunColor: 0xaebdcc, sunPos: [-40, 60, 50], hemi: 0.28, env: 0.22, seaCol: 0x123846,
    damage: 0, debris: 0, lamps: 0.0, windows: 0.0, lantern: 0.0, usv: null };
};
const after = (t) => ({ t, level: lerp(0.5, 0.2, smooth((t - 9) / 8)), amp: 0.11, foam: 0.1, rain: 0, wind: 0.1, flash: 0,
  skyTop: 0x56626d, skyBot: 0xb5c0c8, cloudCol: 0x8a949c, cloud: 0.85, fog: 0xa3afb8, fogDensity: 0.017,
  sun: 1.0, sunColor: 0xe3e9ef, sunPos: [-30, 50, 40], hemi: 0.7, env: 0.55, seaCol: 0x35586a,
  damage: 1, debris: smooth((t - 9) / 0.5), lamps: 0, windows: 0, lantern: 0, usv: null });
const dusk = (t) => ({ t, level: 0, amp: 0.05, foam: 0, rain: 0, wind: 0, flash: 0,
  skyTop: 0x0b1e3a, skyBot: 0x6f9bbd, cloudCol: 0x2c4764, cloud: 0.45, fog: 0x4f7592, fogDensity: 0.0075,
  sun: 1.3, sunColor: 0xc3d8ff, sunPos: [-60, 22, 30], hemi: 0.55, env: 0.45, seaCol: 0x0f3b57,
  damage: 0.6, debris: 0.55, lamps: 0.95, windows: 1.4, lantern: 1.4, usv: usvState(t) });
function harbourLevel(t) { return t < 17 ? (t < 9 ? storm(t).level : after(t).level) : 0; }

/* ---------------------------------------------------------------- overlay helpers */
const cues = [];
const cue = (id, tin, tout, o = {}) => { const el = $(id); cues.push({ el, tin, tout, fi: o.fi ?? 0.8, fo: o.fo ?? 0.55, dy: o.dy ?? 26, blur: o.blur ?? 8, ls: o.ls, base: o.base ?? '' }); };
cue('s1a', 0.5, 8.6, { ls: [0.7, 0.42] }); cue('s1b', 1.1, 8.6); cue('s1stat', 3.1, 8.7, { dy: 40, fi: 1.1 });
cue('s1cap', 4.3, 8.7); cue('s1src', 5.0, 8.7, { dy: 10 }); cue('illus', 0.8, 16.4, { dy: 8 });
cue('s2a', 9.7, 13.4); cue('s2b', 12.5, 16.4, { fi: 1.0 });
cue('s3a', 17.9, 29.3); cue('s3b', 18.4, 29.3); cue('s3chips', 26.0, 29.6, { dy: 18 });
cue('s4tag', 30.9, 41.6, { dy: 8 });
cue('s6a', 54.0, 59.0, { dy: 20, fi: 1.2, ls: [0.3, 0.14] }); cue('s6r', 54.5, 59.0, { dy: 0 }); cue('s6b', 55.2, 59.0); cue('s6c', 56.1, 59.0); cue('s6d', 57.0, 59.0, { dy: 8 });
cue('dhead', 42.5, 52.6, { dy: -16 }); cue('feedFrame', 43.2, 52.6, { dy: 0 });
[['pDet', 43.2], ['pGps', 43.5], ['pImu', 44.2], ['pPro', 44.5], ['pRud', 44.8], ['pCom', 45.1], ['pSaf', 45.4]].forEach(([id, t]) => cue(id, t, 52.6, { dy: 36, blur: 0, fi: 0.7 }));
cue('dnote', 46.2, 52.6, { dy: 0 });

function applyCues(t) {
  for (const c of cues) {
    const a = easeOut((t - c.tin) / c.fi) * (1 - smooth((t - (c.tout - c.fo)) / c.fo));
    const s = c.el.style; s.opacity = a.toFixed(3);
    s.transform = `translateY(${((1 - a) * c.dy).toFixed(1)}px)`;
    s.filter = c.blur ? `blur(${((1 - a) * c.blur).toFixed(1)}px)` : '';
    if (c.ls) s.letterSpacing = lerp(c.ls[0], c.ls[1], easeOut((t - c.tin) / 2.2)) + 'em';
    s.visibility = a < 0.003 ? 'hidden' : 'visible';
  }
}

/* project a 3D point to stage pixels */
function toPx(v, camera, rect = { x: 0, y: 0, w: W, h: H }) {
  const p = v.clone().project(camera);
  return { x: rect.x + (p.x * 0.5 + 0.5) * rect.w, y: rect.y + (-p.y * 0.5 + 0.5) * rect.h, z: p.z };
}
function placeCallout(id, a, b, camera, local, dx, dy, tin, tout) {
  const el = $(id), t = a;
  const k = easeOut((t - tin) / 0.7) * (1 - smooth((t - (tout - 0.5)) / 0.5));
  el.style.opacity = k.toFixed(3); el.style.visibility = k < 0.003 ? 'hidden' : 'visible'; if (k < 0.003) return;
  const p = toPx(local, camera);
  const dot = el.querySelector('.dot'), ln = el.querySelector('.ln'), tx = el.querySelector('.tx');
  dot.style.left = p.x + 'px'; dot.style.top = p.y + 'px';
  const flip = p.x + dx + 340 > W - 50; if (flip) dx = -dx;
  const len = Math.hypot(dx, dy) * k, ang = Math.atan2(dy, dx);
  ln.style.left = p.x + 'px'; ln.style.top = p.y + 'px'; ln.style.width = len + 'px'; ln.style.transform = `rotate(${ang}rad)`;
  tx.style.transform = flip ? 'translateX(-100%)' : 'none';
  tx.style.left = (p.x + dx + (flip ? -8 : 8)) + 'px'; tx.style.top = (p.y + dy - 24) + 'px';
}

/* ---------------------------------------------------------------- 2D overlay canvas (viewfinder + detections) */
const ov = $('ov').getContext('2d');
const boxOf = (obj, camera, rect) => {
  const b = new THREE.Box3().setFromObject(obj), pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(toPx(new THREE.Vector3(x, y, z), camera, rect));
  if (pts.some((p) => p.z > 1)) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
function bracket(g, x, y, w, h, l, col, lw) {
  g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  g.moveTo(x, y + l); g.lineTo(x, y); g.lineTo(x + l, y); g.moveTo(x + w - l, y); g.lineTo(x + w, y); g.lineTo(x + w, y + l);
  g.moveTo(x, y + h - l); g.lineTo(x, y + h); g.lineTo(x + l, y + h); g.moveTo(x + w - l, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - l); g.stroke();
}
function drawFeed(g, rect, t, tStart, camera, full) {
  const sc = rect.w / W, a = easeOut((t - tStart) / 0.8);
  g.save(); g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
  if (a > 0.001) {
    g.globalAlpha = a;
    const m = 34 * sc + (full ? 0 : 8);
    bracket(g, rect.x + m, rect.y + m, rect.w - 2 * m, rect.h - 2 * m, 46 * sc, 'rgba(231,240,248,.85)', 2.5 * sc + 0.5);
    g.fillStyle = '#ff4d5a'; g.beginPath(); g.arc(rect.x + m + 26 * sc, rect.y + m + 30 * sc, 8 * sc, 0, 7); g.fill();
    g.fillStyle = 'rgba(231,240,248,.92)'; g.font = `600 ${22 * sc}px "Segoe UI",sans-serif`; g.textBaseline = 'middle';
    g.fillText('CAMERA VIEW', rect.x + m + 48 * sc, rect.y + m + 30 * sc);
    g.textAlign = 'right'; g.fillText('CONCEPT', rect.x + rect.w - m - 22 * sc, rect.y + m + 30 * sc); g.textAlign = 'left';
    // crosshair
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2; g.strokeStyle = 'rgba(231,240,248,.45)'; g.lineWidth = 1.5 * sc + 0.4;
    g.beginPath(); g.moveTo(cx - 20 * sc, cy); g.lineTo(cx - 6 * sc, cy); g.moveTo(cx + 6 * sc, cy); g.lineTo(cx + 20 * sc, cy); g.moveTo(cx, cy - 20 * sc); g.lineTo(cx, cy - 6 * sc); g.moveTo(cx, cy + 6 * sc); g.lineTo(cx, cy + 20 * sc); g.stroke();
    // detections (supported classes only: boat, person)
    camera.updateMatrixWorld();
    const dets = [['BOAT', harbour.targets.boat, tStart + 1.2], ['PERSON', harbour.targets.person, tStart + 2.8]];
    for (const [label, obj, t0] of dets) {
      const k = easeOut((t - t0) / 0.6); if (k < 0.01) continue;
      const b = boxOf(obj, camera, rect); if (!b) continue;
      const pad = (14 + (1 - k) * 40) * sc, x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + 2 * pad, h = b.y1 - b.y0 + 2 * pad;
      if (w < 6 || h < 6 || x > rect.x + rect.w || y > rect.y + rect.h || x + w < rect.x || y + h < rect.y) continue;
      g.globalAlpha = a * k; bracket(g, x, y, w, h, Math.min(w, h) * 0.28, '#38bdf0', 3 * sc + 0.6);
      g.fillStyle = 'rgba(56,189,240,.10)'; g.fillRect(x, y, w, h);
      g.font = `700 ${20 * sc}px "Segoe UI",sans-serif`; const tw = g.measureText(label).width + 22 * sc;
      g.fillStyle = '#38bdf0'; g.fillRect(x, y - 30 * sc, tw, 30 * sc); g.fillStyle = '#04121e'; g.textBaseline = 'middle'; g.fillText(label, x + 11 * sc, y - 14 * sc);
    }
    // scan line
    g.globalAlpha = a * 0.35; const sy = rect.y + ((t * 0.28) % 1) * rect.h; const gr = g.createLinearGradient(0, sy - 40 * sc, 0, sy);
    gr.addColorStop(0, 'rgba(56,189,240,0)'); gr.addColorStop(1, 'rgba(56,189,240,.55)'); g.fillStyle = gr; g.fillRect(rect.x, sy - 40 * sc, rect.w, 40 * sc);
  }
  g.restore(); g.globalAlpha = 1;
}

/* ---------------------------------------------------------------- dashboard live values (all simulated) */
const map = $('map').getContext('2d');
const set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
function drawMap(t, st) {
  const g = map, w = 760, h = 289; g.clearRect(0, 0, w, h);
  g.fillStyle = '#0a1b2e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(56,189,240,.10)'; g.lineWidth = 1;
  for (let x = 0; x <= w; x += 38) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // abstract quay / pier outline
  g.fillStyle = '#12304a'; g.fillRect(0, 0, w, 52); g.fillRect(470, 40, 40, 150);
  g.strokeStyle = '#2b4d72'; g.lineWidth = 2; g.strokeRect(0, 0, w, 52); g.strokeRect(470, 40, 40, 150);
  const mx = (x) => 90 + (x + 20) / 40 * 560, my = (z) => 270 - (z + 8) / 52 * 215;
  const prog = clamp((t - 42.5) / 10.5) * 0.93, N = 70; g.strokeStyle = '#38bdf0'; g.lineWidth = 3; g.setLineDash([2, 7]); g.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N * Math.min(0.93, 0.93 * (0.55 + prog)); const p = path.getPointAt(clamp(u)); i ? g.lineTo(mx(p.x), my(p.z)) : g.moveTo(mx(p.x), my(p.z)); }
  g.stroke(); g.setLineDash([]);
  const mxp = mx(st.x), myp = my(st.z), ring = (t * 1.4) % 1;
  g.strokeStyle = `rgba(242,177,52,${1 - ring})`; g.lineWidth = 2; g.beginPath(); g.arc(mxp, myp, 8 + ring * 26, 0, 7); g.stroke();
  g.fillStyle = '#f2b134'; g.beginPath(); g.arc(mxp, myp, 7, 0, 7); g.fill();
}
function updateDash(t) {
  if (t < 42.4 || t > 53.2) return;
  const st = usvState(Math.min(t, 53)), tt = t - 42;
  set('dclock', 'T+00:' + String(Math.floor(tt)).padStart(2, '0'));
  const roll = 3.2 * Math.sin(t * 1.3), pitch = 1.8 * Math.sin(t * 0.9 + 1), hdg = ((-st.heading / D2R) % 360 + 360) % 360;
  set('iR', roll.toFixed(1) + '°'); set('iP', pitch.toFixed(1) + '°'); set('iY', Math.round(hdg) + '°');
  $('iRb').style.cssText = `left:${50 + Math.min(0, roll / 15 * 50)}%;width:${Math.abs(roll / 15 * 50)}%`;
  $('iPb').style.cssText = `left:${50 + Math.min(0, pitch / 15 * 50)}%;width:${Math.abs(pitch / 15 * 50)}%`;
  $('iYb').style.cssText = `left:0;width:${hdg / 360 * 100}%`;
  const base = 48, steer = st.rudder / 0.52 * 22, mL = clamp(base + steer, 0, 100), mR = clamp(base - steer, 0, 100);
  set('mL', Math.round(mL) + '%'); set('mR', Math.round(mR) + '%'); $('mLb').style.width = mL + '%'; $('mRb').style.width = mR + '%';
  const deg = st.rudder / D2R, ang = clamp(deg, -30, 30);
  $('rNeedle').setAttribute('transform', `rotate(${ang * 1.5} 0 100)`); set('rVal', (deg >= 0 ? '+' : '−') + Math.abs(deg).toFixed(0) + '°');
  const a0 = -Math.PI / 2, a1 = a0 + ang * 1.5 * D2R, R = 100, cx = 0, cy = 100;
  $('rArc').setAttribute('d', `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 ${a1 > a0 ? 1 : 0} ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`);
  const lat = 56.1612 + (st.z - 20) * -0.000009, lon = 15.5869 + st.x * 0.000016;
  $('gpsTxt').textContent = `${lat.toFixed(5)}° N   ${lon.toFixed(5)}° E`;
  drawMap(t, st);
  set('cLat', Math.round(24 + 4 * Math.sin(t * 2.2)) + ' ms'); set('cSig', '−' + Math.round(58 + 3 * Math.sin(t * 0.8)) + ' dBm');
  $('hb').style.opacity = (0.35 + 0.65 * (Math.sin(t * 6.28 * 1.0) > 0 ? 1 : 0.2)).toFixed(2);
  const nb = clamp((t - 44.5) / 0.7), np = clamp((t - 46.0) / 0.7);
  set('dBoatN', nb > 0.5 ? '1' : '0'); set('dPersN', np > 0.5 ? '1' : '0'); $('dBoat').style.width = nb * 100 + '%'; $('dPers').style.width = np * 100 + '%';
  const glow = 0.5 + 0.5 * Math.sin(t * 3); $('bStop').style.boxShadow = t > 49 ? `0 0 ${18 * glow}px rgba(255,77,90,.55)` : 'none';
}

/* ---------------------------------------------------------------- dips between scenes */
const dip = (t, c, w) => smooth(1 - Math.abs(t - c) / w);

/* ---------------------------------------------------------------- the frame function */
const fadeEl = $('fade'), dashEl = $('dash'), stageEl = $('stage');
const S3_PROPS = new THREE.Vector3(0, 11.5, 13.5), S3_RUDDER = new THREE.Vector3(0, 4.5, 13.4);
function orbit(c, k, shake = 0) {
  const [az, el, d, tx, ty, tz] = k, a = az * D2R, e = el * D2R;
  c.position.set(tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(a) * Math.cos(e)); c.lookAt(tx, ty, tz);
}

// Narration sync: film time (what the player / audio use) → internal scene time (what the scenes were authored in).
// Cuts sit in the pauses between narration paragraphs (voiceover.wav starts at VO_OFFSET s).
const VO_OFFSET = 0.8;
const WARP = [[0, 0], [12.8, 9], [19.35, 17], [26.8, 30], [34.3, 42], [43.5, 53], [60, 60]];
function warp(tf) {
  tf = clamp(tf, 0, DUR);
  for (let i = 0; i < WARP.length - 1; i++) {
    const [a, ta] = WARP[i], [b, tb] = WARP[i + 1];
    if (tf <= b) return ta + (tf - a) / (b - a) * (tb - ta);
  }
  return DUR;
}
function frame(tFilm) {
  const t = clamp(warp(tFilm), 0, DUR - 1e-4);
  const scene = t < 9 ? 1 : t < 17 ? 2 : t < 30 ? 3 : t < 42 ? 4 : t < 53 ? 5 : 6;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  renderer.setClearColor(0x050d18, scene === 5 ? 0 : 1); renderer.clear();
  cam.aspect = W / H; cam.clearViewOffset(); ov.clearRect(0, 0, W, H);
  stageEl.classList.toggle('dashboard', scene === 5);
  dashEl.style.opacity = scene === 5 ? 1 : 0;
  if (scene !== 3) { $('c3a').style.opacity = 0; $('c3b').style.opacity = 0; }
  if (scene !== 2) $('s2tag').style.opacity = 0;

  if (scene === 1 || scene === 2) {
    const keys = scene === 1 ? KEY_S1 : KEY_S2, k = track(keys, t);
    cam.position.set(k[0], k[1], k[2]);
    const sh = scene === 1 ? 0.07 + 0.06 * smooth(t / 3) : 0.012;
    cam.position.x += Math.sin(t * 7.3) * sh + Math.sin(t * 3.1) * sh; cam.position.y += Math.sin(t * 9.1) * sh * 0.8;
    cam.lookAt(k[3], k[4], k[5]); cam.fov = k[6]; cam.updateProjectionMatrix();
    cam.rotation.z += Math.sin(t * 1.3) * (scene === 1 ? 0.012 : 0.004);
    harbour.update(scene === 1 ? storm(t) : after(t), cam.position);
    renderer.render(harbour.scene, cam);
    if (scene === 2) {
      cam.updateMatrixWorld();
      placeCallout('s2tag', t, 0, cam, new THREE.Vector3(18, 2.4, 1.5), 150, -90, 13.2, 16.4);
    }
  } else if (scene === 3 || scene === 6) {
    const keys = scene === 3 ? KEY_S3 : KEY_S6, k = track(keys, t);
    orbit(cam, k); cam.fov = scene === 3 ? 30 : 28;
    if (scene === 6) cam.setViewOffset(W, H, -620, 30, W, H); else cam.clearViewOffset();   // boat sits right of frame, titles left
    cam.updateProjectionMatrix();
    const reveal = scene === 3 ? smooth((t - 17.2) / 4.6) : 1;
    const rud = scene === 3 ? Math.sin((t - 24) * 1.5) * 0.52 * smooth((t - 24) / 1.2) * (1 - smooth((t - 29.2) / 0.8)) : Math.sin((t - 53) * 1.1) * 0.26 * smooth((t - 53.5) / 1.5);
    const propAngle = scene === 3 ? ramp(t, 20.4, 2.5, 20) : ramp(t, 53, 1.6, 12) + 60 * 0;
    studio.update({ t, reveal, propAngle, rudder: rud });
    renderer.render(studio.scene, cam);
    if (scene === 3) {
      cam.updateMatrixWorld();
      placeCallout('c3a', t, 0, cam, S3_PROPS, 130, -105, 21.6, 25.4);
      placeCallout('c3b', t, 0, cam, S3_RUDDER, 150, 90, 25.0, 29.2);
    } else { $('c3a').style.opacity = 0; $('c3b').style.opacity = 0; }
  } else if (scene === 4) {
    const st = usvState(t);
    povPose(t, st, cam, s4Offsets(t));
    harbour.update(dusk(t), cam.position);
    renderer.render(harbour.scene, cam);
  } else if (scene === 5) {
    const st = usvState(Math.min(t, 53)), f = smooth((t - 42) / 1.5);
    const rect = { x: lerp(0, 48, f), y: lerp(0, 108, f), w: lerp(W, 1040, f), h: lerp(H, 585, f) };
    povPose(t, st, pov, POV_OFFS); pov.aspect = rect.w / rect.h; pov.updateProjectionMatrix();
    harbour.update(dusk(t), pov.position);
    const ry = H - rect.y - rect.h;
    renderer.setScissorTest(true); renderer.setScissor(rect.x, ry, rect.w, rect.h); renderer.setViewport(rect.x, ry, rect.w, rect.h);
    renderer.render(harbour.scene, pov);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    drawFeed(ov, rect, t, 35.6 + 0 * 1, pov, false);
    $('feedFrame').style.borderColor = `rgba(43,77,114,${f})`;
    updateDash(t);
  }
  if (scene === 4) drawFeed(ov, { x: 0, y: 0, w: W, h: H }, t, 36.2, cam, true);

  // transitions
  const d = Math.max(dip(t, 9, 0.35), dip(t, 17, 0.5), dip(t, 30, 0.55), dip(t, 53, 0.55));
  const fin = 1 - smooth(t / 0.9), fout = smooth((t - 58.7) / 1.25);
  fadeEl.style.opacity = Math.max(d, fin, fout).toFixed(3);

  // animated statistic (+0 → +135, matches the SMHI value for Skanör)
  const n = Math.round(126 * easeOut((t - 3.4) / 3.2)); set('statNum', '+' + n);
  applyCues(t);
}

/* ---------------------------------------------------------------- player */
let playing = false, tNow = 0, last = 0;
const vo = $('vo'), seek = $('seek'), clock = $('clock'), bPlay = $('bPlay');
let hasVO = false; vo.addEventListener('canplaythrough', () => { hasVO = true; $('bAud').textContent = 'Voice: on'; });
$('bAud').onclick = () => { vo.muted = !vo.muted; $('bAud').textContent = hasVO ? (vo.muted ? 'Voice: muted' : 'Voice: on') : 'Voice: n/a'; };
function setTime(t) { tNow = clamp(t, 0, DUR); frame(tNow); seek.value = tNow; const s = Math.floor(tNow);
  clock.textContent = `0:${String(s).padStart(2, '0')}.${Math.floor((tNow - s) * 10)} / 1:00`; }
function syncAudio(force) {
  if (!hasVO || !playing) return;
  const want = tNow - VO_OFFSET;
  if (want < 0) { vo.pause(); return; }
  if (force || vo.paused || Math.abs(vo.currentTime - want) > 0.25) vo.currentTime = want;
  if (vo.paused) vo.play().catch(() => {});
}
function play() { playing = true; if (typeof poster !== 'undefined' && poster) { poster = false; setTime(0); } bPlay.textContent = 'Pause ❚❚'; last = performance.now(); syncAudio(true); }
function pause() { playing = false; bPlay.textContent = 'Play ▸'; vo.pause(); }
bPlay.onclick = () => (playing ? pause() : (tNow >= DUR - 0.05 && setTime(0), play()));
$('bRestart').onclick = () => { setTime(0); play(); };
seek.oninput = () => { poster = false; setTime(+seek.value); syncAudio(true); };
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); bPlay.click(); } if (e.key === 'ArrowRight') setTime(tNow + 1); if (e.key === 'ArrowLeft') setTime(tNow - 1);
  if (e.key.toLowerCase() === 'c') document.body.classList.toggle('clean'); if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.(); fit(); });
function loop(now) { requestAnimationFrame(loop);
  if (playing) { tNow += (now - last) / 1000; last = now; if (tNow >= DUR) { tNow = DUR; pause(); } setTime(tNow); syncAudio(false); } }
function fit() { const wrap = $('wrap'), k = Math.min(wrap.clientWidth / W, wrap.clientHeight / H); stageEl.style.transform = `scale(${k})`; }
addEventListener('resize', fit); fit(); new ResizeObserver(fit).observe($('wrap'));

/* record the tab (Chrome/Edge): picks "This tab", records 60 s, then downloads a .webm */
$('bRec').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: 1920, height: 1080 }, audio: true, preferCurrentTab: true });
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 16e6 }), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach((s) => s.stop()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = 'seaguardian-film.webm'; a.click(); };
    document.body.classList.add('clean'); fit(); setTime(0); rec.start(); play();
    const iv = setInterval(() => { if (tNow >= DUR - 0.05) { clearInterval(iv); setTimeout(() => rec.stop(), 400); } }, 200);
  } catch (e) { console.warn('record cancelled', e); }
};

const q = new URLSearchParams(location.search);
if (q.has('clean')) document.body.classList.add('clean');
let poster = !q.has('t'); fit(); setTime(q.has('t') ? +q.get('t') : 6.2);
requestAnimationFrame(loop);
if (q.has('autoplay')) play();
window.FILM = { frame, setTime, DUR, FPS, THREE, renderer, harbour, studio, play, pause };
