import * as THREE from "three";
import { basicMat, blobGeo, glowTexture, lathe, limb, mesh, sphere, stdMat, tube, gradientColor, swayify } from "./util";

export interface Struct {
  obj: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
  update?: (t: number, dt: number) => void;
  fire?: { x: number; y: number; z: number; color: string };
}

const M = {
  stone: () => stdMat("#8a8a84", { rough: 0.95, flat: true }),
  stoneD: () => stdMat("#6a6a68", { rough: 0.95, flat: true }),
  wood: () => stdMat("#6b4a2e", { rough: 0.9 }),
  woodD: () => stdMat("#4a3322", { rough: 0.9 }),
  woodL: () => stdMat("#a07a4c", { rough: 0.85 }),
  plaster: () => stdMat("#eadfc4", { rough: 0.95 }),
  thatch: () => stdMat("#c8a24a", { rough: 1 }),
  tile: () => stdMat("#b0472e", { rough: 0.8 }),
  sand: () => stdMat("#d8b878", { rough: 1, flat: true }),
  sandD: () => stdMat("#b8955a", { rough: 1, flat: true }),
  cloth: (c: string) => stdMat(c, { rough: 0.9, side: THREE.DoubleSide }),
  glass: () => stdMat("#ffd88a", { emissive: "#ffb040", ei: 1.2, rough: 0.3 }),
  gold: () => stdMat("#f2c14e", { rough: 0.3, metal: 0.9 }),
  iron: () => stdMat("#4a4c54", { rough: 0.5, metal: 0.8 }),
};
let glowTex: THREE.Texture | null = null;
const gtex = () => (glowTex ??= glowTexture("#ffffff"));

const add = <T extends THREE.Object3D>(p: THREE.Object3D, c: T, x = 0, y = 0, z = 0): T => { c.position.set(x, y, z); p.add(c); return c; };
const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => add(p, new THREE.Group(), x, y, z);
const box = (p: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => add(p, mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
const cyl = (p: THREE.Object3D, r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 12) => add(p, mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat), x, y, z);

function flame(parent: THREE.Object3D, color: string, size = 1) {
  const g = grp(parent);
  const cols = [color, "#ffd060", "#fff2c0"];
  const cones: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const c = add(g, mesh(new THREE.ConeGeometry(0.18 * size * (1 - i * 0.25), 0.55 * size * (1 - i * 0.2), 8), basicMat(cols[i], 0.85, true), false), 0, 0.28 * size, 0);
    cones.push(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(), color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(1.8 * size); sp.position.y = 0.4 * size; g.add(sp);
  return (t: number) => {
    cones.forEach((c, i) => { c.scale.set(1 + Math.sin(t * 11 + i * 2) * 0.12, 1 + Math.sin(t * 9 + i) * 0.2, 1 + Math.cos(t * 10 + i) * 0.12); c.rotation.y = t * 2 + i; });
    sp.material.opacity = 0.5 + Math.sin(t * 13) * 0.1;
  };
}

function smoke(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = grp(parent, x, y, z);
  const puffs: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(), color: "#d8d8d8", transparent: true, opacity: 0.3, depthWrite: false }));
    g.add(sp); puffs.push(sp);
  }
  return (t: number) => puffs.forEach((p, i) => {
    const u = ((t * 0.18 + i / puffs.length) % 1);
    p.position.set(u * 1.4 + Math.sin(t + i) * 0.1, u * 5, Math.cos(t * 0.7 + i) * 0.15);
    p.scale.setScalar(0.5 + u * 2.4);
    p.material.opacity = 0.32 * (1 - u) * Math.min(1, u * 6);
  });
}

