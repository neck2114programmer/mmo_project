import * as THREE from "three";
import type { ClassId } from "../types";
import { assignT, basicMat, limb, mesh, sphere, stdMat, xform, lathe } from "./util";

export const TIER_PAL = [
  { metal: "#9a9ea8", trim: "#a1763d", glow: "#ffffff", blade: "#b9bec8", gem: "#c9d2e0" },
  { metal: "#bcc3d0", trim: "#cfa94a", glow: "#fff3b0", blade: "#dfe5f0", gem: "#5fe07a" },
  { metal: "#8fb4e8", trim: "#e8c867", glow: "#6fb4ff", blade: "#a8d4ff", gem: "#4da6ff" },
  { metal: "#b078e8", trim: "#ffd36a", glow: "#c070ff", blade: "#d9b0ff", gem: "#c06bff" },
  { metal: "#f0c050", trim: "#fff1a8", glow: "#ffcc40", blade: "#ffe9a0", gem: "#ffb347" },
  { metal: "#ff6a7a", trim: "#ffe9a0", glow: "#ff5070", blade: "#ff9aa8", gem: "#ff5a6e" },
];

export interface WeaponSet {
  right?: THREE.Group;
  left?: THREE.Group;
  back?: THREE.Group;
  update?: (t: number) => void;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const metalMat = (c: string, rough = 0.28) => stdMat(c, { rough, metal: 0.85 });
const glowMat = (c: string, ei = 1.4) => stdMat(c, { emissive: c, ei, rough: 0.3 });

function halo(color: string, size: number) {
  const sp = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), basicMat(color, 0.28, true));
  return sp;
}

function sword(t: number, long = 0.78, w = 0.075) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const grip = mesh(limb(0.017, 0.017, 0.17, 10), stdMat("#3b2a22", { rough: 0.8 }));
  grip.position.y = 0.09;
  g.add(grip);
  g.add(assignT(mesh(sphere(0.03), metalMat(P.trim)), { position: new THREE.Vector3(0, -0.1, 0) }));
  const guard = mesh(limb(0.014, 0.014, 0.22, 10), metalMat(P.trim));
  guard.rotation.z = Math.PI / 2;
  guard.position.set(0.11, 0.1, 0);
  g.add(guard);
  if (t >= 3) {
    for (const s of [-1, 1]) {
      const wing = new THREE.Shape();
      wing.moveTo(0, 0); wing.quadraticCurveTo(s * 0.1, 0.02, s * 0.14, 0.12); wing.quadraticCurveTo(s * 0.07, 0.07, 0, 0.04);
      g.add(assignT(mesh(extrude(wing, 0.012, 0.002), metalMat(P.trim)), { position: new THREE.Vector3(0, 0.1, 0) }));
    }
  }
  const len = long + t * 0.045;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, len * 0.88); sh.lineTo(0, len); sh.lineTo(w / 2, len * 0.88); sh.lineTo(w / 2, 0); sh.closePath();
  const blade = mesh(extrude(sh, 0.014, 0.004), metalMat(P.blade, 0.15));
  blade.position.y = 0.2;
  g.add(blade);
  const fuller = mesh(new THREE.BoxGeometry(0.012, len * 0.7, 0.018), t >= 2 ? glowMat(P.glow, 1.2) : metalMat("#7a808c"));
  fuller.position.set(0, 0.2 + len * 0.4, 0);
  g.add(fuller);
  if (t >= 2) { const h = halo(P.glow, 0.05); h.scale.set(1, len * 9, 0.6); h.position.y = 0.2 + len / 2; g.add(h); }
  return g;
}

function dagger(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  g.add(assignT(mesh(limb(0.014, 0.014, 0.11, 8), stdMat("#2a1f2e", { rough: 0.7 })), { position: new THREE.Vector3(0, 0.05, 0) }));
  const guard = mesh(limb(0.01, 0.01, 0.1, 8), metalMat(P.trim));
  guard.rotation.z = Math.PI / 2; guard.position.set(0.05, 0.06, 0); g.add(guard);
  const sh = new THREE.Shape();
  sh.moveTo(-0.025, 0); sh.quadraticCurveTo(-0.04, 0.2, 0.02, 0.36 + t * 0.02); sh.quadraticCurveTo(0.03, 0.2, 0.025, 0); sh.closePath();
  const blade = mesh(extrude(sh, 0.01, 0.003), metalMat(P.blade, 0.12));
  blade.position.y = 0.08; g.add(blade);
  if (t >= 2) { const h = halo(P.glow, 0.04); h.scale.set(0.8, 4.5, 0.6); h.position.y = 0.25; g.add(h); }
  g.add(assignT(mesh(sphere(0.016), glowMat(P.gem, 1.6)), { position: new THREE.Vector3(0, -0.01, 0) }));
  return g;
}

