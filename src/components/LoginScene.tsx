"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CharacterModel, type ActionKind } from "@/game/render/character";
import { buildStructure } from "@/game/render/structures";
import { Vfx } from "@/game/render/vfx";
import { WIND, assignT, blobGeo, canvasTexture, glowTexture, mesh, stdMat } from "@/game/render/util";
import { DEFAULT_APP } from "@/game/render/appearance";
import type { ClassId, Gender } from "@/game/types";

interface Fighter { m: CharacterModel; base: THREE.Vector3; face: number; lunge: number; recoil: number; team: number; cls: ClassId }
interface Pair { a: Fighter; b: Fighter; t: number; turn: number; pending: { at: number; fn: () => void }[] }

const SKY_V = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_F = `varying vec3 vDir; uniform vec3 uSun;
void main(){
  float h = clamp(vDir.y, -0.1, 1.0);
  vec3 hor = vec3(1.0, 0.45, 0.16), mid = vec3(0.45, 0.16, 0.34), top = vec3(0.06, 0.04, 0.2);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.28, h)); col = mix(col, top, smoothstep(0.22, 0.85, h));
  float s = max(dot(normalize(vDir), uSun), 0.0);
  col += vec3(1.0, 0.7, 0.35) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.6 + pow(s, 5.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const A = (cls: ClassId, team: number, gender: Gender = "male", extra: Record<string, unknown> = {}) => ({ cls, team, gender, extra });

class BattleScene {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, 1, 0.5, 900); composer: EffectComposer;
  vfx: Vfx; clock = new THREE.Clock(); t = 0; raf = 0; pairs: Pair[] = []; extras: { f: Fighter; next: number; kind: "mage" | "archer" }[] = []; updaters: ((t: number, dt: number) => void)[] = [];
  mouse = new THREE.Vector2(); lights: THREE.PointLight[] = []; embers!: THREE.Points; flash: THREE.PointLight; nextMeteor = 4; all: Fighter[] = [];
  ro: ResizeObserver; onMove: (e: MouseEvent) => void;

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    el.appendChild(this.renderer.domElement);
    const w = el.clientWidth || 800, h = el.clientHeight || 600;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.7, 0.8));
    this.composer.addPass(new OutputPass());
    this.scene.fog = new THREE.Fog("#3a1a38", 35, 190);
    this.vfx = new Vfx(this.scene);
    this.flash = new THREE.PointLight("#ffb060", 0, 14, 1.5); this.scene.add(this.flash);
    this.buildEnvironment();
    this.buildFighters();
    this.buildEmbers();
    this.onMove = (e) => { this.mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1); };
    window.addEventListener("mousemove", this.onMove);
    this.ro = new ResizeObserver(() => { const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return; this.renderer.setSize(W, H); this.composer.setSize(W, H); this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); });
    this.ro.observe(el);
    this.loop();
  }

  buildEnvironment() {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(-0.55, 0.12, -0.8).normalize();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sunDir } } }));
    sc.add(sky);
    // облака
    const ct = canvasTexture(256, 128, (ctx, w, h) => { for (let i = 0; i < 30; i++) { const x = 30 + Math.random() * (w - 60), y = 30 + Math.random() * (h - 60), r = 14 + Math.random() * 28; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,255,255,0.7)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); } });
    const cm = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, color: "#ff9a7a", opacity: 0.55 });
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), cm); c.position.set(-300 + i * 80, 90 + (i % 3) * 25, -300 + (i % 4) * 30); c.rotation.x = -0.25; sc.add(c); }
    // освещение
    sc.add(new THREE.HemisphereLight("#ff9a6a", "#2a1a3a", 0.9));
    const sun = new THREE.DirectionalLight("#ffa060", 3.2);
    sun.position.set(-30, 18, -40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
    sc.add(sun, sun.target);
    // булыжник
    const cobble = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#4a4350"; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
        const v = 70 + Math.random() * 45; ctx.fillStyle = `rgb(${v + 10},${v},${v + 14})`;
        ctx.beginPath(); ctx.roundRect(x + 3, y + 3, 58, 26, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x + 6, y + 5, 50, 4);
      }
    });
    cobble.wrapS = cobble.wrapT = THREE.RepeatWrapping; cobble.repeat.set(36, 36);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.95, color: "#d8b8c0" }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
    const scorch = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(10,5,5,0.7)"); g.addColorStop(1, "rgba(10,5,5,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.set(-1, 0.02, 0); sc.add(scorch);
    // замок
    const stone = stdMat("#4a4258", { rough: 0.95, flat: true }), stoneL = stdMat("#5c5470", { rough: 0.95, flat: true });
    const castle = new THREE.Group(); castle.position.set(-10, 0, -78); sc.add(castle);
    const win = stdMat("#ffcf70", { emissive: "#ff9a30", ei: 2.2 });
    const roofs = [stdMat("#7a1f2a", { rough: 0.8 }), stdMat("#1f3a7a", { rough: 0.8 })];
    const tower = (x: number, z: number, r: number, h: number, ri: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      g.add(assignT(mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 14), stone), { position: new THREE.Vector3(0, h / 2, 0) }));
      g.add(assignT(mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 1.2, 14), stoneL), { position: new THREE.Vector3(0, h, 0) }));
      g.add(assignT(mesh(new THREE.ConeGeometry(r * 1.35, r * 3, 14), roofs[ri % 2]), { position: new THREE.Vector3(0, h + r * 1.5 + 0.6, 0) }));
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + x; g.add(assignT(mesh(new THREE.BoxGeometry(0.7, 1.4, 0.2), win), { position: new THREE.Vector3(Math.cos(a) * r * 1.0, h * (0.35 + (i % 3) * 0.2), Math.sin(a) * r * 1.0), rotation: new THREE.Euler(0, -a + Math.PI / 2, 0) })); }
      castle.add(g);
    };
    const keep = mesh(new THREE.BoxGeometry(22, 42, 16), stone); keep.position.set(0, 21, 0); castle.add(keep);
    for (let i = 0; i < 9; i++) castle.add(assignT(mesh(new THREE.BoxGeometry(1.8, 1.6, 1.8), stoneL), { position: new THREE.Vector3(-10 + i * 2.5, 42.8, 7) }));
    for (let i = 0; i < 24; i++) castle.add(assignT(mesh(new THREE.BoxGeometry(0.8, 1.4, 0.2), win), { position: new THREE.Vector3(-8 + (i % 6) * 3.2, 14 + Math.floor(i / 6) * 8, 8.1) }));
    tower(-14, 6, 4.2, 54, 0); tower(14, 6, 4.2, 58, 1); tower(-14, -6, 4, 46, 1); tower(14, -6, 4, 50, 0);
    for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(46, 16, 3.5), stone); w.position.set(s * 38, 8, 4); castle.add(w); tower(s * 62, 4, 4.5, 26, s > 0 ? 1 : 0); for (let i = 0; i < 10; i++) castle.add(assignT(mesh(new THREE.BoxGeometry(2, 1.6, 3.6), stoneL), { position: new THREE.Vector3(s * (16 + i * 4.6), 16.8, 4) })); }
    const gate = mesh(new THREE.BoxGeometry(7, 11, 1), stdMat("#ffb050", { emissive: "#ff7a20", ei: 1.6 })); gate.position.set(0, 5.5, 8.2); castle.add(gate);
    const flag = mesh(new THREE.PlaneGeometry(6, 14, 4, 6), new THREE.MeshStandardMaterial({ color: "#a01828", side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(0, 30, 8.2); castle.add(flag);
    this.updaters.push((t) => { const p = flag.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 2.5 + p.getY(i) * 0.5 + p.getX(i)) * 0.4); p.needsUpdate = true; });
    // горы
    const mm = new THREE.MeshStandardMaterial({ color: "#3a2a4a", roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(blobGeo(40 + (i % 4) * 14, 1, 0.45, i + 4, 1.1), mm); m.position.set(-240 + i * 44, -8, -190 - (i % 3) * 30); sc.add(m); }
    // дымы
    const sm = glowTexture("#ffffff");
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); g.position.set(-45 + i * 18, 0, -35 - (i % 2) * 15); sc.add(g);
      const puffs: THREE.Sprite[] = [];
      for (let k = 0; k < 14; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sm, color: "#2a2028", transparent: true, opacity: 0.4, depthWrite: false })); g.add(sp); puffs.push(sp); }
      this.updaters.push((t) => puffs.forEach((p, k) => { const u = (t * 0.07 + k / 14 + i * 0.13) % 1; p.position.set(u * 9, u * 38, 0); p.scale.setScalar(5 + u * 18); p.material.opacity = 0.42 * Math.min(1, u * 5) * (1 - u); }));
      // костёр-обломки
      const st = buildStructure("campfire")!; st.obj.position.set(g.position.x, 0, g.position.z + 2); st.obj.scale.setScalar(2.2); sc.add(st.obj); this.updaters.push((t, dt) => st.update?.(t, dt));
    }
    // огни на арене
    const spots: [number, number][] = [[-12, 6], [8, -9], [12, 6], [-4, -11]];
    spots.forEach(([x, z], i) => {
      const st = buildStructure(i % 2 ? "campfire" : "campfire")!; st.obj.position.set(x, 0, z); st.obj.scale.setScalar(1.3); sc.add(st.obj); this.updaters.push((t, dt) => st.update?.(t, dt));
      const l = new THREE.PointLight("#ff8a30", 30, 24, 1.5); l.position.set(x, 1.8, z); sc.add(l); this.lights.push(l);
    });
    for (const [x, z, k] of [[-16, -3, "banner"], [15, -2, "banner"], [-8, -14, "banner"], [6, 12, "banner"], [-18, 8, "pillar"], [18, 3, "pillar"]] as [number, number, string][]) {
      const st = buildStructure(k)!; st.obj.position.set(x, 0, z); st.obj.rotation.y = Math.random() * 6; sc.add(st.obj); this.updaters.push((t, dt) => st.update?.(t, dt));
    }
    // обломки / щиты на земле
    for (let i = 0; i < 28; i++) { const r = mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.4, 0), stdMat("#3a3440", { flat: true, rough: 1 })); r.position.set((Math.random() - 0.5) * 36, 0.12, (Math.random() - 0.5) * 26); r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); sc.add(r); }
    void WIND;
  }

  knight(spec: ReturnType<typeof A>, x: number, z: number, helm: boolean, tier: number): Fighter {
    const team = spec.team;
    const app = { ...DEFAULT_APP, ...(spec.extra as object) };
    const m = new CharacterModel({
      cls: spec.cls, gender: spec.gender, app: { ...app, hairColor: spec.gender === "female" ? "#f2dc8c" : app.hairColor, hair: spec.gender === "female" ? 2 : 0, eyeStyle: spec.gender === "female" ? 5 : 1, accent: team ? "#2a4aa8" : "#a8262c" },
      armorTier: tier, weaponTier: tier, head: true, helm, cloth: team ? "#27408c" : "#8c2228", cloth2: team ? "#d8e0ff" : "#ffd8a0",
    });
    m.group.position.set(x, 0, z);
    this.scene.add(m.group);
    const f = { m, base: new THREE.Vector3(x, 0, z), face: 0, lunge: 0, recoil: 0, team, cls: spec.cls };
    this.all.push(f);
    return f;
  }

  buildFighters() {
    const defs: [ReturnType<typeof A>, ReturnType<typeof A>, number, number, number, boolean, boolean][] = [
      [A("warrior", 0, "female", { hair: 2, skin: "#f9d2b4", hairColor: "#f2dc8c", height: 0.6 }), A("shieldbearer", 1), -5.8, 0.6, 0.35, false, true],
      [A("berserker", 1, "male", { skin: "#c98b5e", build: 0.9 }), A("warrior", 0), -0.5, -5, -0.5, true, true],
      [A("assassin", 0, "female", { skin: "#e0a67c", hairColor: "#9a5cff", hair: 3 }), A("berserker", 1), 4.4, 1.2, 0.75, false, true],
      [A("shieldbearer", 0), A("assassin", 1), -2.5, 5.2, 2.6, true, false],
    ];
    for (const [a, b, cx, cz, ang, helmA, helmB] of defs) {
      const dx = Math.cos(ang) * 1.45, dz = Math.sin(ang) * 1.45;
      const fa = this.knight(a, cx - dx, cz - dz, helmA, 3 + (cx > 0 ? 1 : 0));
      const fb = this.knight(b, cx + dx, cz + dz, helmB, 3);
      fa.face = Math.atan2(dx, dz); fb.face = Math.atan2(-dx, -dz);
      this.pairs.push({ a: fa, b: fb, t: Math.random() * 2, turn: 0, pending: [] });
    }
    const mage = this.knight(A("mage", 0, "female", { hair: 1, hairColor: "#ff6aa8", skin: "#f9d2b4", ears: 1 }), -10, -3.5, false, 4);
    mage.face = 0.6; this.extras.push({ f: mage, next: 2, kind: "mage" });
    const archer = this.knight(A("archer", 1, "male", { hair: 5, hairColor: "#3a2418" }), 9.5, -4.5, false, 3);
    archer.face = -0.9; this.extras.push({ f: archer, next: 1, kind: "archer" });
    const sorc = this.knight(A("sorcerer", 1, "male", { skin: "#e8e4f0", hair: 1, hairColor: "#1b1418", ears: 1 }), 11, 4, false, 4);
    sorc.face = -1.6; this.extras.push({ f: sorc, next: 3, kind: "mage" });
  }

  buildEmbers() {
    const n = 420;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 25; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; seed[i] = Math.random(); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ff9a40", size: 0.28, map: glowTexture("#ffffff"), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.embers.frustumCulled = false;
    this.scene.add(this.embers);
    this.updaters.push((t, dt) => {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        let y = p.getY(i) + dt * (1.2 + seed[i] * 2.5);
        const x = p.getX(i) + Math.sin(t * 0.7 + seed[i] * 30) * dt * 1.5 + dt * 1.2;
        if (y > 28) y = 0;
        p.setXYZ(i, x > 40 ? -40 : x, y, p.getZ(i));
      }
      p.needsUpdate = true;
    });
  }

  spark(a: THREE.Vector3, b: THREE.Vector3) {
    const mid = a.clone().lerp(b, 0.5); mid.y = 1.5;
    this.vfx.impact(mid, "#ffd080", 12, 1.2);
    this.flash.position.copy(mid); this.flash.intensity = 40;
  }

  act(f: Fighter, kind: ActionKind, dur: number) { f.m.play(kind, dur); }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const t = this.t;
    WIND.uTime.value = t;
    this.updaters.forEach((u) => u(t, dt));
    this.flash.intensity *= Math.exp(-dt * 12);
    this.lights.forEach((l, i) => (l.intensity = 28 + Math.sin(t * 11 + i * 2) * 4 + Math.sin(t * 5.7 + i) * 3));
    // дуэли
    for (const p of this.pairs) {
      p.t -= dt;
      if (p.t <= 0) {
        p.t = 1.1 + Math.random() * 0.9;
        const [atk, def] = p.turn++ % 2 ? [p.b, p.a] : [p.a, p.b];
        const style = atk.cls === "assassin" ? "stab" : atk.cls === "shieldbearer" ? "bash" : Math.random() < 0.5 ? "slash" : "slash2";
        const blk = Math.random() < 0.6;
        this.act(atk, style as ActionKind, 0.62);
        atk.lunge = 1;
        const now = performance.now();
        p.pending.push({ at: now + 270, fn: () => { this.spark(atk.m.group.position, def.m.group.position); this.act(def, blk ? "block" : "hit", blk ? 0.5 : 0.4); def.recoil = 1; } });
      }
      const now = performance.now();
      for (let i = p.pending.length - 1; i >= 0; i--) if (p.pending[i].at <= now) { p.pending[i].fn(); p.pending.splice(i, 1); }
      for (const [f, o] of [[p.a, p.b], [p.b, p.a]] as [Fighter, Fighter][]) {
        f.lunge = Math.max(0, f.lunge - dt * 1.6); f.recoil = Math.max(0, f.recoil - dt * 2.4);
        const dx = o.base.x - f.base.x, dz = o.base.z - f.base.z, d = Math.hypot(dx, dz) || 1;
        const off = Math.sin(f.lunge * Math.PI) * 0.45 - Math.sin(f.recoil * Math.PI) * 0.3;
        f.m.group.position.set(f.base.x + (dx / d) * off, 0, f.base.z + (dz / d) * off);
        f.m.group.rotation.y = f.face;
      }
    }
    for (const e of this.extras) {
      e.next -= dt;
      if (e.next <= 0) {
        const tgt = this.pairs[Math.floor(Math.random() * this.pairs.length)];
        const targetF = e.f.team === 0 ? (tgt.a.team === 1 ? tgt.a : tgt.b) : (tgt.a.team === 0 ? tgt.a : tgt.b);
        const from = e.f.m.group.position.clone(); from.y = 1.5;
        const to = targetF.m.group.position;
        e.f.face = Math.atan2(to.x - from.x, to.z - from.z);
        if (e.kind === "mage") {
          e.next = 3 + Math.random() * 2; this.act(e.f, "cast", 0.8);
          const col = e.f.cls === "sorcerer" ? "#b25dff" : "#ff7a2a";
          setTimeout(() => this.vfx.projectile(from.clone().setY(2.2), () => to.clone().setY(1.3), col, "orb", 22, () => { this.vfx.nova(to.clone(), 3, col); this.flash.position.set(to.x, 2, to.z); this.flash.intensity = 60; this.act(targetF, "hit", 0.5); }), 400);
        } else {
          e.next = 1.6 + Math.random() * 1.2; this.act(e.f, "shoot", 0.9);
          setTimeout(() => this.vfx.projectile(from.clone().setY(1.5), () => to.clone().setY(1.3), "#ffe0a0", "arrow", 34, () => { this.vfx.impact(to.clone().setY(1.3), "#ffd080", 8, 1); this.act(targetF, "hit", 0.4); }), 480);
        }
      }
      e.f.m.group.rotation.y += (e.f.face - e.f.m.group.rotation.y) * Math.min(1, dt * 6);
    }
    this.nextMeteor -= dt;
    if (this.nextMeteor <= 0) { this.nextMeteor = 6 + Math.random() * 5; this.vfx.rain(new THREE.Vector3((Math.random() - 0.5) * 50, 0, -22 - Math.random() * 12), 8, "#ff7a30", "meteor"); }
    for (const f of this.all) f.m.update(dt);
    this.vfx.update(dt);
    // камера
    const mx = this.mouse.x, my = this.mouse.y;
    this.camera.position.set(Math.sin(t * 0.1) * 7 - 4 + mx * 2.2, 3.1 + Math.sin(t * 0.17) * 0.5 - my * 0.8, 15.5 + Math.cos(t * 0.1) * 2.5);
    this.camera.lookAt(-2.5 + mx * 1.2, 1.9, 0);
    this.composer.render();
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("mousemove", this.onMove);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export default function LoginScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const s = new BattleScene(ref.current);
    return () => s.dispose();
  }, []);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }} />;
}
