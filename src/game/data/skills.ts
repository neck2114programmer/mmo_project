import type { ClassId } from "../types";
import { CLASSES } from "./classes";

export type SkillKind = "tgt" | "aoe" | "aoet" | "dash" | "heal" | "buff" | "shield" | "summon";
export interface Buff { atk?: number; def?: number; spd?: number; crit?: number; haste?: number; dodge?: number }
export interface Passive {
  atk?: number; def?: number; hp?: number; mp?: number; crit?: number; critDmg?: number; spd?: number;
  haste?: number; leech?: number; regen?: number; dodge?: number; mpRegen?: number;
  str?: number; dex?: number; int?: number; vit?: number; spi?: number;
}
export interface SkillDef {
  id: string; cls: ClassId; name: string; icon: string; type: "active" | "passive";
  tier: number; row: number; reqLevel: number; parent?: string; maxRank: number;
  kind?: SkillKind; cd: number; mp: number; power: number;
  range: number; radius: number; dur: number; stun: number; slow: number; dot: number;
  heal: number; leech: number; shield: number; hits: number; buff?: Buff;
  vfx: string; color: string; passive?: Passive; desc: string;
}

export const TIER_LEVELS = [1, 5, 10, 16, 22, 28];
export const COLORS: Record<string, string> = {
  fire: "#ff6a2b", ice: "#7fd8ff", bolt: "#ffe45e", dark: "#b25dff", poison: "#8dff4d", holy: "#fff1a8",
  blood: "#ff3050", nature: "#6dff9c", steel: "#e3ecff", wind: "#aef5e6", gold: "#ffcc4d", shadow: "#7a5cff",
};

interface Opts { r?: number; rad?: number; dur?: number; stun?: number; slow?: number; dot?: number; heal?: number; leech?: number; shield?: number; hits?: number; buff?: Buff; vfx?: string; c?: string }
type Row = { t: "A"; name: string; icon: string; parent: number; cd: number; mp: number; pow: number; kind: SkillKind; o: Opts; desc: string } | { t: "P"; name: string; icon: string; parent: number; p: Passive; desc: string };

const A = (name: string, icon: string, parent: number, cd: number, mp: number, pow: number, kind: SkillKind, o: Opts, desc: string): Row => ({ t: "A", name, icon, parent, cd, mp, pow, kind, o, desc });
const P = (name: string, icon: string, parent: number, p: Passive, desc: string): Row => ({ t: "P", name, icon, parent, p, desc });

const T = (n: number) => n; // читаемость
void T;