function axe(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const shaft = mesh(limb(0.024, 0.026, 1.3, 10), stdMat("#4a3426", { rough: 0.8 }));
  shaft.position.y = 0.95; g.add(shaft);
  for (let i = 0; i < 4; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.027, 0.007, 6, 12), metalMat(P.trim));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.2 + i * 0.18; g.add(ring);
  }
  const hs = new THREE.Shape();
  hs.moveTo(0.02, 0.2); hs.bezierCurveTo(0.1, 0.34, 0.3, 0.4, 0.4, 0.3); hs.bezierCurveTo(0.34, 0.2, 0.36, 0.0, 0.42, -0.12);
  hs.bezierCurveTo(0.3, -0.08, 0.1, -0.04, 0.02, -0.06); hs.closePath();
  const headGeo = extrude(hs, 0.03, 0.008);
  for (const s of [1, -1]) {
    const h = mesh(headGeo, metalMat(P.blade, 0.2));
    h.scale.x = s; h.position.y = 0.88; g.add(h);
  }
  if (t >= 2) for (const s of [1, -1]) {
    const e = halo(P.glow, 0.05); e.scale.set(2.5, 5, 0.5); e.position.set(s * 0.38, 0.95, 0); g.add(e);
  }
  const spike = mesh(new THREE.ConeGeometry(0.03, 0.2, 10), metalMat(P.trim)); spike.position.y = 1.72; g.add(spike);
  g.add(assignT(mesh(sphere(0.045), glowMat(P.gem, 1.4)), { position: new THREE.Vector3(0, 0.88, 0) }));
  return g;
}

function mace(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  g.add(assignT(mesh(limb(0.02, 0.022, 0.55, 8), stdMat("#4a3426", { rough: 0.8 })), { position: new THREE.Vector3(0, 0.42, 0) }));
  const head = mesh(sphere(0.085, 1, 1.2, 1), metalMat(P.metal)); head.position.y = 0.58; g.add(head);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const f = mesh(new THREE.ConeGeometry(0.03, 0.08, 6), metalMat(P.trim));
    f.position.set(Math.cos(a) * 0.09, 0.58, Math.sin(a) * 0.09);
    f.rotation.z = -Math.cos(a) * 1.4; f.rotation.x = Math.sin(a) * 1.4; g.add(f);
  }
  const top = mesh(new THREE.ConeGeometry(0.03, 0.1, 8), metalMat(P.trim)); top.position.y = 0.7; g.add(top);
  if (t >= 2) g.add(assignT(halo(P.glow, 0.11), { position: new THREE.Vector3(0, 0.58, 0) }));
  return g;
}

function towerShield(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const shape = (s: number) => {
    const sh = new THREE.Shape();
    const w = 0.34 * s, h = 0.58 * s;
    sh.moveTo(-w, h * 0.85); sh.quadraticCurveTo(0, h * 1.12, w, h * 0.85);
    sh.lineTo(w, 0); sh.quadraticCurveTo(w * 0.95, -h * 0.55, 0, -h);
    sh.quadraticCurveTo(-w * 0.95, -h * 0.55, -w, 0); sh.closePath();
    return sh;
  };
  const rim = mesh(extrude(shape(1.0), 0.05, 0.012), metalMat(P.metal, 0.25));
  const face = mesh(extrude(shape(0.88), 0.06, 0.01), stdMat("#2d4a7e", { rough: 0.5, metal: 0.2 }));
  face.position.z = 0.012;
  g.add(rim, face);
  const emblem = mesh(new THREE.BoxGeometry(0.1, 0.6, 0.03), metalMat(P.trim));
  const emblem2 = mesh(new THREE.BoxGeometry(0.46, 0.09, 0.03), metalMat(P.trim));
  emblem.position.set(0, 0, 0.065); emblem2.position.set(0, 0.12, 0.065);
  g.add(emblem, emblem2);
  const boss = mesh(sphere(0.09, 1, 1, 0.6), metalMat(P.metal, 0.2)); boss.position.set(0, 0.12, 0.08); g.add(boss);
  const gem = mesh(sphere(0.04), glowMat(P.gem, 1.6)); gem.position.set(0, 0.12, 0.115); g.add(gem);
  if (t >= 2) { const h = halo(P.glow, 0.5); h.scale.set(0.8, 1.2, 0.08); h.position.z = 0.06; g.add(h); }
  g.position.set(0, 0.0, 0.0);
  return g;
}

