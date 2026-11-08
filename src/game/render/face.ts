import * as THREE from "three";
import type { Appearance } from "../types";

/**
 * Скульптурная голова: деформированная сфера с настоящими чертами лица
 * (надбровные дуги, глазницы, переносица, нос, скулы, губы, подбородок) +
 * нарисованная текстура кожи (брови, губы, румянец, тени) + глаза-«патчи» по поверхности.
 */

const TEX = 512;
const SPAN = 0.3; // сколько метров покрывает текстура
const YC = -0.003;
const RX = 0.099, RZ = 0.108, RY = 0.121;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g = (x: number, y: number, cx: number, cy: number, sx: number, sy: number, a: number) =>
  a * Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));

export interface FaceShape { female: boolean; jaw: number; nose: number; lips: number }
export function faceShape(app: Appearance, female: boolean): FaceShape {
  const h = app.headSize;
  return { female, jaw: female ? 0.2 : 0.13 + (app.build - 0.5) * 0.05, nose: 0.85 + (1 - h) * 0.3 + (female ? -0.15 : 0.1), lips: female ? 1.25 : 0.9 };
}

/** смещение поверхности лица вдоль +z */
function featureDisp(x: number, y: number, f: FaceShape) {
  const ax = Math.abs(x);
  const m = f.female ? 0 : 1;
  let d = 0;
  d += g(ax, y, 0, 0.075, 0.05, 0.04, 0.004);
  d += g(ax, y, 0.038, 0.037, 0.024, 0.007, 0.0035 + m * 0.0035);
  d += g(ax, y, 0.04, 0.012, 0.018, 0.012, -0.0075);
  d += g(ax, y, 0, -0.004, 0.0065, 0.024, 0.0085 * f.nose);
  d += g(ax, y, 0, -0.03, 0.0095, 0.0085, 0.0155 * f.nose);
  d += g(ax, y, 0.0125, -0.0335, 0.006, 0.0065, 0.0075 * f.nose);
  d += g(ax, y, 0, -0.0485, 0.005, 0.0045, -0.0015);
  d += g(ax, y, 0.058, -0.012, 0.016, 0.014, 0.0055 - m * 0.0005);
  d += g(ax, y, 0.058, -0.052, 0.014, 0.016, -0.0035 + m * -0.001);
  d += g(ax, y, 0, -0.059, 0.017, 0.0052, 0.0052 * f.lips);
  d += g(ax, y, 0, -0.07, 0.015, 0.0056, 0.0065 * f.lips);
  d += g(ax, y, 0, -0.0645, 0.017, 0.0013, -0.0035);
  d += g(ax, y, 0, -0.1, 0.014, 0.012, 0.008 + m * 0.002);
  d += g(ax, y, 0, -0.105, 0.028, 0.012, 0.003 + m * 0.003);
  return d;
}

function widthAt(y: number, f: FaceShape) {
  return 1 - f.jaw * Math.pow(smooth(-0.02, -0.123, y), 1.8);
}

/** z поверхности лица (для посадки глаз и т.п.) */
export function faceZ(x: number, y: number, f: FaceShape) {
  const w = widthAt(y, f);
  const q = 1 - (x / (RX * w)) ** 2 - ((y - YC) / RY) ** 2;
  const base = RZ * (0.96 + 0.04 * w) * Math.sqrt(Math.max(0.02, q));
  return base + featureDisp(x, y, f) * smooth(0, 0.3, base / RZ);
}

export function buildHeadGeometry(f: FaceShape): THREE.BufferGeometry {
  const W = 80, H = 60;
  const geo = new THREE.SphereGeometry(1, W, H);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const y = YC + dy * RY;
    const w = widthAt(y, f);
    // нижняя часть: чуть уже по глубине (подбородок)
    const depthK = 0.96 + 0.04 * w;
    const x = dx * RX * w;
    let z = dz * RZ * depthK;
    if (dz > 0) z += featureDisp(x, y, f) * smooth(0, 0.3, dz);
    pos.setXYZ(i, x, y, z);
    if (dz >= 0.02) uv.setXY(i, 0.5 + x / SPAN, 0.5 + (y - YC) / SPAN);
    else uv.setXY(i, 0.015, 0.015);
  }
  geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  for (let j = 0; j <= H; j++) {
    const a = j * (W + 1), b = a + W;
    V.fromBufferAttribute(n, a).add(V2.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, V.x, V.y, V.z); n.setXYZ(b, V.x, V.y, V.z);
  }
  for (let i = 0; i <= W; i++) { n.setXYZ(i, 0, 1, 0); n.setXYZ(H * (W + 1) + i, 0, -1, 0); }
  n.needsUpdate = true;
  return geo;
}

