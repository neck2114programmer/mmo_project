"use client";
import { useEffect, useRef, useState } from "react";
import { useGame, bridge, MM, type WinKey } from "@/game/store";
import { CLASSES } from "@/game/data/classes";
import { SKILLS } from "@/game/data/skills";
import { ITEMS } from "@/game/data/items";
import { QUESTS } from "@/game/data/quests";
import { ZONE_NAMES, countItem, questObjProgress, questObjTarget } from "@/game/logic";
import { xpFor } from "@/game/data/balance";
import { ZONES } from "@/game/data/zones";
import { LEVEL_CAP } from "@/game/types";
import { Ic, ItemTip, SkillTip, TipLayer, tipProps } from "./ui";
import { EventsWidget, SettingsWindow } from "./Settings";
import { DialogWindow, ShopWindow, InventoryWindow, CharacterWindow, SkillsWindow, QuestWindow, MapWindow } from "./Windows";

function useNow(ms = 100) {
  const [n, setN] = useState(0);
  useEffect(() => { const i = setInterval(() => setN(performance.now()), ms); return () => clearInterval(i); }, [ms]);
  return n;
}

const Bar = ({ cls, v, max, label, extra }: { cls: string; v: number; max: number; label?: string; extra?: number }) => (
  <div className={`bar ${cls}`}>
    {extra ? <i style={{ width: `${Math.min(100, ((v + extra) / max) * 100)}%`, background: "linear-gradient(180deg,#fff,#cfe6ff)", opacity: 0.6 }} /> : null}
    <i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    <span>{label ?? `${Math.round(v)} / ${Math.round(max)}`}</span>
  </div>
);

function PlayerFrame() {
  const { char, ps, hp, mp, derived, buffs, shield } = useGame();
  useNow(500);
  if (!char) return null;
  const c = CLASSES[char.cls];
  const need = xpFor(ps.level);
  return (
    <div style={{ position: "absolute", left: 16, top: 16, width: 330 }}>
      <div className="frame" style={{ padding: "10px 14px 10px 10px", display: "flex", gap: 12, alignItems: "center" }}>
        <div className="portrait" style={{ borderColor: c.color, boxShadow: `0 0 16px ${c.color}66` }}><Ic v={c.icon} fill /><span className="lvl-badge">{ps.level}</span></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b className="title-font" style={{ fontSize: 18, letterSpacing: "0.04em" }}>{char.name}</b>
            <span style={{ fontSize: 11, color: c.color, fontWeight: 800 }}>{c.name}</span>
          </div>
          <Bar cls="bar-hp" v={hp} max={derived.maxHp} extra={shield} label={`${Math.round(hp)} / ${derived.maxHp}${shield ? ` (+${shield})` : ""}`} />
          <Bar cls="bar-mp" v={mp} max={derived.maxMp} />
          <div className="bar bar-xp bar-thin" {...tipProps(() => <div>Опыт: {ps.xp} / {need}</div>)}><i style={{ width: `${ps.level >= LEVEL_CAP ? 100 : (ps.xp / need) * 100}%` }} /></div>
        </div>
      </div>
      {buffs.length > 0 && (
        <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
          {buffs.map((b) => (
            <div key={b.id} className="buff" style={{ borderColor: b.color }} {...tipProps(() => <div><h5><Ic v={b.icon} size="24px" /> {b.name}</h5><div>Осталось: {Math.max(0, Math.round((b.end - performance.now()) / 1000))} с</div></div>)}><Ic v={b.icon} fill /></div>
          ))}
        </div>
      )}
    </div>
  );
}

