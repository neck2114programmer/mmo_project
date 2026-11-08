import type { Appearance, ClassId, Gender, ZoneId } from "../types";

// ---------------- МОНСТРЫ ----------------
export interface MobDef {
  id: string; name: string; model: string; variant?: string; tint?: string; scale: number;
  speed: number; aggro: number; ranged?: number; projectile?: string; hpMul?: number; dmgMul?: number; xpMul?: number;
  drops: [string, number][]; boss?: boolean; atkSpeed?: number;
}
export const MOBS: Record<string, MobDef> = {
  slime: { id: "slime", name: "Лесной слизень", model: "slime", tint: "#7be86a", scale: 0.9, speed: 2.2, aggro: 8, hpMul: 0.8, drops: [["slime_gel", 0.5], ["food_bread", 0.1], ["hp_s", 0.08]] },
  wolf: { id: "wolf", name: "Серый волк", model: "wolf", tint: "#8d8f98", scale: 1, speed: 5.5, aggro: 14, drops: [["wolf_pelt", 0.45], ["hp_s", 0.1]] },
  boar: { id: "boar", name: "Дикий кабан", model: "boar", tint: "#7a5a43", scale: 1, speed: 4.5, aggro: 9, hpMul: 1.15, drops: [["boar_tusk", 0.45], ["food_bread", 0.12]] },
  bandit: { id: "bandit", name: "Лесной бандит", model: "humanoid", variant: "bandit", scale: 1, speed: 4.2, aggro: 13, drops: [["bandit_badge", 0.45], ["hp_s", 0.15], ["mp_s", 0.1]] },
  alpha: { id: "alpha", name: "Альфа-волк Фенрир", model: "wolf", tint: "#e9ecf5", scale: 1.9, speed: 6, aggro: 18, hpMul: 9, dmgMul: 1.5, xpMul: 6, boss: true, drops: [["alpha_fang", 1], ["hp_m", 0.5]] },
  scorpion: { id: "scorpion", name: "Песчаный скорпион", model: "scorpion", tint: "#c98a3b", scale: 1, speed: 4.5, aggro: 11, drops: [["scorpion_sting", 0.5], ["hp_m", 0.08]] },
  cobra: { id: "cobra", name: "Королевская кобра", model: "cobra", tint: "#6a9b3a", scale: 1, speed: 4.8, aggro: 10, drops: [["cobra_fang", 0.5], ["mp_m", 0.08]] },
  golem: { id: "golem", name: "Песчаный голем", model: "golem", tint: "#d4a96a", scale: 1.5, speed: 3.2, aggro: 9, hpMul: 1.6, dmgMul: 1.2, xpMul: 1.4, drops: [["golem_core", 0.4], ["hp_m", 0.1]] },
  mummy: { id: "mummy", name: "Древняя мумия", model: "humanoid", variant: "mummy", scale: 1.05, speed: 3.4, aggro: 12, drops: [["mummy_wrap", 0.5], ["mp_m", 0.1], ["hp_m", 0.1]] },
  sandqueen: { id: "sandqueen", name: "Королева Песков Нефара", model: "scorpion", tint: "#7a2e1c", scale: 3.2, speed: 4.5, aggro: 20, hpMul: 9, dmgMul: 1.5, xpMul: 6, boss: true, drops: [["sand_queen_eye", 1], ["hp_l", 0.6]] },
  ent: { id: "ent", name: "Страж-энт", model: "ent", tint: "#6b4a2a", scale: 1.6, speed: 3.2, aggro: 10, hpMul: 1.6, dmgMul: 1.2, xpMul: 1.4, drops: [["ent_bark", 0.5], ["hp_l", 0.08]] },
  wisp: { id: "wisp", name: "Лесной дух", model: "wisp", tint: "#7dfff0", scale: 1, speed: 4, aggro: 12, ranged: 14, projectile: "#7dfff0", drops: [["wisp_dust", 0.5], ["mp_l", 0.1]] },
  spider: { id: "spider", name: "Ядовитый паук", model: "spider", tint: "#3a2b4a", scale: 1.2, speed: 5, aggro: 13, drops: [["spider_silk", 0.5], ["hp_l", 0.08]] },
  druid: { id: "druid", name: "Тёмный друид", model: "humanoid", variant: "druid", scale: 1.05, speed: 4, aggro: 14, ranged: 14, projectile: "#9dff5a", drops: [["druid_token", 0.5], ["mp_l", 0.12], ["hp_l", 0.1]] },
  cornelius: { id: "cornelius", name: "Древний Энт Корнелий", model: "ent", tint: "#4a3a22", variant: "ancient", scale: 3.4, speed: 3.4, aggro: 20, hpMul: 9, dmgMul: 1.5, xpMul: 6, boss: true, drops: [["cornelius_heart", 1], ["hp_l", 0.6]] },
  skeleton: { id: "skeleton", name: "Скелет-воин", model: "humanoid", variant: "skeleton", scale: 1.05, speed: 4, aggro: 13, drops: [["bone_dust", 0.5], ["hp_l", 0.1]] },
  ghost: { id: "ghost", name: "Неупокоенный призрак", model: "ghost", tint: "#9fd8ff", scale: 1.1, speed: 3.6, aggro: 13, ranged: 12, projectile: "#9fd8ff", drops: [["soul_shard", 0.5], ["mp_l", 0.12]] },
  bonemage: { id: "bonemage", name: "Костяной маг", model: "humanoid", variant: "bonemage", scale: 1.05, speed: 3.6, aggro: 15, ranged: 15, projectile: "#b25dff", drops: [["bone_dust", 0.4], ["soul_shard", 0.3], ["mp_x", 0.06]] },
  ghoul: { id: "ghoul", name: "Вурдалак-гончая", model: "wolf", variant: "hound", tint: "#4d7a52", scale: 1.15, speed: 6, aggro: 14, drops: [["ghoul_claw", 0.5], ["hp_x", 0.06]] },
  boneknight: { id: "boneknight", name: "Костяной Страж Горм", model: "humanoid", variant: "boneknight", scale: 1.8, speed: 3.8, aggro: 18, hpMul: 8, dmgMul: 1.4, xpMul: 5, boss: true, drops: [["crypt_sigil", 1], ["hp_x", 0.6]] },
  lich: { id: "lich", name: "Король-Лич Малгрот", model: "humanoid", variant: "lich", scale: 1.9, speed: 3.8, aggro: 22, ranged: 16, projectile: "#7dff6a", hpMul: 12, dmgMul: 1.6, xpMul: 8, boss: true, drops: [["lich_phylactery", 1], ["hp_x", 1], ["mp_x", 1]] },
};

