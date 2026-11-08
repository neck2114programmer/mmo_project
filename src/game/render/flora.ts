import * as THREE from "three";
import { blobGeo, colorize, gradientColor, merge, mulberry, stdMat, swayify, tube, xform, lathe, limb } from "./util";

export interface FloraType {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  shadow: boolean;
  collide: number; // радиус коллайдера (0 — нет)
  color?: boolean; // использовать instanceColor
  scaleY?: number;
}

const cache = new Map<string, FloraType>();
const T = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function foliageMat(amp = 0.012) {
  return swayify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), amp);
}
function flatMat() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
}

function trunk(pts: THREE.Vector3[], r0: number, r1: number, c0: string, c1: string, seg = 12, radial = 8) {
  const g = tube(pts, r0, r1, seg, radial);
  const top = pts[pts.length - 1].y;
  return gradientColor(g, c0, c1, 0, top, 0.08, 3);
}

function blob(r: number, x: number, y: number, z: number, seed: number, c0: string, c1: string, y0: number, y1: number, sy = 0.85) {
  const g = blobGeo(r, 2, 0.28, seed, sy);
  xform(g, [x, y, z]);
  return gradientColor(g, c0, c1, y0, y1, 0.12, seed);
}

function oak(seed: number, scale = 1, c0 = "#2a6a2c", c1 = "#8fd04e"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(trunk([T(0, 0, 0), T(0.12, 1.2, 0.05), T(-0.06, 2.4, 0.1), T(0.1, 3.5, 0)], 0.36, 0.16, "#4a3322", "#6b4a30"));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed;
    parts.push(xform(trunk([T(0, 0.5, 0), T(Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35), T(Math.cos(a) * 0.8, 0.0, Math.sin(a) * 0.8)], 0.14, 0.04, "#4a3322", "#4a3322", 6, 5)));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + seed * 2;
    parts.push(xform(trunk([T(0, 2.3, 0), T(Math.cos(a) * 0.7, 3.0, Math.sin(a) * 0.7), T(Math.cos(a) * 1.5, 3.9, Math.sin(a) * 1.5)], 0.14, 0.06, "#4a3322", "#6b4a30", 6, 5)));
  }
  const bl: [number, number, number, number][] = [[0, 5.4, 0, 1.9], [1.7, 4.5, 0.5, 1.4], [-1.6, 4.7, -0.4, 1.5], [0.4, 4.3, -1.7, 1.3], [0.1, 6.5, 0.2, 1.3], [-0.7, 5.3, 1.5, 1.3], [1.2, 5.6, -1.0, 1.2]];
  bl.forEach(([x, y, z, r], i) => parts.push(blob(r, x, y, z, seed * 10 + i, c0, c1, 3.0, 7.6)));
  const g = merge(parts);
  return scale === 1 ? g : xform(g, [0, 0, 0], [0, 0, 0], scale);
}

function pine(seed: number, c0 = "#1b4a2c", c1 = "#4a8a52"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(trunk([T(0, 0, 0), T(0.05, 3, 0.02), T(0, 6, 0)], 0.3, 0.06, "#4a3624", "#5e4630", 8, 7));
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 2.1 * (1 - t) + 0.45, h = 2.0 - t * 0.3;
    const y = 1.5 + i * 1.0;
    let cone: THREE.BufferGeometry = new THREE.ConeGeometry(r, h, 12, 2);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k), yy = p.getY(k);
      const a = Math.atan2(z, x);
      const low = (h / 2 - yy) / h; // 0 сверху, 1 снизу
      const wob = 1 + Math.sin(a * 7 + i + seed) * 0.12 * low + (Math.sin(a * 3 + i * 2) * 0.08);
      p.setXYZ(k, x * wob, yy - Math.sin(a * 5 + i) * 0.12 * low - low * low * 0.2, z * wob);
    }
    cone.computeVertexNormals();
    xform(cone, [0, y + h / 2, 0], [0, i * 0.7, 0]);
    cone = gradientColor(cone, c0, c1, y - 0.2, y + h, 0.1, i + seed);
    parts.push(cone);
  }
  return merge(parts);
}