function TargetFrame() {
  const target = useGame((s) => s.target);
  const lvl = useGame((s) => s.ps.level);
  if (!target) return null;
  const hostile = target.kind === "mob";
  const diff = (target.level ?? lvl) - lvl;
  const lc = diff >= 5 ? "#ff6a6a" : diff <= -5 ? "#9aa" : "#ffe36a";
  return (
    <div style={{ position: "absolute", left: "50%", top: 16, transform: "translateX(-50%)", width: 360 }}>
      <div className="frame" style={{ padding: "8px 14px", borderColor: target.boss ? "#ffb347" : hostile ? "rgba(255,110,110,0.6)" : "rgba(143,224,255,0.6)", boxShadow: target.boss ? "0 0 26px rgba(255,170,60,0.5)" : undefined }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <b className="title-font" style={{ fontSize: 17, color: target.boss ? "#ffb347" : hostile ? "#ffd0d0" : "#bdeaff" }}>{target.boss ? "👑 " : ""}{target.name}</b>
          {target.level ? <span className="chip" style={{ color: lc, borderColor: lc }}>Ур. {target.level}</span> : target.title ? <span style={{ fontSize: 11, color: "#b8c8ff" }}>{target.title}</span> : null}
        </div>
        {hostile ? <Bar cls="bar-hp" v={target.hp} max={target.maxHp} label={`${Math.round(target.hp)} / ${target.maxHp}`} /> : <div style={{ fontSize: 11, color: "var(--muted)" }}>{target.kind === "npc" ? "Нажмите F или кликните ещё раз для разговора" : target.kind === "node" ? "Нажмите F, чтобы собрать" : "Игрок"}</div>}
      </div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const zone = useGame((s) => s.zone);
  const online = useGame((s) => s.online);
  useEffect(() => {
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      const cv = ref.current, mm = bridge.minimap, d = bridge.mm();
      if (!cv || !mm || !d) return;
      const ctx = cv.getContext("2d")!;
      const S = cv.width, R = S / 2, sc = R / 42;
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "#0a0c14"; ctx.fillRect(0, 0, S, S);
      ctx.translate(R, R); ctx.rotate(d.yaw);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mm, -(d.px + MM.span / 2) * sc, -(d.pz + MM.span / 2) * sc, MM.span * sc, MM.span * sc);
      const dot = (x: number, z: number, c: string, r: number) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc((x - d.px) * sc, (z - d.pz) * sc, r, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1; ctx.stroke(); };
      d.portals.forEach(([x, z]) => dot(x, z, "#b88aff", 6));
      d.npcs.forEach(([x, z, mk]) => dot(x, z, mk === "!" ? "#ffe36a" : mk === "?" ? "#7dff9a" : "#6ac8ff", 4));
      d.mobs.forEach(([x, z, boss]) => dot(x, z, boss ? "#ff9a2a" : "#ff4d4d", boss ? 5.5 : 3));
      d.players.forEach(([x, z]) => dot(x, z, "#7dff7d", 4));
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("С", 0, -R + 15);
      ctx.restore();
      ctx.save(); ctx.translate(R, R);
      ctx.fillStyle = "#ffe9a8"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [zone]);
  return (
    <div style={{ textAlign: "center" }}>
      <div className="minimap"><canvas ref={ref} width={176} height={176} onClick={() => useGame.getState().toggleWin("map")} style={{ cursor: "pointer" }} /></div>
      <div className="frame" style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, fontWeight: 800, display: "inline-block" }}>
        <span className="title-font" style={{ color: "var(--gold-l)", fontSize: 14 }}>{ZONE_NAMES[zone]}</span>
        <span style={{ color: "var(--muted)", marginLeft: 8 }}>👥 {online}</span>
      </div>
    </div>
  );
}

function MenuButtons() {
  const win = useGame((s) => s.win);
  const ps = useGame((s) => s.ps);
  const toggle = useGame((s) => s.toggleWin);
  const btns: [WinKey, string, string, string, number][] = [
    ["inv", "🎒", "I", "Инвентарь", 0], ["char", "🧙", "C", "Персонаж", ps.statPoints], ["skills", "📖", "K", "Навыки", ps.skillPoints],
    ["quests", "📜", "L", "Журнал заданий", 0], ["map", "🗺️", "M", "Карта", 0],
  ];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {btns.map(([k, ic, key, name, dot]) => (
        <div key={k} className={`menu-btn ${win[k] ? "on" : ""}`} onClick={() => toggle(k)} {...tipProps(() => <div><h5>{name}</h5><div className="sub">Клавиша {key}</div></div>)}>
          {ic}<kbd>{key}</kbd>{dot > 0 && <span className="dot">{dot}</span>}
        </div>
      ))}
    </div>
  );
}