function cottage(): Struct {
  const g = new THREE.Group();
  const ups: ((t: number, dt: number) => void)[] = [];
  const found = box(g, 7.4, 0.8, 6.0, M.stone(), 0, 0.4, 0);
  void found;
  const walls = box(g, 7.0, 3.0, 5.6, M.plaster(), 0, 2.3, 0);
  void walls;
  // каркас балок
  for (const z of [-2.85, 2.85]) {
    for (let i = 0; i <= 4; i++) box(g, 0.22, 3.0, 0.14, M.woodD(), -3.5 + i * 1.75, 2.3, z);
    box(g, 7.2, 0.22, 0.16, M.woodD(), 0, 3.7, z); box(g, 7.2, 0.22, 0.16, M.woodD(), 0, 2.0, z);
    for (let i = 0; i < 3; i++) { const d = box(g, 0.14, 1.8, 0.12, M.woodD(), -2.6 + i * 2.6, 2.85, z); d.rotation.z = i % 2 ? 0.7 : -0.7; }
  }
  for (const x of [-3.55, 3.55]) { box(g, 0.14, 3.0, 0.22, M.woodD(), x, 2.3, 0); }
  // крыша
  const roofGeo = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-3.3, 0); s.lineTo(0, 2.6); s.lineTo(3.3, 0); s.lineTo(3.1, -0.25); s.lineTo(0, 2.2); s.lineTo(-3.1, -0.25); s.closePath(); return s; })(), { depth: 7.4, bevelEnabled: false });
  const roof = add(g, mesh(roofGeo, M.thatch()), -3.7, 3.8, 0);
  roof.rotation.y = Math.PI / 2;
  // фронтоны
  const gable = (z: number) => {
    const s = new THREE.Shape(); s.moveTo(-3.1, 0); s.lineTo(0, 2.0); s.lineTo(3.1, 0); s.closePath();
    const m = add(g, mesh(new THREE.ShapeGeometry(s), M.plaster()), 0, 3.8, z); if (z < 0) m.rotation.y = Math.PI; return m;
  };
  gable(2.82); gable(-2.82);
  // ряды соломы
  for (let i = 0; i < 5; i++) { const r = add(g, mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.6, 6), M.woodD()), 0, 3.85 + (i === 0 ? 2.6 : 0), 0); r.rotation.z = Math.PI / 2; r.visible = i === 0; }
  // труба
  box(g, 0.9, 3.6, 0.9, M.stone(), -2.2, 4.9, -1.2);
  ups.push(smoke(g, -2.2, 6.8, -1.2));
  // дверь и окна
  box(g, 1.3, 2.3, 0.16, M.wood(), 0.0, 1.95, 2.88);
  add(g, mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.16, 12, 1, false, 0, Math.PI), M.wood()), 0, 3.1, 2.88).rotation.set(Math.PI / 2, 0, Math.PI / 2 * 0);
  box(g, 0.14, 0.14, 0.2, M.gold(), 0.45, 1.9, 2.98);
  for (const x of [-2.2, 2.2]) {
    box(g, 1.1, 1.0, 0.14, M.glass(), x, 2.6, 2.86); box(g, 1.3, 0.12, 0.2, M.woodD(), x, 3.15, 2.86); box(g, 1.3, 0.12, 0.2, M.woodD(), x, 2.05, 2.86); box(g, 0.1, 1.1, 0.2, M.woodD(), x, 2.6, 2.86);
    box(g, 0.45, 1.1, 0.1, M.woodL(), x - 0.85, 2.6, 2.88); box(g, 0.45, 1.1, 0.1, M.woodL(), x + 0.85, 2.6, 2.88);
    const fb = box(g, 1.3, 0.3, 0.35, M.woodD(), x, 1.85, 3.1);
    void fb;
    for (let k = 0; k < 6; k++) add(g, mesh(sphere(0.1), stdMat(["#ff6aa0", "#ffd24d", "#ff5050", "#ffffff"][k % 4], { rough: 0.7 })), x - 0.5 + k * 0.2, 2.1, 3.1);
  }
  for (const x of [-2.2, 2.2]) { box(g, 1.1, 1.0, 0.14, M.glass(), x, 2.6, -2.86); }
  // крыльцо
  box(g, 3.0, 0.2, 1.8, M.woodL(), 0, 0.9, 3.9);
  for (const x of [-1.4, 1.4]) cyl(g, 0.1, 0.1, 2.4, M.woodD(), x, 2.0, 4.6, 8);
  const pr = box(g, 3.4, 0.14, 2.2, M.thatch(), 0, 3.2, 4.0); pr.rotation.x = 0.0;
  // бочки, дрова
  for (const [x, z] of [[-4.0, 2.0], [-4.4, 3.0]]) { const b = cyl(g, 0.45, 0.5, 0.9, M.wood(), x, 0.6, z, 10); b.scale.set(1, 1, 1); add(g, mesh(new THREE.TorusGeometry(0.47, 0.03, 5, 12), M.iron()), x, 0.5, z).rotation.x = Math.PI / 2; }
  for (let i = 0; i < 12; i++) { const l = cyl(g, 0.12, 0.12, 1.4, M.wood(), 4.3 + (i % 4) * 0.01, 0.15 + Math.floor(i / 4) * 0.25, -1.5 + (i % 4) * 0.26, 7); l.rotation.x = Math.PI / 2; l.rotation.z = 0.0; }
  const lantern = add(g, mesh(sphere(0.18), stdMat("#ffd070", { emissive: "#ffb040", ei: 2 })), 1.6, 2.7, 3.2);
  void lantern;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(), color: "#ffb050", transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); spr.scale.setScalar(2.2); spr.position.set(1.6, 2.7, 3.2); g.add(spr);
  return { obj: g, colliders: [{ x: -2, z: 0, r: 3.3 }, { x: 2, z: 0, r: 3.3 }, { x: 0, z: 0, r: 3.3 }], update: (t, dt) => ups.forEach((u) => u(t, dt)) };
}

function windmill(): Struct {
  const g = new THREE.Group();
  const tower = mesh(lathe([[2.4, 0], [2.2, 3], [1.8, 7], [1.6, 9]], 14), stdMat("#d8d0bc", { rough: 0.95, flat: true }));
  add(g, tower);
  for (let i = 0; i < 6; i++) add(g, mesh(new THREE.TorusGeometry(2.3 - i * 0.12, 0.07, 5, 16), M.woodD()), 0, 1 + i * 1.45, 0).rotation.x = Math.PI / 2;
  add(g, mesh(new THREE.ConeGeometry(2.0, 3, 14), stdMat("#8a4a2e", { rough: 0.9 })), 0, 10.5, 0);
  box(g, 1.2, 2.2, 0.2, M.wood(), 0, 1.2, 2.3);
  const hub = grp(g, 0, 8.2, 2.1);
  add(hub, mesh(sphere(0.35), M.woodD()));
  const blades = grp(hub, 0, 0, 0.3);
  for (let i = 0; i < 4; i++) {
    const b = grp(blades); b.rotation.z = (i / 4) * Math.PI * 2;
    box(b, 0.2, 7.2, 0.14, M.woodD(), 0, 4.0, 0);
    for (let k = 0; k < 6; k++) box(b, 1.5, 0.1, 0.1, M.woodD(), 0.75, 1.0 + k * 1.1, 0);
    box(b, 1.5, 5.4, 0.05, stdMat("#efe6cf", { rough: 1, side: THREE.DoubleSide }), 0.85, 4.3, 0.04);
  }
  return { obj: g, colliders: [{ x: 0, z: 0, r: 2.7 }], update: (t) => { blades.rotation.z = t * 0.35; } };
}

