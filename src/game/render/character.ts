import * as THREE from "three";
import type { Appearance, ClassId, Gender } from "../types";
import { basicMat, canvasTexture, lathe, limb, mesh, sphere, stdMat, tube } from "./util";
import { TIER_PAL, buildWeapon, type WeaponSet } from "./weapons";

export interface CharOpts {
  cls: ClassId;
  gender: Gender;
  app: Appearance;
  armorTier?: number;
  weaponTier?: number;
  head?: boolean; // показать головной убор
  helm?: boolean; // закрытый шлем (рыцари / стража)
  weapon?: boolean;
  bone?: boolean;
  wraps?: boolean;
  cloth?: string;
  cloth2?: string;
  eyeGlow?: string;
  antlers?: boolean;
  scale?: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const CLASS_COLORS: Record<ClassId, { cloth: string; leather: string }> = {
  warrior: { cloth: "#8c2a2f", leather: "#5a3a26" },
  assassin: { cloth: "#2b2540", leather: "#2f2a38" },
  mage: { cloth: "#2f55b0", leather: "#6b4a2e" },
  sorcerer: { cloth: "#431f66", leather: "#2d1a3a" },
  shieldbearer: { cloth: "#2b4a82", leather: "#5a3a26" },
  archer: { cloth: "#2f7a45", leather: "#6a4a2e" },
  berserker: { cloth: "#6e3a1f", leather: "#4a2f20" },
  tamer: { cloth: "#3f8a64", leather: "#8a6a3e" },
};

interface Outfit {
  body: "plate" | "leather" | "robe" | "bare" | "tunic";
  skirt: "tassets" | "robe" | "pants" | "wrap";
  sleeve: "cloth" | "wide" | "bare" | "bracer";
  pauld: "round" | "spiked" | "leather1" | "fur" | "none" | "huge";
  cape: "long" | "short" | "none" | "tabard";
  hg: "plume" | "hat" | "hood" | "crown" | "horn" | "feather" | "closed";
}
const OUTFIT: Record<ClassId, Outfit> = {
  warrior: { body: "plate", skirt: "tassets", sleeve: "cloth", pauld: "round", cape: "long", hg: "plume" },
  assassin: { body: "leather", skirt: "pants", sleeve: "bracer", pauld: "leather1", cape: "short", hg: "hood" },
  mage: { body: "robe", skirt: "robe", sleeve: "wide", pauld: "none", cape: "none", hg: "hat" },
  sorcerer: { body: "robe", skirt: "robe", sleeve: "wide", pauld: "spiked", cape: "short", hg: "crown" },
  shieldbearer: { body: "plate", skirt: "tassets", sleeve: "cloth", pauld: "huge", cape: "tabard", hg: "closed" },
  archer: { body: "leather", skirt: "wrap", sleeve: "bracer", pauld: "none", cape: "short", hg: "feather" },
  berserker: { body: "bare", skirt: "tassets", sleeve: "bare", pauld: "fur", cape: "none", hg: "horn" },
  tamer: { body: "tunic", skirt: "wrap", sleeve: "bracer", pauld: "fur", cape: "none", hg: "feather" },
};

interface Stance { shRx: number; shRz: number; elR: number; shLx: number; shLz: number; elL: number; crouch: number; hold: number }
const STANCE: Record<ClassId, Stance> = {
  warrior: { shRx: -0.5, shRz: -0.12, elR: -1.25, shLx: 0.1, shLz: 0.18, elL: -0.35, crouch: 0.01, hold: 1 },
  assassin: { shRx: -0.75, shRz: -0.2, elR: -1.35, shLx: -0.75, shLz: 0.2, elL: -1.35, crouch: 0.06, hold: 2 },
  mage: { shRx: -0.25, shRz: -0.12, elR: -0.95, shLx: -0.1, shLz: 0.2, elL: -0.5, crouch: 0, hold: 1 },
  sorcerer: { shRx: -0.5, shRz: -0.12, elR: -1.0, shLx: -0.85, shLz: 0.2, elL: -1.3, crouch: 0, hold: 2 },
  shieldbearer: { shRx: -0.4, shRz: -0.15, elR: -1.1, shLx: -0.5, shLz: 0.25, elL: -1.5, crouch: 0.03, hold: 2 },
  archer: { shRx: 0.05, shRz: -0.1, elR: -0.4, shLx: -0.4, shLz: 0.2, elL: -0.7, crouch: 0.02, hold: 1 },
  berserker: { shRx: -0.65, shRz: -0.15, elR: -1.0, shLx: -0.75, shLz: 0.15, elL: -1.15, crouch: 0.03, hold: 2 },
  tamer: { shRx: -0.25, shRz: -0.12, elR: -0.95, shLx: -0.05, shLz: 0.2, elL: -0.4, crouch: 0.01, hold: 1 },
};

// ---------- кэш текстур глаз ----------
const eyeCache = new Map<string, THREE.CanvasTexture>();
function eyeTexture(style: number, color: string, female: boolean) {
  const key = `${style}|${color}|${female}`;
  const c = eyeCache.get(key);
  if (c) return c;
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const sh = [[1, 1, 0], [0.9, 0.8, 0.18], [1.1, 1.15, 0], [0.9, 0.75, -0.12], [1, 0.8, 0], [1, 1.05, 0]][style];
    const rx = 44 * sh[0], ry = 40 * sh[1];
    ctx.save();
    ctx.translate(w / 2, h / 2 + 4);
    ctx.rotate(sh[2]);
    ctx.fillStyle = "#fbfbff";
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.clip();
    const ir = ry * 0.92;
    const g = ctx.createRadialGradient(0, 4, 2, 0, 0, ir);
    g.addColorStop(0, "#000000"); g.addColorStop(0.25, color); g.addColorStop(0.85, color); g.addColorStop(1, "#0b0b18");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(2, 3, ir * 0.82, ir, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0a14";
    ctx.beginPath(); ctx.ellipse(2, 3, ir * 0.32, ir * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath(); ctx.ellipse(-12, -12, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, 14, 5, 0, Math.PI * 2); ctx.fill();
    if (style === 5) { ctx.beginPath(); ctx.arc(10, -4, 4, 0, Math.PI * 2); ctx.fill(); }
    // верхнее веко
    ctx.fillStyle = "rgba(60,30,30,0.35)";
    ctx.beginPath(); ctx.ellipse(0, -ry * 0.8, rx * 1.1, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    if (style === 4) { ctx.fillStyle = "rgba(0,0,0,0.0)"; }
    ctx.restore();
    // линия ресниц
    ctx.save();
    ctx.translate(w / 2, h / 2 + 4);
    ctx.rotate(sh[2]);
    ctx.strokeStyle = "#140c10";
    ctx.lineWidth = female ? 9 : 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    const lid = style === 4 ? 0.45 : style === 3 ? 0.3 : 0;
    ctx.ellipse(0, lid * ry * 0.4, rx * 1.02, ry * (1 - lid * 0.2), 0, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
    if (style === 4 || style === 3) { ctx.fillStyle = "#e8c4a8"; ctx.beginPath(); ctx.ellipse(0, -ry * 0.55, rx * 1.05, ry * (0.35 + lid * 0.5), 0, 0, Math.PI * 2); ctx.globalCompositeOperation = "source-atop"; ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
    if (female || style === 1 || style === 3) {
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(rx * 0.95, -ry * 0.3); ctx.quadraticCurveTo(rx * 1.25, -ry * 0.55, rx * 1.4, -ry * 0.95); ctx.stroke();
      if (female) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rx * 0.7, -ry * 0.75); ctx.quadraticCurveTo(rx * 1.0, -ry * 1.05, rx * 1.2, -ry * 1.3); ctx.stroke(); }
    }
    ctx.restore();
  });
  eyeCache.set(key, tex);
  return tex;
}

function seq(p: number, keys: [number, number][]): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const u = (p - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * (u * u * (3 - 2 * u));
    }
  }
  return keys[keys.length - 1][1];
}

export type ActionKind = "slash" | "slash2" | "stab" | "cast" | "shoot" | "bash" | "whip" | "spin" | "leap" | "buff" | "heal" | "hit" | "block";
export type LoopKind = "wave" | "cheer" | "talk" | "block" | "sit" | undefined;

type Pose = Record<string, number>;

export class CharacterModel {
  group = new THREE.Group();
  body = new THREE.Group();
  root = new THREE.Group();
  opts: CharOpts;
  heightScale = 1;
  weapon: WeaponSet;
  private b: Record<string, THREE.Object3D> = {};
  private t = Math.random() * 10;
  private phase = 0;
  private speed = 0;
  private targetSpeed = 0;
  private act: { kind: ActionKind; p: number; dur: number; alt: boolean } | null = null;
  loop: LoopKind;
  dead = false;
  private fall = 0;
  private tails: THREE.Object3D[] = [];
  private capes: THREE.Object3D[] = [];
  private hairSway: THREE.Object3D[] = [];
  private eyes: THREE.Mesh[] = [];
  private blinkT = 2 + Math.random() * 3;
  private extra: ((t: number, s: number) => void)[] = [];
  private altSlash = false;
  private stance: Stance;
  private pose: Pose = {};
  private skinMat: THREE.MeshStandardMaterial;

