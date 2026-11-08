import * as THREE from "three";
import type { MobDef } from "../data/world";
import { CharacterModel } from "./character";
import { DEFAULT_APP } from "./appearance";
import { basicMat, blobGeo, lathe, limb, mesh, sphere, stdMat, tube } from "./util";

export interface Creature {
  group: THREE.Group;
  height: number;
  radius: number;
  tick(dt: number, speed: number, t: number): void;
  attack(): void;
  setDead(d: boolean): void;
  humanoid?: CharacterModel;
  flying?: number;
  setOpacity?(o: number): void;
}

const add = <T extends THREE.Object3D>(p: THREE.Object3D, c: T, x = 0, y = 0, z = 0): T => { c.position.set(x, y, z); p.add(c); return c; };
const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => add(p, new THREE.Group(), x, y, z);
const eyeMat = (c: string) => basicMat(c);
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

class Base implements Creature {
  group = new THREE.Group();
  inner = new THREE.Group();
  height = 1;
  radius = 0.5;
  attackT = 0;
  dead = 0;
  deadTarget = false;
  flying?: number;
  constructor() { this.group.add(this.inner); }
  tick(dt: number, speed: number, t: number) {
    this.attackT = Math.max(0, this.attackT - dt * 2.2);
    this.dead += ((this.deadTarget ? 1 : 0) - this.dead) * Math.min(1, dt * 6);
    this.inner.position.z = Math.sin(this.attackT * Math.PI) * 0.5;
    this.inner.rotation.z = this.dead * 1.4;
    this.inner.position.y = this.dead * 0.25 + (this.flying ? this.flying + Math.sin(t * 2) * 0.12 : 0);
    this.anim(dt, speed, t);
  }
  anim(_dt: number, _speed: number, _t: number) { void _dt; void _speed; void _t; }
  attack() { this.attackT = 1; }
  setDead(d: boolean) { this.deadTarget = d; }
}

function leg(parent: THREE.Object3D, x: number, y: number, z: number, len: number, r: number, mat: THREE.Material, paw = true) {
  const up = grp(parent, x, y, z);
  add(up, mesh(limb(r * 1.2, r, len), mat));
  const low = grp(up, 0, -len, 0);
  add(low, mesh(limb(r, r * 0.7, len), mat));
  if (paw) add(low, mesh(sphere(r * 1.1, 1, 0.7, 1.5), mat), 0, -len, r * 0.6);
  return { up, low };
}