const LINES: Record<ClassId, Row[]> = {
  warrior: [
    A("Рассекающий удар", "⚔️", -1, 4, 10, 1.6, "tgt", { c: "steel" }, "Мощный рубящий удар по цели."),
    A("Боевой клич", "📣", -1, 30, 15, 0, "buff", { dur: 20, buff: { atk: 0.15 }, c: "gold" }, "Повышает силу атаки на время."),
    P("Закалка", "❤️", -1, { hp: 3 }, "Увеличивает максимум здоровья."),
    A("Рывок клинка", "💨", -1, 12, 15, 1.4, "dash", { r: 12, c: "steel" }, "Стремительный рывок к цели с ударом."),
    P("Мастер меча", "🗡️", -1, { atk: 3 }, "Увеличивает наносимый урон."),
    A("Вихрь клинков", "🌀", 0, 10, 22, 1.5, "aoe", { rad: 5, vfx: "whirl", c: "steel" }, "Удар по всем врагам вокруг."),
    A("Оглушающий удар", "💥", 0, 16, 20, 1.2, "tgt", { stun: 2, c: "gold" }, "Оглушает цель на 2 сек."),
    P("Стойкость", "🛡️", 1, { def: 4 }, "Повышает защиту."),
    A("Кровопускание", "🩸", 3, 14, 18, 0.5, "tgt", { dot: 2.5, dur: 8, c: "blood" }, "Рана, которая кровоточит."),
    P("Острый глаз", "👁️", 4, { crit: 2 }, "Увеличивает шанс крита."),
    A("Сокрушение", "🔨", 0, 14, 30, 3.0, "tgt", { c: "fire" }, "Сокрушительный удар огромной силы."),
    A("Железная воля", "🏰", 2, 40, 25, 0, "buff", { dur: 12, buff: { def: 0.3 }, c: "steel" }, "Резко повышает защиту."),
    P("Боевой пыл", "🔥", 4, { haste: 2 }, "Ускоряет атаки и перезарядку."),
    A("Разрез земли", "🌋", 1, 18, 34, 2.2, "aoe", { rad: 6, stun: 1, vfx: "quake", c: "fire" }, "Ударная волна оглушает врагов."),
    P("Живучесть", "💚", 3, { regen: 0.5 }, "Восстановление здоровья."),
    A("Казнь", "☠️", 0, 20, 38, 4.0, "tgt", { c: "blood" }, "Добивающий удар колоссального урона."),
    A("Клинок рассвета", "🌅", 1, 22, 40, 2.4, "aoet", { rad: 5, vfx: "pillar", c: "holy" }, "Столп света обрушивается на врагов."),
    P("Мастерство критов", "💢", 4, { critDmg: 8 }, "Усиливает критические удары."),
    A("Второе дыхание", "🌬️", 3, 60, 30, 0, "heal", { heal: 0.25, c: "nature" }, "Мгновенно восстанавливает 25% здоровья."),
    P("Закалённая сталь", "💪", 2, { str: 3 }, "Повышает силу."),
    A("Град ударов", "⚡", 0, 24, 45, 0.9, "tgt", { hits: 5, c: "steel" }, "Пять молниеносных ударов."),
    A("Знамя Легиона", "🚩", 1, 60, 40, 0, "buff", { dur: 25, buff: { atk: 0.2, def: 0.2, spd: 0.1 }, c: "gold" }, "Знамя вдохновляет воина."),
    P("Несгибаемый", "🏔️", 2, { hp: 4 }, "Значительно повышает здоровье."),
    P("Покоритель", "🦷", 4, { leech: 2 }, "Часть урона возвращается здоровьем."),
    A("Сотрясение", "🌍", 3, 30, 50, 2.0, "aoe", { rad: 8, stun: 3, vfx: "quake", c: "fire" }, "Оглушает всех вокруг на 3 сек."),
    A("Гнев Небес", "☀️", 0, 45, 70, 7.0, "aoet", { rad: 7, vfx: "pillar", c: "holy" }, "Небесная кара на врагов."),
    A("Клинок Легенды", "🌟", 2, 90, 60, 0, "buff", { dur: 20, buff: { atk: 0.35, crit: 15 }, c: "gold" }, "Легендарный клинок: сила и крит."),
    P("Меч-бог", "👑", 4, { atk: 4 }, "Вершина мастерства меча."),
    P("Вечный воин", "🦁", 3, { vit: 4 }, "Выносливость героя."),
    A("Судный удар", "⚖️", 1, 35, 55, 6.0, "tgt", { vfx: "cleave", c: "gold" }, "Удар, решающий судьбу боя."),
  ],
  assassin: [
    A("Двойной укол", "🔪", -1, 3, 8, 0.9, "tgt", { hits: 2, vfx: "stab", c: "steel" }, "Два быстрых удара клинками."),
    A("Теневой шаг", "🌫️", -1, 10, 14, 1.5, "dash", { r: 14, c: "shadow" }, "Мгновенно оказываетесь у цели."),
    P("Ловкость змеи", "🐍", -1, { dodge: 2 }, "Шанс уклониться."),
    A("Яд на клинках", "☣️", -1, 14, 16, 0.4, "tgt", { dot: 3, dur: 9, c: "poison" }, "Отравляет цель."),
    P("Острие", "📌", -1, { crit: 2 }, "Больше критических ударов."),
    A("Вихрь кинжалов", "🌀", 0, 9, 20, 1.7, "aoe", { rad: 4, vfx: "whirl", c: "steel" }, "Кружащийся клинок."),
    A("Подрез сухожилий", "🦵", 3, 14, 16, 1.2, "tgt", { slow: 0.5, dur: 5, vfx: "stab", c: "blood" }, "Замедляет цель."),
    P("Хладнокровие", "🧊", 4, { critDmg: 6 }, "Усиливает крит."),
    A("Дымовая завеса", "💨", 2, 28, 20, 0, "buff", { dur: 8, buff: { spd: 0.3, def: 0.25 }, c: "shadow" }, "Скрывает в дыму."),
    P("Быстрые руки", "🖐️", 0, { haste: 2 }, "Быстрее атаки."),
    A("Удар в спину", "🗡️", 1, 12, 28, 3.2, "dash", { r: 12, vfx: "stab", c: "blood" }, "Рывок и смертельный удар."),
    A("Кровавый танец", "💃", 0, 18, 34, 2.0, "aoe", { rad: 5, dot: 2, dur: 6, vfx: "whirl", c: "blood" }, "Кровавые раны вокруг."),
    P("Тень", "👤", 3, { spd: 3 }, "Скорость передвижения."),
    A("Парализующий укол", "🪡", 4, 22, 28, 1.4, "tgt", { stun: 3, vfx: "stab", c: "poison" }, "Парализует на 3 сек."),
    P("Вампиризм клинка", "🦇", 2, { leech: 2 }, "Похищение здоровья."),
    A("Смертельный росчерк", "✂️", 0, 20, 36, 4.2, "tgt", { vfx: "cleave", c: "blood" }, "Росчерк смерти."),
    A("Шквал сюрикэнов", "✴️", 1, 20, 38, 2.6, "aoet", { rad: 5, r: 14, vfx: "rain", c: "steel" }, "Дождь метательных звёзд."),
    P("Мастер убийств", "💀", 4, { crit: 3 }, "Шанс критического удара."),
    A("Исчезновение", "🌑", 3, 45, 30, 0, "buff", { dur: 10, buff: { spd: 0.4, crit: 20 }, c: "shadow" }, "Слейтесь с тенью."),
    P("Ядовитая кровь", "🧪", 2, { atk: 3 }, "Урон растёт."),
    A("Казнь тенью", "🌓", 1, 30, 50, 5.5, "dash", { r: 14, vfx: "stab", c: "shadow" }, "Сокрушительный удар из тени."),
    A("Цветок смерти", "🥀", 0, 26, 46, 0.9, "tgt", { hits: 6, vfx: "stab", c: "blood" }, "Шесть смертельных уколов."),
    P("Тёмная ловкость", "🎭", 3, { dex: 4 }, "Ловкость растёт."),
    P("Призрачная поступь", "👣", 2, { dodge: 3 }, "Уклонение."),
    A("Клинки бури", "🌪️", 4, 32, 55, 3.2, "aoe", { rad: 7, vfx: "whirl", c: "wind" }, "Буря стали."),
    A("Тысяча теней", "🌌", 0, 50, 75, 7.0, "aoet", { rad: 8, vfx: "whirl", c: "shadow" }, "Тени разрывают врагов."),
    A("Ночной убийца", "🌙", 2, 90, 60, 0, "buff", { dur: 18, buff: { atk: 0.3, crit: 30, haste: 0.2 }, c: "shadow" }, "Режим абсолютного охотника."),
    P("Совершенство", "💎", 4, { critDmg: 10 }, "Невероятный урон от критов."),
    A("Аудиенция смерти", "⚰️", 1, 45, 70, 8.0, "tgt", { stun: 1.5, vfx: "cleave", c: "dark" }, "Смерть вызывает вас."),
    P("Мрак", "🕳️", 3, { atk: 5 }, "Тьма усиливает удары."),
  ],
  mage: [
    A("Огненный шар", "🔥", -1, 3, 12, 1.7, "tgt", { r: 20, vfx: "bolt", c: "fire" }, "Метает огненный шар."),
    A("Ледяная стрела", "❄️", -1, 6, 14, 1.4, "tgt", { r: 20, slow: 0.4, dur: 4, vfx: "bolt", c: "ice" }, "Замедляет цель."),
    P("Магическая сила", "🔮", -1, { int: 2 }, "Повышает интеллект."),
    A("Магический барьер", "🛡️", -1, 30, 22, 0, "shield", { shield: 0.25, c: "ice" }, "Щит, поглощающий урон."),
    P("Медитация", "🧘", -1, { mpRegen: 2 }, "Восстановление маны."),
    A("Цепная молния", "⚡", 0, 8, 24, 1.0, "tgt", { r: 20, hits: 3, vfx: "beam", c: "bolt" }, "Три удара молнии."),
    A("Пламенный взрыв", "💥", 0, 10, 28, 2.0, "aoet", { rad: 5, r: 20, vfx: "nova", c: "fire" }, "Взрыв огня по области."),
    P("Поток маны", "💧", 4, { mp: 4 }, "Больше маны."),
    A("Ледяное кольцо", "💠", 1, 18, 26, 1.2, "aoe", { rad: 6, slow: 0.6, stun: 1.5, vfx: "nova", c: "ice" }, "Замораживает врагов."),
    P("Знание стихий", "📖", 2, { atk: 2 }, "Урон стихий."),
    A("Метеор", "☄️", 1, 18, 44, 3.2, "aoet", { rad: 6, r: 22, vfx: "rain", c: "fire" }, "Падающий метеор."),
    A("Ледяная глыба", "🧊", 1, 16, 36, 2.8, "tgt", { r: 20, stun: 2.5, vfx: "bolt", c: "ice" }, "Заключает цель в лёд."),
    P("Концентрация", "🎯", 4, { crit: 2 }, "Больше критов."),
    A("Скачок маны", "✨", 3, 14, 20, 1.0, "dash", { r: 14, vfx: "nova", c: "wind" }, "Телепорт к цели со взрывом."),
    P("Воспламенение", "🔆", 0, { critDmg: 6 }, "Усиленный крит."),
    A("Огненный шторм", "🌋", 1, 26, 55, 1.5, "aoet", { rad: 8, r: 22, dot: 4, dur: 8, vfx: "rain", c: "fire" }, "Шторм пламени."),
    A("Луч стужи", "🌨️", 1, 20, 45, 4.0, "tgt", { r: 22, slow: 0.5, dur: 4, vfx: "beam", c: "ice" }, "Ледяной луч."),
    P("Мудрость", "🧠", 2, { int: 3 }, "Интеллект."),
    A("Заряд молний", "🌩️", 2, 22, 48, 2.8, "aoe", { rad: 7, vfx: "nova", c: "bolt" }, "Электрический взрыв."),
    P("Живой огонь", "🕯️", 0, { haste: 3 }, "Ускорение заклинаний."),
    A("Армагеддон", "💀", 0, 40, 80, 5.0, "aoet", { rad: 9, r: 22, vfx: "rain", c: "fire" }, "Огненный апокалипсис."),
    A("Абсолютный ноль", "🥶", 1, 40, 70, 3.0, "aoe", { rad: 9, stun: 3, vfx: "nova", c: "ice" }, "Вечная мерзлота."),
    P("Мастер стихий", "🌈", 2, { atk: 4 }, "Мощь стихий."),
    P("Архимаг", "🎓", 4, { mp: 5 }, "Огромный запас маны."),
    A("Гром небесный", "🌩️", 3, 24, 55, 6.0, "tgt", { r: 22, vfx: "pillar", c: "bolt" }, "Столб грома."),
    A("Звездопад", "🌠", 0, 60, 100, 8.0, "aoet", { rad: 10, r: 22, vfx: "rain", c: "holy" }, "Звёзды обрушиваются с небес."),
    A("Сила Бездны", "🌀", 2, 90, 70, 0, "buff", { dur: 20, buff: { atk: 0.35, haste: 0.3 }, c: "dark" }, "Магия бездны."),
    A("Разрыв реальности", "🌌", 3, 45, 85, 9.0, "tgt", { r: 22, vfx: "beam", c: "dark" }, "Разрывает пространство."),
    P("Вечная мудрость", "📜", 2, { int: 5 }, "Интеллект на пике."),
    P("Эфирная гармония", "🎼", 4, { crit: 3 }, "Магический крит."),
  ],
  sorcerer: [
    A("Теневой сгусток", "🌑", -1, 3, 11, 1.6, "tgt", { r: 20, vfx: "bolt", c: "dark" }, "Сгусток тьмы."),
    A("Проклятие слабости", "☠️", -1, 12, 16, 0.4, "tgt", { r: 20, dot: 2.5, dur: 10, vfx: "bolt", c: "dark" }, "Тёмное проклятие."),
    P("Тёмный дар", "🔮", -1, { int: 2 }, "Повышает интеллект."),
    A("Похищение жизни", "🩸", -1, 8, 16, 1.4, "tgt", { r: 18, leech: 0.5, vfx: "beam", c: "blood" }, "Крадёт здоровье."),
    P("Тёмные знания", "📕", -1, { spi: 2 }, "Дух чародея."),
    A("Чума", "🦠", 1, 16, 28, 0.6, "aoet", { rad: 5, r: 20, dot: 3.5, dur: 10, vfx: "nova", c: "poison" }, "Зараза поражает область."),
    A("Кандалы тьмы", "⛓️", 1, 18, 24, 1.0, "tgt", { r: 18, stun: 2.5, vfx: "beam", c: "shadow" }, "Обездвиживает цель."),
    P("Власть над тенью", "👁️", 0, { atk: 2 }, "Усиливает тёмную магию."),
    A("Призыв тени", "👻", 4, 40, 35, 1.2, "summon", { dur: 25, c: "shadow" }, "Тень сражается за вас."),
    P("Сущность", "🩸", 3, { leech: 2 }, "Похищение жизни."),
    A("Взрыв души", "💥", 0, 14, 38, 3.0, "aoet", { rad: 5, r: 20, vfx: "nova", c: "dark" }, "Взрывает душу врагов."),
    A("Костяное копьё", "🦴", 0, 12, 34, 3.5, "tgt", { r: 20, vfx: "bolt", c: "steel" }, "Метает костяное копьё."),
    P("Тёмная воля", "🌘", 2, { crit: 2 }, "Больше критов."),
    A("Жатва душ", "⚰️", 1, 22, 42, 2.2, "aoe", { rad: 7, leech: 0.3, vfx: "nova", c: "dark" }, "Собирает души вокруг."),
    P("Укрепление духа", "💜", 4, { hp: 3 }, "Больше здоровья."),
    A("Адский огонь", "🔥", 0, 24, 52, 1.5, "aoet", { rad: 6, r: 20, dot: 5, dur: 8, vfx: "rain", c: "dark" }, "Огонь бездны."),
    A("Поцелуй смерти", "💋", 1, 22, 50, 5.0, "tgt", { r: 20, vfx: "beam", c: "blood" }, "Смертельное касание."),
    P("Мастер проклятий", "🧿", 2, { atk: 3 }, "Усиленные проклятия."),
    A("Теневой покров", "🌫️", 3, 45, 40, 0, "shield", { shield: 0.45, c: "shadow" }, "Покров из тьмы."),
    P("Пожиратель", "👹", 4, { leech: 3 }, "Больше вампиризма."),
    A("Пустота", "⚫", 0, 30, 65, 4.0, "aoet", { rad: 8, r: 20, stun: 2.5, vfx: "nova", c: "dark" }, "Пустота поглощает врагов."),
    A("Легион теней", "👥", 1, 60, 70, 2.0, "summon", { dur: 30, c: "shadow" }, "Призыв армии теней."),
    P("Бездна знаний", "📚", 2, { int: 4 }, "Интеллект."),
    A("Кровавая жатва", "🌹", 3, 36, 68, 3.5, "aoe", { rad: 9, leech: 0.4, vfx: "nova", c: "blood" }, "Жатва крови."),
    P("Проклятый", "😈", 4, { critDmg: 8 }, "Усиленный крит."),
    A("Конец света", "🌋", 0, 60, 100, 8.5, "aoet", { rad: 10, r: 20, vfx: "rain", c: "dark" }, "Апокалипсис тьмы."),
    A("Владыка тьмы", "👑", 2, 90, 70, 0, "buff", { dur: 20, buff: { atk: 0.35, haste: 0.2 }, c: "dark" }, "Вы — господин тьмы."),
    A("Душегуб", "💀", 3, 40, 80, 9.0, "tgt", { r: 22, vfx: "beam", c: "dark" }, "Вырывает душу цели."),
    P("Вечное проклятие", "♾️", 2, { atk: 5 }, "Мощь проклятий."),
    P("Пакт с бездной", "🕳️", 4, { spi: 5 }, "Дух бездны."),
  ],
  shieldbearer: [
    A("Удар щитом", "🛡️", -1, 6, 10, 1.4, "tgt", { stun: 1, vfx: "bash", c: "steel" }, "Оглушает ударом щита."),
    A("Бастион", "🏰", -1, 24, 14, 0, "buff", { dur: 10, buff: { def: 0.35 }, c: "steel" }, "Повышает защиту."),
    P("Крепкая броня", "🔰", -1, { def: 3 }, "Защита."),
    A("Провокация", "😠", -1, 14, 12, 0.6, "aoe", { rad: 8, vfx: "nova", c: "gold" }, "Привлекает врагов вокруг."),
    P("Здоровяк", "❤️", -1, { hp: 3 }, "Здоровье."),
    A("Таранный рывок", "🐂", 0, 14, 20, 1.8, "dash", { r: 12, stun: 1.5, vfx: "bash", c: "steel" }, "Таранит врага."),
    A("Стена щитов", "🧱", 1, 30, 24, 0, "shield", { shield: 0.35, c: "gold" }, "Поглощает урон."),
    P("Несокрушимый", "🗿", 3, { vit: 2 }, "Выносливость."),
    A("Сотрясающий удар", "🌍", 3, 12, 24, 1.8, "aoe", { rad: 5, slow: 0.4, dur: 4, vfx: "quake", c: "fire" }, "Замедляет врагов."),
    P("Мастер блока", "🤺", 2, { dodge: 2 }, "Блок и уклонение."),
    A("Карающий щит", "⚡", 0, 12, 28, 3.0, "tgt", { vfx: "bash", c: "gold" }, "Щит карает."),
    A("Оплот веры", "✝️", 1, 45, 35, 0, "heal", { heal: 0.3, c: "holy" }, "Исцеляет 30% здоровья."),
    P("Стойкая воля", "💚", 4, { regen: 0.5 }, "Регенерация."),
    A("Громовой удар", "🌩️", 3, 20, 36, 2.2, "aoe", { rad: 6, stun: 2, vfx: "quake", c: "bolt" }, "Грохот оглушает врагов."),
    P("Ярость стража", "💪", 0, { str: 3 }, "Сила."),
    A("Щит возмездия", "🌟", 0, 18, 40, 3.0, "aoet", { rad: 5, vfx: "pillar", c: "holy" }, "Святой щит бьёт врагов."),
    A("Нерушимая стена", "🏯", 1, 60, 40, 0, "buff", { dur: 12, buff: { def: 0.6 }, c: "steel" }, "Неуязвимость брони."),
    P("Железная кожа", "⛓️", 2, { def: 4 }, "Защита."),
    A("Сокрушитель", "🔨", 3, 22, 44, 4.5, "tgt", { stun: 2, vfx: "bash", c: "fire" }, "Сокрушает цель."),
    P("Крепость духа", "🏔️", 4, { hp: 4 }, "Здоровье."),
    A("Землетрясение", "🌋", 0, 34, 60, 3.5, "aoe", { rad: 9, stun: 3, vfx: "quake", c: "fire" }, "Оглушает всех рядом."),
    A("Священный бастион", "⛪", 1, 60, 55, 0, "shield", { shield: 0.6, heal: 0.2, c: "holy" }, "Щит и исцеление."),
    P("Несгибаемость", "🦾", 2, { vit: 4 }, "Выносливость."),
    A("Контрудар", "↩️", 3, 24, 52, 5.5, "tgt", { vfx: "bash", c: "gold" }, "Сильный ответ."),
    P("Гранитная воля", "🪨", 4, { regen: 1 }, "Регенерация."),
    A("Гнев титана", "🗻", 0, 55, 85, 7.5, "aoet", { rad: 9, stun: 2, vfx: "quake", c: "fire" }, "Гнев титана."),
    A("Последний рубеж", "🚧", 2, 100, 70, 0, "buff", { dur: 15, buff: { def: 0.8, atk: 0.2 }, c: "gold" }, "Стоять насмерть."),
    P("Страж королевства", "👑", 4, { hp: 6 }, "Здоровье стража."),
    P("Непоколебимый", "🧿", 2, { def: 6 }, "Защита."),
    A("Щит богов", "✨", 1, 90, 80, 0, "shield", { shield: 0.8, c: "holy" }, "Божественный щит."),
  ],
  archer: [
    A("Меткий выстрел", "🎯", -1, 3, 10, 1.7, "tgt", { r: 24, vfx: "arrow", c: "steel" }, "Точный выстрел."),
    A("Двойной выстрел", "🏹", -1, 6, 14, 1.0, "tgt", { r: 22, hits: 2, vfx: "arrow", c: "steel" }, "Две стрелы."),
    P("Орлиный глаз", "🦅", -1, { crit: 2 }, "Крит."),
    A("Ловушка", "🪤", -1, 18, 18, 0.8, "aoet", { rad: 4, r: 18, stun: 2, vfx: "nova", c: "gold" }, "Оглушает врагов."),
    P("Лёгкая поступь", "🍃", -1, { spd: 3 }, "Скорость."),
    A("Град стрел", "🌧️", 0, 12, 26, 1.8, "aoet", { rad: 6, r: 22, vfx: "rain", c: "steel" }, "Дождь стрел."),
    A("Отравленная стрела", "☣️", 0, 12, 20, 0.5, "tgt", { r: 24, dot: 3, dur: 9, vfx: "arrow", c: "poison" }, "Яд."),
    P("Ловкие пальцы", "🖐️", 1, { haste: 2 }, "Быстрее стрельба."),
    A("Выстрел с отскоком", "↪️", 3, 14, 20, 2.0, "tgt", { r: 24, slow: 0.5, dur: 4, vfx: "arrow", c: "wind" }, "Замедляет."),
    P("Охотник", "🦌", 4, { dex: 2 }, "Ловкость."),
    A("Пронзающая стрела", "📍", 0, 12, 32, 3.6, "tgt", { r: 26, vfx: "arrow", c: "steel" }, "Пробивает цель."),
    A("Огненные стрелы", "🔥", 1, 18, 36, 2.2, "aoet", { rad: 5, r: 22, dot: 2, dur: 6, vfx: "rain", c: "fire" }, "Поджигает область."),
    P("Мастер охоты", "🏕️", 4, { atk: 3 }, "Урон."),
    A("Ледяная стрела", "❄️", 3, 16, 30, 2.5, "tgt", { r: 24, slow: 0.6, stun: 1.5, vfx: "arrow", c: "ice" }, "Замораживает."),
    P("Скорость ветра", "🌬️", 2, { dodge: 3 }, "Уклонение."),
    A("Шквал стрел", "🌪️", 0, 20, 42, 0.8, "tgt", { r: 24, hits: 6, vfx: "arrow", c: "wind" }, "Шесть стрел."),
    A("Взрывная стрела", "💣", 1, 20, 44, 3.2, "aoet", { rad: 6, r: 22, vfx: "nova", c: "fire" }, "Взрыв."),
    P("Зоркость", "👁️", 2, { crit: 3 }, "Крит."),
    A("Дух ветра", "🍃", 4, 45, 30, 0, "buff", { dur: 12, buff: { spd: 0.4, haste: 0.25 }, c: "wind" }, "Ветер ускоряет."),
    P("Смертельная точность", "☠️", 2, { critDmg: 8 }, "Крит урон."),
    A("Стрела Бури", "⚡", 0, 30, 62, 4.5, "aoet", { rad: 8, r: 24, vfx: "pillar", c: "bolt" }, "Громовая стрела."),
    A("Дождь сотни стрел", "🌠", 1, 36, 66, 3.5, "aoet", { rad: 9, r: 24, dot: 2, dur: 5, vfx: "rain", c: "steel" }, "Сотня стрел."),
    P("Охотник на драконов", "🐉", 2, { atk: 4 }, "Урон."),
    P("Верный глаз", "🔭", 3, { dex: 4 }, "Ловкость."),
    A("Клеймо охотника", "🎗️", 3, 28, 40, 1.2, "tgt", { r: 24, dot: 4, dur: 12, vfx: "arrow", c: "blood" }, "Клеймит жертву."),
    A("Падающая звезда", "🌟", 0, 40, 85, 9.0, "tgt", { r: 28, vfx: "arrow", c: "holy" }, "Звёздная стрела."),
    A("Ливень Небес", "☔", 1, 60, 100, 8.0, "aoet", { rad: 11, r: 24, vfx: "rain", c: "ice" }, "Небесный ливень."),
    A("Легенда лесов", "🌲", 4, 90, 60, 0, "buff", { dur: 20, buff: { atk: 0.3, crit: 25, haste: 0.25 }, c: "nature" }, "Дух леса."),
    P("Бессмертный лучник", "♾️", 2, { crit: 4 }, "Крит."),
    P("Тысяча шагов", "👟", 3, { haste: 4 }, "Скорострельность."),
  ],
  berserker: [
    A("Рубящий удар", "🪓", -1, 4, 10, 1.8, "tgt", { vfx: "cleave", c: "blood" }, "Тяжёлый удар топором."),
    A("Боевая ярость", "😡", -1, 30, 14, 0, "buff", { dur: 15, buff: { atk: 0.25, haste: 0.1 }, c: "blood" }, "Ярость повышает урон."),
    P("Дикая сила", "💪", -1, { str: 2 }, "Сила."),
    A("Прыжок ярости", "🦘", -1, 12, 14, 1.6, "dash", { r: 12, vfx: "cleave", c: "fire" }, "Прыжок к цели."),
    P("Толстая шкура", "🐻", -1, { hp: 3 }, "Здоровье."),
    A("Вихрь топора", "🌀", 0, 9, 22, 1.8, "aoe", { rad: 5, vfx: "whirl", c: "blood" }, "Кружащийся топор."),
    A("Кровавая рана", "🩸", 0, 14, 18, 1.0, "tgt", { dot: 3.5, dur: 8, vfx: "cleave", c: "blood" }, "Глубокая рана."),
    P("Жажда крови", "🦷", 1, { leech: 2 }, "Вампиризм."),
    A("Рёв", "🗣️", 3, 22, 20, 0.8, "aoe", { rad: 8, stun: 1.5, vfx: "nova", c: "fire" }, "Оглушающий рёв."),
    P("Неистовство", "🔥", 4, { atk: 2 }, "Урон."),
    A("Раскол черепа", "💀", 0, 12, 30, 3.5, "tgt", { vfx: "cleave", c: "blood" }, "Колоссальный удар."),
    A("Землетряс", "🌍", 1, 16, 34, 2.3, "aoe", { rad: 6, vfx: "quake", c: "fire" }, "Топор в землю."),
    P("Пренебрежение болью", "🩹", 4, { def: 3 }, "Защита."),
    A("Кровавая баня", "🛁", 1, 20, 36, 1.8, "aoe", { rad: 6, leech: 0.3, vfx: "whirl", c: "blood" }, "Лечит от урона."),
    P("Берсеркер", "👹", 2, { crit: 2 }, "Крит."),
    A("Мясорубка", "⚙️", 0, 22, 42, 1.0, "tgt", { hits: 5, vfx: "cleave", c: "blood" }, "Пять ударов."),
    A("Прыжок титана", "🏔️", 3, 24, 46, 3.5, "aoet", { rad: 7, stun: 2, vfx: "quake", c: "fire" }, "Приземление сокрушает."),
    P("Дикий нрав", "🐗", 2, { critDmg: 8 }, "Крит урон."),
    A("Неудержимый", "🐂", 1, 50, 36, 0, "buff", { dur: 14, buff: { atk: 0.35, spd: 0.2 }, c: "fire" }, "Нельзя остановить."),
    P("Ненасытный", "🍖", 4, { leech: 3 }, "Вампиризм."),
    A("Сокрушающий рёв", "📢", 3, 34, 60, 3.5, "aoe", { rad: 10, stun: 2.5, vfx: "nova", c: "fire" }, "Мощный рёв."),
    A("Казнь топором", "⚔️", 0, 26, 54, 6.0, "tgt", { vfx: "cleave", c: "blood" }, "Казнь."),
    P("Первобытная мощь", "🦣", 2, { str: 4 }, "Сила."),
    P("Железное тело", "🏋️", 4, { hp: 5 }, "Здоровье."),
    A("Багровый шторм", "🌪️", 1, 34, 64, 4.2, "aoe", { rad: 8, leech: 0.25, vfx: "whirl", c: "blood" }, "Шторм крови."),
    A("Рагнарёк", "☄️", 0, 60, 95, 9.0, "aoet", { rad: 10, vfx: "quake", c: "fire" }, "Конец света."),
    A("Бог войны", "🔱", 2, 100, 70, 0, "buff", { dur: 18, buff: { atk: 0.45, haste: 0.3 }, c: "gold" }, "Бог войны в вас."),
    A("Последний вздох", "🫀", 3, 120, 50, 0, "heal", { heal: 0.5, c: "blood" }, "Исцеляет 50%."),
    P("Вечная ярость", "🌋", 2, { atk: 5 }, "Урон."),
    P("Несокрушимый дух", "🦁", 4, { vit: 5 }, "Выносливость."),
  ],
  tamer: [
    A("Хлёст кнута", "🌿", -1, 3, 10, 1.5, "tgt", { r: 9, vfx: "whip", c: "nature" }, "Дальний хлёст."),
    A("Призыв спутника", "🦊", -1, 30, 20, 1.0, "summon", { dur: 60, c: "nature" }, "Верный зверь рядом."),
    P("Связь с природой", "🍀", -1, { spi: 2 }, "Дух."),
    A("Исцеляющая трава", "🌱", -1, 20, 20, 0, "heal", { heal: 0.2, c: "nature" }, "Лечит 20%."),
    P("Острый слух", "👂", -1, { crit: 2 }, "Крит."),
    A("Натиск стаи", "🐺", 1, 10, 22, 1.7, "aoe", { rad: 5, vfx: "whirl", c: "nature" }, "Стая атакует."),
    A("Опутывающие лозы", "🌿", 0, 16, 20, 0.8, "tgt", { r: 14, stun: 2, slow: 0.5, vfx: "whip", c: "nature" }, "Лозы держат."),
    P("Тропа охотника", "👣", 2, { spd: 3 }, "Скорость."),
    A("Дикий рёв", "🦁", 1, 35, 22, 0, "buff", { dur: 15, buff: { atk: 0.2, haste: 0.15 }, c: "fire" }, "Рёв зверя."),
    P("Крепкий зверь", "🐻", 3, { hp: 3 }, "Здоровье."),
    A("Укус змеи", "🐍", 1, 12, 26, 1.0, "tgt", { r: 10, dot: 4, dur: 9, vfx: "whip", c: "poison" }, "Яд змеи."),
    A("Зов волка", "🐺", 1, 45, 40, 2.0, "summon", { dur: 30, c: "wind" }, "Призыв волка."),
    P("Единение", "☯️", 0, { atk: 3 }, "Урон."),
    A("Лавина когтей", "🐾", 0, 14, 30, 1.0, "tgt", { r: 10, hits: 4, vfx: "whip", c: "blood" }, "Четыре удара."),
    P("Дух леса", "🌳", 3, { regen: 1 }, "Регенерация."),
    A("Топот стада", "🦬", 0, 22, 44, 2.6, "aoe", { rad: 7, stun: 1.5, vfx: "quake", c: "fire" }, "Стадо топчет."),
    A("Целебный цветок", "🌸", 3, 40, 40, 0, "heal", { heal: 0.35, c: "nature" }, "Лечит 35%."),
    P("Зов природы", "🍃", 2, { vit: 3 }, "Выносливость."),
    A("Яростный дух зверя", "👹", 3, 50, 36, 0, "buff", { dur: 15, buff: { atk: 0.3, spd: 0.25 }, c: "blood" }, "Дух зверя."),
    P("Мастер зверей", "🏆", 4, { dex: 3 }, "Ловкость."),
    A("Дракончик", "🐲", 1, 70, 70, 3.5, "summon", { dur: 40, c: "fire" }, "Призывает дракончика."),
    A("Гнев стаи", "💢", 0, 30, 60, 4.2, "aoet", { rad: 8, r: 14, vfx: "nova", c: "nature" }, "Стая бросается."),
    P("Альфа", "🐕", 2, { atk: 4 }, "Урон."),
    P("Дикая кровь", "🩸", 4, { leech: 3 }, "Вампиризм."),
    A("Лунный коготь", "🌙", 3, 24, 50, 5.5, "tgt", { r: 10, vfx: "whip", c: "ice" }, "Лунное лезвие."),
    A("Король зверей", "🦁", 0, 100, 95, 6.0, "summon", { dur: 45, c: "gold" }, "Призыв короля зверей."),
    A("Рёв Природы", "🌲", 1, 50, 90, 6.5, "aoe", { rad: 11, stun: 2, vfx: "nova", c: "nature" }, "Природа гневается."),
    A("Единство душ", "☀️", 2, 90, 60, 0, "buff", { dur: 20, buff: { atk: 0.3, def: 0.3, spd: 0.2 }, c: "holy" }, "Единство с природой."),
    P("Первородный", "🦴", 2, { atk: 5 }, "Урон."),
    P("Хранитель леса", "🌳", 4, { hp: 6 }, "Здоровье."),
  ],
};