function staff(t: number, dark = false) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const gem = dark ? "#b25dff" : ["#4da6ff", "#5fe07a", "#7fd8ff", "#c06bff", "#ffcc4d", "#ff6a7a"][t];
  g.add(assignT(mesh(limb(0.022, 0.026, 1.7, 10), stdMat("#5a3c2a", { rough: 0.7 })), { position: new THREE.Vector3(0, 1.0, 0) }));
  const ring = mesh(new THREE.TorusGeometry(0.07 + t * 0.008, 0.012, 8, 20), metalMat(P.trim));
  ring.position.y = 1.2; g.add(ring);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const prong = mesh(new THREE.ConeGeometry(0.014, 0.2, 6), metalMat(P.trim));
    prong.position.set(Math.cos(a) * 0.07, 1.12, Math.sin(a) * 0.07);
    prong.rotation.z = -Math.cos(a) * 0.35; prong.rotation.x = Math.sin(a) * 0.35; g.add(prong);
  }
  const orb = new THREE.Group();
  const crystal = mesh(new THREE.OctahedronGeometry(0.07 + t * 0.006, 1), glowMat(gem, 1.8), false);
  crystal.scale.y = 1.4; orb.add(crystal);
  orb.add(halo(gem, 0.16));
  orb.position.y = 1.28; g.add(orb);
  const tops = [0, 1, 2].map((i) => {
    const s = mesh(sphere(0.012), glowMat(gem, 2), false); orb.add(s); return s;
  });
  g.add(assignT(mesh(limb(0.032, 0.026, 0.12, 8), metalMat(P.trim)), { position: new THREE.Vector3(0, -0.1, 0) }));
  (g as unknown as { __u: (t: number) => void }).__u = (tt: number) => {
    orb.position.y = 1.28 + Math.sin(tt * 2) * 0.015;
    crystal.rotation.y = tt * 1.5;
    tops.forEach((s, i) => s.position.set(Math.cos(tt * 2 + i * 2.1) * 0.15, Math.sin(tt * 3 + i) * 0.05, Math.sin(tt * 2 + i * 2.1) * 0.15));
  };
  return g;
}

function wand(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  g.add(assignT(mesh(limb(0.016, 0.02, 0.5, 8), stdMat("#2a1a36", { rough: 0.6, metal: 0.3 })), { position: new THREE.Vector3(0, 0.35, 0) }));
  const skull = mesh(sphere(0.06, 1, 1.05, 1), stdMat("#e8e4d6", { rough: 0.6 })); skull.position.y = 0.58; g.add(skull);
  for (const s of [-1, 1]) g.add(assignT(mesh(sphere(0.014), glowMat("#b25dff", 2)), { position: new THREE.Vector3(s * 0.022, 0.595, 0.05) }));
  const jaw = mesh(sphere(0.035, 1, 0.6, 1), stdMat("#d8d4c4", { rough: 0.6 })); jaw.position.set(0, 0.53, 0.025); g.add(jaw);
  g.add(assignT(halo("#b25dff", 0.12), { position: new THREE.Vector3(0, 0.6, 0) }));
  for (let i = 0; i < 3; i++) {
    const h = mesh(new THREE.ConeGeometry(0.013, 0.09, 6), metalMat(P.trim));
    const a = i * 2.1; h.position.set(Math.cos(a) * 0.05, 0.64, Math.sin(a) * 0.05); h.rotation.z = -Math.cos(a) * 0.5; h.rotation.x = Math.sin(a) * 0.5; g.add(h);
  }
  return g;
}

function tome(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const cover = mesh(new THREE.BoxGeometry(0.26, 0.05, 0.34), stdMat("#3a1250", { rough: 0.5 }));
  g.add(cover);
  const pages = mesh(new THREE.BoxGeometry(0.24, 0.036, 0.32), stdMat("#f4ead0", { rough: 0.9 }));
  g.add(pages);
  const spine = mesh(limb(0.03, 0.03, 0.34, 8), metalMat(P.trim)); spine.rotation.x = Math.PI / 2; spine.position.set(-0.13, 0, 0.17); g.add(spine);
  const rune = mesh(new THREE.TorusGeometry(0.06, 0.007, 6, 18), glowMat("#c070ff", 1.8), false);
  rune.rotation.x = Math.PI / 2; rune.position.y = 0.03; g.add(rune);
  const runeIn = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 3), glowMat("#c070ff", 1.8), false);
  runeIn.rotation.x = Math.PI / 2; runeIn.position.y = 0.03; g.add(runeIn);
  g.add(assignT(halo("#b25dff", 0.14), { position: new THREE.Vector3(0, 0.08, 0), scale: new THREE.Vector3(1, 0.6, 1) }));
  g.position.set(0, 0, 0);
  (g as unknown as { __u: (t: number) => void }).__u = (tt: number) => { rune.rotation.z = tt * 1.2; runeIn.rotation.z = -tt * 2; };
  return g;
}

