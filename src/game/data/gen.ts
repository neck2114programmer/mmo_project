import type { MobDef, NpcDef } from "./world";
import type { Objective, QuestDef } from "./quests";
import type { Appearance, ClassId, Gender, ZoneId } from "../types";
import { mulberry, xpFor } from "./balance";

export type NewZone = "capital" | "coast" | "highlands" | "swamp" | "tundra" | "volcano" | "mines" | "sunken" | "dragon" | "void";
export const NEW_ZONES: NewZone[] = ["capital", "coast", "highlands", "swamp", "tundra", "volcano", "mines", "sunken", "dragon", "void"];
export interface RegionMeta { name: string; lv: [number, number]; half: number; hub: [number, number, number]; tier: number; town: string; kind: "city" | "region" | "dungeon" | "raid"; parent?: NewZone; guard: string }
export const REGION: Record<NewZone, RegionMeta> = {
  capital: { name: "Столица Эльдория", lv: [1, 10], half: 150, hub: [0, 0, 58], tier: 1, town: "Эльдория", kind: "city", guard: "Королевский страж" },
  coast: { name: "Берег Солёного Ветра", lv: [10, 18], half: 300, hub: [-200, -30, 46], tier: 2, town: "Порт Солёный Ветер", kind: "region", guard: "Портовый страж" },
  highlands: { name: "Железное Нагорье", lv: [16, 24], half: 300, hub: [-200, 60, 46], tier: 3, town: "Форт Железный Пик", kind: "region", guard: "Страж форта" },
  swamp: { name: "Гнилая Топь", lv: [22, 30], half: 300, hub: [0, -200, 44], tier: 3, town: "Тростниковая Заводь", kind: "region", guard: "Болотный дозорный" },
  tundra: { name: "Ледяная Пустошь", lv: [30, 38], half: 300, hub: [200, 60, 44], tier: 4, town: "Лагерь Белой Вьюги", kind: "region", guard: "Северный страж" },
  volcano: { name: "Пепельные Земли", lv: [38, 46], half: 300, hub: [-190, 190, 44], tier: 5, town: "Крепость Угольная", kind: "region", guard: "Пепельный страж" },
  mines: { name: "Забытые Копи", lv: [14, 20], half: 130, hub: [0, 92, 14], tier: 3, town: "Вход в копи", kind: "dungeon", parent: "highlands", guard: "Страж копей" },
  sunken: { name: "Затонувший Храм", lv: [26, 32], half: 130, hub: [0, 92, 14], tier: 4, town: "Вход в храм", kind: "dungeon", parent: "swamp", guard: "Страж храма" },
  dragon: { name: "Логово Игниса (рейд)", lv: [44, 50], half: 140, hub: [0, 100, 14], tier: 5, town: "Врата логова", kind: "raid", parent: "volcano", guard: "Страж врат" },
  void: { name: "Цитадель Пустоты (рейд)", lv: [46, 50], half: 140, hub: [0, 100, 14], tier: 5, town: "Врата цитадели", kind: "raid", parent: "tundra", guard: "Страж врат" },
};
/** точка появления и портал возврата */
export const spawnOf = (z: NewZone): { x: number; z: number } => { const h = REGION[z].hub; return { x: h[0], z: h[1] + 9 }; };
export const GATE_ANGLE: Partial<Record<NewZone | "meadow", number>> = { meadow: 180, coast: 225, highlands: 135, swamp: 270, tundra: 45, volcano: 315 };
export const gatePos = (z: NewZone | "meadow") => { const a = ((GATE_ANGLE[z] ?? 0) * Math.PI) / 180; return { x: Math.round(Math.cos(a) * 70), z: Math.round(Math.sin(a) * 70), ax: Math.round(Math.cos(a) * 61), az: Math.round(Math.sin(a) * 61) }; };
export const backPortal = (z: NewZone) => { const h = REGION[z].hub; return REGION[z].kind === "city" ? null : REGION[z].parent ? { x: h[0], z: h[1] + 12 } : { x: h[0] + 16, z: h[1] }; };
export const dungeonPortal = (z: NewZone) => { const h = REGION[z].hub; return { x: h[0] - 16, z: h[1] }; };
export const DUNGEON_OF: Partial<Record<NewZone, NewZone>> = { highlands: "mines", swamp: "sunken", volcano: "dragon", tundra: "void" };

