"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// TODO: восстанавливается отдельным файлом (в бандле — `fl`)
import SplitText from "@/components/SplitText";
import { CharacterText, AbilitiesText } from "@/components/CharacterText";
// TODO: восстанавливается отдельным файлом (в бандле — `kE`), принимает { delay?, fade, rise }
import AboutPanel from "@/components/Gallery";

const MODEL_URL = "models/character.glb";

// Макет Figma 1920x1080
const DESIGN_W = 1920;
const DESIGN_H = 1080;

type ExperienceRow = {
  /** y строки в координатах макета */
  y: number;
  /** высота хит-зоны строки */
  h: number;
  sign: string;
  /** позиция/размер «подписи-автографа» в координатах макета */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  date: string;
  company: string;
  role: string;
  desc: string;
};

const EXPERIENCE: ExperienceRow[] = [
  {
    y: 220,
    h: 173,
    sign: "sign-freelance.svg",
    sx: 1075.6,
    sy: 262.99,
    sw: 18.8,
    sh: 18.8,
    date: "Oct 2025 — Present",
    company: "FREELANCE",
    role: "SENIOR GRAPHIC & BRAND DESIGNER",
    desc: "Brand identity and marketing materials for fintech and consumer startups. Design systems and AI-powered production workflows.",
  },
  {
    y: 393,
    h: 153,
    sign: "sign-4dev.svg",
    sx: 1075.47,
    sy: 435.8,
    sw: 19.06,
    sh: 20.41,
    date: "Aug — Oct 2025",
    company: "4DEV.COM",
    role: "SENIOR COMMUNICATION DESIGNER",
    desc: "Visual content for a financial platform: presentations, ad campaigns and landing pages.",
  },
  {
    y: 546,
    h: 151,
    sign: "sign-yandex.svg",
    sx: 1072.92,
    sy: 588.93,
    sw: 24.17,
    sh: 20.14,
    date: "Jul 2021 — Apr 2025",
    company: "YANDEX",
    role: "COMMUNICATION DESIGNER",
    desc: "Content for Yandex Market platform. 12 000+ banners, 800 icons, 100+ landings and brand zones, coped with significant pressure of deadlines.",
  },
  {
    y: 697,
    h: 143,
    sign: "sign-ridero.svg",
    sx: 1074.93,
    sy: 739.93,
    sw: 20.14,
    sh: 20.14,
    date: "Oct 2017 — Jun 2021",
    company: "RIDERO",
    role: "GRAPHIC DESIGNER",
    desc: "200+ original book covers and hundreds of illustrations. Font library of 300+ fonts for covers and text.",
  },
  {
    y: 840,
    h: 132,
    sign: "sign-folio.svg",
    sx: 1074.93,
    sy: 882.93,
    sw: 20.14,
    sh: 20.14,
    date: "Nov 2013 — Aug 2017",
    company: "STUDIO FOLIO",
    role: "GRAPHIC DESIGNER",
    desc: "100+ premium photobooks, 30 000+ retouched photos. Studio earnings more than doubled.",
  },
];

/** Метрики типографики строк опыта в координатах макета 1920 */
const TYPO = {
  date: { x: 897.6, dy: 49.4, size: 15, weight: 200, ls: 0, lh: 18 },
  company: { x: 1116.6, dy: 43.5, size: 23, weight: 700, ls: 0.7, lh: 26 },
  role: { x: 1116.6, dy: 77.9, size: 12, weight: 300, ls: 1.73, lh: 14 },
  desc: {
    x: 1435.3,
    dy: 47.8,
    size: 15,
    weight: 300,
    ls: 0,
    lh: 22.5,
    w: 352,
  },
};

/* ─────────────────── раскладка экрана Maks Novikov ──────────────────────
   Три колонки из макета 1542:1120. Колонка персонажа фиксирована, поэтому
   её кегль не меняется; колонка способностей поджимается совсем немного;
   3d-модель зажимается первой и при нехватке места уезжает вниз. */
const STAGE_MAX = 1920;
const STAGE_H = 1080;
const STAGE_LEFT = 112;
const CHAR_W = 709;
const ABIL_W = 460;
const ABIL_MIN = 410;
const D3_W = 660;
const D3_MIN = 420;
/** кадр, в котором нарисованы колонки */
const FRAME_H = 1080;

