// SeaGuardian USV – procedural 3D reconstruction (Three.js, no external assets).
// Units: centimetres. x = lateral (+x = grey pontoon), y = up, z = fore/aft (bow = -z, stern = +z).
// Reconstructed from six photos of the physical prototype; hidden details are approximated.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

/* ------------------------------------------------------------------ renderer / scene */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
const HOME = { pos: new THREE.Vector3(34, 24, 46), target: new THREE.Vector3(0, 6.5, 1.5) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 14;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI * 0.56;
controls.autoRotate = true;
controls.autoRotateSpeed = 4.0; // ~15 s per revolution at 60 fps
controls.update();

const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(-30, 60, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 10, far: 150 });
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x9aa7b4, 0.55));

/* ------------------------------------------------------------------ engineering floor (grid + turntable ring) */
function makeFloorTexture() {
  const S = 2048, W = 180; // px, world cm
  const k = S / W;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  const line = (a, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(...a[0]); g.lineTo(...a[1]); g.stroke(); };
  for (let i = -W / 2; i <= W / 2; i += 5) {
    const major = i % 25 === 0;
    const col = major ? 'rgba(30,70,120,0.32)' : 'rgba(30,70,120,0.14)';
    const lw = major ? 2.2 : 1.2;
    line([[i * k, -S / 2], [i * k, S / 2]], col, lw);
    line([[-S / 2, i * k], [S / 2, i * k]], col, lw);
  }
  // turntable ring + ticks
  g.strokeStyle = 'rgba(11,107,203,0.55)'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 36 * k, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 38.5 * k, 0, Math.PI * 2); g.stroke();
  for (let a = 0; a < 360; a += 5) {
    const r0 = 38.5 * k, r1 = (a % 45 === 0 ? 43 : a % 15 === 0 ? 41.5 : 40) * k;
    const t = a * Math.PI / 180;
    g.lineWidth = a % 45 === 0 ? 3 : 1.5;
    g.beginPath(); g.moveTo(Math.cos(t) * r0, Math.sin(t) * r0); g.lineTo(Math.cos(t) * r1, Math.sin(t) * r1); g.stroke();
  }
  g.strokeStyle = 'rgba(11,107,203,0.4)'; g.lineWidth = 2; // centre cross
  g.beginPath(); g.moveTo(-3 * k, 0); g.lineTo(3 * k, 0); g.moveTo(0, -3 * k); g.lineTo(0, 3 * k); g.stroke();
  // radial fade
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(0, 0, 25 * k, 0, 0, 88 * k);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(-S / 2, -S / 2, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshBasicMaterial({ map: makeFloorTexture(), transparent: true, depthWrite: false, toneMapped: false })
);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.6; floor.renderOrder = -2;
scene.add(floor);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.ShadowMaterial({ opacity: 0.2 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.5; shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

/* ------------------------------------------------------------------ materials */
const M = (color, rough = 0.6, metal = 0.0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const mat = {
  black: M(0x2a2c31, 0.7, 0.02),
  grey: M(0x84878c, 0.55, 0.04),
  yellow: M(0xf0bf00, 0.4),
  servoBlue: M(0x1d44c4, 0.3, 0.0),
  white: M(0xf1f1ee, 0.5),
  steel: M(0xc5c9ce, 0.3, 0.9),
  darkSteel: M(0x6c7077, 0.4, 0.8),
  motorCap: M(0x2c4a3b, 0.6),
  cellBlack: M(0x101012, 0.4, 0.2),
  cellOrange: M(0xe38a10, 0.4, 0.1),
  pcb: M(0x806040, 0.8),
};
const flatBlack = mat.black.clone(); // hull facets read better with flat shading
const hullMat = { black: M(0x2a2c31, 0.65, 0.02, { flatShading: true }), grey: M(0x84878c, 0.5, 0.04, { flatShading: true }) };

/* ------------------------------------------------------------------ geometry helpers */
const boat = new THREE.Group();
boat.name = 'SeaGuardian USV';
scene.add(boat);

const add = (mesh, parent = boat) => { parent.add(mesh); return mesh; };
// axis-aligned box from coordinate ranges
function bx(m, x0, x1, y0, y1, z0, z1, parent = boat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return add(mesh, parent);
}
function cyl(m, r, len, axis, pos, parent = boat, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(g, m); mesh.position.set(...pos);
  return add(mesh, parent);
}
// flat plate from a footprint (x, z world) with optional holes, extruded upward
function rectPath(x0, x1, z0, z1, Cls = THREE.Shape) {
  const s = new Cls(); s.moveTo(x0, -z0); s.lineTo(x1, -z0); s.lineTo(x1, -z1); s.lineTo(x0, -z1); s.closePath(); return s;
}
function plate(m, outer, holes, y0, thick, parent = boat) {
  const s = rectPath(...outer);
  holes.forEach(h => s.holes.push(rectPath(...h, THREE.Path)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m); mesh.position.y = y0;
  return add(mesh, parent);
}
function wire(color, pts, r = 0.085, parent = boat) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.3), 48, r, 8, false);
  return add(new THREE.Mesh(g, M(color, 0.5)), parent);
}
function screw(x, y, z, parent = boat) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  cyl(mat.steel, 0.42, 0.18, 'y', [0, 0.09, 0], g, 20);
  cyl(mat.darkSteel, 0.12, 0.2, 'y', [0, 0.12, 0], g, 8);
  return add(g, parent);
}

