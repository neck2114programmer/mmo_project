"use client";
import type { MouseEvent, ReactNode } from "react";
import { create } from "zustand";
import { ITEMS, RARITY_COLORS, RARITY_NAMES, SLOT_NAMES, STAT_NAMES } from "@/game/data/items";
import { CLASSES } from "@/game/data/classes";
import { SKILLS, skillDescription, type SkillDef } from "@/game/data/skills";
import { STAT_KEYS } from "@/game/types";
import { useGame } from "@/game/store";

export const useTip = create<{ node: ReactNode | null; x: number; y: number }>(() => ({ node: null, x: 0, y: 0 }));

export const tipProps = (node: () => ReactNode) => ({
  onMouseEnter: (e: MouseEvent) => useTip.setState({ node: node(), x: e.clientX, y: e.clientY }),
  onMouseMove: (e: MouseEvent) => useTip.setState({ x: e.clientX, y: e.clientY }),
  onMouseLeave: () => useTip.setState({ node: null }),
});

export function TipLayer() {
  const { node, x, y } = useTip();
  if (!node) return null;
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = x + 320 > w ? x - 316 : x + 16;
  const top = Math.min(y + 14, h - 280);
  return <div className="tip" style={{ left, top }}>{node}</div>;
}

export function ItemTip({ id, n }: { id: string; n?: number }) {
  const it = ITEMS[id];
  const ps = useGame((s) => s.ps);
  const char = useGame((s) => s.char);
  if (!it) return null;
  const color = RARITY_COLORS[it.rarity];
  const classBad = it.cls && char && it.cls !== char.cls;
  const lvlBad = ps.level < it.reqLevel;
  const cur = it.slot ? ITEMS[ps.equipment[it.slot] ?? ""] : undefined;
  return (
    <div>
      <h5 style={{ color }}>{it.name}{n && n > 1 ? ` ×${n}` : ""}</h5>
      <div className="sub">{RARITY_NAMES[it.rarity]} • {it.slot ? SLOT_NAMES[it.slot] : it.kind === "consumable" ? "Расходуемый" : it.kind === "material" ? "Материал" : "Предмет задания"}</div>
      {it.cls && <div className={classBad ? "bad" : ""} style={{ fontSize: 12 }}>Класс: {CLASSES[it.cls].name}</div>}
      {it.slot && <div className={lvlBad ? "bad" : ""} style={{ fontSize: 12 }}>Требуется уровень: {it.reqLevel}</div>}
      {it.atk ? <div style={{ color: "#ffd88a" }}>Сила оружия: <b>{it.atk}</b>{cur?.atk ? <span style={{ color: it.atk >= cur.atk ? "#8fff9a" : "#ff8a8a" }}> ({it.atk >= cur.atk ? "+" : ""}{it.atk - cur.atk})</span> : null}</div> : null}
      {it.armor ? <div style={{ color: "#bcd8ff" }}>Броня: <b>{it.armor}</b>{cur?.armor ? <span style={{ color: it.armor >= cur.armor ? "#8fff9a" : "#ff8a8a" }}> ({it.armor >= cur.armor ? "+" : ""}{(it.armor - cur.armor).toFixed(1)})</span> : null}</div> : null}
      {STAT_KEYS.filter((k) => it.stats[k]).map((k) => <div key={k} className="st">+{it.stats[k]} {STAT_NAMES[k]}</div>)}
      {it.heal ? <div className="st">Восстанавливает {it.heal} здоровья</div> : null}
      {it.mana ? <div style={{ color: "#8fc0ff" }}>Восстанавливает {it.mana} маны</div> : null}
      {it.setName && <div style={{ color: "#ffd24d", fontSize: 11.5, marginTop: 4 }}>Сет «{it.setName}»: 3 части +5% урон/защита, 5 частей +12% и +5% здоровья</div>}
      <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 4 }}>{it.desc}</div>
      {it.price > 0 && <div style={{ color: "#ffd24d", marginTop: 4 }}>Цена: {it.price} 🪙</div>}
    </div>
  );
}

export function SkillTip({ s, rank }: { s: SkillDef; rank: number }) {
  const parent = s.parent ? SKILLS[s.parent] : null;
  return (
    <div>
      <h5 style={{ color: s.type === "passive" ? "#9dd8ff" : "#ffd88a", display: "flex", alignItems: "center", gap: 6 }}><Ic v={s.icon} size="28px" /> {s.name}</h5>
      <div className="sub">{s.type === "passive" ? "Пассивный навык" : "Активный навык"} • Требуется ур. {s.reqLevel} • Ранг {rank}/{s.maxRank}</div>
      <div>{skillDescription(s, Math.max(1, rank))}</div>
      {rank > 0 && rank < s.maxRank && <div style={{ color: "#8fff9a", marginTop: 4 }}>След. ранг: {skillDescription(s, rank + 1).split("(")[1]?.replace(")", "")}</div>}
      {s.type === "active" && <div style={{ marginTop: 4, color: "#bcd8ff" }}>💧 {s.mp} маны • ⏱ {s.cd} с{s.range ? ` • 📏 ${s.range} м` : ""}</div>}
      {parent && <div style={{ marginTop: 4, color: "var(--muted)" }}>Требует: {parent.name}</div>}
    </div>
  );
}

export function ItemSlot({
  id, n, onClick, onContext, onDouble, drag, size, className = "", children,
}: { id?: string | null; n?: number; onClick?: () => void; onContext?: () => void; onDouble?: () => void; drag?: string; size?: number; className?: string; children?: ReactNode }) {
  const it = id ? ITEMS[id] : undefined;
  return (
    <div
      className={`islot ${it ? `r${it.rarity}` : "empty"} ${className}`}
      style={size ? { width: size, height: size } : undefined}
      onClick={onClick}
      onDoubleClick={onDouble}
      onContextMenu={(e) => { e.preventDefault(); onContext?.(); }}
      draggable={!!(it && drag)}
      onDragStart={(e) => { if (drag) e.dataTransfer.setData("text/plain", drag); }}
      {...(it ? tipProps(() => <ItemTip id={it.id} n={n} />) : {})}
    >
      {it ? it.icon : null}
      {n && n > 1 ? <span className="n">{n}</span> : null}
      {children}
    </div>
  );
}

export function Window({ title, onClose, style, children }: { title: string; onClose: () => void; style?: React.CSSProperties; children: ReactNode }) {
  return (
    <div className="win panel" style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="win-head"><h3>{title}</h3><div className="win-x" onClick={onClose}>✕</div></div>
      <div className="win-body">{children}</div>
    </div>
  );
}

/** Иконка: SVG data-URL (навыки, классы) или обычный текст/эмодзи (предметы) */
export function Ic({ v, fill, size }: { v: string; fill?: boolean; size?: string }) {
  if (!v?.startsWith("data:")) return <>{v}</>;
  return <img src={v} alt="" draggable={false} className={fill ? "ic-fill" : "ic-inline"} style={size ? { width: size, height: size } : undefined} />;
}
