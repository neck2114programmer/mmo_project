import type { Appearance, ClassId, Gender, Stats } from "../types";

export type ArmorType = "cloth" | "leather" | "mail" | "plate";
export type AtkStyle = "slash" | "stab" | "cast" | "shoot" | "bash" | "whip";

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  desc: string;
  icon: string;
  color: string;
  armor: ArmorType;
  weaponKind: string;
  primary: "str" | "dex" | "int";
  magic: boolean;
  base: Stats;
  growth: Stats;
  hpMul: number;
  mpMul: number;
  style: AtkStyle;
  basic: { name: string; icon: string; range: number; speed: number; vfx: string; color: string };
  skillLines: string[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: "warrior", name: "Воин", role: "Ближний бой • Универсал", icon: "⚔️", color: "#e0584c",
    desc: "Мастер клинка и закалённой стали. Сочетает мощные удары, рывки и боевые кличи — надёжный боец на любой дистанции ближнего боя.",
    armor: "plate", weaponKind: "Меч", primary: "str", magic: false,
    base: { str: 14, dex: 8, int: 4, vit: 12, spi: 5 }, growth: { str: 2.2, dex: 0.8, int: 0.2, vit: 1.6, spi: 0.5 },
    hpMul: 1.1, mpMul: 0.9, style: "slash",
    basic: { name: "Удар мечом", icon: "🗡️", range: 3.2, speed: 1.4, vfx: "slash", color: "steel" },
    skillLines: ["Клинок", "Ярость", "Доблесть"],
  },
  assassin: {
    id: "assassin", name: "Ассасин", role: "Ближний бой • Burst", icon: "🗡️", color: "#9a6bff",
    desc: "Тень во тьме. Двойные клинки, яд и мгновенные рывки. Высокий шанс критического удара и огромный урон по одиночной цели.",
    armor: "leather", weaponKind: "Кинжалы", primary: "dex", magic: false,
    base: { str: 8, dex: 16, int: 5, vit: 8, spi: 6 }, growth: { str: 0.9, dex: 2.4, int: 0.3, vit: 1.0, spi: 0.6 },
    hpMul: 0.9, mpMul: 1.0, style: "stab",
    basic: { name: "Двойной порез", icon: "🔪", range: 3, speed: 1.0, vfx: "stab", color: "steel" },
    skillLines: ["Тень", "Яд", "Смерть"],
  },
  mage: {
    id: "mage", name: "Маг", role: "Дальний бой • Стихии", icon: "🔥", color: "#4fb4ff",
    desc: "Повелитель огня, льда и молний. Разрушительные заклинания по площади и контроль толпы с безопасной дистанции.",
    armor: "cloth", weaponKind: "Посох", primary: "int", magic: true,
    base: { str: 4, dex: 7, int: 16, vit: 7, spi: 11 }, growth: { str: 0.2, dex: 0.6, int: 2.5, vit: 0.9, spi: 1.5 },
    hpMul: 0.8, mpMul: 1.4, style: "cast",
    basic: { name: "Магический снаряд", icon: "✨", range: 20, speed: 1.6, vfx: "bolt", color: "ice" },
    skillLines: ["Огонь", "Лёд", "Молния"],
  },
  sorcerer: {
    id: "sorcerer", name: "Чародей", role: "Дальний бой • Тьма и проклятия", icon: "🌑", color: "#c34dff",
    desc: "Тёмный колдун. Проклятия, похищение жизни и призыв теней. Побеждает врагов медленно, но неотвратимо.",
    armor: "cloth", weaponKind: "Гримуар и жезл", primary: "int", magic: true,
    base: { str: 4, dex: 6, int: 15, vit: 8, spi: 10 }, growth: { str: 0.2, dex: 0.5, int: 2.3, vit: 1.1, spi: 1.4 },
    hpMul: 0.85, mpMul: 1.3, style: "cast",
    basic: { name: "Теневая стрела", icon: "🌀", range: 20, speed: 1.6, vfx: "bolt", color: "dark" },
    skillLines: ["Проклятия", "Души", "Бездна"],
  },
  shieldbearer: {
    id: "shieldbearer", name: "Щитовод", role: "Ближний бой • Танк", icon: "🛡️", color: "#f2c14e",
    desc: "Живая крепость с огромным башенным щитом. Принимает удары на себя, оглушает врагов и защищает союзников.",
    armor: "plate", weaponKind: "Башенный щит и булава", primary: "str", magic: false,
    base: { str: 11, dex: 6, int: 4, vit: 16, spi: 6 }, growth: { str: 1.6, dex: 0.5, int: 0.2, vit: 2.4, spi: 0.7 },
    hpMul: 1.35, mpMul: 0.9, style: "bash",
    basic: { name: "Удар булавой", icon: "🔨", range: 3, speed: 1.6, vfx: "bash", color: "steel" },
    skillLines: ["Бастион", "Страж", "Титан"],
  },
  archer: {
    id: "archer", name: "Лучник", role: "Дальний бой • Меткость", icon: "🏹", color: "#5fd68a",
    desc: "Меткий стрелок и следопыт. Стрелы любых стихий, ловушки и ураганная скорострельность.",
    armor: "leather", weaponKind: "Лук", primary: "dex", magic: false,
    base: { str: 7, dex: 16, int: 5, vit: 8, spi: 7 }, growth: { str: 0.6, dex: 2.5, int: 0.3, vit: 1.0, spi: 0.8 },
    hpMul: 0.9, mpMul: 1.0, style: "shoot",
    basic: { name: "Выстрел", icon: "🎯", range: 24, speed: 1.3, vfx: "arrow", color: "steel" },
    skillLines: ["Меткость", "Охота", "Ветер"],
  },
  berserker: {
    id: "berserker", name: "Берсерк", role: "Ближний бой • Ярость", icon: "🪓", color: "#ff7a2f",
    desc: "Неистовый воин с гигантским топором. Чем яростнее бой, тем сильнее он становится. Лечит себя кровью врагов.",
    armor: "mail", weaponKind: "Двуручный топор", primary: "str", magic: false,
    base: { str: 16, dex: 7, int: 3, vit: 11, spi: 4 }, growth: { str: 2.5, dex: 0.7, int: 0.1, vit: 1.5, spi: 0.4 },
    hpMul: 1.15, mpMul: 0.8, style: "slash",
    basic: { name: "Удар топором", icon: "🪓", range: 3.4, speed: 1.7, vfx: "cleave", color: "blood" },
    skillLines: ["Ярость", "Кровь", "Война"],
  },
  tamer: {
    id: "tamer", name: "Приручатель", role: "Смешанный • Звери", icon: "🐺", color: "#6dd3a0",
    desc: "Друг лесных зверей. Сражается рядом со своим спутником, призывает стаю волков, дракончиков и лечит природной магией.",
    armor: "leather", weaponKind: "Посох-кнут", primary: "dex", magic: false,
    base: { str: 8, dex: 12, int: 10, vit: 9, spi: 9 }, growth: { str: 1.0, dex: 1.8, int: 1.2, vit: 1.3, spi: 1.2 },
    hpMul: 1.0, mpMul: 1.15, style: "whip",
    basic: { name: "Хлёст кнута", icon: "🌿", range: 9, speed: 1.4, vfx: "whip", color: "nature" },
    skillLines: ["Зверь", "Природа", "Дух"],
  },
};