/* ------------------------------------------------------------------ pontoon hull (lofted angular prism) */
function hullRing(w, yb, yt) {
  const hw = w / 2, bw = hw * 0.72, tw = hw * 0.9, cb = Math.min(1.5, (yt - yb) * 0.3), ct = Math.min(0.5, (yt - yb) * 0.1);
  return [[-bw, yb], [bw, yb], [hw, yb + cb], [hw, yt - ct], [tw, yt], [-tw, yt], [-hw, yt - ct], [-hw, yb + cb]];
}
function loftHull(sections, m) {
  const rings = sections.map(s => hullRing(s.w, s.yb, s.yt).map(([x, y]) => new THREE.Vector3(x, y, s.z)));
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], n = A.length;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      tri(A[j], A[k], B[j]); tri(A[k], B[k], B[j]);
    }
  }
  const cap = (R, flip) => { // fan
    const c = R.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / R.length);
    for (let j = 0; j < R.length; j++) { const k = (j + 1) % R.length; flip ? tri(c, R[k], R[j]) : tri(c, R[j], R[k]); }
  };
  cap(rings[0], true); cap(rings[rings.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

const PX = 7.3;       // pontoon centre offset
const PL = 12.5;      // half length (bow -z, stern +z)
const PH = 7.5;       // pontoon height = deck level
const PW = 6.0;
const hullSections = [
  { z: -PL,       w: 0.6, yb: 3.6, yt: PH - 0.2 },
  { z: -PL + 4.2, w: 3.0, yb: 1.6, yt: PH },
  { z: -PL + 9.5, w: PW,  yb: 0.0, yt: PH },
  { z: PL,        w: PW,  yb: 0.0, yt: PH },
];
const pontoonL = loftHull(hullSections, hullMat.black); pontoonL.position.x = -PX; pontoonL.name = 'Pontoon (black)'; add(pontoonL);
const pontoonR = loftHull(hullSections, hullMat.grey);  pontoonR.position.x = PX;  pontoonR.name = 'Pontoon (grey)';  add(pontoonR);

/* ------------------------------------------------------------------ central platform / deck */
const DECK_Y = PH, DECK_T = 0.6, TOP = DECK_Y + DECK_T;
const deck = plate(mat.black, [-PX - 3.2, PX + 3.2, -7.2, 5.5],
  [[-PX - 1.9, -PX + 1.9, -5.4, 3.7], [PX - 1.9, PX + 1.9, -5.4, 3.7], [-2.6, 2.6, -4.2, 2.4]], DECK_Y, DECK_T);
deck.name = 'Central platform';
// rear servo plate
const rearPlate = plate(mat.black, [-2.6, 2.6, 3.5, 12.4], [], DECK_Y, DECK_T);
// reinforcing cross-bar under the plate tying the two hulls
bx(mat.black, -PX, PX, DECK_Y - 1.2, DECK_Y, 3.7, 5.5);
// platform screws over the pontoons
[[-PX, -6.4], [-PX, 4.6], [PX, -6.4], [PX, 4.6]].forEach(([x, z]) => screw(x + (x < 0 ? 1.8 : -1.8) * 0, TOP, z));
[[-PX - 2.5, -6.5], [PX + 2.5, -6.5]].forEach(([x, z]) => screw(x, TOP, z));

// R / L engraving on the pontoon tops
function labelTex(txt, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = color; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
[['L', -PX, '#4a4c52'], ['R', PX, '#5d6066']].forEach(([t, x, col]) => {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: labelTex(t, col), transparent: true, toneMapped: false }));
  p.rotation.x = -Math.PI / 2; p.position.set(x, PH + 0.02, -1.0); add(p);
});