function birch(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const g = tube([T(0, 0, 0), T(0.2, 1.5, 0.05), T(0.05, 3.0, -0.1), T(0.25, 4.4, 0)], 0.17, 0.07, 12, 7);
  // белая кора с тёмными пятнами
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const m = Math.sin(p.getY(i) * 7 + Math.atan2(p.getZ(i), p.getX(i)) * 3) > 0.82 ? 0.15 : 0.92;
    col[i * 3] = m; col[i * 3 + 1] = m * 0.98; col[i * 3 + 2] = m * 0.92;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  parts.push(g);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + seed; parts.push(xform(trunk([T(0, 2.6, 0), T(Math.cos(a) * 0.6, 3.4, Math.sin(a) * 0.6), T(Math.cos(a) * 1.1, 4.4, Math.sin(a) * 1.1)], 0.06, 0.03, "#d8d4c4", "#b8b4a4", 5, 5))); }
  const bl: [number, number, number, number][] = [[0.2, 4.8, 0, 1.3], [1.0, 4.0, 0.4, 0.95], [-0.9, 4.2, -0.3, 1.0], [0.1, 5.7, 0.1, 0.9], [0.3, 4.0, -1.0, 0.85]];
  bl.forEach(([x, y, z, r], i) => parts.push(blob(r, x, y, z, seed * 7 + i, "#6aa83a", "#d4e86a", 3.6, 6.4)));
  return merge(parts);
}

function willow(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(trunk([T(0, 0, 0), T(0.3, 1.2, 0.1), T(0.0, 2.4, 0.2), T(0.2, 3.2, 0)], 0.4, 0.2, "#4a3a2a", "#5e4a36"));
  parts.push(blob(2.4, 0, 4.2, 0, seed, "#4a8a3a", "#9ad04e", 2.5, 6.0, 0.6));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, rr = 1.6 + (i % 3) * 0.4;
    const len = 2.4 + (i % 4) * 0.4;
    const s = limb(0.06, 0.01, len, 4);
    parts.push(gradientColor(xform(s, [Math.cos(a) * rr, 3.8 - (i % 3) * 0.2, Math.sin(a) * rr]), "#8ac84a", "#4a8a3a", 0, 4, 0.1, i));
  }
  return merge(parts);
}

function palm(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pts = [T(0, 0, 0), T(0.3, 1.8, 0), T(0.9, 3.6, 0.1), T(1.2, 5.3, 0.1)];
  const g = tube(pts, 0.26, 0.15, 14, 8);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const ring = Math.sin(p.getY(i) * 9) > 0.4 ? 0.7 : 1; col[i * 3] = 0.62 * ring; col[i * 3 + 1] = 0.48 * ring; col[i * 3 + 2] = 0.32 * ring; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  parts.push(g);
  const top = pts[3];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + seed;
    const frond = new THREE.PlaneGeometry(0.9, 3.4, 4, 8);
    const fp = frond.attributes.position;
    for (let k = 0; k < fp.count; k++) {
      const u = (fp.getY(k) + 1.7) / 3.4; // 0..1 вдоль листа
      const w = fp.getX(k) * (1 - u * u * 0.8) * (1 + Math.sin(u * 40) * 0.1 * 0);
      fp.setXYZ(k, w, u * 3.0 * 0.7, -Math.pow(u, 2) * 1.8 + Math.abs(fp.getX(k)) * 0.4);
    }
    frond.computeVertexNormals();
    xform(frond, [0, 0, 0], [0, 0, 0]);
    // поворот вокруг вертикали и подъём
    const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(-0.5 - (i % 2) * 0.3));
    frond.applyMatrix4(m);
    frond.translate(top.x, top.y, top.z);
    parts.push(gradientColor(frond, "#2f7a2c", "#7ac848", top.y - 0.5, top.y + 2.4, 0.1, i));
  }
  for (let i = 0; i < 3; i++) parts.push(colorize(xform(new THREE.SphereGeometry(0.17, 8, 6), [top.x + Math.cos(i * 2.1) * 0.2, top.y - 0.25, top.z + Math.sin(i * 2.1) * 0.2]), "#6a4a22"));
  return merge(parts);
}