// ---------------- МОНСТРЫ ----------------
type MX = Partial<Pick<MobDef, "variant" | "ranged" | "projectile" | "hpMul" | "dmgMul" | "xpMul" | "boss" | "atkSpeed">>;
const MB: Record<string, MobDef> = {};
const mob = (id: string, name: string, model: string, tint: string, scale: number, speed: number, aggro: number, x: MX = {}) => {
  MB[id] = { id, name, model, tint, scale, speed, aggro, drops: [[`mat_${id}`, x.boss ? 1 : 0.55], ["hp_m", 0.05]], ...x };
};
const bossX = (hp: number, dmg = 1.5, xp = 6): MX => ({ boss: true, hpMul: hp, dmgMul: dmg, xpMul: xp });
// побережье
mob("crab", "Скальный краб", "scorpion", "#e0603a", 1.1, 4, 10); mob("gull", "Морская гарпия", "wisp", "#e8f4ff", 1, 4.5, 13, { ranged: 13, projectile: "#cfe8ff" });
mob("pirate", "Пират-головорез", "humanoid", "#a05a3a", 1, 4.2, 13, { variant: "bandit" }); mob("drowned", "Утопленник", "humanoid", "#4a8a7a", 1.05, 3.4, 12, { variant: "skeleton" });
mob("seasnake", "Морской змей", "cobra", "#2a8ab0", 1.3, 5, 12); mob("tidehag", "Морская ведьма", "humanoid", "#3a8aa0", 1.05, 4, 14, { variant: "druid", ranged: 14, projectile: "#5ad0e0" });
mob("kraken", "Отпрыск Кракена", "cobra", "#1a5a9a", 3.6, 4.5, 20, bossX(10)); mob("blackbeard", "Капитан Чёрная Борода", "humanoid", "#7a3a2a", 1.8, 4.5, 18, { variant: "bandit", ...bossX(9, 1.6, 6) });
// нагорье
mob("ironwolf", "Железный волк", "wolf", "#6a7078", 1.15, 6, 15); mob("goblin", "Гоблин-налётчик", "humanoid", "#6a9a4a", 0.85, 5, 13, { variant: "bandit" });
mob("orc", "Орк-воин", "humanoid", "#8a5a3a", 1.25, 4.2, 13, { variant: "bandit", hpMul: 1.4 }); mob("stonetroll", "Каменный тролль", "golem", "#7a8a6a", 1.7, 3.2, 10, { hpMul: 1.7, dmgMul: 1.2 });
mob("harpy", "Горная гарпия", "wisp", "#cfc0a0", 1, 5, 14, { ranged: 14, projectile: "#e8d8b0" }); mob("mtbear", "Горный медведь", "boar", "#5a4030", 1.6, 4.6, 11, { hpMul: 1.5 });
mob("trollking", "Король троллей Грум", "golem", "#5a6a4a", 3.2, 3.4, 20, bossX(11)); mob("orcchief", "Вождь Гор'Ак", "humanoid", "#9a4a2a", 1.9, 4.4, 18, { variant: "bandit", ...bossX(9, 1.6, 6) });
// болото
mob("bogtroll", "Болотный тролль", "ent", "#3a5a2a", 1.7, 3.2, 10, { hpMul: 1.6 }); mob("toadslime", "Ядовитая жаба-слизь", "slime", "#9acd32", 1.5, 2.6, 9);
mob("leechspider", "Пиявочный паук", "spider", "#2a5a2a", 1.4, 5, 13); mob("bogwitch", "Болотная ведьма", "humanoid", "#4a7a4a", 1.05, 4, 14, { variant: "druid", ranged: 14, projectile: "#9dff5a" });
mob("mirewisp", "Болотный огонёк", "wisp", "#b0ff7a", 1, 4.5, 13, { ranged: 13, projectile: "#b0ff7a" }); mob("croc", "Топяной крокодил", "cobra", "#3a6a3a", 1.7, 4.5, 11, { hpMul: 1.4 });
mob("gildra", "Болотная Мать Гнильда", "spider", "#2a5a2a", 3.7, 4.8, 20, bossX(11)); mob("malevra", "Ведьма Топи Малевра", "humanoid", "#5a8a3a", 2, 4, 18, { variant: "druid", ranged: 16, projectile: "#9dff5a", ...bossX(9, 1.6, 6) });
// тундра
mob("frostwolf", "Ледяной волк", "wolf", "#dce8f4", 1.2, 6.2, 15); mob("yeti", "Снежный йети", "golem", "#e8f2ff", 1.9, 3.8, 11, { hpMul: 1.7, dmgMul: 1.25 });
mob("icewisp", "Ледяной дух", "wisp", "#aee4ff", 1, 4.5, 13, { ranged: 14, projectile: "#aee4ff" }); mob("frostspider", "Морозный паук", "spider", "#b8e0ff", 1.4, 5.2, 13);
mob("iceknight", "Рыцарь вечной мерзлоты", "humanoid", "#cfe8ff", 1.2, 3.8, 13, { variant: "skeleton", hpMul: 1.5 }); mob("mammoth", "Лютый мамонт", "boar", "#c8c0b0", 2.2, 4, 10, { hpMul: 2, dmgMul: 1.2 });
mob("hladmir", "Ледяной Владыка Хладмир", "golem", "#bfe8ff", 3.5, 3.6, 20, bossX(12)); mob("snowqueen", "Снежная королева Белоснежа", "humanoid", "#dff4ff", 1.9, 4, 18, { variant: "bonemage", ranged: 16, projectile: "#aee4ff", ...bossX(9, 1.6, 6) });
// вулкан
mob("ashhound", "Пепельная гончая", "wolf", "#ff6a2a", 1.2, 6.4, 15, { variant: "hound" }); mob("lavagolem", "Лавовый голем", "golem", "#ff5a1a", 2, 3.4, 10, { hpMul: 1.8, dmgMul: 1.3 });
mob("emberwisp", "Уголёк-дух", "wisp", "#ff8a2a", 1, 5, 14, { ranged: 15, projectile: "#ff8a2a" }); mob("magmaspider", "Магмовый паук", "spider", "#ff4a1a", 1.6, 5.4, 13);
mob("fireimp", "Огненный бес", "humanoid", "#ff5a2a", 0.95, 4.6, 14, { variant: "bonemage", ranged: 15, projectile: "#ff5a2a" }); mob("firedrake", "Огненный дракончик", "drake", "#ff6a2a", 1.9, 5, 14, { ranged: 12, projectile: "#ff7a2a", hpMul: 1.5 });
mob("ignator", "Повелитель пламени Игнатор", "drake", "#ff4a1a", 3.4, 4.6, 20, { ranged: 14, projectile: "#ff5a1a", ...bossX(12) }); mob("pyros", "Феникс-тиран Пирос", "wisp", "#ffb02a", 3.2, 5, 20, { ranged: 18, projectile: "#ffb02a", ...bossX(10, 1.6, 6) });
// Копи
mob("minerghost", "Призрак шахтёра", "ghost", "#a8b0c0", 1, 3.6, 12, { ranged: 11, projectile: "#c8d0e0" }); mob("minerdead", "Мёртвый шахтёр", "humanoid", "#8a7a6a", 1.05, 3.8, 12, { variant: "skeleton" });
mob("cavespider", "Пещерный паук", "spider", "#5a4a3a", 1.4, 5.2, 13); mob("rockgolem", "Рудный голем", "golem", "#8a7a6a", 1.7, 3.2, 10, { hpMul: 1.6 }); mob("digger", "Крот-копатель", "boar", "#4a3a30", 1.2, 5, 10);
mob("borg", "Бригадир Борг", "humanoid", "#8a6a4a", 1.8, 3.8, 18, { variant: "boneknight", ...bossX(8, 1.4, 5) }); mob("veinguard", "Хранитель Жилы", "golem", "#c8a05a", 3, 3.4, 20, bossX(10, 1.5, 6));
mob("tarnok", "Подгорный Король Тарнок", "humanoid", "#a07a4a", 2.2, 3.8, 22, { variant: "boneknight", ...bossX(14, 1.7, 8) });
// Храм
mob("tideghost", "Дух приливов", "ghost", "#5ad0e0", 1.1, 3.8, 13, { ranged: 12, projectile: "#5ad0e0" }); mob("tidepriest", "Жрец утопленников", "humanoid", "#3a9aa8", 1.05, 3.8, 15, { variant: "bonemage", ranged: 15, projectile: "#5ad0e0" });
mob("reefcrab", "Коралловый краб", "scorpion", "#ff8a6a", 1.4, 4.2, 10, { hpMul: 1.3 }); mob("deepeel", "Глубинный угорь", "cobra", "#2a6ab0", 1.5, 5.4, 12); mob("tidewisp", "Морской огонёк", "wisp", "#7af0ff", 1, 4.6, 13, { ranged: 13, projectile: "#7af0ff" });
mob("nereida", "Жрица Бездны Нереида", "humanoid", "#2a8aa8", 1.8, 3.8, 20, { variant: "lich", ranged: 16, projectile: "#5ad0e0", ...bossX(9, 1.5, 5) }); mob("tideguard", "Страж Приливов", "golem", "#5aa0b0", 3, 3.4, 20, bossX(10, 1.5, 6));
mob("leviathan", "Левиафан Глубин", "cobra", "#1a5a9a", 4.4, 4.6, 24, bossX(15, 1.7, 8));
// Рейд: дракон
mob("drakeling", "Драконит", "drake", "#c8402a", 1.5, 5.4, 14, { ranged: 12, projectile: "#ff7a2a" }); mob("lavaguard", "Страж лавы", "golem", "#ff6a30", 2.1, 3.4, 12, { hpMul: 1.9, dmgMul: 1.3 });
mob("cultist", "Культист Пламени", "humanoid", "#ff6a2a", 1.05, 4.2, 14, { variant: "druid", ranged: 15, projectile: "#ff6a2a" }); mob("firewyrm", "Огненный змей", "cobra", "#ff5a1a", 2.2, 5.2, 13, { hpMul: 1.6 });
mob("gatewarden", "Страж Огненных Врат", "humanoid", "#ff8040", 2.2, 3.8, 20, { variant: "boneknight", ...bossX(14, 1.6, 6) }); mob("pyrophant", "Пирофант Каэль", "humanoid", "#ff5a2a", 2.1, 4, 20, { variant: "lich", ranged: 17, projectile: "#ff5a2a", ...bossX(16, 1.7, 7) });
mob("ignis", "Игнис, Древний Дракон", "drake", "#e0401a", 5.4, 4.8, 28, { ranged: 18, projectile: "#ff6a1a", ...bossX(40, 2, 14) });
// Рейд: пустота
mob("voidling", "Тварь Пустоты", "shadow", "#7a5cff", 1.2, 4.4, 14, { ranged: 13, projectile: "#b25dff" }); mob("voidknight", "Рыцарь Пустоты", "humanoid", "#5a3a8a", 1.5, 3.8, 13, { variant: "boneknight", hpMul: 1.8, dmgMul: 1.3 });
mob("voidspider", "Паук Бездны", "spider", "#3a1a5a", 1.9, 5.4, 13, { hpMul: 1.5 }); mob("voidmage", "Маг Пустоты", "humanoid", "#7a4aff", 1.05, 4, 15, { variant: "bonemage", ranged: 16, projectile: "#b25dff" });
mob("reaper", "Жнец Пустоты", "humanoid", "#6a3aba", 2.2, 4, 20, { variant: "lich", ranged: 17, projectile: "#b25dff", ...bossX(15, 1.7, 7) }); mob("morodos", "Тёмный паладин Мор'Дос", "humanoid", "#4a2a7a", 2.4, 3.8, 20, { variant: "boneknight", ...bossX(16, 1.8, 7) });
mob("zarkul", "Император Бездны Зар'Кул", "humanoid", "#8a4aff", 2.9, 4, 30, { variant: "lich", ranged: 20, projectile: "#d070ff", ...bossX(60, 2.2, 16) });

