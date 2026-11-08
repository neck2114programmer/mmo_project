import type { ZoneDef, BuildingDef, PropRule, SpawnDef, PortalDef, WildDef } from "./zones";
import { fbm, noise2, smoothstep, lerp } from "./balance";
import { DUNGEON_OF, GROUPS, MEADOW_PORTAL, NEW_ZONES, REGION, backPortal, dungeonPortal, gatePos, spawnOf, type NewZone } from "./gen";

export const ZONE_TINT: Record<string, [number, number, number]> = {
  capital: [1, 1, 0.96], coast: [1, 1, 0.9], highlands: [0.85, 0.95, 0.9], swamp: [0.7, 0.85, 0.6], tundra: [0.9, 1, 1.1], volcano: [0.6, 0.45, 0.4], mines: [0.6, 0.55, 0.5], sunken: [0.5, 0.7, 0.75], dragon: [0.7, 0.4, 0.3], void: [0.5, 0.4, 0.7],
};
const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x - cx, z - cz);
interface HCfg { seed: number; amp: number; f: number; half: number; flats: [number, number, number][]; lakes: [number, number, number][]; wl: number; mount?: number; sea?: number; cave?: boolean }
const mkH = (c: HCfg) => (x: number, z: number) => {
  if (c.cave) {
    const base = (noise2(x * 0.15, z * 0.15) - 0.5) * 0.3 + (fbm(x * 0.04 + c.seed, z * 0.04, 3) - 0.4) * 1.2;
    const r = Math.hypot(x, z * 0.8);
    let h = base + smoothstep(c.half - 18, c.half - 2, r) * (30 + fbm(x * 0.06, z * 0.06, 3) * 25);
    for (const [fx, fz, fr] of c.flats) h += (1 - smoothstep(fr * 0.4, fr, dist(x, z, fx, fz))) * 1.0;
    return h;
  }
  let h = (fbm(x * c.f + c.seed, z * c.f + c.seed * 0.7, 4) - 0.35) * c.amp + (noise2(x * 0.12, z * 0.12) - 0.5) * 0.5;
  if (c.mount) h += Math.pow(Math.max(0, fbm(x * 0.009 + c.seed * 3, z * 0.009 + 5, 3) - 0.42), 2) * c.mount * 70;
  for (const [fx, fz, fr] of c.flats) h = lerp(h, 0.5, 1 - smoothstep(fr * 0.75, fr * 1.5, dist(x, z, fx, fz)));
  for (const [lx, lz, lr] of c.lakes) h = lerp(c.wl - 1.5, h, smoothstep(lr * 0.4, lr + 9, dist(x, z, lx, lz)));
  if (c.sea) h = lerp(h, c.wl - 4, smoothstep(c.sea, c.sea + 60, x));
  const e = Math.max(Math.abs(x), Math.abs(z));
  return h + smoothstep(c.half - 70, c.half - 12, e) * (22 + fbm(x * 0.03 + 9, z * 0.03 + 4, 3) * 30);
};
const ring = (cx: number, cz: number, r: number, n: number, kind: string, off = 0): BuildingDef[] =>
  Array.from({ length: n }, (_, i) => ({ kind, x: cx + Math.cos((i / n) * 6.283 + off) * r, z: cz + Math.sin((i / n) * 6.283 + off) * r, ry: (i / n) * 6.283 + off + 1.57 }));

type Theme = {
  sky: ZoneDef["sky"]; ground: ZoneDef["ground"]; wc: string; wd: string; amb: ZoneDef["ambient"]; props: PropRule[]; town: string[]; wild: WildDef[];
  amp: number; f: number; mount?: number; sea?: number; wl: number; lakes: [number, number, number][]; seed: number;
};
const SK = (top: string, mid: string, hor: string, fog: string, fn: number, ff: number, sun: string, si: number, amb: string, ai: number, hs: string, hg: string, hi: number): ZoneDef["sky"] =>
  ({ top, mid, horizon: hor, fog, fogNear: fn, fogFar: ff, sun, sunInt: si, sunPos: [-80, 110, 60], amb, ambInt: ai, hemiSky: hs, hemiGround: hg, hemiInt: hi });