/** карточки способностей: y внутри кадра колонки, высота одинаковая */
const CARD_H = 126;
const ABILITY_CARDS = [
  { label: "Pet the cat", y: 567 },
  { label: "Battle cry", y: 714 },
  { label: "Cup of coffee", y: 861 },
];

/** ниже этой ширины 3d уходит под панель отдельным блоком */
const STACK_AT = STAGE_LEFT + CHAR_W + ABIL_MIN + D3_MIN;
/** ниже этой — колонка способностей не помещается рядом с персонажем */
const NARROW_AT = STAGE_LEFT + CHAR_W + ABIL_MIN;

/* Раскладка «в ряд» или «3d уезжает вниз» — один и тот же порог нужен
   и галерее на главной, поэтому держим его отдельной функцией. */
export function isWideLayout(w: number, h: number) {
  const kH = Math.min(1, h / STAGE_H);
  return Math.min(STAGE_MAX, w / kH) >= STACK_AT;
}

/** ниже этой ширины окна панно фотографий точно не показываем */
const PANEL_MIN_W = 1600;

/** true, пока три колонки стоят в ряд; false — когда 3d уходит вниз.
    Широкое окно (от 1600 px) считаем «в ряд» в любом случае: при очень
    высоком окне формула выше срабатывала бы и на большом мониторе. */
export function useWideLayout() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const measure = () =>
      setWide(
        window.innerWidth >= PANEL_MIN_W ||
          isWideLayout(window.innerWidth, window.innerHeight),
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return wide;
}

/** таблица опыта: от левого края колонки способностей до охранного поля */
const WORK_LEFT = STAGE_LEFT + CHAR_W;
/** левый край кнопок special abilities внутри колонки 460 */
const ABIL_CARD_X = 20;
/** охранное поле справа — то же, что у контента hero */
const GUARD_RIGHT = 120;
const WORK_RULE = "rgba(255,255,255,0.18)";
const WORK = {
  titleTop: 118,
  titleSize: 52,
  titleLs: 2.63,
  tableTop: 66,
  rowH: 153,
  padTop: 44,
  gap: 40,
  dateW: 200,
  nameW: 320,
  roleGap: 8,
};

const ROW_X = 897;
const ROW_W = 892;
/** слабая заливка строки по наведению — как в таблице фактов на about me */
const ROW_HOVER = "rgba(255,255,255,0.02)";

/** Насколько (в % высоты) блок опыта «выезжает» снизу */
const RISE_VH = 170;
/** Пауза скролла до подъёма и после него */
const HOLD_BEFORE = 65;
const HOLD_AFTER = 65;
const RAIL_VH = HOLD_BEFORE + RISE_VH + HOLD_AFTER;
const RISE_START = HOLD_BEFORE / RAIL_VH;
const RISE_END = (HOLD_BEFORE + RISE_VH) / RAIL_VH;

const POSTER_SRC = "character-poster.jpg";

/** Максимальный поворот персонажа за курсором */
const MAX_YAW = THREE.MathUtils.degToRad(40);

type Status = "loading" | "ready" | "fallback";

/** Кадр персонажа: графика без текста плюс текстовый слой поверх неё */
function CharacterFrame() {
  return (
    <>
      <img
        src="char-art.svg"
        alt=""
        aria-hidden
        className="block"
        style={{ width: CHAR_W, height: STAGE_H }}
      />
      <CharacterText />
    </>
  );
}