// Редкие дропы с боссов (шансы маленькие; чем сложнее — тем меньше)
const rareDrops = (prefix: "dng" | "raid", set: number, chance: number): [string, number][] => ["weapon", "head", "chest", "legs", "boots", "gloves"].map((s) => [`@${prefix}_${s}:${set}`, chance] as [string, number]);
const addRare = (id: string, d: [string, number][]) => { MB[id].drops.push(...d); };
addRare("borg", rareDrops("dng", 0, 0.05)); addRare("veinguard", rareDrops("dng", 0, 0.07)); addRare("tarnok", rareDrops("dng", 0, 0.12));
addRare("nereida", rareDrops("dng", 1, 0.05)); addRare("tideguard", rareDrops("dng", 1, 0.07)); addRare("leviathan", rareDrops("dng", 1, 0.12));
addRare("gatewarden", rareDrops("raid", 0, 0.012)); addRare("pyrophant", rareDrops("raid", 0, 0.018)); addRare("ignis", [...rareDrops("raid", 0, 0.04), ...rareDrops("raid", 1, 0.004)]);
addRare("reaper", rareDrops("raid", 1, 0.006)); addRare("morodos", rareDrops("raid", 1, 0.008)); addRare("zarkul", [...rareDrops("raid", 0, 0.03), ...rareDrops("raid", 1, 0.012)]);
for (const w of ["blackbeard", "orcchief", "malevra", "snowqueen", "pyros"]) { MB[w].drops.push(["relic_0", 0.25], ["relic_1", 0.25], ["relic_2", 0.15], ["relic_3", 0.1], ["relic_4", 0.05]); }
for (const w of ["kraken", "trollking", "gildra", "hladmir", "ignator"]) { MB[w].drops.push(["relic_0", 0.12], ["relic_1", 0.12], ["hp_l", 1], ["mp_l", 0.6]); }
export const NEW_MOBS = MB;

