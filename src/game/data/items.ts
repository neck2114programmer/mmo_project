import type { ClassId, SlotId, Stats } from "../types";
import { CLASSES, type ArmorType } from "./classes";
import { CLASS_IDS } from "../types";
import { extendItems } from "./items2";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  kind: "weapon" | "armor" | "jewel" | "consumable" | "material" | "quest";
  slot?: SlotId;
  cls?: ClassId;
  tier: number;
  rarity: number;
  reqLevel: number;
  stats: Partial<Stats>;
  atk?: number;
  armor?: number;
  price: number;
  desc: string;
  heal?: number;
  mana?: number;
  setName?: string;
}

export const TIER_LEVELS_ITEMS = [1, 8, 15, 22, 30, 37];
export const RARITY_NAMES = ["Обычный", "Необычный", "Редкий", "Эпический", "Легендарный", "Мифический"];
export const RARITY_COLORS = ["#cfd3da", "#5fe07a", "#4da6ff", "#c06bff", "#ffb347", "#ff5a6e"];
export const SLOT_NAMES: Record<SlotId, string> = {
  weapon: "Оружие", head: "Голова", chest: "Тело", legs: "Ноги", boots: "Обувь", gloves: "Руки", ring: "Кольцо", amulet: "Амулет",
};
export const STAT_NAMES: Record<string, string> = { str: "Сила", dex: "Ловкость", int: "Интеллект", vit: "Выносливость", spi: "Дух" };

const ATK = [9, 24, 46, 78, 125, 190];
const ARM = [4, 10, 19, 31, 47, 68];
const STAT = [2, 5, 9, 15, 23, 34];
const ARM_MUL: Record<ArmorType, number> = { cloth: 0.6, leather: 0.8, mail: 1.0, plate: 1.25 };
const SLOT_W: Record<string, number> = { head: 0.8, chest: 1.4, legs: 1.1, boots: 0.7, gloves: 0.7 };
const SLOT_ICON: Record<string, Record<string, string>> = {
  cloth: { head: "🎩", chest: "👘", legs: "🩳", boots: "🥿", gloves: "🧤" },
  leather: { head: "🧢", chest: "🥋", legs: "👖", boots: "🥾", gloves: "🧤" },
  mail: { head: "⛑️", chest: "🦺", legs: "👖", boots: "🥾", gloves: "🧤" },
  plate: { head: "🪖", chest: "🛡️", legs: "🦿", boots: "🥾", gloves: "🧤" },
};
const SLOT_WORD: Record<ArmorType, Record<string, string>> = {
  cloth: { head: "Шляпа", chest: "Мантия", legs: "Штаны", boots: "Туфли", gloves: "Перчатки" },
  leather: { head: "Капюшон", chest: "Куртка", legs: "Штаны", boots: "Сапоги", gloves: "Рукавицы" },
  mail: { head: "Шлем", chest: "Кольчуга", legs: "Набедренники", boots: "Сапоги", gloves: "Кольчужные рукавицы" },
  plate: { head: "Шлем", chest: "Кираса", legs: "Набедренники", boots: "Сабатоны", gloves: "Латные перчатки" },
};
const WEAPON_ICON: Record<ClassId, string> = {
  warrior: "🗡️", assassin: "🔪", mage: "🪄", sorcerer: "📕", shieldbearer: "🛡️", archer: "🏹", berserker: "🪓", tamer: "🌿",
};

