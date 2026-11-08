"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useGame } from "@/game/store";
import type { Appearance, ClassId, Gender, PlayerState } from "@/game/types";
import { sanitizeState } from "@/game/logic";
import type { GameEngine } from "@/game/engine";

const GameHUD = dynamic(() => import("@/components/GameHUD"), { ssr: false });

function GameInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = Number(params.get("char"));
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let engine: GameEngine | null = null;
    let cancelled = false;
    (async () => {
      if (!id) { router.replace("/characters"); return; }
      const r = await fetch(`/api/characters?id=${id}`);
      if (r.status === 401) { router.replace("/"); return; }
      if (!r.ok) { setError("Персонаж не найден"); return; }
      const { character } = await r.json();
      const cls = character.cls as ClassId;
      const ps = sanitizeState(character.state, cls) as PlayerState;
      if (!ps) { setError("Повреждённое сохранение"); return; }
      useGame.getState().init({ id: character.id, name: character.name, cls, gender: character.gender as Gender, appearance: character.appearance as Appearance }, ps);
      useGame.setState({ loading: true, loadingText: "Подготовка мира..." });
      setReady(true);
      await new Promise((res) => setTimeout(res, 50));
      if (cancelled || !host.current || !overlay.current) return;
      try {
        const { GameEngine } = await import("@/game/engine");
        engine = new GameEngine(host.current, overlay.current, { id: character.id, name: character.name, cls, gender: character.gender, appearance: character.appearance });
        await engine.init(ps);
        if (cancelled) engine.dispose();
      } catch (e) {
        console.error(e);
        setError("Не удалось запустить 3D-движок. Проверьте, что в браузере включено аппаратное ускорение (WebGL).");
      }
    })();
    return () => { cancelled = true; engine?.dispose(); };
  }, [id, router]);

  if (error) {
    return (
      <main style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#07060f" }}>
        <div className="panel" style={{ padding: 32, textAlign: "center", maxWidth: 480 }}>
          <h2 className="title-font" style={{ color: "#ff9a9a" }}>Ошибка</h2>
          <p>{error}</p>
          <button className="btn btn-gold" onClick={() => router.push("/characters")}>К выбору героя</button>
        </div>
      </main>
    );
  }
  return (
    <main style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      <div ref={overlay} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      {ready && <GameHUD />}
      {!ready && <div className="loading"><div style={{ textAlign: "center" }}><div className="spinner" /><div className="title-font gold-text" style={{ fontSize: 32 }}>ЭЛЬДОРИЯ</div></div></div>}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <GameInner />
    </Suspense>
  );
}