// ---------------- Расстановка мобов по зонам ----------------
export interface Group { mob: string; x: number; z: number; r: number; n: number; lvl: [number, number] }
const POOL: Record<NewZone, { reg: string[]; elite?: string[]; boss?: string[] }> = {
  capital: { reg: [] }, coast: { reg: ["crab", "gull", "pirate", "drowned", "seasnake", "tidehag"], boss: ["kraken"] }, highlands: { reg: ["ironwolf", "goblin", "orc", "mtbear", "harpy", "stonetroll"], boss: ["trollking"] },
  swamp: { reg: ["toadslime", "leechspider", "bogwitch", "mirewisp", "croc", "bogtroll"], boss: ["gildra"] }, tundra: { reg: ["frostwolf", "icewisp", "frostspider", "iceknight", "yeti", "mammoth"], boss: ["hladmir"] },
  volcano: { reg: ["ashhound", "emberwisp", "magmaspider", "fireimp", "firedrake", "lavagolem"], boss: ["ignator"] },
  mines: { reg: ["digger", "minerdead", "minerghost", "cavespider", "rockgolem"] }, sunken: { reg: ["reefcrab", "deepeel", "tidewisp", "tideghost", "tidepriest"] },
  dragon: { reg: ["drakeling", "cultist", "firewyrm", "lavaguard"] }, void: { reg: ["voidling", "voidspider", "voidmage", "voidknight"] },
};
export const WEEKLY: Partial<Record<NewZone, { mob: string; x: number; z: number; name: string }>> = {
  coast: { mob: "blackbeard", x: -90, z: 120, name: "Капитан Чёрная Борода" }, highlands: { mob: "orcchief", x: -120, z: -90, name: "Вождь Гор'Ак" },
  swamp: { mob: "malevra", x: 110, z: -130, name: "Ведьма Топи Малевра" }, tundra: { mob: "snowqueen", x: 150, z: -60, name: "Снежная королева Белоснежа" }, volcano: { mob: "pyros", x: -60, z: 90, name: "Феникс-тиран Пирос" },
};
export const GROUPS: Record<NewZone, Group[]> = {} as Record<NewZone, Group[]>;
for (const z of NEW_ZONES) {
  const m = REGION[z], P = POOL[z], out: Group[] = [], rnd = mulberry(z.length * 131 + z.charCodeAt(0));
  const [lo, hi] = m.lv;
  if (m.kind === "region") {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3, rad = 80 + rnd() * 130;
      let x = Math.cos(a) * rad, zz = Math.sin(a) * rad;
      if (Math.hypot(x - m.hub[0], zz - m.hub[1]) < m.hub[2] + 60) { x = -x * 0.8; zz = -zz * 0.8; }
      const k = Math.min(1, Math.hypot(x - m.hub[0], zz - m.hub[1]) / 330 + (i % P.reg.length) / P.reg.length * 0.5);
      const L = lo + Math.round((hi - lo) * k);
      out.push({ mob: P.reg[i % P.reg.length], x: Math.round(x), z: Math.round(zz), r: 22, n: 6 + Math.floor(rnd() * 4), lvl: [Math.max(lo, L - 1), Math.min(hi, L + 1)] });
    }
    const b = P.boss![0]; out.push({ mob: b, x: Math.round(-m.hub[0] * 0.6), z: Math.round(-m.hub[1] * 0.6 + 40), r: 1, n: 1, lvl: [hi + 1, hi + 1] });
  } else if (m.kind === "dungeon" || m.kind === "raid") {
    const half = m.half, L = P.reg.length;
    for (let i = 0; i < 9; i++) {
      const zz = half - 70 - i * ((half * 2 - 150) / 8), x = (i % 2 ? 1 : -1) * (14 + rnd() * 30);
      out.push({ mob: P.reg[i % L], x: Math.round(x), z: Math.round(zz), r: 16, n: 6 + (i % 3), lvl: [lo + Math.floor(i / 3), lo + 1 + Math.floor(i / 3)] });
    }
  }
  GROUPS[z] = out;
}
const DUNG_BOSS: Partial<Record<NewZone, { mob: string; x: number; z: number }[]>> = {
  mines: [{ mob: "borg", x: 0, z: 30 }, { mob: "veinguard", x: 0, z: -30 }, { mob: "tarnok", x: 0, z: -92 }],
  sunken: [{ mob: "nereida", x: 0, z: 30 }, { mob: "tideguard", x: 0, z: -30 }, { mob: "leviathan", x: 0, z: -92 }],
  dragon: [{ mob: "gatewarden", x: 0, z: 40 }, { mob: "pyrophant", x: 0, z: -30 }, { mob: "ignis", x: 0, z: -100 }],
  void: [{ mob: "reaper", x: 0, z: 40 }, { mob: "morodos", x: 0, z: -30 }, { mob: "zarkul", x: 0, z: -100 }],
};
for (const z of Object.keys(DUNG_BOSS) as NewZone[]) for (const b of DUNG_BOSS[z]!) GROUPS[z].push({ mob: b.mob, x: b.x, z: b.z, r: 1, n: 1, lvl: [REGION[z].lv[1], REGION[z].lv[1]] });

