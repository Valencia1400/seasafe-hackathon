// SeaGuardian film – procedural worlds (Swedish harbour for storm / aftermath / mission, dark studio for the product reveal).
// Everything is a pure function of time so frames can be scrubbed or rendered deterministically.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createBoat } from './boat.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export const waveH = (x, z, t, a) =>
  a * (0.5 * Math.sin(0.22 * x + 0.35 * z - 1.1 * t) + 0.3 * Math.sin(-0.31 * x + 0.19 * z - 1.5 * t + 1.3) +
       0.18 * Math.sin(0.7 * x + 0.55 * z - 2.3 * t + 2.1) + 0.1 * Math.sin(1.3 * x - 0.9 * z - 3.1 * t) +
       0.09 * Math.sin(2.3 * x + 1.7 * z - 4.4 * t + 0.6) + 0.06 * Math.sin(-3.1 * x + 2.6 * z - 5.3 * t + 1.9));

const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};

/* =============================================================== HARBOUR */
export function createHarbour(renderer) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.FogExp2(0x8a9aa8, 0.012);

  /* ---- sky dome with moving fbm clouds */
  const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, cloudCol: { value: new THREE.Color() },
    time: { value: 0 }, cloud: { value: 1 }, flash: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top,bot,cloudCol; uniform float time,cloud,flash;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vP); float hh = clamp(d.y,0.,1.);
        vec3 col = mix(bot, top, pow(hh,.5));
        vec2 uv = d.xz/(d.y+.35)*.9 + vec2(time*.03, time*.012);
        float c = smoothstep(.32,.8,fbm(uv*1.6)) * cloud * smoothstep(0.03,.7,d.y);
        col = mix(col, cloudCol, c*.92);
        col += flash*vec3(.55,.62,.85)*(.35+c);
        gl_FragColor = vec4(col,1.);
      }`
  }));
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.position.set(-40, 60, 50); scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x20303c, 0.6); scene.add(hemi);

  /* ---- sea */
  const SEA = 520, SEG = 72;
  const seaGeo = new THREE.PlaneGeometry(SEA, SEA, SEG, SEG); seaGeo.rotateX(-Math.PI / 2);
  const seaPos = seaGeo.attributes.position;
  seaGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seaPos.count * 3), 3));
  const seaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.22, metalness: 0.2, envMapIntensity: 1.0 });
  // tileable ripple normal map (sum of integer-frequency sines) so the surface glints instead of looking like plastic
  const rippleTex = (() => { const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
    const Wv = []; for (let i = 0; i < 46; i++) { const a = Math.round((hash(i * 3.3 + 1) - 0.5) * 2 * (4 + i * 0.75)), b = Math.round((hash(i * 7.7 + 2) - 0.5) * 2 * (4 + i * 0.75)), kk = Math.hypot(a, b) || 1; Wv.push([a, b, 1.1 / Math.pow(kk, 1.15), hash(i * 5.1) * 6.283]); }
    const Hh = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (const [a, b, m, ph] of Wv) s += m * Math.sin((a * x + b * y) / N * 6.2831853 + ph); Hh[y * N + x] = s; }
    const at = (x, y) => Hh[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * 7, dy = (at(x, y + 1) - at(x, y - 1)) * 7, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(11, 11); t.anisotropy = 16; return t; })();
  seaMat.normalMap = rippleTex; seaMat.normalScale.set(0.3, 0.3);
  const sea = new THREE.Mesh(seaGeo, seaMat); scene.add(sea);

  /* ---- skerries with pines out in the bay (depth for the wide shots) */
  { const rock = new THREE.MeshStandardMaterial({ color: 0x4c545c, roughness: 0.95, flatShading: true }), pine = new THREE.MeshStandardMaterial({ color: 0x1c3327, roughness: 0.95, flatShading: true });
    [[-150, 150, 46], [70, 205, 60], [175, 120, 30], [-40, 260, 80], [-230, 60, 38]].forEach(([x, z, r], k) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), rock); m.scale.y = 0.16; m.position.set(x, -0.5, z); scene.add(m);
      for (let i = 0; i < 14; i++) { const a = hash(k * 31 + i) * 6.28, d = hash(k * 17 + i * 3) * r * 0.62, h = 5 + hash(i * 7 + k) * 6;
        const t = new THREE.Mesh(new THREE.ConeGeometry(1.5 + h * 0.12, h, 6), pine); t.position.set(x + Math.cos(a) * d, r * 0.16 * (1 - (d / r) * (d / r)) * 0.9 + h / 2 - 0.6, z + Math.sin(a) * d); scene.add(t); } }); }
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,244,214,1)'); r.addColorStop(0.12, 'rgba(255,214,150,.75)'); r.addColorStop(0.4, 'rgba(255,170,90,.22)'); r.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }),
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
  sunGlow.scale.set(420, 420, 1); scene.add(sunGlow); const sunDir = new THREE.Vector3();
  const seaBase = new THREE.Color(), seaFoam = new THREE.Color(0xdbe7ee);

  /* ---- quay + warehouses + lamps */
  const concrete = new THREE.MeshStandardMaterial({ color: 0x6b7378, roughness: 0.92 });
  const slab = new THREE.MeshStandardMaterial({ color: 0x8a9196, roughness: 0.9 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(260, 3.4, 22), concrete); quay.position.set(0, 2.4 - 1.7, -41); scene.add(quay);
  const quayTop = new THREE.Mesh(new THREE.BoxGeometry(260, 0.12, 22), slab); quayTop.position.set(0, 2.43, -41); scene.add(quayTop);
  const fender = new THREE.Mesh(new THREE.BoxGeometry(260, 0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.8 }));
  fender.position.set(0, 1.1, -29.85); scene.add(fender);
  for (let i = -120; i <= 120; i += 12) { // bollards
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.5, metalness: 0.6 }));
    b.position.set(i + 3, 2.75, -30.9); scene.add(b);
  }
  const winMat = new THREE.MeshStandardMaterial({ color: 0x111a22, emissive: 0xffc46b, emissiveIntensity: 0, roughness: 0.4 });
  const falu = new THREE.MeshStandardMaterial({ color: 0x8e2f24, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.7 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.75 });
  function building(x, w, h, l, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), falu); body.position.y = h / 2; g.add(body);
    const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.3, 0); s.lineTo(w / 2 + 0.3, 0); s.lineTo(0, w * 0.28); s.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: l + 0.6, bevelEnabled: false }), roofM);
    roof.position.set(0, h, -(l + 0.6) / 2); g.add(roof);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), trim); c.position.set(sx * w / 2, h / 2, sz * l / 2); g.add(c); });
    const nw = Math.max(2, Math.floor(w / 4.2));
    for (let i = 0; i < nw; i++) {
      const wx = -w / 2 + (i + 0.5) * (w / nw);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.12), trim); frame.position.set(wx, h * 0.55, l / 2 + 0.02); g.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), winMat); pane.position.set(wx, h * 0.55, l / 2 + 0.1); g.add(pane);
    }
    g.position.set(x, 2.43, z); scene.add(g);
  }
  [[-92, 16, 8, 14], [-68, 12, 7, 12], [-44, 20, 9, 16], [-16, 12, 7, 12], [12, 18, 8.5, 14], [40, 14, 7, 13], [66, 20, 9.5, 15], [96, 12, 7, 12]]
    .forEach(([x, w, h, l], i) => building(x, w, h, l, -37 - hash(i + 3) * 5));

  const glowTex = canvasTex(64, 64, (g, w, h) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,225,160,1)'); r.addColorStop(0.25, 'rgba(255,200,110,.55)'); r.addColorStop(1, 'rgba(255,180,80,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const lamps = [];
  for (let i = -108; i <= 108; i += 18) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 8), new THREE.MeshStandardMaterial({ color: 0x1c2328, roughness: 0.5, metalness: 0.5 }));
    pole.position.set(i, 2.43 + 2.6, -31.8); scene.add(pole);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.set(3.2, 3.2, 1); glow.position.set(i, 2.43 + 5.3, -31.8); scene.add(glow); lamps.push(glow);
  }

  /* ---- level gauge on the quay wall (cm above mean sea level) */
  const GX = 8;
  const gaugeTex = canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#10161c'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'middle';
    const yOf = cm => h - 40 - (cm + 20) / 240 * (h - 80);   // -20 cm .. +220 cm
    for (let cm = -20; cm <= 220; cm += 5) {
      const y = yOf(cm), big = cm % 25 === 0;
      g.fillRect(0, y - 2, big ? 90 : 46, 4);
      if (big && cm >= 0) g.fillText((cm > 0 ? '+' : '') + cm, 100, y);
    }
    g.fillStyle = '#d8232f'; g.fillRect(0, yOf(126) - 5, w, 10);
    g.font = 'bold 40px sans-serif'; g.fillStyle = '#d8232f'; g.fillText('+126', 120, yOf(126) - 26);
  });
  const gaugeH = 2.4;                                   // covers -20..+220 cm → world y = -0.2 .. 2.2
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.9, gaugeH), new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.6 }));
  gauge.position.set(GX, -0.2 + gaugeH / 2, -29.7); scene.add(gauge);

  /* ---- main pier (damaged progressively) */
  const PIERX = 18, PZ0 = -29.5, PZ1 = 8;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.9 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3f3224, roughness: 0.95 });
  const posts = [], planks = [];
  for (let z = PZ0 + 1; z <= PZ1; z += 3.2) [-1.4, 1.4].forEach((sx, k) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 6, 10), woodDark);
    p.position.set(PIERX + sx, 0, z); scene.add(p); posts.push({ m: p, seed: z * 7 + k });
  });
  const beams = [];
  for (let z = PZ0 + 1; z <= PZ1; z += 3.2) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.3), woodDark); b.position.set(PIERX, 1.78, z); scene.add(b); beams.push(b);
  }
  const NPL = Math.floor((PZ1 - PZ0) / 0.42);
  for (let i = 0; i < NPL; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 0.36), wood);
    m.position.set(PIERX, 1.95, PZ0 + i * 0.42 + 0.2); scene.add(m);
    planks.push({ m, r: hash(i * 3.1 + 1), y: m.position.y });
  }
  // railing posts + lighthouse at the pier head
  const lh = new THREE.Group();
  const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 5.2, 16), new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.7 })); lhBody.position.y = 2.6; lh.add(lhBody);
  const lhBand = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.84, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0xb02a25, roughness: 0.7 })); lhBand.position.y = 3.2; lh.add(lhBand);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xffe3a0, emissiveIntensity: 0.0 })); lantern.position.y = 5.6; lh.add(lantern);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x1d2227, roughness: 0.6 })); cap.position.y = 6.35; lh.add(cap);
  lh.position.set(PIERX, 1.9, PZ1 + 1.2); scene.add(lh);

  /* ---- moored boats */
  function makeBoat(len, wid, hullCol, cabinCol) {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0, len / 2); s.lineTo(wid * 0.38, len * 0.22); s.lineTo(wid / 2, -len * 0.05); s.lineTo(wid * 0.46, -len / 2);
    s.lineTo(-wid * 0.46, -len / 2); s.lineTo(-wid / 2, -len * 0.05); s.lineTo(-wid * 0.38, len * 0.22); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }); hg.rotateX(-Math.PI / 2);
    const hull = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: hullCol, roughness: 0.55, flatShading: true })); hull.position.y = -0.7; g.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid * 1.02, 0.14, len * 0.78), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 })); stripe.position.set(0, 0.6, len * 0.05); g.add(stripe);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.62, 1.5, len * 0.28), new THREE.MeshStandardMaterial({ color: cabinCol, roughness: 0.6 })); cab.position.set(0, 1.45, len * 0.14); g.add(cab);
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0b1620, roughness: 0.2, metalness: 0.5 });
    const gl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.64, 0.5, len * 0.2), glassM); gl.position.set(0, 1.6, len * 0.12 - 0.12); g.add(gl);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4, 8), new THREE.MeshStandardMaterial({ color: 0xcfd3d6 })); mast.position.set(0, 3.4, len * 0.1); g.add(mast);
    return g;
  }
  const moored = [];
  const mb = (len, wid, hc, cc, x, z, rotY, id) => { const b = makeBoat(len, wid, hc, cc); b.position.set(x, 0, z); b.rotation.y = rotY; scene.add(b); moored.push({ g: b, x, z, rotY, id, ph: hash(id * 9) * 6 }); return b; };
  const targetBoat = mb(9.5, 3.2, 0x1f4d78, 0xe8ecef, 14.4, -12.5, 0.0, 1);
  mb(7.5, 2.7, 0xa63a2c, 0xdfe3e6, 14.6, -21.5, 0.05, 2);
  mb(10.5, 3.4, 0x2c5f4a, 0xe8ecef, -9, -27.4, Math.PI / 2, 3);
  mb(8, 2.8, 0xd8d5c8, 0x42525e, -26, -27.2, Math.PI / 2, 4);
  mb(6.6, 2.4, 0x2f3b46, 0xe8ecef, 22, -27.3, Math.PI / 2, 5);

  /* ---- person standing on the pier (supported detection class for the concept overlay) */
  const person = new THREE.Group();
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7 })); vest.position.y = 1.15; person.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), new THREE.MeshStandardMaterial({ color: 0xd9b48f, roughness: 0.8 })); head.position.y = 1.78; person.add(head);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x1d2530, roughness: 0.8 })); legs.position.y = 0.4; person.add(legs);
  person.position.set(PIERX - 0.4, 2.0, -9.5); scene.add(person);

  /* ---- floating debris (visible after the storm) */
  const debris = [];
  const dp = (geo, mat, x, z, seed, big = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.userData = { x, z, seed }; scene.add(m); debris.push(m); return m; };
  const plankGeo = new THREE.BoxGeometry(2.6, 0.1, 0.34);
  for (let i = 0; i < 12; i++) { const m = dp(plankGeo, wood, 6 + hash(i) * 22, -6 + hash(i + 9) * 24, i); m.rotation.y = hash(i + 4) * 3; }
  const barrel = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 14); const blue = new THREE.MeshStandardMaterial({ color: 0x2552a0, roughness: 0.6 });
  for (let i = 0; i < 5; i++) { const m = dp(barrel, blue, 8 + hash(i + 20) * 20, -2 + hash(i + 30) * 20, 40 + i); m.rotation.z = 1.2; }
  const ring = dp(new THREE.TorusGeometry(0.34, 0.1, 10, 24), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }), 12, -3, 60); ring.rotation.x = Math.PI / 2;
  const crate = dp(new THREE.BoxGeometry(0.9, 0.5, 0.7), wood, 21, 4, 70);

  /* ---- rain streaks */
  const NR = 7000, rp = new Float32Array(NR * 2 * 3), re = new Float32Array(NR * 2), rr = new Float32Array(NR * 2 * 3);
  for (let i = 0; i < NR; i++) { const a = hash(i * 1.3), b = hash(i * 2.7 + 5), c = hash(i * 3.9 + 9);
    for (let k = 0; k < 2; k++) { rr.set([a, b, c], (i * 2 + k) * 3); re[i * 2 + k] = k; } }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rainGeo.setAttribute('aRand', new THREE.BufferAttribute(rr, 3)); rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainU = { uTime: { value: 0 }, uSpeed: { value: 32 }, uCenter: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.35, 0.1) }, uOpacity: { value: 0 } };
  const rain = new THREE.LineSegments(rainGeo, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aEnd; attribute vec3 aRand; uniform float uTime,uSpeed; uniform vec3 uCenter; uniform vec2 uWind; varying float vA;
      void main(){ float H=50.; vec3 p = aRand*vec3(120.,H,120.);
        float y = mod(p.y - uTime*uSpeed, H);
        vec2 xz = p.xz + uWind*uSpeed*uTime;
        xz = mod(xz - uCenter.xz + 60., 120.) - 60.;
        vec3 w = vec3(xz.x + uCenter.x, y + uCenter.y - 14., xz.y + uCenter.z);
        w += aEnd * vec3(-uWind.x, 1., -uWind.y) * 1.3; vA = aEnd;
        gl_Position = projectionMatrix*viewMatrix*vec4(w,1.); }`,
    fragmentShader: 'varying float vA; uniform float uOpacity; void main(){ gl_FragColor = vec4(.78,.86,1., uOpacity*(1.-vA*.75)); }'
  }));
  rain.frustumCulled = false; scene.add(rain);

  /* ---- SeaGuardian in the harbour (mission scale: model 25 cm → ~2 m) */
  const usvRig = createBoat(THREE);
  const usv = new THREE.Group(); const USV_S = 0.082;
  usvRig.boat.scale.setScalar(USV_S); usvRig.boat.position.y = -0.1; usv.add(usvRig.boat);
  const wakeTex = canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (const s of [-1, 1]) { const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(255,255,255,.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2 + s * w * 0.46, h); g.stroke(); }
    const c = g.createLinearGradient(0, 0, 0, h); c.addColorStop(0, 'rgba(255,255,255,.35)'); c.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = c; g.fillRect(w / 2 - 10, 0, 20, h);
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 10), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.04, 5.6); usv.add(wake);
  usv.visible = false; scene.add(usv);

  /* ---------------------------------------------------------------- per-frame update */
  const seaV = new THREE.Color();
  function update(p, camPos) {
    const t = p.t;
    skyU.top.value.set(p.skyTop); skyU.bot.value.set(p.skyBot); skyU.cloudCol.value.set(p.cloudCol);
    skyU.time.value = t; skyU.cloud.value = p.cloud; skyU.flash.value = p.flash;
    scene.fog.color.set(p.fog); scene.fog.density = p.fogDensity;
    scene.environmentIntensity = p.env + p.flash * 1.2;
    sun.color.set(p.sunColor); sun.intensity = p.sun + p.flash * 5; sun.position.set(...p.sunPos);
    hemi.intensity = p.hemi + p.flash * 2.5;
    seaBase.set(p.seaCol);
    const rip = p.ripple ?? 0.3; seaMat.normalScale.set(rip, rip); rippleTex.offset.set(t * 0.006, t * 0.01);
    seaMat.roughness = p.seaRough ?? 0.3; seaMat.envMapIntensity = p.seaEnv ?? 0.4;
    sunGlow.material.opacity = p.sunGlow ?? 0; sunGlow.visible = (p.sunGlow ?? 0) > 0.01;
    if (sunGlow.visible) { sunDir.set(...p.sunPos).normalize(); sunGlow.position.copy(camPos).addScaledVector(sunDir, 760); }

    // sea surface
    const amp = p.amp, lvl = p.level;
    const col = seaGeo.attributes.color;
    for (let i = 0; i < seaPos.count; i++) {
      const x = seaPos.getX(i), z = seaPos.getZ(i);
      const near = z > -29 ? 1 : 0;                       // never push water into the quay
      const h = near ? waveH(x, z, t, amp) : lvl;
      seaPos.setY(i, lvl + (near ? h : 0));
      const crest = clamp((h / Math.max(amp, 0.001) - 0.62) * 3.2) * p.foam;
      const hh = amp > 0.001 ? clamp(h / (amp * 1.6) * 0.5 + 0.5) : 0.5;
      seaV.copy(seaBase).multiplyScalar(0.7 + 0.5 * hh).lerp(seaFoam, crest * 0.85);
      col.setXYZ(i, seaV.r, seaV.g, seaV.b);
    }
    seaPos.needsUpdate = true; col.needsUpdate = true; seaGeo.computeVertexNormals();

    // pier damage: planks vanish, posts lean, beams sag
    posts.forEach((q) => { const d = p.damage * (hash(q.seed) - 0.35); q.m.rotation.z = d * 0.32; q.m.rotation.x = d * 0.18; q.m.position.y = d > 0.2 ? -0.2 : 0; });
    planks.forEach((q, i) => {
      const gone = q.r > 1 - p.damage * 0.34 || (i > NPL * 0.72 && i < NPL * 0.8 && p.damage > 0.3);
      q.m.visible = !gone; q.m.rotation.z = p.damage * (q.r - 0.5) * 0.25; q.m.position.y = q.y - p.damage * (hash(i * 2) * 0.05);
    });
    beams.forEach((b, i) => { b.rotation.z = p.damage * (hash(i * 5) - 0.5) * 0.18; });

    // moored boats ride the swell
    moored.forEach(({ g, x, z, rotY, ph }) => {
      const hh = waveH(x, z, t, amp) * 0.9, dx = waveH(x + 1, z, t, amp) - waveH(x - 1, z, t, amp), dz = waveH(x, z + 1, t, amp) - waveH(x, z - 1, t, amp);
      g.position.y = lvl + hh; g.rotation.set(dz * 0.4, rotY, -dx * 0.4 + Math.sin(t * 1.2 + ph) * 0.02 * (amp * 3 + 0.2), 'YXZ');
    });

    // debris
    const dvis = p.debris;
    debris.forEach((m) => { const { x, z, seed } = m.userData;
      const dx = Math.sin(t * 0.07 + seed) * 0.8, dz = Math.cos(t * 0.05 + seed * 2) * 0.8;
      m.position.set(x + dx, lvl + waveH(x + dx, z + dz, t, amp) + 0.02, z + dz); m.scale.setScalar(Math.max(0.0001, dvis)); });
    ring.rotation.z = t * 0.2;

    // lamps / windows / lighthouse
    lamps.forEach((s) => { s.material.opacity = p.lamps; s.visible = p.lamps > 0.01; });
    winMat.emissiveIntensity = p.windows; lantern.material.emissiveIntensity = p.lantern;

    // rain
    rain.visible = p.rain > 0.01; rainU.uTime.value = t; rainU.uOpacity.value = p.rain * 0.55;
    rainU.uCenter.value.copy(camPos); rainU.uWind.value.set(p.wind, 0.1);

    // SeaGuardian
    usv.visible = !!p.usv;
    if (p.usv) {
      const u = p.usv; usv.position.set(u.x, lvl + waveH(u.x, u.z, t, amp) * 0.8, u.z); usv.rotation.set(0, u.heading, 0);
      usv.rotation.z = Math.sin(t * 0.9) * 0.012;
      usvRig.props.forEach((q) => { q.rotation.z = q.userData.dir * u.propAngle; });
      usvRig.rudder.rotation.y = u.rudder;
      wake.visible = true; wake.material.opacity = u.wake ?? 0.8;
    }
  }
  return { scene, update, targets: { boat: targetBoat, person }, getUSV: () => usv, skyU, usvRig };
}