interface QCfg { fur: string; belly: string; snout: number; ears: number; tail: "bushy" | "short" | "thin"; tusks?: boolean; bristle?: boolean; eye: string; stocky: number; glow?: boolean; spikes?: boolean; headSize?: number; legLen?: number; antlers?: boolean }
class Quadruped extends Base {
  legs: { up: THREE.Object3D; low: THREE.Object3D }[] = [];
  tail: THREE.Object3D[] = [];
  head: THREE.Object3D;
  ph = 0;
  constructor(c: QCfg) {
    super();
    const fur = stdMat(c.fur, { rough: 0.9, emissive: c.glow ? c.fur : "#000", ei: c.glow ? 0.15 : 0 });
    const belly = stdMat(c.belly, { rough: 0.9 });
    const dark = stdMat("#1a1416", { rough: 0.6 });
    const L = c.legLen ?? 0.24;
    const by = L * 2 + 0.1;
    const st = c.stocky;
    const body = grp(this.inner, 0, by, 0);
    add(body, mesh(sphere(0.3, 0.9 * st, 0.85, 1.55, 20), fur));
    add(body, mesh(sphere(0.27, 0.95 * st, 0.95, 1), fur), 0, 0.03, 0.3);
    add(body, mesh(sphere(0.25, 0.9 * st, 0.85, 1), fur), 0, 0, -0.28);
    add(body, mesh(sphere(0.25, 0.85 * st, 0.6, 1.5), belly), 0, -0.1, 0.02);
    if (c.bristle) for (let i = 0; i < 9; i++) add(body, mesh(new THREE.ConeGeometry(0.03, 0.12, 5), dark), 0, 0.3 - Math.abs(i - 4) * 0.012, 0.35 - i * 0.09);
    if (c.spikes) for (let i = 0; i < 7; i++) add(body, mesh(new THREE.ConeGeometry(0.025, 0.16, 5), stdMat("#d8d2bc")), 0, 0.28, 0.3 - i * 0.1).rotation.x = -0.2;
    const neck = grp(body, 0, 0.1, 0.45);
    add(neck, mesh(limb(0.14, 0.12, 0.2), fur), 0, 0, 0.0).rotation.x = -1.0;
    const head = grp(body, 0, 0.2, 0.68);
    this.head = head;
    const hs = c.headSize ?? 1;
    add(head, mesh(sphere(0.16 * hs, 1, 0.95, 1.1), fur));
    add(head, mesh(sphere(0.1 * hs, 0.8, 0.7, c.snout), fur), 0, -0.04, 0.14 * hs);
    add(head, mesh(sphere(0.03, 1, 0.8, 1), dark), 0, -0.02, 0.14 * hs + 0.1 * c.snout * hs);
    add(head, mesh(sphere(0.08 * hs, 0.8, 0.4, c.snout * 0.9), belly), 0, -0.1, 0.12 * hs);
    for (const s of [-1, 1]) {
      add(head, mesh(sphere(0.026), eyeMat(c.eye)), s * 0.075 * hs, 0.04, 0.115 * hs);
      const e = add(head, mesh(new THREE.ConeGeometry(0.05 * c.ears, 0.14 * c.ears, 5), fur), s * 0.08 * hs, 0.16 * hs, -0.03);
      e.rotation.z = -s * 0.25; e.scale.z = 0.5;
      if (c.tusks) { const tk = add(head, mesh(new THREE.ConeGeometry(0.02, 0.14, 6), stdMat("#efe8d0")), s * 0.06, -0.1, 0.2); tk.rotation.x = -0.6; tk.rotation.z = s * 0.3; }
      if (c.antlers) {
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.05, 0.1, 0), new THREE.Vector3(s * 0.1, 0.22, 0.02)];
        add(head, mesh(tube(pts, 0.01, 0.005, 6, 5), stdMat("#6a5a3a")), s * 0.06, 0.14, -0.03);
      }
    }
    // ноги
    const px = 0.17 * st;
    this.legs = [leg(body, px, -0.08, 0.32, L, 0.055, fur), leg(body, -px, -0.08, 0.32, L, 0.055, fur), leg(body, px, -0.08, -0.3, L, 0.06, fur), leg(body, -px, -0.08, -0.3, L, 0.06, fur)];
    // хвост
    let tp: THREE.Object3D = grp(body, 0, 0.1, -0.5);
    const tn = c.tail === "bushy" ? 5 : c.tail === "short" ? 2 : 4;
    for (let i = 0; i < tn; i++) {
      const r = c.tail === "bushy" ? 0.07 - Math.abs(i - 2) * 0.008 : c.tail === "short" ? 0.04 : 0.03;
      add(tp, mesh(sphere(r, 1, 1, 1.6, 10), i === tn - 1 && c.tail === "bushy" ? stdMat("#f0f0f0", { rough: 0.9 }) : fur), 0, -i * 0.01, -r * 1.2);
      const nx = grp(tp, 0, 0, -r * 2.3); this.tail.push(nx); tp = nx;
    }
    this.tail[0].parent!.rotation.x = 0.5;
    this.height = 1.0; this.radius = 0.6;
    this.inner.scale.setScalar(1);
  }
  anim(dt: number, speed: number, t: number) {
    this.ph += dt * (3 + speed * 9);
    const s = clampN(speed, 0, 1.2);
    const a = Math.sin(this.ph) * 0.8 * s;
    const [fl, fr, bl, br] = this.legs;
    fl.up.rotation.x = a; br.up.rotation.x = a; fr.up.rotation.x = -a; bl.up.rotation.x = -a;
    fl.low.rotation.x = Math.max(0, -Math.cos(this.ph)) * 0.9 * s; br.low.rotation.x = fl.low.rotation.x;
    fr.low.rotation.x = Math.max(0, Math.cos(this.ph)) * 0.9 * s; bl.low.rotation.x = fr.low.rotation.x;
    this.inner.children[0].position.y = 0.58 + Math.abs(Math.sin(this.ph)) * 0.03 * s + Math.sin(t * 2) * 0.004;
    this.head.rotation.x = Math.sin(this.attackT * Math.PI) * 0.5 - 0.1 + Math.sin(t * 1.3) * 0.03;
    this.tail.forEach((tl, i) => { tl.rotation.y = Math.sin(t * (3 + s * 3) - i * 0.6) * 0.3; });
  }
}