function bow(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12 * 2 - 1; // -1..1
    pts.push(new THREE.Vector3(0, u * 0.62, -(u * u) * 0.2 + 0.1 * 0 + 0.0));
  }
  // лук изогнут: центр дальше от лучника (+z), концы ближе (-z)
  const curve = pts.map((p) => new THREE.Vector3(0, p.y, p.z + 0));
  const limbGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve), 24, 0.02, 8, false);
  const wood = mesh(limbGeo, stdMat(["#7a5a3a", "#8a6a3a", "#5a7a8a", "#6a4a8a", "#c9a24a", "#ff9a7a"][t], { rough: 0.45, metal: t > 2 ? 0.4 : 0 }));
  g.add(wood);
  const grip = mesh(limb(0.028, 0.028, 0.16, 8), stdMat("#2a1c14", { rough: 0.8 })); grip.position.y = 0.08; g.add(grip);
  for (const s of [-1, 1]) {
    const tip = mesh(sphere(0.022), metalMat(P.trim)); tip.position.set(0, s * 0.62, -0.2); g.add(tip);
  }
  const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 1.24, 4);
  const str = mesh(stringGeo, basicMat("#f1ead8"), false); str.position.set(0, 0, -0.2); g.add(str);
  if (t >= 2) { const h = halo(P.glow, 0.05); h.scale.set(0.7, 10, 3); h.position.set(0, 0, -0.04); g.add(h); }
  g.add(assignT(mesh(sphere(0.022), glowMat(P.gem, 1.5)), { position: new THREE.Vector3(0, 0.0, 0.1) }));
  return g;
}

function quiver(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  const body = mesh(limb(0.07, 0.06, 0.5, 10), stdMat("#5a3a22", { rough: 0.8 }));
  body.position.y = 0.25; g.add(body);
  const band = mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 14), metalMat(P.trim)); band.rotation.x = Math.PI / 2; band.position.y = 0.0; g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = mesh(limb(0.006, 0.006, 0.28, 4), stdMat("#d8c8a0")); a.position.set((i - 2) * 0.02, 0.5, (i % 2) * 0.02); a.rotation.z = (i - 2) * 0.06; g.add(a);
    const f = mesh(new THREE.ConeGeometry(0.02, 0.07, 4), stdMat(["#e04040", "#40a0e0", "#f0e040"][i % 3])); f.position.set((i - 2) * 0.026, 0.62, (i % 2) * 0.02); g.add(f);
  }
  return g;
}

function crook(t: number) {
  const P = TIER_PAL[t];
  const g = new THREE.Group();
  g.add(assignT(mesh(limb(0.024, 0.028, 1.5, 8), stdMat("#6a4a2a", { rough: 0.8 })), { position: new THREE.Vector3(0, 0.95, 0) }));
  const arc = mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 18, Math.PI * 1.3), stdMat("#6a4a2a", { rough: 0.8 }));
  arc.position.set(0.08, 1.02, 0); arc.rotation.z = 0.4; g.add(arc);
  const gem = mesh(sphere(0.045), glowMat(["#6dff9c", "#5fe07a", "#7dffef", "#c06bff", "#ffcc4d", "#ff7a6e"][t], 1.6)); gem.position.set(0.0, 1.05, 0); g.add(gem);
  g.add(assignT(halo("#6dff9c", 0.12), { position: new THREE.Vector3(0, 1.05, 0) }));
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.22), new THREE.MeshStandardMaterial({ color: ["#e04040", "#40c0e0", "#f0e040"][i], side: THREE.DoubleSide, roughness: 0.7 }));
    f.position.set(-0.03, 0.78 - i * 0.04, 0.02 * i); f.rotation.z = 0.15 + i * 0.1; g.add(f);
  }
  const bead = mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 10), metalMat(P.trim)); bead.rotation.x = Math.PI / 2; bead.position.y = 0.9; g.add(bead);
  return g;
}

export function buildWeapon(cls: ClassId, tier: number): WeaponSet {
  const t = Math.max(0, Math.min(5, tier));
  const set: WeaponSet = {};
  const ups: ((t: number) => void)[] = [];
  const hook = (g: THREE.Group) => { const u = (g as unknown as { __u?: (t: number) => void }).__u; if (u) ups.push(u); return g; };
  switch (cls) {
    case "warrior": set.right = sword(t); break;
    case "assassin": set.right = dagger(t); set.left = dagger(t); break;
    case "mage": set.right = hook(staff(t)); break;
    case "sorcerer": set.right = wand(t); set.left = hook(tome(t)); break;
    case "shieldbearer": set.right = mace(t); set.left = towerShield(t); break;
    case "archer": set.left = bow(t); set.back = quiver(t); break;
    case "berserker": set.right = axe(t); break;
    case "tamer": set.right = crook(t); break;
  }
  if (ups.length) set.update = (tt) => ups.forEach((u) => u(tt));
  return set;
}
void xform; void lathe; 