/* =============================================================== STUDIO */
export function createStudio(renderer) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = canvasTex(8, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#04080f'); gr.addColorStop(0.55, '#07162b'); gr.addColorStop(1, '#0a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0x061225, 120, 420);

  // glossy navy floor + cyan turntable ring + grid
  const floorTex = canvasTex(2048, 2048, (g, S) => {
    g.translate(S / 2, S / 2); const k = S / 240;
    g.strokeStyle = 'rgba(56,189,240,.16)'; g.lineWidth = 1.5;
    for (let i = -120; i <= 120; i += 8) { g.beginPath(); g.moveTo(i * k, -S / 2); g.lineTo(i * k, S / 2); g.moveTo(-S / 2, i * k); g.lineTo(S / 2, i * k); g.stroke(); }
    g.strokeStyle = 'rgba(56,189,240,.75)'; g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, 38 * k, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 41 * k, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 360; a += 5) { const t = a * Math.PI / 180, r0 = 41 * k, r1 = (a % 45 === 0 ? 47 : a % 15 === 0 ? 45 : 43.5) * k;
      g.lineWidth = a % 45 === 0 ? 3 : 1.4; g.beginPath(); g.moveTo(Math.cos(t) * r0, Math.sin(t) * r0); g.lineTo(Math.cos(t) * r1, Math.sin(t) * r1); g.stroke(); }
    g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(0, 0, 20 * k, 0, 0, 110 * k);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.55; scene.add(floor);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ opacity: 0.55, color: 0x000000 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.6; catcher.receiveShadow = true; scene.add(catcher);

  const rig = createBoat(THREE); scene.add(rig.boat);
  rig.boat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const key = new THREE.SpotLight(0xdbe8ff, 0, 400, 0.5, 0.6, 0); key.position.set(-50, 90, 60); key.target.position.set(0, 6, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0003; scene.add(key, key.target);
  const rimA = new THREE.DirectionalLight(0x38bdf0, 0); rimA.position.set(70, 30, -70); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0xdfeaff, 0); rimB.position.set(-70, 28, -60); scene.add(rimB);
  const top = new THREE.PointLight(0x9fd0ff, 0, 220, 1.4); top.position.set(0, 70, 0); scene.add(top);
  const fill = new THREE.HemisphereLight(0xcfd6df, 0x0a121c, 0);scene.add(fill);

  function update(p) {
    const r = p.reveal, r2 = clamp((r - 0.35) / 0.65);
    rimA.intensity = 5.2 * clamp(r * 3); rimB.intensity = 4.0 * clamp(r * 3);
    key.intensity = 2.6 * r2 * r2; top.intensity = 420 * r2; fill.intensity = 0.28 * r2;
    scene.environmentIntensity = 0.03 + 0.3 * r2;
    floor.material.opacity = clamp(r * 1.5);
    rig.boat.rotation.y = 0;
    rig.props.forEach((q) => { q.rotation.z = q.userData.dir * p.propAngle; });
    rig.rudder.rotation.y = p.rudder;
  }
  return { scene, update, rig };
}