function defaultVfx(cls: ClassId, kind: SkillKind): string {
  const ranged = cls === "mage" || cls === "sorcerer" || cls === "archer";
  switch (kind) {
    case "tgt": return cls === "archer" ? "arrow" : ranged ? "bolt" : "slash";
    case "aoe": return "nova";
    case "aoet": return ranged ? "rain" : "quake";
    case "dash": return "slash";
    case "heal": return "heal";
    case "buff": return "buff";
    case "shield": return "shield";
    default: return "summon";
  }
}

export const SKILLS: Record<string, SkillDef> = {};
export const SKILLS_BY_CLASS: Record<ClassId, SkillDef[]> = {} as Record<ClassId, SkillDef[]>;

(Object.keys(LINES) as ClassId[]).forEach((cls) => {
  const list: SkillDef[] = [];
  LINES[cls].forEach((row, i) => {
    const tier = Math.floor(i / 5) + 1;
    const r = i % 5;
    const id = `${cls}_${tier}_${r}`;
    const parent = row.parent >= 0 && tier > 1 ? `${cls}_${tier - 1}_${row.parent}` : undefined;
    const base = { id, cls, name: row.name, icon: row.icon, tier, row: r, reqLevel: TIER_LEVELS[tier - 1], parent, maxRank: 3, desc: row.desc };
    let s: SkillDef;
    if (row.t === "A") {
      const o = row.o;
      s = {
        ...base, type: "active", kind: row.kind, cd: row.cd, mp: row.mp, power: row.pow,
        range: o.r ?? (row.kind === "tgt" ? CLASSES[cls].basic.range : row.kind === "dash" ? 12 : 0),
        radius: o.rad ?? 0, dur: o.dur ?? 0, stun: o.stun ?? 0, slow: o.slow ?? 0, dot: o.dot ?? 0,
        heal: o.heal ?? 0, leech: o.leech ?? 0, shield: o.shield ?? 0, hits: o.hits ?? 1, buff: o.buff,
        vfx: o.vfx ?? defaultVfx(cls, row.kind), color: COLORS[o.c ?? "steel"] ?? COLORS.steel,
      };
    } else {
      s = {
        ...base, type: "passive", cd: 0, mp: 0, power: 0, range: 0, radius: 0, dur: 0, stun: 0, slow: 0, dot: 0,
        heal: 0, leech: 0, shield: 0, hits: 1, vfx: "", color: COLORS.gold, passive: row.p,
      };
    }
    SKILLS[id] = s;
    list.push(s);
  });
  SKILLS_BY_CLASS[cls] = list;
});

