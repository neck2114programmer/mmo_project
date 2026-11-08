import * as THREE from "three";
import { glowTexture } from "./util";

interface Fx { obj: THREE.Object3D; life: number; max: number; tick: (u: number, dt: number) => void; done?: () => void }

const UP = new THREE.Vector3(0, 1, 0);
let glowTex: THREE.Texture | null = null;
const gtex = () => (glowTex ??= glowTexture("#ffffff"));
const addMat = (color: THREE.ColorRepresentation, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const spriteMat = (color: THREE.ColorRepresentation, opacity = 1) => new THREE.SpriteMaterial({ map: gtex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export class Vfx {
  group = new THREE.Group();
  private fx: Fx[] = [];
  shake = 0;
  constructor(scene: THREE.Scene) { scene.add(this.group); }

  private add(f: Fx) { this.group.add(f.obj); this.fx.push(f); }

  update(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life += dt;
      const u = Math.min(1, f.life / f.max);
      f.tick(u, dt);
      if (f.life >= f.max) {
        this.group.remove(f.obj);
        f.obj.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.geometry && (m.geometry as THREE.BufferGeometry & { __own?: boolean }).__own) m.geometry.dispose();
          const mat = m.material as THREE.Material | undefined;
          if (mat && !Array.isArray(mat)) mat.dispose();
        });
        f.done?.();
        this.fx.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  slash(pos: THREE.Vector3, dirAngle: number, color: string, size = 1.4, wide = 0.9) {
    const g = new THREE.RingGeometry(0.55, 1.0, 28, 1, 0, Math.PI * wide);
    (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const m = new THREE.Mesh(g, addMat(color, 0.95));
    const o = new THREE.Group(); o.add(m);
    o.position.copy(pos); o.rotation.y = dirAngle + Math.PI / 2; m.rotation.z = Math.random() * 1.0 - 0.5; m.rotation.x = -0.8 + Math.random() * 0.4;
    o.scale.setScalar(size);
    this.add({ obj: o, life: 0, max: 0.28, tick: (u) => { m.rotation.z -= 0.18; o.scale.setScalar(size * (0.7 + u * 0.7)); (m.material as THREE.Material).opacity = (1 - u) * 0.95; } });
    this.impact(pos, color, 6, 0.6);
  }

  impact(pos: THREE.Vector3, color: string, n = 10, power = 1) {
    const g = new THREE.Group(); g.position.copy(pos);
    const parts: { s: THREE.Sprite; v: THREE.Vector3 }[] = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(spriteMat(color, 1)); s.scale.setScalar(0.35 + Math.random() * 0.3); g.add(s);
      parts.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6).multiplyScalar(power) });
    }
    const flash = new THREE.Sprite(spriteMat("#ffffff", 0.9)); flash.scale.setScalar(2.2 * power); g.add(flash);
    this.add({ obj: g, life: 0, max: 0.55, tick: (u, dt) => {
      parts.forEach((p) => { p.s.position.addScaledVector(p.v, dt); p.v.y -= 9 * dt; (p.s.material as THREE.SpriteMaterial).opacity = 1 - u; });
      flash.scale.setScalar(2.2 * power * (1 - u)); (flash.material as THREE.SpriteMaterial).opacity = (1 - u) * 0.8;
    } });
  }

  ring(pos: THREE.Vector3, radius: number, color: string, dur = 0.6, y = 0.15) {
    const g = new THREE.RingGeometry(0.88, 1.0, 48); g.rotateX(-Math.PI / 2);
    (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const m = new THREE.Mesh(g, addMat(color, 0.95));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), addMat(color, 0.25));
    (disc.geometry as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const o = new THREE.Group(); o.add(m, disc); o.position.copy(pos); o.position.y += y;
    this.add({ obj: o, life: 0, max: dur, tick: (u) => { const e = 1 - Math.pow(1 - u, 3); o.scale.setScalar(Math.max(0.01, radius * e)); (m.material as THREE.Material).opacity = (1 - u) * 0.95; (disc.material as THREE.Material).opacity = (1 - u) * 0.28; } });
  }

  nova(pos: THREE.Vector3, radius: number, color: string) {
    this.ring(pos, radius, color, 0.55);
    this.ring(pos, radius * 0.7, "#ffffff", 0.4);
    this.impact(pos.clone().setY(pos.y + 0.8), color, 14, 1.4);
  }

  quake(pos: THREE.Vector3, radius: number, color: string) {
    this.ring(pos, radius, color, 0.7);
    const g = new THREE.Group(); g.position.copy(pos);
    const rocks: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.25, 0), new THREE.MeshStandardMaterial({ color: "#7a6a58", roughness: 1, flatShading: true, transparent: true }));
      (m.geometry as THREE.BufferGeometry & { __own?: boolean }).__own = true;
      const a = Math.random() * 6.28, r = Math.random() * radius * 0.9;
      m.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r); g.add(m);
      rocks.push({ m, v: new THREE.Vector3(0, 4 + Math.random() * 5, 0) });
    }
    this.add({ obj: g, life: 0, max: 0.9, tick: (u, dt) => { rocks.forEach((r) => { r.m.position.addScaledVector(r.v, dt); r.v.y -= 16 * dt; if (r.m.position.y < 0.1) { r.m.position.y = 0.1; r.v.set(0, 0, 0); } r.m.rotation.x += dt * 4; (r.m.material as THREE.Material).opacity = 1 - Math.max(0, u - 0.6) * 2.5; }); } });
    this.shake = Math.min(1, this.shake + 0.5);
  }

  pillar(pos: THREE.Vector3, radius: number, color: string) {
    const g = new THREE.CylinderGeometry(1, 1, 30, 24, 1, true);
    (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const m = new THREE.Mesh(g, addMat(color, 0.8)); m.position.copy(pos); m.position.y += 15;
    const core = new THREE.Mesh(g, addMat("#ffffff", 0.7)); core.position.copy(m.position);
    const o = new THREE.Group(); o.add(m, core);
    this.add({ obj: o, life: 0, max: 0.8, tick: (u) => { const w = radius * (0.3 + Math.sin(Math.min(1, u * 1.3) * Math.PI) * 0.7); m.scale.set(w, 1, w); core.scale.set(w * 0.4, 1, w * 0.4); (m.material as THREE.Material).opacity = (1 - u) * 0.7; (core.material as THREE.Material).opacity = (1 - u) * 0.8; } });
    this.ring(pos, radius, color, 0.7);
    this.impact(pos.clone().setY(pos.y + 1), color, 16, 1.6);
  }

  heal(pos: THREE.Vector3, color: string, up = true) {
    const g = new THREE.Group(); g.position.copy(pos);
    const ps: { s: THREE.Sprite; a: number; r: number; d: number }[] = [];
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(spriteMat(color, 1)); s.scale.setScalar(0.3); g.add(s); ps.push({ s, a: Math.random() * 6.28, r: 0.4 + Math.random() * 0.5, d: Math.random() * 0.4 }); }
    const ringG = new THREE.TorusGeometry(0.8, 0.04, 6, 30); ringG.rotateX(Math.PI / 2);
    (ringG as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const ring = new THREE.Mesh(ringG, addMat(color, 0.9)); g.add(ring);
    this.add({ obj: g, life: 0, max: 1.1, tick: (u) => {
      ps.forEach((p) => { const t = Math.max(0, u - p.d * 0.5); p.s.position.set(Math.cos(p.a + t * 4) * p.r, (up ? t : 1 - t) * 2.6, Math.sin(p.a + t * 4) * p.r); (p.s.material as THREE.SpriteMaterial).opacity = 1 - u; });
      ring.position.y = (up ? u : 1 - u) * 2.2; (ring.material as THREE.Material).opacity = (1 - u) * 0.9;
    } });
  }

  buff(pos: THREE.Vector3, color: string) {
    this.heal(pos, color, true);
    this.ring(pos, 1.6, color, 0.8);
    const s = new THREE.Sprite(spriteMat(color, 0.8)); s.position.copy(pos); s.position.y += 1; s.scale.setScalar(4);
    this.add({ obj: s, life: 0, max: 0.8, tick: (u) => { s.scale.setScalar(4 + u * 2); (s.material as THREE.SpriteMaterial).opacity = (1 - u) * 0.8; } });
  }

  shield(pos: THREE.Vector3, color: string) {
    const g = new THREE.SphereGeometry(1.2, 20, 14); (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const m = new THREE.Mesh(g, addMat(color, 0.4)); m.position.copy(pos); m.position.y += 1;
    this.add({ obj: m, life: 0, max: 1.2, tick: (u) => { m.scale.setScalar(0.7 + Math.sin(u * Math.PI) * 0.4); (m.material as THREE.Material).opacity = (1 - u) * 0.45; } });
    this.heal(pos, color);
  }

  whirl(pos: THREE.Vector3, radius: number, color: string) {
    const o = new THREE.Group(); o.position.copy(pos); o.position.y += 0.9;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.RingGeometry(0.7, 1.0, 32, 1, 0, Math.PI * 1.2); g.rotateX(-Math.PI / 2); (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
      const m = new THREE.Mesh(g, addMat(color, 0.85)); m.position.y = (i - 1) * 0.4; m.rotation.y = i * 2.1; o.add(m);
    }
    this.add({ obj: o, life: 0, max: 0.55, tick: (u) => { o.rotation.y = u * 14; o.scale.setScalar(radius * (0.5 + u * 0.5)); o.children.forEach((c) => ((c as THREE.Mesh).material as THREE.Material).opacity = (1 - u) * 0.85); } });
    this.ring(pos, radius, color, 0.5);
  }

  summon(pos: THREE.Vector3, color: string) {
    const o = new THREE.Group(); o.position.copy(pos); o.position.y += 0.1;
    const g = new THREE.RingGeometry(1.2, 1.4, 6); g.rotateX(-Math.PI / 2); (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const g2 = new THREE.RingGeometry(0.7, 0.8, 5); g2.rotateX(-Math.PI / 2); (g2 as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const a = new THREE.Mesh(g, addMat(color, 0.9)), b = new THREE.Mesh(g2, addMat(color, 0.9));
    o.add(a, b);
    this.add({ obj: o, life: 0, max: 1.0, tick: (u) => { a.rotation.y = u * 5; b.rotation.y = -u * 7; o.scale.setScalar(0.5 + u * 0.7); (a.material as THREE.Material).opacity = (1 - u) * 0.9; (b.material as THREE.Material).opacity = (1 - u) * 0.9; } });
    this.pillar(pos, 0.8, color);
  }

  levelUp(pos: THREE.Vector3) {
    this.pillar(pos, 1.4, "#ffe680");
    this.heal(pos, "#fff0a0");
    this.ring(pos, 4, "#ffd24d", 1.0);
  }

  projectile(from: THREE.Vector3, to: () => THREE.Vector3, color: string, kind: "bolt" | "arrow" | "orb", speed: number, onHit: () => void) {
    const o = new THREE.Group(); o.position.copy(from);
    if (kind === "arrow") {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), new THREE.MeshBasicMaterial({ color: "#e8e0c8" }));
      sh.rotation.x = Math.PI / 2; (sh.geometry as THREE.BufferGeometry & { __own?: boolean }).__own = true;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), new THREE.MeshBasicMaterial({ color })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.5;
      o.add(sh, tip);
    } else {
      o.add(new THREE.Mesh(new THREE.SphereGeometry(kind === "orb" ? 0.34 : 0.22, 12, 10), new THREE.MeshBasicMaterial({ color: "#ffffff" })));
    }
    const glow = new THREE.Sprite(spriteMat(color, 0.9)); glow.scale.setScalar(kind === "arrow" ? 1.0 : 2.0); o.add(glow);
    const trail: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(spriteMat(color, 0.5 - i * 0.07)); s.scale.setScalar(0.9 - i * 0.12); this.group.add(s); trail.push(s); }
    const last = from.clone();
    let hit = false;
    this.add({
      obj: o, life: 0, max: 3, tick: (_u, dt) => {
        if (hit) return;
        const t = to();
        const d = t.clone().sub(o.position);
        const dist = d.length();
        const step = speed * dt;
        if (dist <= step + 0.3) { hit = true; o.position.copy(t); onHit(); this.fx.find((f) => f.obj === o)!.life = 99; return; }
        d.normalize();
        o.position.addScaledVector(d, step);
        o.lookAt(o.position.clone().add(d));
        trail.forEach((s, i) => s.position.lerpVectors(o.position, last, (i + 1) / 6 * 0.9 + 0.1));
        if (kind !== "arrow") glow.scale.setScalar(2 + Math.sin(performance.now() * 0.03) * 0.3);
        last.lerp(o.position, 0.2);
      },
      done: () => trail.forEach((s) => { this.group.remove(s); s.material.dispose(); }),
    });
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, color: string, dur = 0.45) {
    const len = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(0.12, 0.12, len, 8, 1, true); (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const m = new THREE.Mesh(g, addMat(color, 0.85));
    const core = new THREE.Mesh(g, addMat("#ffffff", 0.8)); core.scale.set(0.4, 1, 0.4);
    const o = new THREE.Group(); o.add(m, core);
    o.position.copy(from).lerp(to, 0.5);
    o.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    this.add({ obj: o, life: 0, max: dur, tick: (u) => { const w = (1 - u) * (1 + Math.sin(u * 40) * 0.3); m.scale.set(w * 1.5, 1, w * 1.5); core.scale.set(w * 0.5, 1, w * 0.5); (m.material as THREE.Material).opacity = (1 - u) * 0.85; (core.material as THREE.Material).opacity = (1 - u) * 0.8; } });
    this.impact(to, color, 10, 1);
  }

  rain(pos: THREE.Vector3, radius: number, color: string, kind: "meteor" | "arrow" | "bolt", onLand?: () => void) {
    const n = kind === "arrow" ? 22 : 9;
    const o = new THREE.Group(); o.position.copy(pos);
    const items: { s: THREE.Object3D; x: number; z: number; d: number; landed: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      let s: THREE.Object3D;
      if (kind === "arrow") { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), new THREE.MeshBasicMaterial({ color })); (m.geometry as THREE.BufferGeometry & { __own?: boolean }).__own = true; s = m; }
      else { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.2, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" })); g.add(m); const sp = new THREE.Sprite(spriteMat(color, 0.9)); sp.scale.setScalar(2.4); g.add(sp); s = g; }
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * radius;
      items.push({ s, x: Math.cos(a) * r, z: Math.sin(a) * r, d: Math.random() * 0.45, landed: false });
      s.visible = false; o.add(s);
    }
    this.ring(pos, radius, color, 1.0);
    let fired = false;
    this.add({ obj: o, life: 0, max: 1.3, tick: (u) => {
      const t = u * 1.3;
      items.forEach((it) => {
        const k = (t - it.d) / 0.5;
        if (k < 0) return;
        if (k >= 1) { if (!it.landed) { it.landed = true; it.s.visible = false; this.impact(new THREE.Vector3(pos.x + it.x, pos.y + 0.3, pos.z + it.z), color, 6, 0.8); if (kind === "meteor") this.shake = Math.min(1, this.shake + 0.15); } return; }
        it.s.visible = true; it.s.position.set(it.x + (1 - k) * 4, (1 - k) * 22, it.z + (1 - k) * 2);
        if (kind === "arrow") it.s.lookAt(it.x, 0, it.z);
      });
      if (!fired && t > 0.5) { fired = true; onLand?.(); }
    } });
  }

  telegraph(pos: THREE.Vector3, radius: number, dur: number) {
    const g = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); (g as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const inner = new THREE.Mesh(g, addMat("#ff3030", 0.35));
    const rg = new THREE.RingGeometry(0.96, 1, 48).rotateX(-Math.PI / 2); (rg as THREE.BufferGeometry & { __own?: boolean }).__own = true;
    const ring = new THREE.Mesh(rg, addMat("#ff5050", 0.95));
    const o = new THREE.Group(); o.add(inner, ring); o.position.copy(pos); o.position.y += 0.2;
    ring.scale.setScalar(radius);
    this.add({ obj: o, life: 0, max: dur, tick: (u) => { inner.scale.setScalar(radius * u); (inner.material as THREE.Material).opacity = 0.2 + u * 0.35; } });
  }
}