class Slime extends Base {
  body: THREE.Mesh;
  constructor(tint: string) {
    super();
    const m = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.1, transmission: 0.0, transparent: true, opacity: 0.82, emissive: tint, emissiveIntensity: 0.22, clearcoat: 1 });
    this.body = add(this.inner, mesh(blobGeo(0.5, 3, 0.04, 3, 0.78), m), 0, 0.4, 0);
    add(this.inner, mesh(sphere(0.2, 1, 0.9, 1), stdMat(new THREE.Color(tint).multiplyScalar(0.45), { rough: 0.4 })), 0, 0.36, -0.05);
    for (const s of [-1, 1]) {
      add(this.inner, mesh(sphere(0.07, 1, 1.2, 0.6), basicMat("#ffffff")), s * 0.17, 0.5, 0.4);
      add(this.inner, mesh(sphere(0.035), basicMat("#101018")), s * 0.17, 0.5, 0.45);
    }
    add(this.inner, mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 10, Math.PI), basicMat("#203020")), 0, 0.38, 0.46).rotation.z = Math.PI;
    this.height = 0.9; this.radius = 0.5;
  }
  anim(_d: number, speed: number, t: number) {
    const hop = Math.abs(Math.sin(t * (3 + speed * 3)));
    const sq = 1 + (speed > 0.05 ? (hop - 0.5) * 0.25 : Math.sin(t * 2) * 0.03);
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.body.position.y = 0.4 + (speed > 0.05 ? hop * 0.2 : 0);
  }
}

class Arthro extends Base {
  legs: THREE.Object3D[] = [];
  tail: THREE.Object3D[] = [];
  spider: boolean;
  ph = 0;
  constructor(spider: boolean, tint: string) {
    super();
    this.spider = spider;
    const shell = stdMat(tint, { rough: 0.45, metal: 0.15 });
    const dark = stdMat(new THREE.Color(tint).multiplyScalar(0.55), { rough: 0.5 });
    const body = grp(this.inner, 0, spider ? 0.45 : 0.28, 0);
    if (spider) {
      add(body, mesh(sphere(0.34, 1, 0.9, 1.2), shell), 0, 0.1, -0.4);
      add(body, mesh(sphere(0.2, 1, 0.8, 1), dark), 0, 0.02, 0.05);
      add(body, mesh(sphere(0.16, 1, 0.9, 1), shell), 0, 0.03, 0.28);
      for (let i = 0; i < 6; i++) add(body, mesh(sphere(0.022), basicMat(i < 2 ? "#ff3030" : "#ffb030")), ((i % 3) - 1) * 0.05, 0.1 + (i < 3 ? 0.02 : 0), 0.4);
      for (const s of [-1, 1]) add(body, mesh(new THREE.ConeGeometry(0.02, 0.12, 5), stdMat("#e8e0d0")), s * 0.04, -0.05, 0.4).rotation.x = Math.PI - 0.3;
      add(body, mesh(sphere(0.12, 1.4, 0.4, 0.8), basicMat("#ff4040", 0.7, true)), 0, 0.3, -0.45);
    } else {
      add(body, mesh(sphere(0.3, 1, 0.55, 1.4), shell), 0, 0.05, 0.0);
      add(body, mesh(sphere(0.2, 1, 0.5, 0.9), dark), 0, 0.02, 0.38);
      for (const s of [-1, 1]) add(body, mesh(sphere(0.02), basicMat("#ff4020")), s * 0.07, 0.12, 0.5);
      for (let i = 0; i < 3; i++) add(body, mesh(sphere(0.2 - i * 0.02, 1, 0.5, 0.7), i % 2 ? dark : shell), 0, 0.05, -0.28 - i * 0.2);
      // клешни
      for (const s of [-1, 1]) {
        const arm = grp(body, s * 0.25, 0.05, 0.45);
        arm.rotation.y = -s * 0.5;
        add(arm, mesh(limb(0.05, 0.045, 0.3), shell), 0, 0, 0).rotation.x = -Math.PI / 2;
        const c = grp(arm, 0, 0, 0.42);
        add(c, mesh(sphere(0.09, 0.8, 0.55, 1.4), shell));
        add(c, mesh(new THREE.ConeGeometry(0.04, 0.16, 5), dark), s * 0.04, 0, 0.14).rotation.x = Math.PI / 2;
        add(c, mesh(new THREE.ConeGeometry(0.04, 0.16, 5), dark), -s * 0.04, 0, 0.14).rotation.x = Math.PI / 2;
        this.legs.push(arm);
      }
      // хвост
      let tp: THREE.Object3D = grp(body, 0, 0.05, -0.85);
      for (let i = 0; i < 6; i++) {
        add(tp, mesh(sphere(0.1 - i * 0.008, 1, 1, 1.15), shell), 0, 0.0, 0);
        const nx = grp(tp, 0, 0.08, -0.04); nx.rotation.x = -0.55; this.tail.push(nx); tp = nx;
        if (i === 5) { add(tp, mesh(new THREE.ConeGeometry(0.04, 0.2, 6), stdMat("#2a1a14")), 0, 0.1, 0.0).rotation.x = 0.5; add(tp, mesh(sphere(0.04), basicMat("#b8ff40")), 0, 0.2, 0.06); }
      }
      this.tail[0].parent!.rotation.x = -0.1;
    }
    const n = spider ? 4 : 4;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const pivot = grp(body, s * 0.12, spider ? 0.0 : 0.0, spider ? 0.2 - i * 0.12 : 0.22 - i * 0.14);
      pivot.rotation.y = s * (0.5 + i * 0.35 - 0.4) + (s > 0 ? 0 : Math.PI) * 0;
      const L1 = spider ? 0.5 : 0.28, L2 = spider ? 0.7 : 0.3;
      const up = grp(pivot, 0, 0, 0); up.rotation.z = -s * (spider ? 0.9 : 0.6);
      add(up, mesh(limb(0.03, 0.025, L1), dark), 0, 0, 0).rotation.z = s * Math.PI / 2;
      up.children[0].position.x = s * L1 * 0.0;
      const low = grp(up, s * L1, 0, 0); low.rotation.z = s * (spider ? 1.9 : 1.6);
      add(low, mesh(limb(0.025, 0.012, L2), shell), 0, 0, 0);
      (pivot as THREE.Object3D & { __s?: number }).__s = s * (i % 2 ? 1 : -1);
      this.legs.push(pivot);
    }
    this.height = spider ? 0.8 : 0.6; this.radius = 0.8;
  }
  anim(dt: number, speed: number, t: number) {
    this.ph += dt * (4 + speed * 10);
    const s = clampN(speed, 0, 1.2);
    this.legs.forEach((l, i) => {
      const sg = (l as THREE.Object3D & { __s?: number }).__s;
      if (sg === undefined) { l.rotation.y = (i === 0 ? -1 : 1) * (0.5 + Math.sin(t * 2 + i) * 0.1) + Math.sin(this.attackT * 3) * 0.3; return; }
      l.rotation.x = Math.sin(this.ph + i * 1.6) * 0.3 * s + Math.sin(t * 1.5 + i) * 0.02;
    });
    this.tail.forEach((tl, i) => { tl.rotation.x = -0.55 + Math.sin(t * 2 - i * 0.4) * 0.07 - (this.attackT > 0.3 ? 0.4 * this.attackT : 0); });
    this.inner.position.y += Math.sin(this.ph * 2) * 0.01 * s;
  }
}