const SETS: Record<ClassId, { sets: string[]; weapons: string[] }> = {
  warrior: {
    sets: ["Рекрута", "Стража", "Рыцаря", "Драконоборца", "Паладина Рассвета", "Бога Войны"],
    weapons: ["Тренировочный меч", "Стальной палаш", "Рыцарский клеймор", "Меч Драконоборца", "Эскалибур Рассвета", "Клинок Бога Войны"],
  },
  assassin: {
    sets: ["Бродяги", "Ночного Вора", "Тени", "Призрака", "Лунной Смерти", "Повелителя Теней"],
    weapons: ["Ржавые кинжалы", "Стальные стилеты", "Клыки Скорпиона", "Когти Призрака", "Лунные Жала", "Клинки Вечной Ночи"],
  },
  mage: {
    sets: ["Ученика", "Адепта", "Стихийника", "Архимага", "Звёздного Мудреца", "Верховного Магистра"],
    weapons: ["Ветка ученика", "Посох адепта", "Посох Стихий", "Жезл Архимага", "Посох Звёздного Света", "Скипетр Первозданного Огня"],
  },
  sorcerer: {
    sets: ["Послушника", "Заклинателя", "Некроманта", "Повелителя Скверны", "Владыки Теней", "Чёрного Короля"],
    weapons: ["Костяной жезл", "Жезл Заклинателя", "Череп Некроманта", "Скипетр Скверны", "Жезл Владыки Теней", "Скипетр Чёрного Короля"],
  },
  shieldbearer: {
    sets: ["Новобранца", "Защитника", "Бастиона", "Стража Цитадели", "Святого Оплота", "Титана"],
    weapons: ["Деревянный щит и дубина", "Щит Защитника", "Башенный щит Бастиона", "Эгида Цитадели", "Святой Оплот", "Эгида Титана"],
  },
  archer: {
    sets: ["Охотника", "Следопыта", "Лесного Стрелка", "Ветрокрылого", "Небесного Снайпера", "Легенды Лесов"],
    weapons: ["Короткий лук", "Охотничий лук", "Лук Следопыта", "Лук Ветров", "Небесный Лук", "Лук Богини Охоты"],
  },
  berserker: {
    sets: ["Варвара", "Головореза", "Сокрушителя", "Кровавого Вождя", "Владыки Ярости", "Бога Бойни"],
    weapons: ["Колун варвара", "Топор головореза", "Секира сокрушителя", "Кровавая секира", "Топор Ярости", "Рагнарёк"],
  },
  tamer: {
    sets: ["Новичка-следопыта", "Укротителя", "Духа Леса", "Вожака Стаи", "Повелителя Зверей", "Первородного"],
    weapons: ["Посох с верёвкой", "Кнут укротителя", "Посох Духа Леса", "Хлыст Вожака", "Скипетр Повелителя Зверей", "Посох Первородного"],
  },
};

export const ITEMS: Record<string, ItemDef> = {};

function add(d: ItemDef) {
  ITEMS[d.id] = d;
}

for (const cls of CLASS_IDS) {
  const c = CLASSES[cls];
  const main = c.primary;
  for (let t = 0; t < 6; t++) {
    const setName = SETS[cls].sets[t];
    // оружие
    const wStats: Partial<Stats> = { [main]: Math.round(STAT[t] * 1.2) };
    if (c.magic) wStats.spi = Math.round(STAT[t] * 0.5);
    else wStats.vit = Math.round(STAT[t] * 0.4);
    add({
      id: `weapon:${cls}:${t}`, name: SETS[cls].weapons[t], icon: WEAPON_ICON[cls], kind: "weapon", slot: "weapon", cls, tier: t,
      rarity: t, reqLevel: TIER_LEVELS_ITEMS[t], stats: wStats, atk: ATK[t], price: Math.round(40 * Math.pow(2.3, t)),
      desc: `${c.weaponKind} — оружие класса «${c.name}».`, setName,
    });
    // броня
    for (const slot of ["head", "chest", "legs", "boots", "gloves"] as const) {
      const w = SLOT_W[slot];
      const stats: Partial<Stats> = { [main]: Math.round(STAT[t] * w * 0.7) || 1, vit: Math.round(STAT[t] * w * 0.6) || 1 };
      if (c.magic) stats.spi = Math.round(STAT[t] * w * 0.4);
      else stats.dex = Math.round(STAT[t] * w * 0.3);
      add({
        id: `${slot}:${cls}:${t}`, name: `${SLOT_WORD[c.armor][slot]} ${setName}`, icon: SLOT_ICON[c.armor][slot], kind: "armor", slot, cls, tier: t,
        rarity: t, reqLevel: TIER_LEVELS_ITEMS[t], stats, armor: Math.round(ARM[t] * ARM_MUL[c.armor] * w * 2) / 2,
        price: Math.round(18 * w * Math.pow(2.3, t)), desc: `Часть сета «${setName}».`, setName,
      });
    }
  }
}