/* ------------------------------------------------------------------ electronics enclosure */
const encl = new THREE.Group(); encl.name = 'Electronics enclosure'; boat.add(encl);
const EZ0 = -6.6, EZ1 = 2.4, EX = 5.0, BOXH = 6.8;
// riser frame
const riser = plate(mat.black, [-EX - 0.5, EX + 0.5, EZ0 - 0.6, EZ1 + 0.6], [[-EX + 0.7, EX - 0.7, EZ0 + 0.6, EZ1 - 0.6]], TOP, 1.0, encl);
const BY0 = TOP + 1.0; // box floor
bx(mat.black, -EX, EX, BY0, BY0 + 0.6, EZ0, EZ1, encl);                      // floor
bx(mat.black, -EX, -EX + 0.6, BY0, BY0 + BOXH, EZ0, EZ1, encl);              // left wall
bx(mat.black, EX - 0.6, EX, BY0, BY0 + BOXH, EZ0, EZ1, encl);                // right wall
bx(mat.black, -EX, EX, BY0, BY0 + BOXH, EZ0, EZ0 + 0.6, encl);               // bow wall
bx(mat.black, -EX, EX, BY0, BY0 + BOXH - 2.0, EZ1 - 0.6, EZ1, encl);         // stern wall (lower, open lip)
// internal ribs / gussets
bx(mat.black, -EX + 0.6, EX - 0.6, BY0, BY0 + 4.6, EZ0 + 0.6, EZ0 + 1.6, encl);
bx(mat.black, -1.0, 0.0, BY0, BY0 + 5.4, EZ0 + 1.6, EZ0 + 4.2, encl);
bx(mat.black, 2.0, 3.0, BY0, BY0 + 3.6, EZ0 + 1.6, EZ0 + 4.0, encl);
// corner ears with screws
[[-EX + 0.3, EZ0 + 0.3], [EX - 0.3, EZ0 + 0.3], [-EX + 0.3, EZ1 - 0.3], [EX - 0.3, EZ1 - 0.3]].forEach(([x, z], i) => {
  const top = BY0 + BOXH - (i >= 2 ? 2.0 : 0);
  const s = screw(x, top, z, encl);
});
// side tower (hollow square tube) on the bow-right side
bx(mat.black, EX, EX + 2.6, BY0 + 0.0, BY0 + BOXH - 0.8, EZ0, EZ0 + 0.6, encl);
bx(mat.black, EX, EX + 2.6, BY0 + 0.0, BY0 + BOXH - 0.8, EZ0 + 2.4, EZ0 + 3.0, encl);
bx(mat.black, EX + 2.0, EX + 2.6, BY0 + 0.0, BY0 + BOXH - 0.8, EZ0, EZ0 + 3.0, encl);
bx(mat.black, EX, EX + 2.6, BY0 + 0.0, BY0 + 0.5, EZ0, EZ0 + 3.0, encl);
// round holes in the side walls (dark discs)
[[-EX - 0.01, -1], [-EX - 0.01, 1], [EX + 0.01, -1]].forEach(([x, dz], i) => {
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  d.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; d.position.set(x, BY0 + 1.5 + (i === 1 ? 2.8 : 0), (EZ0 + EZ1) / 2 + dz * 1.6); encl.add(d);
});
// something inside the box: small wire bundle + tape patch (photos show tape / loose leads)
bx(mat.pcb, -2.2, 0.4, BY0 + 0.6, BY0 + 0.75, EZ1 - 3.6, EZ1 - 1.3, encl);