class Cobra extends Base {
  segs: THREE.Object3D[] = [];
  constructor(tint: string) {
    super();
    const m = stdMat(tint, { rough: 0.4, metal: 0.1 });
    const belly = stdMat("#e8d8a8", { rough: 0.6 });
    let p: THREE.Object3D = grp(this.inner, 0, 0.1, -0.7);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const r = 0.1 - (i / n) * 0.03 + (i > n - 4 ? 0.01 : 0);
      add(p, mesh(sphere(r, 1, 1, 1.3, 12), i % 3 === 0 ? belly : m), 0, 0, 0);
      const nx = grp(p, 0, i > 6 ? 0.1 : 0, i > 6 ? 0.04 : 0.17);
      nx.rotation.x = i > 5 ? -0.28 : 0;
      this.segs.push(nx); p = nx;
    }
    const head = grp(p, 0, 0.05, 0.05);
    const hood = add(head, mesh(sphere(0.17, 1, 1.3, 0.35), m), 0, -0.05, -0.05);
    add(head, mesh(sphere(0.07, 1, 0.8, 1.3), m), 0, 0.0, 0.1);
    for (const s of [-1, 1]) add(head, mesh(sphere(0.018), basicMat("#ffe030")), s * 0.045, 0.03, 0.14);
    add(head, mesh(new THREE.ConeGeometry(0.01, 0.08, 4), basicMat("#c02050")), 0, -0.03, 0.22).rotation.x = Math.PI / 2;
    add(hood, mesh(new THREE.CircleGeometry(0.06, 8), basicMat("#e8d8a8")), 0, -0.02, 0.1);
    this.height = 1.0; this.radius = 0.5;
  }
  anim(_d: number, speed: number, t: number) {
    this.segs.forEach((s, i) => { s.rotation.y = Math.sin(t * (2 + speed * 4) - i * 0.6) * (0.25 + speed * 0.2); });
  }
}