const RING_NAMES = [["Медное кольцо", "Серебряное кольцо", "Золотое кольцо", "Кольцо Грозы", "Кольцо Феникса", "Кольцо Вечности"], ["Костяное кольцо", "Кольцо Охотника", "Кольцо Мудреца", "Кольцо Бездны", "Кольцо Звезды", "Кольцо Мироздания"]];
const AMU_NAMES = [["Простой талисман", "Амулет Силы", "Амулет Стража", "Амулет Дракона", "Сердце Рассвета", "Око Божества"], ["Деревянный оберег", "Амулет Ветра", "Амулет Знаний", "Амулет Тьмы", "Слеза Луны", "Сердце Мира"]];
for (let t = 0; t < 6; t++) {
  for (let v = 0; v < 2; v++) {
    const a: Partial<Stats> = v === 0 ? { str: Math.round(STAT[t] * 0.6) || 1, dex: Math.round(STAT[t] * 0.5) || 1 } : { int: Math.round(STAT[t] * 0.6) || 1, spi: Math.round(STAT[t] * 0.5) || 1 };
    add({ id: `ring:${v}:${t}`, name: RING_NAMES[v][t], icon: "💍", kind: "jewel", slot: "ring", tier: t, rarity: t, reqLevel: TIER_LEVELS_ITEMS[t], stats: { ...a, vit: Math.round(STAT[t] * 0.3) }, price: Math.round(30 * Math.pow(2.3, t)), desc: "Украшение с магической силой." });
    const b: Partial<Stats> = v === 0 ? { vit: Math.round(STAT[t] * 0.8) || 1, str: Math.round(STAT[t] * 0.4) || 1 } : { spi: Math.round(STAT[t] * 0.8) || 1, dex: Math.round(STAT[t] * 0.4) || 1 };
    add({ id: `amulet:${v}:${t}`, name: AMU_NAMES[v][t], icon: "📿", kind: "jewel", slot: "amulet", tier: t, rarity: t, reqLevel: TIER_LEVELS_ITEMS[t], stats: b, price: Math.round(34 * Math.pow(2.3, t)), desc: "Древний амулет." });
  }
}

// Расходники
const POT: [string, string, number, string][] = [["s", "Малое", 140, "🧪"], ["m", "Среднее", 400, "🧪"], ["l", "Большое", 900, "⚗️"], ["x", "Великое", 2000, "⚗️"]];
POT.forEach(([k, n, v, ic], i) => {
  add({ id: `hp_${k}`, name: `${n} зелье здоровья`, icon: ic === "🧪" ? "❤️‍🔥" : "🍷", kind: "consumable", tier: i, rarity: Math.min(i, 3), reqLevel: i * 10, stats: {}, heal: v, price: 12 * Math.pow(2.4, i), desc: `Восстанавливает ${v} здоровья.` });
  add({ id: `mp_${k}`, name: `${n} зелье маны`, icon: ic === "🧪" ? "💧" : "🔷", kind: "consumable", tier: i, rarity: Math.min(i, 3), reqLevel: i * 10, stats: {}, mana: Math.round(v * 0.7), price: 14 * Math.pow(2.4, i), desc: `Восстанавливает ${Math.round(v * 0.7)} маны.` });
});
add({ id: "food_bread", name: "Свежий хлеб", icon: "🍞", kind: "consumable", tier: 0, rarity: 0, reqLevel: 1, stats: {}, heal: 60, price: 4, desc: "Простая еда: +60 здоровья." });
add({ id: "food_stew", name: "Охотничье рагу", icon: "🍲", kind: "consumable", tier: 1, rarity: 1, reqLevel: 1, stats: {}, heal: 220, mana: 80, price: 30, desc: "Сытное рагу: +220 HP, +80 MP." });

