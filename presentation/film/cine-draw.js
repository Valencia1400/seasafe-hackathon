// 2D drawing helpers for the cinematic film. Everything on screen that is not 3D is drawn here on a canvas,
// so the film can be rendered frame by frame into a video file (no DOM elements, no browser UI).
export const DISPLAY = '"Bahnschrift", "DIN Alternate", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const TEXT = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
export const C = { cyan: '#38bdf0', amber: '#f2b134', green: '#2fd48c', red: '#ff4d5a', yellow: '#f0bf00', ink: '#e7f0f8', dim: '#8ea7bc', mute: '#6f879c', line: '#1c3652', line2: '#2b4d72', panel: '#0d1d2f' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
/** 0→1→0 visibility for an element shown from t0 to t1 */
export const vis = (t, t0, t1, fi = 0.6, fo = 0.45) => easeOut((t - t0) / fi) * (1 - smooth((t - (t1 - fo)) / fo));

export function T(g, s, x, y, o = {}) {
  const { size = 40, weight = 600, font = DISPLAY, color = '#fff', a = 1, ls = 0, align = 'left', base = 'alphabetic', shadow = 0 } = o;
  if (a <= 0.003) return 0;
  g.save(); g.globalAlpha *= clamp(a); g.font = `${weight} ${size}px ${font}`; g.letterSpacing = `${(ls * size).toFixed(2)}px`; g.textAlign = align; g.textBaseline = base;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = shadow; g.shadowOffsetY = 2; }
  g.fillStyle = color; g.fillText(s, align === 'center' ? x + ls * size / 2 : x, y); const w = g.measureText(s).width; g.restore(); return w;
}
/** text that rises into place: k = vis() value */
export function TR(g, s, x, y, k, o = {}) { return T(g, s, x, y + (1 - Math.min(1, k * 1.2)) * (o.dy ?? 22), { ...o, a: k * (o.a ?? 1) }); }

export function rr(g, x, y, w, h, r, fill, stroke, lw = 1.5) { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }

/** small outlined label, e.g. ILLUSTRATIVE RECONSTRUCTION */
export function tag(g, s, x, y, k, o = {}) {
  if (k <= 0.003) return; const { color = '#cfe2f1', size = 17, align = 'left' } = o;
  g.save(); g.globalAlpha *= clamp(k); g.font = `600 ${size}px ${TEXT}`; g.letterSpacing = `${size * 0.22}px`; const w = g.measureText(s).width + size * 1.9, h = size * 2.1, x0 = align === 'right' ? x - w : x;
  rr(g, x0, y - h / 2, w, h, 6, 'rgba(5,14,24,.62)', color === '#cfe2f1' ? 'rgba(143,190,222,.45)' : color, 1.2);
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(s, x0 + size * 0.95, y + 1); g.restore();
}
/** label joined to a point by a thin leader line. p = {x,y} anchor; dx,dy = label offset */
export function callout(g, s, p, dx, dy, k, o = {}) {
  if (k <= 0.003 || !p || p.z > 1) return; const { color = C.cyan, size = 22, sub } = o;
  g.save(); g.globalAlpha *= clamp(k); const e = Math.min(1, k * 1.3), lx = p.x + dx * e, ly = p.y + dy * e;
  g.strokeStyle = color; g.lineWidth = 2; g.shadowColor = color; g.shadowBlur = 10; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(lx, ly); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(p.x, p.y, 6, 0, 7); g.fill(); g.globalAlpha *= 0.3; g.beginPath(); g.arc(p.x, p.y, 13, 0, 7); g.fill(); g.globalAlpha = clamp(k); g.shadowBlur = 0;
  g.font = `600 ${size}px ${DISPLAY}`; g.letterSpacing = `${size * 0.16}px`; const w = g.measureText(s).width + size * 1.5;
  let w2 = 0; if (sub) { g.font = `500 ${size * 0.68}px ${TEXT}`; g.letterSpacing = `${size * 0.04}px`; w2 = g.measureText(sub).width + size * 1.5; }
  const bw = Math.max(w, w2), bh = sub ? size * 3.1 : size * 2.0, left = dx < 0, bx = left ? lx - bw - 6 : lx + 6, by = ly - size;
  rr(g, bx, by, bw, bh, 6, 'rgba(6,16,27,.8)', color, 1.4);
  g.font = `600 ${size}px ${DISPLAY}`; g.letterSpacing = `${size * 0.16}px`; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(s, bx + size * 0.75, by + size);
  if (sub) { g.font = `500 ${size * 0.68}px ${TEXT}`; g.letterSpacing = `${size * 0.04}px`; g.fillStyle = '#a9c4d8'; g.fillText(sub, bx + size * 0.75, by + size * 2.15); }
  g.restore();
}
export function vignette(g, W, H, strength = 0.55) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,3,8,${strength})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
export function bracket(g, x, y, w, h, l, col, lw) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  g.moveTo(x, y + l); g.lineTo(x, y); g.lineTo(x + l, y); g.moveTo(x + w - l, y); g.lineTo(x + w, y); g.lineTo(x + w, y + l);
  g.moveTo(x, y + h - l); g.lineTo(x, y + h); g.lineTo(x + l, y + h); g.moveTo(x + w - l, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - l); g.stroke(); }