function well(): Struct {
  const g = new THREE.Group();
  add(g, mesh(lathe([[1.0, 0], [1.05, 0.2], [1.0, 1.0], [0.75, 1.0], [0.72, 0.2], [0.001, 0.2]], 14), M.stone()));
  cyl(g, 0.0, 0.0, 0.1, stdMat("#2a6a9a", { rough: 0.1 }), 0, 0.85, 0, 14).scale.set(9, 1, 9);
  for (const s of [-1, 1]) cyl(g, 0.09, 0.09, 2.2, M.wood(), s * 0.95, 1.9, 0, 7);
  const bar = cyl(g, 0.07, 0.07, 2.1, M.woodD(), 0, 2.8, 0, 7); bar.rotation.z = Math.PI / 2;
  const r1 = box(g, 1.3, 0.1, 2.0, M.tile(), -0.65, 3.3, 0); r1.rotation.z = 0.5; const r2 = box(g, 1.3, 0.1, 2.0, M.tile(), 0.65, 3.3, 0); r2.rotation.z = -0.5;
  cyl(g, 0.2, 0.17, 0.3, M.wood(), 0, 1.7, 0, 8);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.3 }] };
}

function campfire(): Struct {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(g, mesh(sphere(0.2, 1, 0.8, 1, 8), M.stoneD()), Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8); }
  for (let i = 0; i < 4; i++) { const l = cyl(g, 0.09, 0.09, 1.1, M.woodD(), 0, 0.2, 0, 6); l.rotation.set(0.5, (i / 4) * Math.PI * 2, Math.PI / 2 - 0.4); l.position.set(Math.cos(i * 1.57) * 0.2, 0.25, Math.sin(i * 1.57) * 0.2); }
  const f = flame(g, "#ff7a1a", 1.0);
  const ember = add(g, mesh(sphere(0.35, 1, 0.3, 1), basicMat("#ff5a10", 0.9, true)), 0, 0.12, 0);
  void ember;
  return { obj: g, colliders: [{ x: 0, z: 0, r: 0.9 }], update: (t) => f(t), fire: { x: 0, y: 1.2, z: 0, color: "#ff9a40" } };
}

function stall(): Struct {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) cyl(g, 0.08, 0.08, 2.8, M.wood(), x, 1.4, z, 7);
  const cols = ["#c0392b", "#f2ead0"];
  for (let i = 0; i < 8; i++) { const p = box(g, 0.8, 0.06, 2.9, M.cloth(cols[i % 2]), -2.8 + i * 0.8 + 0.4 - 0.0, 2.9 + (i < 4 ? i * 0.0 : 0), 0); p.position.x = -1.6 + (i + 0.5) * 0.4; p.scale.x = 0.5; p.rotation.z = 0; p.position.y = 3.0; }
  box(g, 3.8, 0.1, 0.1, M.woodD(), 0, 2.8, 1.1);
  box(g, 3.4, 0.9, 0.9, M.woodL(), 0, 0.45, 0.8); box(g, 3.6, 0.1, 1.1, M.woodD(), 0, 0.95, 0.8);
  for (let i = 0; i < 6; i++) add(g, mesh(sphere(0.14), stdMat(["#d8453a", "#e8b84a", "#78b84a"][i % 3], { rough: 0.7 })), -1.3 + i * 0.5, 1.12, 0.8);
  box(g, 0.7, 0.6, 0.7, M.wood(), 2.0, 0.3, -0.4); box(g, 0.6, 0.5, 0.6, M.woodL(), 2.0, 0.85, -0.4);
  cyl(g, 0.3, 0.35, 0.7, M.wood(), -2.0, 0.35, -0.5, 8);
  return { obj: g, colliders: [{ x: 0, z: 0.4, r: 2.0 }, { x: -1.2, z: 0.6, r: 1 }, { x: 1.2, z: 0.6, r: 1 }] };
}

function watchtower(): Struct {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const p = cyl(g, 0.22, 0.17, 8.4, M.wood(), x * 1.0, 4.2, z, 7); p.rotation.set(z * 0.02, 0, -x * 0.02); }
  for (let i = 1; i < 4; i++) { box(g, 3.4, 0.14, 0.14, M.woodD(), 0, i * 2.0, 1.55); box(g, 3.4, 0.14, 0.14, M.woodD(), 0, i * 2.0, -1.55); const d = box(g, 0.14, 2.8, 0.14, M.woodD(), 0, i * 2.0 - 1.0, 1.58); d.rotation.z = 0.7; }
  box(g, 4.2, 0.25, 4.2, M.woodL(), 0, 8.4, 0);
  for (const x of [-2, 2]) { box(g, 0.1, 1.0, 4.2, M.wood(), x, 9.0, 0); box(g, 4.2, 1.0, 0.1, M.wood(), 0, 9.0, x); }
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) cyl(g, 0.08, 0.08, 2.4, M.wood(), x, 9.6, z, 6);
  add(g, mesh(new THREE.ConeGeometry(3.4, 1.8, 4), M.thatch()), 0, 11.6, 0).rotation.y = Math.PI / 4;
  const ladder = grp(g, 0, 0, 2.0); for (let i = 0; i < 16; i++) box(ladder, 0.8, 0.07, 0.07, M.woodD(), 0, 0.3 + i * 0.5, 0);
  const flag = box(g, 1.4, 0.8, 0.04, M.cloth("#c0392b"), 0.9, 10.9, 0);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 2.6 }], update: (t) => { flag.rotation.y = Math.sin(t * 3) * 0.2; flag.position.x = 0.7 + Math.sin(t * 3) * 0.05; } };
}