/* ------------------------------------------------------------------ battery holder (under the platform, between the hulls) */
const batt = new THREE.Group(); batt.name = 'Battery holder'; boat.add(batt);
const BZ0 = -5.4, BZ1 = 1.2, BXH = 2.95, BY = DECK_Y - 3.1;
bx(mat.black, -BXH, BXH, BY, BY + 0.35, BZ0, BZ1, batt);                       // floor
bx(mat.black, -BXH, BXH, BY, BY + 2.6, BZ0, BZ0 + 0.35, batt);                 // end walls
bx(mat.black, -BXH, BXH, BY, BY + 2.6, BZ1 - 0.35, BZ1, batt);
bx(mat.black, -BXH, -BXH + 0.3, BY, BY + 1.1, BZ0, BZ1, batt);                 // low side lips
bx(mat.black, BXH - 0.3, BXH, BY, BY + 1.1, BZ0, BZ1, batt);
[-1.55, 0, 1.55].forEach((x, i) => {                                           // AA cells
  const cz = (BZ0 + BZ1) / 2;
  cyl(i === 2 ? mat.cellOrange : mat.cellBlack, 0.72, 5.0, 'z', [x, BY + 1.15, cz], batt, 20);
  cyl(mat.steel, 0.3, 0.25, 'z', [x, BY + 1.15, cz + 2.6], batt, 12);
});
// hangers up to the deck
[[-BXH, BZ0 + 0.2], [BXH - 0.4, BZ0 + 0.2], [-BXH, BZ1 - 0.7], [BXH - 0.4, BZ1 - 0.7]].forEach(([x, z]) => bx(mat.black, x, x + 0.4, BY, DECK_Y, z, z + 0.5, batt));
// battery leads
wire(0xc01818, [[BXH - 0.5, BY + 1.5, BZ0 + 0.1], [BXH - 0.5, BY + 2.3, BZ0 - 0.7], [1.5, DECK_Y - 0.4, BZ0 - 1.2]], 0.07, batt);
wire(0x111111, [[BXH - 1.1, BY + 1.5, BZ0 + 0.1], [BXH - 1.1, BY + 2.3, BZ0 - 0.7], [1.0, DECK_Y - 0.4, BZ0 - 1.2]], 0.07, batt);

/* ------------------------------------------------------------------ propulsion: DC motor + yellow propeller on each stern */
function makeProp() {
  const grp = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 28).rotateX(Math.PI / 2), mat.yellow); grp.add(hub);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), mat.yellow); dome.position.z = 0.65; grp.add(dome);
  const s = new THREE.Shape();
  s.moveTo(-0.32, 0.6); s.bezierCurveTo(-1.15, 1.2, -1.15, 2.4, 0, 2.85); s.bezierCurveTo(1.15, 2.4, 1.15, 1.2, 0.32, 0.6); s.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.11, bevelEnabled: false });
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(); pivot.rotation.z = i * (Math.PI * 2 / 3);
    const b = new THREE.Mesh(bladeGeo, mat.yellow); b.rotation.y = 0.55; b.position.z = -0.05; pivot.add(b); grp.add(pivot);
  }
  return grp;
}
const props = [];
function makeMotorUnit(side) {
  const x = side * PX, m = side < 0 ? hullMat.black : hullMat.grey;
  const MY = PH + 3.2;
  // mounting block with triangular through-hole
  const s = new THREE.Shape(); s.moveTo(-1.4, 0); s.lineTo(1.4, 0); s.lineTo(1.4, 3.2); s.lineTo(-1.4, 3.2); s.closePath();
  const h = new THREE.Path(); h.moveTo(-0.75, 0.55); h.lineTo(0.75, 0.55); h.lineTo(0, 2.1); h.closePath(); s.holes.push(h);
  const block = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3.2, bevelEnabled: false }), m);
  block.position.set(x, PH, 9.0); add(block);
  // motor can
  const yc = MY + 1.0;
  cyl(mat.steel, 1.0, 2.9, 'z', [x, yc, 10.2], boat, 32);
  cyl(mat.motorCap, 1.02, 0.5, 'z', [x, yc, 8.85], boat, 32);               // end cap (bow side)
  cyl(mat.darkSteel, 1.03, 0.2, 'z', [x, yc, 11.55], boat, 32);             // front bearing plate
  cyl(mat.steel, 0.17, 1.9, 'z', [x, yc, 12.4], boat, 10);                   // shaft
  // solder terminals
  bx(mat.steel, x - 0.55, x - 0.35, yc - 0.1, yc + 0.5, 8.5, 8.65);
  bx(mat.steel, x + 0.35, x + 0.55, yc - 0.1, yc + 0.5, 8.5, 8.65);
  // propeller
  const p = makeProp(); p.position.set(x, yc, 13.55); p.userData.dir = side < 0 ? 1 : -1; add(p); props.push(p);
  // motor wires to the enclosure
  const cols = side < 0 ? [0x1f5fd0, 0x1d9a55] : [0xf2c200, 0xe8741a];
  cols.forEach((c, i) => {
    const o = (i - 0.5) * 0.9;
    wire(c, [[x + o * 0.4, yc + 0.3, 8.5], [x + o * 0.5, yc + 1.2, 6.8], [x * 0.7 + o, TOP + 0.9, 3.4 + o * 0.3], [x * 0.35 + o, TOP + 5.2, EZ1 + 0.2 + o * 0.2]], 0.075);
  });
}
makeMotorUnit(-1);
makeMotorUnit(+1);

