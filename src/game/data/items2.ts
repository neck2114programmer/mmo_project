import type { ItemDef } from "./items";
import { CLASSES } from "./classes";
import { CLASS_IDS } from "../types";
import { MAT_ICON, NEW_MOBS } from "./gen";

const ATK = [9, 24, 46, 78, 125, 190];
const ARM = [4, 10, 19, 31, 47, 68];
const STAT = [2, 5, 9, 15, 23, 34];
const SLOT_W: Record<string, number> = { head: 0.8, chest: 1.4, legs: 1.1, boots: 0.7, gloves: 0.7 };
const MUL: Record<string, number> = { cloth: 0.6, leather: 0.8, mail: 1.0, plate: 1.25 };
const WORDS: Record<string, Record<string, string>> = {
  plate: { head: "Шлем", chest: "Кираса", legs: "Поножи", boots: "Сабатоны", gloves: "Латные рукавицы" },
  mail: { head: "Койф", chest: "Кольчуга", legs: "Кольчужные штаны", boots: "Сапоги", gloves: "Перчатки" },
  leather: { head: "Капюшон", chest: "Куртка", legs: "Штаны", boots: "Сапоги", gloves: "Наручи" },
  cloth: { head: "Венец", chest: "Мантия", legs: "Юбка", boots: "Туфли", gloves: "Перчатки" },
};
const ICONS: Record<string, string> = { head: "🪖", chest: "🥋", legs: "👖", boots: "🥾", gloves: "🧤" };
const SETS = [
  { pre: "dng", set: 0, name: "Подгорного Короля", lvl: 18, t: 3, mul: 1.3, rar: 3, source: "Подземелье «Забытые Копи»" },
  { pre: "dng", set: 1, name: "Тёмных Глубин", lvl: 30, t: 4, mul: 1.25, rar: 4, source: "Подземелье «Затонувший Храм»" },
  { pre: "raid", set: 0, name: "Игниса Пожирателя", lvl: 42, t: 5, mul: 1.2, rar: 5, source: "Рейд «Логово Игниса»" },
  { pre: "raid", set: 1, name: "Бездны Зар'Кула", lvl: 47, t: 5, mul: 1.65, rar: 6, source: "Рейд «Цитадель Пустоты» (мифическая редкость)" },
];

export function extendItems(ITEMS: Record<string, ItemDef>, RN: string[], RC: string[]) {
  RN.push("Божественный"); RC.push("#ff2fd6");
  // трофеи мобов (нужны для квестов)
  for (const m of Object.values(NEW_MOBS)) {
    const id = `mat_${m.id}`;
    ITEMS[id] = { id, name: `Трофей: ${m.name}`, icon: MAT_ICON[m.model] ?? "🦴", kind: "material", tier: m.boss ? 3 : 1, rarity: m.boss ? 3 : 1, reqLevel: 1, stats: {}, price: m.boss ? 400 : 30, desc: "Трофей, добытый с редкого существа." };
  }
  // сеты подземелий и рейдов
  for (const s of SETS) for (const cls of CLASS_IDS) {
    const c = CLASSES[cls], main = c.primary, st = Math.round(STAT[s.t] * s.mul);
    const wid = `${s.pre}_weapon:${cls}:${s.set}`;
    ITEMS[wid] = {
      id: wid, name: `${c.weaponKind} ${s.name}`, icon: ITEMS[`weapon:${cls}:5`]?.icon ?? "⚔️", kind: "weapon", slot: "weapon", cls, tier: s.t, rarity: s.rar, reqLevel: s.lvl,
      stats: { [main]: Math.round(st * 1.3), ...(c.magic ? { spi: Math.round(st * 0.6) } : { vit: Math.round(st * 0.5) }) }, atk: Math.round(ATK[s.t] * s.mul * 1.05), price: Math.round(900 * Math.pow(2.2, s.t)), desc: `Редкое оружие. Добывается: ${s.source}.`, setName: s.name,
    };
    for (const slot of ["head", "chest", "legs", "boots", "gloves"] as const) {
      const w = SLOT_W[slot], id = `${s.pre}_${slot}:${cls}:${s.set}`;
      ITEMS[id] = {
        id, name: `${WORDS[c.armor][slot]} ${s.name}`, icon: ICONS[slot], kind: "armor", slot, cls, tier: s.t, rarity: s.rar, reqLevel: s.lvl,
        stats: { [main]: Math.round(st * w * 0.8) || 1, vit: Math.round(st * w * 0.7) || 1, ...(c.magic ? { spi: Math.round(st * w * 0.5) } : { dex: Math.round(st * w * 0.4) }) },
        armor: Math.round(ARM[s.t] * s.mul * MUL[c.armor] * w * 2) / 2, price: Math.round(400 * w * Math.pow(2.2, s.t)), desc: `Часть редкого сета «${s.name}». Добывается: ${s.source}.`, setName: s.name,
      };
    }
  }
  // реликвии недельных боссов
  const REL: [string, string, "ring" | "amulet", number, Record<string, number>][] = [
    ["Кольцо Капитана", "💍", "ring", 4, { str: 30, dex: 22, vit: 14 }], ["Амулет Горного Вождя", "📿", "amulet", 4, { vit: 38, str: 20, spi: 10 }],
    ["Кольцо Топи", "💍", "ring", 4, { int: 32, spi: 24, vit: 14 }], ["Ледяной Амулет Королевы", "📿", "amulet", 5, { int: 40, spi: 30, vit: 16 }], ["Сердце Феникса", "📿", "amulet", 5, { str: 44, dex: 36, int: 20, vit: 30 }],
  ];
  REL.forEach(([name, icon, slot, rar, stats], i) => {
    const id = `relic_${i}`;
    ITEMS[id] = { id, name, icon, kind: "jewel", slot, tier: 5, rarity: rar, reqLevel: 15 + i * 6, stats, price: 2500 + i * 1500, desc: "Реликвия недельного мини-босса. Падает очень редко." };
  });
}