function bridge(): Struct {
  const g = new THREE.Group();
  const L = 22;
  const planks = 44;
  for (let i = 0; i < planks; i++) {
    const u = (i / (planks - 1)) * 2 - 1;
    const y = 0.5 + (1 - u * u) * 0.55;
    const p = box(g, L / planks * 0.92, 0.14, 3.0, M.woodL(), u * (L / 2), y, 0);
    p.rotation.z = -u * 0.28;
  }
  for (const s of [-1, 1]) {
    box(g, L * 0.92, 0.2, 0.2, M.woodD(), 0, 0.25, s * 1.5).scale.y = 1;
    for (let i = 0; i <= 10; i++) {
      const u = (i / 10) * 2 - 1;
      const y = 0.5 + (1 - u * u) * 0.55;
      cyl(g, 0.1, 0.1, 1.5, M.wood(), u * (L / 2 - 1), y + 0.75, s * 1.5, 6);
      if (i < 10) { const u2 = ((i + 1) / 10) * 2 - 1; const y2 = 0.5 + (1 - u2 * u2) * 0.55; const r = box(g, L / 10, 0.1, 0.1, M.wood(), (u + u2) / 2 * (L / 2 - 1), (y + y2) / 2 + 1.3, s * 1.5); r.rotation.z = Math.atan2(y2 - y, (u2 - u) * (L / 2 - 1)); }
    }
  }
  for (const s of [-1, 1]) { box(g, 2.2, 2.0, 3.6, M.stone(), s * (L / 2 + 0.6), 0.2, 0); }
  for (const x of [-6, 0, 6]) for (const z of [-1.2, 1.2]) cyl(g, 0.22, 0.22, 3.5, M.woodD(), x, -1.0, z, 7);
  return { obj: g, colliders: [] };
}

function dock(): Struct {
  const g = new THREE.Group();
  for (let i = 0; i < 16; i++) box(g, 0.7, 0.12, 2.2, M.woodL(), 1 + i * 0.75, 0.0, 0);
  for (let i = 0; i < 5; i++) for (const z of [-1, 1]) cyl(g, 0.12, 0.12, 2.0, M.woodD(), 1.5 + i * 2.6, -0.6, z * 1.0, 6);
  const boat = grp(g, 9.5, -0.45, 2.2); boat.rotation.y = 0.35;
  const hull = mesh(lathe([[0.001, -0.35], [0.4, -0.25], [0.6, 0.15], [0.62, 0.3], [0.55, 0.3], [0.5, 0.1], [0.3, -0.2], [0.001, -0.28]], 12), M.wood());
  hull.scale.set(1, 1, 2.6); hull.rotation.y = Math.PI / 2; add(boat, hull);
  box(boat, 0.1, 0.1, 2.6, M.woodD(), 0, 0.28, 0); box(boat, 1.0, 0.08, 0.3, M.woodL(), 0, 0.15, 0.2);
  const rod = limb(0.02, 0.01, 2.2, 4); const r = add(g, mesh(rod, M.woodD()), 2.0, 1.8, -0.8); r.rotation.z = -1.0;
  const lamp = add(g, mesh(sphere(0.12), stdMat("#ffd070", { emissive: "#ffb040", ei: 2 })), 0.8, 1.6, 1.0); void lamp;
  cyl(g, 0.05, 0.05, 1.6, M.wood(), 0.8, 0.8, 1.0, 5);
  return { obj: g, colliders: [], update: (t) => { boat.position.y = -0.45 + Math.sin(t * 1.5) * 0.04; boat.rotation.z = Math.sin(t * 1.2) * 0.03; } };
}

function haystack(): Struct {
  const g = new THREE.Group();
  add(g, mesh(lathe([[0.001, 0], [1.4, 0], [1.5, 0.5], [1.2, 1.4], [0.7, 2.1], [0.001, 2.5]].map(([r, y]) => [r, y] as [number, number]), 12), stdMat("#d8b44a", { rough: 1 })));
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.4 }] };
}

function garden(): Struct {
  const g = new THREE.Group();
  const colors = ["#4a9a3a", "#6ab04a", "#d86a2a", "#8a3a8a"];
  for (let r = 0; r < 4; r++) {
    box(g, 6.0, 0.25, 0.9, stdMat("#4a3322", { rough: 1 }), 0, 0.1, r * 1.5 - 2.2);
    for (let i = 0; i < 10; i++) {
      const h = 0.3 + (i % 3) * 0.1;
      add(g, mesh(new THREE.ConeGeometry(0.16, h, 6), stdMat(colors[r], { rough: 0.8 })), -2.7 + i * 0.6, 0.25 + h / 2, r * 1.5 - 2.2);
      if (r === 2) add(g, mesh(sphere(0.12), stdMat("#e8541a", { rough: 0.5 })), -2.7 + i * 0.6, 0.3, r * 1.5 - 2.2);
    }
  }
  // пугало
  const sc = grp(g, 3.8, 0, 1);
  cyl(sc, 0.05, 0.05, 2.2, M.wood(), 0, 1.1, 0, 5); const arms = cyl(sc, 0.04, 0.04, 1.5, M.wood(), 0, 1.7, 0, 5); arms.rotation.z = Math.PI / 2;
  add(sc, mesh(sphere(0.2), stdMat("#e8d8a0", { rough: 1 })), 0, 2.3, 0);
  add(sc, mesh(new THREE.ConeGeometry(0.28, 0.4, 8), stdMat("#4a3322")), 0, 2.65, 0);
  box(sc, 0.5, 0.7, 0.3, M.cloth("#7a4a2a"), 0, 1.5, 0);
  return { obj: g, colliders: [] };
}