const G = (low: string, mid: string, high: string, rock: string, path: string, sand: string) => ({ low, mid, high, rock, path, sand });
const animals = (x: number, z: number, r: number): WildDef[] => [
  { model: "dog", n: 4, x, z, r, scale: 1 }, { model: "cat", n: 4, x, z, r, scale: 1 }, { model: "sheep", n: 5, x, z, r: r * 1.2, scale: 1 }, { model: "cow", n: 3, x, z, r: r * 1.3, scale: 1 }, { model: "chicken", n: 8, x, z, r, scale: 1 },
];
const THEMES: Record<NewZone, Theme> = {
  capital: { sky: SK("#3f8fe8", "#8ec6ff", "#fff1d6", "#cfe6f7", 80, 260, "#fff0c8", 3.2, "#b8d0ff", 0.5, "#cfe8ff", "#6b8a4a", 1.0), ground: G("#5a9a40", "#78b84e", "#94cc60", "#8a8780", "#c4ab7c", "#dccb98"), wc: "#4aa8d8", wd: "#1f6a9a", amb: "butterflies",
    props: [{ kind: "oak", n: 90, avoidHub: true }, { kind: "birch", n: 50, avoidHub: true }, { kind: "bush", n: 90 }, { kind: "flowers", n: 90 }, { kind: "rock", n: 20 }], town: ["cottage", "stall"], wild: [], amp: 5, f: 0.02, wl: -0.4, lakes: [], seed: 5 },
  coast: { sky: SK("#2f9ae0", "#7acbf0", "#fff4dc", "#d4eef7", 80, 280, "#fff2d0", 3.4, "#c0e0ff", 0.55, "#d6f0ff", "#c8b88a", 1.05), ground: G("#78b050", "#98c45a", "#b4d46e", "#8a8a80", "#c8ae7c", "#eadaa8"), wc: "#2fb4d8", wd: "#12607f", amb: "butterflies",
    props: [{ kind: "palm", n: 120 }, { kind: "bush", n: 100 }, { kind: "rock", n: 60 }, { kind: "flowers", n: 80 }, { kind: "dunerock", n: 40 }, { kind: "drygrass", n: 120 }, { kind: "reeds", n: 40, minH: -1.2, maxH: 0.2 }], town: ["cottage", "stall", "haystack"],
    wild: [{ model: "rabbit", n: 10, x: -100, z: 0, r: 150, scale: 1 }, { model: "fox", n: 6, x: -150, z: 80, r: 100, scale: 1 }], amp: 6, f: 0.015, sea: 150, wl: -0.5, lakes: [[-60, -140, 22], [40, 100, 18]], seed: 12 },
  highlands: { sky: SK("#4a82d0", "#8ab4e8", "#e8e4d8", "#c4d0dc", 70, 250, "#fff0d0", 3.0, "#b8c8e8", 0.55, "#c8d8f0", "#5a6a50", 1.0), ground: G("#5d7a48", "#70905a", "#8aa070", "#8a8a92", "#9a8a70", "#b0a890"), wc: "#4a98c8", wd: "#1a5a8a", amb: "dust",
    props: [{ kind: "pine", n: 200 }, { kind: "rock", n: 140 }, { kind: "bush", n: 60 }, { kind: "fern", n: 120 }, { kind: "deadtree", n: 30 }, { kind: "dunerock", n: 40 }], town: ["watchtower", "bigtent", "banner", "stall"],
    wild: [{ model: "deer", n: 10, x: 0, z: 0, r: 200, scale: 1 }, { model: "rabbit", n: 8, x: 60, z: 40, r: 100, scale: 1 }], amp: 14, f: 0.014, mount: 1.2, wl: -0.4, lakes: [[60, 20, 20]], seed: 21 },
  swamp: { sky: SK("#5a7a6a", "#8aa88a", "#c4d0a8", "#a4b898", 30, 150, "#e0f0c0", 2.0, "#a0b8a0", 0.55, "#b0c8b0", "#3a4a2a", 0.9), ground: G("#3f5a35", "#4f6a3a", "#66783f", "#5a5a50", "#6a5a3a", "#5a5a3a"), wc: "#4a6a3a", wd: "#1a3a1a", amb: "fireflies",
    props: [{ kind: "willow", n: 120 }, { kind: "reeds", n: 160, minH: -1.4, maxH: 0.4 }, { kind: "deadtree", n: 100 }, { kind: "mushroom", n: 90 }, { kind: "glowshroom", n: 60 }, { kind: "bush", n: 80 }, { kind: "fern", n: 160 }], town: ["cottage", "tent", "campfire"],
    wild: [{ model: "deer", n: 5, x: 0, z: 0, r: 200, scale: 1 }], amp: 4, f: 0.018, wl: -0.3, lakes: [[-80, -60, 26], [70, -120, 30], [20, 40, 24], [-140, 100, 26], [120, 60, 22], [-40, 140, 24]], seed: 33 },
  tundra: { sky: SK("#6a98d0", "#a8c8e8", "#eef4fa", "#dbe8f4", 50, 220, "#f4f8ff", 2.8, "#c0d0f0", 0.6, "#dce8ff", "#8a9ab0", 1.1), ground: G("#dfe8f0", "#eef4f8", "#fafcff", "#8a96a6", "#b8c4d0", "#c8d4e0"), wc: "#8ac8e8", wd: "#3a7aa8", amb: "dust",
    props: [{ kind: "pine", n: 180 }, { kind: "rock", n: 120 }, { kind: "deadtree", n: 50 }, { kind: "crystal", n: 40 }, { kind: "dunerock", n: 50 }], town: ["bigtent", "tent", "campfire", "banner"], wild: [{ model: "fox", n: 8, x: 0, z: 0, r: 200, scale: 1, tint: "#f0f4f8" }, { model: "rabbit", n: 10, x: 100, z: 60, r: 100, scale: 1 }], amp: 9, f: 0.016, mount: 0.8, wl: -0.4, lakes: [[-30, -100, 28]], seed: 45 },
  volcano: { sky: SK("#2a1418", "#5a2a22", "#c8602a", "#4a2a22", 40, 200, "#ffb070", 2.4, "#c07050", 0.6, "#a06050", "#3a1a10", 0.9), ground: G("#3a2a28", "#4a3430", "#5a403a", "#2a2224", "#5a4a44", "#4a3a34"), wc: "#ff5a1a", wd: "#a01a00", amb: "embers",
    props: [{ kind: "rock", n: 160 }, { kind: "deadtree", n: 90 }, { kind: "dunerock", n: 80 }, { kind: "bone", n: 50 }, { kind: "crystal", n: 30 }], town: ["watchtower", "obelisk", "brazier", "banner"], wild: [], amp: 12, f: 0.016, mount: 1.0, wl: -1.0, lakes: [[40, 60, 30], [-100, -40, 26], [100, -90, 28], [-20, 150, 24]], seed: 57 },
  mines: { sky: SK("#08070a", "#100c0c", "#18120e", "#0c0a08", 14, 100, "#ffb070", 0.5, "#706050", 0.6, "#504030", "#1a1410", 0.7), ground: G("#3a322c", "#4a403a", "#5a4e46", "#2a2622", "#5a4a3a", "#4a4036"), wc: "#000", wd: "#000", amb: "dust", props: [{ kind: "rock", n: 80, s: [0.8, 2.6] }, { kind: "crystal", n: 40 }, { kind: "bone", n: 30 }], town: ["brazier"], wild: [], amp: 1, f: 0.03, wl: -50, lakes: [], seed: 61 },
  sunken: { sky: SK("#04080c", "#08141c", "#0c202a", "#08141a", 14, 100, "#5ad0e0", 0.5, "#40708a", 0.6, "#30606a", "#102028", 0.8), ground: G("#2a4a52", "#36606a", "#46787f", "#243a42", "#4a6a70", "#3a5a60"), wc: "#2a8aa8", wd: "#0a3a50", amb: "spores", props: [{ kind: "crystal", n: 60 }, { kind: "glowshroom", n: 70 }, { kind: "rock", n: 50 }, { kind: "reeds", n: 40 }], town: ["brazier", "pillar"], wild: [], amp: 1, f: 0.03, wl: -50, lakes: [], seed: 67 },
  dragon: { sky: SK("#120504", "#2a0c08", "#4a1a0c", "#1c0a06", 14, 110, "#ff7a30", 0.6, "#a05030", 0.6, "#802a1a", "#2a0e08", 0.8), ground: G("#3a2420", "#4a2c26", "#5a3630", "#2a1a18", "#5a3c34", "#4a2e28"), wc: "#000", wd: "#000", amb: "embers", props: [{ kind: "rock", n: 80, s: [0.8, 2.8] }, { kind: "bone", n: 70 }, { kind: "crystal", n: 30 }], town: ["brazier"], wild: [], amp: 1, f: 0.03, wl: -50, lakes: [], seed: 73 },
  void: { sky: SK("#05020c", "#0c0618", "#1a0c30", "#0c0618", 14, 110, "#9a6aff", 0.5, "#6050a0", 0.6, "#403080", "#140a24", 0.8), ground: G("#241a3a", "#2e2248", "#3a2c5a", "#1a1228", "#3a2c5a", "#2e2248"), wc: "#000", wd: "#000", amb: "spores", props: [{ kind: "crystal", n: 90 }, { kind: "rock", n: 50, s: [0.8, 2.4] }, { kind: "glowshroom", n: 40 }], town: ["brazier", "pillar"], wild: [], amp: 1, f: 0.03, wl: -50, lakes: [], seed: 79 },
};

