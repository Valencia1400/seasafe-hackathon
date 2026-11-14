// Adds an exploded view and a "blueprint" (edge-line) look to the reconstructed SeaGuardian model from boat.js.
// Nothing is added to the vessel: the existing meshes are only grouped, moved apart and drawn as lines.
import * as THREE from 'three';

const OFFSETS = {            // cm, at explode = 1
  hullL: [-10, -3, 0], hullR: [10, -3, 0], deck: [0, 0, 0], encl: [0, 11, -1.5], batt: [0, -9.5, 0],
  motorL: [-3.5, 5.5, 8.5], motorR: [3.5, 5.5, 8.5], propL: [-3.5, 5.5, 14], propR: [3.5, 5.5, 14],
  servo: [0, 8.5, 6.5], rudder: [0, -4.5, 11], wires: [0, 0, 0],
};
const STRUCT = new Set(['hullL', 'hullR', 'deck', 'rudder']);

export function makeRig(rig) {
  const { boat, props, rudder, encl } = rig;
  boat.updateMatrixWorld(true);
  const groupOf = new Map(), box = new THREE.Box3(), c = new THREE.Vector3();
  const batt = boat.children.find((o) => o.name === 'Battery holder'), servo = boat.children.find((o) => o.name === 'Steering servo');
  for (const o of boat.children) {
    let g;
    if (o.name === 'Pontoon (black)') g = 'hullL'; else if (o.name === 'Pontoon (grey)') g = 'hullR';
    else if (o === encl) g = 'encl'; else if (o === batt) g = 'batt'; else if (o === servo) g = 'servo'; else if (o === rudder) g = 'rudder';
    else if (props.includes(o)) g = o.position.x < 0 ? 'propL' : 'propR';
    else {
      box.setFromObject(o).getCenter(c);
      if (o.geometry && o.geometry.type === 'TubeGeometry') g = 'wires';
      else if (c.z > 8.3 && Math.abs(c.x) > 4) g = c.x < 0 ? 'motorL' : 'motorR';
      else if (o.geometry && o.geometry.type === 'PlaneGeometry' && Math.abs(c.x) > 4) g = c.x < 0 ? 'hullL' : 'hullR';
      else g = 'deck';
    }
    groupOf.set(o, g);
  }
  const parts = [...groupOf].map(([o, g]) => ({ o, g, base: o.position.clone(), off: new THREE.Vector3(...OFFSETS[g]) }));

  // blueprint lines
  const lineStruct = new THREE.LineBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  const lineElec = new THREE.LineBasicMaterial({ color: 0xf2b134, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  const solids = new Set(), meshes = [];
  for (const [top, g] of groupOf) top.traverse((m) => { if (m.isMesh) meshes.push([m, g]); });
  for (const [m, g] of meshes) {
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => solids.add(x));
    if (g === 'wires' || m.geometry.type === 'PlaneGeometry' || m.geometry.type === 'CircleGeometry') continue;
    const ln = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), STRUCT.has(g) ? lineStruct : lineElec);
    ln.userData.isBlueprint = true; ln.raycast = () => {}; m.add(ln);
  }
  const wires = meshes.filter(([, g]) => g === 'wires').map(([m]) => m);
  let shadowOn = true;

  // centre of each group (for labels), in boat-local coordinates at the current explode value
  const centres = {}; for (const g of Object.keys(OFFSETS)) centres[g] = new THREE.Vector3();
  const baseCentre = {};
  for (const g of Object.keys(OFFSETS)) { const b = new THREE.Box3(); parts.filter((p) => p.g === g).forEach((p) => b.expandByObject(p.o)); baseCentre[g] = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3()); }

  /** explode 0..1(+), blueprint 0 = solid … 1 = lines only, struct / elec = line visibility per family (0..1), elecColor optional hex */
  function set({ explode = 0, blueprint = 0, struct = 1, elec = 1, glow = 0 }) {
    for (const p of parts) p.o.position.copy(p.base).addScaledVector(p.off, explode);
    for (const g of Object.keys(OFFSETS)) centres[g].copy(baseCentre[g]).addScaledVector(new THREE.Vector3(...OFFSETS[g]), explode);
    const solid = 1 - blueprint;
    for (const m of solids) { m.transparent = solid < 0.999; m.opacity = solid; m.depthWrite = solid > 0.5; m.visible = solid > 0.004; }
    const wv = solid * (1 - Math.min(1, explode * 6)); for (const m of wires) m.visible = wv > 0.5;
    lineStruct.opacity = Math.min(1, (blueprint * 0.95 + glow) * struct); lineElec.opacity = Math.min(1, (blueprint * 0.95 + glow) * elec);
    lineStruct.visible = lineStruct.opacity > 0.004; lineElec.visible = lineElec.opacity > 0.004;
    const want = solid > 0.5; if (want !== shadowOn) { shadowOn = want; for (const [m] of meshes) m.castShadow = want; }
  }
  set({});
  return { set, centres, lineStruct, lineElec };
}