function lamp(): Struct {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.1, 2.8, M.woodD(), 0, 1.4, 0, 6);
  box(g, 0.5, 0.06, 0.06, M.woodD(), 0.2, 2.7, 0);
  add(g, mesh(sphere(0.2, 1, 1.2, 1), stdMat("#ffe0a0", { emissive: "#ffa840", ei: 2.2 })), 0.4, 2.5, 0);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(), color: "#ffa850", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(2.6); s.position.set(0.4, 2.5, 0); g.add(s);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 0.2 }], update: (t) => { s.material.opacity = 0.5 + Math.sin(t * 7 + g.position.x) * 0.05; } };
}

function banner(): Struct {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.09, 5.2, M.woodD(), 0, 2.6, 0, 6);
  const cloth = box(g, 0.05, 2.4, 1.2, M.cloth("#b22a2a"), 0, 3.9, 0.7);
  add(g, mesh(new THREE.ConeGeometry(0.6, 0.6, 3), M.cloth("#b22a2a")), 0, 2.4, 0.7).rotation.x = Math.PI;
  box(g, 0.06, 0.8, 0.5, M.gold(), 0.04, 4.2, 0.7);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 0.2 }], update: (t) => { cloth.rotation.x = Math.sin(t * 2.5) * 0.08; cloth.rotation.y = Math.sin(t * 2) * 0.1; } };
}

function tent(big = false): Struct {
  const g = new THREE.Group();
  const s = big ? 1.8 : 1;
  const cols = big ? ["#d8b04a", "#a02a2a"] : ["#d8c8a0", "#8a6a3a"];
  const body = mesh(new THREE.ConeGeometry(2.6 * s, 3.2 * s, 8, 1, true), M.cloth(cols[0])); add(g, body, 0, 1.6 * s, 0);
  for (let i = 0; i < 4; i++) { const st = mesh(new THREE.ConeGeometry(2.62 * s, 3.2 * s, 8, 1, true, i * (Math.PI / 2), Math.PI / 8), M.cloth(cols[1])); add(g, st, 0, 1.6 * s, 0); }
  box(g, 1.2 * s, 2.0 * s, 0.1, stdMat("#1a1410", { rough: 1 }), 0, 1.0 * s, 2.2 * s).rotation.x = -0.25;
  cyl(g, 0.06, 0.06, 1.0 * s, M.woodD(), 0, 3.6 * s, 0, 5);
  const fl = box(g, 0.9, 0.5, 0.04, M.cloth(cols[1]), 0.45, 3.9 * s, 0);
  if (big) { box(g, 3.2, 0.06, 2.4, M.cloth("#7a2a2a"), 0, 0.04, 3.6); for (const x of [-1.7, 1.7]) cyl(g, 0.1, 0.1, 2.6, M.woodD(), x, 1.3, 4.5, 6); box(g, 4, 0.1, 2.8, M.cloth(cols[1]), 0, 2.6, 3.7).rotation.x = 0.2; }
  return { obj: g, colliders: [{ x: 0, z: 0, r: 2.4 * s }], update: (t) => { fl.rotation.y = Math.sin(t * 3) * 0.25; } };
}

function pyramid(): Struct {
  const g = new THREE.Group();
  const levels = 9;
  for (let i = 0; i < levels; i++) {
    const w = 30 - i * 3.2, h = 2.4;
    const b = box(g, w, h, w, i % 2 ? M.sandD() : M.sand(), 0, h / 2 + i * h, 0);
    void b;
  }
  add(g, mesh(new THREE.ConeGeometry(2.2, 3, 4), M.gold()), 0, levels * 2.4 + 1.5, 0).rotation.y = Math.PI / 4;
  add(g, mesh(sphere(0.8), basicMat("#ffe080", 0.9, true)), 0, levels * 2.4 + 3.2, 0);
  box(g, 4, 5, 2, stdMat("#120c08", { rough: 1 }), 0, 2.5, 14.6);
  box(g, 6, 0.6, 3, M.sandD(), 0, 4.8, 14.6);
  for (const x of [-3.4, 3.4]) { cyl(g, 0.6, 0.7, 7, M.sand(), x, 3.5, 15.6, 8); add(g, mesh(sphere(0.55), M.gold()), x, 7.3, 15.6); }
  for (let i = 0; i < 6; i++) box(g, 8 - i * 0.6, 0.4, 1.2, M.sand(), 0, 0.2 + i * 0.4 * 0.0, 17 + i * 1.2).scale.y = 1;
  return { obj: g, colliders: [{ x: 0, z: 0, r: 17 }, { x: 0, z: 8, r: 12 }] };
}