/** laptop outline around a 16:9 screen rect */
export function laptop(g, r, k) {
  if (k <= 0.003) return; g.save(); g.globalAlpha *= clamp(k);
  rr(g, r.x - 16, r.y - 16, r.w + 32, r.h + 34, 16, null, '#3b5878', 3); rr(g, r.x - 13, r.y - 13, r.w + 26, r.h + 28, 13, null, 'rgba(8,18,30,.9)', 6);
  g.fillStyle = '#22364d'; g.beginPath(); g.moveTo(r.x - 70, r.y + r.h + 20); g.lineTo(r.x + r.w + 70, r.y + r.h + 20); g.lineTo(r.x + r.w + 96, r.y + r.h + 44); g.lineTo(r.x - 96, r.y + r.h + 44); g.closePath(); g.fill();
  g.fillStyle = '#31506f'; g.fillRect(r.x + r.w / 2 - 70, r.y + r.h + 20, 140, 7); g.restore();
}
/** boat glyph + Wi-Fi arcs + packets travelling to the laptop */
export function wifiLink(g, from, to, t, k) {
  if (k <= 0.003) return; g.save(); g.globalAlpha *= clamp(k);
  // twin-hull glyph (top view)
  g.save(); g.translate(from.x, from.y); g.scale(1.55, 1.55); g.translate(-from.x, -from.y);
  g.fillStyle = '#2a2c31'; rr(g, from.x - 46, from.y - 62, 30, 124, 9, '#3a3d44', '#7f8a96', 2); rr(g, from.x + 16, from.y - 62, 30, 124, 9, '#84878c', '#b8bec6', 2);
  rr(g, from.x - 34, from.y - 28, 68, 62, 6, '#191b20', '#5d6772', 2); g.fillStyle = C.yellow; g.beginPath(); g.arc(from.x - 31, from.y + 70, 8, 0, 7); g.arc(from.x + 31, from.y + 70, 8, 0, 7); g.fill(); g.restore();
  for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; g.strokeStyle = `rgba(56,189,240,${(1 - ph) * 0.9})`; g.lineWidth = 4; g.beginPath(); g.arc(from.x + 84, from.y, 30 + ph * 96, -0.6, 0.6); g.stroke(); }
  const x0 = from.x + 196, x1 = to.x - 40; g.setLineDash([3, 12]); g.strokeStyle = 'rgba(56,189,240,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, from.y); g.lineTo(x1, to.y); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 5; i++) { const ph = (t * 0.55 + i / 5) % 1; g.fillStyle = `rgba(56,189,240,${Math.sin(ph * Math.PI)})`; rr(g, x0 + (x1 - x0) * ph - 9, from.y + (to.y - from.y) * ph - 6, 18, 12, 3, g.fillStyle); }
  T(g, 'WI-FI', (x0 + x1) / 2, from.y - 34, { size: 26, weight: 600, ls: 0.2, align: 'center', color: '#cfe6f5' });
  T(g, 'SEAGUARDIAN', from.x, from.y + 176, { size: 22, weight: 600, ls: 0.2, align: 'center', color: C.dim });
  g.restore();
}
/** camera viewfinder + conceptual detections. dets = [{label, box:{x0,y0,x1,y1}|null, k}] */
export function feedHud(g, r, t, k, dets, title = 'ONBOARD CAMERA') {
  if (k <= 0.003) return; const sc = r.w / 1920; g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.globalAlpha *= clamp(k);
  const m = 34 * sc + 8; bracket(g, r.x + m, r.y + m, r.w - 2 * m, r.h - 2 * m, 46 * sc + 8, 'rgba(231,240,248,.85)', 2 * sc + 1);
  g.fillStyle = C.red; g.beginPath(); g.arc(r.x + m + 26 * sc + 6, r.y + m + 30 * sc + 6, 7 * sc + 2, 0, 7); g.fill();
  T(g, title, r.x + m + 48 * sc + 12, r.y + m + 30 * sc + 6, { size: 20 * sc + 6, weight: 600, ls: 0.14, base: 'middle', color: 'rgba(231,240,248,.95)' });
  const base = clamp(k);
  for (const d of dets) { if (!d.box || d.k < 0.01) continue; const pad = (14 + (1 - d.k) * 40) * (sc + 0.3), x = d.box.x0 - pad, y = d.box.y0 - pad, w = d.box.x1 - d.box.x0 + 2 * pad, h = d.box.y1 - d.box.y0 + 2 * pad;
    if (w < 6 || h < 6 || x > r.x + r.w || y > r.y + r.h || x + w < r.x || y + h < r.y) continue;
    g.globalAlpha = base * d.k; bracket(g, x, y, w, h, Math.min(w, h) * 0.28, C.cyan, 3 * sc + 1.2); g.fillStyle = 'rgba(56,189,240,.10)'; g.fillRect(x, y, w, h);
    const fs = 18 * sc + 8; g.font = `700 ${fs}px ${TEXT}`; g.letterSpacing = '1px'; const tw = g.measureText(d.label).width + fs; g.fillStyle = C.cyan; g.fillRect(x, y - fs * 1.5, tw, fs * 1.5);
    g.fillStyle = '#04121e'; g.textBaseline = 'middle'; g.fillText(d.label, x + fs / 2, y - fs * 0.72); }
  g.globalAlpha = base * 0.3; const sy = r.y + ((t * 0.28) % 1) * r.h, gr = g.createLinearGradient(0, sy - 50, 0, sy); gr.addColorStop(0, 'rgba(56,189,240,0)'); gr.addColorStop(1, 'rgba(56,189,240,.6)'); g.fillStyle = gr; g.fillRect(r.x, sy - 50, r.w, 50);
  g.restore();
}