/* ------------------------------------------------------------------ steering servo + rudder */
const SERVO_Z = 11.3;                          // output-shaft z
const servo = new THREE.Group(); servo.name = 'Steering servo'; boat.add(servo);
const SBY = TOP;                               // servo rests on the rear plate, shaft pointing down (label up)
bx(mat.servoBlue, -0.6, 0.6, SBY, SBY + 2.2, SERVO_Z - 2.4, SERVO_Z + 0.5, servo);     // body
bx(mat.servoBlue, -0.6, 0.6, SBY + 0.45, SBY + 0.7, SERVO_Z - 3.5, SERVO_Z + 1.6, servo); // mounting ears
cyl(mat.servoBlue, 0.5, 0.6, 'y', [0, SBY - 0.0 + 0.3, SERVO_Z], servo, 18);          // gear boss
const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshBasicMaterial({ color: 0xe6b800 }));
sticker.rotation.x = -Math.PI / 2; sticker.position.set(0, SBY + 2.21, SERVO_Z - 0.95); servo.add(sticker);
// servo cable
[[0xd9760f, -0.28], [0xb81818, 0], [0x6b3a1a, 0.28]].forEach(([c, o]) =>
  wire(c, [[o, SBY + 1.0, SERVO_Z - 2.4], [o, SBY + 1.6, SERVO_Z - 4.2], [o, SBY + 5.4, SERVO_Z - 8.0], [o * 0.6, SBY + 6.0, EZ1 + 0.1]], 0.07, servo));