const px = (x: number) => (0.5 + x / SPAN) * TEX;
const py = (y: number) => (1 - (0.5 + (y - YC) / SPAN)) * TEX;
const sc = (m: number) => (m / SPAN) * TEX;

function mixCol(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

const skinCache = new Map<string, THREE.CanvasTexture>();
export function faceTexture(app: Appearance, female: boolean): THREE.CanvasTexture {
  const key = [app.skin, app.hairColor, app.brow, app.mark, app.markColor, female ? 1 : 0, app.eyeStyle, app.eyeColor].join("|");
  const hit = skinCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = TEX; c.height = TEX;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = app.skin; ctx.fillRect(0, 0, TEX, TEX);
  const dark = mixCol(app.skin, "#6a2a20", 0.35);
  const blushC = mixCol(app.skin, "#ff5a68", female ? 0.55 : 0.3);
  const soft = (x: number, y: number, rx: number, ry: number, col: string, a: number, rot = 0) => {
    ctx.save(); ctx.translate(px(x), py(y)); ctx.rotate(rot); ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, sc(rx));
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, sc(rx), 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
  };
  // общий объём: румянец, тени, высветления
  for (const s of [-1, 1]) {
    soft(s * 0.052, -0.032, 0.028, 0.02, blushC, female ? 0.3 : 0.16);
    soft(s * 0.04, 0.034, 0.03, 0.012, dark, female ? 0.28 : 0.2);     // тень века
    soft(s * 0.04, -0.002, 0.026, 0.008, dark, 0.14);                 // под глазом
    soft(s * 0.018, -0.045, 0.012, 0.014, dark, 0.1);                 // у носа
    soft(s * 0.012, -0.036, 0.007, 0.005, dark, 0.2);                // ноздри
    soft(s * 0.026, 0.02, 0.01, 0.025, dark, 0.12);                   // у переносицы
  }
  soft(0, -0.058, 0.02, 0.01, dark, 0.12);
  soft(0, -0.105, 0.025, 0.012, dark, 0.1);
  soft(0, 0.06, 0.05, 0.03, "#ffffff", 0.08);
  soft(0, -0.02, 0.006, 0.02, "#ffffff", 0.12);    // блик на носу
  soft(0, -0.036, 0.007, 0.005, "#ffffff", 0.12);
  // женский макияж — тени и румянец
  if (female) for (const s of [-1, 1]) soft(s * 0.045, 0.026, 0.026, 0.011, mixCol(app.accent, app.skin, 0.4), 0.3);
  // брови
  const browC = mixCol(app.hairColor, "#150c08", 0.7);
  const bs = [[0.0, 1.0, 0], [0.16, 1.0, 0], [-0.16, 1.25, 0], [0.0, 0.62, 0]][app.brow] ?? [0, 1, 0];
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(px(s * 0.04), py(0.046 + (female ? 0.003 : 0)));
    ctx.scale(s, 1);
    ctx.rotate(-bs[0] * 0.8);
    const thick = sc(female ? 0.0052 : 0.0068) * bs[1];
    const len = sc(0.027);
    for (let k = 0; k < 160; k++) {
      const u = Math.random();
      const x0 = -len * 0.9 + u * len * 1.9;
      const arch = -Math.sin(Math.min(1, Math.max(0, (x0 + len) / (2 * len))) * Math.PI) * sc(0.004) - (x0 > 0 ? x0 * 0.12 : 0) * (1 - 0) * -1;
      const taper = 1 - Math.pow(Math.abs(u - 0.35) / 0.7, 2) * 0.85;
      const yy = arch + (Math.random() - 0.5) * thick * 2 * taper;
      ctx.strokeStyle = browC; ctx.globalAlpha = 0.65 + Math.random() * 0.35; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + sc(0.0045), yy - sc(0.0016)); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // губы
  const lipC = mixCol(app.skin, female ? "#c4384f" : "#a8505a", female ? 0.6 : 0.4);
  const lipD = mixCol(lipC, "#2a0a12", 0.3);
  const lw = sc(0.019) * (female ? 1.05 : 1);
  const my = py(-0.0645);
  ctx.save(); ctx.translate(px(0), my);
  // верхняя
  ctx.beginPath();
  ctx.moveTo(-lw, 0);
  ctx.bezierCurveTo(-lw * 0.6, -sc(0.0045), -lw * 0.25, -sc(0.0085), -sc(0.0025), -sc(0.0075));
  ctx.quadraticCurveTo(0, -sc(0.0055), sc(0.0025), -sc(0.0075));
  ctx.bezierCurveTo(lw * 0.25, -sc(0.0085), lw * 0.6, -sc(0.0045), lw, 0);
  ctx.bezierCurveTo(lw * 0.5, sc(0.0006), -lw * 0.5, sc(0.0006), -lw, 0);
  ctx.fillStyle = lipC; ctx.fill();
  // нижняя
  ctx.beginPath();
  ctx.moveTo(-lw, 0);
  ctx.bezierCurveTo(-lw * 0.5, sc(0.0006), lw * 0.5, sc(0.0006), lw, 0);
  ctx.bezierCurveTo(lw * 0.6, sc(0.0095), lw * 0.2, sc(0.0125), 0, sc(0.0125));
  ctx.bezierCurveTo(-lw * 0.2, sc(0.0125), -lw * 0.6, sc(0.0095), -lw, 0);
  const lg = ctx.createLinearGradient(0, 0, 0, sc(0.0125)); lg.addColorStop(0, lipD); lg.addColorStop(0.45, lipC); lg.addColorStop(1, mixCol(lipC, "#ffffff", 0.18));
  ctx.fillStyle = lg; ctx.fill();
  // линия рта
  ctx.strokeStyle = mixCol(lipD, "#000000", 0.35); ctx.lineWidth = Math.max(1.2, sc(0.0007));
  ctx.beginPath(); ctx.moveTo(-lw * 1.04, sc(0.0006)); ctx.bezierCurveTo(-lw * 0.5, sc(0.0016), lw * 0.5, sc(0.0016), lw * 1.04, sc(0.0006)); ctx.stroke();
  // блик на губе
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(-sc(0.003), sc(0.0075), sc(0.0055), sc(0.0014), 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // метки
  if (app.mark > 0) {
    ctx.strokeStyle = app.markColor; ctx.fillStyle = app.markColor; ctx.lineCap = "round";
    if (app.mark === 1) { ctx.lineWidth = sc(0.0024); ctx.beginPath(); ctx.moveTo(px(0.058), py(0.05)); ctx.lineTo(px(0.047), py(-0.02)); ctx.stroke(); ctx.lineWidth = sc(0.0009); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px(0.052 + i * 0.002), py(0.03 - i * 0.015)); ctx.lineTo(px(0.06 + i * 0.002), py(0.026 - i * 0.015)); ctx.stroke(); } }
    if (app.mark === 2) { ctx.lineWidth = sc(0.0022); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px(s * 0.056), py(-0.02 - i * 0.012)); ctx.lineTo(px(s * 0.082), py(-0.026 - i * 0.012)); ctx.stroke(); } }
    if (app.mark === 3) { ctx.lineWidth = sc(0.0015); ctx.beginPath(); ctx.moveTo(px(0), py(0.085)); ctx.lineTo(px(-0.011), py(0.065)); ctx.lineTo(px(0.011), py(0.065)); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(px(0), py(0.074), sc(0.0018), 0, Math.PI * 2); ctx.fill(); }
    if (app.mark === 4) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(px(s * (0.047 + i * 0.004)), py(-0.01 - i * 0.012), sc(0.0021), 0, Math.PI * 2); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  skinCache.set(key, t);
  return t;
}