function obelisk(): Struct {
  const g = new THREE.Group();
  box(g, 3.4, 0.6, 3.4, M.sandD(), 0, 0.3, 0);
  const o = mesh(new THREE.CylinderGeometry(0.7, 1.1, 10, 4), M.sand()); o.rotation.y = Math.PI / 4; add(g, o, 0, 5.6, 0);
  add(g, mesh(new THREE.ConeGeometry(0.7, 1.4, 4), M.gold()), 0, 11.3, 0).rotation.y = Math.PI / 4;
  for (let i = 0; i < 6; i++) box(g, 0.9, 0.12, 0.05, basicMat("#ffcc50", 0.9, true), 0, 2 + i * 1.4, 0.78 - i * 0.03);
  const orb = add(g, mesh(sphere(0.35), basicMat("#ffe080", 0.9, true)), 0, 1.2, 1.6);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.8 }], update: (t) => { orb.position.y = 1.3 + Math.sin(t * 2) * 0.12; } };
}

function ruins(): Struct {
  const g = new THREE.Group();
  const cols: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = 5.5, h = [5, 3.5, 6, 2, 5.5, 4, 1.4][i];
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    cyl(g, 0.55, 0.62, h, M.stone(), x, h / 2, z, 10); box(g, 1.5, 0.35, 1.5, M.stoneD(), x, 0.17, z); if (h > 4) box(g, 1.5, 0.4, 1.5, M.stoneD(), x, h + 0.2, z);
    cols.push({ x, z, r: 0.7 });
  }
  const arch = grp(g, 0, 0, -7);
  box(arch, 1, 7, 1, M.stone(), -3, 3.5, 0); box(arch, 1, 7, 1, M.stone(), 3, 3.5, 0);
  add(arch, mesh(new THREE.TorusGeometry(3, 0.5, 6, 14, Math.PI), M.stone()), 0, 7, 0);
  for (let i = 0; i < 8; i++) box(g, 1.2 + (i % 3) * 0.4, 0.6, 1.0, M.stoneD(), Math.cos(i * 2.3) * 8, 0.3, Math.sin(i * 2.3) * 8).rotation.y = i;
  cols.push({ x: -3, z: -7, r: 0.8 }, { x: 3, z: -7, r: 0.8 });
  return { obj: g, colliders: cols };
}

function bones(): Struct {
  const g = new THREE.Group();
  const mat = stdMat("#e8e2cf", { rough: 0.8 });
  for (let i = 0; i < 6; i++) { const r = add(g, mesh(new THREE.TorusGeometry(1.6 - Math.abs(i - 2.5) * 0.15, 0.14, 6, 14, Math.PI), mat), 0, 0, i * 0.7 - 1.7); r.rotation.y = Math.PI / 2; }
  add(g, mesh(limb(0.12, 0.12, 5, 6), mat), 0, 0.2, 0).rotation.x = Math.PI / 2;
  const sk = add(g, mesh(sphere(0.7, 1, 0.9, 1.3), mat), 0, 0.6, 3.2);
  for (const s of [-1, 1]) { add(sk, mesh(sphere(0.18, 1, 1, 0.5), stdMat("#101010")), s * 0.3, 0.1, 0.8); add(sk, mesh(new THREE.ConeGeometry(0.12, 0.9, 5), mat), s * 0.5, -0.2, 0.7).rotation.x = -2.0; }
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.5 }, { x: 0, z: 3, r: 1 }] };
}

function caveEntrance(): Struct {
  const g = new THREE.Group();
  const rockM = new THREE.MeshStandardMaterial({ color: "#6a6862", roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI - 0.0;
    const b = add(g, mesh(blobGeo(2.4 + (i % 3) * 0.5, 1, 0.3, i + 3, 1.2), rockM), Math.cos(a) * 4.5, 2.2 + Math.sin(a) * 4.4, 0);
    b.scale.set(1, 1, 1.4);
  }
  for (const s of [-1, 1]) add(g, mesh(blobGeo(3.4, 1, 0.3, 21 + s, 1.4), rockM), s * 5.0, 1.2, 0);
  add(g, mesh(new THREE.CircleGeometry(3.4, 18), stdMat("#050403", { rough: 1 })), 0, 2.4, 1.0);
  for (const s of [-1, 1]) add(g, mesh(sphere(0.22), basicMat("#ff4020", 0.9, true)), s * 0.7, 2.0, 1.1);
  for (let i = 0; i < 6; i++) add(g, mesh(new THREE.ConeGeometry(0.3, 1.2, 5), M.stoneD()), -3 + i * 1.2, 5.2, 1.6).rotation.x = Math.PI;
  return { obj: g, colliders: [{ x: -4.5, z: 0, r: 3 }, { x: 4.5, z: 0, r: 3 }, { x: 0, z: -2, r: 3.5 }] };
}

function stones(): Struct {
  const g = new THREE.Group();
  const cols: { x: number; z: number; r: number }[] = [];
  const runes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = 6;
    const s = add(g, mesh(new THREE.BoxGeometry(1.2, 4 + (i % 3) * 0.8, 0.9), M.stone()), Math.cos(a) * r, 2.2, Math.sin(a) * r);
    s.rotation.set((i % 3 - 1) * 0.06, -a, (i % 2 - 0.5) * 0.08);
    const rn = add(g, mesh(new THREE.PlaneGeometry(0.5, 1.2), basicMat("#6affd8", 0.7, true)), Math.cos(a) * (r - 0.48), 2.6, Math.sin(a) * (r - 0.48)); rn.rotation.y = -a + Math.PI / 2 + Math.PI; runes.push(rn);
    cols.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0.8 });
  }
  box(g, 3, 0.4, 3, M.stone(), 0, 0.2, 0);
  const orb = add(g, mesh(new THREE.OctahedronGeometry(0.5, 0), basicMat("#6affd8", 0.9, true)), 0, 1.8, 0);
  return { obj: g, colliders: cols, update: (t) => { orb.rotation.y = t; orb.position.y = 1.8 + Math.sin(t * 2) * 0.15; runes.forEach((r, i) => ((r.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 2 + i) * 0.25)); } };
}