export const CLASS_LIST: ClassDef[] = Object.values(CLASSES);

// ---------- Внешность ----------
export const SKIN_TONES = ["#ffe3d0", "#f9d2b4", "#f1bf98", "#e0a67c", "#c98b5e", "#a56a43", "#7d4b2e", "#5a3420", "#e8e4f0", "#bfe0d0"];
export const HAIR_COLORS = [
  "#1b1418", "#3a2418", "#6b3b1f", "#a8642a", "#d9a441", "#f2dc8c", "#f5f5f5", "#9aa5b8",
  "#c43c3c", "#ff6aa8", "#9a5cff", "#4e8bff", "#3fd0c4", "#5ccf6a", "#ff8a2b", "#2b2f5c",
];
export const EYE_COLORS = ["#3a2418", "#6b4a2a", "#2e7d4f", "#2b7de0", "#5ac8ff", "#9a5cff", "#e0445a", "#f2b632", "#9aa5b8", "#22d3a8"];
export const ACCENT_COLORS = ["#c0392b", "#e67e22", "#f1c40f", "#27ae60", "#16a085", "#2980b9", "#8e44ad", "#d63384", "#ecf0f1", "#2c3e50"];
export const MARK_COLORS = ["#ff4d4d", "#4da6ff", "#f5f5f5", "#2b2b2b", "#ffd24d", "#a24dff"];