  constructor(o: CharOpts) {
    this.opts = o;
    const { cls, gender, app } = o;
    const female = gender === "female";
    const f = female ? 1 : 0;
    const tier = clamp(o.armorTier ?? 0, 0, 5);
    const P = TIER_PAL[tier];
    const out = OUTFIT[cls];
    this.stance = STANCE[cls];
    this.heightScale = lerp(0.9, 1.1, app.height) * (female ? 0.96 : 1.03) * (o.scale ?? 1);
    const bd = app.build;
    const bone = !!o.bone;

    // материалы
    const skinCol = new THREE.Color(app.skin);
    const skin = stdMat(app.skin, { rough: 0.5 });
    skin.emissive = skinCol.clone().multiplyScalar(bone ? 0.05 : 0.14);
    this.skinMat = skin;
    const cc = CLASS_COLORS[cls];
    const clothC = o.cloth ?? cc.cloth;
    const cloth = stdMat(clothC, { rough: 0.75 });
    const cloth2 = stdMat(o.cloth2 ?? app.accent, { rough: 0.65 });
    const leather = stdMat(cc.leather, { rough: 0.7 });
    const metal = stdMat(P.metal, { rough: 0.3, metal: 0.85 });
    const trim = stdMat(P.trim, { rough: 0.28, metal: 0.9, emissive: tier >= 3 ? P.glow : "#000000", ei: tier >= 3 ? 0.25 : 0 });
    const furMat = stdMat(cls === "berserker" ? "#d8d0c4" : "#c9b08a", { rough: 1 });
    const hairMat = stdMat(app.hairColor, { rough: 0.35, emissive: app.hairColor, ei: 0.12 });
    const boneMat = stdMat("#e8e2cf", { rough: 0.7 });
    const wrapMat = stdMat("#d9cfae", { rough: 0.95 });
    const darkMat = stdMat("#1b1618", { rough: 0.9 });

    const add = <T extends THREE.Object3D>(p: THREE.Object3D, c: T, x = 0, y = 0, z = 0): T => { c.position.set(x, y, z); p.add(c); return c; };
    const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => add(p, new THREE.Group(), x, y, z);

    this.group.add(this.body);
    this.body.add(this.root);
    this.root.scale.setScalar(this.heightScale);

    // ---------------- Скелет ----------------
    const hips = grp(this.root, 0, 0.93, 0);
    const spine = grp(hips, 0, 0.06, 0);
    const neck = grp(spine, 0, 0.57, 0);
    const head = grp(neck, 0, 0.02, 0);
    const sw = female ? 0.152 + bd * 0.01 : 0.19 + bd * 0.03;
    const shR = grp(spine, -sw, 0.47, 0), shL = grp(spine, sw, 0.47, 0);
    const elR = grp(shR, 0, -0.28, 0), elL = grp(shL, 0, -0.28, 0);
    const handR = grp(elR, 0, -0.26, 0), handL = grp(elL, 0, -0.26, 0);
    const hw = 0.082 + f * 0.004 + bd * 0.012;
    const hipR = grp(hips, -hw, -0.02, 0), hipL = grp(hips, hw, -0.02, 0);
    const kneeR = grp(hipR, 0, -0.45, 0), kneeL = grp(hipL, 0, -0.45, 0);
    const ankR = grp(kneeR, 0, -0.41, 0), ankL = grp(kneeL, 0, -0.41, 0);
    Object.assign(this.b, { hips, spine, neck, head, shR, shL, elR, elL, handR, handL, hipR, hipL, kneeR, kneeL, ankR, ankL });

    const limbScale = bone ? 0.62 : 1;
    const skinOrBone = bone ? boneMat : skin;

    // ---------------- Тело ----------------
    const torsoProfile = (off: number): [number, number][] => {
      const s = bd * 0.012;
      const pts: [number, number, number][] = female
        ? [[-0.1, 0.112, 0.118], [0.0, 0.092, 0.098], [0.1, 0.082, 0.085], [0.2, 0.098, 0.1], [0.3, 0.108, 0.108], [0.4, 0.114, 0.114], [0.48, 0.1, 0.1], [0.54, 0.058, 0.058], [0.58, 0.04, 0.04]]
        : [[-0.1, 0.11, 0.11], [0.0, 0.108, 0.108], [0.1, 0.112, 0.112], [0.2, 0.13, 0.13], [0.3, 0.15, 0.15], [0.4, 0.17, 0.17], [0.48, 0.15, 0.15], [0.54, 0.08, 0.08], [0.58, 0.05, 0.05]];
      return pts.map(([y, r]) => [r + s + off, y] as [number, number]);
    };
    const torsoGeo = (off: number, y0 = 0, y1 = 1) => {
      const full = torsoProfile(off);
      const g = lathe(full.slice(Math.floor(y0 * (full.length - 1)), Math.ceil(y1 * (full.length - 1)) + 1), 20);
      g.scale(1, 1, 0.68);
      return g;
    };
    add(spine, mesh(torsoGeo(0), bone ? darkMat : skin));
    add(hips, mesh(sphere(0.115 + f * 0.012 + bd * 0.01, 1.15, 0.85, 0.85), bone ? darkMat : skin), 0, -0.02, 0);
    if (bone) {
      for (let i = 0; i < 5; i++) {
        const rib = add(spine, mesh(new THREE.TorusGeometry(0.1 - Math.abs(i - 2) * 0.008 + 0.01, 0.009, 6, 20, Math.PI * 1.5), boneMat), 0, 0.2 + i * 0.065, 0.0);
        rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.75; rib.scale.set(1.15, 0.85, 1);
      }
      const sp = add(spine, mesh(limb(0.018, 0.018, 0.6, 6), boneMat), 0, 0.55, -0.06);
      void sp;
    }
    const bust = female ? 0.036 + app.bust * 0.03 : 0;
    const chestCovered = out.body !== "bare";
    if (female) {
      for (const s of [-1, 1]) add(spine, mesh(sphere(bust, 1, 1, 0.95), skin), s * 0.052, 0.34, 0.07 + app.bust * 0.01);
    }
    // шея
    add(neck, mesh(limb(0.034, 0.036, 0.1, 10), skinOrBone), 0, 0.03, 0);

    // ---------------- Ноги ----------------
    const thighR = (female ? 0.07 : 0.074) + bd * 0.008;
    for (const [hp, kn, ak] of [[hipR, kneeR, ankR], [hipL, kneeL, ankL]] as const) {
      add(hp, mesh(limb(thighR * limbScale, 0.05 * limbScale, 0.44), skinOrBone));
      add(kn, mesh(sphere(0.05 * limbScale), skinOrBone));
      add(kn, mesh(limb(0.05 * limbScale, 0.032 * limbScale, 0.4), skinOrBone));
      const foot = grp(ak, 0, 0, 0);
      add(foot, mesh(sphere(0.045, 0.95, 0.75, 2.0), skinOrBone), 0, 0.035, 0.05);
    }
    // одежда на ногах
    const legCover = (mat: THREE.Material, r: number) => {
      for (const [hp, kn] of [[hipR, kneeR], [hipL, kneeL]] as const) {
        add(hp, mesh(limb(thighR + r, 0.052 + r, 0.44), mat));
        if (!bone) add(kn, mesh(limb(0.052 + r, 0.036 + r, 0.2), mat), 0, 0, 0);
      }
    };
    if (!bone || o.wraps) {
      if (out.skirt === "pants" || out.skirt === "tassets" || out.skirt === "wrap") legCover(out.skirt === "tassets" && out.body === "plate" ? cloth : out.skirt === "wrap" ? leather : cloth, 0.008);
    }
    if (o.wraps) {
      for (const [hp, kn] of [[hipR, kneeR], [hipL, kneeL]] as const) {
        for (let i = 0; i < 4; i++) {
          add(hp, mesh(new THREE.TorusGeometry(thighR + 0.01 - i * 0.004, 0.006, 5, 12), wrapMat), 0, -0.07 - i * 0.1, 0).rotation.x = Math.PI / 2;
          add(kn, mesh(new THREE.TorusGeometry(0.046 - i * 0.005, 0.006, 5, 12), wrapMat), 0, -0.05 - i * 0.09, 0).rotation.x = Math.PI / 2;
        }
      }
    }
    // сапоги
    if (!bone || o.cloth) {
      for (const [kn, ak] of [[kneeR, ankR], [kneeL, ankL]] as const) {
        add(kn, mesh(limb(0.049, 0.04, 0.22), out.body === "plate" ? metal : leather), 0, -0.2, 0);
        add(kn, mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14), tier >= 1 ? trim : cloth2), 0, -0.2, 0).rotation.x = Math.PI / 2;
        const bootFoot = add(ak, mesh(sphere(0.05, 1.0, 0.8, 2.15), out.body === "plate" ? metal : leather), 0, 0.037, 0.05);
        void bootFoot;
        add(ak, mesh(sphere(0.045, 0.95, 0.4, 1.0), darkMat), 0, 0.005, 0.0);
      }
    }

    // ---------------- Руки ----------------
    const armR = 0.037 * limbScale;
    for (const [sh, el, hd] of [[shR, elR, handR], [shL, elL, handL]] as const) {
      add(sh, mesh(sphere(0.047 * limbScale), skinOrBone));
      add(sh, mesh(limb(armR + 0.004, 0.033 * limbScale, 0.27), skinOrBone));
      add(el, mesh(sphere(0.034 * limbScale), skinOrBone));
      add(el, mesh(limb(0.033 * limbScale, 0.025 * limbScale, 0.25), skinOrBone));
      add(hd, mesh(sphere(0.034, 0.9, 1.25, 0.75), skinOrBone), 0, -0.04, 0);
      add(hd, mesh(sphere(0.014, 0.8, 1.4, 0.8), skinOrBone), 0.0, -0.025, 0.028);
    }
    // рукава
    const sleeveMat = out.body === "leather" || out.body === "tunic" ? leather : cloth;
    for (const [sh, el, sd] of [[shR, elR, -1], [shL, elL, 1]] as const) {
      if (out.sleeve === "cloth" && !bone) {
        add(sh, mesh(limb(0.045, 0.039, 0.27), sleeveMat));
        add(el, mesh(limb(0.038, 0.03, 0.2), sleeveMat));
      } else if (out.sleeve === "wide") {
        add(sh, mesh(limb(0.047, 0.045, 0.28), cloth));
        add(el, mesh(lathe([[0.034, -0.28], [0.06, -0.2], [0.085, -0.1], [0.045, 0.0], [0.04, 0.02]], 14), cloth2), 0, 0.0, 0);
        add(el, mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 16), trim), 0, -0.28, 0).rotation.x = Math.PI / 2;
      } else if (out.sleeve === "bracer") {
        add(el, mesh(limb(0.037, 0.032, 0.14), tier >= 1 ? metal : leather), 0, -0.1, 0);
        add(el, mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 12), trim), 0, -0.1, 0).rotation.x = Math.PI / 2;
        if (out.body === "leather" || out.body === "tunic") add(sh, mesh(limb(0.046, 0.04, 0.16), leather), 0, -0.01, 0);
      } else if (out.sleeve === "bare" && !bone) {
        add(el, mesh(limb(0.037, 0.03, 0.12), leather), 0, -0.12, 0);
        for (let i = 0; i < 3; i++) add(el, mesh(new THREE.ConeGeometry(0.009, 0.04, 5), metal), sd * 0.034, -0.1 - i * 0.025, 0).rotation.z = -sd * Math.PI / 2;
      }
      // перчатки
      const hd = sd < 0 ? handR : handL;
      if (!bone) add(hd, mesh(sphere(0.037, 0.95, 1.3, 0.85), out.body === "plate" ? metal : leather), 0, -0.04, 0);
    }
    this.handGlove = null;

    // ---------------- Одежда торса ----------------
    if (!bone || o.cloth) {
      if (out.body === "plate") {
        add(spine, mesh(torsoGeo(0.012, 0.0, 1), cloth));
        const cuirass = add(spine, mesh(lathe(torsoProfile(0.026).slice(2, 7).map(([r, y]) => [r * (female ? 1 : 1.03), y] as [number, number]), 20), metal));
        cuirass.scale.set(1, 1, 0.7);
        const belt = add(spine, mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 20), trim), 0, 0.05, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1.1, 0.78, 1);
        add(spine, mesh(sphere(0.026), tier >= 2 ? stdMat(P.gem, { emissive: P.gem, ei: 1.2 }) : trim), 0, 0.3, 0.115);
        add(spine, mesh(new THREE.TorusGeometry(0.12 + f * 0.0, 0.01, 6, 20), trim), 0, 0.47, 0).rotation.x = Math.PI / 2;
      } else if (out.body === "leather" || out.body === "tunic") {
        add(spine, mesh(torsoGeo(0.01, 0, 0.9), out.body === "tunic" ? cloth : leather));
        add(spine, mesh(new THREE.TorusGeometry(0.108 + f * 0.0, 0.015, 6, 20), cloth2), 0, 0.02, 0).rotation.x = Math.PI / 2;
        // перекрёстные ремни
        for (const s of [-1, 1]) {
          const strap = add(spine, mesh(new THREE.BoxGeometry(0.03, 0.5, 0.012), trim), s * 0.0, 0.3, 0.095);
          strap.rotation.z = s * 0.55; strap.scale.set(1, 1, 1);
          strap.position.z = 0.1; strap.rotation.y = 0;
        }
        add(spine, mesh(sphere(0.026), tier >= 2 ? stdMat(P.gem, { emissive: P.gem, ei: 1.2 }) : trim), 0, 0.3, 0.115);
      } else if (out.body === "robe") {
        add(spine, mesh(torsoGeo(0.014, 0, 1), cloth));
        add(spine, mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 20), cloth2), 0, 0.03, 0).rotation.x = Math.PI / 2;
        add(spine, mesh(sphere(0.03), stdMat(P.gem, { emissive: P.gem, ei: 1.3 })), 0, 0.04, 0.1);
        // воротник
        add(spine, mesh(lathe([[0.075, 0.5], [0.095, 0.56], [0.11, 0.6], [0.098, 0.6], [0.07, 0.55]], 16), cloth2), 0, 0, 0);
        const lapel = add(spine, mesh(new THREE.BoxGeometry(0.05, 0.4, 0.01), cloth2), 0, 0.33, 0.1); lapel.rotation.z = 0.0;
      } else if (out.body === "bare") {
        if (female) add(spine, mesh(torsoGeo(0.01, 0.35, 0.65), leather), 0, 0, 0);
        else {
          add(spine, mesh(new THREE.TorusGeometry(0.15, 0.014, 6, 20), leather), 0, 0.3, 0).rotation.x = Math.PI / 2;
          for (const s of [-1, 1]) { const st = add(spine, mesh(new THREE.BoxGeometry(0.04, 0.55, 0.015), leather), 0, 0.3, 0.1); st.rotation.z = s * 0.5; }
        }
        add(spine, mesh(new THREE.TorusGeometry(0.112, 0.02, 6, 20), leather), 0, 0.02, 0).rotation.x = Math.PI / 2;
      }
    }
    if (female && chestCovered && !bone && out.body !== "plate") {
      for (const s of [-1, 1]) add(spine, mesh(sphere(bust + 0.005, 1, 1, 0.95), out.body === "robe" || out.body === "tunic" ? cloth : leather), s * 0.052, 0.34, 0.07 + app.bust * 0.01);
    }

    // ---------------- Юбка / набедренники ----------------
    if (!bone || o.cloth) {
      if (out.skirt === "robe") {
        const robe = add(hips, mesh(lathe([[0.27 + bd * 0.02, -0.86], [0.24, -0.7], [0.19, -0.45], [0.145, -0.2], [0.115, -0.02], [0.11, 0.05]], 24), cloth), 0, 0, 0);
        robe.scale.set(1, 1, 0.82);
        add(hips, mesh(lathe([[0.275 + bd * 0.02, -0.86], [0.272, -0.83], [0.245, -0.8], [0.25, -0.86]], 24), cloth2), 0, 0, 0).scale.set(1, 1, 0.82);
        const front = add(hips, mesh(new THREE.PlaneGeometry(0.13, 0.62, 1, 4), cloth2), 0, -0.52, 0.16); front.rotation.x = -0.13; (front.material as THREE.Material).side = THREE.DoubleSide;
        this.extra.push((t, s) => { robe.rotation.x = Math.sin(t * 1.5) * 0.01 - s * 0.05; front.rotation.x = -0.13 - s * 0.35 + Math.sin(t * 3) * 0.03; });
      } else if (out.skirt === "tassets") {
        const kilt = add(hips, mesh(lathe([[0.215, -0.34], [0.2, -0.2], [0.155, -0.06], [0.12, 0.04]], 20), out.body === "plate" ? cloth : leather), 0, 0, 0);
        kilt.scale.set(1, 1, 0.8);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const pl = add(hips, mesh(new THREE.BoxGeometry(0.075, 0.2, 0.012), metal), Math.sin(a) * 0.19, -0.2, Math.cos(a) * 0.15);
          pl.rotation.y = a; pl.rotation.x = -0.18; pl.scale.set(1, 1, 1);
        }
        const tab = add(hips, mesh(new THREE.PlaneGeometry(0.17, 0.55, 1, 3), cloth2), 0, -0.3, 0.16); tab.rotation.x = -0.08; (tab.material as THREE.Material).side = THREE.DoubleSide;
        add(hips, mesh(new THREE.BoxGeometry(0.17, 0.03, 0.012), trim), 0, -0.02, 0.165);
        this.extra.push((t, s) => { tab.rotation.x = -0.08 - s * 0.4 + Math.sin(t * 2.5) * 0.03; });
      } else if (out.skirt === "wrap") {
        const wrap = add(hips, mesh(lathe([[0.18, -0.3], [0.165, -0.15], [0.13, -0.03], [0.11, 0.04]], 18), leather), 0, 0, 0);
        wrap.scale.set(1, 1, 0.8);
        const flap = add(hips, mesh(new THREE.PlaneGeometry(0.14, 0.34, 1, 2), cloth), 0.0, -0.18, 0.15); (flap.material as THREE.Material).side = THREE.DoubleSide;
        const flapB = add(hips, mesh(new THREE.PlaneGeometry(0.14, 0.4, 1, 2), cloth2), 0.0, -0.2, -0.14); (flapB.material as THREE.Material).side = THREE.DoubleSide;
        this.extra.push((t, s) => { flap.rotation.x = -0.1 - s * 0.35 + Math.sin(t * 3) * 0.04; flapB.rotation.x = 0.1 + s * 0.4 + Math.sin(t * 3 + 1) * 0.04; });
      } else if (out.skirt === "pants") {
        add(hips, mesh(sphere(0.118 + f * 0.01, 1.15, 0.9, 0.9), cloth), 0, -0.03, 0);
        const sash = add(hips, mesh(new THREE.PlaneGeometry(0.1, 0.5, 1, 3), cloth2), 0.1, -0.25, 0.04); (sash.material as THREE.Material).side = THREE.DoubleSide;
        this.extra.push((t, s) => { sash.rotation.x = s * 0.5 + Math.sin(t * 3.2) * 0.06; sash.rotation.z = -0.08; });
      }
      add(hips, mesh(new THREE.TorusGeometry(0.11 + bd * 0.01, 0.017, 8, 20), leather), 0, 0.04, 0).rotation.x = Math.PI / 2;
    }

    // ---------------- Наплечники ----------------
    if (!bone || o.cloth) {
      const ps = 1 + tier * 0.08;
      const pauld = (sh: THREE.Object3D, side: number, kind: Outfit["pauld"]) => {
        if (kind === "round" || kind === "spiked" || kind === "huge") {
          const r = (kind === "huge" ? 0.115 : 0.088) * ps;
          const cap = add(sh, mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), metal), side * 0.012, 0.025, 0);
          cap.scale.set(1.15, 0.9, 1.05); cap.rotation.z = side * 0.35;
          for (let i = 0; i < 2; i++) {
            const pl = add(sh, mesh(new THREE.SphereGeometry(r * (1 - i * 0.12), 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), i ? trim : metal), side * (0.03 + i * 0.015), -0.03 - i * 0.035, 0);
            pl.scale.set(1.1, 0.7, 1); pl.rotation.z = side * 0.45;
          }
          add(sh, mesh(new THREE.TorusGeometry(r * 0.9, 0.009, 6, 18), trim), side * 0.012, 0.0, 0).rotation.x = Math.PI / 2;
          if (kind === "spiked" || kind === "huge" || tier >= 3) {
            const n = kind === "huge" ? 3 : 1 + (tier >= 3 ? 1 : 0);
            for (let i = 0; i < n; i++) { const sp = add(sh, mesh(new THREE.ConeGeometry(0.02 * ps, 0.12 * ps, 6), trim), side * (0.05 + i * 0.03), 0.09 - i * 0.01, 0); sp.rotation.z = -side * (0.5 + i * 0.35); }
          }
        } else if (kind === "leather1") {
          const cap = add(sh, mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), leather), side * 0.01, 0.02, 0);
          cap.rotation.z = side * 0.3; cap.scale.set(1.1, 0.9, 1);
          add(sh, mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 14), trim), side * 0.01, 0.0, 0).rotation.x = Math.PI / 2;
        } else if (kind === "fur") {
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            add(sh, mesh(sphere(0.045 + (i % 2) * 0.008, 1, 0.8, 1, 10), furMat), Math.cos(a) * 0.06 + side * 0.01, 0.045 + Math.sin(i * 2) * 0.01, Math.sin(a) * 0.06);
          }
        }
      };
      pauld(shR, -1, out.pauld === "leather1" ? "none" : out.pauld);
      pauld(shL, 1, out.pauld);
      if (out.pauld === "fur") add(spine, mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 20), furMat), 0, 0.53, 0).rotation.x = Math.PI / 2;
    }

    // ---------------- Плащ ----------------
    if ((out.cape === "long" || out.cape === "short") && !bone) {
      const len = out.cape === "long" ? 0.4 : 0.28;
      const segs = out.cape === "long" ? 3 : 2;
      let parent: THREE.Object3D = grp(spine, 0, 0.52, -0.1);
      for (let i = 0; i < segs; i++) {
        const geo = new THREE.PlaneGeometry(0.34 - i * 0.02 + bd * 0.04, len, 4, 2);
        const pp = geo.attributes.position;
        for (let k = 0; k < pp.count; k++) pp.setZ(k, -Math.pow(pp.getX(k) * 2.2, 2) * 0.35);
        geo.computeVertexNormals();
        const m = add(parent, mesh(geo, i === 0 ? cloth : (i === segs - 1 ? cloth2 : cloth)), 0, -len / 2, 0);
        (m.material as THREE.Material).side = THREE.DoubleSide;
        const pivot = grp(parent, 0, -len, 0);
        this.capes.push(parent);
        parent = pivot;
      }
      this.capes.push(parent);
    }
    if (out.cape === "tabard" && !bone) {
      const tab = add(spine, mesh(new THREE.PlaneGeometry(0.2, 0.62, 1, 3), cloth2), 0, 0.0, 0.135); tab.rotation.x = -0.05; (tab.material as THREE.Material).side = THREE.DoubleSide;
      add(spine, mesh(new THREE.BoxGeometry(0.2, 0.025, 0.012), trim), 0, 0.3, 0.14);
      const tabB = add(hips, mesh(new THREE.PlaneGeometry(0.24, 0.8, 1, 3), cloth2), 0, -0.4, -0.16); (tabB.material as THREE.Material).side = THREE.DoubleSide;
      this.extra.push((t, s) => { tabB.rotation.x = 0.1 + s * 0.35 + Math.sin(t * 2.4) * 0.03; });
    }

    // ---------------- Голова ----------------
    const hs = 1 + (app.headSize - 0.5) * 0.35;
    const headG = grp(head, 0, 0.115 * hs, 0);
    headG.scale.setScalar(hs);
    const HR = 0.118;
    add(headG, mesh(sphere(HR, 0.94, 1.04, 0.98, 28), skinOrBone));
    add(headG, mesh(sphere(0.088, 0.92, 0.9, 0.95, 20), skinOrBone), 0, -0.06, 0.028);
    const eyeY = 0.005, eyeX = 0.047;
    const surfZ = (x: number, y: number) => HR * 0.98 * Math.sqrt(Math.max(0.05, 1 - (x / (HR * 0.94)) ** 2 - (y / (HR * 1.04)) ** 2));
    if (!bone || o.eyeGlow) {
      const es = lerp(0.064, 0.09, app.eyeSize) * (female ? 1.08 : 1);
      for (const s of [-1, 1]) {
        const tex = eyeTexture(app.eyeStyle, o.eyeGlow ?? app.eyeColor, female);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(es, es), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }));
        m.position.set(s * eyeX, eyeY, surfZ(s * eyeX, eyeY) + 0.003);
        m.rotation.y = s * 0.33;
        m.scale.x = s > 0 ? -1 : 1;
        headG.add(m);
        this.eyes.push(m);
      }
    }
    if (bone) {
      for (const s of [-1, 1]) {
        add(headG, mesh(sphere(0.026, 1, 1.15, 0.7), darkMat), s * eyeX, 0.01, surfZ(s * eyeX, 0.01) - 0.004);
        add(headG, mesh(sphere(0.009), basicMat(o.eyeGlow ?? "#8cff7a")), s * eyeX, 0.01, surfZ(s * eyeX, 0.01) + 0.008);
      }
      add(headG, mesh(new THREE.ConeGeometry(0.012, 0.03, 4), darkMat), 0, -0.03, 0.115).rotation.x = Math.PI;
      for (let i = -3; i <= 3; i++) add(headG, mesh(new THREE.BoxGeometry(0.01, 0.014, 0.01), boneMat), i * 0.016, -0.075, 0.1 - Math.abs(i) * 0.008);
    } else {
      // брови
      const browC = stdMat(new THREE.Color(app.hairColor).multiplyScalar(0.7), { rough: 0.8 });
      const bs = [[0.0, 1.0], [0.18, 1.0], [-0.18, 1.2], [0.0, 0.6]][app.brow];
      for (const s of [-1, 1]) {
        const br = add(headG, mesh(limb(0.0045 * bs[1] + 0.001, 0.003, 0.045), browC), s * (eyeX + 0.002), 0.045, surfZ(s * eyeX, 0.045) + 0.003);
        br.rotation.z = Math.PI / 2 + s * bs[0]; br.rotation.y = s * 0.4;
      }
      add(headG, mesh(sphere(0.011, 1, 0.9, 1.1), skin), 0, -0.022, surfZ(0, -0.022) + 0.006);
      const mouth = add(headG, mesh(new THREE.TorusGeometry(0.014, 0.0022, 5, 10, Math.PI * 0.85), stdMat("#a64a5a", { rough: 0.5 })), 0, -0.06, surfZ(0, -0.06) + 0.004);
      mouth.rotation.z = Math.PI * 1.075;
      if (female || app.eyeStyle === 5) for (const s of [-1, 1]) {
        const bl = add(headG, new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), new THREE.MeshBasicMaterial({ color: "#ff7a8a", transparent: true, opacity: 0.22, depthWrite: false })), s * 0.065, -0.035, surfZ(s * 0.065, -0.035) + 0.002);
        bl.rotation.y = s * 0.7;
      }
      // метки
      if (app.mark > 0) {
        const mc = new THREE.MeshBasicMaterial({ color: app.markColor });
        if (app.mark === 1) { const sc = add(headG, new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.07), mc), 0.052, 0.01, surfZ(0.052, 0.01) + 0.004); sc.rotation.z = 0.5; sc.rotation.y = 0.4; }
        if (app.mark === 2) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const st = add(headG, new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.007), mc), s * 0.075, -0.025 - i * 0.017, surfZ(s * 0.075, -0.025) + 0.002); st.rotation.y = s * 0.9; st.rotation.z = s * -0.15; }
        if (app.mark === 3) { const ru = add(headG, new THREE.Mesh(new THREE.RingGeometry(0.007, 0.012, 3), mc), 0, 0.075, surfZ(0, 0.075) + 0.004); ru.rotation.x = -0.2; }
        if (app.mark === 4) for (const s of [-1, 1]) add(headG, new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), mc), s * 0.05, -0.028, surfZ(s * 0.05, -0.028) + 0.003).rotation.y = s * 0.4;
      }
    }
    // уши
    if (!bone) {
      if (app.ears === 0 || app.ears === 1) {
        for (const s of [-1, 1]) {
          const long = app.ears === 1;
          const ear = add(headG, mesh(new THREE.ConeGeometry(0.022, long ? 0.12 : 0.05, 8), skin), s * HR * 0.9, 0.0, -0.005);
          ear.rotation.z = -s * (long ? 1.25 : 1.1); ear.scale.z = 0.4; if (long) ear.position.x = s * (HR * 0.9 + 0.045), ear.position.y = 0.02;
        }
      } else {
        const fox = app.ears === 3;
        for (const s of [-1, 1]) {
          const ear = grp(headG, s * 0.065, 0.1, -0.015);
          const outer = add(ear, mesh(new THREE.ConeGeometry(0.045, fox ? 0.15 : 0.11, 4), stdMat(app.hairColor, { rough: 0.8 })), 0, 0.05, 0);
          outer.scale.z = 0.45; add(ear, mesh(new THREE.ConeGeometry(0.03, fox ? 0.1 : 0.08, 4), stdMat("#f0a0b0", { rough: 0.8 })), 0, 0.045, 0.012).scale.z = 0.3;
          ear.rotation.z = -s * 0.35; ear.rotation.x = -0.1;
          this.hairSway.push(ear);
        }
      }
    }
    // антлеры (друид)
    if (o.antlers) {
      for (const s of [-1, 1]) {
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.05, 0.1, 0), new THREE.Vector3(s * 0.08, 0.22, 0.02), new THREE.Vector3(s * 0.05, 0.32, 0.04)];
        add(headG, mesh(tube(pts, 0.014, 0.006, 8, 6), stdMat("#6a5a3a", { rough: 0.9 })), s * 0.07, 0.09, 0);
        for (let k = 0; k < 2; k++) add(headG, mesh(new THREE.ConeGeometry(0.008, 0.09, 5), stdMat("#6a5a3a")), s * (0.1 + k * 0.01), 0.2 + k * 0.08, 0.02).rotation.z = -s * 0.9;
      }
    }

    // ---------------- Причёска ----------------
    if (!bone && !(o.helm)) this.buildHair(headG, app, hairMat, female, (out.hg === "hat" || out.hg === "hood") && !!o.head, cloth, cloth2);

    // ---------------- Головной убор ----------------
    const wantsHead = !!o.head || !!o.helm;
    if (wantsHead && (!bone || o.cloth)) {
      const kind = o.helm ? (out.hg === "plume" ? "plume" : "closed") : out.hg;
      this.buildHeadgear(headG, kind, !!o.helm, metal, trim, cloth, cloth2, leather, furMat, tier, P.gem);
    }

    // ---------------- Хвост ----------------
    if (!bone && app.tail > 0) {
      const fox = app.tail === 2;
      let parent: THREE.Object3D = grp(hips, 0, 0.03, -0.1);
      const n = fox ? 6 : 7;
      for (let i = 0; i < n; i++) {
        const r = fox ? (i < 2 ? 0.035 + i * 0.012 : i < 5 ? 0.06 - (i - 2) * 0.004 : 0.04) : 0.028 - i * 0.0018;
        const col = fox && i >= n - 1 ? "#ffffff" : app.hairColor;
        add(parent, mesh(sphere(r, 1, 1, 1.5, 10), stdMat(col, { rough: 0.9 })), 0, 0, -r * 1.4);
        const nx = grp(parent, 0, 0, -r * 2.5);
        this.tails.push(nx);
        parent = nx;
      }
      (this.tails[0].parent as THREE.Object3D).rotation.x = 0.7;
    }

    // ---------------- Оружие ----------------
    this.weapon = {};
    if (o.weapon !== false) {
      const w = buildWeapon(cls, o.weaponTier ?? 0);
      this.weapon = w;
      if (w.right) { w.right.rotation.x = Math.PI / 2; w.right.position.set(0, -0.04, 0.0); handR.add(w.right); }
      if (w.left) {
        w.left.rotation.x = Math.PI / 2; w.left.position.set(0, -0.04, 0);
        if (cls === "shieldbearer") { w.left.position.set(0.0, 0.0, 0.0); w.left.rotation.x = Math.PI / 2; w.left.position.y = -0.1; w.left.position.z = 0.08; }
        if (cls === "sorcerer") { w.left.rotation.x = Math.PI / 2; w.left.position.set(0, -0.06, 0.02); w.left.rotation.z = 0; w.left.rotation.x = 0; w.left.position.y = -0.02; }
        handL.add(w.left);
      }
      if (w.back) { w.back.rotation.set(0.0, 0, 0.35); spine.add(w.back); w.back.position.set(0.08, 0.1, -0.15); w.back.rotation.z = 0.5; }
      if (cls === "mage" || cls === "tamer" || cls === "archer") { /* единичные хваты */ }
    }

    // ---------------- Ауры высоких тиров ----------------
    if (tier >= 4 && !bone) {
      const ring = mesh(new THREE.TorusGeometry(0.55, 0.012, 6, 40), basicMat(P.glow, 0.5, true), false);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; this.root.add(ring);
      this.extra.push((t) => { ring.rotation.z = t * 0.8; ring.scale.setScalar(1 + Math.sin(t * 2) * 0.05); });
    }
    if (cls === "sorcerer" && tier >= 2 && !bone) {
      const rune = mesh(new THREE.TorusGeometry(0.34, 0.01, 6, 5), basicMat("#c070ff", 0.8, true), false);
      rune.position.set(0, 1.2, -0.3); this.root.add(rune);
      this.extra.push((t) => { rune.rotation.z = t; });
    }

    this.group.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
    this.pose = this.computeBase(0);
  }

  private handGlove: null = null;

  private buildHair(headG: THREE.Object3D, app: Appearance, mat: THREE.Material, female: boolean, covered: boolean, ..._rest: THREE.Material[]) {
    void _rest;
    const add = <T extends THREE.Object3D>(p: THREE.Object3D, c: T, x = 0, y = 0, z = 0): T => { c.position.set(x, y, z); p.add(c); return c; };
    const HR = 0.118;
    const style = app.hair;
    const cap = (scale = 1.07, theta = 0.62, tilt = -0.28) => {
      const m = mesh(new THREE.SphereGeometry(HR * scale, 28, 16, 0, Math.PI * 2, 0, Math.PI * Math.min(theta, 0.56)), mat);
      m.scale.set(0.97, 1.06, 1.0);
      m.rotation.x = tilt;
      headG.add(m);
      return m;
    };
    const strand = (len: number, rTop: number, flat = 0.55) => {
      const pts: [number, number][] = [];
      const N = 8;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        pts.push([Math.max(0.0015, rTop * Math.pow(1 - t, 0.75) * (1 + Math.sin(t * Math.PI) * 0.3)), -len * t]);
      }
      pts.reverse();
      const g = lathe(pts, 8);
      g.scale(1, 1, flat);
      return mesh(g, mat);
    };
    const bangs = (n: number, len: number, spread = 1) => {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : i / (n - 1) - 0.5;
        const ang = u * 2.0 * spread;
        const s = strand(len * 0.45 * (1 - Math.abs(u) * 0.35), 0.03, 0.5);
        const g = new THREE.Group();
        g.position.set(Math.sin(ang) * HR * 1.0, 0.095 + Math.cos(ang) * 0.015, Math.cos(ang) * HR * 0.9);
        g.rotation.y = ang;
        g.rotation.x = -0.35;
        g.add(s);
        headG.add(g);
      }
    };
    const hangBack = (len: number, w: number, layers = 3) => {
      for (let i = 0; i < layers; i++) {
        const s = strand(len * (1 - i * 0.08), 0.085 + w, 0.45);
        const g = new THREE.Group();
        g.position.set((i - (layers - 1) / 2) * 0.05, 0.03 - i * 0.01, -0.07);
        g.rotation.x = 0.12; g.rotation.z = (i - (layers - 1) / 2) * 0.12;
        g.add(s); headG.add(g);
        this.hairSway.push(g);
      }
    };
    if (covered) { cap(1.05, 0.5, -0.1); return; }
    switch (style) {
      case 0: // короткая
        cap(1.07, 0.6, -0.3); bangs(5, 0.1); break;
      case 1: // длинная прямая
        cap(1.08, 0.62, -0.3); bangs(7, 0.17); hangBack(female ? 0.62 : 0.5, 0.01);
        for (const s of [-1, 1]) { const l = strand(0.4, 0.04, 0.5); const g = new THREE.Group(); g.position.set(s * HR * 0.95, 0.0, 0.03); g.rotation.z = s * 0.05; g.add(l); headG.add(g); this.hairSway.push(g); }
        break;
      case 2: { // хвост
        cap(1.07, 0.6, -0.3); bangs(5, 0.12);
        add(headG, mesh(sphere(0.03), stdMat("#e0e0e0")), 0, 0.09, -0.12);
        const g = new THREE.Group(); g.position.set(0, 0.08, -0.13); g.rotation.x = 0.7;
        g.add(strand(0.55, 0.06, 0.8)); headG.add(g); this.hairSway.push(g);
        break;
      }
      case 3: { // два хвоста
        cap(1.07, 0.6, -0.3); bangs(5, 0.13);
        for (const s of [-1, 1]) {
          add(headG, mesh(sphere(0.026), stdMat("#ff6a8a")), s * 0.1, 0.07, -0.04);
          const g = new THREE.Group(); g.position.set(s * 0.11, 0.07, -0.04); g.rotation.z = s * 0.25; g.rotation.x = 0.1;
          g.add(strand(0.5, 0.05, 0.8)); headG.add(g); this.hairSway.push(g);
        }
        break;
      }
      case 4: { // каре
        cap(1.07, 0.62, -0.3); bangs(7, 0.13);
        const bob = mesh(lathe([[0.127, -0.095], [0.133, -0.04], [0.136, 0.03], [0.12, 0.09]], 24), mat);
        bob.scale.set(0.98, 1, 1.0); bob.position.set(0, 0.0, -0.01); headG.add(bob);
        break;
      }
      case 5: { // ёжик
        cap(1.06, 0.55, -0.35);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2, ph = (i % 3) * 0.2;
          const sp = mesh(new THREE.ConeGeometry(0.03, 0.13 + (i % 2) * 0.04, 6), mat);
          sp.position.set(Math.sin(a) * 0.075, 0.1 + Math.cos(a * 2) * 0.01, Math.cos(a) * 0.075 - 0.01);
          sp.rotation.set(Math.cos(a) * (0.5 + ph), 0, -Math.sin(a) * (0.5 + ph));
          headG.add(sp);
        }
        break;
      }
      case 6: { // ирокез
        cap(1.03, 0.4, -0.3);
        for (let i = 0; i < 7; i++) {
          const sp = mesh(new THREE.ConeGeometry(0.035, 0.16 - Math.abs(i - 3) * 0.015, 6), mat);
          sp.position.set(0, 0.1 + 0.02 * Math.cos(i * 0.5), 0.07 - i * 0.026); sp.rotation.x = -0.2 - (i - 3) * 0.12; headG.add(sp);
        }
        break;
      }
      case 7: { // коса
        cap(1.07, 0.62, -0.3); bangs(5, 0.12);
        const g = new THREE.Group(); g.position.set(0, 0.04, -0.12); g.rotation.x = 0.15; headG.add(g);
        for (let i = 0; i < 9; i++) add(g, mesh(sphere(0.036 - i * 0.002, 1, 1.25, 1, 10), mat), (i % 2 ? 0.014 : -0.014), -i * 0.058, -i * 0.01);
        add(g, mesh(sphere(0.026), stdMat("#e8c040")), 0, -0.55, -0.08);
        this.hairSway.push(g);
        break;
      }
      case 8: { // пучок
        cap(1.07, 0.62, -0.3); bangs(5, 0.11);
        add(headG, mesh(sphere(0.06, 1, 0.85, 1), mat), 0, 0.14, -0.04);
        add(headG, mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 14), stdMat("#e0c050", { metal: 0.6, rough: 0.3 })), 0, 0.115, -0.04).rotation.x = Math.PI / 2;
        break;
      }
      default: { // волна
        cap(1.08, 0.62, -0.3); bangs(6, 0.15);
        hangBack(female ? 0.5 : 0.4, 0.03, 4);
        for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * HR * 0.95, 0.03, 0.05); g.rotation.z = s * 0.2; g.add(strand(0.36, 0.05, 0.6)); headG.add(g); this.hairSway.push(g); }
      }
    }
  }

  private buildHeadgear(headG: THREE.Object3D, kind: string, helm: boolean, metal: THREE.Material, trim: THREE.Material, cloth: THREE.Material, cloth2: THREE.Material, leather: THREE.Material, fur: THREE.Material, tier: number, gem: string) {
    const add = <T extends THREE.Object3D>(p: THREE.Object3D, c: T, x = 0, y = 0, z = 0): T => { c.position.set(x, y, z); p.add(c); return c; };
    const HR = 0.118;
    const shell = (r: number, theta: number, mat: THREE.Material, tilt = -0.15) => {
      const m = mesh(new THREE.SphereGeometry(HR * r, 24, 14, 0, Math.PI * 2, 0, Math.PI * theta), mat);
      m.scale.set(0.97, 1.06, 1.02); m.rotation.x = tilt; headG.add(m); return m;
    };
    if (kind === "closed" || kind === "plume") {
      if (kind === "closed") {
        const full = mesh(lathe([[0.001, -0.125], [0.085, -0.1], [0.125, -0.04], [0.135, 0.04], [0.12, 0.1], [0.07, 0.14], [0.001, 0.15]], 24), metal);
        full.scale.set(1, 1, 1.05); headG.add(full);
        add(headG, mesh(new THREE.BoxGeometry(0.17, 0.022, 0.05), stdMat("#0a0a10", { rough: 0.9 })), 0, 0.01, 0.125);
        add(headG, mesh(new THREE.BoxGeometry(0.02, 0.1, 0.03), stdMat("#0a0a10")), 0, -0.05, 0.128);
        add(headG, mesh(new THREE.BoxGeometry(0.014, 0.1, 0.2), trim), 0, 0.14, 0);
        this.eyes.forEach((e) => (e.visible = false));
      } else {
        shell(1.1, 0.58, metal);
        for (const s of [-1, 1]) add(headG, mesh(sphere(0.05, 0.5, 1.1, 0.9), metal), s * 0.115, -0.04, 0.0);
        add(headG, mesh(new THREE.BoxGeometry(0.014, 0.1, 0.014), metal), 0, -0.01, 0.12);
        add(headG, mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 22), trim), 0, 0.05, 0.0).rotation.x = Math.PI / 2;
      }
      const plume = new THREE.Group(); plume.position.set(0, 0.14, -0.02); headG.add(plume);
      for (let i = 0; i < 5; i++) { const pl = add(plume, mesh(sphere(0.034 - i * 0.003, 0.7, 1, 1.5), cloth2), 0, 0.02 + i * 0.005, -i * 0.05); pl.position.y -= i * i * 0.004; }
      this.hairSway.push(plume);
    } else if (kind === "hat") {
      const hat = new THREE.Group(); hat.position.set(0, 0.07, 0); hat.rotation.x = -0.1; headG.add(hat);
      add(hat, mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.012, 28), cloth), 0, 0.02, 0.0);
      add(hat, mesh(lathe([[0.135, 0.0], [0.12, 0.1], [0.085, 0.22], [0.045, 0.34], [0.01, 0.43]], 20), cloth), 0, 0.02, 0);
      add(hat, mesh(new THREE.TorusGeometry(0.128, 0.014, 6, 20), cloth2), 0, 0.045, 0).rotation.x = Math.PI / 2;
      add(hat, mesh(sphere(0.022), stdMat(gem, { emissive: gem, ei: 1.3 })), 0, 0.05, 0.13);
      add(hat, mesh(sphere(0.02), trim), 0, 0.455, 0);
      this.hairSway.push(hat);
    } else if (kind === "hood") {
      shell(1.13, 0.68, cloth, -0.12);
      const rim = add(headG, mesh(new THREE.TorusGeometry(HR * 1.03, 0.012, 6, 24, Math.PI * 1.3), cloth2), 0, 0.03, 0.0); rim.rotation.set(Math.PI / 2 - 0.2, 0, Math.PI * 0.85);
      // маска
      add(headG, mesh(new THREE.SphereGeometry(HR * 0.97, 20, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.2), stdMat("#1c1826", { rough: 0.9 })), 0, 0.0, 0.01).scale.set(0.98, 1.0, 1.04);
    } else if (kind === "crown") {
      add(headG, mesh(new THREE.TorusGeometry(0.115, 0.012, 6, 24), trim), 0, 0.075, 0.0).rotation.x = Math.PI / 2 - 0.12;
      for (const s of [-1, 1]) {
        const pts = [new THREE.Vector3(s * 0.1, 0.07, 0), new THREE.Vector3(s * 0.17, 0.12, 0), new THREE.Vector3(s * 0.2, 0.22, -0.02), new THREE.Vector3(s * 0.15, 0.3, -0.04)];
        add(headG, mesh(tube(pts, 0.022, 0.004, 10, 6), stdMat("#2a1c34", { rough: 0.4, metal: 0.5 })), 0, 0, 0);
      }
      add(headG, mesh(new THREE.OctahedronGeometry(0.03, 0), stdMat(gem, { emissive: gem, ei: 1.6 })), 0, 0.105, 0.11);
    } else if (kind === "horn") {
      shell(1.1, 0.5, metal, -0.12);
      add(headG, mesh(new THREE.TorusGeometry(HR * 1.08, 0.028, 8, 22), fur), 0, 0.045, 0).rotation.x = Math.PI / 2 - 0.1;
      for (const s of [-1, 1]) {
        const pts = [new THREE.Vector3(s * 0.11, 0.05, 0), new THREE.Vector3(s * 0.19, 0.08, 0), new THREE.Vector3(s * 0.24, 0.18, 0.01), new THREE.Vector3(s * 0.2, 0.3, 0.03)];
        add(headG, mesh(tube(pts, 0.03, 0.006, 10, 8), stdMat("#e8e0cc", { rough: 0.5 })), 0, 0.0, 0);
      }
      if (tier >= 3) add(headG, mesh(new THREE.ConeGeometry(0.02, 0.1, 6), trim), 0, 0.15, 0.02);
    } else if (kind === "feather") {
      add(headG, mesh(new THREE.TorusGeometry(HR * 1.0, 0.012, 6, 24), leather), 0, 0.055, 0).rotation.x = Math.PI / 2 - 0.1;
      add(headG, mesh(sphere(0.02), stdMat(gem, { emissive: gem, ei: 1.2 })), 0, 0.075, 0.115);
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.24 + i * 0.03), new THREE.MeshStandardMaterial({ color: ["#e04040", "#f0e040", "#40c0e0"][i], side: THREE.DoubleSide, roughness: 0.7 }));
        f.position.set(0.1 + i * 0.012, 0.1 - i * 0.015, -0.04 - i * 0.015); f.rotation.z = -0.55 - i * 0.14; f.rotation.y = 0.4; headG.add(f);
        this.hairSway.push(f);
      }
    }
    void helm; void cloth;
  }

  // ---------------- Анимация ----------------
  setSpeed(v: number) { this.targetSpeed = v; }
  play(kind: ActionKind, dur = 0.7) {
    this.altSlash = !this.altSlash;
    this.act = { kind, p: 0, dur, alt: this.altSlash };
  }
  get acting() { return !!this.act; }
  setDead(d: boolean) { this.dead = d; if (!d) { this.fall = 0; } }

  private computeBase(s: number): Pose {
    const t = this.t, st = this.stance;
    const br = Math.sin(t * 1.9);
    const swing = Math.sin(this.phase);
    const run = clamp(s, 0, 1.3);
    const hold = st.hold;
    const aw = hold === 2 ? 0.18 : 0.35;
    const p: Pose = {
      hipsY: 0.93 - st.crouch * (1 - run * 0.5) - Math.abs(Math.cos(this.phase)) * 0.035 * run + br * 0.004,
      hipsRx: 0.0, hipsRy: 0,
      spineX: 0.02 + br * 0.012 + run * 0.14, spineY: Math.sin(this.phase) * 0.1 * run, spineZ: 0,
      headX: -0.02 - run * 0.1, headY: Math.sin(t * 0.6) * 0.05 * (1 - run),
      shRx: st.shRx + (swing * 0.5 * run) * aw * 2 + br * 0.015,
      shRz: st.shRz, shRy: 0,
      elR: st.elR - run * 0.3,
      shLx: st.shLx - (swing * 0.5 * run) * aw * 2 - br * 0.015,
      shLz: st.shLz, shLy: 0,
      elL: st.elL - run * 0.3,
      hipRx: swing * 0.95 * run, hipRz: -0.05 - st.crouch * 0.6, kneeR: Math.max(0, -Math.cos(this.phase)) * 1.15 * run + st.crouch * 2.2,
      hipLx: -swing * 0.95 * run, hipLz: 0.05 + st.crouch * 0.6, kneeL: Math.max(0, Math.cos(this.phase)) * 1.15 * run + st.crouch * 2.2,
    };
    // свободные руки машут активнее
    if (hold === 1) { p.shLx = st.shLx - swing * 0.9 * run * 0.8; p.shRx = st.shRx + swing * 0.5 * run; }
    p.hipRx -= st.crouch * 1.4; p.hipLx -= st.crouch * 1.4;
    p.spineX += st.crouch * 1.2;
    return p;
  }

  private applyLoop(p: Pose) {
    const t = this.t;
    if (this.loop === "wave") { p.shRx = -2.6; p.shRz = -0.5; p.elR = -0.5 + Math.sin(t * 7) * 0.5; p.headY = 0.2; }
    else if (this.loop === "cheer") { p.shRx = -2.8; p.shLx = -2.8; p.shRz = -0.35; p.shLz = 0.35; p.elR = -0.3 + Math.sin(t * 9) * 0.2; p.elL = -0.3 - Math.sin(t * 9) * 0.2; p.hipsY += Math.abs(Math.sin(t * 6)) * 0.06; }
    else if (this.loop === "talk") { p.shRx = -0.9 + Math.sin(t * 2.2) * 0.25; p.elR = -1.2 + Math.sin(t * 3) * 0.3; p.shRz = -0.25; p.headY = Math.sin(t * 1.3) * 0.2; p.headX = Math.sin(t * 2) * 0.05; }
    else if (this.loop === "block") { p.shLx = -1.4; p.elL = -1.8; p.shLz = 0.1; p.spineX += 0.1; p.shRx = -0.9; p.elR = -1.4; }
    else if (this.loop === "sit") { p.hipsY = 0.5; p.hipRx = -1.5; p.hipLx = -1.5; p.kneeR = 1.5; p.kneeL = 1.5; p.spineX = 0.1; }
  }

  private applyAction(p: Pose) {
    const a = this.act!;
    const q = a.p;
    const st = this.stance;
    const k = (keys: [number, number][]) => seq(q, keys);
    const two = st.hold === 2;
    switch (a.kind) {
      case "slash":
      case "slash2": {
        const alt = a.kind === "slash2" || a.alt;
        if (!alt) {
          p.shRx = k([[0, p.shRx], [0.28, -2.7], [0.48, -1.0], [1, p.shRx]]);
          p.shRz = k([[0, p.shRz], [0.28, -0.35], [0.48, 0.15], [1, p.shRz]]);
          p.elR = k([[0, p.elR], [0.28, -1.3], [0.48, -0.25], [1, p.elR]]);
          p.spineY = k([[0, 0], [0.28, 0.55], [0.48, -0.65], [1, 0]]);
          p.spineX = p.spineX + k([[0, 0], [0.28, -0.2], [0.48, 0.32], [1, 0]]);
          p.hipRx += k([[0, 0], [0.48, 0.5], [1, 0]]); p.hipLx += k([[0, 0], [0.48, -0.7], [1, 0]]);
          p.kneeL += k([[0, 0], [0.48, 0.6], [1, 0]]);
        } else {
          p.shRx = k([[0, p.shRx], [0.28, -1.5], [0.5, -1.35], [1, p.shRx]]);
          p.shRz = k([[0, p.shRz], [0.28, -1.4], [0.5, 0.6], [1, p.shRz]]);
          p.elR = k([[0, p.elR], [0.28, -0.6], [0.5, -0.2], [1, p.elR]]);
          p.spineY = k([[0, 0], [0.28, 0.9], [0.5, -0.95], [1, 0]]);
          p.headY = k([[0, 0], [0.3, 0.3], [0.5, -0.4], [1, 0]]);
        }
        if (two) {
          p.shLx = k([[0, p.shLx], [0.28, -2.4], [0.48, -1.2], [1, p.shLx]]);
          p.shLz = k([[0, p.shLz], [0.28, 0.1], [0.48, -0.1], [1, p.shLz]]);
          p.elL = k([[0, p.elL], [0.28, -1.2], [0.48, -0.5], [1, p.elL]]);
        }
        break;
      }
      case "stab": {
        const L = a.alt;
        const first = (q0: number) => k([[0, 0], [q0, 0], [q0 + 0.12, 1], [q0 + 0.3, 0], [1, 0]]);
        p.shLx = p.shLx + (-1.0) * first(L ? 0.05 : 0.45) - 0.1 * first(L ? 0.45 : 0.05);
        p.shRx = p.shRx + (-1.0) * first(L ? 0.45 : 0.05) - 0.1 * first(L ? 0.05 : 0.45);
        p.elL = p.elL + 0.8 * first(L ? 0.05 : 0.45);
        p.elR = p.elR + 0.8 * first(L ? 0.45 : 0.05);
        p.spineY = (L ? 1 : -1) * k([[0, 0], [0.15, 0.4], [0.4, -0.35], [0.7, 0.35], [1, 0]]);
        p.hipRx += k([[0, 0], [0.3, 0.4], [1, 0]]); p.hipLx += k([[0, 0], [0.3, -0.4], [1, 0]]);
        break;
      }
      case "cast": {
        p.shRx = k([[0, p.shRx], [0.35, -2.5], [0.55, -1.5], [1, p.shRx]]);
        p.shRz = k([[0, p.shRz], [0.35, -0.3], [0.55, -0.1], [1, p.shRz]]);
        p.elR = k([[0, p.elR], [0.35, -0.7], [0.55, -0.15], [1, p.elR]]);
        p.shLx = k([[0, p.shLx], [0.35, -2.2], [0.55, -1.5], [1, p.shLx]]);
        p.elL = k([[0, p.elL], [0.35, -0.8], [0.55, -0.2], [1, p.elL]]);
        p.spineX += k([[0, 0], [0.35, -0.25], [0.55, 0.2], [1, 0]]);
        p.headX = k([[0, p.headX], [0.35, -0.3], [0.55, 0.1], [1, p.headX]]);
        break;
      }
      case "shoot": {
        p.shLx = k([[0, p.shLx], [0.15, -1.55], [0.85, -1.55], [1, p.shLx]]);
        p.shLz = k([[0, p.shLz], [0.15, 0.25], [1, p.shLz]]);
        p.elL = k([[0, p.elL], [0.15, -0.05], [0.85, -0.05], [1, p.elL]]);
        p.shRx = k([[0, p.shRx], [0.15, -1.45], [0.85, -1.45], [1, p.shRx]]);
        p.shRz = k([[0, p.shRz], [0.15, -0.9], [0.85, -0.9], [1, p.shRz]]);
        p.elR = k([[0, p.elR], [0.15, -0.6], [0.5, -2.3], [0.6, -0.9], [1, p.elR]]);
        p.spineY = k([[0, 0], [0.15, -0.55], [0.85, -0.55], [1, 0]]);
        p.headY = k([[0, 0], [0.15, 0.5], [0.85, 0.5], [1, 0]]);
        break;
      }
      case "bash": {
        p.shLx = k([[0, p.shLx], [0.25, -0.7], [0.42, -1.75], [1, p.shLx]]);
        p.elL = k([[0, p.elL], [0.25, -2.0], [0.42, -0.9], [1, p.elL]]);
        p.shRx = k([[0, p.shRx], [0.3, -2.3], [0.55, -1.0], [1, p.shRx]]);
        p.elR = k([[0, p.elR], [0.3, -1.0], [0.55, -0.3], [1, p.elR]]);
        p.spineX += k([[0, 0], [0.42, 0.3], [1, 0]]);
        p.spineY = k([[0, 0], [0.25, 0.4], [0.5, -0.35], [1, 0]]);
        break;
      }
      case "whip": {
        p.shRx = k([[0, p.shRx], [0.3, -2.4], [0.5, -1.1], [1, p.shRx]]);
        p.shRz = k([[0, p.shRz], [0.3, -0.5], [0.5, 0.3], [1, p.shRz]]);
        p.elR = k([[0, p.elR], [0.3, -0.5], [0.5, -0.1], [1, p.elR]]);
        p.spineY = k([[0, 0], [0.3, 0.6], [0.5, -0.5], [1, 0]]);
        p.spineX += k([[0, 0], [0.5, 0.2], [1, 0]]);
        break;
      }
      case "spin": {
        p.shRx = k([[0, p.shRx], [0.2, -1.4], [0.8, -1.4], [1, p.shRx]]);
        p.shRz = k([[0, p.shRz], [0.2, -1.3], [0.8, -1.3], [1, p.shRz]]);
        p.shLx = k([[0, p.shLx], [0.2, -1.2], [0.8, -1.2], [1, p.shLx]]);
        p.shLz = k([[0, p.shLz], [0.2, 1.3], [0.8, 1.3], [1, p.shLz]]);
        p.elR = k([[0, p.elR], [0.2, -0.3], [0.8, -0.3], [1, p.elR]]);
        p.elL = k([[0, p.elL], [0.2, -0.3], [0.8, -0.3], [1, p.elL]]);
        p.hipsY -= k([[0, 0], [0.2, 0.08], [0.8, 0.08], [1, 0]]);
        break;
      }
      case "leap": {
        p.hipsY += k([[0, 0], [0.2, -0.12], [0.5, 0.15], [1, 0]]);
        p.spineX += k([[0, 0], [0.2, 0.3], [0.5, 0.4], [1, 0]]);
        p.shRx = k([[0, p.shRx], [0.2, 0.4], [0.5, -2.5], [1, p.shRx]]);
        p.shLx = k([[0, p.shLx], [0.2, 0.4], [0.5, -2.5], [1, p.shLx]]);
        p.hipRx += k([[0, 0], [0.5, -0.9], [1, 0]]); p.hipLx += k([[0, 0], [0.5, -0.4], [1, 0]]);
        p.kneeR += k([[0, 0], [0.2, 0.9], [0.5, 0.5], [1, 0]]); p.kneeL += k([[0, 0], [0.2, 0.9], [0.5, 0.9], [1, 0]]);
        break;
      }
      case "buff": {
        p.shRx = k([[0, p.shRx], [0.3, -2.9], [0.7, -2.9], [1, p.shRx]]);
        p.shLx = k([[0, p.shLx], [0.3, -2.9], [0.7, -2.9], [1, p.shLx]]);
        p.shRz = k([[0, p.shRz], [0.3, -0.45], [1, p.shRz]]); p.shLz = k([[0, p.shLz], [0.3, 0.45], [1, p.shLz]]);
        p.elR = k([[0, p.elR], [0.3, -0.25], [1, p.elR]]); p.elL = k([[0, p.elL], [0.3, -0.25], [1, p.elL]]);
        p.headX = k([[0, p.headX], [0.3, -0.35], [0.7, -0.35], [1, p.headX]]);
        p.spineX += k([[0, 0], [0.3, -0.2], [0.7, -0.2], [1, 0]]);
        break;
      }
      case "heal": {
        p.shRx = k([[0, p.shRx], [0.3, -1.3], [0.8, -1.3], [1, p.shRx]]); p.shLx = k([[0, p.shLx], [0.3, -1.3], [0.8, -1.3], [1, p.shLx]]);
        p.shRz = k([[0, p.shRz], [0.3, -0.6], [1, p.shRz]]); p.shLz = k([[0, p.shLz], [0.3, 0.6], [1, p.shLz]]);
        p.elR = k([[0, p.elR], [0.3, -0.4], [1, p.elR]]); p.elL = k([[0, p.elL], [0.3, -0.4], [1, p.elL]]);
        p.headX = k([[0, p.headX], [0.3, -0.25], [0.8, -0.25], [1, p.headX]]);
        break;
      }
      case "hit": {
        p.spineX += k([[0, 0], [0.18, -0.4], [1, 0]]);
        p.headX = k([[0, p.headX], [0.18, -0.4], [1, p.headX]]);
        p.shRx = k([[0, p.shRx], [0.18, p.shRx + 0.5], [1, p.shRx]]);
        p.shLx = k([[0, p.shLx], [0.18, p.shLx + 0.5], [1, p.shLx]]);
        break;
      }
      case "block": {
        p.shLx = k([[0, p.shLx], [0.2, -1.45], [0.8, -1.45], [1, p.shLx]]);
        p.elL = k([[0, p.elL], [0.2, -1.9], [0.8, -1.9], [1, p.elL]]);
        p.spineX += k([[0, 0], [0.2, 0.15], [0.8, 0.15], [1, 0]]);
        break;
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 10);
    const sp = this.speed;
    if (sp > 0.02) this.phase += dt * (3.2 + sp * 7.5);
    else this.phase *= 0.9;
    const run = sp;
    const p = this.computeBase(run);
    if (this.loop && !this.act && run < 0.1) this.applyLoop(p);
    let spinAngle = 0;
    if (this.act) {
      this.act.p += dt / this.act.dur;
      if (this.act.p >= 1) this.act = null;
      else {
        this.applyAction(p);
        if (this.act.kind === "spin") spinAngle = seq(this.act.p, [[0, 0], [0.15, 0], [0.85, Math.PI * 2], [1, Math.PI * 2]]);
      }
    }
    // применение с демпфированием
    const k = 1 - Math.exp(-dt * 22);
    const cur = this.pose;
    for (const key in p) cur[key] = cur[key] === undefined ? p[key] : cur[key] + (p[key] - cur[key]) * k;
    const b = this.b;
    b.hips.position.y = cur.hipsY;
    b.spine.rotation.set(cur.spineX, cur.spineY, cur.spineZ);
    b.head.rotation.set(cur.headX, cur.headY, 0);
    b.shR.rotation.set(cur.shRx, cur.shRy, cur.shRz);
    b.shL.rotation.set(cur.shLx, cur.shLy, cur.shLz);
    b.elR.rotation.x = cur.elR;
    b.elL.rotation.x = cur.elL;
    b.hipR.rotation.set(cur.hipRx, 0, cur.hipRz);
    b.hipL.rotation.set(cur.hipLx, 0, cur.hipLz);
    b.kneeR.rotation.x = cur.kneeR;
    b.kneeL.rotation.x = cur.kneeL;
    b.ankR.rotation.x = -cur.kneeR * 0.25 - cur.hipRx * 0.3;
    b.ankL.rotation.x = -cur.kneeL * 0.25 - cur.hipLx * 0.3;
    // сопровождающая анимация
    this.body.rotation.y = spinAngle;
    const s = clamp(sp, 0, 1.3);
    this.capes.forEach((c, i) => {
      c.rotation.x = 0.06 + s * (0.35 + i * 0.1) + Math.sin(this.t * 2.4 - i * 0.9) * (0.05 + s * 0.06);
      c.rotation.z = Math.sin(this.t * 1.7 - i * 0.7) * 0.05 * (1 + s);
    });
    this.tails.forEach((tl, i) => {
      tl.rotation.y = Math.sin(this.t * 2.2 - i * 0.55) * (0.28 + s * 0.15);
      tl.rotation.x = Math.sin(this.t * 1.5 - i * 0.4) * 0.12 + 0.12;
    });
    this.hairSway.forEach((h, i) => {
      h.rotation.x = Math.max(h.rotation.x * 0.0, 0) + (h.userData.base ??= h.rotation.x) + s * 0.25 + Math.sin(this.t * 2 + i) * 0.04;
    });
    this.extra.forEach((fn) => fn(this.t, s));
    this.weapon.update?.(this.t);
    // моргание
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkT = 2.5 + Math.random() * 3; this.eyes.forEach((e) => (e.scale.y = 0.12)); }
    else if (this.blinkT < 2.3) this.eyes.forEach((e) => (e.scale.y += (1 - e.scale.y) * Math.min(1, dt * 18)));
    // смерть
    if (this.dead) this.fall = Math.min(1, this.fall + dt * 1.6);
    else this.fall = Math.max(0, this.fall - dt * 2);
    const f = this.fall * this.fall * (3 - 2 * this.fall);
    this.root.rotation.x = -f * 1.5;
    this.root.position.y = f * 0.12;
  }

  dispose() {
    this.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat && !(mat as THREE.MeshBasicMaterial).map) mat.dispose();
    });
  }

  /** точка над головой для привязки меток */
  get topY() { return 1.95 * this.heightScale; }
  get skin() { return this.skinMat; }
}