class Golem extends Base {
  arms: THREE.Object3D[] = [];
  legsG: THREE.Object3D[] = [];
  ph = 0;
  constructor(tint: string, glow = "#ffb040") {
    super();
    const rock = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.95, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.7), roughness: 1, flatShading: true });
    const torso = grp(this.inner, 0, 1.0, 0);
    add(torso, mesh(blobGeo(0.5, 1, 0.22, 5, 1.1), rock));
    add(torso, mesh(blobGeo(0.34, 1, 0.2, 6, 0.9), dark), 0, 0.3, 0.2);
    add(torso, mesh(sphere(0.12, 1, 1.4, 0.4), basicMat(glow, 0.9, true)), 0, 0.05, 0.43);
    const head = grp(torso, 0, 0.65, 0.05);
    add(head, mesh(blobGeo(0.22, 1, 0.15, 8), rock));
    for (const s of [-1, 1]) add(head, mesh(sphere(0.04, 1.4, 0.7, 0.5), basicMat(glow)), s * 0.09, 0.02, 0.2);
    for (const s of [-1, 1]) {
      const arm = grp(torso, s * 0.6, 0.3, 0);
      add(arm, mesh(blobGeo(0.2, 1, 0.2, 9 + s, 1.5), rock), 0, -0.1, 0);
      const fore = grp(arm, 0, -0.45, 0);
      add(fore, mesh(blobGeo(0.28, 1, 0.22, 11 + s, 1.0), dark), 0, -0.25, 0);
      this.arms.push(arm);
      const lg = grp(this.inner, s * 0.3, 0.7, 0);
      add(lg, mesh(blobGeo(0.24, 1, 0.2, 13 + s, 1.5), rock), 0, -0.25, 0);
      add(lg, mesh(blobGeo(0.2, 1, 0.2, 15 + s, 0.8), dark), 0, -0.62, 0.06);
      this.legsG.push(lg);
    }
    this.height = 2.2; this.radius = 0.9;
  }
  anim(dt: number, speed: number, t: number) {
    this.ph += dt * (2 + speed * 4);
    const s = clampN(speed, 0, 1);
    this.legsG[0].rotation.x = Math.sin(this.ph) * 0.5 * s; this.legsG[1].rotation.x = -Math.sin(this.ph) * 0.5 * s;
    this.arms[0].rotation.x = -Math.sin(this.ph) * 0.4 * s - Math.sin(this.attackT * Math.PI) * 2.0;
    this.arms[1].rotation.x = Math.sin(this.ph) * 0.4 * s - Math.sin(this.attackT * Math.PI) * 2.0;
    this.inner.children[0].position.y = 1.0 + Math.abs(Math.sin(this.ph)) * 0.06 * s + Math.sin(t * 1.5) * 0.01;
  }
}

