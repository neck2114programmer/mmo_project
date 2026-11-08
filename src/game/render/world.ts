import * as THREE from "three";
import { ZONES, type ZoneDef } from "../data/zones";
import type { ZoneId } from "../types";
import { fbm, noise2, smoothstep, mulberry, lerp } from "../data/balance";
import { NPCS } from "../data/world";
import { WIND, RIM, basicMat, canvasTexture, glowTexture, mesh, sphere, stdMat, blobGeo } from "./util";
import { ZONE_TINT } from "../data/zones2";
import { getFlora } from "./flora";
import { buildStructure, type Struct } from "./structures";

export interface Collider { x: number; z: number; r: number }
export interface GatherNode { id: number; item: string; label: string; x: number; z: number; obj: THREE.Group; taken: boolean; respawn: number; color: string }
export interface PortalObj { x: number; z: number; to: ZoneId; tx: number; tz: number; label: string; obj: THREE.Group }

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol;
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.35, h));
  col = mix(col, uTop, smoothstep(0.3, 0.95, h));
  float s = max(dot(normalize(vDir), uSun), 0.0);
  col += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const WATER_VERT = `attribute float aEdge; varying float vEdge; varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){ vEdge = aEdge; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `varying float vEdge; varying vec3 vWorld; uniform float uTime; uniform float uFlow; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSkyCol;