// ---------------- NPC ----------------
export interface NpcDef {
  id: string; name: string; title: string; zone: ZoneId; x: number; z: number; ry: number;
  gender: Gender; cls: ClassId; look: Partial<Appearance>; tier?: number; helm?: boolean; wander?: number;
  vendor?: { kind: "potion" | "weapon" | "armor" | "jewel"; maxTier: number };
  lines: string[];
}
const N = (n: NpcDef): NpcDef => n;
export const NPCS: Record<string, NpcDef> = {};
[
  // ---- Опушка ----
  N({ id: "edmund", name: "Старейшина Эдмунд", title: "Хранитель Рассвета", zone: "meadow", x: -20, z: 2, ry: 1.2, gender: "male", cls: "mage", look: { hair: 1, hairColor: "#f5f5f5", skin: "#f1bf98", height: 0.45, accent: "#8e44ad" }, tier: 3, wander: 2, lines: ["Добро пожаловать, путник. Рассвет принёс тебя в нужный час.", "Земли вокруг неспокойны. Нам нужны храбрые герои."] }),
  N({ id: "rolf", name: "Капитан Рольф", title: "Начальник стражи", zone: "meadow", x: -10, z: 13, ry: 3.6, gender: "male", cls: "warrior", look: { hair: 5, hairColor: "#3a2418", skin: "#e0a67c", build: 0.85, height: 0.7, mark: 1 }, tier: 2, helm: true, wander: 1, lines: ["Стража не дремлет. Но нам нужны ещё мечи.", "Бандиты на востоке совсем обнаглели!"] }),
  N({ id: "gregor", name: "Кузнец Грегор", title: "Торговец оружием", zone: "meadow", x: -27, z: 12, ry: 2.8, gender: "male", cls: "berserker", look: { hair: 6, hairColor: "#a8642a", skin: "#c98b5e", build: 0.95, height: 0.6 }, tier: 1, vendor: { kind: "weapon", maxTier: 2 }, lines: ["Лучшая сталь Рассвета — только у меня!", "Клинок без заточки — просто железо."] }),
  N({ id: "martha", name: "Марта", title: "Торговка доспехами", zone: "meadow", x: -30, z: 8, ry: 2.2, gender: "female", cls: "shieldbearer", look: { hair: 7, hairColor: "#6b3b1f", skin: "#f9d2b4", build: 0.6 }, tier: 1, vendor: { kind: "armor", maxTier: 2 }, lines: ["Хорошая броня спасёт жизнь!", "Примерь-ка, сидит как влитая."] }),
  N({ id: "liara", name: "Травница Лиара", title: "Алхимик", zone: "meadow", x: -30, z: -1, ry: 1.0, gender: "female", cls: "tamer", look: { hair: 3, hairColor: "#5ccf6a", skin: "#f1bf98", ears: 1, eyeColor: "#2e7d4f" }, tier: 1, vendor: { kind: "potion", maxTier: 1 }, lines: ["Зелья, настойки, всё свежее!", "Лес щедр на травы, если знать, где искать."] }),
  N({ id: "thomas", name: "Рыбак Томас", title: "Старый рыбак", zone: "meadow", x: 19, z: -10, ry: -1.4, gender: "male", cls: "archer", look: { hair: 0, hairColor: "#9aa5b8", skin: "#c98b5e", height: 0.4 }, tier: 0, lines: ["Тише... рыба спугнётся.", "Река богата лещом в этом году."] }),
  N({ id: "walter", name: "Охотник Вальтер", title: "Следопыт", zone: "meadow", x: 38, z: 10, ry: 0.5, gender: "male", cls: "archer", look: { hair: 2, hairColor: "#6b3b1f", skin: "#e0a67c", mark: 2, markColor: "#2b2b2b" }, tier: 1, wander: 1, lines: ["Волки обнаглели. Слышишь вой?"] }),
  N({ id: "agata", name: "Старая Агата", title: "Вдова", zone: "meadow", x: -40, z: 4, ry: 1.6, gender: "female", cls: "mage", look: { hair: 8, hairColor: "#f5f5f5", skin: "#f9d2b4", height: 0.3, accent: "#ecf0f1" }, tier: 0, wander: 1.5, lines: ["Ах, мой бедный амулет..."] }),
  N({ id: "kaira", name: "Следопыт Кайра", title: "Проводник в пустыню", zone: "meadow", x: 78, z: 4, ry: 1.5, gender: "female", cls: "assassin", look: { hair: 2, hairColor: "#ff8a2b", skin: "#e0a67c", ears: 2, tail: 1, eyeColor: "#f2b632" }, tier: 2, lines: ["Дорога в пустыню опасна. Но я знаю тропы."] }),
  N({ id: "barrik", name: "Торговец Баррик", title: "Украшения и редкости", zone: "meadow", x: -15, z: -8, ry: 0.2, gender: "male", cls: "sorcerer", look: { hair: 4, hairColor: "#d9a441", skin: "#f1bf98", height: 0.35, accent: "#f1c40f" }, tier: 1, wander: 3, vendor: { kind: "jewel", maxTier: 2 }, lines: ["Кольца, амулеты — всё блестит!"] }),
  N({ id: "pip", name: "Малыш Пип", title: "Сорванец", zone: "meadow", x: -16, z: 8, ry: 0, gender: "male", cls: "tamer", look: { hair: 5, hairColor: "#d9a441", skin: "#f9d2b4", height: 0.05, headSize: 0.8, eyeSize: 0.8, ears: 3, tail: 2 }, tier: 0, wander: 8, lines: ["Хи-хи! Поймай меня!", "Я видел огромного волка у пещеры!"] }),
  N({ id: "guard1", name: "Страж Рассвета", title: "Стража", zone: "meadow", x: -5, z: 0, ry: 1.5, gender: "male", cls: "shieldbearer", look: { build: 0.8 }, tier: 2, helm: true, lines: ["Проходи, путник. Здесь безопасно."] }),
  N({ id: "guard2", name: "Страж Рассвета", title: "Стража", zone: "meadow", x: 4, z: 18, ry: 3.2, gender: "female", cls: "warrior", look: { hair: 2, hairColor: "#9a5cff" }, tier: 2, helm: true, wander: 6, lines: ["Я присматриваю за дорогой."] }),
  // ---- Пустыня ----
  N({ id: "zahir", name: "Эмир Захир", title: "Правитель оазиса", zone: "desert", x: -40, z: -6, ry: 2.4, gender: "male", cls: "warrior", look: { hair: 5, hairColor: "#1b1418", skin: "#a56a43", height: 0.7, accent: "#f1c40f" }, tier: 3, helm: false, lines: ["Песок хранит тайны. И опасности."] }),
  N({ id: "hassan", name: "Торговец Хассан", title: "Зелья и снадобья", zone: "desert", x: -34, z: 6, ry: 3.6, gender: "male", cls: "sorcerer", look: { hair: 0, hairColor: "#3a2418", skin: "#7d4b2e", accent: "#e67e22" }, tier: 2, vendor: { kind: "potion", maxTier: 2 }, lines: ["Дёшево! Свежайшие зелья из самого Ал-Хазара!"] }),
  N({ id: "darius", name: "Кузнец Дарий", title: "Оружейник", zone: "desert", x: -46, z: 4, ry: 1.2, gender: "male", cls: "berserker", look: { hair: 6, hairColor: "#1b1418", skin: "#a56a43", build: 0.95 }, tier: 2, vendor: { kind: "weapon", maxTier: 3 }, lines: ["Пустынный клинок остр, как ветер."] }),
  N({ id: "safiya", name: "Караванщица Сафия", title: "Торговка доспехами", zone: "desert", x: -30, z: -10, ry: 4.2, gender: "female", cls: "assassin", look: { hair: 7, hairColor: "#1b1418", skin: "#c98b5e", accent: "#d63384" }, tier: 2, vendor: { kind: "armor", maxTier: 3 }, lines: ["Броня для любых песков."] }),
  N({ id: "mamun", name: "Профессор Аль-Мамун", title: "Археолог", zone: "desert", x: -48, z: -12, ry: 1.0, gender: "male", cls: "mage", look: { hair: 4, hairColor: "#9aa5b8", skin: "#c98b5e", height: 0.35, accent: "#16a085" }, tier: 2, wander: 2, lines: ["Пирамида скрывает великое знание!"] }),
  N({ id: "ibrahim", name: "Шаман Ибрагим", title: "Хранитель источника", zone: "desert", x: -38, z: 14, ry: 3.0, gender: "male", cls: "tamer", look: { hair: 9, hairColor: "#f5f5f5", skin: "#7d4b2e", mark: 3, markColor: "#4da6ff" }, tier: 2, wander: 1, lines: ["Вода — это жизнь, путник."] }),
  N({ id: "nadia", name: "Нади", title: "Танцовщица", zone: "desert", x: -36, z: -2, ry: 1.0, gender: "female", cls: "assassin", look: { hair: 9, hairColor: "#ff6aa8", skin: "#a56a43", ears: 3, tail: 2 }, tier: 1, wander: 5, lines: ["Танцую я для оазиса!"] }),
  // ---- Лес ----
  N({ id: "aelindor", name: "Верховный друид Аэлиндор", title: "Хранитель Эйнвуда", zone: "forest", x: -28, z: 0, ry: 1.6, gender: "male", cls: "mage", look: { hair: 1, hairColor: "#5ccf6a", skin: "#e8e4f0", ears: 1, eyeColor: "#22d3a8", height: 0.8, accent: "#27ae60" }, tier: 4, lines: ["Лес шепчет. Он зовёт на помощь."] }),
  N({ id: "silvana", name: "Сильвана", title: "Эльфийская травница", zone: "forest", x: -34, z: 8, ry: 2.8, gender: "female", cls: "tamer", look: { hair: 1, hairColor: "#f2dc8c", skin: "#e8e4f0", ears: 1, bust: 0.4 }, tier: 3, vendor: { kind: "potion", maxTier: 3 }, lines: ["Целебные нектары Эйнвуда!"] }),
  N({ id: "torin", name: "Лесной кузнец Торин", title: "Мастер оружия", zone: "forest", x: -22, z: 10, ry: 3.4, gender: "male", cls: "warrior", look: { hair: 7, hairColor: "#c43c3c", skin: "#e0a67c", build: 0.9, height: 0.2 }, tier: 3, vendor: { kind: "weapon", maxTier: 4 }, lines: ["Дворфийская сталь, друг мой!"] }),
  N({ id: "mirel", name: "Хранительница Мирэль", title: "Доспехи и врата склепа", zone: "forest", x: -33, z: -9, ry: 0.6, gender: "female", cls: "archer", look: { hair: 2, hairColor: "#4e8bff", skin: "#e8e4f0", ears: 1, eyeColor: "#9a5cff" }, tier: 3, vendor: { kind: "armor", maxTier: 4 }, lines: ["Склеп нельзя оставлять без присмотра."] }),
  N({ id: "fenris", name: "Охотник Фенрис", title: "Следопыт-эльф", zone: "forest", x: -18, z: -6, ry: 2.0, gender: "male", cls: "archer", look: { hair: 2, hairColor: "#2b2f5c", skin: "#e8e4f0", ears: 1 }, tier: 3, wander: 2, lines: ["Тёмные друиды отравили рощу."] }),
  N({ id: "lunamoth", name: "Лунный Мотылёк", title: "Дух леса", zone: "forest", x: -26, z: -12, ry: 0.4, gender: "female", cls: "mage", look: { hair: 3, hairColor: "#ff6aa8", skin: "#bfe0d0", ears: 3, tail: 2, headSize: 0.7, eyeSize: 0.9, height: 0.05 }, tier: 2, wander: 6, lines: ["Хи-хи, следуй за мотыльками!"] }),
  N({ id: "jeweler_f", name: "Торговец Эльрик", title: "Ювелир", zone: "forest", x: -38, z: -2, ry: 1.2, gender: "male", cls: "sorcerer", look: { hair: 9, hairColor: "#9a5cff", skin: "#e8e4f0", ears: 1 }, tier: 3, vendor: { kind: "jewel", maxTier: 4 }, lines: ["Эльфийские кольца — вне времени."] }),
  // ---- Склеп ----
  N({ id: "aldrik", name: "Сэр Альдрик", title: "Призрачный рыцарь", zone: "crypt", x: 0, z: 70, ry: 3.14, gender: "male", cls: "warrior", look: { hair: 1, hairColor: "#9fd8ff", skin: "#bfe0d0", eyeColor: "#5ac8ff", build: 0.8 }, tier: 4, helm: true, lines: ["Я погиб здесь... но долг не отпускает."] }),
  N({ id: "elara", name: "Жрица Элара", title: "Целительница склепа", zone: "crypt", x: 6, z: 72, ry: 3.4, gender: "female", cls: "mage", look: { hair: 1, hairColor: "#f5f5f5", skin: "#e8e4f0", eyeColor: "#f2b632", accent: "#ecf0f1" }, tier: 4, vendor: { kind: "potion", maxTier: 5 }, lines: ["Исцеляю раненых героев."] }),
  N({ id: "merchant_c", name: "Бродячий торговец Зорн", title: "Редкое снаряжение", zone: "crypt", x: -6, z: 72, ry: 2.9, gender: "male", cls: "assassin", look: { hair: 6, hairColor: "#c43c3c", skin: "#c98b5e", mark: 1 }, tier: 4, vendor: { kind: "armor", maxTier: 5 }, lines: ["Лучшее снаряжение — в самом сердце тьмы!"] }),
].forEach((n) => (NPCS[n.id] = n));
import { NEW_MOBS, NEW_NPCS } from "./gen";
Object.assign(MOBS, NEW_MOBS);
for (const n of NEW_NPCS) NPCS[n.id] = n;