const rudder = new THREE.Group(); rudder.name = 'Rudder';
rudder.position.set(0, DECK_Y, SERVO_Z); boat.add(rudder);
// white servo horn under the plate, linking post, blade
bx(mat.white, -0.18, 0.18, -0.55, -0.25, -0.5, 1.9, rudder);
cyl(mat.white, 0.4, 0.3, 'y', [0, -0.4, 0], rudder, 14);
cyl(mat.steel, 0.12, 1.0, 'y', [0, -0.5, 0.0], rudder, 8);
const blade = new THREE.Mesh(new THREE.ExtrudeGeometry((() => {
  const s = new THREE.Shape(); // side profile (z, y)
  s.moveTo(-0.9, -0.7); s.lineTo(3.2, -1.2); s.lineTo(3.4, -5.8); s.lineTo(0.2, -6.4); s.lineTo(-0.9, -5.5); s.closePath(); return s;
})(), { depth: 0.4, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.2, 0, 0), mat.black);
rudder.add(blade);

/* ------------------------------------------------------------------ shadows */
boat.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
boat.position.y = 0;

/* ------------------------------------------------------------------ labels */
const labelDefs = [
  ['Black pontoon', [-PX, 4.5, -2]], ['Grey pontoon', [PX, 4.5, -2]], ['Electronics enclosure', [0, 16.4, -2]],
  ['DC motor + propeller', [PX, 12.9, 13.5]], ['DC motor + propeller', [-PX, 12.9, 13.5]],
  ['Steering servo', [0, 10.3, 10]], ['Rudder', [0, 3.2, 13.5]], ['Battery holder', [0, 5.2, -2.2]], ['Central platform', [-9.8, 7.8, 0]],
];
const labelRoot = document.getElementById('labels');
const labels = labelDefs.map(([t, p]) => { const e = document.createElement('div'); e.className = 'lbl'; e.textContent = t; e.style.display = 'none'; labelRoot.appendChild(e); return { e, v: new THREE.Vector3(...p) }; });

/* ------------------------------------------------------------------ UI state */
const state = { turn: true, prop: true, rud: true, labels: false, present: false };
const $ = id => document.getElementById(id);
const sync = () => {
  controls.autoRotate = state.turn;
  $('bTurn').setAttribute('aria-pressed', state.turn); $('bProp').setAttribute('aria-pressed', state.prop);
  $('bRud').setAttribute('aria-pressed', state.rud); $('bLbl').setAttribute('aria-pressed', state.labels);
  controls.autoRotateSpeed = state.present ? 4.0 : 3.0;
  document.body.classList.toggle('present', state.present);
};
const toggle = k => { state[k] = !state[k]; sync(); };
const resetView = () => { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); };
const setPresent = on => {
  state.present = on; if (on) { state.turn = true; state.prop = true; state.rud = true; state.labels = false; resetView(); } sync();
};
$('bTurn').onclick = () => toggle('turn'); $('bProp').onclick = () => toggle('prop'); $('bRud').onclick = () => toggle('rud');
$('bLbl').onclick = () => toggle('labels'); $('bReset').onclick = resetView; $('bPres').onclick = () => setPresent(!state.present);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); toggle('turn'); }
  else if (k === 'm') toggle('prop'); else if (k === 'u') toggle('rud'); else if (k === 'l') toggle('labels');
  else if (k === 'r') resetView();
  else if (k === 'p') setPresent(!state.present);
  else if (k === 'escape' && state.present) setPresent(false);
  else if (k === 'f') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }
});
// pause turntable while the user drags, resume shortly after
let resumeT = 0;
controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(resumeT); });
controls.addEventListener('end', () => { resumeT = setTimeout(() => { controls.autoRotate = state.turn; }, 2500); });
const q = new URLSearchParams(location.search);
if (q.has('present')) setPresent(true);
if (q.has('still')) { state.turn = false; state.prop = false; state.rud = false; }
sync();

/* ------------------------------------------------------------------ resize + loop */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // keep the boat framed on narrow / portrait windows
  camera.fov = w / h < 1 ? 32 * Math.min(1.9, 1 / (w / h) * 0.85 + 0.2) : 32;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let t = 0, rudAngle = 0;
const tmp = new THREE.Vector3();
const RUD_MAX = THREE.MathUtils.degToRad(30);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.prop) props.forEach(p => { p.rotation.z += dt * 22 * p.userData.dir; });
  if (state.rud) t += dt;
  const target = state.rud ? Math.sin(t * 1.15) * RUD_MAX : 0;
  rudAngle += (target - rudAngle) * Math.min(1, dt * 8);
  rudder.rotation.y = rudAngle;
  controls.update();
  renderer.render(scene, camera);
  labels.forEach(l => {
    if (!state.labels) { l.e.style.display = 'none'; return; }
    tmp.copy(l.v).project(camera);
    l.e.style.display = tmp.z < 1 ? 'block' : 'none';
    l.e.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px';
    l.e.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
  });
});

window.sg = { THREE, scene, camera, controls, boat, state, rudder, props, renderer,
  view(az, el, dist, tgt = [0, 6.5, 1.5]) { // degrees; az 0 = from +z (stern)
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    controls.target.set(...tgt);
    camera.position.set(tgt[0] + dist * Math.sin(a) * Math.cos(e), tgt[1] + dist * Math.sin(e), tgt[2] + dist * Math.cos(a) * Math.cos(e));
    controls.update();
  } };
