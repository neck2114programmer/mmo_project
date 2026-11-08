import type { ZoneId } from "../types";
import { fbm, noise2, smoothstep, lerp } from "./balance";
import { EXTRA_ZONES, MEADOW_EXTRA_PORTAL } from "./zones2";

export interface SpawnDef { mob: string; x: number; z: number; r: number; n: number; lvl: [number, number] }
export interface BuildingDef { kind: string; x: number; z: number; ry?: number; s?: number }
export interface PropRule {
  kind: string; n: number; region?: { x: number; z: number; r: number }; minH?: number; maxH?: number; maxSlope?: number;
  s?: [number, number]; avoidHub?: boolean; ring?: [number, number, number, number];
}
export interface GatherDef { item: string; x: number; z: number; label: string }
export interface PortalDef { x: number; z: number; to: ZoneId; tx: number; tz: number; label: string }
export interface WildDef { model: string; n: number; x: number; z: number; r: number; scale: number; tint?: string }

export interface ZoneDef {
  id: ZoneId; name: string; levels: string; half: number;
  sky: { top: string; mid: string; horizon: string; fog: string; fogNear: number; fogFar: number; sun: string; sunInt: number; sunPos: [number, number, number]; amb: string; ambInt: number; hemiSky: string; hemiGround: string; hemiInt: number };
  ground: { low: string; mid: string; high: string; rock: string; path: string; sand: string };
  height(x: number, z: number): number;
  waterLevel: number; waterColor: string; waterDeep: string;
  river?: { cx(z: number): number; hw: number };
  ponds: { x: number; z: number; r: number }[];
  bridges: { z: number }[];
  hub: { x: number; z: number; r: number };
  paths: [number, number][][];
  buildings: BuildingDef[];
  props: PropRule[];
  gathers: GatherDef[];
  mobs: SpawnDef[];
  portals: PortalDef[];
  wild: WildDef[];
  ambient: "butterflies" | "dust" | "fireflies" | "spores" | "embers";
  cave?: boolean;
}

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x - cx, z - cz);

function rim(x: number, z: number, gaps: [number, number][], start = 78, end = 104, circular = false, amp = 18) {
  const e = circular ? Math.hypot(x, z) : Math.max(Math.abs(x), Math.abs(z));
  let r = smoothstep(start, end, e);
  for (const [gx, gz] of gaps) r *= smoothstep(6, 26, dist(x, z, gx, gz));
  return r * (amp + fbm(x * 0.05 + 7, z * 0.05 + 3, 3) * amp * 0.9);
}