export const HAIR_NAMES = ["Короткая", "Длинная прямая", "Хвост", "Два хвоста", "Каре", "Ёжик", "Ирокез", "Коса", "Пучок", "Волна"];
export const EYE_NAMES = ["Мягкие", "Острые", "Большие", "Хитрые", "Сонные", "Яркие"];
export const BROW_NAMES = ["Прямые", "Дугой", "Резкие", "Тонкие"];
export const EAR_NAMES = ["Человек", "Эльф", "Кошачьи", "Лисьи"];
export const TAIL_NAMES = ["Нет", "Кошачий", "Лисий"];
export const MARK_NAMES = ["Нет", "Шрам", "Полосы", "Руна на лбу", "Слёзы"];

export function defaultAppearance(gender: Gender): Appearance {
  return {
    skin: SKIN_TONES[1],
    hair: gender === "female" ? 1 : 0,
    hairColor: gender === "female" ? HAIR_COLORS[4] : HAIR_COLORS[1],
    eyeColor: EYE_COLORS[3],
    eyeStyle: 0,
    brow: 1,
    ears: 0,
    tail: 0,
    mark: 0,
    markColor: MARK_COLORS[0],
    height: 0.5,
    build: 0.5,
    bust: 0.5,
    headSize: 0.5,
    eyeSize: 0.5,
    accent: ACCENT_COLORS[0],
  };
}

export function randomAppearance(gender: Gender): Appearance {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    skin: pick(SKIN_TONES),
    hair: Math.floor(Math.random() * HAIR_NAMES.length),
    hairColor: pick(HAIR_COLORS),
    eyeColor: pick(EYE_COLORS),
    eyeStyle: Math.floor(Math.random() * EYE_NAMES.length),
    brow: Math.floor(Math.random() * BROW_NAMES.length),
    ears: Math.random() < 0.6 ? 0 : Math.floor(Math.random() * 4),
    tail: Math.random() < 0.8 ? 0 : 1 + Math.floor(Math.random() * 2),
    mark: Math.random() < 0.6 ? 0 : Math.floor(Math.random() * MARK_NAMES.length),
    markColor: pick(MARK_COLORS),
    height: 0.2 + Math.random() * 0.6,
    build: 0.2 + Math.random() * 0.6,
    bust: gender === "female" ? 0.2 + Math.random() * 0.7 : 0.5,
    headSize: 0.3 + Math.random() * 0.4,
    eyeSize: 0.3 + Math.random() * 0.5,
    accent: pick(ACCENT_COLORS),
  };
}

// ---- стильные SVG-иконки вместо смайликов ----
import { makeIcon, CLASS_GLYPH } from "./icons";
const ELEM: Record<string, string> = { steel: "#e3ecff", ice: "#7fd8ff", dark: "#b25dff", fire: "#ff6a2b", bolt: "#ffe45e", nature: "#6dff9c", gold: "#ffcc4d", poison: "#8dff4d" };
for (const c of Object.values(CLASSES)) {
  c.basic.icon = makeIcon(c.basic.icon, { color: ELEM[c.basic.color] ?? c.color, tier: 1 });
  c.icon = makeIcon(CLASS_GLYPH[c.id] ?? c.icon, { color: c.color, cls: true, tier: 5 });
}