function cactus(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = limb(0.36, 0.34, 2.6, 10);
  xform(body, [0, 2.6, 0]);
  parts.push(gradientColor(body, "#2e7a3a", "#5ab04a", 0, 3, 0.1, seed));
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    const arm = tube([T(s * 0.3, 1.2 + i * 0.4, 0), T(s * 0.9, 1.4 + i * 0.4, 0), T(s * 1.1, 2.0 + i * 0.4, 0), T(s * 1.1, 2.7 + i * 0.4, 0)], 0.2, 0.16, 10, 8);
    parts.push(gradientColor(arm, "#2e7a3a", "#5ab04a", 1, 3.5, 0.1, seed + i));
  }
  parts.push(colorize(xform(new THREE.SphereGeometry(0.14, 8, 6), [0.1, 3.0, 0.2]), "#ff6aa0"));
  return merge(parts);
}

function deadtree(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(trunk([T(0, 0, 0), T(0.3, 1.5, 0.1), T(-0.2, 3.0, 0.0), T(0.2, 4.4, 0.1)], 0.3, 0.07, "#6a5a48", "#8a7a64", 12, 7));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7 + seed, y = 1.5 + i * 0.7;
    parts.push(xform(trunk([T(0, y, 0), T(Math.cos(a) * 0.7, y + 0.6, Math.sin(a) * 0.7), T(Math.cos(a) * 1.4, y + 1.1 + (i % 2) * 0.4, Math.sin(a) * 1.4)], 0.1, 0.02, "#6a5a48", "#8a7a64", 6, 5)));
  }
  return merge(parts);
}

function bush(seed: number, c0 = "#2e6a2c", c1 = "#7fc04a"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  [[0, 0.5, 0, 0.7], [0.55, 0.38, 0.2, 0.5], [-0.5, 0.4, -0.2, 0.55], [0.1, 0.35, -0.55, 0.45]].forEach(([x, y, z, r], i) => parts.push(blob(r, x, y, z, seed + i, c0, c1, 0, 1.2, 0.8)));
  for (let i = 0; i < 5; i++) parts.push(colorize(xform(new THREE.SphereGeometry(0.05, 6, 5), [Math.cos(i * 1.7) * 0.55, 0.5 + (i % 2) * 0.2, Math.sin(i * 1.7) * 0.55]), seed % 2 ? "#e04050" : "#f0f0f0"));
  return merge(parts);
}

function rock(seed: number, band = false): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + (Math.sin(x * 3 + seed) * Math.cos(z * 3.3 + seed * 2) + Math.sin(y * 4 + seed)) * 0.18;
    p.setXYZ(i, x * n * 1.1, y * n * 0.7, z * n);
  }
  g.computeVertexNormals();
  g = gradientColor(g, band ? "#b8905a" : "#6a6a66", band ? "#e8c88a" : "#a8a8a0", -0.7, 0.8, 0.14, seed);
  const col = g.attributes.color, nrm = g.attributes.normal;
  if (!band) for (let i = 0; i < col.count; i++) if (nrm.getY(i) > 0.75) { col.setXYZ(i, col.getX(i) * 0.5, col.getY(i) * 0.95, col.getZ(i) * 0.4); }
  if (band) for (let i = 0; i < col.count; i++) { const k = 0.9 + Math.sin(p.getY(i) * 9) * 0.1; col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k); }
  xform(g, [0, 0.25, 0]);
  return g;
}

function flowers(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.12 + (i % 3) * 0.1, h = 0.28 + (i % 4) * 0.07;
    parts.push(colorize(xform(limb(0.008, 0.006, h, 4), [Math.cos(a) * r, h, Math.sin(a) * r]), "#4a9a3a"));
    const head = new THREE.SphereGeometry(0.05, 7, 5); head.scale(1, 0.55, 1);
    parts.push(colorize(xform(head, [Math.cos(a) * r, h + 0.03, Math.sin(a) * r]), "#ffffff"));
    parts.push(colorize(xform(new THREE.SphereGeometry(0.018, 5, 4), [Math.cos(a) * r, h + 0.06, Math.sin(a) * r]), "#ffdd44"));
  }
  return merge(parts);
}