function townBuildings(z: NewZone, th: Theme): BuildingDef[] {
  const m = REGION[z], [hx, hz, hr] = m.hub, out: BuildingDef[] = [];
  if (m.kind === "dungeon" || m.kind === "raid") {
    out.push(...ring(hx, hz, 9, 6, "brazier"), ...ring(hx, hz, 22, 8, "pillar"));
    const bosses = GROUPS[z].filter((g) => g.n === 1);
    for (const b of bosses) out.push(...ring(b.x, b.z, 12, 6, "pillar"), { kind: "brazier", x: b.x - 7, z: b.z + 12 }, { kind: "brazier", x: b.x + 7, z: b.z + 12 });
    for (let zz = m.half - 70; zz > -m.half + 30; zz -= 26) { out.push({ kind: "brazier", x: -8, z: zz }, { kind: "brazier", x: 8, z: zz }); }
    out.push({ kind: m.kind === "raid" ? "throne" : "sarcophagus", x: 0, z: -(m.half - 26) }, { kind: "bones", x: -20, z: 30 }, { kind: "bones", x: 24, z: -20 });
    return out;
  }
  const k = th.town;
  out.push(...ring(hx, hz, hr * 0.62, m.kind === "city" ? 12 : 8, k[0]), ...ring(hx, hz, hr * 0.32, 4, k[1] ?? k[0], 0.4), ...ring(hx, hz, hr * 0.88, m.kind === "city" ? 14 : 10, "lamp"), ...ring(hx, hz, hr * 0.97, 6, "banner", 0.3));
  out.push(...ring(hx, hz, hr * 1.0, 4, "watchtower", 0.78), { kind: "well", x: hx, z: hz }, { kind: "campfire", x: hx + 6, z: hz + 6 }, { kind: "shrine", x: hx - hr * 0.2, z: hz + hr * 0.2 });
  if (m.kind === "city") out.push(...ring(hx, hz, hr * 0.8, 8, "cottage", 0.2), { kind: "windmill", x: hx + 38, z: hz - 36, ry: 0.5 }, { kind: "obelisk", x: hx + 20, z: hz }, { kind: "garden", x: hx - 30, z: hz - 30 }, { kind: "haystack", x: hx + 30, z: hz + 34 });
  else out.push({ kind: "haystack", x: hx + hr * 0.5, z: hz - hr * 0.5 }, { kind: "garden", x: hx - hr * 0.5, z: hz - hr * 0.4 });
  return out;
}