class Ent extends Base {
  arms: THREE.Object3D[] = [];
  canopy: THREE.Object3D;
  constructor(ancient: boolean) {
    super();
    const bark = stdMat("#5a4026", { rough: 1 });
    const bark2 = stdMat("#6d4f2d", { rough: 1 });
    const leafC = ancient ? "#2e7a3a" : "#3f8f3a";
    const trunk = grp(this.inner, 0, 0, 0);
    const prof: [number, number][] = [[0.34, 0], [0.38, 0.1], [0.3, 0.6], [0.34, 1.2], [0.38, 1.7], [0.34, 2.0], [0.2, 2.2]];
    const tg = lathe(prof, 14);
    const pp = tg.attributes.position;
    for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getZ(i), pp.getX(i)); const k = 1 + Math.sin(a * 5 + pp.getY(i) * 3) * 0.07; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
    tg.computeVertexNormals();
    add(trunk, mesh(tg, bark), 0, 0.5, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const root = add(trunk, mesh(limb(0.13, 0.06, 0.7), bark2), Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3);
      root.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    }
    const face = grp(trunk, 0, 1.9, 0.33);
    for (const s of [-1, 1]) {
      add(face, mesh(sphere(0.09, 1.2, 0.8, 0.5), stdMat("#241608")), s * 0.14, 0, 0);
      add(face, mesh(sphere(0.045, 1.3, 0.8, 0.5), basicMat(ancient ? "#ffe060" : "#9dff5a")), s * 0.14, 0, 0.04);
      add(face, mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), bark2), s * 0.14, 0.12, 0.0).rotation.z = s * 0.3;
    }
    add(face, mesh(sphere(0.07, 1.3, 0.6, 0.6), stdMat("#241608")), 0, -0.2, 0.0);
    add(face, mesh(new THREE.ConeGeometry(0.06, 0.2, 5), bark2), 0, -0.07, 0.04).rotation.x = Math.PI / 2 + 0.2;
    for (const s of [-1, 1]) {
      const sh = grp(trunk, s * 0.4, 1.9, 0);
      const arm = grp(sh, 0, 0, 0);
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.2, -0.3, 0.1), new THREE.Vector3(s * 0.3, -0.8, 0.2), new THREE.Vector3(s * 0.2, -1.2, 0.4)];
      add(arm, mesh(tube(pts, 0.14, 0.08, 12, 8), bark2));
      for (let i = 0; i < 3; i++) add(arm, mesh(limb(0.04, 0.015, 0.3), bark), s * 0.2 + (i - 1) * 0.06, -1.2, 0.4 + i * 0.03).rotation.x = -0.8 + i * 0.1;
      add(arm, mesh(blobGeo(0.2, 1, 0.25, 21 + s, 0.8), stdMat(leafC, { rough: 0.9 })), s * 0.3, -0.3, 0.1);
      this.arms.push(sh);
    }
    this.canopy = grp(trunk, 0, 2.3, 0);
    const leaf = stdMat(leafC, { rough: 0.9 });
    const leaf2 = stdMat(ancient ? "#4fb050" : "#68b04a", { rough: 0.9 });
    const n = ancient ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      add(this.canopy, mesh(blobGeo(0.5 + (i % 2) * 0.12, 2, 0.25, 30 + i, 0.8), i % 2 ? leaf2 : leaf), Math.cos(a) * 0.45, 0.1 + (i % 3) * 0.15, Math.sin(a) * 0.45);
    }
    add(this.canopy, mesh(blobGeo(0.6, 2, 0.25, 40, 0.8), leaf2), 0, 0.5, 0);
    if (ancient) {
      for (let i = 0; i < 6; i++) { const a = i * 1.1; add(trunk, mesh(sphere(0.07, 1, 0.5, 1), basicMat("#a8ff70", 0.9, true)), Math.cos(a) * 0.36, 0.7 + i * 0.25, Math.sin(a) * 0.36); }
      for (let i = 0; i < 4; i++) { const m = add(trunk, mesh(new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), stdMat("#e04040")), Math.cos(i * 1.6) * 0.35, 1.0 + i * 0.3, Math.sin(i * 1.6) * 0.35); m.rotation.x = 1.2; }
    }
    this.height = 2.9; this.radius = 0.9;
  }
  anim(_d: number, speed: number, t: number) {
    this.canopy.rotation.z = Math.sin(t * 1.2) * 0.03;
    this.arms[0].rotation.x = Math.sin(t * 1.5) * 0.08 - Math.sin(this.attackT * Math.PI) * 1.8 + (speed > 0.05 ? Math.sin(t * 5) * 0.2 : 0);
    this.arms[1].rotation.x = Math.sin(t * 1.5 + 1) * 0.08 - Math.sin(this.attackT * Math.PI) * 1.8 - (speed > 0.05 ? Math.sin(t * 5) * 0.2 : 0);
    this.inner.rotation.x = speed > 0.05 ? Math.sin(t * 5) * 0.03 : 0;
    this.inner.position.y += speed > 0.05 ? Math.abs(Math.sin(t * 5)) * 0.06 : 0;
  }
}

class Wisp extends Base {
  tails: THREE.Object3D[] = [];
  orbs: THREE.Object3D[] = [];
  constructor(tint: string) {
    super();
    this.flying = 1.2;
    add(this.inner, mesh(sphere(0.2, 1, 1, 1), basicMat("#ffffff", 0.95)), 0, 0.3, 0);
    add(this.inner, mesh(sphere(0.32, 1, 1, 1), basicMat(tint, 0.35, true)), 0, 0.3, 0);
    add(this.inner, mesh(sphere(0.55, 1, 1, 1), basicMat(tint, 0.12, true)), 0, 0.3, 0);
    for (let i = 0; i < 5; i++) {
      const t = add(this.inner, mesh(new THREE.ConeGeometry(0.1 - i * 0.012, 0.5, 8), basicMat(tint, 0.3 - i * 0.04, true)), 0, 0.1 - i * 0.2, -0.06 * i);
      t.rotation.x = Math.PI; this.tails.push(t);
    }
    for (let i = 0; i < 4; i++) { const o = add(this.inner, mesh(sphere(0.05), basicMat(tint, 0.9, true)), 0, 0.3, 0); this.orbs.push(o); }
    this.height = 1.2; this.radius = 0.5;
  }
  anim(_d: number, _s: number, t: number) {
    this.orbs.forEach((o, i) => o.position.set(Math.cos(t * 2.5 + i * 1.6) * 0.5, 0.3 + Math.sin(t * 3 + i) * 0.2, Math.sin(t * 2.5 + i * 1.6) * 0.5));
    this.tails.forEach((tl, i) => { tl.position.x = Math.sin(t * 3 - i * 0.7) * 0.08; });
  }
}