#include <fog_pars_fragment>
float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float nz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vWorld.xz;
  float t = uTime;
  float w = nz(p*0.35 + vec2(0.0, t*0.5*uFlow)) + 0.5*nz(p*0.9 + vec2(-t*0.2, t*0.4*uFlow + t*0.15));
  float rip = smoothstep(0.80, 0.97, nz(p*2.4 + vec2(t*0.3, t*0.7*uFlow + t*0.2)));
  vec3 col = mix(uShallow, uDeep, clamp(smoothstep(1.0, 0.0, vEdge)*0.85 + (w-0.75)*0.3, 0.0, 1.0));
  col = mix(col, uSkyCol, 0.18 + rip*0.25);
  float sp = step(0.985, nz(p*8.0 + vec2(t*1.2, t*2.0*uFlow+t*0.5)));
  col += sp * 0.9;
  float foam = smoothstep(0.78, 0.98, vEdge) * (0.5 + 0.5*nz(p*3.0 + vec2(0.0, t*0.6*uFlow)));
  col = mix(col, vec3(0.95,0.98,1.0), foam*0.55);
  float alpha = (0.55 + 0.4*(1.0-vEdge*0.3)) * (1.0 - smoothstep(0.9, 1.0, vEdge));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const PORTAL_FRAG = `varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
void main(){
  vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y,p.x);
  float sw = sin(a*4.0 + r*10.0 - uTime*3.0)*0.5+0.5;
  float sw2 = sin(a*7.0 - r*14.0 + uTime*2.0)*0.5+0.5;
  float g = pow(1.0-r, 1.2);
  vec3 col = uColor*(0.5+sw*0.8+sw2*0.4) + vec3(1.0)*pow(1.0-r,4.0)*0.8;
  gl_FragColor = vec4(col, (0.35+0.55*g)*(1.0-smoothstep(0.92,1.0,r)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const UV_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const GATHER_COLORS: Record<string, string> = {
  healing_herb: "#7dff7a", river_fish: "#7fd8ff", lost_amulet: "#ffe080", cactus_water: "#ff9ad0", desert_scroll: "#ffd070",
  sun_crystal: "#ffe080", moon_blossom: "#c8a8ff", druid_acorn: "#ffcc50",
};

export class World {
  group = new THREE.Group();
  zone: ZoneDef;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  fireLights: THREE.PointLight[] = [];
  fires: { x: number; y: number; z: number; color: string }[] = [];
  updaters: ((t: number, dt: number) => void)[] = [];
  waterMats: THREE.ShaderMaterial[] = [];
  grid = new Map<number, Collider[]>();
  gathers: GatherNode[] = [];
  portals: PortalObj[] = [];
  skyMesh!: THREE.Mesh;
  cloudGroup = new THREE.Group();
  bridgeDecks: { x: number; z: number; by: number }[] = [];
  docks: { x: number; z: number; y: number }[] = [];
  private pts: { pts: THREE.Points; fn: (t: number, f: THREE.Vector3) => void }[] = [];
  private wildTiming = 0;
  private skyUniforms: Record<string, THREE.IUniform> = {};
  private ceilingFollow: THREE.Object3D[] = [];
  private pathDistCache: [number, number][][] = [];

  constructor(id: ZoneId, scene: THREE.Scene) {
    this.zone = ZONES[id];
    this.scene = scene;
    const z = this.zone;
    scene.fog = new THREE.Fog(z.sky.fog, z.sky.fogNear, z.sky.fogFar);
    scene.add(this.group);
    this.pathDistCache = z.paths;
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildStructures();
    this.buildProps();
    this.buildGrass();
    this.buildPortals();
    this.buildGathers();
    this.buildAmbient();
    if (z.cave) this.buildCeiling();
    this.sun = this.sunRef;
  }
  private sunRef!: THREE.DirectionalLight;

  // ---------- Физика мира ----------
  groundY(x: number, z: number): number {
    let h = this.zone.height(x, z);
    for (const b of this.bridgeDecks) {
      if (Math.abs(z - b.z) < 1.6 && Math.abs(x - b.x) < 11.4) {
        const u = (x - b.x) / 11;
        h = Math.max(h, b.by + 0.5 + (1 - u * u) * 0.55 + 0.08);
      }
    }
    for (const d of this.docks) {
      if (Math.abs(z - d.z) < 1.15 && x > d.x + 0.6 && x < d.x + 12.4) h = Math.max(h, d.y + 0.1);
    }
    return h;
  }
  private cellKey(cx: number, cz: number) { return (cx + 200) * 1000 + (cz + 200); }
  addCollider(c: Collider) {
    const k = this.cellKey(Math.floor(c.x / 8), Math.floor(c.z / 8));
    const a = this.grid.get(k);
    if (a) a.push(c); else this.grid.set(k, [c]);
  }
  blocked(x: number, z: number, rad = 0.4): boolean {
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.grid.get(this.cellKey(cx + i, cz + j));
      if (a) for (const c of a) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + rad) ** 2) return true;
    }
    return false;
  }
  walkable(x: number, z: number): boolean {
    const half = this.zone.cave ? this.zone.half - 10 : this.zone.half - 3;
    if (this.zone.cave ? Math.hypot(x, z) > half : Math.abs(x) > half || Math.abs(z) > half) return false;
    const th = this.zone.height(x, z);
    if (th < this.zone.waterLevel - 0.55) {
      return this.groundY(x, z) > th + 0.2;
    }
    return !this.blocked(x, z);
  }
  inWater(x: number, z: number) { return this.zone.height(x, z) < this.zone.waterLevel - 0.05 && this.groundY(x, z) <= this.zone.height(x, z) + 0.01; }
  pathDist(x: number, z: number): number {
    let best = 999;
    for (const path of this.pathDistCache) {
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (d < best) best = d;
      }
    }
    return best;
  }
  slope(x: number, z: number) {
    const h = this.zone.height.bind(this.zone);
    const dx = h(x + 1, z) - h(x - 1, z), dz = h(x, z + 1) - h(x, z - 1);
    return Math.hypot(dx, dz) / 2;
  }

  // ---------- Небо ----------
  private buildSky() {
    const s = this.zone.sky;
    const sd = new THREE.Vector3(...s.sunPos).normalize();
    this.skyUniforms = {
      uTop: { value: new THREE.Color(s.top) }, uMid: { value: new THREE.Color(s.mid) }, uHor: { value: new THREE.Color(s.horizon) },
      uSun: { value: sd }, uSunCol: { value: new THREE.Color(s.sun) },
    };
    const m = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m);
    this.skyMesh.renderOrder = -10;
    this.skyMesh.frustumCulled = false;
    this.group.add(this.skyMesh);
    if (!this.zone.cave) {
      const tex = canvasTexture(256, 128, (ctx, w, h) => {
        for (let i = 0; i < 26; i++) {
          const x = 40 + Math.random() * (w - 80), y = 30 + Math.random() * (h - 60), r = 16 + Math.random() * 26;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      });
      const rnd = mulberry(7);
      const cm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: this.zone.id === "desert" ? 0.5 : 0.9 }); this.cloudMat = cm;
      for (let i = 0; i < 14; i++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(260 + rnd() * 160, 130 + rnd() * 80), cm);
        c.rotation.x = -Math.PI / 2; c.rotation.z = rnd() * 6;
        c.position.set((rnd() - 0.5) * 900, 150 + rnd() * 50, (rnd() - 0.5) * 900);
        c.renderOrder = -9;
        this.cloudGroup.add(c);
      }
      this.group.add(this.cloudGroup);
    }
  }

  static shadowSize = 1024;
  static shadowOn = true;
  static viewScale = 1;
  hemi!: THREE.HemisphereLight; amb!: THREE.AmbientLight;
  stars?: THREE.Points; moonMesh?: THREE.Mesh; cloudMat?: THREE.MeshBasicMaterial;
  sunDir = new THREE.Vector3(0.3, 1, 0.3).normalize();
  night = 0; tod = 0.4;
  private tmpC = new THREE.Color();
  private buildLights() {
    const s = this.zone.sky;
    const hemi = new THREE.HemisphereLight(s.hemiSky, s.hemiGround, s.hemiInt);
    const amb = new THREE.AmbientLight(s.amb, s.ambInt * 0.5);
    const sun = new THREE.DirectionalLight(s.sun, s.sunInt);
    sun.position.set(...s.sunPos);
    sun.castShadow = World.shadowOn;
    sun.shadow.mapSize.set(World.shadowSize, World.shadowSize);
    const sc = sun.shadow.camera;
    const ext = World.shadowSize >= 2048 ? 60 : World.shadowSize >= 1024 ? 42 : 30;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    this.group.add(hemi, amb, sun, sun.target);
    this.hemi = hemi; this.amb = amb;
    this.sunRef = sun;
    const n = this.zone.id === "crypt" ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight("#ffa050", 0, 22, 1.6);
      this.group.add(l);
      this.fireLights.push(l);
    }
    if (!this.zone.cave) {
      const N = 700, pos = new Float32Array(N * 3), rnd = mulberry(5);
      for (let i = 0; i < N; i++) {
        const u = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - u * u);
        pos[i * 3] = Math.cos(a) * r * 850; pos[i * 3 + 1] = Math.abs(u) * 850 * 0.95 + 20; pos[i * 3 + 2] = Math.sin(a) * r * 850;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      this.stars.frustumCulled = false; this.stars.renderOrder = -9;
      this.skyMesh.add(this.stars);
      this.moonMesh = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (ctx, w, h) => {
        const gr = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, "#fffbe8"); gr.addColorStop(0.55, "#e9eefc"); gr.addColorStop(0.62, "rgba(190,210,255,0.5)"); gr.addColorStop(1, "rgba(150,180,255,0)");
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(150,160,190,0.35)"; for (const [x, y, r] of [[52, 56, 9], [74, 70, 6], [60, 80, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); }
      }), transparent: true, depthWrite: false, fog: false }));
      this.moonMesh.renderOrder = -8; this.skyMesh.add(this.moonMesh);
    }
  }

  /** tod: 0..1 (0.25 рассвет, 0.5 полдень, 0.75 закат, 0 — полночь). Возвращает ночность 0..1 */
  setTimeOfDay(tod: number) {
    this.tod = tod;
    if (this.zone.cave) { this.night = 1; return 1; }
    const sk = this.zone.sky;
    const a = (tod - 0.25) * Math.PI * 2;
    const elev = Math.sin(a);
    const day = smoothstep(-0.1, 0.28, elev);
    const night = 1 - day;
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.32);
    this.night = night;
    this.sunDir.set(Math.cos(a) * 0.85, elev, 0.42).normalize();
    const C = (h: string) => this.tmpC.set(h);
    const mix = (u: THREE.Color, base: string, nightCol: string, dusk_?: string, k = 0.55) => {
      u.set(base).lerp(C(nightCol), night);
      if (dusk_) u.lerp(C(dusk_), dusk * k);
    };
    const U = this.skyUniforms;
    mix(U.uTop.value, sk.top, "#050b20"); mix(U.uMid.value, sk.mid, "#0c1a3c", "#6a4a7a", 0.4); mix(U.uHor.value, sk.horizon, "#18284e", "#ff8a4a", 0.7);
    U.uSun.value.copy(this.sunDir);
    U.uSunCol.value.set(sk.sun).lerp(C("#ff9a50"), dusk * 0.6);
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) { mix(fog.color, sk.fog, "#0a1228", "#d88a5a", 0.45); fog.near = sk.fogNear * World.viewScale; fog.far = sk.fogFar * World.viewScale * (1 - night * 0.2); }
    mix(this.hemi.color, sk.hemiSky, "#2a3f7a"); mix(this.hemi.groundColor, sk.hemiGround, "#0a0c18");
    this.hemi.intensity = sk.hemiInt * (0.32 + 0.68 * day);
    this.amb.color.set(sk.amb).lerp(C("#3a4a8a"), night); this.amb.intensity = sk.ambInt * 0.5 * (0.45 + 0.55 * day);
    const sunI = sk.sunInt * smoothstep(0.0, 0.3, elev);
    const moonI = 0.85 * smoothstep(0.0, 0.3, -elev);
    if (elev >= 0) { this.sunRef.color.set(sk.sun).lerp(C("#ff9a50"), dusk * 0.7); this.sunRef.intensity = Math.max(0.02, sunI); this.lightDir.copy(this.sunDir); }
    else { this.sunRef.color.set("#8aa6ff"); this.sunRef.intensity = Math.max(0.02, moonI); this.lightDir.set(-this.sunDir.x, -this.sunDir.y, -this.sunDir.z * 0.5 + 0.2).normalize(); }
    if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, night * 1.2 - 0.2);
    if (this.moonMesh) { this.moonMesh.position.copy(this.sunDir).multiplyScalar(-780); this.moonMesh.lookAt(0, 0, 0); this.moonMesh.visible = elev < 0.1; }
    if (this.cloudMat) { this.cloudMat.color.setScalar(0.25 + 0.75 * day); this.cloudMat.color.lerp(C("#ffb08a"), dusk * 0.3); }
    RIM.color.value.set("#bcd4ff").lerp(C("#ffb97a"), dusk * 0.7).lerp(C("#5a7ad8"), night * 0.8);
    RIM.strength.value = 0.2 + 0.2 * (1 - night * 0.5);
    return night;
  }
  lightDir = new THREE.Vector3(0.3, 1, 0.3);

  // ---------- Ландшафт ----------
  private buildTerrain() {
    const z = this.zone;
    const size = z.half * 2 + 50, seg = Math.min(420, Math.round(size / 1.25));
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const C = (h: string) => new THREE.Color(h);
    const gl = C(z.ground.low), gm = C(z.ground.mid), gh = C(z.ground.high), gr = C(z.ground.rock), gp = C(z.ground.path), gs = C(z.ground.sand);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i);
      const h = z.height(x, zz);
      p.setY(i, h);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i), h = p.getY(i);
      const ny = nrm.getY(i);
      const patch = fbm(x * 0.05 + 3, zz * 0.05 + 9, 3);
      const fine = noise2(x * 0.8, zz * 0.8);
      tmp.copy(gl).lerp(gm, smoothstep(0.25, 0.6, patch)).lerp(gh, smoothstep(0.55, 0.85, patch) * 0.8);
      tmp.lerp(gh, smoothstep(2, 7, h) * 0.35);
      // сухие пятна
      if (z.id === "meadow") tmp.lerp(C("#a8b84a"), smoothstep(0.62, 0.8, fbm(x * 0.03 + 40, zz * 0.03, 3)) * 0.5);
      // скалы на склонах
      const rockK = smoothstep(0.78, 0.55, ny);
      tmp.lerp(gr, rockK);
      if (z.id !== "desert") tmp.lerp(gr, smoothstep(14, 24, h) * 0.8);
      // песок/ил у воды
      const wl = z.waterLevel;
      if (h < wl + 0.6 && z.id !== "crypt") tmp.lerp(gs, smoothstep(wl + 0.6, wl + 0.0, h) * 0.9);
      if (h < wl - 0.2 && z.id !== "crypt") tmp.lerp(C("#5a5a48"), smoothstep(wl - 0.2, wl - 1.0, h));
      // дорожки
      const pd = this.pathDist(x, zz);
      if (pd < 3.4) tmp.lerp(gp, (1 - smoothstep(1.5, 3.4, pd)) * (0.75 + fine * 0.25));
      // хаб (утоптанная площадка)
      const hd = Math.hypot(x - z.hub.x, zz - z.hub.z);
      if (hd < z.hub.r * 0.55 && z.id !== "crypt") tmp.lerp(gp, (1 - smoothstep(z.hub.r * 0.3, z.hub.r * 0.55, hd)) * 0.5);
      const k = 0.9 + fine * 0.2;
      col[i * 3] = tmp.r * k; col[i * 3 + 1] = tmp.g * k; col[i * 3 + 2] = tmp.b * k;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const noiseTex = canvasTexture(256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) { const v = 205 + Math.random() * 50; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    });
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.repeat.set(70, 70);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: noiseTex });
    const ter = new THREE.Mesh(geo, mat);
    ter.receiveShadow = true;
    this.group.add(ter);
  }

  private buildWater() {
    const z = this.zone;
    const mk = (flow: number) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uTime: { value: 0 }, uFlow: { value: flow }, uShallow: { value: new THREE.Color(z.waterColor) }, uDeep: { value: new THREE.Color(z.waterDeep) }, uSkyCol: { value: new THREE.Color(z.sky.horizon) },
        }]),
      });
      this.waterMats.push(m);
      return m;
    };
    if (z.river) {
      const pos: number[] = [], edge: number[] = [], idx: number[] = [];
      const N = 130;
      for (let i = 0; i <= N; i++) {
        const zz = -130 + (i / N) * 260;
        const cx = z.river.cx(zz);
        for (const [dx, e] of [[-11, 1], [0, 0], [11, 1]] as [number, number][]) { pos.push(cx + dx, z.waterLevel, zz); edge.push(e); }
        if (i < N) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mk(1)); m.renderOrder = 2; this.group.add(m);
    }
    for (const pd of z.ponds) {
      const g = new THREE.CircleGeometry(pd.r + 6, 40);
      g.rotateX(-Math.PI / 2);
      const e = new Float32Array(g.attributes.position.count);
      for (let i = 0; i < e.length; i++) e[i] = Math.min(1, Math.hypot(g.attributes.position.getX(i), g.attributes.position.getZ(i)) / (pd.r + 6));
      g.setAttribute("aEdge", new THREE.BufferAttribute(e, 1));
      const m = new THREE.Mesh(g, mk(0)); m.position.set(pd.x, z.waterLevel, pd.z); m.renderOrder = 2; this.group.add(m);
      if (z.id === "forest" || z.id === "desert") {
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4, r = pd.r * (0.3 + (i % 3) * 0.2);
          const lp = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), stdMat(z.id === "forest" ? "#3f9a4a" : "#4aa84a", { rough: 0.7, side: THREE.DoubleSide }));
          lp.rotation.x = -Math.PI / 2; lp.position.set(pd.x + Math.cos(a) * r, z.waterLevel + 0.05, pd.z + Math.sin(a) * r); this.group.add(lp);
          const fl = new THREE.Mesh(sphere(0.18, 1, 0.7, 1, 8), basicMat(z.id === "forest" ? "#ff9ad8" : "#ffffff")); fl.position.copy(lp.position); fl.position.y += 0.12; this.group.add(fl);
        }
      }
    }
  }

  private pushCollider(arr: Collider[], ox: number, oz: number, ry: number, s: number) {
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const k of arr) {
      const lx = k.x * s, lz = k.z * s;
      this.addCollider({ x: ox + lx * c + lz * sn, z: oz - lx * sn + lz * c, r: k.r });
    }
  }

  private buildStructures() {
    const z = this.zone;
    for (const b of z.buildings) {
      const st: Struct | null = buildStructure(b.kind, b.s ?? 1);
      if (!st) continue;
      const gy = z.height(b.x, b.z);
      let y = gy;
      if (b.kind === "bridge") { y = z.waterLevel + 0.2; this.bridgeDecks.push({ x: b.x, z: b.z, by: y }); }
      else if (b.kind === "dock") { y = z.waterLevel + 0.45; this.docks.push({ x: b.x, z: b.z, y }); }
      else if (["cottage", "windmill", "stall", "well", "watchtower", "tent", "bigtent", "pyramid", "giantTree", "throne"].includes(b.kind)) y = gy - 0.05;
      st.obj.position.set(b.x, y, b.z);
      st.obj.rotation.y = b.ry ?? 0;
      this.group.add(st.obj);
      this.pushCollider(st.colliders, b.x, b.z, b.ry ?? 0, b.s ?? 1);
      if (st.update) this.updaters.push(st.update);
      if (st.fire) this.fires.push({ x: b.x + st.fire.x, y: y + st.fire.y, z: b.z + st.fire.z, color: st.fire.color });
    }
    st_cache.length = 0;
  }

  private blockers(): { x: number; z: number; r: number }[] {
    const z = this.zone;
    const out: { x: number; z: number; r: number }[] = [];
    for (const b of z.buildings) {
      if (b.kind === "fence" || b.kind === "bridge") continue;
      const r = { cottage: 9, windmill: 6, pyramid: 22, giantTree: 9, ruins: 10, cave: 9, stones: 8, garden: 5, stall: 4, tent: 4, bigtent: 7, obelisk: 4, bones: 5, cryptgate: 12, throne: 6, shrine: 5, watchtower: 4, dock: 6, haystack: 3 }[b.kind] ?? 2.5;
      out.push({ x: b.x, z: b.z, r: r * (b.s ?? 1) });
    }
    for (const p of z.portals) out.push({ x: p.x, z: p.z, r: 9 });
    for (const n of Object.values(NPCS)) if (n.zone === z.id) out.push({ x: n.x, z: n.z, r: 2.5 });
    out.push({ x: z.hub.x, z: z.hub.z, r: 0 });
    return out;
  }

  private buildProps() {
    const z = this.zone;
    const rnd = mulberry(z.id.length * 977 + 13);
    const blockers = this.blockers();
    const tint: Record<string, [number, number, number]> = { meadow: [1, 1, 0.95], desert: [1, 0.98, 0.9], forest: [0.82, 0.95, 0.92], crypt: [0.55, 0.6, 0.7], ...(ZONE_TINT as Record<string, [number, number, number]>) };
    const baseTint = tint[z.id];
    const byKind = new Map<string, { mats: THREE.Matrix4[]; cols: THREE.Color[] }>();
    const tmpV = new THREE.Vector3();
    z.props.forEach((rule, ri) => {
      const ft = getFlora(rule.kind, 1 + (ri % 3));
      if (!ft) return;
      let placed = 0, tries = 0;
      const max = rule.n * 30;
      while (placed < rule.n && tries++ < max) {
        let x: number, zz: number;
        if (rule.region) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rule.region.r; x = rule.region.x + Math.cos(a) * r; zz = rule.region.z + Math.sin(a) * r; }
        else { x = (rnd() - 0.5) * 2 * (z.half - 5); zz = (rnd() - 0.5) * 2 * (z.half - 5); }
        if (z.cave ? Math.hypot(x, zz) > z.half - 16 : Math.abs(x) > z.half - 2 || Math.abs(zz) > z.half - 2) continue;
        const h = z.height(x, zz);
        const isReed = rule.kind === "reeds";
        if (!isReed && h < z.waterLevel + 0.3 && z.id !== "crypt") continue;
        if (rule.minH !== undefined && h < rule.minH) continue;
        if (rule.maxH !== undefined && h > rule.maxH) continue;
        if (this.slope(x, zz) > (rule.maxSlope ?? (ft.collide > 0.4 ? 0.55 : 0.8))) continue;
        if (h > 12 && z.id !== "crypt") continue;
        const big = ft.collide > 0.2;
        if (rule.avoidHub && Math.hypot(x - z.hub.x, zz - z.hub.z) < z.hub.r + 4) continue;
        if (big && this.pathDist(x, zz) < 3.5) continue;
        if (!big && this.pathDist(x, zz) < 1.5 && rule.kind !== "reeds") continue;
        let bad = false;
        for (const b of blockers) if ((x - b.x) ** 2 + (zz - b.z) ** 2 < (b.r + (big ? 2.5 : 0.5)) ** 2) { bad = true; break; }
        if (bad) continue;
        if (ft.collide > 0 && this.blocked(x, zz, ft.collide + 0.6)) continue;
        const s = lerp(rule.s?.[0] ?? 0.8, rule.s?.[1] ?? 1.3, rnd());
        const m = new THREE.Matrix4().compose(tmpV.set(x, h - 0.05, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.06, rnd() * 6.28, (rnd() - 0.5) * 0.06)), new THREE.Vector3(s, s * (0.9 + rnd() * 0.25), s));
        const v = 0.85 + rnd() * 0.3;
        const c = new THREE.Color(baseTint[0] * v, baseTint[1] * (0.9 + rnd() * 0.2), baseTint[2] * v);
        if (rule.kind === "flowers") c.setHSL(rnd(), 0.8, 0.6);
        const key = `${rule.kind}:${1 + (ri % 3)}`;
        if (!byKind.has(key)) byKind.set(key, { mats: [], cols: [] });
        byKind.get(key)!.mats.push(m); byKind.get(key)!.cols.push(c);
        if (ft.collide > 0) this.addCollider({ x, z: zz, r: ft.collide * s });
        placed++;
      }
    });
    for (const [key, data] of byKind) {
      const [kind, seed] = key.split(":");
      const ft = getFlora(kind, Number(seed))!;
      const im = new THREE.InstancedMesh(ft.geo, ft.mat, data.mats.length);
      data.mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, data.cols[i]); });
      im.castShadow = ft.shadow; im.frustumCulled = false;
      this.group.add(im);
    }
  }

  private buildGrass() {
    const z = this.zone;
    const count = z.id === "meadow" ? 20000 : z.id === "forest" ? 16000 : 0;
    if (!count) return;
    const ft = getFlora("grass")!;
    const rnd = mulberry(4242);
    const blockers = this.blockers();
    const mats: THREE.Matrix4[] = [], cols: THREE.Color[] = [];
    let tries = 0;
    while (mats.length < count && tries++ < count * 4) {
      const x = (rnd() - 0.5) * 2 * (z.half - 4), zz = (rnd() - 0.5) * 2 * (z.half - 4);
      const h = z.height(x, zz);
      if (h < z.waterLevel + 0.5 || h > 11) continue;
      if (noise2(x * 0.06 + 5, zz * 0.06) < 0.28 && rnd() < 0.8) continue;
      if (this.slope(x, zz) > 0.7) continue;
      if (this.pathDist(x, zz) < 2) continue;
      let bad = false;
      for (const b of blockers) if ((x - b.x) ** 2 + (zz - b.z) ** 2 < (b.r) ** 2) { bad = true; break; }
      if (bad) continue;
      const s = 0.8 + rnd() * 0.9;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.02, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s * (0.8 + rnd() * 0.6), s)));
      const v = 0.75 + rnd() * 0.5;
      cols.push(z.id === "forest" ? new THREE.Color(0.7 * v, 0.95 * v, 0.8 * v) : new THREE.Color(v, v * (0.95 + rnd() * 0.15), 0.8 * v));
    }
    const im = new THREE.InstancedMesh(ft.geo, ft.mat, mats.length);
    mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
    im.frustumCulled = false;
    this.group.add(im);
  }

  private buildPortals() {
    const z = this.zone;
    const gt = glowTexture("#ffffff");
    for (const p of z.portals) {
      const g = new THREE.Group();
      const y = z.height(p.x, p.z);
      g.position.set(p.x, y, p.z);
      const toCenter = Math.atan2(-p.x, -p.z); // лицом к центру
      g.rotation.y = toCenter;
      const color = p.to === "desert" ? "#ffb040" : p.to === "forest" ? "#6aff9a" : p.to === "crypt" ? "#8a5cff" : "#6ab8ff";
      const st = stdMat("#6a6a72", { rough: 0.9, flat: true });
      for (const s of [-1, 1]) {
        const pil = mesh(new THREE.CylinderGeometry(0.55, 0.7, 6.2, 8), st); pil.position.set(s * 3.0, 3.0, 0); g.add(pil);
        const cap = mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), st); cap.position.set(s * 3.0, 6.3, 0); g.add(cap);
        const gem = mesh(sphere(0.3), basicMat(color)); gem.position.set(s * 3.0, 6.9, 0); g.add(gem);
      }
      const lintel = mesh(new THREE.TorusGeometry(3.0, 0.45, 8, 20, Math.PI), st); lintel.position.set(0, 5.4, 0); g.add(lintel);
      const ring = mesh(new THREE.TorusGeometry(2.7, 0.12, 8, 40), basicMat(color, 0.9, true), false); ring.position.y = 3.2; g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: PORTAL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } } }));
      disc.position.y = 3.2; g.add(disc);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(10); sp.position.y = 3.2; g.add(sp);
      this.group.add(g);
      this.portals.push({ ...p, obj: g });
      this.addCollider({ x: p.x + Math.cos(toCenter) * 3, z: p.z - Math.sin(toCenter) * 3, r: 0.8 });
      this.addCollider({ x: p.x - Math.cos(toCenter) * 3, z: p.z + Math.sin(toCenter) * 3, r: 0.8 });
      this.updaters.push((t) => { (disc.material as THREE.ShaderMaterial).uniforms.uTime.value = t; ring.rotation.z = t * 0.5; ring.scale.setScalar(1 + Math.sin(t * 2) * 0.02); });
    }
  }

  private buildGathers() {
    const z = this.zone;
    z.gathers.forEach((d, i) => {
      const color = GATHER_COLORS[d.item] ?? "#ffffff";
      const g = new THREE.Group();
      const gy = Math.max(z.height(d.x, d.z), d.item === "river_fish" ? z.waterLevel : -99);
      g.position.set(d.x, gy, d.z);
      const ring = mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 20), basicMat(color, 0.7, true), false); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      const orb = mesh(sphere(0.2), basicMat(color, 0.95, true), false); orb.position.y = 0.8; g.add(orb);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("#ffffff"), color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(2.0); halo.position.y = 0.8; g.add(halo);
      const beam = mesh(new THREE.CylinderGeometry(0.06, 0.18, 4.2, 8, 1, true), basicMat(color, 0.14, true), false); beam.position.y = 2.2; g.add(beam);
      if (d.item === "healing_herb") for (let k = 0; k < 5; k++) { const lf = mesh(new THREE.ConeGeometry(0.1, 0.5, 4), stdMat("#4ac84a", { rough: 0.8 }), false); lf.position.set(Math.cos(k * 1.3) * 0.2, 0.25, Math.sin(k * 1.3) * 0.2); lf.rotation.set(Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4); g.add(lf); }
      if (d.item === "cactus_water") { const c = getFlora("cactus", 2)!; const m = mesh(c.geo, c.mat); m.scale.setScalar(0.4); g.add(m); }
      if (d.item === "moon_blossom") for (let k = 0; k < 6; k++) { const pt = mesh(sphere(0.12, 1, 0.4, 1.8, 6), basicMat("#d8c0ff"), false); pt.position.set(Math.cos(k * 1.05) * 0.2, 0.35, Math.sin(k * 1.05) * 0.2); pt.rotation.y = -k * 1.05; g.add(pt); }
      this.group.add(g);
      const node: GatherNode = { id: i, item: d.item, label: d.label, x: d.x, z: d.z, obj: g, taken: false, respawn: 0, color };
      this.gathers.push(node);
      this.updaters.push((t) => { if (g.visible) { orb.position.y = 0.8 + Math.sin(t * 2 + i) * 0.12; ring.rotation.z = t; halo.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.15; } });
    });
  }

  private makePoints(n: number, color: string, size: number, additive: boolean, fn: (i: number, t: number, base: Float32Array, out: THREE.Vector3) => void, range: number, opacity = 0.9) {
    const geo = new THREE.BufferGeometry();
    const base = new Float32Array(n * 3);
    const rnd = mulberry(n * 31 + Math.floor(size * 100));
    for (let i = 0; i < n * 3; i++) base[i] = rnd();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ color, size, map: glowTexture("#ffffff"), transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    const out = new THREE.Vector3();
    this.pts.push({
      pts, fn: (t, f) => {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < n; i++) {
          fn(i, t, base, out);
          // оборачивание вокруг фокуса
          let x = out.x - f.x, zz = out.z - f.z;
          x = ((x % (range * 2)) + range * 3) % (range * 2) - range; zz = ((zz % (range * 2)) + range * 3) % (range * 2) - range;
          const wx = f.x + x, wz = f.z + zz;
          pos.setXYZ(i, wx, this.zone.height(wx, wz) + out.y, wz);
        }
        pos.needsUpdate = true;
      },
    });
  }

  private butterflies: { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; cx: number; cz: number; ph: number; sp: number; h: number }[] = [];
  private buildAmbient() {
    const z = this.zone;
    if (z.ambient === "butterflies") {
      const cols = ["#ffd24d", "#ff7aa8", "#7ab8ff", "#ffffff", "#ff9a3a"];
      for (let i = 0; i < 26; i++) {
        const g = new THREE.Group();
        const m = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
        const geo = new THREE.PlaneGeometry(0.2, 0.16); geo.translate(0.1, 0, 0);
        const wl = new THREE.Mesh(geo, m), wr = new THREE.Mesh(geo, m); wr.scale.x = -1;
        g.add(wl, wr); this.group.add(g);
        this.butterflies.push({ g, wl, wr, cx: (Math.random() - 0.5) * 120, cz: (Math.random() - 0.5) * 120, ph: Math.random() * 10, sp: 0.4 + Math.random() * 0.5, h: 0.8 + Math.random() * 1.6 });
      }
      this.makePoints(120, "#ffffff", 0.25, true, (i, t, b, o) => o.set(b[i * 3] * 40 + Math.sin(t * 0.5 + i) * 1.5, 1 + b[i * 3 + 1] * 5 + Math.sin(t * 0.8 + i * 2) * 0.4, b[i * 3 + 2] * 40 + t * 0.6), 20, 0.5);
    } else if (z.ambient === "fireflies") {
      this.makePoints(200, "#c8ff8a", 0.5, true, (i, t, b, o) => o.set(b[i * 3] * 50 + Math.sin(t * 0.4 + i) * 2, 0.6 + b[i * 3 + 1] * 4 + Math.sin(t * 1.1 + i * 3) * 0.5, b[i * 3 + 2] * 50 + Math.cos(t * 0.35 + i) * 2), 25, 0.9);
      this.makePoints(100, "#9affd8", 0.35, true, (i, t, b, o) => o.set(b[i * 3] * 50 + t * 0.4, 0.5 + ((b[i * 3 + 1] * 6 + t * 0.3) % 6), b[i * 3 + 2] * 50), 25, 0.6);
    } else if (z.ambient === "dust") {
      this.makePoints(260, "#f0d8a0", 0.3, false, (i, t, b, o) => o.set(b[i * 3] * 60 + t * 6 + b[i * 3 + 1] * 3, 0.3 + b[i * 3 + 1] * 3 + Math.sin(t + i) * 0.2, b[i * 3 + 2] * 60 + Math.sin(t * 0.5 + i) * 2), 30, 0.35);
    } else if (z.ambient === "spores") {
      this.makePoints(240, "#8affb0", 0.35, true, (i, t, b, o) => o.set(b[i * 3] * 60 + Math.sin(t * 0.3 + i) * 2, 0.5 + ((b[i * 3 + 1] * 14 + t * 0.35) % 14), b[i * 3 + 2] * 60), 30, 0.6);
    }
  }

  private buildCeiling() {
    const g = new THREE.CircleGeometry(150, 40);
    g.rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, 52 + noise2(p.getX(i) * 0.05, p.getZ(i) * 0.05) * 10 - smoothstep(60, 150, r) * 6); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, stdMat("#0e0e12", { rough: 1, side: THREE.DoubleSide }));
    this.group.add(m);
    const st = new THREE.ConeGeometry(1.4, 10, 6); st.rotateX(Math.PI);
    const rnd = mulberry(99);
    const im = new THREE.InstancedMesh(st, new THREE.MeshStandardMaterial({ color: "#1a1a20", roughness: 1, flatShading: true }), 90);
    for (let i = 0; i < 90; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 85; const s = 0.6 + rnd() * 1.4; im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 49 + noise2(Math.cos(a) * r * 0.05, Math.sin(a) * r * 0.05) * 10 - 4, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, s * (1 + rnd()), s))); }
    this.group.add(im);
    // зеркальное свечение пола
    void blobGeo;
  }

  update(t: number, dt: number, focus: THREE.Vector3) {
    WIND.uTime.value = t;
    this.waterMats.forEach((m) => (m.uniforms.uTime.value = t));
    this.updaters.forEach((u) => u(t, dt));
    this.skyMesh.position.copy(focus);
    this.cloudGroup.position.set(focus.x + t * 2, 0, focus.z + t * 1.2);
    this.cloudGroup.children.forEach((c) => { c.position.x = ((c.position.x + 450 - t * 0.02) % 900) - 450 + 0; });
    // солнце и тени следуют за игроком
    const ld = this.zone.cave ? new THREE.Vector3(...this.zone.sky.sunPos).normalize() : this.lightDir;
    this.sunRef.position.set(focus.x + ld.x * 150, focus.y + Math.max(ld.y, 0.15) * 150, focus.z + ld.z * 150);
    this.sunRef.target.position.copy(focus);
    // огни
    if (this.fires.length && this.fireLights.length) {
      const sorted = [...this.fires].sort((a, b) => (a.x - focus.x) ** 2 + (a.z - focus.z) ** 2 - ((b.x - focus.x) ** 2 + (b.z - focus.z) ** 2));
      this.fireLights.forEach((l, i) => {
        const f = sorted[i];
        if (!f) { l.intensity = 0; return; }
        l.position.set(f.x, f.y, f.z); l.color.set(f.color);
        l.intensity = (this.zone.id === "crypt" ? 40 : 30) * (0.55 + this.night * 0.9) * (0.85 + Math.sin(t * 12 + i * 3) * 0.1 + Math.sin(t * 7.3 + i) * 0.05);
      });
    }
    this.pts.forEach((p) => p.fn(t, focus));
    this.butterflies.forEach((b) => {
      b.ph += dt * b.sp;
      const dx = b.cx - focus.x, dz = b.cz - focus.z;
      if (dx * dx + dz * dz > 50 * 50) { const a = Math.random() * 6.28; b.cx = focus.x + Math.cos(a) * 30; b.cz = focus.z + Math.sin(a) * 30; }
      const x = b.cx + Math.sin(b.ph * 1.3) * 6 + Math.sin(b.ph * 3.1) * 1.5, zz = b.cz + Math.cos(b.ph) * 6;
      const y = this.zone.height(x, zz) + b.h + Math.sin(t * 2 + b.ph * 5) * 0.3;
      b.g.rotation.y = Math.atan2(Math.cos(b.ph * 1.3) * 1.3, -Math.sin(b.ph)) ;
      b.g.position.set(x, y, zz);
      const f = Math.sin(t * 22 + b.ph * 10) * 0.9;
      b.wl.rotation.z = f; b.wr.rotation.z = -f;
    });
    // респаун сборных узлов
    for (const g of this.gathers) if (g.taken && t > g.respawn) { g.taken = false; g.obj.visible = true; }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry && !(m instanceof THREE.InstancedMesh)) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else if (mat && (mat as THREE.ShaderMaterial).isShaderMaterial) mat.dispose();
    });
    this.scene.fog = null;
  }
}
const st_cache: unknown[] = [];
void WIND;
