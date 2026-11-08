"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CharacterModel, type ActionKind } from "@/game/render/character";
import { CLASSES } from "@/game/data/classes";
import { glowTexture } from "@/game/render/util";
import type { Appearance, ClassId, Gender } from "@/game/types";

export interface PreviewProps {
  cls: ClassId; gender: Gender; app: Appearance; armorTier?: number; weaponTier?: number; head?: boolean;
  focus?: "body" | "face"; anim?: "idle" | "run" | "attack"; autoSpin?: boolean; bloom?: boolean; showcase?: boolean;
}

class Preview {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); composer?: EffectComposer;
  model?: CharacterModel; pivot = new THREE.Group(); raf = 0; clock = new THREE.Clock(); t = 0; props!: PreviewProps; dirty = true; lastBuild = 0;
  yaw = 0.35; drag = false; lastX = 0; zoom = 1; actT = 2; ro: ResizeObserver; ring: THREE.Mesh; camPos = new THREE.Vector3(0, 1.2, 4.6); camLook = new THREE.Vector3(0, 1.0, 0);
  cleanup: (() => void)[] = [];

  constructor(private el: HTMLElement, props: PreviewProps) {
    this.props = props;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cursor = "grab";
    const w = el.clientWidth || 400, h = el.clientHeight || 500;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (props.bloom !== false) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.28, 0.6, 0.9));
      this.composer.addPass(new OutputPass());
    }
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight("#cfd8ff", "#3a2a40", 0.9));
    const key = new THREE.DirectionalLight("#fff0dc", 3.0); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1; key.shadow.bias = -0.0008;
    sc.add(key);
    const rim = new THREE.DirectionalLight("#6aa8ff", 2.4); rim.position.set(-4, 3, -3); sc.add(rim);
    const rim2 = new THREE.DirectionalLight("#ff9a60", 1.8); rim2.position.set(4, 2, -4); sc.add(rim2);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: "#1b1d30", roughness: 0.55, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: "#e6c27a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.01; sc.add(this.ring);
    const ring2 = this.ring.clone(); ring2.geometry = new THREE.TorusGeometry(1.7, 0.012, 8, 64); sc.add(ring2);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("#ffffff"), color: "#6a7cff", transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(7, 7, 1); glow.position.set(0, 1.2, -2); sc.add(glow);
    // частицы
    const n = 80, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 5; pos[i * 3 + 1] = Math.random() * 3.5; pos[i * 3 + 2] = (Math.random() - 0.5) * 5; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffe9a8", size: 0.06, map: glowTexture("#ffffff"), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    sc.add(pts);
    (this as unknown as { pts: THREE.Points }).pts = pts;
    sc.add(this.pivot);
    const dom = this.renderer.domElement;
    const pd = (e: PointerEvent) => { this.drag = true; this.lastX = e.clientX; dom.setPointerCapture(e.pointerId); dom.style.cursor = "grabbing"; };
    const pm = (e: PointerEvent) => { if (this.drag) { this.yaw += (e.clientX - this.lastX) * 0.01; this.lastX = e.clientX; } };
    const pu = () => { this.drag = false; dom.style.cursor = "grab"; };
    const wh = (e: WheelEvent) => { e.preventDefault(); this.zoom = Math.min(1.5, Math.max(0.55, this.zoom + e.deltaY * 0.001)); };
    dom.addEventListener("pointerdown", pd); dom.addEventListener("pointermove", pm); dom.addEventListener("pointerup", pu); dom.addEventListener("wheel", wh, { passive: false });
    this.cleanup.push(() => { dom.removeEventListener("pointerdown", pd); dom.removeEventListener("pointermove", pm); dom.removeEventListener("pointerup", pu); dom.removeEventListener("wheel", wh); });
    this.ro = new ResizeObserver(() => { const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return; this.renderer.setSize(W, H); this.composer?.setSize(W, H); this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); });
    this.ro.observe(el);
    this.loop();
  }

  key = "";
  set(props: PreviewProps) {
    this.props = props;
    const k = JSON.stringify([props.cls, props.gender, props.app, props.armorTier, props.weaponTier, props.head]);
    if (k !== this.key) { this.key = k; this.dirty = true; }
  }

  build() {
    const p = this.props;
    if (this.model) { this.pivot.remove(this.model.group); this.model.dispose(); }
    this.model = new CharacterModel({ cls: p.cls, gender: p.gender, app: p.app, armorTier: p.armorTier ?? 1, weaponTier: p.weaponTier ?? 1, head: p.head });
    this.pivot.add(this.model.group);
    this.model.group.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
    this.dirty = false; this.lastBuild = performance.now();
  }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (this.dirty && performance.now() - this.lastBuild > 60) this.build();
    const p = this.props;
    if (this.model) {
      const m = this.model;
      m.setSpeed(p.anim === "run" ? 1 : 0);
      this.actT -= dt;
      if (p.anim === "attack" || (p.showcase !== false && p.anim !== "run" && this.actT < 0)) {
        if (this.actT < 0 && !m.acting) { const st = CLASSES[p.cls].style; m.play((st === "slash" ? "slash" : st === "stab" ? "stab" : st === "cast" ? "cast" : st === "shoot" ? "shoot" : st === "bash" ? "bash" : "whip") as ActionKind, 0.9); this.actT = p.anim === "attack" ? 1.4 : 5; }
      }
      m.update(dt);
    }
    if (p.autoSpin !== false && !this.drag) this.yaw += dt * 0.35;
    this.pivot.rotation.y = this.yaw;
    const h = this.model?.heightScale ?? 1;
    const face = p.focus === "face";
    const tp = face ? new THREE.Vector3(0, 1.62 * h, 1.45 * this.zoom) : new THREE.Vector3(0, 1.15 * h, 4.7 * this.zoom * (0.95 + h * 0.05));
    const tl = face ? new THREE.Vector3(0, 1.64 * h, 0) : new THREE.Vector3(0, 0.98 * h, 0);
    this.camPos.lerp(tp, 1 - Math.exp(-dt * 5)); this.camLook.lerp(tl, 1 - Math.exp(-dt * 5));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.ring.rotation.z = this.t * 0.5;
    const pts = (this as unknown as { pts: THREE.Points }).pts;
    const a = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.25; if (y > 3.6) y = 0; a.setY(i, y); }
    a.needsUpdate = true;
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.ro.disconnect();
    this.model?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export default function CharacterPreview(props: PreviewProps & { className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const pv = useRef<Preview | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    pv.current = new Preview(ref.current, props);
    return () => { pv.current?.dispose(); pv.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { pv.current?.set(props); });
  return <div ref={ref} className={props.className} style={{ width: "100%", height: "100%", ...props.style }} />;
}
