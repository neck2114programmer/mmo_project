"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const LoginScene = dynamic(() => import("@/components/LoginScene"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setMe(d.user?.username ?? null)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (tab === "register" && password !== password2) { setError("Пароли не совпадают"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: tab, username, password }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Ошибка"); setBusy(false); return; }
      router.push("/characters");
    } catch {
      setError("Не удалось связаться с сервером");
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setMe(null);
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <LoginScene />
      <div className="login-vignette" />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6vw", pointerEvents: "none" }}>
        <div className="fade-in" style={{ maxWidth: 560, pointerEvents: "none" }}>
          <div className="chip" style={{ marginBottom: 14, background: "rgba(0,0,0,0.45)", color: "var(--gold-l)" }}>⚔️ 3D MMORPG в браузере</div>
          <h1 className="title-font gold-text logo-glow" style={{ fontSize: "clamp(54px, 8vw, 118px)", lineHeight: 0.95, margin: 0 }}>ЭЛЬДОРИЯ</h1>
          <div className="title-font" style={{ fontSize: "clamp(18px, 2.2vw, 30px)", color: "#ffd9a0", letterSpacing: "0.34em", textShadow: "0 2px 10px #000", marginTop: 6 }}>КЛИНКИ РАССВЕТА</div>
          <p style={{ marginTop: 20, color: "#f0dcc8", fontSize: 16, lineHeight: 1.55, maxWidth: 470, textShadow: "0 2px 8px #000" }}>
            Восемь классов, три огромных мира, склеп Короля-Лича и более тридцати заданий. Выбери оружие, создай героя и защити королевство от тьмы.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {["🗡️ Воин", "🥷 Ассасин", "🔥 Маг", "🌑 Чародей", "🛡️ Щитовод", "🏹 Лучник", "🪓 Берсерк", "🐺 Приручатель"].map((c) => (
              <span key={c} className="chip" style={{ background: "rgba(0,0,0,0.5)" }}>{c}</span>
            ))}
          </div>
        </div>

        <div className="panel fade-in" style={{ width: 400, maxWidth: "92vw", pointerEvents: "auto", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
            <button className={`tab-btn ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setError(""); }}>Вход</button>
            <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => { setTab("register"); setError(""); }}>Регистрация</button>
          </div>
          <form onSubmit={submit} style={{ padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
            {me && (
              <div style={{ padding: 12, borderRadius: 10, background: "rgba(230,194,122,0.12)", border: "1px solid var(--line)", fontSize: 14 }}>
                Вы вошли как <b style={{ color: "var(--gold-l)" }}>{me}</b>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => router.push("/characters")}>Продолжить ➜</button>
                  <button type="button" className="btn btn-sm" onClick={logout}>Сменить аккаунт</button>
                </div>
              </div>
            )}
            <div>
              <label className="label">Логин</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ваше имя героя" autoComplete="username" required minLength={3} maxLength={20} />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete={tab === "login" ? "current-password" : "new-password"} required minLength={6} />
            </div>
            {tab === "register" && (
              <div>
                <label className="label">Повторите пароль</label>
                <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Ещё раз" autoComplete="new-password" required minLength={6} />
              </div>
            )}
            {error && <div style={{ color: "#ff9a9a", background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,100,100,0.4)", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <button className="btn btn-gold" style={{ padding: "14px", fontSize: 16 }} disabled={busy}>
              {busy ? "Подождите..." : tab === "login" ? "ВОЙТИ В МИР" : "СОЗДАТЬ АККАУНТ"}
            </button>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
              {tab === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              <a style={{ color: "var(--gold)", cursor: "pointer" }} onClick={() => setTab(tab === "login" ? "register" : "login")}>{tab === "login" ? "Зарегистрируйтесь" : "Войдите"}</a>
            </div>
          </form>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.45)", pointerEvents: "none" }}>
        Эльдория Онлайн • после регистрации вас ждёт создание персонажа
      </div>
    </main>
  );
}
