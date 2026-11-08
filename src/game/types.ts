export const CLASS_IDS = [
  "warrior",
  "assassin",
  "mage",
  "sorcerer",
  "shieldbearer",
  "archer",
  "berserker",
  "tamer",
] as const;
export type ClassId = (typeof CLASS_IDS)[number];
export type Gender = "male" | "female";
export type StatKey = "str" | "dex" | "int" | "vit" | "spi";
export const STAT_KEYS: StatKey[] = ["str", "dex", "int", "vit", "spi"];
export type Stats = Record<StatKey, number>;
export type SlotId = "weapon" | "head" | "chest" | "legs" | "boots" | "gloves" | "ring" | "amulet";
export const SLOTS: SlotId[] = ["head", "chest", "legs", "boots", "gloves", "weapon", "ring", "amulet"];
export type ZoneId = "meadow" | "desert" | "forest" | "crypt" | "capital" | "coast" | "highlands" | "swamp" | "tundra" | "volcano" | "mines" | "sunken" | "dragon" | "void";

export interface Appearance {
  skin: string;
  hair: number; // 0..9 стиль причёски
  hairColor: string;
  eyeColor: string;
  eyeStyle: number; // 0..5
  brow: number; // 0..3
  ears: number; // 0 человек, 1 эльф, 2 кошачьи, 3 лисьи
  tail: number; // 0 нет, 1 кошачий, 2 лисий
  mark: number; // 0..4 боевая раскраска / шрам
  markColor: string;
  height: number; // 0..1
  build: number; // 0..1
  bust: number; // 0..1
  headSize: number; // 0..1
  eyeSize: number; // 0..1
  accent: string; // акцентный цвет одежды
}

export interface InvItem {
  id: string;
  n: number;
}

export interface QuestProgress {
  state: "active" | "ready" | "done";
  prog: number[];
}

export interface PlayerState {
  level: number;
  xp: number;
  gold: number;
  hp: number;
  mp: number;
  statPoints: number;
  skillPoints: number;
  alloc: Stats;
  skills: Record<string, number>;
  hotbar: (string | null)[];
  inventory: (InvItem | null)[];
  equipment: Partial<Record<SlotId, string>>;
  quests: Record<string, QuestProgress>;
  zone: ZoneId;
  x: number;
  z: number;
  ry: number;
}

export const INV_SIZE = 40;
export const LEVEL_CAP = 50;