/** Канва three.js с запасным постером и индикатором загрузки */
function Scene3d({
  hostRef,
  status,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  status: Status;
}) {
  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      {status === "fallback" && (
        <img
          src={POSTER_SRC}
          alt="3D-модель персонажа"
          className="absolute inset-0 m-auto h-[88%] w-auto object-contain"
        />
      )}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm tracking-[0.2em] text-white/40 transition-opacity duration-700 ${status === "loading" ? "opacity-100" : "opacity-0"}`}
      >
        LOADING
      </div>
    </div>
  );
}



export default function CharacterExperience() {
  const hostRef = useRef<HTMLDivElement>(null);
  /* канва живёт одна на все раскладки — при смене режима её переносим */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<{ rebind: (host: HTMLDivElement) => void } | null>(
    null,
  );
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const host = hostRef.current!;
    let visible = false;
    /* При смене раскладки канва переезжает в другой контейнер. Все привязки
       к элементу (размер, видимость, курсор) должны переехать вместе с ней,
       иначе сцена остаётся «невидимой» и перестаёт слушать мышь. */
    let activeHost: HTMLDivElement = host;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setStatus("fallback");
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0, 0);
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    canvasRef.current = renderer.domElement;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x031828, 12, 30);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const CAM = { y: 1.85, z: 7.2, lookY: 1.62 };
    camera.position.set(0, CAM.y, CAM.z);
    camera.lookAt(0, CAM.lookY, 0);

    // Собственное студийное окружение из светящихся плоскостей → PMREM
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1b1f28);

    const addEnvPanel = (
      color: number,
      intensity: number,
      position: [number, number, number],
      size: [number, number],
    ) => {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        material,
      );
      panel.position.set(...position);
      panel.lookAt(0, 0, 0);
      envScene.add(panel);
    };

    addEnvPanel(0xdfe6f5, 1.25, [-3, 5, 6], [12, 8]);
    addEnvPanel(0x8d97ad, 0.55, [6, 2, 3], [8, 10]);
    addEnvPanel(0x6e4a9c, 0.45, [-6, 1, -2], [7, 10]);
    addEnvPanel(0x2a3342, 0.7, [0, 2, -7], [14, 10]);
    addEnvPanel(0x1a1e26, 1, [0, -4, 0], [22, 22]);

    const envRT = pmrem.fromScene(envScene, 0.12);
    scene.environment = envRT.texture;
    scene.add(new THREE.HemisphereLight(0x8e99b5, 0x0b0d12, 0.24));

    const keyLight = new THREE.DirectionalLight(0xdde5f5, 3.6);
    keyLight.position.set(-2.2, 6, 4.6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x5d6a82, 0.45);
    fillLight.position.set(4, 2.5, 2);
    scene.add(fillLight);

    const accentLight = new THREE.PointLight(0xb91372, 9.2, 13, 1.5);
    accentLight.position.set(-3.3, 2.6, -0.2);
    scene.add(accentLight);

    const coolLight = new THREE.PointLight(0x4f6b93, 1.2, 13, 1.4);
    coolLight.position.set(3.2, 2, 0.4);
    scene.add(coolLight);

    const gridMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCell: { value: 1.25 },
        uFade: { value: 16 },
        uAngle: { value: THREE.MathUtils.degToRad(0) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){ vPos = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vPos,1.0); }`,
      fragmentShader: `
        uniform float uCell; uniform float uFade; uniform float uAngle;
        varying vec3 vPos;
        void main(){
          // сетка повёрнута относительно камеры — линии уходят в перспективу по диагонали
          float ca = cos(uAngle), sa = sin(uAngle);
          vec2 p = mat2(ca, -sa, sa, ca) * vPos.xz;
          vec2 c = p / uCell;
          vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          // яркие «плюсики» на пересечениях
          vec2 d = abs(fract(c - 0.5) - 0.5);
          float cross = (1.0 - smoothstep(0.0, 0.012, min(d.x, d.y))) * (1.0 - smoothstep(0.03, 0.09, max(d.x, d.y)));
          float fade = 1.0 - smoothstep(uFade * 0.25, uFade, length(vPos.xz));
          float a = (line * 0.18 + cross * 0.85) * fade;
          gl_FragColor = vec4(vec3(0.82, 0.84, 0.95), a);
        }`,
    });
    const gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      gridMaterial,
    );
    gridMesh.rotation.x = -Math.PI / 2;
    scene.add(gridMesh);

    // Мягкая «тень» под персонажем — радиальный градиент на canvas
    const shadowTexture = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(0,0,0,0.75)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(canvas);
    })();

    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.002;
    scene.add(shadowMesh);

    const modelPivot = new THREE.Group();
    scene.add(modelPivot);

    const modelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x30353f,
      metalness: 0.18,
      roughness: 0.5,
      flatShading: true,
      clearcoat: 0.25,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.95,
      side: THREE.DoubleSide,
    });

    let disposed = false;

    const onModelLoaded = (gltf: GLTF) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          // flatShading требует неиндексированной геометрии
          if (mesh.geometry.index) mesh.geometry = mesh.geometry.toNonIndexed();
          mesh.geometry.computeVertexNormals();
          mesh.material = modelMaterial;
        }
      });
      model.rotation.y += Math.PI + THREE.MathUtils.degToRad(15);

      // нормируем рост персонажа к 3.12 юнита
      const scaleFactor =
        3.12 /
        new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      model.scale.multiplyScalar(scaleFactor);

      // центрируем по XZ и ставим на «пол»
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;

      modelPivot.add(model);
      setStatus("ready");
      needsRender = true;
    };

    const onModelError = (error: unknown) => {
      console.warn("ModelShowcase: model failed to load", error);
      if (!disposed) setStatus("fallback");
    };

    const loader = new GLTFLoader();
    if (MODEL_URL.startsWith("data:")) {
      // модель может быть вшита в бандл как data-URI
      try {
        const binary = atob(MODEL_URL.slice(MODEL_URL.indexOf(",") + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        loader.parse(bytes.buffer, "", onModelLoaded, onModelError);
      } catch (error) {
        onModelError(error);
      }
    } else {
      loader.load(MODEL_URL, onModelLoaded, undefined, onModelError);
    }

    const resize = () => {
      const width = activeHost.clientWidth;
      const height = activeHost.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // на узких/высоких контейнерах отодвигаем камеру
      const zoomOut = width / height < 0.8 ? 1.12 : 1;
      camera.position.set(0, CAM.y, CAM.z * zoomOut);
      camera.lookAt(0, CAM.lookY, 0);
      camera.updateProjectionMatrix();
      needsRender = true;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    let targetYaw = 0;
    let currentYaw = 0;
    let pointerActive = false;

    const onPointerMove = (event: PointerEvent) => {
      const rect = activeHost.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientY > rect.bottom) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetYaw = THREE.MathUtils.clamp(nx, -1, 1) * MAX_YAW;
      pointerActive = true;
    };
    const onPointerLeave = () => {
      targetYaw = 0;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);

    let rafId = 0;
    let needsRender = true;

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersectionObserver.observe(host);

    /** переносит канву и все привязки в новый контейнер */
    const rebind = (next: HTMLDivElement) => {
      if (next === activeHost) {
        resize();
        return;
      }
      resizeObserver.unobserve(activeHost);
      intersectionObserver.unobserve(activeHost);
      activeHost.removeEventListener("pointerleave", onPointerLeave);
      activeHost = next;
      next.appendChild(renderer.domElement);
      next.addEventListener("pointerleave", onPointerLeave);
      resizeObserver.observe(next);
      intersectionObserver.observe(next);
      visible = true;
      resize();
    };
    sceneRef.current = { rebind };

    const startTime = performance.now();
    let lastTime = startTime;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!visible) return;
      const now = performance.now();
      const elapsed = (now - startTime) / 1e3;
      const delta = Math.min(0.1, (now - lastTime) / 1e3);
      lastTime = now;

      // до первого движения мыши персонаж медленно качается сам
      const idleYaw =
        !pointerActive && !prefersReducedMotion
          ? Math.sin(elapsed * 0.5) * MAX_YAW * 0.6
          : 0;
      const desiredYaw = pointerActive ? targetYaw : idleYaw;
      const prevYaw = currentYaw;
      currentYaw +=
        (desiredYaw - currentYaw) *
        (prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 4));
      modelPivot.rotation.y = currentYaw;

      if (!prefersReducedMotion) {
        accentLight.intensity = 9.2 + Math.sin(elapsed * 0.6) * 1.3;
        coolLight.intensity = 1.2 + Math.cos(elapsed * 0.5) * 0.25;
      }

      if (
        Math.abs(currentYaw - prevYaw) > 1e-5 ||
        !prefersReducedMotion ||
        needsRender
      ) {
        renderer.render(scene, camera);
        needsRender = false;
      }
    };

    resize();
    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      activeHost.removeEventListener("pointerleave", onPointerLeave);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const [hovered, setHovered] = useState<number | null>(null);
  const [cardHover, setCardHover] = useState<number | null>(null);

  /* размер окна решает и масштаб сцены, и то, помещаются ли колонки в ряд */
  const [win, setWin] = useState(() => ({
    w: typeof window === "undefined" ? STAGE_MAX : window.innerWidth,
    h: typeof window === "undefined" ? STAGE_H : window.innerHeight,
  }));
  useEffect(() => {
    const measure = () =>
      setWin({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const vw = win.w;
  /* Сцена нарисована в кадре 1920×1080 и целиком вписывается в окно:
     сначала берём масштаб по высоте, в этом масштабе раскладываем колонки,
     потом при необходимости дожимаем по ширине. Ничего не обрезается. */
  const kH = Math.min(1, win.h / STAGE_H);
  /* ширина окна в координатах макета */
  const designW = Math.min(STAGE_MAX, win.w / kH);
  const wide = designW >= STACK_AT;
  const narrow = designW < NARROW_AT;
  const stage = !narrow;
  /* свободное место после фиксированной колонки персонажа делим так:
     сначала до предела зажимается 3d, потом — колонка способностей */
  const free = designW - STAGE_LEFT - CHAR_W;
  const abilW = Math.max(ABIL_MIN, Math.min(ABIL_W, free - D3_MIN));
  const d3W = Math.max(D3_MIN, Math.min(D3_W, wide ? free - abilW : 0));
  /* ширина сцены в координатах макета и итоговый масштаб */
  const stageW = Math.max(
    STAGE_LEFT + CHAR_W + abilW + (wide ? d3W : 0),
    designW,
  );
  const k = Math.min(kH, win.w / stageW);
  /* в узком режиме кадр персонажа ужимается целиком — вместе с текстом */
  const charScale = Math.min(1, (win.w - 40) / CHAR_W);
  /* таблица опыта начинается по левому краю кнопок special abilities
     и занимает обе правые колонки минус охранное поле справа */
  const workLeft = WORK_LEFT + ABIL_CARD_X * (abilW / ABIL_W);
  const workW = Math.max(280, stageW - workLeft - GUARD_RIGHT);
  /* когда справа остаётся мало места, строка опыта складывается в столбик */
  const compact = workW < 780;

  /* при смене раскладки хост канвы меняется — переносим её в новый */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    /* раскладка уже применена к DOM — переносим сцену в актуальный контейнер */
    const id = requestAnimationFrame(() => sceneRef.current?.rebind(host));
    return () => cancelAnimationFrame(id);
  });

  /* ширина пары «кадр персонажа + таблица опыта» на экране: по ней
     равняется таблица проектов на следующем экране */
  useEffect(() => {
    const span = stage ? (stageW - STAGE_LEFT - GUARD_RIGHT) * k : 0;
    const root = document.documentElement.style;
    if (span > 0) {
      const page = document.documentElement.clientWidth;
      const left = page / 2 - (stageW * k) / 2 + STAGE_LEFT * k;
      root.setProperty("--work-span", `${Math.round(span)}px`);
      root.setProperty("--work-left", `${Math.round(left)}px`);
    } else {
      root.removeProperty("--work-span");
      root.removeProperty("--work-left");
    }
  }, [stage, stageW, k]);

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // нормированный прогресс подъёма внутри «рельсы»
  const riseProgress = (progress: number) =>
    Math.min(1, Math.max(0, (progress - RISE_START) / (RISE_END - RISE_START)));
  const rise = useTransform(
    scrollYProgress,
    (progress) => `${-RISE_VH * riseProgress(progress)}%`,
  );
  const fade = useTransform(scrollYProgress, (progress) =>
    Math.max(0, 1 - riseProgress(progress) / 0.22),
  );

  return (
    <section
      id="portfolio"
      className="relative z-10"
      aria-label="Maks Novikov, 3D character and work experience"
    >
      <div
        ref={sectionRef}
        className="relative"
        style={
          stage
            ? ({ height: `calc(100svh + ${RAIL_VH}svh)` } as CSSProperties)
            : undefined
        }
      >
      <div
        className={
          stage
            ? "sticky top-0 flex h-[100svh] w-full items-center overflow-hidden"
            : "flex w-full flex-col"
        }
      >
        <div
          className={stage ? "" : "relative mx-auto"}
          style={
            stage
              ? {
                  /* кадр шире окна, поэтому центрируем его сами:
                     mx-auto на переполненном блоке не работает */
                  position: "relative",
                  left: "50%",
                  width: stageW,
                  height: STAGE_H,
                  transform: `translateX(-50%) scale(${k})`,
                  transformOrigin: "center center",
                  flex: "0 0 auto",
                }
              : { width: "100%" }
          }
        >
          {/* ── колонка персонажа ──
               Кадр всегда 709×1080: графика и текст живут в одной системе
               координат, поэтому масштабируем их вместе одним transform,
               а не тянем картинку по ширине. */}
          {stage ? (
            <div
              className="absolute"
              style={{ left: STAGE_LEFT, top: 0, width: CHAR_W, height: STAGE_H }}
            >
              <CharacterFrame />
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: STAGE_H * charScale }}
            >
              <div
                style={{
                  position: "absolute",
                  left: (win.w - CHAR_W * charScale) / 2,
                  top: 0,
                  width: CHAR_W,
                  height: STAGE_H,
                  transform: `scale(${charScale})`,
                  transformOrigin: "top left",
                }}
              >
                <CharacterFrame />
              </div>
            </div>
          )}

          {/* ── колонка способностей: поджимается совсем немного ── */}
          {stage && (
            <motion.div
              className="absolute"
              style={{
                left: STAGE_LEFT + CHAR_W,
                top: 0,
                width: abilW,
                height: STAGE_H,
                y: rise,
                opacity: fade,
              }}
            >
              {/* кадр 460×1080 ужимается целиком, вместе с текстом */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: ABIL_W,
                  height: STAGE_H,
                  transform: `scale(${abilW / ABIL_W})`,
                  transformOrigin: "center center",
                }}
              >
                <img
                  src="abilities-art.svg"
                  alt=""
                  aria-hidden
                  className="block"
                  style={{ width: ABIL_W, height: STAGE_H }}
                />
                <AbilitiesText />
              </div>
            </motion.div>
          )}

          {/* ── 3d-модель: зажимается первой, при нехватке места уезжает вниз ── */}
          {wide && (
            <motion.div
              className="absolute"
              style={{
                left: STAGE_LEFT + CHAR_W + abilW,
                top: 0,
                width: d3W,
                height: STAGE_H,
                y: rise,
              }}
            >
              <Scene3d hostRef={hostRef} status={status} />
            </motion.div>
          )}

          {/* ── таблица опыта: выезжает справа, пока персонаж стоит на месте ── */}
          {stage && (
            <motion.div
              /* слой прозрачный и во всю высоту: без pointer-events-none он
                 перехватывал бы наведение и выделение текста под собой */
              className="pointer-events-none absolute"
              style={{
                left: workLeft,
                top: 0,
                width: workW,
                height: STAGE_H,
                y: rise,
              }}
            >
              <div style={{ height: STAGE_H, transform: `translateY(${RISE_VH}%)` }}>
                <div
                  className="flex justify-center"
                  style={{ paddingTop: compact ? 60 : WORK.titleTop }}
                >
                  <SplitText
                    text="WORK EXPERIENCE"
                    className="pointer-events-auto font-semibold text-white select-text"
                    style={{
                      fontSize: compact ? 34 : WORK.titleSize,
                      letterSpacing: WORK.titleLs,
                      lineHeight: 1,
                    }}
                  />
                </div>
                <div style={{ marginTop: compact ? 32 : WORK.tableTop }}>
                  {EXPERIENCE.map((row, index) => (
                    <div
                      key={row.y}
                      className="pointer-events-auto relative"
                      style={{
                        height: compact ? "auto" : WORK.rowH,
                        borderTop: `1px solid ${WORK_RULE}`,
                        borderBottom:
                          index === EXPERIENCE.length - 1
                            ? `1px solid ${WORK_RULE}`
                            : undefined,
                        backgroundColor:
                          hovered === index ? ROW_HOVER : "rgba(255,255,255,0)",
                        transition:
                          "background-color 450ms cubic-bezier(0.22,1,0.36,1)",
                        display: "flex",
                        flexDirection: compact ? "column" : "row",
                        alignItems: "flex-start",
                        gap: compact ? 6 : WORK.gap,
                        paddingTop: compact ? 18 : WORK.padTop,
                      }}
                      onPointerEnter={(event) =>
                        event.pointerType === "mouse" && setHovered(index)
                      }
                      onPointerLeave={(event) =>
                        event.pointerType === "mouse" &&
                        setHovered((prev) => (prev === index ? null : prev))
                      }
                    >
                      <span
                        className="whitespace-pre text-white"
                        style={{
                          width: compact ? "auto" : WORK.dateW,
                          flex: "0 0 auto",
                          /* дата стоит по центру строки по вертикали */
                          alignSelf: compact ? "flex-start" : "center",
                          marginTop: compact ? 0 : -WORK.padTop / 2,
                          fontSize: TYPO.date.size,
                          lineHeight: `${TYPO.date.lh}px`,
                          fontWeight: TYPO.date.weight,
                        }}
                      >
                        {row.date}
                      </span>
                      <span
                        style={{
                          width: compact ? "100%" : WORK.nameW,
                          flex: "0 0 auto",
                        }}
                      >
                        <span
                          className="block whitespace-pre text-white"
                          style={{
                            fontSize: TYPO.company.size,
                            lineHeight: `${TYPO.company.lh}px`,
                            letterSpacing: TYPO.company.ls,
                            fontWeight: TYPO.company.weight,
                          }}
                        >
                          {row.company}
                        </span>
                        <span
                          className="block whitespace-pre text-white"
                          style={{
                            marginTop: WORK.roleGap,
                            fontSize: TYPO.role.size,
                            lineHeight: `${TYPO.role.lh}px`,
                            letterSpacing: TYPO.role.ls,
                            fontWeight: TYPO.role.weight,
                          }}
                        >
                          {row.role}
                        </span>
                      </span>
                      <span
                        className="block text-white"
                        style={{
                          flex: "1 1 auto",
                          marginTop: compact ? 6 : 0,
                          fontSize: TYPO.desc.size,
                          lineHeight: `${TYPO.desc.lh}px`,
                          fontWeight: TYPO.desc.weight,
                        }}
                      >
                        {row.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

      </div>
      </div>

      {/* ── 3d-модель отдельным блоком, когда в ряд не помещается ── */}
      {!wide && (
        <div className="relative w-full" style={{ height: "70svh", minHeight: 420 }}>
          <Scene3d hostRef={hostRef} status={status} />
        </div>
      )}

        {/* ── узкий режим: таблица опыта обычным блоком под 3d ── */}
        {!stage && (
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: 1440,
              padding: "64px var(--gutter-mobile) 0",
            }}
          >
            <SplitText
              text="WORK EXPERIENCE"
              className="block font-semibold text-white select-text"
              style={{
                fontSize: "clamp(26px, 7vw, 36px)",
                letterSpacing: 1.8,
                lineHeight: 1,
                textAlign: "center",
              }}
            />
            <div style={{ marginTop: 40 }}>
              {EXPERIENCE.map((row, index) => (
                <div
                  key={row.y}
                  style={{
                    borderTop: `1px solid ${WORK_RULE}`,
                    borderBottom:
                      index === EXPERIENCE.length - 1
                        ? `1px solid ${WORK_RULE}`
                        : undefined,
                    padding: "20px 0",
                  }}
                >
                  <span
                    className="block text-white"
                    style={{ fontSize: 13, lineHeight: "18px", fontWeight: 200 }}
                  >
                    {row.date}
                  </span>
                  <span
                    className="mt-2 block text-white"
                    style={{
                      fontSize: 20,
                      lineHeight: "26px",
                      letterSpacing: 0.7,
                      fontWeight: 700,
                    }}
                  >
                    {row.company}
                  </span>
                  <span
                    className="block text-white"
                    style={{
                      fontSize: 11,
                      lineHeight: "14px",
                      letterSpacing: 1.6,
                      fontWeight: 300,
                    }}
                  >
                    {row.role}
                  </span>
                  <span
                    className="mt-3 block text-white"
                    style={{ fontSize: 14, lineHeight: "21px", fontWeight: 300 }}
                  >
                    {row.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </section>
  );
}