export const EXTRA_ZONES = {} as Record<NewZone, ZoneDef>;
for (const id of NEW_ZONES) {
  const m = REGION[id], th = THEMES[id], [hx, hz, hr] = m.hub, cave = m.kind === "dungeon" || m.kind === "raid";
  const flats: [number, number, number][] = cave ? GROUPS[id].filter((g) => g.n === 1).map((g) => [g.x, g.z, 16] as [number, number, number]) : [[hx, hz, hr]];
  if (!cave) { if (id !== "capital") { flats.push([hx + 16, hz, 12], [hx - 16, hz, 12]); } else for (const k of Object.keys(REGION)) if (k !== "capital") { /* ворота */ } }
  const height = mkH({ seed: th.seed, amp: th.amp, f: th.f, half: m.half, flats: id === "capital" ? [[0, 0, 100]] : flats, lakes: th.lakes.filter(([lx, lz, lr]) => dist(lx, lz, hx, hz) > hr + lr + 30), wl: th.wl, mount: th.mount, sea: th.sea, cave });
  // порталы
  const portals: PortalDef[] = [];
  if (id === "capital") {
    portals.push({ x: gatePos("meadow").x, z: gatePos("meadow").z, to: "meadow", tx: MEADOW_PORTAL.arrive.x, tz: MEADOW_PORTAL.arrive.z, label: "Опушка Рассвета" });
    for (const t of ["coast", "highlands", "swamp", "tundra", "volcano"] as NewZone[]) { const g = gatePos(t), sp = spawnOf(t); portals.push({ x: g.x, z: g.z, to: t, tx: sp.x, tz: sp.z, label: REGION[t].name }); }
  } else if (!cave) {
    const g = gatePos(id), bp = backPortal(id)!;
    portals.push({ x: bp.x, z: bp.z, to: "capital", tx: g.ax, tz: g.az, label: "Столица Эльдория" });
    const dz = DUNGEON_OF[id]; if (dz) { const dp = dungeonPortal(id), ds = spawnOf(dz); portals.push({ x: dp.x, z: dp.z, to: dz, tx: ds.x, tz: ds.z, label: REGION[dz].name }); }
  } else {
    const bp = backPortal(id)!, par = m.parent!, dp = dungeonPortal(par);
    portals.push({ x: bp.x, z: bp.z, to: par, tx: dp.x, tz: dp.z + 10, label: REGION[par].name });
  }
  const paths: [number, number][][] = cave ? [[[0, m.half - 20], [0, -(m.half - 30)]]] : portals.map((p) => [[hx, hz], [p.x, p.z]] as [number, number][]);
  if (id === "capital") for (const p of portals) paths.push([[0, 0], [p.x, p.z]]);
  const spawns: SpawnDef[] = GROUPS[id].map((g) => ({ mob: g.mob, x: g.x, z: g.z, r: g.r, n: g.n, lvl: g.lvl }));
  const wild = [...th.wild, ...(cave ? [] : animals(hx, hz, hr * 0.85))];
  EXTRA_ZONES[id] = {
    id, name: m.name, levels: `${m.lv[0]}–${m.lv[1]}`, half: m.half, sky: th.sky, ground: th.ground, height, waterLevel: th.wl, waterColor: th.wc, waterDeep: th.wd,
    ponds: [], bridges: [], hub: { x: hx, z: hz, r: hr }, paths, buildings: townBuildings(id, th), props: th.props, gathers: [], mobs: spawns, portals, wild, ambient: th.amb, cave: cave || undefined,
  };
}
// портал с Опушки в Столицу
export const MEADOW_EXTRA_PORTAL: PortalDef = { x: MEADOW_PORTAL.x, z: MEADOW_PORTAL.z, to: "capital", tx: gatePos("meadow").ax, tz: gatePos("meadow").az, label: "Столица Эльдория" };