function giantTree(s: number): Struct {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: "#5a4128", roughness: 1 });
  const prof: [number, number][] = [[4.2, 0], [3.0, 1.5], [2.6, 5], [2.4, 10], [2.2, 15], [1.8, 18]];
  const tg = lathe(prof, 20);
  const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.sin(a * 6 + p.getY(i) * 0.5) * 0.08; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  tg.computeVertexNormals();
  add(g, mesh(tg, bark));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const root = add(g, mesh(limb(0.9, 0.2, 5, 7), bark), Math.cos(a) * 2.8, 1.8, Math.sin(a) * 2.8); root.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15); }
  // дверь-дупло
  add(g, mesh(new THREE.CircleGeometry(1.1, 14), basicMat("#ffd070", 0.95)), 0, 1.4, 3.6).scale.set(0.9, 1.3, 1);
  // платформы
  const plats = [7, 11.5];
  plats.forEach((y, k) => {
    const pl = mesh(new THREE.CylinderGeometry(5.4 - k, 5.4 - k, 0.3, 20), M.woodL()); add(g, pl, 0, y, 0);
    add(g, mesh(new THREE.TorusGeometry(5.3 - k, 0.08, 5, 24), M.woodD()), 0, y + 1.0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; cyl(g, 0.07, 0.07, 1.0, M.woodD(), Math.cos(a) * (5.3 - k), y + 0.5, Math.sin(a) * (5.3 - k), 5); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + k; const hut = grp(g, Math.cos(a) * 3.8, y + 0.15, Math.sin(a) * 3.8); hut.rotation.y = -a + Math.PI / 2; cyl(hut, 1.0, 1.0, 1.6, M.plaster(), 0, 0.8, 0, 8); add(hut, mesh(new THREE.ConeGeometry(1.4, 1.2, 8), M.thatch()), 0, 2.2, 0); box(hut, 0.5, 0.6, 0.1, M.glass(), 0, 0.9, 1.0); }
  });
  // кроны
  const leafMat = swayify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0.006);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, r = 3 + (i % 4) * 2.4;
    const bl = blobGeo(5.5 + (i % 3) * 1.6, 2, 0.28, 50 + i, 0.75);
    bl.translate(Math.cos(a) * r, 19 + (i % 4) * 1.3, Math.sin(a) * r);
    gradientColor(bl, "#1f5a30", "#78d060", 16, 25, 0.12, i);
    add(g, mesh(bl, leafMat));
  }
  // свисающие светящиеся лозы
  const glow: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const a = i * 0.7, r = 4 + (i % 5) * 1.6;
    const v = add(g, mesh(limb(0.04, 0.02, 3 + (i % 4), 4), basicMat("#a8ffb0", 0.8)), Math.cos(a) * r, 18, Math.sin(a) * r);
    const bulb = add(g, mesh(sphere(0.12), basicMat(["#6affd8", "#c06bff", "#ffe080"][i % 3], 0.95, true)), Math.cos(a) * r, 18 - (3 + (i % 4)), Math.sin(a) * r);
    void v; glow.push(bulb);
  }
  g.scale.setScalar(s);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 4.5 * s }], update: (t) => glow.forEach((b, i) => b.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.25)) };
}

function shrine(): Struct {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) cyl(g, 3 - i * 0.7, 3.2 - i * 0.7, 0.3, M.stone(), 0, 0.15 + i * 0.3, 0, 16);
  cyl(g, 0.6, 0.8, 1.2, M.stoneD(), 0, 1.5, 0, 8);
  const c = add(g, mesh(new THREE.OctahedronGeometry(0.6, 0), basicMat("#6affd8", 0.9, true)), 0, 2.8, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(), color: "#6affd8", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(4); halo.position.y = 2.8; g.add(halo);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 3 }], update: (t) => { c.rotation.y = t; c.position.y = 2.8 + Math.sin(t * 2) * 0.2; } };
}

function pillar(): Struct {
  const g = new THREE.Group();
  const stone = stdMat("#55565e", { rough: 0.9, flat: true });
  cyl(g, 1.0, 1.1, 0.6, stone, 0, 0.3, 0, 8); cyl(g, 0.7, 0.8, 8, stone, 0, 4.5, 0, 10); cyl(g, 1.1, 0.9, 0.6, stone, 0, 8.6, 0, 8);
  for (let i = 0; i < 5; i++) { const a = i * 1.3; box(g, 0.2, 0.2, 0.2, stdMat("#3a3a40"), Math.cos(a) * 0.72, 2 + i * 1.3, Math.sin(a) * 0.72); }
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.0 }] };
}

function brazier(): Struct {
  const g = new THREE.Group();
  cyl(g, 0.15, 0.3, 1.4, M.iron(), 0, 0.7, 0, 6);
  add(g, mesh(lathe([[0.001, 0], [0.5, 0.25], [0.7, 0.6], [0.6, 0.6], [0.45, 0.3], [0.001, 0.1]], 10), M.iron()), 0, 1.4, 0);
  const f = flame(g, "#7dff6a", 1.4); g.children[g.children.length - 1].position.y = 1.5;
  return { obj: g, colliders: [{ x: 0, z: 0, r: 0.5 }], update: (t) => f(t), fire: { x: 0, y: 2.2, z: 0, color: "#6aff7a" } };
}