/* ------------------------------------------------------------------ dashboard (illustrative; all values simulated) */
function panel(g, x, y, w, h, title, k, badge, glow = 0) {
  g.save(); g.globalAlpha *= clamp(k); g.translate(0, (1 - Math.min(1, k * 1.15)) * 34);
  if (glow > 0) { g.shadowColor = C.cyan; g.shadowBlur = 40 * glow; }
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#102439'); gr.addColorStop(1, '#0b1a2b'); rr(g, x, y, w, h, 14, gr, glow > 0 ? `rgba(56,189,240,${0.35 + 0.65 * glow})` : C.line, glow > 0 ? 2.5 : 1.5); g.shadowBlur = 0;
  T(g, title, x + 22, y + 38, { size: 20, weight: 600, font: TEXT, ls: 0.2, color: '#a9c0d4' });
  if (badge) { g.font = `600 14px ${TEXT}`; g.letterSpacing = '2.4px'; const bw = g.measureText(badge).width + 16; rr(g, x + w - bw - 18, y + 18, bw, 26, 4, null, '#6f93b6', 1); g.fillStyle = '#c3d6e6'; g.textBaseline = 'middle'; g.fillText(badge, x + w - bw - 10, y + 32); }
}
const done = (g) => g.restore();
function row(g, x, y, w, k, label, value, frac, opt = {}) {
  T(g, label, x, y, { size: 19, weight: 600, font: TEXT, ls: 0.1, color: '#a9c0d4' }); T(g, value, x + w, y, { size: 27, weight: 600, font: TEXT, align: 'right', color: opt.vcol || C.ink });
  if (frac == null) return; rr(g, x, y + 12, w, 11, 6, '#0a1829', C.line, 1);
  if (opt.centre) { const a = Math.min(0, frac) * w / 2, b = Math.abs(frac) * w / 2; if (b > 0.5) rr(g, x + w / 2 + a, y + 12, b, 11, 5, opt.col || C.cyan); g.fillStyle = '#3a5f86'; g.fillRect(x + w / 2 - 1, y + 12, 2, 11); }
  else if (frac > 0.005) rr(g, x, y + 12, w * clamp(frac), 11, 5, opt.col || C.cyan);
}
/** st = {roll,pitch,hdg,mL,mR,rud,lat,lon,nb,np,mapPts:[[x,y]..],pos:[x,y]}  v = visibility per block */
export function dashboard(g, t, st, v) {
  // header
  if (v.head > 0.003) { g.save(); g.globalAlpha *= clamp(v.head); T(g, 'SEA', 60, 78, { size: 28, weight: 700, ls: 0.3 }); const w = 28 * 3 * 0.95 + 4; T(g, 'GUARDIAN', 60 + w, 78, { size: 28, weight: 700, ls: 0.3, color: C.cyan });
    T(g, '·  OPERATOR CONSOLE', 60 + w + 250, 78, { size: 24, weight: 500, ls: 0.26, color: '#b9d4e8' });
    tag(g, 'SIMULATED TELEMETRY', 1860, 68, 1, { color: C.amber, align: 'right' }); g.restore(); }
  // AI detections
  if (v.det > 0.003) { panel(g, 1124, 120, 736, 180, 'AI DETECTIONS', v.det, 'SIMULATED');
    row(g, 1146, 206, 690, 1, 'BOAT', st.nb > 0.5 ? '1' : '0', st.nb); row(g, 1146, 258, 690, 1, 'PERSON', st.np > 0.5 ? '1' : '0', st.np); done(g); }
  // GPS
  if (v.gps > 0.003) { panel(g, 1124, 316, 736, 389, 'GPS POSITION', v.gps, 'SIMULATED'); const X = 1146, Y = 370, W = 692, H = 280;
    g.save(); g.beginPath(); g.roundRect(X, Y, W, H, 8); g.clip(); g.fillStyle = '#0a1b2e'; g.fillRect(X, Y, W, H); g.strokeStyle = 'rgba(56,189,240,.10)'; g.lineWidth = 1;
    for (let x = X; x <= X + W; x += 36) { g.beginPath(); g.moveTo(x, Y); g.lineTo(x, Y + H); g.stroke(); } for (let y = Y; y <= Y + H; y += 36) { g.beginPath(); g.moveTo(X, y); g.lineTo(X + W, y); g.stroke(); }
    g.fillStyle = '#12304a'; g.fillRect(X, Y, W, 44); g.fillRect(X + 430, Y + 36, 36, 150); g.strokeStyle = C.line2; g.lineWidth = 2; g.strokeRect(X, Y, W, 44); g.strokeRect(X + 430, Y + 36, 36, 150);
    g.strokeStyle = C.cyan; g.lineWidth = 3; g.setLineDash([2, 7]); g.beginPath(); st.mapPts.forEach(([x, y], i) => (i ? g.lineTo(X + x * W, Y + y * H) : g.moveTo(X + x * W, Y + y * H))); g.stroke(); g.setLineDash([]);
    const px = X + st.pos[0] * W, py = Y + st.pos[1] * H, ring = (t * 1.4) % 1; g.strokeStyle = `rgba(242,177,52,${1 - ring})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 8 + ring * 26, 0, 7); g.stroke(); g.fillStyle = C.amber; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill(); g.restore();
    T(g, `${st.lat.toFixed(5)}° N    ${st.lon.toFixed(5)}° E`, 1146, 686, { size: 23, weight: 600, font: TEXT, color: '#cfe6f5' }); done(g); }
  // IMU
  if (v.imu > 0.003) { panel(g, 60, 725, 400, 295, 'IMU · ORIENTATION', v.imu, 'SIMULATED', v.imuGlow || 0);
    row(g, 82, 808, 356, 1, 'ROLL', st.roll.toFixed(1) + '°', st.roll / 15, { centre: 1 }); row(g, 82, 876, 356, 1, 'PITCH', st.pitch.toFixed(1) + '°', st.pitch / 15, { centre: 1 }); row(g, 82, 944, 356, 1, 'HEADING', Math.round(st.hdg) + '°', st.hdg / 360); done(g); }
  // propulsion
  if (v.pro > 0.003) { panel(g, 476, 725, 400, 295, 'PROPULSION', v.pro, 'SIMULATED');
    row(g, 498, 808, 356, 1, 'BLACK-HULL MOTOR', Math.round(st.mL) + '%', st.mL / 100, { col: C.yellow }); row(g, 498, 886, 356, 1, 'GREY-HULL MOTOR', Math.round(st.mR) + '%', st.mR / 100, { col: C.yellow });
    T(g, 'Two DC motors · L298N driver', 498, 984, { size: 18, font: TEXT, weight: 500, color: C.mute }); done(g); }
  // rudder
  if (v.rud > 0.003) { panel(g, 892, 725, 300, 295, 'RUDDER', v.rud, 'SIMULATED'); const cx = 1042, cy = 930, R = 96, a0 = -Math.PI / 2, a1 = a0 + clamp(st.rud, -30, 30) * 1.5 * Math.PI / 180;
    g.lineCap = 'round'; g.strokeStyle = C.line; g.lineWidth = 11; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.stroke(); g.strokeStyle = C.cyan; g.beginPath(); g.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a1) * (R - 22), cy + Math.sin(a1) * (R - 22)); g.stroke(); g.fillStyle = C.yellow; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
    T(g, (st.rud >= 0 ? '+' : '−') + Math.abs(st.rud).toFixed(0) + '°', cx, 992, { size: 34, weight: 300, font: TEXT, align: 'center' }); done(g); }
  // link
  if (v.com > 0.003) { panel(g, 1208, 725, 300, 295, 'WI-FI LINK', v.com, 'SIMULATED');
    g.fillStyle = C.green; g.globalAlpha *= Math.sin(t * 6.28) > 0 ? 1 : 0.35; g.beginPath(); g.arc(1236, 801, 6, 0, 7); g.fill(); g.globalAlpha = clamp(v.com);
    T(g, 'ONLINE', 1254, 808, { size: 20, weight: 700, font: TEXT, color: C.green }); row(g, 1230, 868, 256, 1, 'LATENCY', Math.round(24 + 4 * Math.sin(t * 2.2)) + ' ms'); row(g, 1230, 922, 256, 1, 'SIGNAL', '−' + Math.round(58 + 3 * Math.sin(t * 0.8)) + ' dBm'); row(g, 1230, 976, 256, 1, 'HEARTBEAT', '0.2 s'); done(g); }
  // safety controls
  if (v.saf > 0.003) { panel(g, 1524, 725, 336, 295, 'SAFETY CONTROLS', v.saf);
    [['EMERGENCY STOP', C.red, 'rgba(255,77,90,.14)', '#ffd9dc'], ['CENTRE RUDDER', C.amber, 'rgba(242,177,52,.12)', '#ffe7b8'], ['DISARM', C.cyan, 'rgba(56,189,240,.10)', '#cdeefc']].forEach(([s, col, bg, fg], i) => {
      rr(g, 1546, 786 + i * 74, 292, 58, 10, bg, col, 1.5); T(g, s, 1692, 816 + i * 74, { size: 19, weight: 700, font: TEXT, ls: 0.18, align: 'center', base: 'middle', color: fg }); }); done(g); }
}

/** dark gradient behind text placed over bright footage. side: 'left' | 'right' | 'bottom' | 'top' */
export function scrim(g, W, H, side, k, strength = 0.72) {
  if (k <= 0.003) return; const gr = side === 'left' ? g.createLinearGradient(0, 0, W * 0.62, 0) : side === 'right' ? g.createLinearGradient(W, 0, W * 0.42, 0) : side === 'bottom' ? g.createLinearGradient(0, H, 0, H * 0.55) : g.createLinearGradient(0, 0, 0, H * 0.45);
  gr.addColorStop(0, `rgba(3,10,22,${strength * Math.min(1, k)})`); gr.addColorStop(1, 'rgba(3,10,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