// ---------------- NPC ----------------
const MALE = ["Эдгар", "Бран", "Торвальд", "Гаррет", "Освальд", "Дарен", "Хельмут", "Ивор", "Лукас", "Мартин", "Рорик", "Вильгельм", "Кассиан", "Тибор", "Алард", "Гектор", "Йорик", "Фабиан", "Грегор", "Ансельм"];
const FEMALE = ["Мирна", "Элисса", "Хельга", "Лиара", "Серафина", "Брижит", "Ивонна", "Каталина", "Фрея", "Алиса", "Изольда", "Розалинда", "Оливия", "Дарья", "Лена", "Мариса", "Тильда", "Агата", "Эйра", "Нора"];
const SURN = ["Кузнец", "Пекарь", "Ткач", "Плотник", "Рыбак", "Охотник", "Бард", "Торговец", "Лекарь", "Пастух", "Писарь", "Гончар", "Мельник", "Сказитель", "Огородник"];
const SKIN = ["#f1bf98", "#e8b088", "#d9a07a", "#c68a62", "#a56a44", "#7a4a2e", "#f6d2b4", "#e0a890"];
const HAIRC = ["#3a2418", "#1c1410", "#6a4228", "#a8743a", "#d8b060", "#c04a28", "#8a8a90", "#e8e0d0", "#4a3a5a"];
const EYEC = ["#2b7de0", "#4a8a3a", "#6a4228", "#8a5a2a", "#5a8aa0", "#7a6aa0"];
const CIV_LINES = [
  ["Добро пожаловать! Сегодня на рынке шумно, но это к лучшему.", "Говорят, ночью к деревням подбираются твари. Будь осторожен!", "Стража у нас надёжная, но герои вроде тебя нужны всегда."],
  ["Эх, раньше мы и не знали о тварях из Пустоты...", "Заглядывай к кузнецу — у него вещи получше, чем у старьёвщика.", "Я слышал, в подземельях прячутся великие сокровища."],
  ["Хлеб свежий, только из печи! Хочешь? Шучу, это для стражи.", "Не забывай про зелья: без них в боях тяжело.", "Звёзды сегодня яркие. Хорошая примета."],
  ["Если встретишь дракона — беги. Или нет. Ты же герой.", "Мой дед рассказывал о Короле-Личе. Страшные были времена.", "Рынок — сердце города. Загляни, не пожалеешь."],
];
const rand = (s: number) => mulberry(s);
const lookFor = (r: () => number, g: Gender): Partial<Appearance> => ({
  skin: SKIN[Math.floor(r() * SKIN.length)], hair: Math.floor(r() * 10), hairColor: HAIRC[Math.floor(r() * HAIRC.length)], eyeColor: EYEC[Math.floor(r() * EYEC.length)],
  eyeStyle: Math.floor(r() * 6), brow: Math.floor(r() * 4), height: 0.3 + r() * 0.5, build: 0.3 + r() * 0.5, bust: 0.3 + r() * 0.5, headSize: 0.4 + r() * 0.2, eyeSize: g === "female" ? 0.55 + r() * 0.3 : 0.4 + r() * 0.3, accent: ["#c0392b", "#2e86c1", "#27ae60", "#d4ac0d", "#8e44ad", "#d35400"][Math.floor(r() * 6)],
});
const CLS: ClassId[] = ["warrior", "archer", "mage", "tamer", "assassin", "shieldbearer"];
export const GUARD_ZONES = new Set<string>();
export const NEW_NPCS: NpcDef[] = [];
const QG: Record<NewZone, [string, string, string][]> = {
  capital: [["Лорд-канцлер Эймар", "Хранитель королевства", "male"], ["Капитан Ровена", "Начальница стражи", "female"], ["Мастер Орвин", "Староста гильдии героев", "male"]],
  coast: [["Адмирал Северин", "Начальник порта", "male"], ["Рыбачка Марта", "Староста причала", "female"], ["Штурман Лео", "Картограф", "male"]],
  highlands: [["Комендант Брогар", "Командир форта", "male"], ["Охотница Ильва", "Следопыт гор", "female"], ["Кузнец Дургин", "Мастер рудников", "male"]],
  swamp: [["Знахарка Моргана", "Целительница топей", "female"], ["Староста Тибо", "Глава заводи", "male"], ["Егерь Рэн", "Охотник на тварей", "male"]],
  tundra: [["Ярл Хальвдан", "Вождь лагеря", "male"], ["Шаманка Скади", "Хранительница вьюги", "female"], ["Зверолов Бьорн", "Следопыт льдов", "male"]],
  volcano: [["Лорд Каэдрик", "Командор крепости", "male"], ["Огнеборица Сайра", "Ученица пламени", "female"], ["Кузнец Вулкан", "Мастер горнила", "male"]],
  mines: [["Дозорный Харт", "Охранник копей", "male"]], sunken: [["Хранитель Тир", "Страж храма", "male"]], dragon: [["Маршал Эйвор", "Командир рейда", "male"]], void: [["Архимаг Селестин", "Командир рейда", "female"]],
};
export const qgIds = (z: NewZone) => QG[z].map((_, i) => `${z}_q${i + 1}`);
for (const z of NEW_ZONES) {
  const m = REGION[z], [hx, hz, hr] = m.hub, r = rand(z.length * 997 + hr);
  const cls = (): ClassId => CLS[Math.floor(r() * CLS.length)];
  QG[z].forEach(([name, title, g], i) => {
    const a = (i / QG[z].length) * 6.28 + 0.5, rr = m.kind === "region" || m.kind === "city" ? hr * 0.35 : 5;
    NEW_NPCS.push({ id: `${z}_q${i + 1}`, name, title, zone: z, x: Math.round(hx + Math.cos(a) * rr), z: Math.round(hz + Math.sin(a) * rr), ry: a + 3.14, gender: g as Gender, cls: cls(), look: lookFor(r, g as Gender), tier: Math.min(5, m.tier), wander: 3,
      lines: [`Я рад, что ты пришёл в ${m.town}. Дел у нас хватит на любого героя.`, "Береги себя — мир стал опаснее, чем прежде."] });
  });
  if (m.kind === "city" || m.kind === "region") {
    (["potion", "weapon", "armor", "jewel"] as const).forEach((k, i) => {
      const a = (i / 4) * 6.28 + 2.2, rr = hr * 0.5, g: Gender = i % 2 ? "female" : "male";
      NEW_NPCS.push({ id: `${z}_v${i}`, name: (g === "male" ? MALE : FEMALE)[(i * 3 + z.length) % 20], title: { potion: "Торговец зельями", weapon: "Оружейник", armor: "Бронник", jewel: "Ювелир" }[k], zone: z, x: Math.round(hx + Math.cos(a) * rr), z: Math.round(hz + Math.sin(a) * rr), ry: a + 3.14,
        gender: g, cls: ["mage", "warrior", "shieldbearer", "tamer"][i] as ClassId, look: lookFor(r, g), tier: 1, wander: 0, vendor: { kind: k, maxTier: Math.min(5, m.tier + 1) }, lines: ["Лучшие товары — только для тебя!", "Золото не пахнет, друг мой."] });
    });
    const civ = m.kind === "city" ? 22 : 11;
    for (let i = 0; i < civ; i++) {
      const g: Gender = r() < 0.5 ? "male" : "female", a = r() * 6.28, rr = hr * (0.2 + r() * 0.7), nm = (g === "male" ? MALE : FEMALE)[Math.floor(r() * 20)], sn = SURN[Math.floor(r() * SURN.length)];
      NEW_NPCS.push({ id: `${z}_c${i}`, name: nm, title: sn, zone: z, x: Math.round(hx + Math.cos(a) * rr), z: Math.round(hz + Math.sin(a) * rr), ry: r() * 6.28, gender: g, cls: cls(), look: lookFor(r, g), tier: 0, wander: 9 + Math.floor(r() * 10), lines: CIV_LINES[Math.floor(r() * CIV_LINES.length)] });
    }
  }
  // стража
  const gn = m.kind === "city" ? 14 : m.kind === "region" ? 8 : 4;
  for (let i = 0; i < gn; i++) {
    const a = (i / gn) * 6.28, rr = m.kind === "dungeon" || m.kind === "raid" ? 7 : hr * 0.92, g: Gender = i % 3 === 0 ? "female" : "male";
    NEW_NPCS.push({ id: `guard_${z}_${i}`, name: m.guard, title: "Страж", zone: z, x: Math.round(hx + Math.cos(a) * rr), z: Math.round(hz + Math.sin(a) * rr), ry: a, gender: g, cls: i % 2 ? "shieldbearer" : "warrior", look: lookFor(r, g), tier: Math.min(5, m.tier + 1), helm: true, wander: 5,
      lines: ["Стой! Кто идёт?.. А, это ты. Проходи.", "Пока я на посту — мобы сюда не пройдут.", "Ночью будь осторожен: твари нападают на поселения."] });
  }
}
// стража для старой Опушки
{
  const r = rand(77);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28, g: Gender = i % 3 === 0 ? "female" : "male"; NEW_NPCS.push({ id: `guard_meadow_${i}`, name: "Страж Опушки", title: "Страж", zone: "meadow", x: Math.round(-25 + Math.cos(a) * 22), z: Math.round(4 + Math.sin(a) * 22), ry: a, gender: g, cls: i % 2 ? "shieldbearer" : "warrior", look: lookFor(r, g), tier: 1, helm: true, wander: 5, lines: ["Опушка под защитой стражи.", "Слизни? Пусть только сунутся."] }); }
  for (let i = 0; i < 4; i++) { const g: Gender = i % 2 ? "female" : "male"; NEW_NPCS.push({ id: `meadow_c${i}`, name: (g === "male" ? MALE : FEMALE)[i * 5], title: SURN[i], zone: "meadow", x: Math.round(-25 + (i - 1.5) * 8), z: Math.round(4 + (i % 2) * 8 - 4), ry: r() * 6, gender: g, cls: "tamer", look: lookFor(r, g), tier: 0, wander: 10, lines: CIV_LINES[i % 4] }); }
}
export const MEADOW_PORTAL = { x: -19, z: 22, tx: gatePos("meadow").ax, tz: gatePos("meadow").az, arrive: { x: -19, z: 31 } };

