// Shared timeline logic (copied from film.js): easing, camera tracks, mission path, environment presets, narration warp.
import * as THREE from 'three';
export const DUR = 60, D2R = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export function track(keys, t) {
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
export const KEY_S1 = [[0, -34, 4.6, 27, 8, 3.2, -12, 46], [3, -20, 4.0, 21, 11, 3, -14, 44], [5.4, -1, 3.2, 8, 9, 2.2, -24, 38], [7.8, 5.2, 2.8, -15.0, 8, 1.5, -30, 32], [9.6, 6.4, 2.5, -21.0, 8, 1.4, -30, 29]];
export const KEY_S2 = [[9, 36, 6.2, 20, 18, 2.2, -8, 46], [12, 25, 4.2, 8, 18, 1.8, -8, 44], [14.6, 15.6, 2.4, -5, 18, 1.4, 4, 44], [17.4, 13.5, 0.95, 9, 13, 0.35, 30, 52]];
/* studio camera keys: [t, azimuth°, elevation°, distance, tx,ty,tz] (azimuth 0 = from stern, 90 = from grey side) */
export const KEY_S3 = [[17, 205, 7, 64, 0, 7, 0], [21, 255, 13, 58, 0, 7, 0], [24, 325, 20, 52, 0, 7, 1], [26.6, 372, 17, 35, 0, 8, 6], [28.6, 392, 23, 22, 2, 9, 13], [30.4, 402, 25, 19, 2, 9, 13]];
export const KEY_S6 = [[53, 318, 15, 92, 0, 7, 0], [56.5, 392, 19, 84, 0, 7, 0], [60.4, 462, 13, 88, 0, 7, 0]];

/* ---------------------------------------------------------------- mission path (illustrative) */
export const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-17, 0, 34), new THREE.Vector3(-9, 0, 22), new THREE.Vector3(-2, 0, 12), new THREE.Vector3(4.5, 0, 5), new THREE.Vector3(9.5, 0, -1.5)
], false, 'catmullrom', 0.5);
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
export const ramp = (t, t0, R, v) => { const x = t - t0; if (x <= 0) return 0; const s = x / R; return s < 1 ? v * R * (s * s * s - s * s * s * s / 2) : v * (R * 0.5 + x - R); };
export function usvState(t) {
  const u = clamp((t - 30) / 23) * 0.93, p = path.getPointAt(u), T = path.getTangentAt(u);
  const hd = (uu) => { const q = path.getTangentAt(clamp(uu, 0, 1)); return Math.atan2(-q.x, -q.z); };
  const heading = hd(u), dh = angDiff(hd(u + 0.012), hd(u - 0.012));
  const rudder = clamp(-dh * 16, -0.5, 0.5) + 0.13 * Math.sin(t * 1.5);
  return { x: p.x, z: p.z, heading, rudder, T: new THREE.Vector3(T.x, 0, T.z).normalize(), propAngle: ramp(t, 29, 2, 22) };
}
export const TMP = new THREE.Vector3();
export function povPose(t, st, cameraObj, offs) {
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
export function s4Offsets(t) {
  const [ox, oy, of, look, fov] = track([[30, 4.6, 3.3, -8.5, 0, 40], [33.4, 3.2, 2.0, -5.2, 0, 42], [35.1, 0.9, 1.7, 0.4, 0.4, 50], [36.3, 0, 0.9, 1.5, 1, 60], [53, 0, 0.9, 1.5, 1, 60]], t);
  return [ox, oy, of, clamp(look), fov];
}
export const POV_OFFS = [0, 0.9, 1.5, 1, 60];

/* ---------------------------------------------------------------- environment parameter sets */
export const storm = (t) => {
  const f = [2.35, 5.4, 7.25].reduce((a, e) => a + (t >= e ? Math.exp(-(t - e) * 7) * (0.75 + 0.25 * Math.sin(t * 90)) : 0), 0)
          + [2.55, 5.65].reduce((a, e) => a + (t >= e ? Math.exp(-(t - e) * 11) * 0.6 : 0), 0);
  const lvl = 1.26 * smooth((t - 0.4) / 8.3);
  return { t, level: lvl + Math.sin(t * 1.7) * 0.03, amp: lerp(0.62, 0.95, smooth(t / 9)), foam: 1, rain: 1, wind: 0.42, flash: clamp(f, 0, 1.4),
    skyTop: 0x090e15, skyBot: 0x3a4650, cloudCol: 0x11161c, cloud: 1.15, fog: 0x2c3842, fogDensity: 0.014,
    sun: 0.55, sunColor: 0xaebdcc, sunPos: [-40, 60, 50], hemi: 0.28, env: 0.22, seaCol: 0x123846,
    damage: 0, debris: 0, lamps: 0.0, windows: 0.0, lantern: 0.0, usv: null };
};
export const after = (t) => ({ t, level: lerp(0.5, 0.2, smooth((t - 9) / 8)), amp: 0.11, foam: 0.1, rain: 0, wind: 0.1, flash: 0,
  skyTop: 0x56626d, skyBot: 0xb5c0c8, cloudCol: 0x8a949c, cloud: 0.85, fog: 0xa3afb8, fogDensity: 0.017,
  sun: 1.0, sunColor: 0xe3e9ef, sunPos: [-30, 50, 40], hemi: 0.7, env: 0.55, seaCol: 0x35586a,
  damage: 1, debris: smooth((t - 9) / 0.5), lamps: 0, windows: 0, lantern: 0, usv: null });
export const dusk = (t) => ({ t, level: 0, amp: 0.05, foam: 0, rain: 0, wind: 0, flash: 0,
  skyTop: 0x0b1e3a, skyBot: 0x6f9bbd, cloudCol: 0x2c4764, cloud: 0.45, fog: 0x4f7592, fogDensity: 0.0075,
  sun: 1.3, sunColor: 0xc3d8ff, sunPos: [-60, 22, 30], hemi: 0.55, env: 0.45, seaCol: 0x0f3b57,
  damage: 0.6, debris: 0.55, lamps: 0.95, windows: 1.4, lantern: 1.4, usv: usvState(t) });
export function harbourLevel(t) { return t < 17 ? (t < 9 ? storm(t).level : after(t).level) : 0; }
export const VO_OFFSET = 0.8;
export const WARP = [[0, 0], [12.8, 9], [19.35, 17], [26.8, 30], [34.3, 42], [43.5, 53], [60, 60]];
export function warp(tf) {
  tf = clamp(tf, 0, DUR);
  for (let i = 0; i < WARP.length - 1; i++) {
    const [a, ta] = WARP[i], [b, tb] = WARP[i + 1];
    if (tf <= b) return ta + (tf - a) / (b - a) * (tb - ta);
  }
  return DUR;
}