// ---------------- Глаза ----------------
const EW = 256, EH = 128;
const eyeCache = new Map<string, THREE.CanvasTexture>();
export function eyeTex(style: number, color: string, female: boolean, glow = false): THREE.CanvasTexture {
  const key = `${style}|${color}|${female}|${glow}`;
  const hit = eyeCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas"); c.width = EW; c.height = EH;
  const ctx = c.getContext("2d")!;
  // параметры формы: ширина, высота раскрытия, подъём внешнего уголка, толщина верхнего века
  const P = [
    { w: 92, h: 44, up: 6, lid: 0.0 },    // 0 обычные
    { w: 90, h: 40, up: 16, lid: 0.0 },   // 1 кошачьи
    { w: 88, h: 52, up: 2, lid: 0.0 },    // 2 большие
    { w: 94, h: 36, up: 12, lid: 0.15 },  // 3 хищные
    { w: 94, h: 31, up: 0, lid: 0.28 },   // 4 прищур/сонные
    { w: 88, h: 48, up: 4, lid: 0.0 },    // 5 добрые
  ][style] ?? { w: 92, h: 44, up: 6, lid: 0 };
  const cx = EW / 2, cy = EH * 0.56;
  const inX = cx - P.w, outX = cx + P.w;
  const inY = cy + 8, outY = cy - P.up;
  const topY = cy - P.h * 0.92, botY = cy + P.h * 0.62;
  const almond = () => {
    ctx.beginPath();
    ctx.moveTo(inX, inY);
    ctx.bezierCurveTo(inX + P.w * 0.45, topY - P.h * 0.18, outX - P.w * 0.55, topY - P.h * 0.12 + P.lid * 14, outX, outY);
    ctx.bezierCurveTo(outX - P.w * 0.45, botY + P.h * 0.05, inX + P.w * 0.55, botY + P.h * 0.12, inX, inY);
    ctx.closePath();
  };
  ctx.save(); almond(); ctx.clip();
  // склера
  const sg = ctx.createLinearGradient(0, topY, 0, botY);
  sg.addColorStop(0, "#b9b2b4"); sg.addColorStop(0.35, "#f1eeee"); sg.addColorStop(1, "#e4dede");
  ctx.fillStyle = sg; ctx.fillRect(0, 0, EW, EH);
  // радужка
  const ir = P.h * 0.98, icx = cx + 2, icy = cy - 1;
  const base = new THREE.Color(color);
  const light = "#" + base.clone().lerp(new THREE.Color("#ffffff"), 0.5).getHexString();
  const darkc = "#" + base.clone().multiplyScalar(0.35).getHexString();
  const rg = ctx.createRadialGradient(icx, icy + ir * 0.35, ir * 0.1, icx, icy, ir);
  rg.addColorStop(0, light); rg.addColorStop(0.45, color); rg.addColorStop(0.88, darkc); rg.addColorStop(1, "#0a0710");
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(icx, icy, ir, 0, Math.PI * 2); ctx.fill();
  // лучи радужки
  ctx.save(); ctx.beginPath(); ctx.arc(icx, icy, ir * 0.95, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.1;
    ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.22)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(icx + Math.cos(a) * ir * 0.32, icy + Math.sin(a) * ir * 0.32); ctx.lineTo(icx + Math.cos(a) * ir * 0.9, icy + Math.sin(a) * ir * 0.9); ctx.stroke();
  }
  ctx.restore();
  // зрачок
  ctx.fillStyle = "#06040a"; ctx.beginPath(); ctx.ellipse(icx, icy, ir * 0.34, ir * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  // нижний блик-подсвет
  const bl = ctx.createRadialGradient(icx, icy + ir * 0.6, 0, icx, icy + ir * 0.6, ir * 0.5);
  bl.addColorStop(0, "rgba(255,255,255,0.35)"); bl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(icx, icy + ir * 0.6, ir * 0.5, 0, Math.PI * 2); ctx.fill();
  // блики
  ctx.fillStyle = "rgba(255,255,255,0.97)"; ctx.beginPath(); ctx.ellipse(icx - ir * 0.34, icy - ir * 0.36, ir * 0.17, ir * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(icx + ir * 0.34, icy + ir * 0.34, ir * 0.08, 0, Math.PI * 2); ctx.fill();
  if (glow) { ctx.fillStyle = color; ctx.globalAlpha = 0.6; ctx.fillRect(0, 0, EW, EH); ctx.globalAlpha = 1; }
  // тень от верхнего века
  const ls = ctx.createLinearGradient(0, topY - 6, 0, topY + P.h * 0.75);
  ls.addColorStop(0, "rgba(20,8,10,0.62)"); ls.addColorStop(1, "rgba(20,8,10,0)");
  ctx.fillStyle = ls; ctx.fillRect(0, 0, EW, EH);
  ctx.restore();
  // верхнее веко / ресницы
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#150a0e";
  ctx.lineWidth = female ? 11 : 8;
  ctx.beginPath(); ctx.moveTo(inX - 2, inY + 1);
  ctx.bezierCurveTo(inX + P.w * 0.45, topY - P.h * 0.18, outX - P.w * 0.55, topY - P.h * 0.12 + P.lid * 14, outX, outY); ctx.stroke();
  // «крылышко» ресниц
  ctx.lineWidth = female ? 8 : 5;
  ctx.beginPath(); ctx.moveTo(outX - 6, outY + 1); ctx.quadraticCurveTo(outX + 10, outY - 3, outX + 20, outY - 10 - (female ? 6 : 0)); ctx.stroke();
  if (female) {
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 6; i++) {
      const t = 0.45 + i * 0.1;
      const x = inX + (outX - inX) * t, y = topY - P.h * 0.14 + (outY - topY) * Math.pow(t, 3) * 0.9 + 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 10, x + 12 + i, y - 17 - i * 1.5); ctx.stroke();
    }
  }
  // нижнее веко
  ctx.strokeStyle = "rgba(80,40,40,0.55)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(inX + 6, inY + 4);
  ctx.bezierCurveTo(inX + P.w * 0.55, botY + P.h * 0.12, outX - P.w * 0.45, botY + P.h * 0.05, outX - 4, outY + 3); ctx.stroke();
  // складка века
  ctx.strokeStyle = "rgba(90,40,40,0.5)"; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(inX + P.w * 0.3, topY - P.h * 0.38);
  ctx.bezierCurveTo(inX + P.w * 0.9, topY - P.h * 0.62, outX - P.w * 0.7, topY - P.h * 0.5, outX - 6, outY - P.h * 0.38); ctx.stroke();
  // внутренний уголок
  ctx.fillStyle = "rgba(220,110,120,0.75)"; ctx.beginPath(); ctx.ellipse(inX + 5, inY, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  eyeCache.set(key, t);
  return t;
}

