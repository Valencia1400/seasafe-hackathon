// SeaGuardian – cinematic product film (1920×1080, 30 fps). Master clock = the supplied narration (audio/narration.mp3).
// frame(tf) draws the complete picture for film time tf (seconds) onto two canvases (WebGL + 2D), so the same code
// drives the live preview and the frame-by-frame MP4 export.  Open with ?export to render the video file.
import * as THREE from 'three';
import { createHarbour, createStudio } from './world.js';
import { makeRig } from './rig.js';
import { D2R, clamp, lerp, smooth, easeOut, track, KEY_S1, path, angDiff, ramp, storm, after, dusk } from './shared.js';
import { T, TR, rr, tag, callout, vignette, laptop, wifiLink, feedHud, dashboard, vis, scrim, C, DISPLAY, TEXT } from './cine-draw.js';
import { buildMix } from './cine-audio.js';
import { muxMp4 } from './mp4mux.js';

const W = 1920, H = 1080, FPS = 30;
const q = new URLSearchParams(location.search), EXPORT = q.has('export'), QUALITY = EXPORT || q.has('hq') ? 1 : 0.62;
const $ = (id) => document.getElementById(id);

/* ================================================================== narration timing
   Sentence start/end in the audio file (seconds), from pause detection on narration.mp3.  1-based: s0(1) = start of sentence 1 in film time. */
const OFF = 0.6;                                             // silence before the narrator starts
const S = [[0.02, 1.66], [2.1, 4.88], [5.26, 10.54], [11.12, 13.98], [14.36, 16.4], [16.74, 18.3], [18.78, 24.06], [24.48, 27.8], [28.26, 29.88], [30.28, 36.02],
  [36.4, 39.9], [40.26, 44.22], [44.68, 49.38], [49.78, 54.48], [54.92, 57.68], [58, 61.8], [62.18, 64.06], [64.52, 67.54], [67.84, 70.52], [70.92, 74.22],
  [74.58, 76.7], [77.1, 79.7], [80.06, 81.52], [82, 84.86], [85.28, 88.46], [88.84, 93.04], [93.46, 94.24], [94.68, 96.72]];
const a = (sec) => sec + OFF, s0 = (i) => S[i - 1][0] + OFF, s1 = (i) => S[i - 1][1] + OFF, cut = (i) => (S[i - 1][1] + S[i][0]) / 2 + OFF;
const cA = cut(3), cB = cut(8), cC = cut(10), cD = cut(12), cE = cut(14), cF = cut(16), cG = cut(21), cH = cut(23), cI = cut(26);
const DUR = Math.ceil((s1(28) + 2.6) * FPS) / FPS;
const CUTS = [0, cA, cB, cC, cD, cE, cF, cG, cH, cI, DUR];
const sceneOf = (tf) => { let i = 0; while (i < 9 && tf >= CUTS[i + 1]) i++; return i; };
// key words inside sentences (audio seconds, from the fine pause map)
const W_126 = a(6.36), W_TIME = a(20.34), W_RES = a(21.36), W_DANGER = a(22.9), W_SAFE = a(26.7), W_TWIN = a(30.28), W_VESSEL = a(31.4), W_CAMERA = a(33.5),
  W_WIFI = a(38.1), W_CV = a(40.8), W_OBJ = a(42.0), W_REVIEW = a(43.1), W_CTRL = a(47.44), W_SENS = a(48.54),
  N1 = s0(17), N2 = a(65.3), N3 = a(66.02), N4 = a(66.95), N5 = a(68.68), N6 = a(69.3), W_79 = a(70.92), W_NEXTV = a(74.58), W_WORK = a(80.06),
  W_BENCH = a(89.54), W_TETHER = a(90.74), W_NAME = s0(27), W_SEE = s0(28);