function reeds(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.2, r = 0.05 + (i % 3) * 0.12, h = 1.1 + (i % 4) * 0.3;
    const blade = new THREE.ConeGeometry(0.035, h, 4); blade.translate(0, h / 2, 0);
    const lean = (i % 3 - 1) * 0.15;
    xform(blade, [Math.cos(a) * r, 0, Math.sin(a) * r], [lean, a, lean]);
    parts.push(gradientColor(blade, "#3a6a2a", "#a8c860", 0, 1.6, 0.05, i));
    if (i % 3 === 0) parts.push(colorize(xform(limb(0.04, 0.04, 0.2, 5), [Math.cos(a) * r, h * 0.85, Math.sin(a) * r], [lean, 0, lean]), "#5a3a22"));
  }
  return merge(parts);
}

function stump(): THREE.BufferGeometry {
  const s = limb(0.35, 0.42, 0.55, 9); xform(s, [0, 0.55, 0]);
  return merge([gradientColor(s, "#4a3322", "#6b4a30", 0, 0.6, 0.1, 2), colorize(xform(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 10), [0, 0.56, 0]), "#c9a070")]);
}

function mushroom(glow = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.25, ox = Math.cos(i * 2.4) * 0.22 * (i > 0 ? 1 : 0), oz = Math.sin(i * 2.4) * 0.22 * (i > 0 ? 1 : 0);
    parts.push(colorize(xform(limb(0.05 * s, 0.07 * s, 0.3 * s, 6), [ox, 0.3 * s, oz]), glow ? "#c8e8ff" : "#f2ead8"));
    const cap = new THREE.SphereGeometry(0.2 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    xform(cap, [ox, 0.3 * s, oz]);
    parts.push(colorize(cap, glow ? ["#4da6ff", "#c06bff", "#4dffd0"][i] : "#d84040"));
    if (!glow) for (let k = 0; k < 4; k++) parts.push(colorize(xform(new THREE.SphereGeometry(0.03 * s, 5, 4), [ox + Math.cos(k * 1.7) * 0.1 * s, 0.3 * s + 0.15 * s, oz + Math.sin(k * 1.7) * 0.1 * s]), "#ffffff"));
  }
  return merge(parts);
}

function fern(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.PlaneGeometry(0.3, 1.1, 2, 5);
    const p = leaf.attributes.position;
    for (let k = 0; k < p.count; k++) { const u = (p.getY(k) + 0.55) / 1.1; p.setXYZ(k, p.getX(k) * (1 - u * 0.7), u * 0.8, -u * u * 0.7); }
    leaf.computeVertexNormals();
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(-0.4)));
    parts.push(gradientColor(leaf, "#1f5a2a", "#6ac060", 0, 0.9, 0.08, i));
  }
  return merge(parts);
}

function drygrass(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.3, h = 0.5 + (i % 3) * 0.2;
    const b = new THREE.ConeGeometry(0.04, h, 3); b.translate(0, h / 2, 0);
    xform(b, [Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]);
    parts.push(gradientColor(b, "#8a7a3a", "#d8c880", 0, 0.8, 0.05, i));
  }
  return merge(parts);
}

function bone(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const arc = new THREE.TorusGeometry(0.35 - i * 0.03, 0.035, 5, 10, Math.PI * 0.9);
    xform(arc, [0, 0, i * 0.18], [0, Math.PI / 2, 0.25]);
    parts.push(colorize(arc, "#e8e2cf"));
  }
  parts.push(colorize(xform(limb(0.04, 0.04, 0.8, 5), [0, 0.04, 0.3], [Math.PI / 2, 0, 0]), "#e8e2cf"));
  parts.push(colorize(xform(new THREE.SphereGeometry(0.17, 8, 6), [0, 0.15, -0.55]), "#e8e2cf"));
  return merge(parts);
}

function crystal(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const cols = ["#6a9aff", "#9a6aff", "#6affd8"];
  for (let i = 0; i < 5; i++) {
    const h = 0.7 + (i % 3) * 0.5;
    const c = new THREE.ConeGeometry(0.16, h, 5);
    xform(c, [Math.cos(i * 1.7) * 0.25, h / 2, Math.sin(i * 1.7) * 0.25], [Math.cos(i) * 0.3, 0, Math.sin(i) * 0.3]);
    parts.push(colorize(c, cols[i % 3]));
  }
  return merge(parts);
}