/** Патч глаза по поверхности лица. side: -1 / +1. Возвращает меш с локальным началом в центре глаза. */
export function buildEyePatch(f: FaceShape, side: number, size: number, tex: THREE.Texture, glow: boolean): THREE.Mesh {
  const cx = side * 0.0405, cy = 0.012;
  const wM = 0.062 * size, hM = wM * (EH / EW);
  const NX = 14, NY = 8;
  const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
  const cz = faceZ(cx, cy, f) + 0.0007;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY;
    const x = cx + (u - 0.5) * wM;
    const y = cy + (v - 0.5) * hM;
    // для отзеркаливания: u зеркалится для левого глаза
    const uu = side > 0 ? u : 1 - u;
    verts.push(x - cx, y - cy, faceZ(x, y, f) + 0.0007 - cz + 0.0003);
    uvs.push(uu, v);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    if (side > 0) idx.push(a, b, d, a, d, c); else idx.push(a, b, d, a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.03, depthWrite: false, roughness: 0.28, metalness: 0,
    emissive: new THREE.Color(glow ? "#ffffff" : "#6a6670"), emissiveMap: tex, emissiveIntensity: glow ? 1.0 : 0.55,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  m.renderOrder = 2;
  return m;
}

// ---------------- Волосы ----------------
const hairCache = new Map<string, THREE.CanvasTexture>();
export function hairTexture(color: string): THREE.CanvasTexture {
  const hit = hairCache.get(color);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const base = new THREE.Color(color);
  const hex = (k: number) => "#" + base.clone().multiplyScalar(k).getHexString();
  const lit = (k: number) => "#" + base.clone().lerp(new THREE.Color("#fff3dc"), k).getHexString();
  const grd = ctx.createLinearGradient(0, 0, 0, S);
  grd.addColorStop(0, hex(0.8)); grd.addColorStop(0.5, hex(1.0)); grd.addColorStop(1, hex(0.78));
  ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, w = 0.8 + rnd() * 2.6;
    ctx.fillStyle = rnd() > 0.5 ? lit(0.18 + rnd() * 0.25) : hex(0.55 + rnd() * 0.3);
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.fillRect(x, 0, w, S);
  }
  ctx.globalAlpha = 1;
  // «ангельское кольцо» — блик
  const hg = ctx.createLinearGradient(0, S * 0.22, 0, S * 0.5);
  hg.addColorStop(0, "rgba(255,245,225,0)"); hg.addColorStop(0.5, "rgba(255,245,225,0.34)"); hg.addColorStop(1, "rgba(255,245,225,0)");
  ctx.fillStyle = hg; ctx.fillRect(0, S * 0.2, S, S * 0.32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  hairCache.set(color, t);
  return t;
}

export function disposeFaceCaches() {
  skinCache.forEach((t) => t.dispose()); skinCache.clear();
  eyeCache.forEach((t) => t.dispose()); eyeCache.clear();
  hairCache.forEach((t) => t.dispose()); hairCache.clear();
}