function throne(): Struct {
  const g = new THREE.Group();
  const st = stdMat("#2a2a30", { rough: 0.8, flat: true });
  for (let i = 0; i < 4; i++) box(g, 8 - i * 1.2, 0.5, 6 - i * 0.9, st, 0, 0.25 + i * 0.5, 0);
  box(g, 3.2, 1.0, 2.4, st, 0, 2.5, 0); box(g, 3.2, 5.5, 0.6, st, 0, 4.2, -1.0);
  for (const s of [-1, 1]) { box(g, 0.5, 1.6, 2.2, st, s * 1.8, 3.0, 0); add(g, mesh(new THREE.ConeGeometry(0.4, 2.4, 4), st), s * 1.5, 7.3, -1.0); add(g, mesh(sphere(0.4), basicMat("#7dff6a", 0.9, true)), s * 1.8, 3.9, 0.6); }
  add(g, mesh(new THREE.ConeGeometry(0.5, 3.2, 4), st), 0, 8.4, -1.0);
  for (let i = 0; i < 10; i++) add(g, mesh(sphere(0.2, 1, 1.1, 1), stdMat("#e8e2cf")), -3.4 + i * 0.75, 2.9, -0.7);
  return { obj: g, colliders: [{ x: 0, z: -0.5, r: 3.5 }] };
}

function sarcophagus(): Struct {
  const g = new THREE.Group();
  const st = stdMat("#6a6a70", { rough: 0.9, flat: true });
  box(g, 1.8, 0.9, 3.4, st, 0, 0.45, 0); const lid = box(g, 1.9, 0.35, 3.5, stdMat("#7a7a82", { rough: 0.9, flat: true }), 0.25, 1.1, 0.1); lid.rotation.y = 0.12;
  box(g, 0.2, 0.05, 1.2, basicMat("#7dff6a", 0.7, true), 0.25, 1.3, 0.1).rotation.y = 0.12;
  return { obj: g, colliders: [{ x: 0, z: -1, r: 1.2 }, { x: 0, z: 1, r: 1.2 }] };
}

function cryptGate(): Struct {
  const g = new THREE.Group();
  const st = stdMat("#4a4a52", { rough: 0.9, flat: true });
  box(g, 3, 14, 3, st, -9, 7, 0); box(g, 3, 14, 3, st, 9, 7, 0);
  add(g, mesh(new THREE.TorusGeometry(9, 1.4, 6, 18, Math.PI), st), 0, 14, 0);
  for (let i = 0; i < 7; i++) add(g, mesh(new THREE.ConeGeometry(0.4, 2.2, 5), st), -7.2 + i * 2.4, 17.4 - Math.abs(i - 3) * 0.2, 0);
  const rn: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) { const r = add(g, mesh(new THREE.PlaneGeometry(0.8, 2), basicMat("#7dff6a", 0.7, true)), -9, 3 + i * 2.4, 1.52); rn.push(r); const r2 = add(g, mesh(new THREE.PlaneGeometry(0.8, 2), basicMat("#7dff6a", 0.7, true)), 9, 3 + i * 2.4, 1.52); rn.push(r2); }
  return { obj: g, colliders: [{ x: -9, z: 0, r: 2.4 }, { x: 9, z: 0, r: 2.4 }], update: (t) => rn.forEach((r, i) => ((r.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2 + i) * 0.3)) };
}

function fence(): Struct {
  const g = new THREE.Group();
  box(g, 0.14, 1.1, 0.14, M.wood(), -1.0, 0.55, 0); box(g, 0.14, 1.1, 0.14, M.wood(), 1.0, 0.55, 0);
  box(g, 2.2, 0.1, 0.07, M.woodL(), 0, 0.85, 0); box(g, 2.2, 0.1, 0.07, M.woodL(), 0, 0.45, 0);
  return { obj: g, colliders: [{ x: 0, z: 0, r: 1.0 }] };
}

export function buildStructure(kind: string, s = 1): Struct | null {
  let r: Struct | null = null;
  switch (kind) {
    case "cottage": r = cottage(); break;
    case "windmill": r = windmill(); break;
    case "well": r = well(); break;
    case "campfire": r = campfire(); break;
    case "stall": r = stall(); break;
    case "watchtower": r = watchtower(); break;
    case "bridge": r = bridge(); break;
    case "dock": r = dock(); break;
    case "haystack": r = haystack(); break;
    case "garden": r = garden(); break;
    case "lamp": r = lamp(); break;
    case "banner": r = banner(); break;
    case "tent": r = tent(false); break;
    case "bigtent": r = tent(true); break;
    case "pyramid": r = pyramid(); break;
    case "obelisk": r = obelisk(); break;
    case "ruins": r = ruins(); break;
    case "bones": r = bones(); break;
    case "cave": r = caveEntrance(); break;
    case "stones": r = stones(); break;
    case "giantTree": r = giantTree(s); break;
    case "shrine": r = shrine(); break;
    case "pillar": r = pillar(); break;
    case "brazier": r = brazier(); break;
    case "throne": r = throne(); break;
    case "sarcophagus": r = sarcophagus(); break;
    case "cryptgate": r = cryptGate(); break;
    case "fence": r = fence(); break;
  }
  if (r && s !== 1 && kind !== "giantTree") { r.obj.scale.setScalar(s); r.colliders = r.colliders.map((c) => ({ ...c, r: c.r * s })); }
  return r;
}
void tube;