function QuestTracker() {
  const ps = useGame((s) => s.ps);
  const act = Object.entries(ps.quests).filter(([, q]) => q.state !== "done").slice(0, 4);
  if (!act.length) return null;
  return (
    <div className="frame quest-track" style={{ position: "absolute", left: 16, top: 150 }}>
      <h4>Задания</h4>
      {act.map(([id, qp]) => {
        const q = QUESTS[id];
        return (
          <div key={id} className={`qt-item ${qp.state === "ready" ? "ready" : ""}`}>
            <b>{qp.state === "ready" ? "✔ " : ""}{q.name}</b>
            {qp.state === "ready" ? <div className="qt-obj done" style={{ textDecoration: "none" }}>Вернитесь к: {q.turnIn.replace(/^./, (c) => c.toUpperCase())}</div> : q.objectives.map((o, i) => {
              const cur = questObjProgress(ps, q, i), tot = questObjTarget(q, i);
              return <div key={i} className={`qt-obj ${cur >= tot ? "done" : ""}`}>• {o.label}{tot > 1 ? ` (${cur}/${tot})` : ""}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function Chat() {
  const chat = useGame((s) => s.chat);
  const [tab, setTab] = useState<"all" | "world" | "zone" | "combat" | "system">("all");
  const [text, setText] = useState("");
  const [ch, setCh] = useState<"zone" | "world">("zone");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [chat, tab]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Enter" && document.activeElement !== input.current) { e.preventDefault(); input.current?.focus(); }
      if (e.key === "/" && document.activeElement !== input.current && !(document.activeElement instanceof HTMLInputElement)) { e.preventDefault(); input.current?.focus(); setText("/"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const shown = chat.filter((m) => tab === "all" || (tab === "combat" ? ["combat", "loot", "quest"].includes(m.channel) : tab === "system" ? ["system", "quest"].includes(m.channel) : m.channel === tab));
  const send = () => { const t = text.trim(); if (t) bridge.engine?.sendChat(t, ch); setText(""); input.current?.blur(); };
  const tabs: [typeof tab, string][] = [["all", "Все"], ["world", "Мир"], ["zone", "Локация"], ["combat", "Бой"], ["system", "Система"]];
  return (
    <div className="chatbox" style={{ position: "absolute", left: 16, bottom: 16 }}>
      <div style={{ display: "flex", gap: 2, padding: "4px 6px 0", background: "rgba(0,0,0,0.35)" }}>
        {tabs.map(([k, n]) => <button key={k} className={`chat-tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      <div className="chat-log" ref={log}>
        {shown.map((m) => (
          <div key={m.id} className={`ch-${m.channel}`}>
            {m.name ? <><span style={{ opacity: 0.7 }}>[{m.channel === "world" ? "Мир" : "Лок."}]</span> <b style={{ color: "#fff" }}>{m.name}:</b> </> : null}{m.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, padding: 6, borderTop: "1px solid rgba(230,194,122,0.25)" }}>
        <button className="btn btn-sm" style={{ minWidth: 76 }} onClick={() => setCh(ch === "zone" ? "world" : "zone")}>{ch === "zone" ? "Локация" : "Мир"}</button>
        <input ref={input} className="input" style={{ padding: "6px 10px", fontSize: 13 }} placeholder="Enter — написать в чат, / — команды" value={text} maxLength={200}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") send(); if (e.key === "Escape") { setText(""); input.current?.blur(); } }} />
      </div>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
function Hotbar() {
  const { ps, cooldowns, gcdEnd, mp, char, autoAttack } = useGame();
  const now = useNow(100) || performance.now();
  if (!char) return null;
  const c = CLASSES[char.cls];
  const xpNeed = xpFor(ps.level);
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)" }}>
      <div className="frame hotbar">
        {ps.hotbar.map((id, i) => {
          let icon = "", count = 0, cdKey = id ?? "", noMp = false, tipNode: React.ReactNode = null, cdTotal = 1;
          if (id === "basic") { icon = c.basic.icon; tipNode = <div><h5>{c.basic.name}</h5><div className="sub">Базовая атака • дальность {c.basic.range} м</div><div>Бесплатная автоатака. Клик — включить автоатаку (R).</div></div>; cdTotal = c.basic.speed; }
          else if (id?.startsWith("item:")) { const it = ITEMS[id.slice(5)]; icon = it?.icon ?? ""; count = countItem(ps, id.slice(5)); cdKey = "potion"; cdTotal = 6; tipNode = it ? <ItemTip id={it.id} /> : null; }
          else if (id) { const s = SKILLS[id]; icon = s.icon; noMp = mp < s.mp; cdTotal = s.cd; tipNode = <SkillTip s={s} rank={ps.skills[id] ?? 1} />; }
          const remain = Math.max(0, ((cooldowns[cdKey] ?? 0) - now) / 1000);
          const gcd = id && id !== "basic" && !id.startsWith("item:") ? Math.max(0, (gcdEnd - now) / 1000) : 0;
          const showCd = remain > 0.05 ? remain : gcd > 0.05 ? gcd : 0;
          return (
            <div key={i} className={`slot ${id === "basic" && autoAttack ? "auto" : ""}`}
              onClick={() => bridge.engine?.useHotbar(i)}
              onContextMenu={(e) => { e.preventDefault(); if (id && id !== "basic") useGame.getState().setHotbar(i, null); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("skill:")) useGame.getState().setHotbar(i, d.slice(6)); else if (d.startsWith("item:")) useGame.getState().setHotbar(i, d); }}
              draggable={!!id && id !== "basic"} onDragStart={(e) => { if (id) e.dataTransfer.setData("text/plain", id.startsWith("item:") ? id : `skill:${id}`); }}
              {...(tipNode ? tipProps(() => tipNode) : {})}>
              <span className="key">{KEYS[i]}</span>
              <Ic v={icon} fill />
              {count > 0 && <span className="cnt">{count}</span>}
              {noMp && id && !id.startsWith("item:") && <div className="nomp" />}
              {showCd > 0 && <div className="cd" style={{ background: `linear-gradient(0deg, rgba(0,0,0,0.78) ${Math.min(100, (showCd / Math.max(0.5, cdTotal)) * 100)}%, rgba(0,0,0,0.35) 0)` }}>{showCd >= 1 ? Math.ceil(showCd) : showCd.toFixed(1)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6 }}><div className="bar bar-xp bar-thin"><i style={{ width: `${ps.level >= LEVEL_CAP ? 100 : (ps.xp / xpNeed) * 100}%` }} /></div></div>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>;
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["W A S D / стрелки", "Движение"], ["Правая кнопка мыши + движение", "Вращение камеры"], ["Колесо мыши", "Приближение камеры"], ["Левый клик", "Выбрать цель (моб, NPC, предмет)"],
    ["Tab", "Выбрать ближайшую цель"], ["1 – 0", "Навыки на панели"], ["R / двойной клик по врагу", "Автоатака"], ["F", "Говорить / собирать / взаимодействовать"],
    ["Пробел", "Прыжок"], ["I · C · K · L · M", "Инвентарь · Персонаж · Навыки · Задания · Карта"], ["Enter", "Чат (/wave /cheer /dance /sit)"], ["Esc", "Снять цель / закрыть окна"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.55)", zIndex: 30 }} onClick={onClose}>
      <div className="panel" style={{ padding: 28, width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="title-font gold-text" style={{ margin: "0 0 14px", fontSize: 30 }}>Управление</h2>
        {rows.map(([k, v]) => <div key={k} className="stat-row"><span style={{ color: "var(--gold-l)", fontWeight: 800 }}>{k}</span><span>{v}</span></div>)}
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 14 }}>Золотой «!» над NPC — доступное задание, «?» — можно сдать. Порталы на краю карты ведут в соседние локации.</p>
        <button className="btn btn-gold" style={{ marginTop: 10, width: "100%" }} onClick={onClose}>Понятно</button>
      </div>
    </div>
  );
}

export default function GameHUD() {
  const ui = useGame((s) => s.ui);
  const toggleUi = useGame((s) => s.toggleUi);
  const { win, dialog, shop, dead, loading, loadingText, interact, zone } = useGame();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === "KeyH" && !(document.activeElement instanceof HTMLInputElement)) setHelp((v) => !v); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 0); return () => clearTimeout(t); }, [zone]);
  const toggle = useGame.getState().toggleWin;
  return (
    <div className="hud no-ptr">
      <PlayerFrame />
      <TargetFrame />
      <div style={{ position: "absolute", right: 16, top: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        <MenuButtons />
        <Minimap />
      </div>
      <QuestTracker />
      <Chat />
      <Hotbar />
      <Toasts />
      {interact && <div className="interact-prompt"><kbd>F</kbd>{interact}</div>}
      {win.inv && <InventoryWindow onClose={() => toggle("inv")} />}
      {win.char && <CharacterWindow onClose={() => toggle("char")} />}
      {win.skills && <SkillsWindow onClose={() => toggle("skills")} />}
      {win.quests && <QuestWindow onClose={() => toggle("quests")} />}
      {win.map && <MapWindow onClose={() => toggle("map")} />}
      <EventsWidget />
      {ui.settings && <SettingsWindow onClose={() => toggleUi("settings")} />}
      {dialog && <DialogWindow npc={dialog} />}
      {shop && <ShopWindow npc={shop} />}
      <div style={{ position: "absolute", right: 16, bottom: 16, display: "flex", gap: 6 }}>
        <div className="menu-btn" style={{ width: 34, height: 34, fontSize: 16 }} onClick={() => setHelp(true)} {...tipProps(() => <div><h5>Помощь</h5><div className="sub">Клавиша H</div></div>)}>❓</div>
        <div className="menu-btn" style={{ width: 34, height: 34, fontSize: 16 }} onClick={() => { bridge.engine?.saveNow(); useGame.getState().toast("Игра сохранена", "good"); }} {...tipProps(() => <div><h5>Сохранить</h5><div className="sub">Автосохранение каждые 20 с</div></div>)}>💾</div>
        <div className="menu-btn" style={{ width: 34, height: 34, fontSize: 16 }} onClick={() => { bridge.engine?.saveNow(true); window.location.href = "/characters"; }} {...tipProps(() => <div><h5>Выйти к выбору героя</h5></div>)}>🚪</div>
      </div>
      {help && <HelpOverlay onClose={() => setHelp(false)} />}
      {dead && (
        <div className="death">
          <div style={{ textAlign: "center" }}>
            <div className="title-font" style={{ fontSize: 64, color: "#ff6a6a", textShadow: "0 0 40px #a00" }}>ВЫ ПОГИБЛИ</div>
            <p style={{ color: "#ffd0d0" }}>Герои не умирают навсегда. Вернитесь в бой!</p>
            <button className="btn btn-gold" style={{ padding: "14px 44px", fontSize: 18 }} onClick={() => bridge.engine?.respawn()}>ВОЗРОДИТЬСЯ</button>
          </div>
        </div>
      )}
      <div className={`loading ${loading ? "" : "hide"}`}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" />
          <div className="title-font gold-text" style={{ fontSize: 34 }}>ЭЛЬДОРИЯ</div>
          <div style={{ color: "var(--muted)", marginTop: 6 }}>{loadingText}</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{ZONES[zone]?.name}</div>
        </div>
      </div>
      <TipLayer />
    </div>
  );
}
