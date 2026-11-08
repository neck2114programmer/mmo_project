import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { noise2, mulberry } from "../data/balance";

export { mulberry };
export const WIND = { uTime: { value: 0 } };

export function stdMat(color: THREE.ColorRepresentation, o: Partial<{ rough: number; metal: number; emissive: string | number; ei: number; side: THREE.Side; vc: boolean; flat: boolean; transparent: boolean; opacity: number }> = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    side: o.side ?? THREE.FrontSide, vertexColors: o.vc ?? false, flatShading: o.flat ?? false, transparent: o.transparent ?? false, opacity: o.opacity ?? 1,
  });
}

export function basicMat(color: string | number, opacity = 1, additive = false) {
  return new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1 || additive, opacity, depthWrite: !additive && opacity >= 1,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
  });
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = false;
  return m;
}

/** Сглаженная лофт-фигура вращения: profile — пары [радиус, y] */
export function lathe(profile: [number, number][], seg = 14) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
}

/** Конус-капсула: верх (y=0, радиус r0) -> низ (y=-len, радиус r1), скруглённые концы */
export function limb(r0: number, r1: number, len: number, seg = 12) {
  const pts: [number, number][] = [];
  const cap = 5;
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push([Math.sin(a) * r1, -len - r1 * Math.cos(a)]);
  }
  pts.push([((r0 + r1) / 2) * 1.03, -len / 2]);
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push([Math.cos(a) * r0, r0 * Math.sin(a)]);
  }
  return lathe(pts, seg);
}

export function sphere(r: number, sx = 1, sy = 1, sz = 1, seg = 20) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(8, Math.floor(seg * 0.7)));
  g.scale(sx, sy, sz);
  return g;
}

export function tube(points: THREE.Vector3[], r0: number, r1: number, seg = 16, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  // сужение: радиус меняется по длине
  const pos = g.attributes.position;
  const nSeg = seg + 1;
  const center = new THREE.Vector3();
  for (let i = 0; i < nSeg; i++) {
    const t = i / seg;
    curve.getPointAt(t, center);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Органичная «кочка» листвы: икосаэдр, смещённый шумом, со сглаженными нормалями */
export function blobGeo(radius: number, detail = 2, amp = 0.25, seed = 1, sy = 1) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 0.001);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise2(v.x * 1.7 + seed * 13, v.z * 1.7 + v.y * 1.3 + seed * 7, seed);
    const k = 1 + (n - 0.5) * 2 * amp;
    p.setXYZ(i, v.x * k, v.y * k * sy, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function colorize(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0, seed = 1) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const rnd = mulberry(seed);
  const j = (rnd() - 0.5) * jitter;
  for (let i = 0; i < n; i++) {
    arr[i * 3] = Math.min(1, Math.max(0, c.r + j));
    arr[i * 3 + 1] = Math.min(1, Math.max(0, c.g + j));
    arr[i * 3 + 2] = Math.min(1, Math.max(0, c.b + j * 0.6));
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Вертикальный градиент вершинных цветов (низ -> верх) */
export function gradientColor(g: THREE.BufferGeometry, bottom: THREE.ColorRepresentation, top: THREE.ColorRepresentation, y0: number, y1: number, noiseAmp = 0.08, seed = 1) {
  const cb = new THREE.Color(bottom), ct = new THREE.Color(top);
  const p = g.attributes.position;
  const arr = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0 || 1)));
    const nz = (noise2(p.getX(i) * 3 + seed, p.getZ(i) * 3, seed) - 0.5) * noiseAmp;
    c.copy(cb).lerp(ct, t);
    arr[i * 3] = c.r + nz;
    arr[i * 3 + 1] = c.g + nz;
    arr[i * 3 + 2] = c.b + nz * 0.7;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(geos: THREE.BufferGeometry[]) {
  const norm = geos.map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    if (!c.attributes.color) colorize(c, 0xffffff);
    c.deleteAttribute("uv");
    return c;
  });
  const m = mergeGeometries(norm, false);
  return m ?? new THREE.BufferGeometry();
}

export function xform(g: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] | number = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    typeof scale === "number" ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  return g;
}

/** Ветер: покачивание вершин по высоте (для деревьев, травы, кустов) */
export function swayify(mat: THREE.Material, amp = 0.012, extra = "") {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND.uTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          float hh = max(position.y, 0.0);
          #ifdef USE_INSTANCING
            vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 ip = vec2(0.0);
          #endif
          float ph = ip.x * 0.31 + ip.y * 0.23;
          float w1 = sin(uTime * 1.6 + ph + position.x * 0.8) + 0.5 * sin(uTime * 3.3 + ph * 1.7 + position.z * 1.4);
          transformed.x += w1 * ${amp.toFixed(4)} * hh;
          transformed.z += cos(uTime * 1.25 + ph) * ${(amp * 0.7).toFixed(4)} * hh;
          ${extra}
        }`,
      );
  };
  mat.customProgramCacheKey = () => `sway_${amp}_${extra.length}`;
  return mat;
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = mats.length;
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = shadow;
  im.receiveShadow = false;
  im.frustumCulled = false;
  return im;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function placeMatrix(x: number, y: number, z: number, ry = 0, s = 1, sy = s, tilt = 0) {
  _e.set(tilt, ry, 0);
  _q.setFromEuler(_e);
  return _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, sy, s)).clone();
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function glowTexture(color = "#ffffff", soft = 0.0) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.25 + soft, color + "88");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}

export const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Безопасное присвоение position/scale/rotation объекту three.js */
export function assignT<T extends THREE.Object3D>(o: T, p: { position?: THREE.Vector3; scale?: THREE.Vector3; rotation?: THREE.Euler }): T {
  if (p.position) o.position.copy(p.position);
  if (p.scale) o.scale.copy(p.scale);
  if (p.rotation) o.rotation.copy(p.rotation);
  return o;
}

/** Общий источник «ободкового» света для персонажей (цвет/сила меняются по времени суток) */
export const RIM = { color: { value: new THREE.Color("#bcd4ff") }, strength: { value: 0.32 } };
export function rimify(m: THREE.Material | THREE.Material[]) {
  const list = Array.isArray(m) ? m : [m];
  for (const mat of list) {
    if (!(mat instanceof THREE.MeshStandardMaterial) || (mat.userData as { rim?: boolean }).rim) continue;
    (mat.userData as { rim?: boolean }).rim = true;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRimC = RIM.color; sh.uniforms.uRimS = RIM.strength;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimC; uniform float uRimS;")
        .replace("#include <opaque_fragment>", "float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.6);\n outgoingLight += rimF * uRimC * uRimS * (0.35 + 0.65 * saturate(normal.y * 0.5 + 0.6));\n#include <opaque_fragment>");
    };
    mat.customProgramCacheKey = () => "rimlit";
  }
}