// ---------- ОПУШКА ----------
const mRiver = (z: number) => 30 + 7 * Math.sin(z / 17) + 3 * Math.sin(z / 7.3);
const M_WL = -0.4;
const meadowGaps: [number, number][] = [[92, 4]];
function meadowH(x: number, z: number) {
  let h = (fbm(x * 0.022 + 10, z * 0.022 + 3, 4) - 0.35) * 8 + (noise2(x * 0.12, z * 0.12) - 0.5) * 0.5;
  h = lerp(h, 0.5, 1 - smoothstep(12, 36, dist(x, z, -25, 4)));
  const d = Math.abs(x - mRiver(z));
  h = lerp(M_WL - 1.3, h, smoothstep(1.6, 11, d));
  return h + rim(x, z, meadowGaps);
}
// ---------- ПУСТЫНЯ ----------
const D_WL = -0.6;
const desertGaps: [number, number][] = [[-92, 0], [92, -10]];
function desertH(x: number, z: number) {
  const f = fbm(x * 0.018 + 50, z * 0.012 + 8, 4);
  const ridge = 1 - Math.abs(2 * fbm(x * 0.03 + 3, z * 0.02 + 31, 3) - 1);
  let h = ridge * ridge * 5.5 + f * 4 - 2;
  h = lerp(h, 0.2, 1 - smoothstep(10, 30, dist(x, z, -38, 0)));
  h = lerp(h, 0.5, 1 - smoothstep(14, 26, dist(x, z, 58, -48)));
  h = lerp(D_WL - 1.1, h, smoothstep(2, 10, dist(x, z, -40, 10)));
  h = lerp(h, 0.2, 1 - smoothstep(6, 16, dist(x, z, 70, 55)));
  return h + rim(x, z, desertGaps, 78, 104, false, 16);
}
// ---------- ЛЕС ----------
const F_WL = -0.3;
const forestGaps: [number, number][] = [[-92, 0], [0, -92]];
const fPonds = [{ x: 20, z: 30, r: 10 }, { x: -10, z: -45, r: 8 }, { x: 50, z: -10, r: 7 }];
function forestH(x: number, z: number) {
  let h = (fbm(x * 0.02 + 90, z * 0.02 + 14, 4) - 0.35) * 14;
  h = lerp(h, 0.4, 1 - smoothstep(10, 30, dist(x, z, -26, 0)));
  for (const p of fPonds) h = lerp(F_WL - 1.2, h, smoothstep(p.r * 0.4, p.r + 7, dist(x, z, p.x, p.z)));
  h = lerp(h, 0.3, 1 - smoothstep(6, 18, dist(x, z, 62, 50)));
  return h + rim(x, z, forestGaps, 80, 106, false, 20);
}
// ---------- СКЛЕП ----------
function cryptH(x: number, z: number) {
  const base = (noise2(x * 0.15, z * 0.15) - 0.5) * 0.3 + (fbm(x * 0.04, z * 0.04, 3) - 0.4) * 1.2;
  const r = Math.hypot(x, z);
  const wall = smoothstep(84, 100, r) * (30 + fbm(x * 0.06, z * 0.06, 3) * 25);
  // каменные ямы-пьедесталы
  const dais = (1 - smoothstep(4, 14, dist(x, z, 0, -66))) * 1.2 + (1 - smoothstep(5, 12, dist(x, z, 0, -30))) * 0.6;
  return base + wall + dais;
}

const ring = (cx: number, cz: number, r: number, n: number, kind: string, extra: Partial<BuildingDef> = {}): BuildingDef[] =>
  Array.from({ length: n }, (_, i) => ({ kind, x: cx + Math.cos((i / n) * Math.PI * 2) * r, z: cz + Math.sin((i / n) * Math.PI * 2) * r, ry: (i / n) * Math.PI * 2, ...extra }));

