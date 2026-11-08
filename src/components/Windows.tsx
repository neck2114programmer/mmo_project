"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGame, bridge } from "@/game/store";
import { CLASSES } from "@/game/data/classes";
import { ITEMS, RARITY_COLORS, STAT_NAMES, itemSellPrice, vendorStock } from "@/game/data/items";
import { SKILLS_BY_CLASS, SKILLS, TIER_LEVELS } from "@/game/data/skills";
import { QUESTS, npcQuests, type QuestDef } from "@/game/data/quests";
import { NPCS } from "@/game/data/world";
import { ZONES } from "@/game/data/zones";
import { canLearn, questAvailable, questObjProgress, questObjTarget, resolveItemId, totalSkillPoints, ZONE_NAMES } from "@/game/logic";
import { xpFor } from "@/game/data/balance";
import { SLOTS, STAT_KEYS, type SlotId } from "@/game/types";
import { ItemSlot, SkillTip, Window, tipProps } from "./ui";
import { gearTier } from "@/game/data/items";

const CharacterPreview = dynamic(() => import("./CharacterPreview"), { ssr: false });

// ---------------- Инвентарь ----------------
export function InventoryWindow({ onClose }: { onClose: () => void }) {
  const { ps, shop, char } = useGame();
  const [trash, setTrash] = useState(false);
  const st = useGame.getState();
  const act = (i: number) => {
    const s = ps.inventory[i];
    if (!s) return;
    if (trash) { st.dropItem(i); return; }
    if (shop) { st.sell(i); return; }
    const it = ITEMS[s.id];
    if (it.kind === "consumable") st.useItem(s.id);
    else if (it.slot) st.equip(i);
    else st.toast("Этот предмет нельзя использовать", "info");
  };
  void char;
  return (
    <Window title="Инвентарь" onClose={onClose} style={{ right: 16, top: 150, width: 460 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#ffd24d" }}>🪙 {ps.gold.toLocaleString("ru-RU")}</span>
        <button className={`btn btn-sm ${trash ? "btn-danger" : ""}`} onClick={() => setTrash(!trash)}>{trash ? "Режим удаления: ВКЛ" : "🗑 Удалить предмет"}</button>
      </div>
      <div className="inv-grid">
        {ps.inventory.map((s, i) => (
          <ItemSlot key={i} id={s?.id} n={s?.n} onDouble={() => act(i)} onContext={() => act(i)} onClick={() => trash && act(i)} drag={s && ITEMS[s.id].kind === "consumable" ? `item:${s.id}` : undefined} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
        {shop ? <b style={{ color: "#ffd24d" }}>Режим торговли: правый клик или двойной клик по предмету — продать.</b> : "Правый клик или двойной клик — надеть / использовать. Зелья можно перетащить на панель."}
      </div>
    </Window>
  );
}

// ---------------- Персонаж ----------------
const EQ_LAYOUT: [SlotId, string][] = [["head", "🪖"], ["chest", "🛡️"], ["legs", "🦿"], ["boots", "🥾"], ["gloves", "🧤"], ["weapon", "⚔️"], ["ring", "💍"], ["amulet", "📿"]];
export function CharacterWindow({ onClose }: { onClose: () => void }) {
  const { ps, char, derived } = useGame();
  const st = useGame.getState();
  if (!char) return null;
  const c = CLASSES[char.cls];
  const eq = ps.equipment;
  const gear = { armor: eq.chest ? gearTier(eq.chest) : eq.legs ? gearTier(eq.legs) : 0, weapon: Math.max(0, gearTier(eq.weapon)), head: !!eq.head };
  const rows: [string, string | number][] = [
    ["Здоровье", derived.maxHp], ["Мана", derived.maxMp], ["Сила атаки", Math.round(derived.atk)], ["Защита", Math.round(derived.def)],
    ["Шанс крита", `${derived.crit.toFixed(1)}%`], ["Урон крита", `${derived.critDmg.toFixed(0)}%`], ["Скорость", `${Math.round(derived.speed * 100)}%`],
    ["Ускорение", `${(derived.haste * 100).toFixed(0)}%`], ["Вампиризм", `${(derived.leech * 100).toFixed(0)}%`], ["Уклонение", `${derived.dodge.toFixed(1)}%`],
    ["Регенерация маны", `${derived.mpRegen.toFixed(1)}/с`], ["Бонус сета", derived.setPieces >= 5 ? "5/5 (+12%)" : derived.setPieces >= 3 ? `${derived.setPieces}/5 (+5%)` : `${derived.setPieces}/5`],
  ];
  return (
    <Window title="Персонаж" onClose={onClose} style={{ left: 16, top: 150, width: 640, maxHeight: "calc(100vh - 170px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14 }}>
        <div>
          <div style={{ position: "relative", height: 300, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.3)", border: "1px solid var(--line)" }}>
            <CharacterPreview cls={char.cls} gender={char.gender} app={char.appearance} armorTier={gear.armor} weaponTier={gear.weapon} head={gear.head} bloom={false} showcase={false} />
            <div style={{ position: "absolute", top: 8, left: 10, pointerEvents: "none" }}>
              <div className="title-font" style={{ fontSize: 20 }}>{char.name}</div>
              <div style={{ fontSize: 12, color: c.color, fontWeight: 800 }}>{c.name} • ур. {ps.level}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10, justifyItems: "center" }}>
            {EQ_LAYOUT.map(([slot, ic]) => (
              <ItemSlot key={slot} id={eq[slot]} size={58} onContext={() => st.unequipSlot(slot)} onDouble={() => st.unequipSlot(slot)}>
                {!eq[slot] && <span style={{ opacity: 0.25, fontSize: 24 }}>{ic}</span>}
              </ItemSlot>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>Двойной клик по предмету — снять</div>
        </div>
        <div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>Опыт</span><span>{ps.xp} / {xpFor(ps.level)}</span></div>
            <div className="bar bar-xp bar-thin"><i style={{ width: `${(ps.xp / xpFor(ps.level)) * 100}%` }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>Характеристики</label>
            {ps.statPoints > 0 && <span className="chip" style={{ color: "#8fff9a", borderColor: "#8fff9a" }}>Очков: {ps.statPoints}</span>}
          </div>
          {STAT_KEYS.map((k) => (
            <div key={k} className="stat-row" {...tipProps(() => <div><h5>{STAT_NAMES[k]}</h5><div>{{ str: "Сила атаки воинов, здоровье и защита.", dex: "Атака стрелков и убийц, шанс крита и уклонение.", int: "Магическая сила, запас маны.", vit: "Здоровье и защита.", spi: "Мана и её восстановление." }[k]}</div></div>)}>
              <span>{STAT_NAMES[k]} {c.primary === k || (k === "int" && c.magic) ? "★" : ""}</span>
              <span><b>{Math.floor(derived.stats[k])}</b>{ps.statPoints > 0 && <button className="plus-btn" onClick={() => st.alloc(k)}>+</button>}</span>
            </div>
          ))}
          <label className="label" style={{ marginTop: 12 }}>Боевые показатели</label>
          {rows.map(([n, v]) => <div key={n} className="stat-row"><span>{n}</span><b>{v}</b></div>)}
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => st.respecA()}>Сбросить характеристики ({ps.level * 30} 🪙)</button>
        </div>
      </div>
    </Window>
  );
}

// ---------------- Навыки ----------------
const COL_W = 150, ROW_H = 98, X0 = 50, Y0 = 56;
export function SkillsWindow({ onClose }: { onClose: () => void }) {
  const { ps, char } = useGame();
  const st = useGame.getState();
  const list = char ? SKILLS_BY_CLASS[char.cls] : [];
  if (!char) return null;
  const c = CLASSES[char.cls];
  const pos = (s: (typeof list)[number]) => ({ x: X0 + (s.tier - 1) * COL_W, y: Y0 + s.row * ROW_H });
  const learned = Object.values(ps.skills).reduce((a, b) => a + b, 0);
  return (
    <Window title={`Древо навыков — ${c.name}`} onClose={onClose} style={{ left: "50%", top: 70, transform: "translateX(-50%)", width: 990, maxWidth: "98vw", maxHeight: "calc(100vh - 100px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="chip" style={{ fontSize: 14, color: ps.skillPoints > 0 ? "#8fff9a" : "var(--txt)", borderColor: ps.skillPoints > 0 ? "#8fff9a" : "var(--line)" }}>Очков навыков: <b>{ps.skillPoints}</b></span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Потрачено {learned} из {totalSkillPoints(ps.level)} • ЛКМ — изучить / повысить ранг (макс. 3) • Перетащите активный навык на панель</span>
        </div>
        <button className="btn btn-sm" onClick={() => st.respecS()}>Сбросить ({ps.level * 50} 🪙)</button>
      </div>
      <div style={{ position: "relative", width: X0 * 2 + 6 * COL_W - 90, height: Y0 + 5 * ROW_H, margin: "0 auto" }}>
        {TIER_LEVELS.map((lv, i) => (
          <div key={i} style={{ position: "absolute", left: X0 + i * COL_W - 26, top: 4, width: 108, textAlign: "center" }}>
            <div className="chip" style={{ fontSize: 11, color: ps.level >= lv ? "var(--gold-l)" : "var(--muted)" }}>Уровень {lv}+</div>
          </div>
        ))}
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="100%" height="100%">
          {list.filter((s) => s.parent).map((s) => {
            const p = SKILLS[s.parent!]; const a = pos(p), b = pos(s);
            const on = (ps.skills[p.id] ?? 0) > 0;
            return <path key={s.id} d={`M ${a.x + 56} ${a.y + 28} C ${a.x + 90} ${a.y + 28}, ${b.x - 34} ${b.y + 28}, ${b.x} ${b.y + 28}`} stroke={on ? "#e6c27a" : "rgba(255,255,255,0.15)"} strokeWidth={on ? 3 : 2} fill="none" />;
          })}
        </svg>
        {list.map((s) => {
          const rank = ps.skills[s.id] ?? 0;
          const can = canLearn(ps, s.id) === null;
          const locked = rank === 0 && !can;
          const p = pos(s);
          return (
            <div key={s.id} className={`skill-node ${s.type} ${rank > 0 ? "learned" : ""} ${can ? "can" : ""} ${locked ? "locked" : ""}`} style={{ left: p.x, top: p.y }}
              onClick={() => st.learn(s.id)}
              draggable={rank > 0 && s.type === "active"} onDragStart={(e) => e.dataTransfer.setData("text/plain", `skill:${s.id}`)}
              {...tipProps(() => <SkillTip s={s} rank={rank} />)}>
              {s.icon}
              <div className="rank">{Array.from({ length: s.maxRank }).map((_, i) => <i key={i} className={i < rank ? "on" : ""} />)}</div>
            </div>
          );
        })}
      </div>
    </Window>
  );
}

// ---------------- Квесты ----------------
function Rewards({ q }: { q: QuestDef }) {
  const char = useGame((s) => s.char);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <span className="chip" style={{ color: "#d0a8ff" }}>⭐ {q.reward.xp} опыта</span>
      <span className="chip" style={{ color: "#ffd24d" }}>🪙 {q.reward.gold}</span>
      {q.reward.items?.map((r, i) => { const id = char ? resolveItemId(r.id, char.cls) : r.id; return <ItemSlot key={i} id={id} n={r.n} size={40} />; })}
    </div>
  );
}
function ObjList({ q }: { q: QuestDef }) {
  const ps = useGame((s) => s.ps);
  return (
    <div style={{ marginTop: 8 }}>
      {q.objectives.map((o, i) => { const cur = questObjProgress(ps, q, i), tot = questObjTarget(q, i); return <div key={i} style={{ color: cur >= tot ? "#7dff9a" : "#d8d6e8", fontSize: 13 }}>{cur >= tot ? "✔" : "◇"} {o.label}{tot > 1 ? ` — ${cur}/${tot}` : ""}</div>; })}
    </div>
  );
}

export function QuestWindow({ onClose }: { onClose: () => void }) {
  const ps = useGame((s) => s.ps);
  const [selId, setSel] = useState<string | null>(null);
  const entries = Object.entries(ps.quests).sort((a, b) => (a[1].state === "done" ? 1 : 0) - (b[1].state === "done" ? 1 : 0));
  const cur = selId && ps.quests[selId] ? QUESTS[selId] : entries[0] ? QUESTS[entries[0][0]] : null;
  return (
    <Window title="Журнал заданий" onClose={onClose} style={{ left: "50%", top: 90, transform: "translateX(-50%)", width: 820, maxWidth: "96vw", height: 520 }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, height: "100%" }}>
        <div style={{ overflow: "auto" }}>
          {entries.length === 0 && <div style={{ color: "var(--muted)" }}>Заданий пока нет. Поговорите с NPC с золотым «!» над головой.</div>}
          {entries.map(([id, qp]) => (
            <div key={id} className="dlg-opt" style={{ borderColor: cur?.id === id ? "var(--gold)" : undefined, opacity: qp.state === "done" ? 0.55 : 1 }} onClick={() => setSel(id)}>
              <span className={`q-icon ${qp.state === "ready" ? "ready" : qp.state === "done" ? "prog" : "avail"}`}>{qp.state === "ready" ? "?" : qp.state === "done" ? "✔" : "!"}</span>
              <div><div style={{ fontSize: 14 }}>{QUESTS[id].name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{ZONE_NAMES[QUESTS[id].zone]} • ур. {QUESTS[id].level}</div></div>
            </div>
          ))}
        </div>
        <div style={{ overflow: "auto", padding: "0 6px" }}>
          {cur && (
            <>
              <h3 className="title-font gold-text" style={{ fontSize: 28, margin: "0 0 4px" }}>{cur.name}</h3>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Выдаёт: {NPCS[cur.giver]?.name} • Сдать: {NPCS[cur.turnIn]?.name}</div>
              <p style={{ lineHeight: 1.6, color: "#e0dff0" }}>{ps.quests[cur.id]?.state === "ready" ? cur.done : cur.intro}</p>
              <label className="label">Цели</label>
              <ObjList q={cur} />
              <label className="label" style={{ marginTop: 14 }}>Награда</label>
              <Rewards q={cur} />
            </>
          )}
        </div>
      </div>
    </Window>
  );
}

// ---------------- Диалог ----------------
export function DialogWindow({ npc }: { npc: string }) {
  const def = NPCS[npc];
  const ps = useGame((s) => s.ps);
  const char = useGame((s) => s.char);
  const st = useGame.getState();
  const [view, setView] = useState<string | null>(null);
  const greeting = useMemo(() => def.lines[Math.floor(Math.random() * def.lines.length)], [def]);
  if (!char) return null;
  const qs = npcQuests(npc);
  const ready = qs.filter((q) => q.turnIn === npc && ps.quests[q.id]?.state === "ready");
  const avail = qs.filter((q) => q.giver === npc && questAvailable(ps, q) && ps.level >= q.level - 3);
  const prog = qs.filter((q) => q.turnIn === npc && ps.quests[q.id]?.state === "active");
  const q = view ? QUESTS[view] : null;
  const qs_ = q ? ps.quests[q.id] : undefined;
  const c = CLASSES[def.cls];
  return (
    <div className="dialog panel">
      <div className="win-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="portrait" style={{ width: 48, height: 48, fontSize: 24, borderColor: c.color }}>{def.vendor ? "💰" : c.icon}</div>
          <div><h3 style={{ fontSize: 22 }}>{def.name}</h3><div style={{ fontSize: 12, color: "#b8c8ff" }}>{def.title}</div></div>
        </div>
        <div className="win-x" onClick={() => st.openDialog(null)}>✕</div>
      </div>
      <div style={{ padding: 18, maxHeight: "46vh", overflow: "auto" }}>
        {!q ? (
          <>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, fontStyle: "italic", color: "#f0e6d0" }}>«{greeting}»</p>
            {ready.map((x) => <div key={x.id} className="dlg-opt" onClick={() => setView(x.id)}><span className="q-icon ready">?</span>{x.name}</div>)}
            {avail.map((x) => <div key={x.id} className="dlg-opt" onClick={() => setView(x.id)}><span className="q-icon avail">!</span>{x.name} <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>ур. {x.level}</span></div>)}
            {prog.map((x) => <div key={x.id} className="dlg-opt" onClick={() => setView(x.id)}><span className="q-icon prog">…</span>{x.name}</div>)}
            {def.vendor && <div className="dlg-opt" onClick={() => useGame.setState({ shop: npc, dialog: null, win: { ...st.win, inv: true } })}><span className="q-icon">🛒</span>Посмотреть товары</div>}
            <div className="dlg-opt" onClick={() => st.openDialog(null)}><span className="q-icon">👋</span>До свидания</div>
          </>
        ) : (
          <>
            <h3 className="title-font gold-text" style={{ margin: "0 0 8px", fontSize: 26 }}>{q.name}</h3>
            <p style={{ margin: 0, lineHeight: 1.65, color: "#ece8f6" }}>{qs_?.state === "ready" ? q.done : qs_?.state === "active" ? q.progress : q.intro}</p>
            <ObjList q={q} />
            <Rewards q={q} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {!qs_ && <button className="btn btn-gold" onClick={() => { st.accept(q.id); setView(null); }}>Принять задание</button>}
              {qs_?.state === "ready" && q.turnIn === npc && <button className="btn btn-gold" onClick={() => { st.turnIn(q.id); setView(null); }}>Завершить задание</button>}
              <button className="btn" onClick={() => setView(null)}>Назад</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Магазин ----------------
export function ShopWindow({ npc }: { npc: string }) {
  const def = NPCS[npc];
  const { ps, char } = useGame();
  const st = useGame.getState();
  if (!def.vendor || !char) return null;
  const stock = vendorStock(def.vendor.kind, char.cls, def.vendor.maxTier);
  return (
    <Window title={`${def.name} — торговля`} onClose={() => useGame.setState({ shop: null })} style={{ left: 16, top: 150, width: 520, maxHeight: "calc(100vh - 200px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#ffd24d" }}>🪙 {ps.gold.toLocaleString("ru-RU")}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Чтобы продать — правый клик по предмету в инвентаре</span>
      </div>
      {stock.map((id) => {
        const it = ITEMS[id];
        const afford = ps.gold >= it.price;
        const lowLvl = ps.level < it.reqLevel;
        return (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <ItemSlot id={id} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: RARITY_COLORS[it.rarity], fontSize: 14 }}>{it.name}</div>
              <div style={{ fontSize: 11, color: lowLvl ? "#ff8a8a" : "var(--muted)" }}>{it.slot ? `Ур. ${it.reqLevel} • ` : ""}{it.atk ? `Оружие ${it.atk}` : it.armor ? `Броня ${it.armor}` : it.heal ? `+${it.heal} HP` : it.mana ? `+${it.mana} MP` : ""}</div>
            </div>
            <button className={`btn btn-sm ${afford ? "btn-gold" : ""}`} disabled={!afford} onClick={() => st.buy(id)}>{it.price} 🪙</button>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Выкуп: {ps.inventory.filter(Boolean).length ? "цена продажи указана в подсказке — 30% стоимости" : "инвентарь пуст"} {itemSellPrice("hp_s") ? "" : ""}</div>
    </Window>
  );
}

// ---------------- Карта ----------------
export function MapWindow({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const zone = useGame((s) => s.zone);
  useEffect(() => {
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return; last = t;
      const cv = ref.current, mm = bridge.minimap, d = bridge.mm();
      if (!cv || !mm || !d) return;
      const ctx = cv.getContext("2d")!;
      const S = cv.width, k = S / 200;
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(mm, 0, 0, S, S);
      const dot = (x: number, z: number, c: string, r: number) => { ctx.fillStyle = c; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc((x + 100) * k, (z + 100) * k, r, 0, 7); ctx.fill(); ctx.stroke(); };
      d.portals.forEach(([x, z]) => dot(x, z, "#b88aff", 8));
      d.npcs.forEach(([x, z, mk]) => dot(x, z, mk === "!" ? "#ffe36a" : mk === "?" ? "#7dff9a" : "#6ac8ff", 4.5));
      d.mobs.forEach(([x, z, b]) => dot(x, z, b ? "#ff9a2a" : "#ff4d4d", b ? 7 : 2.5));
      d.players.forEach(([x, z]) => dot(x, z, "#7dff7d", 5));
      ctx.save(); ctx.translate((d.px + 100) * k, (d.pz + 100) * k); ctx.rotate(-d.yaw + Math.PI);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [zone]);
  const z = ZONES[zone];
  return (
    <Window title={`Карта — ${z.name}`} onClose={onClose} style={{ left: "50%", top: 70, transform: "translateX(-50%)", width: 780, maxWidth: "98vw" }}>
      <div style={{ display: "flex", gap: 16 }}>
        <canvas ref={ref} width={560} height={560} style={{ borderRadius: 12, border: "2px solid var(--gold)", maxWidth: "100%" }} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <label className="label">Обозначения</label>
          {[["#ffe36a", "Задание (!)"], ["#7dff9a", "Сдать задание (?)"], ["#6ac8ff", "NPC / торговец"], ["#ff4d4d", "Монстр"], ["#ff9a2a", "Босс"], ["#b88aff", "Портал"], ["#7dff7d", "Другой игрок"]].map(([c, n]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "1px solid #000" }} />{n}</div>
          ))}
          <label className="label" style={{ marginTop: 14 }}>Мир Эльдории</label>
          {Object.values(ZONES).map((zz) => <div key={zz.id} className="stat-row" style={{ color: zz.id === zone ? "var(--gold-l)" : undefined }}><span>{zz.name}</span><b>{zz.levels}</b></div>)}
        </div>
      </div>
    </Window>
  );
}
void SLOTS;