// ---------------- КВЕСТЫ ----------------
const KT = ["Охота на", "Зачистка:", "Угроза:", "Очистить земли от", "Заказ на", "Месть"];
const CT = ["Трофеи:", "Добыча:", "Сбор трофеев:", "Заказ ремесленника:", "Нужны трофеи:"];
const RT = ["Разведка", "Дозор", "Путь через", "Осмотр границ", "Следы у"];
export function buildQuests(): QuestDef[] {
  const out: QuestDef[] = [];
  const push = (q: Omit<QuestDef, "reward"> & { mul: number; items?: { id: string; n: number }[] }) => {
    const { mul, items, ...rest } = q;
    out.push({ ...rest, reward: { xp: Math.round(xpFor(q.level) * mul), gold: Math.round(12 + q.level * 10 * mul * 3), items } });
  };
  const mn = (id: string) => NEW_MOBS[id].name;
  let prevRegion: string | undefined = "m3";
  for (const z of NEW_ZONES) {
    const m = REGION[z], g = qgIds(z), P = POOL[z], gr = GROUPS[z], r = rand(z.charCodeAt(1) * 31 + z.length);
    const [lo, hi] = m.lv;
    let prev: string | undefined = m.parent ? undefined : prevRegion;
    const N = m.kind === "city" ? 14 : m.kind === "region" ? 22 : 6;
    const reg = P.reg.length ? P.reg : ["crab"];
    const itemsFor = (i: number): { id: string; n: number }[] | undefined => {
      if (i % 5 === 4) return [{ id: `@${["chest", "legs", "boots", "gloves", "head", "weapon"][i % 6]}:${Math.min(5, m.tier)}`, n: 1 }];
      if (i % 3 === 0) return [{ id: ["hp_m", "hp_l", "mp_m", "hp_x"][Math.min(3, Math.floor(m.tier / 1.5))], n: 3 }];
      return undefined;
    };
    for (let i = 0; i < N; i++) {
      const id = `${z}_${i + 1}`, level = Math.round(lo + ((hi - lo) * i) / Math.max(1, N - 1)), A = g[i % g.length], B = g[(i + 1) % g.length];
      const t = i % 6, mid = reg[i % reg.length], mid2 = reg[(i + 2) % reg.length], grp = gr.length ? gr[(i * 3) % gr.length] : { x: 0, z: 0 };
      let obj: Objective[], name: string, intro: string, prog: string, done: string, turn = A;
      if (m.kind === "city") {
        // столичные квесты — знакомство с городом и подготовка к путешествию
        const labels = ["Поговорить с оружейником", "Поговорить с торговцем зельями", "Поговорить с бронником", "Поговорить с ювелиром"];
        if (i < 4) { turn = `${z}_v${i}`; obj = [{ type: "talk", npc: turn, label: labels[i] }]; name = ["Знакомство с оружейником", "Лавка зельевара", "Мастерская бронника", "Ювелирная лавка"][i]; intro = "Эльдория — город мастеров. Загляни к местным торговцам, чтобы знать, где пополнить запасы, и вернись ко мне."; prog = "Торговцы ждут тебя на рыночной площади."; done = "Теперь ты знаешь город. Золото в бою — не главное, но очень помогает!"; }
        else if (i < 10) { const mm = i % 2 ? "slime" : "wolf"; obj = [{ type: "kill", mob: mm, n: 6 + i, label: `Победить: ${mm === "slime" ? "лесные слизни" : "серые волки"}` }]; name = `Дозор у стен №${i - 3}`; intro = "Твари подходят к городским стенам. Страже нужна помощь за пределами города — на Опушке Рассвета."; prog = "Мобы вокруг Опушки."; done = "Дорога стала безопаснее."; }
        else { const to = (["coast", "highlands", "swamp", "tundra"] as NewZone[])[i - 10]; obj = [{ type: "reach", zone: to, x: REGION[to].hub[0], z: REGION[to].hub[1], r: 25, label: `Добраться до: ${REGION[to].town}` }]; name = `Дорога в ${REGION[to].town}`; intro = `Королевство нуждается в героях на границах. Через портал в Столице ты можешь добраться до города «${REGION[to].town}».`; prog = "Врата ведут к границам королевства."; done = "Ты добрался! Королевство гордится тобой."; }
      } else if (m.kind === "dungeon" || m.kind === "raid") {
        const bs = DUNG_BOSS[z]!, steps = [
          () => [{ type: "kill", mob: P.reg[0], n: 12, label: `Победить: ${mn(P.reg[0])}` } as Objective, { type: "kill", mob: P.reg[1], n: 8, label: `Победить: ${mn(P.reg[1])}` } as Objective],
          () => [{ type: "kill", mob: P.reg[2], n: 10, label: `Победить: ${mn(P.reg[2])}` } as Objective, { type: "kill", mob: P.reg[3 % P.reg.length], n: 8, label: `Победить: ${mn(P.reg[3 % P.reg.length])}` } as Objective],
          () => [{ type: "kill", mob: bs[0].mob, n: 1, label: `Убить босса: ${mn(bs[0].mob)}` } as Objective],
          () => [{ type: "kill", mob: bs[1].mob, n: 1, label: `Убить босса: ${mn(bs[1].mob)}` } as Objective],
          () => [{ type: "kill", mob: bs[2].mob, n: 1, label: `Убить босса: ${mn(bs[2].mob)}` } as Objective, { type: "collect", item: `mat_${bs[2].mob}`, n: 1, label: `Добыть трофей: ${mn(bs[2].mob)}` } as Objective],
          () => [{ type: "reach", zone: z, x: 0, z: bs[2].z + 10, r: 18, label: "Дойти до зала последнего босса" } as Objective],
        ];
        const ord = [0, 1, 5, 2, 3, 4];
        obj = steps[ord[i]](); name = [`Первая зачистка: ${m.name}`, "Вторая зачистка", "Разведка глубин", `Убить: ${mn(bs[0].mob)}`, `Убить: ${mn(bs[1].mob)}`, `Финал: ${mn(bs[2].mob)}`][i];
        intro = m.kind === "raid" ? "Это рейд: тут обитают сильнейшие твари мира. Идти стоит только хорошо снаряжённым и лучше — группой." : "Это подземелье опасно. Врагов тут много, а боссы — сильнее всего на свете. Подготовься как следует.";
        prog = "Продолжай в глубь подземелья."; done = "Отличная работа. Ты по праву стоишь среди великих."; turn = A;
      } else if (t === 0 || t === 3) {
        const n = 6 + Math.floor(i / 2) + (t === 3 ? 4 : 0);
        obj = [{ type: "kill", mob: mid, n, label: `Победить: ${mn(mid)}` }];
        name = `${KT[i % KT.length]} ${mn(mid).toLowerCase()}`;
        intro = `${mn(mid)} стали настоящей бедой для ${m.town}. Убей ${n} и возвращайся — награда будет достойной.`; prog = `${mn(mid)} бродят в окрестностях ${m.name}.`; done = "Спасибо тебе, герой! Теперь люди смогут спать спокойнее.";
      } else if (t === 1 || t === 4) {
        const n = 4 + Math.floor(i / 3);
        obj = [{ type: "collect", item: `mat_${mid2}`, n, label: `Собрать трофеи (${mn(mid2)})` }];
        name = `${CT[i % CT.length]} ${mn(mid2).toLowerCase()}`;
        intro = `Нашим мастерам нужны трофеи с существ вроде «${mn(mid2)}». Принеси ${n} штук — они щедро заплатят.`; prog = "Трофеи добываются только с самих существ."; done = "Именно то, что нужно. Держи награду!";
      } else if (t === 2) {
        obj = [{ type: "reach", zone: z, x: grp.x, z: grp.z, r: 22, label: `Добраться до стоянки (${grp.x}, ${grp.z})` }, { type: "kill", mob: mid, n: 4, label: `Победить: ${mn(mid)}` }];
        name = `${RT[i % RT.length]} ${m.name.split(" ").slice(-1)[0]}`;
        intro = "Нужен разведчик, который осмотрит дальние земли. Дойди до отмеченного места и расправься с теми, кто там обитает."; prog = "Дальние земли лежат вдали от города."; done = "Теперь мы знаем больше. Спасибо!";
      } else {
        turn = B; obj = [{ type: "talk", npc: B, label: `Доставить весть: ${NEW_NPCS.find((n) => n.id === B)?.name}` }, { type: "kill", mob: mid, n: 5, label: `Победить: ${mn(mid)}` }];
        name = `Срочное послание №${Math.floor(i / 6) + 1}`; intro = `Отнеси мою весть тому, кто стоит в другом конце ${m.town}. И по пути разберись с ${mn(mid)}, что мешают торговле.`; prog = "Нужный человек в городе."; done = "Весть получена. Спасибо!";
      }
      push({ id, name, giver: A, turnIn: turn, zone: z, level, requires: prev, intro, progress: prog, done, objectives: obj, mul: 0.5 + (i % 4) * 0.15, items: itemsFor(i) });
      prev = id;
      void r;
    }
    if (!m.parent) prevRegion = prev;
    // босс региона
    if (m.kind === "region") {
      const b = P.boss![0], id = `${z}_boss`;
      push({ id, name: `Властелин земель: ${mn(b)}`, giver: g[0], turnIn: g[0], zone: z, level: hi, requires: prev, intro: `${mn(b)} — самое грозное существо этих земель. Победи его и принеси трофей!`, progress: "Босс обитает вдали от города.", done: "Невероятно! Ты сделал то, что не удавалось никому.", objectives: [{ type: "kill", mob: b, n: 1, label: `Убить: ${mn(b)}` }, { type: "collect", item: `mat_${b}`, n: 1, label: "Добыть трофей босса" }], mul: 1.4, items: [{ id: `@weapon:${Math.min(5, m.tier)}`, n: 1 }, { id: `@chest:${Math.min(5, m.tier)}`, n: 1 }] });
      prev = id; prevRegion = id;
      // квесты на подземелье
      const dz = DUNG_OF(z);
      if (dz) {
        const dm = REGION[dz], bs = DUNG_BOSS[dz]!;
        push({ id: `${z}_dng1`, name: `Тайны подземелья: ${dm.name}`, giver: g[1], turnIn: g[1], zone: z, level: dm.lv[0], requires: `${z}_${Math.floor(N / 2)}`, intro: `В землях «${m.name}» есть проход в ${dm.name}. Возьми храбрых друзей и очисти его. Награды из подземелий — самые редкие!`, progress: "Проход в подземелье — рядом с городом.", done: "Ты вернулся живым — и с трофеями!", objectives: [{ type: "kill", mob: bs[0].mob, n: 1, label: `Убить: ${mn(bs[0].mob)}` }], mul: 1.0, items: [{ id: "hp_x", n: 3 }] });
        push({ id: `${z}_dng2`, name: `Король подземелья: ${mn(bs[2].mob)}`, giver: g[1], turnIn: g[1], zone: z, level: dm.lv[1], requires: `${z}_dng1`, intro: `Финальный босс подземелья — ${mn(bs[2].mob)}. Победи его — и получишь шанс на уникальную броню.`, progress: "Босс в самом конце подземелья.", done: "Подземелье покорено. Слава тебе, герой!", objectives: [{ type: "kill", mob: bs[2].mob, n: 1, label: `Убить: ${mn(bs[2].mob)}` }], mul: 1.6, items: [{ id: `@${dm.kind === "raid" ? "raid" : "dng"}_chest:0`, n: 1 }] });
      }
      // недельный мини-босс
      const w = WEEKLY[z];
      if (w) push({ id: `${z}_weekly`, name: `Недельный вызов: ${w.name}`, giver: g[2], turnIn: g[2], zone: z, level: hi, requires: `${z}_${Math.floor(N * 0.6)}`, intro: `Раз в неделю в этих землях появляется «${w.name}». Прими вызов — как только возьмёшь задание, он выйдет на бой. Редкие реликвии ждут победителя!`, progress: `Ищи «${w.name}» в точке (${w.x}, ${w.z}).`, done: "Невероятно! Через неделю он вернётся — и ты сможешь повторить.", objectives: [{ type: "kill", mob: w.mob, n: 1, label: `Победить: ${w.name}` }], mul: 1.8, items: [{ id: "hp_x", n: 5 }, { id: "mp_x", n: 5 }] });
    }
  }
  // привязка weekly/spawn
  for (const z of Object.keys(WEEKLY) as NewZone[]) { const q = out.find((x) => x.id === `${z}_weekly`); const w = WEEKLY[z]; if (q && w) { q.weekly = true; q.spawn = { mob: w.mob, x: w.x, z: w.z, lvl: REGION[z].lv[1] + 2 }; } }
  return out;
}
function DUNG_OF(z: NewZone) { return DUNGEON_OF[z]; }
export const MAT_ICON: Record<string, string> = { scorpion: "🦂", wolf: "🐺", golem: "🪨", spider: "🕷️", slime: "🟢", wisp: "✨", ghost: "👻", cobra: "🐍", boar: "🐗", drake: "🐉", humanoid: "🏴", ent: "🪵", shadow: "🌑" };
export const ZONE_HELP: Record<string, ZoneId> = {};