class Ghost extends Base {
  mats: THREE.MeshBasicMaterial[] = [];
  constructor(tint: string) {
    super();
    this.flying = 0.5;
    const m = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.mats.push(m);
    const cloak = mesh(lathe([[0.0, 0.0], [0.06, 0.0], [0.2, 0.2], [0.34, 0.5], [0.3, 0.9], [0.24, 1.2], [0.26, 1.45], [0.17, 1.62], [0.0, 1.65]].map(([r, y]) => [r, y] as [number, number]), 14), m, false);
    cloak.scale.z = 0.8; add(this.inner, cloak, 0, 0.2, 0);
    for (const s of [-1, 1]) {
      add(this.inner, mesh(sphere(0.045, 1, 1.5, 0.6), basicMat("#001018")), s * 0.08, 1.6, 0.17);
      add(this.inner, mesh(sphere(0.02), basicMat("#ffffff")), s * 0.08, 1.6, 0.2);
      const arm = add(this.inner, mesh(limb(0.06, 0.02, 0.55), m, false), s * 0.3, 1.45, 0.05); arm.rotation.set(-1.0, 0, s * 0.5);
    }
    add(this.inner, mesh(sphere(0.07, 1, 1.6, 0.5), basicMat("#001018")), 0, 1.45, 0.19);
    add(this.inner, mesh(sphere(0.5, 1, 2, 1), basicMat(tint, 0.1, true)), 0, 1.0, 0);
    this.height = 1.9; this.radius = 0.6;
  }
  anim(_d: number, _s: number, t: number) {
    this.inner.scale.set(1 + Math.sin(t * 2) * 0.03, 1 + Math.sin(t * 2.7) * 0.04, 1);
    this.mats[0].opacity = 0.5 + Math.sin(t * 1.7) * 0.1;
  }
}

class Humanoid extends Base {
  model: CharacterModel;
  constructor(def: MobDef) {
    super();
    const v = def.variant ?? "bandit";
    const app = { ...DEFAULT_APP, mark: v === "bandit" ? 1 : 0 };
    const common = { gender: "male" as const, armorTier: 0, head: true };
    let m: CharacterModel;
    switch (v) {
      case "skeleton": m = new CharacterModel({ ...common, cls: "warrior", app: { ...app, skin: "#e8e2cf" }, bone: true, cloth: "#4a3a30", weaponTier: 0, armorTier: 0, eyeGlow: "#8cff7a" }); break;
      case "mummy": m = new CharacterModel({ ...common, cls: "assassin", app: { ...app, skin: "#cdbf9a" }, wraps: true, cloth: "#d9cfae", cloth2: "#b8a878", weaponTier: 1, head: false, eyeGlow: "#ffd040" }); break;
      case "druid": m = new CharacterModel({ ...common, cls: "tamer", app: { ...app, skin: "#8fa089", hair: 3, hairColor: "#2a4a2a" }, cloth: "#2a3f2a", cloth2: "#7a4a9a", weaponTier: 3, antlers: true, head: false }); break;
      case "bonemage": m = new CharacterModel({ ...common, cls: "mage", app: { ...app, skin: "#e8e2cf" }, bone: true, cloth: "#3a2250", cloth2: "#8a40c0", weaponTier: 3, armorTier: 2, eyeGlow: "#c070ff" }); break;
      case "boneknight": m = new CharacterModel({ ...common, cls: "warrior", app: { ...app, skin: "#d8d2bc" }, bone: true, cloth: "#1c1c26", cloth2: "#5a1a2a", weaponTier: 4, armorTier: 3, eyeGlow: "#ff4040", helm: true }); break;
      case "lich": m = new CharacterModel({ ...common, cls: "sorcerer", app: { ...app, skin: "#cfd2c0" }, bone: true, cloth: "#14301c", cloth2: "#2a8a40", weaponTier: 5, armorTier: 5, eyeGlow: "#7dff6a" }); break;
      default: m = new CharacterModel({ ...common, cls: "assassin", app: { ...app, hair: 5, hairColor: "#3a2418", skin: "#d9a67c" }, cloth: "#5a4630", cloth2: "#8a2a2a", weaponTier: 0, head: true }); break;
    }
    this.model = m;
    this.inner.add(m.group);
    this.height = 1.9 * m.heightScale; this.radius = 0.5;
    if (v === "lich") this.flying = 0.25;
  }
  tick(dt: number, speed: number, t: number) {
    this.model.setSpeed(speed);
    this.model.update(dt);
    this.dead += ((this.deadTarget ? 1 : 0) - this.dead) * Math.min(1, dt * 6);
    this.model.setDead(this.deadTarget);
    if (this.flying) this.inner.position.y = this.flying + Math.sin(t * 2) * 0.1;
  }
  attack() { this.model.play(Math.random() < 0.5 ? "slash" : "slash2", 0.6); }
}