export function grassTuft(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (i % 2) * 0.4;
    const h = 0.38 + (i % 3) * 0.14;
    const blade = new THREE.PlaneGeometry(0.075, h, 1, 2);
    const p = blade.attributes.position;
    for (let k = 0; k < p.count; k++) { const u = (p.getY(k) + h / 2) / h; p.setXYZ(k, p.getX(k) * (1 - u * 0.9), u * h, u * u * h * 0.35); }
    blade.computeVertexNormals();
    blade.applyMatrix4(new THREE.Matrix4().makeRotationY(a));
    blade.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    parts.push(gradientColor(blade, "#2f6a2a", "#a4dc5c", 0, h, 0.06, i));
  }
  return merge(parts);
}

export function getFlora(kind: string, seed = 1): FloraType | null {
  const key = `${kind}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let t: FloraType | null = null;
  const fm = foliageMat(0.012);
  switch (kind) {
    case "oak": t = { geo: oak(seed), mat: fm, shadow: true, collide: 0.55, color: true }; break;
    case "bigoak": t = { geo: oak(seed, 1.7, "#1f5a30", "#7ac05a"), mat: fm, shadow: true, collide: 1.0, color: true }; break;
    case "pine": t = { geo: pine(seed), mat: foliageMat(0.01), shadow: true, collide: 0.45, color: true }; break;
    case "birch": t = { geo: birch(seed), mat: fm, shadow: true, collide: 0.3, color: true }; break;
    case "willow": t = { geo: willow(seed), mat: foliageMat(0.016), shadow: true, collide: 0.5, color: true }; break;
    case "palm": t = { geo: palm(seed), mat: foliageMat(0.018), shadow: true, collide: 0.3, color: true }; break;
    case "cactus": t = { geo: cactus(seed), mat: stdMat("#ffffff", { vc: true, rough: 0.7 }), shadow: true, collide: 0.45, color: true }; break;
    case "deadtree": t = { geo: deadtree(seed), mat: stdMat("#ffffff", { vc: true, rough: 1 }), shadow: true, collide: 0.35, color: true }; break;
    case "bush": t = { geo: bush(seed), mat: foliageMat(0.02), shadow: true, collide: 0, color: true }; break;
    case "rock": t = { geo: rock(seed), mat: flatMat(), shadow: true, collide: 0.9, color: true }; break;
    case "dunerock": t = { geo: rock(seed, true), mat: flatMat(), shadow: true, collide: 0.9, color: true }; break;
    case "flowers": t = { geo: flowers(), mat: foliageMat(0.05), shadow: false, collide: 0, color: true }; break;
    case "reeds": t = { geo: reeds(), mat: foliageMat(0.08), shadow: false, collide: 0, color: true }; break;
    case "stump": t = { geo: stump(), mat: stdMat("#ffffff", { vc: true, rough: 1 }), shadow: true, collide: 0.4 }; break;
    case "mushroom": t = { geo: mushroom(false), mat: stdMat("#ffffff", { vc: true, rough: 0.6 }), shadow: false, collide: 0 }; break;
    case "glowshroom": t = { geo: mushroom(true), mat: new THREE.MeshBasicMaterial({ vertexColors: true }), shadow: false, collide: 0 }; break;
    case "fern": t = { geo: fern(), mat: (() => { const m = foliageMat(0.05); m.side = THREE.DoubleSide; return m; })(), shadow: false, collide: 0, color: true }; break;
    case "drygrass": t = { geo: drygrass(), mat: foliageMat(0.1), shadow: false, collide: 0, color: true }; break;
    case "bone": t = { geo: bone(), mat: stdMat("#ffffff", { vc: true, rough: 0.8 }), shadow: false, collide: 0 }; break;
    case "crystal": t = { geo: crystal(), mat: new THREE.MeshBasicMaterial({ vertexColors: true }), shadow: false, collide: 0.5 }; break;
    case "grass": {
      const m = foliageMat(0.35); m.side = THREE.DoubleSide;
      t = { geo: grassTuft(), mat: m, shadow: false, collide: 0, color: true };
      break;
    }
  }
  if (t) cache.set(key, t);
  return t;
}
void mulberry; void lathe;