/* ================================================================== renderer + worlds */
const glCanvas = $('gl'), ovCanvas = $('ov'), g = ovCanvas.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(QUALITY); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const harbour = createHarbour(renderer), studio = createStudio(renderer), rig = makeRig(studio.rig);
const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000), pov = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
const FULL = { x: 0, y: 0, w: W, h: H };
const renderIn = (scene, camera, r) => { const y = H - r.y - r.h; renderer.setScissorTest(true); renderer.setScissor(r.x, y, r.w, r.h); renderer.setViewport(r.x, y, r.w, r.h);
  camera.aspect = r.w / r.h; camera.updateProjectionMatrix(); renderer.render(scene, camera); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toPx = (v, camera, r = FULL) => { const p = v.clone().project(camera); return { x: r.x + (p.x * 0.5 + 0.5) * r.w, y: r.y + (-p.y * 0.5 + 0.5) * r.h, z: p.z }; };
const boxOf = (obj, camera, r) => { const b = new THREE.Box3().setFromObject(obj), pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(toPx(V(x, y, z), camera, r));
  if (pts.some((p) => p.z > 1)) return null; const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const orbit = (c, [az, el, d, tx, ty, tz]) => { const A = az * D2R, e = el * D2R; c.position.set(tx + d * Math.sin(A) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(A) * Math.cos(e)); c.lookAt(tx, ty, tz); };
const lerpR = (p, r, k) => ({ x: lerp(p.x, r.x, k), y: lerp(p.y, r.y, k), w: lerp(p.w, r.w, k), h: lerp(p.h, r.h, k) });

/* ================================================================== environments */
const P_STORM = (tf) => ({ ...storm(tf / cA * 9), t: tf * 0.9, ripple: 0.6, seaRough: 0.3 });
const P_AFTER = (tf) => ({ ...after(9 + (tf - cA) / (cB - cA) * 8), t: tf, ripple: 0.32 });
const P_DUSK = (tf, usv) => ({ ...dusk(31), t: tf, usv, ripple: 0.28, damage: 0.6 });
const P_MORNING = (tf, usv) => ({ t: tf, level: 0, amp: 0.06, foam: 0, rain: 0, wind: 0, flash: 0, skyTop: 0x3a6a9a, skyBot: 0xc6d8e4, cloudCol: 0xe8eef3, cloud: 0.5, fog: 0xa9c0d0, fogDensity: 0.006,
  sun: 1.5, sunColor: 0xfff1dc, sunPos: [-50, 40, 30], hemi: 0.7, env: 0.55, seaCol: 0x17425c, damage: 1, debris: 0.45, lamps: 0, windows: 0, lantern: 0, usv, ripple: 0.34 });
const P_DAWN = (tf, usv) => ({ t: tf, level: 0, amp: 0.035, foam: 0, rain: 0, wind: 0, flash: 0, skyTop: 0x1b3a66, skyBot: 0xf0b488, cloudCol: 0xe7a08a, cloud: 0.6, fog: 0xd3a58c, fogDensity: 0.0042,
  sun: 2.3, sunColor: 0xffc494, sunPos: [-78, 15, -100], hemi: 0.72, env: 0.62, seaCol: 0x2a5878, damage: 0, debris: 0, lamps: 0.75, windows: 1.1, lantern: 1.2, usv, ripple: 0.42, seaRough: 0.16, sunGlow: 0.95 });

/* ================================================================== vessel motion (illustrative) */
function usvOnPath(u, tf) {
  const p = path.getPointAt(clamp(u)), Tn = path.getTangentAt(clamp(u)), hd = (x) => { const k = path.getTangentAt(clamp(x)); return Math.atan2(-k.x, -k.z); };
  return { x: p.x, z: p.z, heading: hd(u), rudder: clamp(-angDiff(hd(u + 0.012), hd(u - 0.012)) * 16, -0.5, 0.5) + 0.13 * Math.sin(tf * 1.5), fwd: V(Tn.x, 0, Tn.z).normalize(), propAngle: tf * 22 };
}
const PIER_LOOK = V(16.8, 1.3, -10.5), TMP = V(0, 0, 0);
function poseOnVessel(c, st, [ox, oy, of, look, fov], tf, pier = 0) {
  const fwd = st.fwd, right = V(-fwd.z, 0, fwd.x), base = V(st.x, 0, st.z);
  c.position.copy(base).addScaledVector(right, ox).addScaledVector(fwd, of).setY(oy);
  const ahead = base.clone().addScaledVector(fwd, 22).addScaledVector(right, Math.sin(tf * 0.45) * 1.1).setY(0.9).lerp(PIER_LOOK, 0.62 * pier * look);
  c.lookAt(TMP.copy(base).setY(0.55).lerp(ahead, look)); c.fov = fov;
}
const POV = [0, 0.9, 1.5, 1, 60];
const missionU = (tf) => lerp(0.08, 0.6, (tf - cC) / (cE - cC));

/* ================================================================== overlay building blocks */
const LAP = { x: 760, y: 215, w: 1040, h: 585 }, FEED = { x: 60, y: 120, w: 1040, h: 585 }, PIP = { x: 1230, y: 560, w: 600, h: 337.5 };
const title = (s, x, y, k, o = {}) => TR(g, s, x, y, k, { size: 84, weight: 700, ls: 0.06, shadow: 24, ...o });
const eyebrow = (s, x, y, k, o = {}) => TR(g, s, x, y, k, { size: 28, weight: 500, ls: 0.42, color: '#b9d4e8', shadow: 14, dy: 12, ...o });
const body = (s, x, y, k, o = {}) => TR(g, s, x, y, k, { size: 32, weight: 400, font: TEXT, color: '#e7f0f8', shadow: 14, dy: 12, ...o });
function marker(p, k, t) { if (k <= 0.003 || p.z > 1) return; g.save(); g.globalAlpha = clamp(k); const r = 30 + (1 - Math.min(1, k * 1.3)) * 40, pu = (t * 0.9) % 1;
  g.strokeStyle = C.amber; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); g.globalAlpha = clamp(k) * (1 - pu) * 0.7; g.beginPath(); g.arc(p.x, p.y, r + pu * 34, 0, 7); g.stroke(); g.globalAlpha = clamp(k);
  g.fillStyle = 'rgba(6,16,27,.72)'; g.beginPath(); g.arc(p.x, p.y, r - 3, 0, 7); g.fill(); T(g, '?', p.x, p.y + 2, { size: 38, weight: 700, align: 'center', base: 'middle', color: C.amber }); g.restore(); }
function card(x, y, w, h, k, border = 'rgba(56,189,240,.5)') { g.save(); g.globalAlpha = clamp(k); g.translate(0, (1 - Math.min(1, k * 1.2)) * 26); rr(g, x, y, w, h, 14, 'rgba(8,20,34,.86)', border, 1.6); }

/* ================================================================== scenes */
function sceneStorm(tf) {
  const ti = tf / cA * 9, k = track(KEY_S1, ti), sh = 0.07 + 0.06 * smooth(ti / 3);
  cam.position.set(k[0] + Math.sin(tf * 7.3) * sh + Math.sin(tf * 3.1) * sh, k[1] + Math.sin(tf * 9.1) * sh * 0.8, k[2]); cam.lookAt(k[3], k[4], k[5]); cam.fov = k[6]; cam.rotation.z += Math.sin(tf * 1.3) * 0.012;
  harbour.update(P_STORM(tf), cam.position); renderIn(harbour.scene, cam, FULL);
  const out = cA - 0.3;
  eyebrow('OCTOBER 2023', 120, 150, vis(tf, s0(1) - 0.15, out));
  title('STORM BABET', 120, 252, vis(tf, s0(2), out, 0.9), { size: 108 });
  TR(g, 'SWEDEN’S SOUTHERN COAST', 124, 306, vis(tf, s0(2) + 1.0, out), { size: 30, weight: 300, ls: 0.3, color: '#cfe6f5', shadow: 14 });
  const ks = vis(tf, W_126 - 0.35, out, 0.9), n = Math.round(126 * easeOut((tf - W_126) / 1.7));
  if (ks > 0.003) { g.save(); g.globalAlpha = clamp(ks); const y = 742 + (1 - Math.min(1, ks * 1.2)) * 30; const w = T(g, '+' + n, 112, y, { size: 280, weight: 300, ls: -0.01, shadow: 40 });
    T(g, 'CM', 112 + w + 26, y, { size: 104, weight: 300, ls: 0.06, color: '#cfe6f5', shadow: 30 }); g.restore(); }
  body('Water level at Simrishamn above mean sea level', 122, 808, vis(tf, W_126 + 0.8, out));
  body('Source: SMHI', 122, 852, vis(tf, W_126 + 1.4, out), { size: 21, color: '#a8c0d4' });
  tag(g, 'ILLUSTRATIVE RECONSTRUCTION', 120, 1000, vis(tf, 0.9, out));
}

const KEY_B = [[cA, 40, 9, 26, 16, 2, -8, 42], [s0(5) + 0.4, 31, 6, 15, 17, 2, -6, 42], [s0(7) + 0.4, 24.5, 3.5, -3.5, 17.6, 2.9, -9.5, 34], [s1(7) + 0.2, 23.2, 3.2, -1.2, 17.6, 2.8, -9.5, 33],
  [s0(8) + 1.4, 11, 1.5, 13, 16, 1.2, -4, 40], [cB + 0.2, 6.5, 0.7, 21, 14, 0.7, 0, 46]];
function sceneAftermath(tf) {
  const k = track(KEY_B, tf); cam.position.set(k[0] + Math.sin(tf * 0.7) * 0.05, k[1] + Math.sin(tf * 0.9) * 0.03, k[2]); cam.lookAt(k[3], k[4], k[5]); cam.fov = k[6];
  harbour.update(P_AFTER(tf), cam.position); renderIn(harbour.scene, cam, FULL); cam.updateMatrixWorld();
  scrim(g, W, H, 'left', Math.max(vis(tf, s0(4) - 0.2, s1(4) + 0.6), vis(tf, s0(5) - 0.1, s1(6) + 0.6)), 0.6); scrim(g, W, H, 'right', vis(tf, s0(7) - 0.1, s1(7) + 0.5), 0.62); scrim(g, W, H, 'bottom', vis(tf, s0(8) - 0.1, cB), 0.6);
  title('WHEN THE STORM PASSES', 120, 220, vis(tf, s0(4) - 0.1, s1(4) + 0.5), { size: 76, weight: 600 });
  title('UNCERTAINTY REMAINS.', 120, 312, vis(tf, a(12.58) - 0.1, s1(4) + 0.5), { size: 76, weight: 300, color: C.cyan, ls: 0.1 });
  const mOut = s1(6) + 0.5; [[V(18, 2.6, -3), 0.15], [V(2, 2.3, -30), 0.75], [V(18, 6.6, 9.2), 1.35]].forEach(([p, d]) => marker(toPx(p, cam), vis(tf, s0(5) + d, mOut, 0.45), tf + d));
  title('WHICH STRUCTURES NEED INSPECTION?', 120, 880, vis(tf, s0(5), mOut), { size: 52, weight: 600 });
  title('WHERE SHOULD CREWS BEGIN?', 120, 950, vis(tf, s0(6), mOut), { size: 52, weight: 300, color: C.cyan });
  const wOut = s1(7) + 0.45; eyebrow('SENDING PEOPLE TO INVESTIGATE', 1800, 300, vis(tf, s0(7), wOut), { align: 'right', size: 24 });
  [['TIME', W_TIME], ['RESOURCES', W_RES], ['PERSONAL RISK', W_DANGER]].forEach(([s, t0], i) => title(s, 1800, 392 + i * 96, vis(tf, t0, wOut, 0.5), { align: 'right', size: 78, weight: i === 2 ? 700 : 300, color: i === 2 ? C.amber : '#fff' }));
  title('WHAT IF OPERATORS COULD LOOK FIRST', 960, 850, vis(tf, s0(8), cB - 0.25), { align: 'center', size: 62, weight: 600 });
  title('— FROM A SAFE DISTANCE?', 960, 930, vis(tf, W_SAFE - 0.1, cB - 0.25), { align: 'center', size: 62, weight: 300, color: C.cyan });
  tag(g, 'ILLUSTRATIVE RECONSTRUCTION', 120, 1000, vis(tf, cA + 0.4, s0(8) - 0.2));
}

const KEY_C = [[cB, 212, 6, 72, 0, 7, 0], [cB + 2.6, 236, 11, 62, 0, 7, 0], [W_VESSEL + 0.6, 286, 17, 52, 0, 7, 2], [W_CAMERA + 0.4, 322, 17, 52, 0, 8, 5], [cC + 0.2, 340, 15, 50, 0, 8, 6]];
function sceneReveal(tf) {
  orbit(cam, track(KEY_C, tf)); cam.fov = 30; cam.setViewOffset(W, H, -250, -90, W, H);
  const rudT = W_CAMERA - 0.4;
  studio.update({ t: tf, reveal: smooth((tf - cB - 0.1) / 3.4), propAngle: ramp(tf, cB + 2.4, 2.2, 16), rudder: Math.sin((tf - rudT) * 2.2) * 0.45 * smooth((tf - rudT) / 0.6) * (1 - smooth((tf - (cC - 0.5)) / 0.5)) });
  rig.set({}); renderIn(studio.scene, cam, FULL); cam.updateMatrixWorld();
  scrim(g, W, H, 'top', 0.6, 0.6); const out = cC - 0.3;
  eyebrow('INTRODUCING', 120, 150, vis(tf, s0(9) - 0.1, out));
  const kt = vis(tf, s0(9) + 0.35, out, 1.0); if (kt > 0.003) { g.save(); g.globalAlpha = clamp(kt); const y = 262 + (1 - Math.min(1, kt * 1.2)) * 22, ls = lerp(0.26, 0.12, easeOut((tf - s0(9) - 0.35) / 2.4));
    const w = T(g, 'SEA', 116, y, { size: 124, weight: 700, ls, shadow: 30 }); T(g, 'GUARDIAN', 116 + w, y, { size: 124, weight: 700, ls, color: C.cyan, shadow: 30 }); g.restore(); }
  TR(g, 'TWIN-HULL INSPECTION VESSEL  ·  3D-PRINTED PROTOTYPE', 122, 318, vis(tf, s0(10), out), { size: 25, weight: 500, ls: 0.24, color: '#bcd2e4', shadow: 12, dy: 12 });
  callout(g, 'TWIN HULL', toPx(V(-7.3, 5.5, -6), cam), -150, 170, vis(tf, W_TWIN, out, 0.5));
  callout(g, 'TWO PROPULSION MOTORS', toPx(V(-7.3, 11.7, 11), cam), 180, -190, vis(tf, W_VESSEL + 0.9, out, 0.5));
  callout(g, 'REAR RUDDER', toPx(V(0, 3.2, 13.6), cam), 170, 120, vis(tf, W_CAMERA - 0.3, out, 0.5));
  tag(g, 'ONBOARD CAMERA  ·  WI-FI VIDEO LINK', 120, 930, vis(tf, W_CAMERA, out), { color: C.cyan, size: 19 });
  tag(g, '3D RECONSTRUCTION OF THE PHYSICAL PROTOTYPE', 120, 1000, vis(tf, cB + 1.2, out));
}

const D_OFFS = [[cC, 4.6, 3.3, -8.5, 0, 40], [cC + 1.5, 3.2, 2.0, -5.2, 0, 42], [cC + 2.2, 0.9, 1.7, 0.4, 0.4, 50], [cC + 2.8, 0, 0.9, 1.5, 1, 60], [cE, 0, 0.9, 1.5, 1, 60]];
const T_POV = cC + 2.8, T_SHRINK0 = W_WIFI - 0.1, T_SHRINK1 = W_WIFI + 1.15;
function feedRect(tf) { if (tf < T_SHRINK0) return FULL; if (tf < cD) return lerpR(FULL, LAP, smooth((tf - T_SHRINK0) / (T_SHRINK1 - T_SHRINK0))); return lerpR(LAP, FEED, smooth((tf - cD) / 0.9)); }
function detections(tf, camera, r) { return [{ label: 'BOAT', box: boxOf(harbour.targets.boat, camera, r), k: easeOut((tf - W_CV) / 0.6) }, { label: 'PERSON', box: boxOf(harbour.targets.person, camera, r), k: easeOut((tf - W_OBJ) / 0.6) }]; }
function sceneMission(tf) {
  const st = usvOnPath(missionU(tf), tf), o = track(D_OFFS, tf), r = feedRect(tf);
  poseOnVessel(cam, st, [o[0], o[1], o[2], clamp(o[3]), o[4]], tf, smooth((tf - (cC + 3.2)) / 5));
  harbour.update(P_DUSK(tf, st), cam.position); renderIn(harbour.scene, cam, r); cam.updateMatrixWorld();
  const kl = smooth((tf - T_SHRINK0) / (T_SHRINK1 - T_SHRINK0));
  feedHud(g, r, tf, smooth((tf - T_POV) / 0.6), detections(tf, cam, r));
  laptop(g, r, kl); wifiLink(g, { x: 250, y: 507 }, { x: LAP.x, y: 507 }, tf, kl * (1 - smooth((tf - (cD - 0.3)) / 0.3)));
  eyebrow('CAMERA TO OPERATOR', 120, 150, vis(tf, T_SHRINK1 - 0.3, cD - 0.25));
  title('OPERATOR’S LAPTOP', LAP.x + LAP.w / 2, LAP.y - 46, vis(tf, T_SHRINK1, cD - 0.25), { size: 26, weight: 600, ls: 0.3, align: 'center', color: '#cfe6f5' });
  tag(g, 'SIMULATED DETECTIONS', LAP.x + LAP.w, LAP.y + LAP.h + 86, vis(tf, W_CV, cD - 0.25), { color: C.amber, align: 'right' });
  tag(g, 'FOR OPERATOR REVIEW', LAP.x, LAP.y + LAP.h + 86, vis(tf, W_REVIEW, cD - 0.25), { color: C.cyan });
  tag(g, 'CONCEPT VISUALIZATION', 120, 1000, vis(tf, cC + 0.5, cD - 0.25));
}
const MAP_PTS = Array.from({ length: 50 }, (_, i) => { const p = path.getPointAt(i / 49 * 0.7); return [0.12 + (p.x + 20) / 40 * 0.76, 0.94 - (p.z + 8) / 52 * 0.74]; });
function sceneDashboard(tf) {
  const u = missionU(tf), st = usvOnPath(u, tf), r = feedRect(tf);
  poseOnVessel(pov, st, POV, tf, 1); harbour.update(P_DUSK(tf, st), pov.position); renderIn(harbour.scene, pov, r); pov.updateMatrixWorld();
  feedHud(g, r, tf, 1, detections(tf, pov, r)); laptop(g, r, 1 - smooth((tf - cD) / 0.5));
  const out = cE - 0.3, kin = (t0) => vis(tf, t0, out, 0.6), deg = st.rudder / D2R, steer = st.rudder / 0.52 * 22;
  rr(g, r.x, r.y, r.w, r.h, 14, null, `rgba(43,77,114,${smooth((tf - cD - 0.4) / 0.5)})`, 2);
  dashboard(g, tf, { roll: 3.2 * Math.sin(tf * 1.3), pitch: 1.8 * Math.sin(tf * 0.9 + 1), hdg: ((-st.heading / D2R) % 360 + 360) % 360, mL: clamp(48 + steer, 0, 100), mR: clamp(48 - steer, 0, 100), rud: deg,
    lat: 56.1612 + (st.z - 20) * -0.000009, lon: 15.5869 + st.x * 0.000016, nb: 1, np: 1, mapPts: MAP_PTS, pos: [0.12 + (st.x + 20) / 40 * 0.76, 0.94 - (st.z + 8) / 52 * 0.74] },
  { head: kin(cD + 0.35), det: kin(cD + 0.7), pro: kin(W_CTRL - 0.1), rud: kin(W_CTRL + 0.15), saf: kin(W_CTRL + 0.4), imu: kin(W_SENS - 0.1), gps: kin(W_SENS + 0.15), com: kin(W_SENS + 0.4), imuGlow: vis(tf, s0(14) + 0.3, out, 0.5) });
  const kc = vis(tf, s0(14) + 0.2, out, 0.6); if (kc > 0.003) { card(84, 548, 700, 134, kc); T(g, 'DEMONSTRATED  ·  14 NOVEMBER', 108, 590, { size: 19, weight: 600, font: TEXT, ls: 0.22, color: C.green });
    T(g, 'Live orientation data from a real ESP32', 108, 632, { size: 31, weight: 600, font: TEXT }); T(g, 'reached the dashboard over Wi-Fi. Values in this film are simulated.', 108, 664, { size: 19, weight: 400, font: TEXT, color: '#a9c4d8' }); g.restore(); }
}

const PARTS = [['hullR', 'MODULAR TWIN HULL', '3D-printed pontoons', 150, 170], ['encl', 'ELECTRONICS BAY', 'ESP32 · MPU6050 IMU · NEO-6M GPS', 170, -120], ['propR', 'DC MOTORS + PROPELLERS', 'L298N motor driver', 130, -40],
  ['rudder', 'RUDDER', 'SG90 servo', 170, 110], ['batt', 'BATTERY HOLDER', null, -200, 70], ['hullL', 'CENTRAL PLATFORM', null, -210, -50]];
function sceneExploded(tf) {
  const e = smooth((tf - (cE + 0.35)) / 2.1);
  orbit(cam, [lerp(322, 282, smooth((tf - cE) / (cF - cE))), 27, 134, 0, 7.5, 6]); cam.fov = 30; cam.setViewOffset(W, H, -70, -40, W, H);
  studio.update({ t: tf, reveal: 1, propAngle: tf * 3, rudder: 0 }); rig.set({ explode: e, glow: 0.12 * e }); renderIn(studio.scene, cam, FULL); cam.updateMatrixWorld();
  scrim(g, W, H, 'left', 0.5, 0.55); const out = cF - 0.3;
  eyebrow('ACCESSIBLE ELECTRONICS', 120, 150, vis(tf, s0(15), out)); title('MODULAR DESIGN', 120, 244, vis(tf, s0(15) + 0.5, out), { size: 92 });
  PARTS.forEach(([grp, s, sub, dx, dy], i) => { const c = grp === 'hullL' ? V(0, 7.8, -1) : rig.centres[grp]; callout(g, s, toPx(c, cam), dx, dy, vis(tf, cE + 1.5 + i * 0.32, out, 0.5), { sub, size: 21 }); });
  tag(g, 'CAMERA BOARD  ·  XIAO ESP32S3 SENSE', 1800, 1000, vis(tf, cE + 3.4, out), { color: C.cyan, align: 'right', size: 18 });
  title('A COST-CONSCIOUS APPROACH', 120, 930, vis(tf, s0(16), out), { size: 46, weight: 600 }); title('TO PRELIMINARY INSPECTION', 120, 988, vis(tf, s0(16) + 0.7, out), { size: 46, weight: 300, color: C.cyan });
}

const NODES = [['INITIAL PROMPT', N1], ['CAD MODEL', N2], ['ELECTRONICS', N3], ['SOFTWARE', N4], ['TESTING', N5], ['IMPROVEMENTS', N6]], NX = (i) => 250 + i * 284, NY = 150;
function pipeline(tf, conv = 0) {            // conv 0..1: nodes fly into the vessel (scene H)
  const fade = 1 - conv; if (fade <= 0.003) return; g.save(); g.globalAlpha = fade * smooth((tf - cF - 0.2) / 0.6);
  const px = (i) => lerp(NX(i), 960, conv * conv), py = lerp(NY, 560, conv * conv);
  g.strokeStyle = C.line2; g.lineWidth = 3; g.beginPath(); g.moveTo(px(0), py); g.lineTo(px(5), py); g.stroke();
  let prog = 0; NODES.forEach(([, t0], i) => { if (tf >= t0) prog = i + (i < 5 ? clamp((tf - t0) / (NODES[i + 1][1] - t0)) : 0); });
  g.strokeStyle = C.cyan; g.shadowColor = C.cyan; g.shadowBlur = 14; g.beginPath(); g.moveTo(px(0), py); g.lineTo(lerp(px(0), px(5), Math.min(1, prog / 5)), py); g.stroke(); g.shadowBlur = 0;
  NODES.forEach(([s, t0], i) => { const on = easeOut((tf - t0) / 0.45), x = px(i);
    g.fillStyle = '#081625'; g.strokeStyle = on > 0.01 ? C.cyan : C.line2; g.lineWidth = 3; g.beginPath(); g.arc(x, py, 15 + 5 * on * (1 - smooth((tf - t0 - 0.3) / 0.5)) + 3 * on, 0, 7); g.fill(); g.stroke();
    if (on > 0.01) { g.fillStyle = C.cyan; g.globalAlpha = fade * on; g.beginPath(); g.arc(x, py, 8, 0, 7); g.fill(); g.globalAlpha = fade; }
    T(g, String(i + 1).padStart(2, '0'), x, py - 40, { size: 17, weight: 600, font: TEXT, ls: 0.2, align: 'center', color: on > 0.5 ? C.cyan : C.mute });
    T(g, s, x, py + 56, { size: 21, weight: 600, ls: 0.16, align: 'center', color: on > 0.5 ? '#fff' : C.mute, a: 0.55 + 0.45 * on }); });
  g.restore();
}
function sceneBuild(tf) {
  orbit(cam, [lerp(232, 262, (tf - cF) / (cG - cF)), 19, 104, 0, 8.5, 5]); cam.fov = 30; cam.setViewOffset(W, H, 0, -110, W, H);
  studio.update({ t: tf, reveal: 0.42, propAngle: 0, rudder: 0 });
  rig.set({ explode: 1, blueprint: 1, struct: smooth((tf - N2) / 0.9), elec: smooth((tf - N3) / 0.9) }); renderIn(studio.scene, cam, FULL); cam.clearViewOffset();
  pipeline(tf); const out = cG + 0.2;
  // 01 prompt
  const kp = vis(tf, N1, N2 + 0.5, 0.5); if (kp > 0.003) { card(560, 430, 800, 190, kp); const full = 'SAAB × MTC  ·  PROMPT-TO-PRODUCT', n = Math.floor(clamp((tf - N1 - 0.2) / 1.3) * full.length);
    T(g, 'HACKATHON CHALLENGE', 596, 484, { size: 18, weight: 600, font: TEXT, ls: 0.24, color: C.dim }); T(g, '> ' + full.slice(0, n) + (Math.floor(tf * 3) % 2 ? '▌' : ''), 596, 548, { size: 38, weight: 500, font: '"Cascadia Mono","Consolas",monospace', color: '#dff3ff' });
    T(g, 'It started as one idea.', 596, 592, { size: 20, weight: 400, font: TEXT, color: '#a9c4d8' }); g.restore(); }
  // 04 software
  const kw = vis(tf, N4, out, 0.5); if (kw > 0.003) { card(84, 300, 430, 250, kw); T(g, 'SOFTWARE', 110, 346, { size: 18, weight: 600, font: TEXT, ls: 0.24, color: C.dim });
    ['ESP32 control firmware', 'Camera stream firmware', 'Operator dashboard', 'Computer-vision viewer'].forEach((s, i) => { const kk = easeOut((tf - N4 - 0.15 - i * 0.16) / 0.4); g.fillStyle = C.cyan; g.globalAlpha = clamp(kw) * kk; g.fillRect(110, 378 + i * 42, 5, 24); T(g, s, 130, 398 + i * 42, { size: 24, weight: 500, font: TEXT }); }); g.restore(); }
  // 05 testing
  const kt = vis(tf, N5, out, 0.5); if (kt > 0.003) { card(1406, 300, 430, 330, kt); T(g, 'TESTING', 1432, 346, { size: 18, weight: 600, font: TEXT, ls: 0.24, color: C.dim });
    const done = Math.round(79 * clamp((tf - N5 - 0.2) / (W_79 - 0.05 - N5 - 0.2)));
    for (let i = 0; i < 79; i++) { const x = 1434 + (i % 16) * 23.6, y = 372 + Math.floor(i / 16) * 23.6; rr(g, x, y, 16, 16, 4, i < done ? C.green : '#16304a'); }
    const kn = easeOut((tf - W_79 + 0.35) / 0.45); g.globalAlpha = clamp(kt) * kn; const w = T(g, `${Math.min(79, done)}/79`, 1432, 560, { size: 78, weight: 700, color: C.green });
    T(g, 'PC FIRMWARE UNIT', 1432 + w + 18, 530, { size: 19, weight: 600, font: TEXT, ls: 0.14 }); T(g, 'TESTS PASSED', 1432 + w + 18, 558, { size: 19, weight: 600, font: TEXT, ls: 0.14 });
    T(g, 'Control logic, run on a PC', 1432, 602, { size: 18, weight: 400, font: TEXT, color: '#a9c4d8' }); g.restore(); }
  // 06 improvements
  const ki = vis(tf, N6, out, 0.5); if (ki > 0.003) { card(84, 580, 430, 264, ki, 'rgba(242,177,52,.55)'); T(g, 'IMPROVEMENTS', 110, 626, { size: 18, weight: 600, font: TEXT, ls: 0.24, color: C.dim });
    T(g, 'Emergency-stop', 110, 672, { size: 27, weight: 600, font: TEXT }); T(g, 'software flaw', 110, 706, { size: 27, weight: 600, font: TEXT });
    T(g, 'IDENTIFIED  →  CORRECTED', 110, 750, { size: 19, weight: 700, font: TEXT, ls: 0.14, color: C.green });
    const kpn = easeOut((tf - W_NEXTV) / 0.5); g.globalAlpha = clamp(ki) * (0.45 + 0.55 * kpn); T(g, 'Hardware validation of the fix:', 110, 792, { size: 18, weight: 400, font: TEXT, color: '#d7c9a6' }); T(g, 'PENDING', 110, 822, { size: 21, weight: 700, font: TEXT, ls: 0.22, color: C.amber }); g.restore(); }
  title('REAL-WORLD VALIDATION COMES NEXT', 960, 1000, vis(tf, W_NEXTV + 0.1, out), { align: 'center', size: 34, weight: 500, ls: 0.24, color: '#cfe6f5' });
}
function sceneCombine(tf) {
  const k = (tf - cG) / (cH - cG), e = 1 - smooth((tf - cG - 0.25) / 2.7), b = 1 - smooth((tf - (cG + 2.1)) / 1.5), lit = smooth((tf - (cG + 2.0)) / 1.8);
  orbit(cam, [262 + 160 * smooth(k * 0.98), lerp(19, 13, smooth(k)), lerp(104, 66, smooth(k * 1.05)), 0, lerp(8.5, 7, k), lerp(5, 1, k)]); cam.fov = 30; cam.setViewOffset(W, H, 0, lerp(-110, 90, smooth(k * 1.2)), W, H);
  studio.update({ t: tf, reveal: lerp(0.42, 1, lit), propAngle: ramp(tf, cG + 2.6, 1.4, 18), rudder: 0 });
  const flash = Math.exp(-Math.pow((tf - (cG + 2.9)) / 0.35, 2));
  rig.set({ explode: e, blueprint: b, glow: 0.75 * flash + 0.1 * (1 - lit) }); renderIn(studio.scene, cam, FULL); cam.clearViewOffset();
  pipeline(tf, smooth((tf - cG) / 1.3));
  if (flash > 0.01) { const gr = g.createRadialGradient(960, 560, 0, 960, 560, 900); gr.addColorStop(0, `rgba(120,210,255,${0.22 * flash})`); gr.addColorStop(1, 'rgba(120,210,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  title('INNOVATION ISN’T JUST ABOUT IDEAS.', 960, 190, vis(tf, s0(22), s1(22) + 0.5), { align: 'center', size: 46, weight: 300, ls: 0.2, color: '#cfe6f5' });
  title('IT’S ABOUT MAKING THEM WORK.', 960, 950, vis(tf, W_WORK, cH - 0.25, 0.8), { align: 'center', size: 78, weight: 700, ls: 0.1 });
}

const I_HEAD = Math.atan2(-4, 9);
function sceneValue(tf) {
  const k = (tf - cH) / (cI - cH), bx = lerp(6.6, 10.6, k), bz = lerp(9, 0, k), st = { x: bx, z: bz, heading: I_HEAD, rudder: 0.12 * Math.sin(tf * 1.3), propAngle: tf * 20, fwd: V(4, 0, -9).normalize(), wake: 0.6 };
  const ang = lerp(2.5, 1.55, smooth(k)), R = lerp(8.2, 6.2, k); cam.position.set(bx + Math.cos(ang) * R, lerp(2.5, 1.7, k), bz + Math.sin(ang) * R); cam.lookAt(bx + 2.2, 0.8, bz - 3.2); cam.fov = 38;
  harbour.update(P_MORNING(tf, st), cam.position); renderIn(harbour.scene, cam, FULL); cam.updateMatrixWorld();
  // operator's view (picture-in-picture)
  const kp = vis(tf, s0(25) - 0.2, W_BENCH - 0.5, 0.6);
  if (kp > 0.5) { poseOnVessel(pov, st, POV, tf, 0.9); renderIn(harbour.scene, pov, PIP); pov.updateMatrixWorld(); feedHud(g, PIP, tf, 1, [], 'OPERATOR VIEW'); }
  if (kp > 0.003) { g.save(); g.globalAlpha = clamp(kp > 0.5 ? 1 : 0); rr(g, PIP.x, PIP.y, PIP.w, PIP.h, 10, null, 'rgba(231,240,248,.85)', 3); g.restore(); tag(g, 'CONCEPT VISUALIZATION', PIP.x + PIP.w, PIP.y + PIP.h + 34, kp > 0.5 ? 1 : 0, { align: 'right' }); }
  scrim(g, W, H, 'left', 0.9, 0.66);
  title('NOT A REPLACEMENT', 120, 210, vis(tf, s0(24), s1(24) + 0.45), { size: 76, weight: 700 }); title('FOR PROFESSIONAL INSPECTION.', 120, 296, vis(tf, s0(24) + 0.7, s1(24) + 0.45), { size: 60, weight: 300, color: '#e7f0f8' });
  title('A WAY TO DECIDE', 120, 210, vis(tf, s0(25), s1(25) + 0.3), { size: 76, weight: 300 }); title('WHERE TO LOOK FIRST.', 120, 300, vis(tf, s0(25) + 0.8, s1(25) + 0.3), { size: 84, weight: 700, color: C.cyan });
  // planned next steps + tether
  const out = cI - 0.25, kn = vis(tf, s0(26) - 0.1, out), tk = vis(tf, W_TETHER, out, 0.8);
  eyebrow('NEXT STEPS', 120, 150, kn, { color: C.amber });
  [['01', 'BENCH VALIDATION', W_BENCH - 0.1], ['02', 'CONTROLLED, TETHERED WATER TRIAL', W_TETHER]].forEach(([n, s, t0], i) => { const kk = vis(tf, t0, out, 0.5); if (kk <= 0.003) return;
    card(120, 196 + i * 124, 780, 104, kk, 'rgba(242,177,52,.6)'); T(g, n, 150, 262 + i * 124, { size: 40, weight: 300, color: C.amber }); T(g, s, 226, 258 + i * 124, { size: 30, weight: 600, ls: 0.08 });
    tag(g, 'PLANNED', 872, 222 + i * 124, 1, { color: C.amber, align: 'right', size: 14 }); g.restore(); });
  if (tk > 0.003) { const A0 = V(16.6, 2.15, -4.2), B0 = V(bx - 0.35, 0.75, bz + 0.85); g.save(); g.globalAlpha = clamp(tk); g.strokeStyle = C.amber; g.lineWidth = 4.5; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.setLineDash([14, 9]); g.beginPath();
    const n = Math.round(24 * Math.min(1, tk * 1.2)); for (let i = 0; i <= n; i++) { const u = i / 24, p = toPx(V(lerp(A0.x, B0.x, u), lerp(A0.y, B0.y, u) - Math.sin(u * Math.PI) * 0.75, lerp(A0.z, B0.z, u)), cam); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
    g.stroke(); g.setLineDash([]); const pm = toPx(V(lerp(A0.x, B0.x, 0.45), 0.8, lerp(A0.z, B0.z, 0.45)), cam); g.restore(); tag(g, 'TETHER  ·  PLANNED', pm.x + 16, pm.y - 30, tk, { color: C.amber, size: 15 }); }
  tag(g, 'CONCEPT VISUALIZATION', 120, 1000, vis(tf, cH + 0.5, out));
}
function sceneHero(tf) {
  const k = (tf - cI) / (DUR - cI), bx = lerp(-7.5, -3.5, k), st = { x: bx, z: 13.5, heading: -Math.PI / 2, rudder: 0.04 * Math.sin(tf), propAngle: tf * 14, fwd: V(1, 0, 0), wake: 0.45 };
  cam.position.set(lerp(1.5, -0.5, smooth(k)), lerp(1.55, 1.25, k), lerp(27, 23.5, smooth(k))); cam.lookAt(-4.4, 1.5, 13.5); cam.fov = 27;
  harbour.update(P_DAWN(tf, st), cam.position); renderIn(harbour.scene, cam, FULL);
  const gr = g.createLinearGradient(0, 0, 0, 430); gr.addColorStop(0, 'rgba(4,12,26,.74)'); gr.addColorStop(1, 'rgba(4,12,26,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 470);
  const kt = easeOut((tf - W_NAME + 0.1) / 1.2); if (kt > 0.003) { g.save(); g.globalAlpha = clamp(kt); const ls = lerp(0.3, 0.16, easeOut((tf - W_NAME) / 3)), size = 148; g.font = `700 ${size}px ${DISPLAY}`; g.letterSpacing = `${ls * size}px`;
    const w1 = g.measureText('SEA').width, w2 = g.measureText('GUARDIAN').width, x = 960 - (w1 + w2 - ls * size) / 2; g.letterSpacing = '0px';
    T(g, 'SEA', x, 250, { size, weight: 700, ls, shadow: 34 }); T(g, 'GUARDIAN', x + w1, 250, { size, weight: 700, ls, color: C.cyan, shadow: 34 }); g.restore(); }
  const kr = easeOut((tf - W_SEE + 0.1) / 0.8); if (kr > 0.003) { g.fillStyle = `rgba(56,189,240,${kr})`; g.fillRect(960 - 60 * kr, 290, 120 * kr, 3); }
  TR(g, 'SEE FIRST.  ASSESS SMARTER.', 960, 356, easeOut((tf - W_SEE) / 0.9), { align: 'center', size: 46, weight: 300, ls: 0.34, color: '#e4f2fb', shadow: 20 });
  TR(g, '3D-printed hackathon prototype  ·  Field validation required', 960, 1010, easeOut((tf - W_SEE - 1.2) / 0.8), { align: 'center', size: 19, weight: 500, font: TEXT, ls: 0.1, color: 'rgba(231,240,248,.78)', shadow: 12, dy: 8 });
}

/* ================================================================== frame */
const SCENES = [sceneStorm, sceneAftermath, sceneReveal, sceneMission, sceneDashboard, sceneExploded, sceneBuild, sceneCombine, sceneValue, sceneHero];
const DIPS = [[cA, 0.4], [cB, 0.55], [cC, 0.5], [cE, 0.45], [cF, 0.45], [cH, 0.5], [cI, 0.6]];       // D→E and G→H are continuous moves
function frame(tfIn) {
  const tf = clamp(tfIn, 0, DUR - 1e-4);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.setClearColor(0x06111e, 1); renderer.clear();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  cam.clearViewOffset(); SCENES[sceneOf(tf)](tf);
  g.globalAlpha = 1; vignette(g, W, H, 0.5);
  let d = Math.max(1 - smooth(tf / 0.9), smooth((tf - (DUR - 0.75)) / 0.7)); for (const [c, w] of DIPS) d = Math.max(d, smooth(1 - Math.abs(tf - c) / w));
  if (d > 0.003) { g.fillStyle = `rgba(3,8,16,${d})`; g.fillRect(0, 0, W, H); }
}

/* ================================================================== sound plan */
const PLAN = { DUR, OFF, speech: S, storm: [0, cA], thunder: [2.35, 5.4, 7.25].map((x) => x * cA / 9 + 0.3),
  chords: [[0, 'Dlow', 0.9, 380], [cA, 'Dm9', 0.6, 650], [s0(7), 'Bb', 0.6, 650], [s0(8), 'Gm', 0.55, 700], [s0(9) + 0.2, 'F', 0.95, 1300], [a(32.4), 'C', 0.8, 1200],
    [cC, 'Dm', 0.6, 900], [cC + 4.4, 'Bb', 0.6, 900], [cD, 'F', 0.65, 950], [cD + 5, 'C', 0.65, 950], [cE, 'Bb', 0.7, 1000], [cE + 3.6, 'C', 0.7, 1000],
    [cF, 'Dm', 0.7, 1000], [cF + 3.8, 'Bb', 0.75, 1100], [cF + 7.6, 'F', 0.8, 1200], [cF + 11.4, 'C', 0.85, 1300], [cG, 'Bb', 0.95, 1500], [cG + 1.9, 'C', 1.0, 1800],
    [W_WORK, 'Fhi', 1.0, 1900], [cH + 2.2, 'C', 0.75, 1300], [cH + 5.6, 'Dm', 0.75, 1300], [cH + 8.6, 'Bb', 0.8, 1300], [cI, 'Fhi', 1.0, 2000]],
  pulse: [[cC, cE, 0.05], [cF, W_WORK, 0.085]], harbour: [[cA, cB, 0.1], [cC, cD + 1, 0.07], [cH, DUR, 0.09]], motor: [[cC, cC + 3.2], [cH + 0.3, cI - 0.5]],
  whoosh: [cA, cB, cC, W_WIFI + 0.5, cD, cE, cF, cH, cI], booms: [s0(9) + 0.2, W_WORK], riser: [cG + 0.6, W_WORK],
  ticks: [N1, N2, N3, N4, N5, N6, W_CV, W_OBJ, s0(5) + 0.15, s0(5) + 0.75, s0(5) + 1.35, W_BENCH - 0.1, W_TETHER] };

/* ================================================================== player */
const stage = $('stage'), seek = $('seek'), clock = $('clock'), bPlay = $('bPlay'), statusEl = $('status'); seek.max = DUR;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
let mix = null, actx = null, node = null, playing = false, tNow = 0, t0ctx = 0, t0film = 0;
function setTime(t) { tNow = clamp(t, 0, DUR); frame(tNow); seek.value = tNow; clock.textContent = `${fmt(tNow)} / ${fmt(DUR)}`; }
function stopAudio() { if (node) { try { node.stop(); } catch (e) { /* already stopped */ } node = null; } }
function play() { if (!mix) return; if (tNow >= DUR - 0.05) setTime(0); actx ??= new AudioContext({ sampleRate: 48000 }); actx.resume(); stopAudio();
  node = actx.createBufferSource(); node.buffer = mix; node.connect(actx.destination); t0ctx = actx.currentTime + 0.06; t0film = tNow; node.start(t0ctx, tNow); playing = true; bPlay.textContent = 'Pause ❚❚'; }
function pause() { playing = false; stopAudio(); bPlay.textContent = 'Play ▸'; }
bPlay.onclick = () => (playing ? pause() : play()); $('bRestart').onclick = () => { pause(); setTime(0); play(); };
seek.oninput = () => { const was = playing; pause(); setTime(+seek.value); if (was) play(); };
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); bPlay.click(); } if (e.key === 'ArrowRight') seek.oninput(seek.value = tNow + 1); if (e.key === 'ArrowLeft') seek.oninput(seek.value = tNow - 1);
  if (e.key.toLowerCase() === 'c') { document.body.classList.toggle('clean'); fit(); } });
function loop() { requestAnimationFrame(loop); if (!playing) return; tNow = t0film + Math.max(0, actx.currentTime - t0ctx); if (tNow >= DUR) { setTime(DUR); pause(); return; } setTime(tNow); }   // audio clock drives the picture
function fit() { const w = $('wrap'), k = Math.min(w.clientWidth / W, w.clientHeight / H); stage.style.transform = `scale(${k})`; }
addEventListener('resize', fit); new ResizeObserver(fit).observe($('wrap')); fit();

/* ================================================================== MP4 export (H.264 + AAC, frame-accurate, no screen recording) */
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const toU8 = (d) => (d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength)).slice();
async function exportMp4(onProgress = () => {}) {
  pause(); const comp = document.createElement('canvas'); comp.width = W; comp.height = H; const cg = comp.getContext('2d', { alpha: false });
  const vS = [], aS = []; let avcC = null, cs = null, asc = null, err = null;
  const venc = new VideoEncoder({ output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); vS.push({ data: d, key: ch.type === 'key', ts: ch.timestamp });
    if (meta?.decoderConfig?.description) { avcC = toU8(meta.decoderConfig.description); cs = meta.decoderConfig.colorSpace || null; } }, error: (e) => { err = e; } });
  venc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 5_000_000, framerate: FPS, avc: { format: 'avc' }, latencyMode: 'quality' });
  const N = Math.round(DUR * FPS), t0 = performance.now();
  for (let f = 0; f < N && !err; f++) {
    frame(f / FPS); cg.drawImage(glCanvas, 0, 0, W, H); cg.drawImage(ovCanvas, 0, 0);
    const vf = new VideoFrame(comp, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); venc.encode(vf, { keyFrame: f % 60 === 0 }); vf.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => venc.addEventListener('dequeue', r, { once: true }));
    if (f % 15 === 0) { onProgress(f / N, `Rendering frame ${f}/${N}`); await tick(); }
  }
  await venc.flush(); venc.close(); if (err) throw err;
  for (let i = 1; i < vS.length; i++) if (vS[i].ts <= vS[i - 1].ts) throw new Error('encoder reordered frames (B-frames) – not supported by this muxer');
  onProgress(1, 'Encoding audio');
  const aenc = new AudioEncoder({ output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); aS.push({ data: d }); if (meta?.decoderConfig?.description) asc = toU8(meta.decoderConfig.description); }, error: (e) => { err = e; } });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
  const L = mix.getChannelData(0), R = mix.getChannelData(1), B = 48000;
  for (let i = 0; i < L.length; i += B) { const n = Math.min(B, L.length - i), data = new Float32Array(n * 2); data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data }); aenc.encode(ad); ad.close(); }
  await aenc.flush(); aenc.close(); if (err) throw err;
  const map = { primaries: { bt709: 1, bt470bg: 5, smpte170m: 6 }, transfer: { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13 }, matrix: { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 } };
  const colr = cs && map.primaries[cs.primaries] && map.transfer[cs.transfer] && map.matrix[cs.matrix] != null ? { primaries: map.primaries[cs.primaries], transfer: map.transfer[cs.transfer], matrix: map.matrix[cs.matrix], fullRange: !!cs.fullRange } : null;
  const blob = muxMp4({ width: W, height: H, fps: FPS, avcC, colr, samples: vS }, { sampleRate: 48000, channels: 2, asc: asc || new Uint8Array([0x11, 0x90]), bitrate: 192000, samples: aS });
  onProgress(1, 'Saving file');
  let saved = false; try { saved = (await fetch('/__save?name=seaguardian-film.mp4', { method: 'POST', body: blob })).ok; } catch (e) { saved = false; }
  if (!saved) { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'seaguardian-film.mp4'; l.click(); }
  return { frames: vS.length, audioFrames: aS.length, bytes: blob.size, seconds: (performance.now() - t0) / 1000, saved, duration: DUR, colorSpace: cs && { ...cs }, keyframes: vS.filter((s) => s.key).length };
}
$('bExport').onclick = async () => { $('bExport').disabled = true; try { const r = await exportMp4((p, s) => { statusEl.textContent = `${s} (${Math.round(p * 100)}%)`; }); window.EXPORT_RESULT = r;
  statusEl.textContent = r.saved ? `Saved film/out/seaguardian-film.mp4 (${(r.bytes / 1e6).toFixed(0)} MB)` : 'Downloaded seaguardian-film.mp4'; } catch (e) { window.EXPORT_RESULT = { error: String(e) }; statusEl.textContent = 'Export failed: ' + e; } $('bExport').disabled = false; };

/* ================================================================== start */
if (q.has('clean')) document.body.classList.add('clean');
for (const wt of [3, 15, 31, 41, 50, 58, 70, 79, 88, 97]) frame(wt);            // compile every shader up front
setTime(q.has('t') ? +q.get('t') : 8.5); requestAnimationFrame(loop);
window.FILM = { frame, setTime, DUR, CUTS, PLAN, S, play, pause, exportMp4, ready: false, info: null };
buildMix('audio/narration.mp3', PLAN, q.has('bed') ? +q.get('bed') : -13.5).then((r) => { mix = r.mix; window.FILM.info = r.info; window.FILM.ready = true; window.FILM.mix = mix;
  statusEl.textContent = `Ready · ${fmt(DUR)} · narration ${r.info.narrationSeconds.toFixed(1)} s`; bPlay.disabled = false; $('bRestart').disabled = false; $('bExport').disabled = false;
  if (EXPORT) $('bExport').click(); }).catch((e) => { statusEl.textContent = 'Sound failed: ' + e; window.FILM.error = String(e); });