export function buildCreature(def: MobDef): Creature {
  let c: Base;
  const tint = def.tint ?? "#888888";
  switch (def.model) {
    case "slime": c = new Slime(tint); break;
    case "wolf": c = def.variant === "hound"
      ? new Quadruped({ fur: tint, belly: "#7aa07e", snout: 1.5, ears: 0.9, tail: "thin", eye: "#ff4040", stocky: 0.95, glow: true, spikes: true })
      : new Quadruped({ fur: tint, belly: "#d8d8d8", snout: 1.4, ears: 1, tail: "bushy", eye: "#ffd040", stocky: 0.95 }); break;
    case "boar": c = new Quadruped({ fur: tint, belly: "#a07a5a", snout: 1.0, ears: 0.8, tail: "short", eye: "#ff6030", stocky: 1.2, tusks: true, bristle: true, headSize: 1.15, legLen: 0.2 }); break;
    case "scorpion": c = new Arthro(false, tint); break;
    case "spider": c = new Arthro(true, tint); break;
    case "cobra": c = new Cobra(tint); break;
    case "golem": c = new Golem(tint); break;
    case "ent": c = new Ent(def.variant === "ancient"); break;
    case "wisp": c = new Wisp(tint); break;
    case "ghost": c = new Ghost(tint); break;
    case "humanoid": c = new Humanoid(def); break;
    case "rabbit": c = new Quadruped({ fur: "#c9b8a0", belly: "#f4f0e8", snout: 0.8, ears: 1.6, tail: "short", eye: "#202020", stocky: 0.55, headSize: 0.8, legLen: 0.12 }); break;
    case "deer": c = new Quadruped({ fur: "#b0783c", belly: "#f0e0c0", snout: 1.3, ears: 1.1, tail: "short", eye: "#201010", stocky: 0.7, legLen: 0.38, antlers: true }); break;
    case "fox": c = new Quadruped({ fur: "#e8802a", belly: "#fff4e0", snout: 1.5, ears: 1.4, tail: "bushy", eye: "#202020", stocky: 0.6, headSize: 0.85, legLen: 0.17 }); break;
    case "drake": c = new Quadruped({ fur: "#d04a3a", belly: "#f0c070", snout: 1.5, ears: 0.8, tail: "thin", eye: "#ffe040", stocky: 0.8, glow: true, spikes: true, legLen: 0.2 }); break;
    case "shadow": c = new Ghost("#7a5cff"); break;
    case "dog": c = new Quadruped({ fur: def.tint ?? "#a0764a", belly: "#f0e0c8", snout: 1.2, ears: 0.9, tail: "bushy", eye: "#201010", stocky: 0.6, headSize: 0.9, legLen: 0.17 }); break;
    case "cat": c = new Quadruped({ fur: def.tint ?? "#8a8a92", belly: "#f4f0e8", snout: 0.7, ears: 1.2, tail: "thin", eye: "#40c040", stocky: 0.42, headSize: 0.8, legLen: 0.12 }); break;
    case "sheep": c = new Quadruped({ fur: "#f2f0e8", belly: "#f6f4ee", snout: 0.9, ears: 0.8, tail: "short", eye: "#202020", stocky: 1.15, headSize: 0.8, legLen: 0.16, bristle: true }); break;
    case "cow": c = new Quadruped({ fur: "#e8e4dc", belly: "#c8b8a0", snout: 1.1, ears: 1.0, tail: "thin", eye: "#202020", stocky: 1.25, headSize: 1.0, legLen: 0.26 }); break;
    case "chicken": c = new Quadruped({ fur: "#f4ece0", belly: "#fff8ee", snout: 0.5, ears: 0.1, tail: "short", eye: "#202020", stocky: 0.36, headSize: 0.6, legLen: 0.1 }); break;
    default: c = new Slime(tint);
  }
  c.group.scale.setScalar(def.scale);
  c.height *= def.scale;
  c.radius *= def.scale;
  return c;
}
void stdMat;