export const ZONES: Record<ZoneId, ZoneDef> = {
  ...EXTRA_ZONES,
  meadow: {
    id: "meadow", name: "Опушка Рассвета", levels: "1–12", half: 100,
    sky: { top: "#3f8fe8", mid: "#8ec6ff", horizon: "#fff1d6", fog: "#cfe6f7", fogNear: 60, fogFar: 230, sun: "#fff0c8", sunInt: 3.2, sunPos: [-80, 110, 60], amb: "#b8d0ff", ambInt: 0.5, hemiSky: "#cfe8ff", hemiGround: "#6b8a4a", hemiInt: 1.0 },
    ground: { low: "#4f8a3a", mid: "#6fae48", high: "#8ec45c", rock: "#7d7a72", path: "#b69a6e", sand: "#d9c995" },
    height: meadowH, waterLevel: M_WL, waterColor: "#4aa8d8", waterDeep: "#1f6a9a",
    river: { cx: mRiver, hw: 4 }, ponds: [], bridges: [{ z: 6 }], hub: { x: -25, z: 4, r: 24 },
    paths: [
      [[-25, 4], [-15, 6], [0, 6], [15, 6], [mRiver(6), 6], [55, 5], [90, 4]],
      [[-25, 4], [-34, -2], [-36, -8]],
      [[-25, 4], [-24, 20], [-30, 40]],
      [[-25, 4], [-18, -20], [-10, -45]],
      [[60, 5], [62, -20], [62, -45]],
      [[60, 5], [64, 30], [66, 48]],
    ],
    buildings: [
      { kind: "cottage", x: -37, z: -9, ry: 1.0 },
      { kind: "windmill", x: -52, z: 20, ry: 0.5 },
      { kind: "well", x: -21, z: -3 },
      { kind: "campfire", x: -14, z: 8 },
      { kind: "stall", x: -28, z: 13, ry: 3.4 },
      { kind: "stall", x: -31, z: 8, ry: 3.8 },
      { kind: "watchtower", x: -4, z: -14, ry: 0 },
      { kind: "bridge", x: mRiver(6), z: 6, ry: 0 },
      { kind: "dock", x: 15, z: -10, ry: 0 },
      { kind: "haystack", x: -46, z: 8 }, { kind: "haystack", x: -50, z: 12 }, { kind: "haystack", x: -44, z: 14 },
      { kind: "garden", x: -43, z: -4 },
      ...ring(-37, -9, 11, 10, "fence"),
      { kind: "lamp", x: -22, z: 8 }, { kind: "lamp", x: -10, z: 5 }, { kind: "lamp", x: -30, z: 2 },
      { kind: "banner", x: -5, z: 1 }, { kind: "banner", x: -5, z: 9 },
      { kind: "tent", x: 56, z: -42, ry: 0.4 }, { kind: "tent", x: 62, z: -50, ry: 2.0 }, { kind: "tent", x: 68, z: -42, ry: 3.6 }, { kind: "campfire", x: 62, z: -44 },
      { kind: "cave", x: 70, z: 52, ry: 3.6 },
      { kind: "ruins", x: 20, z: -70, ry: 0 },
      { kind: "stones", x: -70, z: -50 },
    ],
    props: [
      { kind: "oak", n: 70, avoidHub: true, s: [0.9, 1.5] }, { kind: "birch", n: 45, avoidHub: true, s: [0.9, 1.4] }, { kind: "pine", n: 40, avoidHub: true },
      { kind: "oak", n: 40, region: { x: -50, z: -50, r: 40 } }, { kind: "pine", n: 80, region: { x: 0, z: -92, r: 60 }, s: [1.2, 2.0] },
      { kind: "bush", n: 90, avoidHub: false }, { kind: "flowers", n: 120 }, { kind: "rock", n: 40, s: [0.8, 2.2] },
      { kind: "reeds", n: 100, minH: -1.2, maxH: 0.2, region: { x: 28, z: 0, r: 120 } }, { kind: "stump", n: 10 }, { kind: "mushroom", n: 20, region: { x: -45, z: -45, r: 40 } },
      { kind: "willow", n: 6, minH: -0.1, maxH: 0.6, region: { x: 20, z: 0, r: 100 }, s: [1.2, 1.6] },
    ],
    gathers: [
      { item: "healing_herb", x: -42, z: -15, label: "Целебная трава" }, { item: "healing_herb", x: -33, z: -17, label: "Целебная трава" },
      { item: "healing_herb", x: -47, z: -3, label: "Целебная трава" }, { item: "healing_herb", x: -26, z: -20, label: "Целебная трава" },
      { item: "healing_herb", x: -52, z: 6, label: "Целебная трава" }, { item: "healing_herb", x: -12, z: -22, label: "Целебная трава" },
      { item: "healing_herb", x: -8, z: 30, label: "Целебная трава" }, { item: "healing_herb", x: -40, z: 30, label: "Целебная трава" },
      ...[-35, -22, -8, 8, 22, 36].map((z) => ({ item: "river_fish", x: mRiver(z) - 7.2, z, label: "Рыбное место" })),
      { item: "lost_amulet", x: mRiver(14) - 7.4, z: 14, label: "Блестящий амулет" },
    ],
    mobs: [
      { mob: "slime", x: -15, z: 32, r: 14, n: 6, lvl: [1, 3] }, { mob: "slime", x: -38, z: 42, r: 12, n: 4, lvl: [2, 4] },
      { mob: "boar", x: -20, z: -48, r: 18, n: 8, lvl: [3, 6] },
      { mob: "wolf", x: 58, z: 16, r: 20, n: 9, lvl: [4, 8] },
      { mob: "bandit", x: 62, z: -46, r: 12, n: 9, lvl: [6, 9] },
      { mob: "alpha", x: 66, z: 48, r: 1, n: 1, lvl: [10, 10] },
    ],
    portals: [{ x: 90, z: 4, to: "desert", tx: -82, tz: 0, label: "Пески Ал-Хазар" }],
    wild: [{ model: "rabbit", n: 12, x: -20, z: 15, r: 40, scale: 0.9 }, { model: "deer", n: 5, x: 30, z: -30, r: 40, scale: 1 }],
    ambient: "butterflies",
  },
  desert: {
    id: "desert", name: "Пески Ал-Хазар", levels: "12–22", half: 100,
    sky: { top: "#2f86e8", mid: "#8ec2f0", horizon: "#ffe6b8", fog: "#efd6a6", fogNear: 50, fogFar: 210, sun: "#fff0c0", sunInt: 3.8, sunPos: [60, 120, -40], amb: "#ffe2b8", ambInt: 0.55, hemiSky: "#d8ecff", hemiGround: "#c9a060", hemiInt: 1.0 },
    ground: { low: "#d8b575", mid: "#e8c98a", high: "#f3dba0", rock: "#a8845a", path: "#c4a070", sand: "#f0d9a0" },
    height: desertH, waterLevel: D_WL, waterColor: "#3ec8c0", waterDeep: "#1a7a90",
    ponds: [{ x: -40, z: 10, r: 9 }], bridges: [], hub: { x: -38, z: 0, r: 24 },
    paths: [[[-90, 0], [-60, 0], [-38, 0], [0, -4], [30, -20], [58, -40]], [[-38, 0], [-20, 30], [20, 50], [70, 55]], [[0, -4], [40, -8], [90, -10]]],
    buildings: [
      { kind: "bigtent", x: -40, z: -6, ry: 0.5 }, { kind: "bigtent", x: -30, z: -10, ry: 2.0 }, { kind: "tent", x: -46, z: 4, ry: 1.0 },
      { kind: "tent", x: -34, z: 6, ry: 3.4 }, { kind: "tent", x: -50, z: -12, ry: 0.2 }, { kind: "campfire", x: -38, z: -2 },
      { kind: "well", x: -42, z: 20 }, { kind: "lamp", x: -36, z: 2 }, { kind: "banner", x: -44, z: -3 },
      { kind: "pyramid", x: 58, z: -52, s: 1 }, { kind: "obelisk", x: 10, z: -60 }, { kind: "obelisk", x: 14, z: -56, s: 0.6 },
      { kind: "ruins", x: 30, z: 30, ry: 0.5 }, { kind: "ruins", x: -10, z: 60, ry: 2 },
      { kind: "bones", x: 70, z: 55 }, { kind: "bones", x: 74, z: 50 }, { kind: "bones", x: 66, z: 60 },
    ],
    props: [
      { kind: "palm", n: 18, region: { x: -40, z: 10, r: 16 }, minH: -0.1, s: [1.0, 1.4] }, { kind: "palm", n: 10, region: { x: 0, z: 0, r: 90 }, minH: 0, avoidHub: true },
      { kind: "cactus", n: 70 }, { kind: "deadtree", n: 30, avoidHub: true }, { kind: "dunerock", n: 60, s: [0.8, 2.4] },
      { kind: "drygrass", n: 140 }, { kind: "bone", n: 25 }, { kind: "reeds", n: 20, region: { x: -40, z: 10, r: 14 }, minH: -1, maxH: 0.2 },
    ],
    gathers: [
      ...([[-60, -20], [-55, 25], [-20, -25], [-15, 30], [0, 8], [10, -12], [25, 35], [-70, 10]] as [number, number][]).map(([x, z]) => ({ item: "cactus_water", x, z, label: "Светящийся кактус" })),
      { item: "desert_scroll", x: 58, z: -36, label: "Свиток на пьедестале" }, { item: "sun_crystal", x: 11, z: -57, label: "Кристалл Солнца" },
    ],
    mobs: [
      { mob: "scorpion", x: -10, z: 42, r: 22, n: 10, lvl: [12, 15] }, { mob: "cobra", x: 30, z: 15, r: 20, n: 9, lvl: [13, 16] },
      { mob: "golem", x: 40, z: -30, r: 15, n: 7, lvl: [15, 18] }, { mob: "mummy", x: 58, z: -48, r: 20, n: 11, lvl: [17, 20] },
      { mob: "sandqueen", x: 70, z: 55, r: 1, n: 1, lvl: [22, 22] },
    ],
    portals: [
      { x: -92, z: 0, to: "meadow", tx: 86, tz: 4, label: "Опушка Рассвета" },
      { x: 90, z: -10, to: "forest", tx: -82, tz: 0, label: "Лес Друидов" },
    ],
    wild: [], ambient: "dust",
  },
  forest: {
    id: "forest", name: "Лес Друидов Эйнвуд", levels: "22–32", half: 100,
    sky: { top: "#2f6a7a", mid: "#6aa8a0", horizon: "#d4f0cc", fog: "#9cc8aa", fogNear: 30, fogFar: 150, sun: "#e8ffd0", sunInt: 2.6, sunPos: [-40, 90, 70], amb: "#a8d8c0", ambInt: 0.6, hemiSky: "#b8e8d0", hemiGround: "#3a5a30", hemiInt: 1.1 },
    ground: { low: "#2f5a2c", mid: "#3f7a38", high: "#58944a", rock: "#6d6a60", path: "#8a7050", sand: "#a8a070" },
    height: forestH, waterLevel: F_WL, waterColor: "#4ac8a0", waterDeep: "#1a6a60",
    ponds: fPonds, bridges: [], hub: { x: -26, z: 0, r: 22 },
    paths: [[[-90, 0], [-50, 0], [-26, 0], [10, -10], [50, -40]], [[-26, 0], [-10, 30], [20, 45], [62, 50]], [[-26, 0], [-20, -40], [0, -90]]],
    buildings: [
      { kind: "giantTree", x: -24, z: -2, s: 1 }, { kind: "shrine", x: -34, z: -8 }, { kind: "lamp", x: -30, z: 6 }, { kind: "lamp", x: -20, z: 10 },
      { kind: "stall", x: -22, z: 10, ry: 3.4 }, { kind: "stall", x: -34, z: 9, ry: 3.0 }, { kind: "stall", x: -38, z: -2, ry: 1.4 },
      { kind: "stones", x: 55, z: -40 }, { kind: "ruins", x: 62, z: 50, ry: 1 },
      { kind: "giantTree", x: -30, z: 52, s: 0.8 },
    ],
    props: [
      { kind: "oak", n: 130, avoidHub: true, s: [1.2, 2.2] }, { kind: "pine", n: 100, avoidHub: true, s: [1.2, 2.2] }, { kind: "birch", n: 50, avoidHub: true },
      { kind: "bigoak", n: 24, avoidHub: true }, { kind: "bush", n: 140 }, { kind: "fern", n: 260 }, { kind: "mushroom", n: 80 }, { kind: "flowers", n: 60 },
      { kind: "rock", n: 40 }, { kind: "reeds", n: 50, minH: -1.2, maxH: 0.2 }, { kind: "stump", n: 14 }, { kind: "glowshroom", n: 40 }, { kind: "willow", n: 8, minH: -0.2, maxH: 0.6 },
    ],
    gathers: [
      ...([[12, 34], [28, 26], [18, 40], [26, 36], [-4, -41], [-16, -46], [-8, -52], [48, -4]] as [number, number][]).map(([x, z]) => ({ item: "moon_blossom", x, z, label: "Лунный цветок" })),
      { item: "druid_acorn", x: -30, z: 49, label: "Священный жёлудь" },
    ],
    mobs: [
      { mob: "ent", x: 10, z: 22, r: 22, n: 8, lvl: [22, 26] }, { mob: "wisp", x: 20, z: 30, r: 16, n: 9, lvl: [23, 27] },
      { mob: "spider", x: -10, z: -45, r: 18, n: 10, lvl: [25, 29] }, { mob: "druid", x: 55, z: -40, r: 14, n: 10, lvl: [28, 31] },
      { mob: "cornelius", x: 62, z: 50, r: 1, n: 1, lvl: [32, 32] },
    ],
    portals: [
      { x: -92, z: 0, to: "desert", tx: 84, tz: -10, label: "Пески Ал-Хазар" },
      { x: 0, z: -92, to: "crypt", tx: 0, tz: 74, label: "Склеп Короля-Лича" },
    ],
    wild: [{ model: "deer", n: 8, x: 0, z: 0, r: 70, scale: 1 }, { model: "fox", n: 6, x: -20, z: 30, r: 40, scale: 1 }, { model: "rabbit", n: 8, x: -30, z: 5, r: 30, scale: 0.9 }],
    ambient: "fireflies",
  },
  crypt: {
    id: "crypt", name: "Склеп Короля-Лича", levels: "30–40", half: 100,
    sky: { top: "#04050a", mid: "#080c14", horizon: "#0c1218", fog: "#0a1016", fogNear: 12, fogFar: 95, sun: "#6a8aff", sunInt: 0.35, sunPos: [0, 120, 0], amb: "#506a90", ambInt: 0.55, hemiSky: "#3a5070", hemiGround: "#1a2018", hemiInt: 0.7 },
    ground: { low: "#2a2c30", mid: "#3a3c42", high: "#4a4c52", rock: "#2a2a30", path: "#4a4a50", sand: "#3a3a40" },
    height: cryptH, waterLevel: -50, waterColor: "#000", waterDeep: "#000",
    ponds: [], bridges: [], hub: { x: 0, z: 74, r: 14 },
    paths: [[[0, 78], [0, 40], [0, 0], [0, -30], [0, -66]]],
    buildings: [
      ...ring(0, 8, 24, 10, "pillar"), ...ring(0, -66, 16, 8, "pillar"), ...ring(0, 70, 8, 4, "brazier"),
      { kind: "brazier", x: -6, z: 40 }, { kind: "brazier", x: 6, z: 40 }, { kind: "brazier", x: -6, z: 0 }, { kind: "brazier", x: 6, z: 0 },
      { kind: "brazier", x: -6, z: -30 }, { kind: "brazier", x: 6, z: -30 }, { kind: "throne", x: 0, z: -74 },
      { kind: "sarcophagus", x: -30, z: 20 }, { kind: "sarcophagus", x: 30, z: 20 }, { kind: "sarcophagus", x: -34, z: -10 }, { kind: "sarcophagus", x: 34, z: -10 },
      { kind: "bones", x: -20, z: 40 }, { kind: "bones", x: 20, z: 42 }, { kind: "bones", x: 0, z: -20 }, { kind: "bones", x: -40, z: 0 }, { kind: "bones", x: 40, z: 5 },
      { kind: "cryptgate", x: 0, z: 84, ry: 0 },
    ],
    props: [{ kind: "rock", n: 40, s: [0.8, 2.4] }, { kind: "bone", n: 70 }, { kind: "glowshroom", n: 50 }, { kind: "crystal", n: 30 }, { kind: "deadtree", n: 12 }],
    gathers: [],
    mobs: [
      { mob: "skeleton", x: 0, z: 40, r: 20, n: 12, lvl: [30, 33] }, { mob: "ghost", x: -30, z: 10, r: 22, n: 10, lvl: [32, 35] },
      { mob: "ghoul", x: 30, z: 10, r: 20, n: 10, lvl: [34, 37] }, { mob: "bonemage", x: 0, z: -12, r: 16, n: 6, lvl: [34, 37] },
      { mob: "boneknight", x: 0, z: -34, r: 1, n: 1, lvl: [36, 36] }, { mob: "lich", x: 0, z: -66, r: 1, n: 1, lvl: [40, 40] },
    ],
    portals: [{ x: 0, z: 80, to: "forest", tx: 0, tz: -82, label: "Лес Друидов" }],
    wild: [], ambient: "spores", cave: true,
  },
};

ZONES.meadow.portals.push(MEADOW_EXTRA_PORTAL);
export const ZONE_LIST = Object.values(ZONES);