export function skillRankMul(rank: number) {
  return 1 + 0.15 * (Math.max(1, rank) - 1);
}

export function skillDescription(s: SkillDef, rank: number): string {
  const r = Math.max(1, rank);
  const parts: string[] = [];
  if (s.type === "passive" && s.passive) {
    const names: Record<string, string> = {
      atk: "урон %", def: "защита %", hp: "здоровье %", mp: "мана %", crit: "шанс крита %", critDmg: "урон крита %", spd: "скорость %",
      haste: "ускорение %", leech: "вампиризм %", regen: "регенерация %/с", dodge: "уклонение %", mpRegen: "восст. маны/с",
      str: "сила", dex: "ловкость", int: "интеллект", vit: "выносливость", spi: "дух",
    };
    for (const [k, v] of Object.entries(s.passive)) parts.push(`+${((v as number) * r).toFixed(k === "regen" ? 1 : 0)} ${names[k] ?? k}`);
    return `${s.desc} (${parts.join(", ")})`;
  }
  if (s.power) parts.push(`урон ×${(s.power * skillRankMul(r)).toFixed(1)}${s.hits > 1 ? ` ×${s.hits}` : ""}`);
  if (s.dot) parts.push(`DoT ×${(s.dot * skillRankMul(r)).toFixed(1)} за ${s.dur}с`);
  if (s.stun) parts.push(`оглушение ${s.stun}с`);
  if (s.slow) parts.push(`замедление ${Math.round(s.slow * 100)}%`);
  if (s.heal) parts.push(`лечение ${Math.round(s.heal * 100 * skillRankMul(r))}%`);
  if (s.shield) parts.push(`щит ${Math.round(s.shield * 100 * skillRankMul(r))}% HP`);
  if (s.leech) parts.push(`вампиризм ${Math.round(s.leech * 100)}%`);
  if (s.buff) {
    const b = s.buff;
    const bs: string[] = [];
    if (b.atk) bs.push(`урон +${Math.round(b.atk * 100)}%`);
    if (b.def) bs.push(`защита +${Math.round(b.def * 100)}%`);
    if (b.spd) bs.push(`скорость +${Math.round(b.spd * 100)}%`);
    if (b.crit) bs.push(`крит +${b.crit}%`);
    if (b.haste) bs.push(`ускорение +${Math.round(b.haste * 100)}%`);
    parts.push(`${bs.join(", ")} на ${s.dur}с`);
  }
  if (s.kind === "summon") parts.push(`призыв на ${s.dur}с`);
  if (s.radius) parts.push(`радиус ${s.radius}м`);
  return `${s.desc} (${parts.join(", ")})`;
}

// ---- стильные SVG-иконки навыков ----
import { makeIcon as __mk } from "./icons";
for (const s of Object.values(SKILLS)) s.icon = __mk(s.icon, { color: s.type === "passive" ? CLASSES[s.cls].color : s.color, tier: s.tier, passive: s.type === "passive" });