// Материалы и квестовые предметы
const MATS: [string, string, string, number, number][] = [
  ["slime_gel", "Липкая слизь", "🟢", 0, 3], ["wolf_pelt", "Шкура волка", "🐺", 0, 6], ["boar_tusk", "Клык кабана", "🦷", 0, 6],
  ["bandit_badge", "Знак бандита", "🏴", 1, 9], ["alpha_fang", "Клык Альфы", "🦴", 2, 60],
  ["scorpion_sting", "Жало скорпиона", "🦂", 1, 14], ["golem_core", "Ядро голема", "🔶", 2, 24], ["mummy_wrap", "Древние бинты", "🩹", 1, 12],
  ["cobra_fang", "Клык кобры", "🐍", 1, 14], ["sand_queen_eye", "Глаз Королевы", "👁️", 3, 120],
  ["ent_bark", "Живая кора", "🪵", 2, 20], ["wisp_dust", "Пыль духов", "✨", 2, 22], ["spider_silk", "Шёлк паука", "🕸️", 2, 18],
  ["druid_token", "Знак тёмного друида", "🔮", 2, 26], ["cornelius_heart", "Сердце Корнелия", "💚", 4, 220],
  ["bone_dust", "Костяная пыль", "💀", 3, 30], ["soul_shard", "Осколок души", "💠", 3, 40], ["ghoul_claw", "Коготь вурдалака", "🦴", 3, 34],
  ["lich_phylactery", "Филактерия Малгрота", "🧿", 5, 500],
];
MATS.forEach(([id, name, icon, tier, price]) => add({ id, name, icon, kind: "material", tier, rarity: Math.min(tier, 5), reqLevel: 1, stats: {}, price, desc: "Добыча с монстров." }));
const QI: [string, string, string][] = [
  ["elder_letter", "Письмо старейшины", "✉️"], ["healing_herb", "Целебная трава", "🌿"], ["river_fish", "Речная рыба", "🐟"],
  ["old_key", "Ржавый ключ", "🗝️"], ["desert_scroll", "Свиток пустыни", "📜"], ["sun_crystal", "Кристалл солнца", "🔆"],
  ["druid_acorn", "Священный жёлудь", "🌰"], ["moon_blossom", "Лунный цветок", "🌸"], ["crypt_sigil", "Печать склепа", "🔱"],
  ["lost_amulet", "Потерянный амулет", "📿"], ["cactus_water", "Кактусовый нектар", "🥤"], ["fire_ember", "Уголёк Пламени", "🔥"],
];
QI.forEach(([id, name, icon]) => add({ id, name, icon, kind: "quest", tier: 0, rarity: 1, reqLevel: 1, stats: {}, price: 0, desc: "Предмет для задания." }));

export function tierForLevel(level: number): number {
  return level < 8 ? 0 : level < 15 ? 1 : level < 22 ? 2 : level < 30 ? 3 : level < 37 ? 4 : 5;
}

export function rollGearDrop(cls: ClassId, level: number, boss: boolean): string | null {
  let t = tierForLevel(level);
  if (boss && t < 5) t += 1;
  else if (Math.random() < 0.15 && t < 5) t += 1;
  const r = Math.random();
  if (r < 0.35) return `weapon:${cls}:${t}`;
  if (r < 0.9) return `${(["head", "chest", "legs", "boots", "gloves"] as const)[Math.floor(Math.random() * 5)]}:${cls}:${t}`;
  return `${Math.random() < 0.5 ? "ring" : "amulet"}:${Math.floor(Math.random() * 2)}:${t}`;
}

export function gearTier(id: string | undefined): number {
  if (!id) return -1;
  return ITEMS[id]?.tier ?? -1;
}

export function vendorStock(kind: "potion" | "weapon" | "armor" | "jewel", cls: ClassId, maxTier: number): string[] {
  const out: string[] = [];
  if (kind === "potion") {
    ["food_bread", "food_stew", "hp_s", "mp_s", "hp_m", "mp_m", "hp_l", "mp_l", "hp_x", "mp_x"].forEach((id) => {
      const tr = ITEMS[id].tier;
      if (tr <= Math.min(3, maxTier + 1)) out.push(id);
    });
    return out;
  }
  for (let t = 0; t <= maxTier; t++) {
    if (kind === "weapon") out.push(`weapon:${cls}:${t}`);
    else if (kind === "armor") (["head", "chest", "legs", "boots", "gloves"] as const).forEach((s) => out.push(`${s}:${cls}:${t}`));
    else for (let v = 0; v < 2; v++) out.push(`ring:${v}:${t}`, `amulet:${v}:${t}`);
  }
  return out;
}

export function itemSellPrice(id: string): number {
  const it = ITEMS[id];
  return it ? Math.max(1, Math.floor(it.price * 0.3)) : 0;
}
extendItems(ITEMS, RARITY_NAMES, RARITY_COLORS);
