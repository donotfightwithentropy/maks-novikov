"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  cubicBezier,
  motion,
  useInView,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

import NuetelScene from "@/components/NuetelScene";
import { TO_PROJECTS_KEY } from "@/components/HomeScrollRestore";
import { MENU_TARGET_KEY } from "@/components/SiteMenu";
import { useTransitionNav } from "@/components/PageTransition";

/* ───────────────────────────── палитра и базовые тайминги ──────────────── */

const ACCENT = "#B91372";
const DARK = "#051C2E";
const LIGHT = "#E7E7E7";
const INK = "#031828";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Кастомный ease-out для выезда строк (power 2.3) */
const EASE_SPLIT = (t: number) => 1 - Math.pow(1 - t, 2.3);

/** Длительность выезда строки из-под маски */
const SPLIT_DURATION = 1;

/* Тайминги появления шапки: всё отсчитывается от HERO_BASE */
const HERO_BASE = 0.5;
const HERO_TITLE_DELAY = HERO_BASE + 0.15;
const HERO_RULE_DELAY = HERO_BASE + 0.75;
/** Ширина линейки в шапке по умолчанию */
const HERO_RULE_W = 502;
const RULE_DURATION = 0.9;
const HERO_TAGLINE_DELAY = HERO_BASE + 1.15;
const HERO_YEARS_DELAY = HERO_BASE + 1.35;

/** Масштаб шапки при уходе за верхний край (sticky-параллакс) */
const HERO_SCALE_FROM = 1;
const HERO_SCALE_TO = 0.9;
/** Наезд самой картинки при первом появлении */
const HERO_IMAGE_SCALE_IN = 1.14;
const HERO_IMAGE_DURATION = 2;

/** Сцена страниц проектов живёт в координатах Figma 1920 */
const cq = (v: number) => `${(v / 1920) * 100}cqw`;

/**
 * Пересчёт cap-top (как в Figma) в CSS `top` по метрикам Montserrat:
 * ascender 0.968em, cap-height 0.70em, глиф-бокс 1.219em.
 * y — положение верха капители, size — кегль, lh — интерлиньяж.
 */
const capTop = (y: number, size: number, lh: number) =>
  cq(y - ((lh - 1.219 * size) / 2 + 0.968 * size - 0.7 * size));

/* ───────────────────────────── обёртки анимации появления ──────────────── */

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Строка шапки: выезжает из-под маски сразу при монтировании.
 * clip + отрицательный margin — маска, не режущая выносные элементы букв.
 */
function RevealLine({ children, delay, className, style }: RevealProps) {
  return (
    <motion.span
      className={className}
      style={{
        display: "block",
        overflow: "clip",
        paddingBottom: "0.22em",
        marginBottom: "-0.22em",
        ...style,
      }}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { delayChildren: delay } } }}
    >
      <motion.span
        style={{ display: "inline-block", whiteSpace: "pre" }}
        variants={{
          hidden: { y: "110%", opacity: 0 },
          show: {
            y: "0%",
            opacity: 1,
            transition: { duration: SPLIT_DURATION, ease: EASE_SPLIT },
          },
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

/** Мягкий ease для всего, что всплывает по скроллу */
const EASE_SOFT: [number, number, number, number] = [0.33, 1, 0.68, 1];

/** Абзац, всплывающий снизу при попадании во вьюпорт */
function FadeUp({
  children,
  className,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "200% 0px -18% 0px" });
  const [atPageEnd, setAtPageEnd] = useState(false);

  /* Страховка для коротких страниц: нижний margin срезает зону срабатывания
     на 18% экрана, и блок, попавший в эту полосу у самого низа документа,
     иначе никогда не проявится — скроллить дальше уже некуда. */
  useEffect(() => {
    if (inView || atPageEnd) return;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const doc = document.scrollingElement ?? document.documentElement;
      const atBottom = doc.scrollHeight - doc.scrollTop - doc.clientHeight < 2;
      if (atBottom && el.getBoundingClientRect().top < window.innerHeight)
        setAtPageEnd(true);
    };
    check();
    const t = window.setTimeout(check, 400);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [inView, atPageEnd]);

  const shown = inView || atPageEnd;

  return (
    <motion.p
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: "1.2em" }}
      animate={shown ? { opacity: 1, y: "0em" } : { opacity: 0, y: "1.2em" }}
      transition={{
        duration: 1.4,
        ease: EASE_SOFT,
        delay,
        opacity: { duration: 1.2, ease: "easeInOut", delay },
      }}
    >
      {children}
    </motion.p>
  );
}

/** Всплытие, управляемое вариантами родителя (hidden/show) */
function VariantFade({ children, delay, className, style }: RevealProps) {
  return (
    <motion.span
      className={className}
      style={{ display: "block", ...style }}
      variants={{
        hidden: { opacity: 0, y: "1em" },
        show: {
          opacity: 1,
          y: "0em",
          transition: { duration: 1.2, ease: EASE_SOFT, delay },
        },
      }}
    >
      {children}
    </motion.span>
  );
}

/** Выезд из-под маски, управляемый вариантами родителя */
function VariantMaskLine({ children, delay, className, style }: RevealProps) {
  return (
    <motion.span
      className={className}
      style={{
        display: "block",
        overflow: "clip",
        paddingBottom: "0.22em",
        marginBottom: "-0.22em",
        ...style,
      }}
      variants={{ hidden: {}, show: { transition: { delayChildren: delay } } }}
    >
      <motion.span
        style={{ display: "inline-block", whiteSpace: "pre-line" }}
        variants={{
          hidden: { y: "110%", opacity: 0 },
          show: {
            y: "0%",
            opacity: 1,
            transition: { duration: SPLIT_DURATION, ease: EASE_SPLIT },
          },
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

/* ───────────────────────────── кнопка «назад» ──────────────────────────── */

type CursorPoint = { x: number; y: number };

/** Размер иконки «назад»: чуть меньше макетных 42.5 */
const BACK_ICON = 34;

/** Уголок-стрелка ↖ в левом верхнем углу: по наведению доворачивается
    против часовой стрелки и немного уходит влево */
function BackArrow({
  onClick,
  onCursor,
  pinned = true,
}: {
  onClick: () => void;
  onCursor: (p: CursorPoint | null) => void;
  /** false — иконка живёт в потоке страницы и уезжает со скроллом */
  pinned?: boolean;
}) {
  const [hover, setHover] = useState(false);
  if (!pinned)
    return (
      <motion.button
        type="button"
        aria-label="Back"
        onClick={onClick}
        className="absolute z-40 block"
        style={{
          top: 26,
          left: "var(--gutter-mobile)",
          width: BACK_ICON,
          height: BACK_ICON,
        }}
        initial={{ x: -120, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8, ease: EASE_OUT }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="block overflow-visible"
          style={{ width: BACK_ICON, height: BACK_ICON }}
        >
          <g stroke={ACCENT} strokeWidth="3" fill="none">
            <path d="M0 1.5 H32" />
            <path d="M1.5 0 V32" />
            <path d="M1.1 1.1 L30.9 30.9" />
          </g>
        </svg>
      </motion.button>
    );
  return (
    <motion.button
      type="button"
      aria-label="Back"
      onClick={onClick}
      onPointerEnter={(e) => {
        e.pointerType === "mouse" &&
          (setHover(true), onCursor({ x: e.clientX, y: e.clientY }));
      }}
      onPointerMove={(e) =>
        e.pointerType === "mouse" && onCursor({ x: e.clientX, y: e.clientY })
      }
      onPointerLeave={(e) => {
        e.pointerType === "mouse" && (setHover(false), onCursor(null));
      }}
      /* на телефоне иконку не показываем совсем */
      className="fixed top-8 left-5 z-40 hidden md:top-12 md:left-[50px] md:block xl:top-[59px]"
      style={{ cursor: "none", width: BACK_ICON, height: BACK_ICON }}
      initial={{ x: -600 }}
      animate={{ x: 0 }}
      transition={{ delay: 2.3, type: "spring", stiffness: 120, damping: 18 }}
    >
      <motion.svg
        viewBox="0 0 32 32"
        fill="none"
        className="block overflow-visible"
        style={{ width: BACK_ICON, height: BACK_ICON }}
        animate={{ rotate: hover ? -45 : 0, x: hover ? -8 : 0 }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
      >
        <g stroke={ACCENT} strokeWidth="3" fill="none">
          <path d="M0 1.5 H32" />
          <path d="M1.5 0 V32" />
          <path d="M1.1 1.1 L30.9 30.9" />
        </g>
      </motion.svg>
    </motion.button>
  );
}

/** Тег-«пилюля» в светлой панели под шапкой */
function TokenChip({ label }: { label: string }) {
  return (
    <span
      className="font-light"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${cq(5)} ${cq(18)}`,
        borderRadius: cq(6),
        border: "1px solid rgba(5,28,46,0.3)",
        background: "rgba(5,28,46,0.04)",
        color: DARK,
        fontSize: cq(15),
        lineHeight: cq(21),
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* ───────────────────────────── геометрия страницы ──────────────────────── */

/** Высота липкой «истории» Nuetel */
const STORY_PANEL_H = 1794;
/** Высота светлой панели с заголовком и токенами */
const PANEL_HEAD_H = 153;
/** Отступ вступления: cap-top 223 при 23/32 минус высота панели */
const INTRO_TOP = 223 - ((32 - 1.219 * 23) / 2 + 0.968 * 23 - 0.7 * 23) - PANEL_HEAD_H;
/** Отступ блока цифр: cap-top 223 при 52/60 */
const STATS_TOP =
  223 - ((60 - 1.219 * 52) / 2 + 0.968 * 52 - 0.7 * 52) - (PANEL_HEAD_H + INTRO_TOP);
const INTRO_MIN_H = 344 + STATS_TOP;

/* Схема «как устроен типовой заказ»: 5 карточек с промежутками */
const PROCESS_GAP = 54;
const PROCESS_CARD_W = (1440 - 4 * PROCESS_GAP) / 5;
const PROCESS_STEP = PROCESS_CARD_W + PROCESS_GAP;
/** Высота петли «если не согласовали — повтор шагов 2 и 3» */
const LOOP_H = 62;
/** Отступ сверху у вертикали петли под стрелкой */
const LOOP_ARROW_H = 15;
/** Центр i-й карточки в координатах 1440 */
const stepCenter = (i: number) => i * PROCESS_STEP + PROCESS_CARD_W / 2;

const PROCESS_STEPS = [
  { num: "01", title: "Brief", desc: "Receiving the assignment" },
  {
    num: "02",
    title: "Research",
    desc: "Research and preparing materials for the design case study",
  },
  { num: "03", title: "Master banner", desc: "Editing the master banner" },
  {
    num: "04",
    title: "Approval",
    desc: "Getting approval from the vendor and design lead",
  },
  {
    num: "05",
    title: "Resizes",
    desc: "Polishing the layout and creating resizes",
  },
];

/* Дерево пакетов ресайзов справа от текста */
const RESIZE_TREE_W = 660;
const RESIZE_TREE_H = 465;
/** X вертикального «ствола» дерева */
const TREE_TRUNK_X = 362;
/** Y первой ветки */
const TREE_FIRST_Y = 18;
/** Шаг между ветками */
const TREE_ROW_H = 48;
/** X подписи на ветке */
const TREE_LABEL_X = 431;

const RESIZE_PACK_LABELS = [
  "Landing header",
  "Category banners pack",
  "Promotional carousel pack",
  "Department banners pack",
  "Hero banners",
  "Mobile banners",
  "Feed banners pack",
  "Vertical banners pack",
  "Social hub",
  "Other banner packs",
];

const RESIZE_TEXT = [
  "Once the Master banner was approved, the next step was to create resizes for various placements, both within the Yandex Market ecosystem and on external platforms.",
  "Banner packages evolved over time, with formats and technical requirements. After all, designing content for a large-scale platform is an ongoing process, not a finished product.",
  "Nevertheless, the overall approach remained consistent.",
];

/* ───────────────────────────── интерактивные доски ─────────────────────── */

/** Высота доски (в координатах 1920, но позиции паков считаются от 1440) */
const BOARD_H = 660;
const BOARD_BG = "#1E1E1E";
/** Мелкая сетка доски */
const BOARD_GRID_MINOR = "rgba(255,255,255,0.11)";
/** Крупная сетка доски */
const BOARD_GRID_MAJOR = "rgba(255,255,255,0.18)";
const BOARD_CELL_SMALL = 40;
const BOARD_CELL_BIG = 120;

/* Мастер-баннер на доске ресайзов */
const MASTER_W = 292;
const MASTER_IMG_H = 164;
const MASTER_CHIP_H = 26;
const MASTER_CHIP_GAP = 10;
const MASTER_H = MASTER_CHIP_H + MASTER_CHIP_GAP + MASTER_IMG_H;
const MASTER_BANNER_SRC = "/yan/master_banner.webp";
const RESIZE_BOARD_NOTE =
  "Imagine that we have a Master banner and need to design all the resizes. We just need to get approval.";
const MASTER_ID = "master";

type BoardItem = {
  id: string;
  name: string;
  w: number;
  h: number;
  x: number;
  y: number;
};

/** Паки ресайзов, появляющиеся после согласования */
const RESIZE_PACKS: BoardItem[] = [
  { id: "hero", name: "Hero pack", w: 410, h: 354, x: 14, y: 14 },
  { id: "feed", name: "Feed banners", w: 132, h: 209, x: 440, y: 14 },
  {
    id: "department",
    name: "Department banners pack",
    w: 292,
    h: 344,
    x: 890,
    y: 14,
  },
  {
    id: "fashion",
    name: "Fashion department pack",
    w: 228,
    h: 301,
    x: 1195,
    y: 14,
  },
  {
    id: "landing",
    name: "Landing header pack",
    w: 338,
    h: 173,
    x: 14,
    y: 390,
  },
  {
    id: "vertical",
    name: "Vertical banners pack",
    w: 169,
    h: 216,
    x: 370,
    y: 390,
  },
  { id: "topbar", name: "Top bar banners", w: 286, h: 101, x: 890, y: 375 },
  {
    id: "carousel",
    name: "Promotional carousel pack",
    w: 251,
    h: 274,
    x: 1186,
    y: 375,
  },
];

/** Длительность глича при подмене/появлении объектов на досках */
const GLITCH_MS = 1500;

const LABEL_GIVE_APPROVAL = "Give approval";
const LABEL_RESIZES_DONE = "Resizes done";

/** Алфавит для эффекта decrypted text */
const DECRYPT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>-_\\/[]{}=+*^?#";
const DECRYPT_STEP_MS = 45;

/**
 * Эффект decrypted text: буквы слева направо «расшифровываются»,
 * хвост строки крутится случайными символами. Пробелы не трогаем.
 */
function useDecrypt(text: string, active: boolean) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    const rand = () =>
      DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
    const frame = (revealed: number) =>
      text
        .split("")
        .map((ch, i) => (ch === " " || i < revealed ? ch : rand()))
        .join("");
    setOut(frame(0));
    let revealed = 0;
    const timer = setInterval(() => {
      (revealed += 1), setOut(frame(revealed));
      revealed >= text.length && clearInterval(timer);
    }, DECRYPT_STEP_MS);
    return () => clearInterval(timer);
  }, [active, text]);
  return out;
}

/** Уголок-стрелка на кнопке доски: при ховере поворачивается на 45° */
function ApproveArrow() {
  return (
    <svg
      viewBox="0 0 26 26"
      aria-hidden
      style={{
        width: cq(26),
        height: cq(26),
        display: "block",
        overflow: "visible",
      }}
    >
      <g stroke={ACCENT} strokeWidth="5.2" fill="none">
        <path d="M0 2.6 H26" />
        <path d="M23.4 0 V26" />
        <path d="M2.4 23.6 L23.6 2.4" />
      </g>
    </svg>
  );
}

type DragState = { id: string; dx: number; dy: number };
type Positions = Record<string, { x: number; y: number }>;

/**
 * Доска ресайзов: мастер-баннер можно таскать, по кнопке GIVE APPROVAL
 * проявляются 8 паков ресайзов, кнопка гаснет, надпись меняется.
 */
function ResizeBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [glitch, setGlitch] = useState(false);
  const [pos, setPos] = useState<Positions>(() => {
    const init: Positions = {
      [MASTER_ID]: { x: (1440 - MASTER_W) / 2 / 1440, y: 0.18 },
    };
    for (const p of RESIZE_PACKS) init[p.id] = { x: p.x / 1440, y: p.y / BOARD_H };
    return init;
  });
  const [order, setOrder] = useState<string[]>([MASTER_ID]);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [approved, setApproved] = useState(false);
  const [buttonGone, setButtonGone] = useState(false);
  const label = useDecrypt(
    approved ? LABEL_RESIZES_DONE : LABEL_GIVE_APPROVAL,
    hover || approved,
  );

  const sizeOf = (id: string) =>
    id === MASTER_ID
      ? { w: MASTER_W, h: MASTER_H }
      : (() => {
          const pack = RESIZE_PACKS.find((p) => p.id === id)!;
          return { w: pack.w, h: pack.h };
        })();

  const bringToFront = (id: string) =>
    setOrder((prev) => [...prev.filter((it) => it !== id), id]);

  const onDown = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (!boardRef.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    (drag.current = { id, dx: e.clientX - box.left, dy: e.clientY - box.top }),
      e.currentTarget.setPointerCapture(e.pointerId),
      setDragging(id),
      bringToFront(id);
  };

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const board = boardRef.current;
    if (!state || !board) return;
    const box = board.getBoundingClientRect();
    const { w, h } = sizeOf(state.id);
    // размеры заданы в координатах 1440 — переводим в пиксели доски
    const pxW = (w / 1440) * box.width;
    const pxH = (h / 1440) * box.width;
    const nx = Math.min(
      Math.max(e.clientX - box.left - state.dx, 0),
      Math.max(0, box.width - pxW),
    );
    const ny = Math.min(
      Math.max(e.clientY - box.top - state.dy, 0),
      Math.max(0, box.height - pxH),
    );
    setPos((prev) => ({
      ...prev,
      [state.id]: { x: nx / box.width, y: ny / box.height },
    }));
  };

  const onUp = (e: React.PointerEvent<HTMLElement>) => {
    (drag.current = null), setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const approve = () => {
    if (approved) return;
    setApproved(true);
    setGlitch(true);
    /* последний пак стартует с задержкой, поэтому ждём её сверх длительности */
    setTimeout(
      () => setGlitch(false),
      GLITCH_MS + (RESIZE_PACKS.length - 1) * 90,
    );
    setTimeout(() => setButtonGone(true), 4e3);
  };

  return (
    <div
      ref={boardRef}
      style={{
        position: "relative",
        width: "100%",
        height: cq(BOARD_H),
        background: BOARD_BG,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to right, ${BOARD_GRID_MINOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MINOR} 1px, transparent 1px)`,
          backgroundSize: `
            ${cq(BOARD_CELL_BIG)} 100%,
            100% ${cq(BOARD_CELL_BIG)},
            ${cq(BOARD_CELL_SMALL)} 100%,
            100% ${cq(BOARD_CELL_SMALL)}`,
        }}
      />
      {RESIZE_PACKS.map((pack, i) => {
        /* каждый пак гличит в момент собственного появления */
        const delay = `${i * 0.09}s`;
        const art = `url(/yan/packs/${pack.id}.webp)`;
        return (
          <div
            key={pack.id}
            onPointerDown={approved ? onDown(pack.id) : undefined}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute",
              left: `${pos[pack.id].x * 100}%`,
              top: `${pos[pack.id].y * 100}%`,
              width: cq(pack.w),
              height: cq(pack.h),
              opacity: approved ? 1 : 0,
              transform: approved ? "none" : "translateY(10px)",
              transition: `opacity .7s ease ${delay}, transform .7s cubic-bezier(.22,1,.36,1) ${delay}`,
              pointerEvents: approved ? "auto" : "none",
              cursor: dragging === pack.id ? "grabbing" : "grab",
              zIndex: 1 + order.indexOf(pack.id),
              userSelect: "none",
              touchAction: "none",
            }}
            role="img"
            aria-label={pack.name}
          >
            <div
              className={glitch ? "lp-glitch" : undefined}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: art,
                backgroundSize: "100% 100%",
                animationDelay: glitch ? delay : undefined,
              }}
            />
            {glitch && (
              <>
                <div
                  aria-hidden
                  className="lp-glitch-slice lp-glitch-slice--cyan"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: art,
                    backgroundSize: "100% 100%",
                    animationDelay: delay,
                  }}
                />
                <div
                  aria-hidden
                  className="lp-glitch-slice lp-glitch-slice--magenta"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: art,
                    backgroundSize: "100% 100%",
                    animationDelay: `${i * 0.09 + 0.075}s`,
                  }}
                />
                <div
                  aria-hidden
                  className="lp-glitch-scan"
                  style={{
                    position: "absolute",
                    inset: "-15% 0",
                    animationDelay: delay,
                  }}
                />
              </>
            )}
          </div>
        );
      })}
      <div
        onPointerDown={onDown(MASTER_ID)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: "absolute",
          left: `${pos[MASTER_ID].x * 100}%`,
          top: `${pos[MASTER_ID].y * 100}%`,
          width: cq(MASTER_W),
          zIndex: 1 + order.indexOf(MASTER_ID),
          cursor: dragging === MASTER_ID ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <span
          className="font-light"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: cq(MASTER_CHIP_H),
            padding: `0 ${cq(12)}`,
            borderRadius: cq(5),
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.9)",
            fontSize: cq(12),
            lineHeight: cq(16),
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Master Banner
        </span>
        <div
          style={{
            marginTop: cq(MASTER_CHIP_GAP),
            width: "100%",
            height: cq(MASTER_IMG_H),
            background: "rgba(255,255,255,0.06)",
            backgroundImage: `url(${MASTER_BANNER_SRC})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>
      <button
        type="button"
        onClick={approve}
        onPointerEnter={(e) => {
          e.pointerType === "mouse" &&
            (setHover(true), setCursor({ x: e.clientX, y: e.clientY }));
        }}
        onPointerMove={(e) =>
          e.pointerType === "mouse" && setCursor({ x: e.clientX, y: e.clientY })
        }
        onPointerLeave={(e) => {
          e.pointerType === "mouse" && (setHover(false), setCursor(null));
        }}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: cq(44),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: cq(20),
          height: cq(60),
          padding: `0 ${cq(36)}`,
          borderRadius: cq(6),
          border: `1px solid ${ACCENT}`,
          background:
            hover || approved
              ? "rgba(185,19,114,0.05)"
              : "rgba(255,255,255,0.04)",
          opacity: buttonGone ? 0 : 1,
          pointerEvents: buttonGone || approved ? "none" : "auto",
          transition: "background .3s ease, opacity .7s ease",
          cursor: "none",
          whiteSpace: "nowrap",
          zIndex: 20,
        }}
      >
        <span
          style={{
            display: "block",
            transform: hover || approved ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform .35s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <ApproveArrow />
        </span>
        <span
          className="font-bold"
          style={{
            position: "relative",
            display: "inline-block",
            color: "#fff",
            fontSize: cq(23),
            lineHeight: cq(28),
            letterSpacing: cq(1.15),
            textTransform: "uppercase",
          }}
        >
          {/* распорка под самую длинную надпись, чтобы кнопка не дёргалась */}
          <span aria-hidden style={{ visibility: "hidden" }}>
            {LABEL_GIVE_APPROVAL}
          </span>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </span>
      </button>
      {cursor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: cursor.x,
              top: cursor.y,
              width: 26,
              height: 26,
              marginLeft: -13,
              marginTop: -13,
              borderRadius: "50%",
              background: ACCENT,
              pointerEvents: "none",
              zIndex: 120,
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/** Скриншот проекта поверх страницы: закрывается крестиком, кликом по фону
    и клавишей Esc; сам кадр прокручивается, он длинный */
function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    /* на фазе перехвата — иначе Esc сначала поймает страница и уедет назад */
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_SOFT }}
      onClick={onClose}
      className="fixed inset-0 z-[140] overflow-y-auto"
      style={{ background: "rgba(3,24,40,0.94)" }}
    >
      <div
        style={{
          padding: "56px 24px 80px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(56vw, 900px)",
            height: "auto",
            display: "block",
            borderRadius: 12,
          }}
        />
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed flex items-center justify-center rounded-full"
        style={{
          top: 32,
          right: 32,
          width: 56,
          height: 56,
          background: ACCENT,
          border: "none",
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            d="M1 1 L17 17 M17 1 L1 17"
            stroke="#fff"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      </button>
    </motion.div>,
    document.body,
  );
}

/* ───────────────────────────── папка с гайдлайнами ─────────────────────── */

const GUIDELINE_TEXT = [
  "All content production was governed by several layers of design guidelines.",
  "Main Yandex Market guideline defined the general rules for layout, composition, and the usage of visual elements. On top of that, seasonal guidelines were developed for specific campaigns and events, such as “Black Friday” and others.",
  "Requirements also varied by department and placement. The Guideline for Business department relied mostly on a strict, minimalist visual language, while Fashion department Guideline called for brighter, more expressive solutions.",
  "Beyond applying the guidelines, I contributed to their development. And that’s really important stuff because guidelines help designers find the right solutions while maintaining brand consistency.",
];

/** Геометрия папки: все размеры — в координатах 1920 */
const FOLDER = {
  label: "Design guidelines",
  items: ["Grid", "Safe zones", "Logo placement", "Typography"],
  back: "#8E8307",
  front: "#FED42B",
  paper: "#FFFFFF",
  ink: "#000000",
  w: 358,
  h: 274,
  radius: 21,
  tab: 22,
  frontH: 168,
  noteW: 235,
  noteH: 48,
  tilt: 12,
  lift: 48,
  flap: 35,
  dur: 700,
  stagger: 100,
};

/** Папка: на ховере передняя створка откидывается, листки взлетают веером */
function GuidelineFolder() {
  const [open, setOpen] = useState(false);
  const count = FOLDER.items.length;
  /** Разлёт i-го листка: чётные — влево, нечётные — вправо, с наклоном */
  const liftTransform = (i: number) => {
    const dir = i % 2 === 0 ? -1 : 1;
    const up = -(82 + FOLDER.lift * i);
    const side = dir * (34 + i * 26);
    const angle = dir * FOLDER.tilt * (0.8 + i * 0.35);
    return `translate(${cq(side)}, ${cq(up)}) rotate(${angle}deg)`;
  };
  return (
    <div style={{ paddingTop: cq(150) }}>
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          position: "relative",
          width: cq(FOLDER.w),
          height: cq(FOLDER.h),
          perspective: cq(1060),
          cursor: "pointer",
        }}
      >
        {/* «ушко» папки */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: cq(137),
            height: cq(FOLDER.tab + FOLDER.radius),
            background: FOLDER.back,
            borderRadius: `${cq(FOLDER.radius)} ${cq(FOLDER.radius)} 0 0`,
          }}
        />
        {/* задняя стенка */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cq(FOLDER.tab),
            bottom: 0,
            background: FOLDER.back,
            borderRadius: cq(FOLDER.radius),
          }}
        />
        {FOLDER.items.map((item, i) => (
          <div
            key={item}
            style={{
              position: "absolute",
              left: "50%",
              top: cq(FOLDER.h - FOLDER.frontH + 34),
              width: cq(FOLDER.noteW),
              height: cq(FOLDER.noteH),
              marginLeft: cq(-FOLDER.noteW / 2),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: cq(11),
              background: FOLDER.paper,
              color: FOLDER.ink,
              fontSize: cq(18),
              lineHeight: cq(25),
              letterSpacing: cq(0.84),
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              boxShadow: open ? "0 14px 34px rgba(0,0,0,0.18)" : "none",
              transform: open
                ? liftTransform(i)
                : "translate(0px, 0px) rotate(0deg)",
              // при закрытии листки складываются в обратном порядке
              transition: `transform ${FOLDER.dur}ms cubic-bezier(.22,1,.36,1) ${(open ? i : count - 1 - i) * FOLDER.stagger}ms, box-shadow ${FOLDER.dur}ms ease`,
              zIndex: 1 + i,
              pointerEvents: "none",
            }}
          >
            {item}
          </div>
        ))}
        {/* передняя створка */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: cq(FOLDER.frontH),
            background: FOLDER.front,
            borderRadius: cq(FOLDER.radius),
            transformOrigin: "bottom center",
            transform: open
              ? `rotateX(-${FOLDER.flap}deg)`
              : "rotateX(0deg)",
            transition: `transform ${FOLDER.dur}ms cubic-bezier(.22,1,.36,1)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <span
            className="font-bold"
            style={{
              color: FOLDER.ink,
              fontSize: cq(22),
              lineHeight: cq(30),
              letterSpacing: cq(1.1),
              textTransform: "uppercase",
            }}
          >
            {FOLDER.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── чат с дизайн-гайдом ─────────────────────── */

/** Шаг между репликами */
const CHAT_ROW_H = 140.29;
const BUBBLE_W = 478.5;
const BUBBLE_H = 90.81;
/** X пузырька у реплики дизайнера (слева) */
const BUBBLE_LEFT_X = 421.26;
/** X пузырька у реплики гайда (справа) */
const BUBBLE_RIGHT_X = 537.68;
/** X аватара дизайнера */
const AVATAR_LEFT_X = 295;
/** X аватара гайда */
const AVATAR_RIGHT_X = 1023;
const AVATAR_W = 119;
const AVATAR_H = 91;
const BUBBLE_FILL_LEFT = "#FFFFFF";
const BUBBLE_FILL_RIGHT = "#FFE033";
/** Внутренний отступ текста в пузырьке */
const BUBBLE_PAD = 23.5;
const BUBBLE_TEXT_W = 407.5;
/** Пузырёк с «хвостиком» слева внизу */
const BUBBLE_PATH_LEFT =
  "M40 0H462A17 17 0 0 1 479 17V74A17 17 0 0 1 462 91H0C12 85 24 78 24 64V16A16 16 0 0 1 40 0Z";
/** Пузырёк с «хвостиком» справа внизу */
const BUBBLE_PATH_RIGHT =
  "M17 0H439A16 16 0 0 1 455 16V64C455 78 467 85 479 91H17A17 17 0 0 1 0 74V17A17 17 0 0 1 17 0Z";

type ChatMessage = { right?: boolean; text: string };

const CHAT_MESSAGES: ChatMessage[] = [
  {
    text: "What should I do if the Vendor’s materials don’t include any photos of people?",
  },
  { right: true, text: "Then you should request them additionally." },
  {
    text: "But what I should do if Vendor doesn’t response or can’t send anything?",
  },
  {
    right: true,
    text: "Find it yourself on the Vendor’s website and suggest from what you’ve found.",
  },
  { text: "And even if I didn’t succeed here, what now?" },
  {
    right: true,
    text: "Fine. Only in this case can we use a photo that doesn’t show any person.",
  },
];

/** Общая высота чата: 5 шагов + последняя реплика с подписью */
const CHAT_H = 5 * CHAT_ROW_H + BUBBLE_H + 10 + 16;
const AVATAR_RADIUS = 14;
/** Скорость печатания, мс на символ */
const TYPE_SPEED_MS = 22;
/** Пауза между появлением аватара и пузырька */
const BUBBLE_DELAY_MS = 420;
/** Пауза между пузырьком и началом печатания */
const TYPING_DELAY_MS = 260;

/** Посимвольное печатание текста, пока active */
function useTyping(text: string, active: boolean, speed = TYPE_SPEED_MS) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setCount((c) => (c >= text.length ? (clearInterval(timer), c) : c + 1));
    }, speed);
    return () => clearInterval(timer);
  }, [active, text, speed]);
  return { shown: text.slice(0, count), done: count >= text.length };
}

/**
 * Одна реплика чата. Поэтапно: 1 — аватар, 2 — пузырёк, 3 — печатание.
 * Своя очередь наступает, когда index <= active (предыдущая отпечаталась).
 */
function ChatLine({
  m,
  y,
  index,
  active,
  onDone,
}: {
  m: ChatMessage;
  y: number;
  index: number;
  active: number;
  onDone: (index: number) => void;
}) {
  const [inView, setInView] = useState(false);
  const [stage, setStage] = useState(0);
  const bubbleX = m.right ? BUBBLE_RIGHT_X : BUBBLE_LEFT_X;
  const avatarX = m.right ? AVATAR_RIGHT_X : AVATAR_LEFT_X;
  const { shown, done } = useTyping(m.text, stage >= 3);

  useEffect(() => {
    inView && index <= active && stage === 0 && setStage(1);
  }, [inView, index, active, stage]);

  useEffect(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), BUBBLE_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (stage === 2) {
      const t = setTimeout(() => setStage(3), TYPING_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    stage >= 3 && done && onDone(index);
  }, [stage, done, index, onDone]);

  return (
    <motion.div
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: cq(y),
        height: cq(AVATAR_H + 10 + 16),
      }}
    >
      <div
        style={{
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? "translateY(0)" : `translateY(${cq(18)})`,
          transition:
            "opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <img
          src={m.right ? "/yan/chat/lead.webp" : "/yan/chat/designer.webp"}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            left: cq(avatarX),
            top: 0,
            width: cq(AVATAR_W),
            height: cq(AVATAR_H),
            borderRadius: cq(AVATAR_RADIUS),
            maxWidth: "none",
            display: "block",
          }}
        />
        <span
          className="font-normal"
          style={{
            position: "absolute",
            left: cq(avatarX),
            top: cq(AVATAR_H + 10),
            width: cq(AVATAR_W),
            color: DARK,
            fontSize: cq(12),
            lineHeight: cq(16),
            letterSpacing: cq(1.73),
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {m.right ? "Design guide" : "Designer"}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: cq(bubbleX),
          top: 0,
          width: cq(BUBBLE_W),
          height: cq(BUBBLE_H),
          opacity: stage >= 2 ? 1 : 0,
          transform: stage >= 2 ? "scale(1)" : "scale(0.94)",
          transformOrigin: m.right ? "bottom right" : "bottom left",
          transition:
            "opacity .4s ease, transform .5s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <svg
          viewBox="0 0 479 91"
          preserveAspectRatio="none"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
          }}
        >
          <path
            d={m.right ? BUBBLE_PATH_RIGHT : BUBBLE_PATH_LEFT}
            fill={m.right ? BUBBLE_FILL_RIGHT : BUBBLE_FILL_LEFT}
          />
        </svg>
        <p
          className="font-normal"
          style={{
            position: "absolute",
            left: cq(m.right ? BUBBLE_PAD : 24 + BUBBLE_PAD),
            top: capTop(23.29, 16, 22),
            width: cq(BUBBLE_TEXT_W),
            color: "#000",
            fontSize: cq(16),
            lineHeight: cq(22),
          }}
        >
          {shown}
          {stage >= 3 && !done && <span className="chat-caret">|</span>}
        </p>
      </div>
    </motion.div>
  );
}

/** Весь диалог: реплики запускаются по очереди, как только отпечаталась предыдущая */
function GuideChat() {
  const [active, setActive] = useState(0);
  const onDone = useCallback(
    (i: number) => setActive((cur) => (i >= cur ? i + 1 : cur)),
    [],
  );
  return (
    <div
      style={{ position: "relative", height: cq(CHAT_H) }}
      aria-label="Talking to the design guide"
    >
      {CHAT_MESSAGES.map((m, i) => (
        <ChatLine
          key={i}
          m={m}
          y={i * CHAT_ROW_H}
          index={i}
          active={active}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────── доска banner builder ────────────────────── */

const BUILDER_BOARD_NOTE =
  "Imagine that we have all banner components. But what a mess! We need to use banner builder.";
const LABEL_USE_BUILDER = "Use banner builder";

/** Компоненты баннера — то, что лежит на доске до сборки */
const BUILDER_PARTS: BoardItem[] = [
  { id: "grid", name: "Grid background", w: 374, h: 414, x: 20, y: 20 },
  { id: "visual", name: "Choosed visual", w: 433, h: 252, x: 420, y: 20 },
  {
    id: "advtext",
    name: "Approved adv text",
    w: 283,
    h: 102,
    x: 420,
    y: 300,
  },
  {
    id: "graphics",
    name: "Graphic elements",
    w: 207,
    h: 272,
    x: 880,
    y: 20,
  },
  { id: "colors", name: "Main colors", w: 127, h: 303, x: 1110, y: 20 },
  { id: "tokens", name: "Tokens and logo", w: 144, h: 188, x: 1262, y: 20 },
];

const LABEL_DONE = "Done!";

/** Результат сборки — мастер-баннер и пакеты ресайзов */
const BUILDER_RESULTS: BoardItem[] = [
  {
    id: "done_master",
    name: "Master banner",
    w: 605,
    h: 155,
    x: 20,
    y: 16,
  },
  {
    id: "done_pack3",
    name: "Banner resizes pack 3",
    w: 497,
    h: 378,
    x: 940,
    y: 16,
  },
  {
    id: "done_pack1",
    name: "Banner resizes pack 1",
    w: 428,
    h: 266,
    x: 20,
    y: 200,
  },
  {
    id: "done_pack2",
    name: "Banner resizes pack 2",
    w: 462,
    h: 286,
    x: 465,
    y: 200,
  },
  {
    id: "done_pack4",
    name: "Banner resizes pack 4",
    w: 420,
    h: 133,
    x: 1e3,
    y: 480,
  },
];

const BUILDER_ITEMS: BoardItem[] = [...BUILDER_PARTS, ...BUILDER_RESULTS];
/** Пауза перед гличем: столько уезжают исходные части */
const BUILDER_GLITCH_DELAY = 0.35;

/**
 * Вторая доска: по кнопке USE BANNER BUILDER компоненты гаснут,
 * а на их месте проявляются собранный мастер-баннер и паки ресайзов.
 */
function BuilderBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Positions>(() => {
    const init: Positions = {};
    for (const it of BUILDER_ITEMS)
      init[it.id] = { x: it.x / 1440, y: it.y / BOARD_H };
    return init;
  });
  const [order, setOrder] = useState<string[]>([]);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [built, setBuilt] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [buttonGone, setButtonGone] = useState(false);
  const label = useDecrypt(
    built ? LABEL_DONE : LABEL_USE_BUILDER,
    hover || built,
  );

  const build = () => {
    if (built) return;
    setBuilt(true);
    setGlitch(true);
    setTimeout(
      () => setGlitch(false),
      GLITCH_MS + BUILDER_GLITCH_DELAY * 1000 + (BUILDER_RESULTS.length - 1) * 90,
    );
    setTimeout(() => setButtonGone(true), 4e3);
  };

  const onDown = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (!boardRef.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    (drag.current = { id, dx: e.clientX - box.left, dy: e.clientY - box.top }),
      e.currentTarget.setPointerCapture(e.pointerId),
      setDragging(id),
      setOrder((prev) => [...prev.filter((it) => it !== id), id]);
  };

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const board = boardRef.current;
    if (!state || !board) return;
    const box = board.getBoundingClientRect();
    const item = BUILDER_ITEMS.find((it) => it.id === state.id)!;
    const pxW = (item.w / 1440) * box.width;
    const pxH = (item.h / 1440) * box.width;
    const nx = Math.min(
      Math.max(e.clientX - box.left - state.dx, 0),
      Math.max(0, box.width - pxW),
    );
    const ny = Math.min(
      Math.max(e.clientY - box.top - state.dy, 0),
      Math.max(0, box.height - pxH),
    );
    setPos((prev) => ({
      ...prev,
      [state.id]: { x: nx / box.width, y: ny / box.height },
    }));
  };

  const onUp = (e: React.PointerEvent<HTMLElement>) => {
    (drag.current = null), setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      ref={boardRef}
      style={{
        position: "relative",
        width: "100%",
        height: cq(BOARD_H),
        background: BOARD_BG,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to right, ${BOARD_GRID_MINOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MINOR} 1px, transparent 1px)`,
          backgroundSize: `
            ${cq(BOARD_CELL_BIG)} 100%,
            100% ${cq(BOARD_CELL_BIG)},
            ${cq(BOARD_CELL_SMALL)} 100%,
            100% ${cq(BOARD_CELL_SMALL)}`,
        }}
      />
      {BUILDER_ITEMS.map((item) => {
        const isResult = item.id.startsWith("done_");
        // видна либо «до», либо «после» — в зависимости от состояния сборки
        const visible = isResult === built;
        const art = `url(/yan/builder/${item.id}.webp)`;
        /* гличат только собранные баннеры и только в момент появления:
           0.35 с — пауза, пока разъезжаются исходные части */
        const resultIndex = BUILDER_RESULTS.findIndex((r) => r.id === item.id);
        const glitching = glitch && isResult;
        const delay = BUILDER_GLITCH_DELAY + Math.max(resultIndex, 0) * 0.09;
        return (
          <div
            key={item.id}
            onPointerDown={visible ? onDown(item.id) : undefined}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute",
              left: `${pos[item.id].x * 100}%`,
              top: `${pos[item.id].y * 100}%`,
              width: cq(item.w),
              height: cq(item.h),
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(10px)",
              transition: `opacity .7s ease ${isResult && built ? 0.35 : 0}s, transform .7s cubic-bezier(.22,1,.36,1) ${isResult && built ? 0.35 : 0}s`,
              pointerEvents: visible ? "auto" : "none",
              cursor: dragging === item.id ? "grabbing" : "grab",
              zIndex: 1 + order.indexOf(item.id),
              userSelect: "none",
              touchAction: "none",
            }}
            role="img"
            aria-label={item.name}
          >
            <div
              className={glitching ? "lp-glitch" : undefined}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: art,
                backgroundSize: "100% 100%",
                animationDelay: glitching ? `${delay}s` : undefined,
              }}
            />
            {glitching && (
              <>
                <div
                  aria-hidden
                  className="lp-glitch-slice lp-glitch-slice--cyan"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: art,
                    backgroundSize: "100% 100%",
                    animationDelay: `${delay}s`,
                  }}
                />
                <div
                  aria-hidden
                  className="lp-glitch-slice lp-glitch-slice--magenta"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: art,
                    backgroundSize: "100% 100%",
                    animationDelay: `${delay + 0.075}s`,
                  }}
                />
                <div
                  aria-hidden
                  className="lp-glitch-scan"
                  style={{
                    position: "absolute",
                    inset: "-15% 0",
                    animationDelay: `${delay}s`,
                  }}
                />
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={build}
        onPointerEnter={(e) => {
          e.pointerType === "mouse" &&
            (setHover(true), setCursor({ x: e.clientX, y: e.clientY }));
        }}
        onPointerMove={(e) =>
          e.pointerType === "mouse" && setCursor({ x: e.clientX, y: e.clientY })
        }
        onPointerLeave={(e) => {
          e.pointerType === "mouse" && (setHover(false), setCursor(null));
        }}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: cq(44),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: cq(20),
          height: cq(60),
          padding: `0 ${cq(36)}`,
          borderRadius: cq(6),
          border: `1px solid ${ACCENT}`,
          background:
            hover || built ? "rgba(185,19,114,0.05)" : "rgba(255,255,255,0.04)",
          opacity: buttonGone ? 0 : 1,
          pointerEvents: buttonGone || built ? "none" : "auto",
          transition: "background .3s ease, opacity .7s ease",
          cursor: "none",
          whiteSpace: "nowrap",
          zIndex: 20,
        }}
      >
        <span
          style={{
            display: "block",
            transform: hover || built ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform .35s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <ApproveArrow />
        </span>
        <span
          className="font-bold"
          style={{
            position: "relative",
            display: "inline-block",
            color: "#fff",
            fontSize: cq(23),
            lineHeight: cq(28),
            letterSpacing: cq(1.15),
            textTransform: "uppercase",
          }}
        >
          <span aria-hidden style={{ visibility: "hidden" }}>
            {LABEL_USE_BUILDER}
          </span>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </span>
      </button>
      {cursor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: cursor.x,
              top: cursor.y,
              width: 26,
              height: 26,
              marginLeft: -13,
              marginTop: -13,
              borderRadius: "50%",
              background: ACCENT,
              pointerEvents: "none",
              zIndex: 120,
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/* ───────────────────────────── текстовые блоки кейса ───────────────────── */

const BRAND_BALANCE = {
  title: `Balancing brand identity
with platform requirements`,
  text: [
    "One of the key challenges was bringing advertisers’ visual language together with Yandex Market’s technical requirements and internal design standards. Each campaign had to remain recognizable as part of the advertiser’s brand while also looks like a part of Yandex Market design.",
    "Depending on the task, I adapted existing content, sourced images from stock libraries, or created new visuals using generative tools.",
  ],
};

const SPEEDING_UP = {
  title: `Speeding Up Production
Without Sacrificing Quality`,
  text: [
    "Production speed without losing quality under constant deadlines pressure was really important.",
    "A significant part of the work involved repetitive operations: adapting layouts to different sizes and etc. To reduce the time spent on these processes, we developed a Banner Builder: a system of templates and Figma components. Banner Builder helped to switch quickly between advertising tokens and placement formats.",
    "A large number of tokens and badges helped users navigate content and understand information more quickly. All of these elements had to adapt to different banner sizes and work well with the typography and visuals of each banner. Badges and tokens also evolved over time and changed along with the design system.",
    "Their size and placement were defined by the design guidelines. The Banner Builder system helped to use badges and tokens more efficient according to Yandex Market design guidelines.",
    "As a result, Banner Builder increased content production speed by roughly 30% without losing quality of the final result.",
  ],
};

/** Отступ от подписи под «30% faster» до картинки с токенами */
const TOKENS_TOP = 72;

/** Пропорции картинки Grand Slam */
const GRAND_SLAM_AR = 1200 / 700;
const GRAND_SLAM_W = 374;
/** Пропорции финального панно из баннеров */
const BANNERS_FIN_AR = 2700 / 4800;

const TENNIS_NOTE = `If all the banners I created during this time were laid out at a 1:1 scale,
their combined area would cover one and a half tennis courts.`;

const DESIGN_PERFORMS = {
  title: `Design That
Performs`,
  text: [
    "The key performance indicators for advertising materials were CTR (Click-Through Rate) and CR (Conversion Rate). These metrics made it possible to evaluate how successfully the visual solutions motivate users.",
    "On some projects, I took part in A/B testing, comparing different versions of advertising materials and helping identify the most effective solutions.",
    "Working at Yandex Market was an experience of designing at a large scale, it demanded flexibility, attention to detail, and systems thinking all at once.",
    "The main outcome was not just the thousands of materials I created, but also my contribution to developing the processes, that made design production more effective.",
  ],
};

/**
 * Горизонтальная линейка в 1 физический пиксель.
 * Снэппинг: сдвигаем на дробную часть, чтобы линия не размывалась
 * на дробных координатах (devicePixelRatio).
 */
function Rule({ style }: { style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSnap((prev) => {
        const top = el.getBoundingClientRect().top - prev;
        const dpr = window.devicePixelRatio || 1;
        return Math.round(top * dpr) / dpr - top;
      });
    measure();
    // повторный замер после подгрузки шрифтов
    const timer = setTimeout(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer), window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        ...style,
        height: 1,
        background: DARK,
        transform: `translate3d(0, ${snap}px, 0)`,
      }}
    />
  );
}

/* ──────────────────── 4dev: презентации и отчёты ───────────────────────── */

const DEV4 = { gap: 29, w: 1440, h: 810, top: 64 };

/* ─────────────── pocket photo studio: креативы и сторис ────────────────── */

/** Разметка из макета 1493:9192, координаты — от левого края колонки (240)
    и от верха первого ряда (y 255 во фрейме макета) */
const POCKET = {
  /** отступ от текстового фрейма до первого ряда */
  top: 64,
  shot: { w: 456, h: 570 },
  /** три кадра в ряд, затем два по центру */
  row1: [0, 492, 984],
  row2: { y: 634, x: [246, 738] },
  fin: { y: 1268, w: 1440, h: 1020.97 },
  /** подложка из макета живёт в системе координат всего фрейма */
  back: { left: -240, top: -255, w: 1920, h: 2316, duration: 3 },
};

/** Линии-подложка из макета (слой «back image»): рисуются один раз,
    как только первый кадр доезжает до экрана */
function PocketBack() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const draw = (i: number) => ({
    pathLength: 1,
    strokeDasharray: 1,
    initial: { strokeDashoffset: 1 },
    animate: { strokeDashoffset: inView ? 0 : 1 },
    transition: {
      duration: POCKET.back.duration,
      delay: i * 0.05,
      ease: [0.42, 0, 0.58, 1] as [number, number, number, number],
    },
  });
  const G = "#7B7B7B";
  const R = "#FF2222";
  /* круги и овалы из макета: [cx, cy, r] либо готовый контур */
  const rings: Array<[number, number, number] | string> = [
    [1133.9, 1249.98, 446.331],
    [1195.88, 1168.07, 412.019],
    "M1259.52 709.013C1468.12 709.013 1637.23 878.366 1637.23 1087.27C1637.23 1296.18 1468.12 1465.54 1259.52 1465.54C1050.92 1465.54 881.816 1296.18 881.815 1087.27C881.815 878.366 1050.92 709.013 1259.52 709.013Z",
    "M1322.34 664.74C1511.53 664.74 1664.9 817.866 1664.9 1006.75C1664.9 1195.64 1511.53 1348.76 1322.34 1348.76C1133.14 1348.76 979.771 1195.64 979.771 1006.75C979.771 817.866 1133.14 664.74 1322.34 664.74Z",
    "M1385.7 619.36C1555.49 619.36 1693.12 756.63 1693.12 925.954C1693.12 1095.28 1555.49 1232.55 1385.7 1232.55C1215.91 1232.55 1078.28 1095.28 1078.28 925.954C1078.28 756.63 1215.91 619.36 1385.7 619.36Z",
    "M1449.62 573.149C1600 573.15 1721.9 694.932 1721.9 845.154C1721.9 995.377 1600 1117.16 1449.62 1117.16C1299.24 1117.16 1177.34 995.377 1177.34 845.154C1177.34 694.931 1299.24 573.149 1449.62 573.149Z",
    [1512.71, 764.079, 237.97],
    [1576.08, 684.11, 202.274],
    "M1638.89 435.625C1731.66 435.625 1806.85 510.459 1806.85 602.758C1806.85 695.057 1731.66 769.89 1638.89 769.89C1546.12 769.89 1470.92 695.057 1470.92 602.758C1470.92 510.458 1546.12 435.625 1638.89 435.625Z",
    "M1703.08 388.031C1776.12 388.031 1835.35 447.858 1835.35 521.682C1835.35 595.505 1776.12 655.332 1703.08 655.332C1630.05 655.332 1570.82 595.505 1570.82 521.682C1570.82 447.858 1630.05 388.031 1703.08 388.031Z",
  ];
  /* у части овалов в макете приглушённая обводка */
  const soft = new Set([2, 5, 8]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        left: cq(POCKET.back.left),
        top: cq(POCKET.back.top),
        width: cq(POCKET.back.w),
        height: cq(POCKET.back.h),
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox={`0 0 ${POCKET.back.w} ${POCKET.back.h}`}
        fill="none"
        style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}
      >
        {rings.map((s, i) =>
          typeof s === "string" ? (
            <motion.path
              key={i}
              d={s}
              stroke={G}
              strokeWidth={2.21367}
              opacity={soft.has(i) ? 0.55 : 1}
              {...draw(i)}
            />
          ) : (
            <motion.circle
              key={i}
              cx={s[0]}
              cy={s[1]}
              r={s[2]}
              stroke={G}
              strokeWidth={2.21367}
              {...draw(i)}
            />
          ),
        )}
        <motion.path
          d="M-80.9998 1477.04C-60.6189 1464.95 1358.09 578.389 2064.89 136.622"
          stroke={R}
          strokeWidth={1.66025}
          {...draw(10)}
        />
        <motion.path
          d="M1257.09 2315.48C1264.97 2293.13 1785.29 703.173 2044.47 -89.0145"
          stroke={R}
          strokeWidth={1.66025}
          {...draw(11)}
        />
      </svg>
    </div>
  );
}

function PocketSection() {
  const [stickyRef, stickyTop] = useStickyTop(true);
  const shot = (n: number, x: number, y: number, delay: number) => (
    <FadeUp
      key={n}
      delay={delay}
      style={{
        position: "absolute",
        left: cq(x),
        top: cq(y),
        width: cq(POCKET.shot.w),
        height: cq(POCKET.shot.h),
      }}
    >
      <img
        src={`/pocket/shot_${n}.webp`}
        alt=""
        aria-hidden
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: cq(GZA.radius),
        }}
      />
    </FadeUp>
  );

  return (
    <section
      ref={stickyRef}
      className="select-text"
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 12,
        background: LIGHT,
        paddingTop: cq(FRAME_TOP_TO_RULE),
        paddingBottom: cq(FRAME_TAIL),
      }}
    >
      <TextFrame
        title={"Pocket photo studio\napp creatives"}
        text={[
          "A series of marketing creatives and Instagram Stories for a pocket photo studio app. The application uses Face Swap technology to transform photos of real people into stylish portraits, giving users a way to create professional-looking images without a photo shoot.",
        ]}
        marginTop={0}
      />
      <div
        style={{
          position: "relative",
          marginLeft: cq(240),
          marginTop: cq(POCKET.top),
          width: cq(1440),
          height: cq(POCKET.fin.y + POCKET.fin.h),
        }}
      >
        <PocketBack />
        {POCKET.row1.map((x, i) => shot(i + 1, x, 0, i * 0.1))}
        {POCKET.row2.x.map((x, i) => shot(i + 4, x, POCKET.row2.y, i * 0.1))}
        <FadeUp
          style={{
            position: "absolute",
            left: 0,
            top: cq(POCKET.fin.y),
            width: cq(POCKET.fin.w),
            height: cq(POCKET.fin.h),
          }}
        >
          <img
            src="/pocket/fin.webp"
            alt=""
            aria-hidden
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: cq(GZA.radius),
            }}
          />
        </FadeUp>
      </div>
    </section>
  );
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u043b\u0435\u043d\u0434\u0438\u043d\u0433\u0438 \u0438 \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u0438 \u0434\u043b\u044f \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u043e\u0439 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** \u0414\u0432\u0435 \u043a\u043e\u043b\u043e\u043d\u043a\u0438: \u0441\u043b\u0435\u0432\u0430 1, 3, 4; \u0441\u043f\u0440\u0430\u0432\u0430 \u2014 \u0432\u044b\u0441\u043e\u043a\u0438\u0439 \u043b\u0435\u043d\u0434\u0438\u043d\u0433 2 */
const REFUND = { top: 64, gap: 36, col: (1440 - 36) / 2 };

function RefundSection() {
  const [stickyRef, stickyTop] = useStickyTop(true);
  const shot = (n: number, delay: number) => (
    <FadeUp key={n} delay={delay} style={{ marginTop: n === 1 || n === 2 ? 0 : cq(REFUND.gap) }}>
      <img
        src={`/refund/shot_${n}.webp`}
        alt=""
        aria-hidden
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: cq(GZA.radius),
        }}
      />
    </FadeUp>
  );

  return (
    <section
      ref={stickyRef}
      className="select-text"
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 13,
        background: LIGHT,
        paddingTop: cq(FRAME_TOP_TO_RULE),
        paddingBottom: cq(FRAME_TAIL),
      }}
    >
      <TextFrame
        title={"Landing Pages\n& Presentations"}
        text={[
          "A series of landing pages and presentations designed for a financial platform",
        ]}
        marginTop={0}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: cq(REFUND.gap),
          marginLeft: cq(240),
          marginTop: cq(REFUND.top),
          width: cq(1440),
        }}
      >
        <div style={{ width: cq(REFUND.col) }}>
          {shot(1, 0)}
          {shot(3, 0.1)}
          {shot(4, 0.2)}
        </div>
        <div style={{ width: cq(REFUND.col) }}>{shot(2, 0.1)}</div>
      </div>
    </section>
  );
}

/* ──────────── превью и промо-материалы для спортивной игры ────────────── */

/** Два квадрата в ряд, широкий кадр под ними и сетка 2×2 из тест-задания */
const THUMBS = { top: 64, gap: 36, col: (1440 - 36) / 2 };

function ThumbsSection() {
  const [stickyRef, stickyTop] = useStickyTop(true);
  const pic = (src: string, delay: number, top = 0) => (
    <FadeUp key={src} delay={delay} style={{ marginTop: cq(top) }}>
      <img
        src={`/thumbs/${src}.webp`}
        alt=""
        aria-hidden
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: cq(GZA.radius),
        }}
      />
    </FadeUp>
  );
  const cols = (left: string[], right: string[], top: number) => (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: cq(THUMBS.gap),
        marginTop: cq(top),
      }}
    >
      <div style={{ width: cq(THUMBS.col) }}>
        {left.map((s, i) => pic(s, i * 0.1, i === 0 ? 0 : THUMBS.gap))}
      </div>
      <div style={{ width: cq(THUMBS.col) }}>
        {right.map((s, i) => pic(s, 0.1 + i * 0.1, i === 0 ? 0 : THUMBS.gap))}
      </div>
    </div>
  );

  return (
    <section
      ref={stickyRef}
      className="select-text"
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 14,
        background: LIGHT,
        paddingTop: cq(FRAME_TOP_TO_RULE),
        paddingBottom: cq(FRAME_TAIL),
      }}
    >
      <TextFrame
        title={"Thumbnails\nand promotion materials"}
        text={[
          "Content for a sports video game. All 3D scenes were created in Blender 3D, with post-processing done in Photoshop and Figma.",
        ]}
        marginTop={0}
      />
      <div style={{ marginLeft: cq(240), marginTop: cq(THUMBS.top), width: cq(1440) }}>
        {cols(["thumb_1"], ["thumb_2"], 0)}
        {pic("thumb_3", 0.1, THUMBS.gap)}
        {cols(["task_1", "task_2"], ["task_3", "task_4"], THUMBS.gap)}
      </div>
    </section>
  );
}

/* ─────────────────────────── пет-проект: портреты ─────────────────────── */

/** Кнопка как «2 cats tavern» на странице About me, но на светлом фоне:
    в покое подпись и стрелка тёмно-синие, по наведению заливка маджентой */
const PET_BTN = { w: 218, h: 34, radius: 4, arrow: 13, arrowX: 16, labelX: 44 };

/* На About me кнопка держит натуральный размер, пока сетка не начнёт сжиматься
   (ниже 1400), — повторяем это поведение, иначе здесь кнопка выглядит тоньше */
const pb = (v: number) => `min(${v}px, ${((v / 1400) * 100).toFixed(4)}cqw)`;

function PosterButton() {
  const [hover, setHover] = useState(false);
  return (
    <a
      href="https://drive.google.com/file/d/1Nsvu7FVF_xwr5p_jkigLiwjsTcSNnvX1/view?usp=sharing"
      target="_blank"
      rel="noreferrer noopener"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      style={{
        position: "relative",
        display: "block",
        width: pb(PET_BTN.w),
        height: pb(PET_BTN.h),
        background: hover ? ACCENT : FILL_SOFT,
        border: `1px solid ${ACCENT}`,
        borderRadius: pb(PET_BTN.radius),
        boxSizing: "border-box",
        textDecoration: "none",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          left: pb(PET_BTN.arrowX),
          top: pb((PET_BTN.h - PET_BTN.arrow) / 2),
        }}
        animate={{ rotate: hover ? 45 : 0 }}
        transition={{ duration: 0.8, ease: EASE_OUT }}
      >
        <FooterArrow size={pb(PET_BTN.arrow)} color={hover ? "#fff" : DARK} />
      </motion.div>
      <div
        className="font-normal"
        style={{
          position: "absolute",
          left: pb(PET_BTN.labelX),
          top: pb(8),
          color: hover ? "#fff" : DARK,
          fontSize: pb(15),
          lineHeight: pb(18),
          letterSpacing: pb(0.45),
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        poster creation
      </div>
    </a>
  );
}

function PetSection() {
  const pic = (n: number, delay: number) => (
    <div key={n} style={{ width: cq(THUMBS.col) }}>
      <FadeUp delay={delay}>
        <img
          src={`/pet/shot_${n}.webp`}
          alt=""
          aria-hidden
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            borderRadius: cq(GZA.radius),
          }}
        />
      </FadeUp>
    </div>
  );

  return (
    <section
      className="select-text"
      style={{
        position: "relative",
        zIndex: 15,
        background: LIGHT,
        paddingTop: cq(FRAME_TOP_TO_RULE),
        paddingBottom: cq(MOSAIC_TAIL),
      }}
    >
      <TextFrame
        title={"Pet-project"}
        text={[
          "Some time ago, I started drawing custom portraits. What began as a small hobby gradually grew into a personal project.",
          "I built a website with an artwork gallery, where visitors could contact me directly and make an order. After the order was placed, I drew the portrait, printed it on canvas, and shipped it to the customer.",
          "It was a fun way to combine my love for drawing with running a small creative project of my own.",
        ]}
        marginTop={0}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: cq(THUMBS.gap),
          marginLeft: cq(240),
          marginTop: cq(THUMBS.top),
          width: cq(1440),
        }}
      >
        <div style={{ width: cq(THUMBS.col) }}>
          <FadeUp>
            <img
              src="/pet/shot_1.webp"
              alt=""
              aria-hidden
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                borderRadius: cq(GZA.radius),
              }}
            />
          </FadeUp>
          <FadeUp
            delay={0.1}
            className="font-light"
            style={{
              marginTop: cq(THUMBS.gap),
              color: INK,
              fontSize: cq(23),
              lineHeight: cq(32),
            }}
          >
            For example, here is a poster I made for the Terras Gauda artwork
            competition. Take a look at the creation process, step by step:
          </FadeUp>
          <FadeUp delay={0.2} style={{ marginTop: cq(32) }}>
            <PosterButton />
          </FadeUp>
        </div>
        {pic(2, 0.1)}
      </div>
    </section>
  );
}

/** \u041e\u0442\u0441\u0442\u0443\u043f \u043e\u0442 \u0432\u0435\u0440\u0445\u043d\u0435\u0433\u043e \u043a\u0440\u0430\u044f \u0444\u0440\u0435\u0439\u043c\u0430 \u0434\u043e \u043b\u0438\u043d\u0435\u0439\u043a\u0438 \u2014 \u0442\u0430\u043a\u043e\u0439 \u0436\u0435, \u043a\u0430\u043a \u0432 \u0448\u0430\u043f\u043a\u0435 \u043a\u0435\u0439\u0441\u0430 */
const FRAME_TOP_TO_RULE = 35;
/** \u0412\u043e\u0437\u0434\u0443\u0445 \u0432 \u043a\u043e\u043d\u0446\u0435 \u00ab\u0441\u043b\u043e\u0451\u043d\u043e\u0433\u043e\u00bb \u0444\u0440\u0435\u0439\u043c\u0430 \u2014 \u043a\u0430\u043a \u043e\u0442 \u0432\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u044f \u0434\u043e \u043b\u0438\u043d\u0435\u0439\u043a\u0438 \u043f\u043e\u0434 \u043d\u0438\u043c */
const FRAME_TAIL = 156;

/** \u0424\u0440\u0435\u0439\u043c \u043e\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f, \u0443\u043f\u0451\u0440\u0448\u0438\u0441\u044c \u043d\u0438\u0436\u043d\u0435\u0439 \u043a\u0440\u043e\u043c\u043a\u043e\u0439 \u0432 \u043d\u0438\u0437 \u044d\u043a\u0440\u0430\u043d\u0430, \u2014
    \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u043d\u0430\u0435\u0437\u0436\u0430\u0435\u0442 \u043d\u0430 \u043d\u0435\u0433\u043e \u0441\u043b\u043e\u0435\u043c. \u0421\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043e\u0442 \u0432\u044b\u0441\u043e\u0442\u044b \u0444\u0440\u0435\u0439\u043c\u0430. */
function useStickyTop(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const measure = () =>
      setTop(Math.min(0, window.innerHeight - el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);
  return [ref, top] as const;
}

function Dev4Section() {
  const [ref, top] = useStickyTop(true);
  return (
    <section
      ref={ref}
      className="select-text"
      style={{
        position: "sticky",
        top,
        zIndex: 11,
        background: LIGHT,
        paddingTop: cq(FRAME_TOP_TO_RULE),
        paddingBottom: cq(FRAME_TAIL),
      }}
    >
      <TextFrame
        title={"Presentations, stats\n& financial reports"}
        text={[
          "For the 4dev.com platform, I created reports and presentations with statistics and analytical content, adapting them to the company\u2019s design guidelines. I also worked with marketing creatives and content for email campaigns.",
          "Since the information is under NDA, some text has been replaced with Lorem Ipsum.",
        ]}
        marginTop={0}
      />
      <div style={{ marginLeft: cq(240), width: cq(DEV4.w), marginTop: cq(DEV4.top) }}>
        {[1, 2].map((n) => (
          <FadeUp key={n} delay={(n - 1) * 0.1} style={{ marginTop: n === 1 ? 0 : cq(DEV4.gap) }}>
            <img
              src={`/dev4/shot_${n}.webp`}
              alt=""
              aria-hidden
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                borderRadius: cq(GZA.radius),
              }}
            />
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── блок про Gza под текстом ────────────────────── */

/** Разметка из макета: карточка логотипа и кадр телефона в ряд, под ними
    полоса из восьми знаков, справа — синяя обложка. */
const GZA = {
  top: 64,
  h: 1949,
  radius: 12.8,
  card: { x: 0, y: 0, w: 413.38, h: 383.4 },
  phone: { x: 436.96, y: 0, w: 418.29, h: 383.08 },
  icons: { y: 406.08, size: 94.46, step: 108.76, count: 8 },
  cover: { x: 878, y: 0, w: 562, h: 501 },
  /* четыре экрана приложения в ряд */
  screens: { y: 565, w: 307, h: 620, step: 377.67, count: 4 },
  /* широкий кадр под ними: чернильная маска проявляет картинку */
  fin: { y: 1249, w: 1440, h: 700 },
  /* телефон справа и текстовый блок слева появляются поверх кадра */
  /* телефон крупнее кадра: верх прижат, низ уходит за кромку */
  shade: { right: 110, top: 28, h: 790, ratio: 1134 / 1795 },
  title: { left: 150, w: 500, size: 110, rule: 280, slogan: 30 },
};
/** когда после старта проявления выезжают телефон и заголовок, с */
const GZA_DELAY = { phone: 2, title: 3 };

/** Проявление финального кадра: видео-маска, затем телефон и заголовок.
    Играет один раз — когда блок доезжает до экрана. */
function GzaReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    videoRef.current?.play().catch(() => {});
  }, [inView]);

  const appear = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    transition: { duration: 1.1, delay, ease: EASE_SOFT },
  });

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        top: cq(GZA.fin.y),
        width: cq(GZA.fin.w),
        height: cq(GZA.fin.h),
        borderRadius: cq(GZA.radius),
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={() => setDone(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      >
        <source src="/gza/reveal.webm" type="video/webm" />
        <source src="/gza/reveal.mp4" type="video/mp4" />
      </video>

      {/* когда проявление закончилось, подменяем кадр чёткой картинкой */}
      <img
        src="/gza/image_fin.webp"
        alt="Gza app — final visual"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: done ? 1 : 0,
          transition: "opacity 400ms linear",
        }}
      />

      <motion.img
        src="/gza/phone_shade.webp"
        alt=""
        aria-hidden
        {...appear(GZA_DELAY.phone)}
        style={{
          position: "absolute",
          right: cq(GZA.shade.right),
          top: cq(GZA.shade.top),
          height: cq(GZA.shade.h),
          width: cq(GZA.shade.h * GZA.shade.ratio),
        }}
      />

      <div
        style={{
          position: "absolute",
          left: cq(GZA.title.left),
          top: 0,
          width: cq(GZA.title.w),
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: DARK,
          fontFamily: '"Cormorant Garamond", serif',
          textAlign: "center",
        }}
      >
        <motion.span
          {...appear(GZA_DELAY.title)}
          style={{
            display: "block",
            fontWeight: 700,
            fontSize: cq(GZA.title.size),
            lineHeight: 1,
            letterSpacing: cq(4),
          }}
        >
          GZA
        </motion.span>
        <motion.span
          aria-hidden
          className="origin-center"
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{
            duration: 1,
            delay: GZA_DELAY.title + 0.35,
            ease: EASE_SOFT,
          }}
          style={{
            display: "block",
            width: cq(GZA.title.rule),
            height: 1,
            margin: `${cq(22)} 0`,
            background: DARK,
          }}
        />
        <motion.span
          {...appear(GZA_DELAY.title + 0.7)}
          style={{
            display: "block",
            fontWeight: 400,
            fontSize: cq(GZA.title.slogan),
            lineHeight: cq(38),
          }}
        >
          Follow the path less mapped
        </motion.span>
      </div>
    </div>
  );
}

/** Синяя лента из макета: проходит за экранами приложения и уходит
    за края страницы. Координаты — в системе блока Gza. */
const GZA_LINE = {
  x: -711,
  y: 663.74,
  w: 2682.5,
  h: 363.26,
  /** толщина обводки: половина выходит за габариты контура */
  stroke: 200,
  color: "#1393FF",
  duration: 3,
  d: "M 0 294.257 C 0 294.257 424.661 -64.539 624.5 10.257 C 778.924 68.055 898 294.257 898 294.257 C 898 294.257 1267.143 19.226 1561.5 54.257 C 1766.504 78.654 1961 363.257 1961 363.257 L 2682.5 79.257",
};

/** Лента отрисовывается слева направо один раз — когда доезжает до экрана */
function GzaLine() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const pad = GZA_LINE.stroke / 2;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        left: cq(GZA_LINE.x - pad),
        top: cq(GZA_LINE.y - pad),
        width: cq(GZA_LINE.w + GZA_LINE.stroke),
        height: cq(GZA_LINE.h + GZA_LINE.stroke),
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox={`${-pad} ${-pad} ${GZA_LINE.w + GZA_LINE.stroke} ${GZA_LINE.h + GZA_LINE.stroke}`}
        style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}
      >
        <motion.path
          d={GZA_LINE.d}
          pathLength={1}
          fill="none"
          stroke={GZA_LINE.color}
          strokeWidth={GZA_LINE.stroke}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeDasharray={1}
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: inView ? 0 : 1 }}
          transition={{ duration: GZA_LINE.duration, ease: [0.42, 0, 0.58, 1] }}
        />
      </svg>
    </div>
  );
}

function GzaBlock() {
  return (
    <div
      style={{
        position: "relative",
        marginLeft: cq(240),
        marginTop: cq(GZA.top),
        width: cq(1440),
        height: cq(GZA.h),
      }}
    >
      <FadeUp
        style={{
          position: "absolute",
          left: cq(GZA.card.x),
          top: cq(GZA.card.y),
          width: cq(GZA.card.w),
        }}
      >
        <img
          src="/gza/logo_card.webp"
          alt="Gza — application logo concept"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </FadeUp>

      <FadeUp
        delay={0.1}
        style={{
          position: "absolute",
          left: cq(GZA.phone.x),
          top: cq(GZA.phone.y),
          width: cq(GZA.phone.w),
          height: cq(GZA.phone.h),
        }}
      >
        <img
          src="/icon_render_1.jpg"
          alt="Gza app icon on the home screen"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: cq(GZA.radius),
          }}
        />
      </FadeUp>

      {Array.from({ length: GZA.icons.count }, (_, i) => (
        <FadeUp
          key={i}
          delay={0.15 + i * 0.05}
          style={{
            position: "absolute",
            left: cq(i * GZA.icons.step),
            top: cq(GZA.icons.y),
            width: cq(GZA.icons.size),
            height: cq(GZA.icons.size),
          }}
        >
          <img
            src={`/gza/icon_${i + 1}.svg`}
            alt=""
            aria-hidden
            style={{ display: "block", width: "100%", height: "100%" }}
          />
        </FadeUp>
      ))}

      <FadeUp
        delay={0.1}
        style={{
          position: "absolute",
          left: cq(GZA.cover.x),
          top: cq(GZA.cover.y),
          width: cq(GZA.cover.w),
          height: cq(GZA.cover.h),
        }}
      >
        <img
          src="/gza/cover.webp"
          alt="Gza app — follow the path less mapped"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: cq(GZA.radius),
          }}
        />
      </FadeUp>

      {/* лента за экранами приложения */}
      <GzaLine />

      {/* четыре экрана приложения */}
      {Array.from({ length: GZA.screens.count }, (_, i) => (
        <FadeUp
          key={`screen-${i}`}
          delay={i * 0.1}
          style={{
            position: "absolute",
            left: cq(i * GZA.screens.step),
            top: cq(GZA.screens.y),
            width: cq(GZA.screens.w),
            height: cq(GZA.screens.h),
          }}
        >
          <img
            src={`/gza/phone_${i + 1}.webp`}
            alt=""
            aria-hidden
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
          />
        </FadeUp>
      ))}

      {/* финальный кадр: чернильная маска проявляет картинку, следом
          приходят телефон и заголовок */}
      <GzaReveal />
    </div>
  );
}

/* ───────────────────────────── подвал страницы проекта ─────────────────── */

/** Кнопки подвала: макет тёмный, здесь фон светлый — подпись и стрелка
    в покое тёмно-синие, по наведению кнопка заливается маджентой */
const FOOTER_BTN = {
  h: 64,
  radius: 4,
  arrow: 18,
  arrowX: 23,
  arrowY: 22,
  labelX: 58,
  size: 15,
  lh: 18,
  ls: 0.45,
};
const FOOTER = { back: 242, contacts: 169, gap: 23, ruleToButtons: 48, bottom: 120 };

/** Уголок-стрелка ↗ из макета */
function FooterArrow({ size, color }: { size: string; color: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      style={{ width: size, height: size, display: "block" }}
    >
      <g stroke={color} strokeWidth="3" fill="none">
        <path d="M0 1.5 H32" />
        <path d="M30.5 3 V32" />
        <path d="M1.1 30.9 L30.9 1.1" />
      </g>
    </svg>
  );
}

function FooterButton({
  label,
  width,
  onClick,
}: {
  label: string;
  width: number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const ink = hover ? "#fff" : ACCENT;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      style={{
        position: "relative",
        display: "block",
        width: cq(width),
        height: cq(FOOTER_BTN.h),
        padding: 0,
        borderRadius: cq(FOOTER_BTN.radius),
        border: `1px solid ${ACCENT}`,
        background: hover ? ACCENT : FILL_SOFT,
        cursor: "pointer",
        transition: "background-color 420ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: cq(FOOTER_BTN.arrowX),
          top: cq(FOOTER_BTN.arrowY),
          transform: `rotate(${hover ? -90 : 0}deg)`,
          transition: "transform 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <FooterArrow size={cq(FOOTER_BTN.arrow)} color={ink} />
      </div>
      <span
        className="font-normal uppercase"
        style={{
          position: "absolute",
          left: cq(FOOTER_BTN.labelX),
          top: cq(FOOTER_BTN.arrowY),
          color: hover ? "#fff" : DARK,
          fontSize: cq(FOOTER_BTN.size),
          lineHeight: cq(FOOTER_BTN.lh),
          letterSpacing: cq(FOOTER_BTN.ls),
          whiteSpace: "nowrap",
          transition: "color 420ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** Линейка, две кнопки слева и копирайт справа в конце страницы проекта */
function ProjectFooter({
  onBack,
  onContacts,
}: {
  onBack: () => void;
  onContacts: () => void;
}) {
  return (
    <div
      style={{
        marginLeft: cq(240),
        width: cq(1440),
        /* у последней секции каждой страницы уже есть свой отступ снизу,
           поэтому собственного верхнего здесь нет: до линейки везде
           ровно SECTION_GAP, как между блоками кейса */
        paddingBottom: cq(FOOTER.bottom),
      }}
    >
      <Rule style={{ width: "100%" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: cq(FOOTER.ruleToButtons),
        }}
      >
        <div style={{ display: "flex", gap: cq(FOOTER.gap) }}>
          <FooterButton label="Back to Projects" width={FOOTER.back} onClick={onBack} />
          <FooterButton label="Contacts" width={FOOTER.contacts} onClick={onContacts} />
        </div>
        <span
          className="font-normal uppercase"
          style={{
            color: "rgba(5,28,46,0.7)",
            fontSize: cq(12),
            lineHeight: cq(16),
            letterSpacing: cq(1.68),
            whiteSpace: "nowrap",
          }}
        >
          2026 &copy; MakS Novikov
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────── рассказ про процесс ─────────────────────── */

/** Промежуток между тремя фотографиями в ряд */
const PHOTO_GAP = 29;
const PHOTO_SIZE = (1440 - 2 * PHOTO_GAP) / 3;
/** Тонкая линия схем на светлом фоне */
const LINE_SOFT = "rgba(5,28,46,0.22)";
/** Заливка карточек схем */
const FILL_SOFT = "rgba(5,28,46,0.04)";

/** Вертикальный ритм между блоками кейса */
const SECTION_GAP = 164;

/* Крупная цифра статистики */
const STAT_FONT_SIZE = 52;
const STAT_LINE_HEIGHT = 60;
/** Длительность count-up, с */
const COUNTUP_DURATION = 2.8;

/**
 * Count-up: из строки вида «12,000+» вытаскиваем число, крутим его
 * из нуля с ease-out-cubic, префикс и суффикс оставляем как есть.
 */
function CountUp({ value }: { value: string }) {
  const parts = /^(\D*)([\d.,]+)(.*)$/.exec(value);
  const raw = parts?.[2] ?? "";
  const target = Number(raw.replace(/,/g, ""));
  const grouped = raw.includes(",");
  const [shown, setShown] = useState(0);
  const started = useRef(false);

  if (!parts || !Number.isFinite(target)) return <>{value}</>;

  const start = () => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / (COUNTUP_DURATION * 1e3));
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3)))),
        p < 1 && requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return (
    <motion.span
      style={{ display: "inline-block" }}
      onViewportEnter={start}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
    >
      {parts[1]}
      {grouped ? shown.toLocaleString("en-US") : String(shown)}
      {parts[3]}
    </motion.span>
  );
}

/** Весь рассказ про производство в Yandex Market: схемы, доски, чат, фото */
function MarketProcess() {
  return (
    <section
      className="relative z-20 select-text"
      style={{ paddingBottom: cq(SECTION_GAP), background: LIGHT }}
      aria-label="How a standard assignment is handled"
    >
      <div style={{ marginLeft: cq(240), width: cq(1440) }}>
        <Rule style={{ width: "100%" }} />
        <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
          <FadeUp
            className="font-bold"
            style={{
              width: cq(480),
              marginTop: cq(0.98),
              paddingRight: cq(40),
              color: DARK,
              fontSize: cq(22.93),
              lineHeight: cq(30),
              textTransform: "uppercase",
              whiteSpace: "pre-line",
            }}
          >
            {BRAND_BALANCE.title}
          </FadeUp>
          <div
            style={{
              width: cq(960),
              display: "flex",
              flexDirection: "column",
              gap: cq(32),
            }}
          >
            {BRAND_BALANCE.text.map((p, i) => (
              <FadeUp
                key={i}
                className="font-light"
                delay={0.1 + i * 0.1}
                style={{
                  color: INK,
                  fontSize: cq(23),
                  lineHeight: cq(32),
                  textAlign: "left",
                }}
              >
                {p}
              </FadeUp>
            ))}
          </div>
        </div>

        {/* схема «как устроен типовой заказ» + петля возврата */}
        <motion.div
          style={{ marginTop: cq(SECTION_GAP) }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
        >
          <div
            style={{ display: "flex", alignItems: "stretch", width: "100%" }}
          >
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.num} style={{ display: "contents" }}>
                {i > 0 && (
                  <div
                    aria-hidden
                    style={{
                      width: cq(PROCESS_GAP),
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: LINE_SOFT }} />
                    <svg
                      viewBox="0 0 15 18"
                      style={{ width: cq(15), height: cq(18), display: "block" }}
                    >
                      <path d="M0 0 L15 9 L0 18 Z" fill={ACCENT} />
                    </svg>
                  </div>
                )}
                <div
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    position: "relative",
                    border: `1px solid ${LINE_SOFT}`,
                    background: FILL_SOFT,
                    borderRadius: cq(6),
                    padding: `${cq(26)} ${cq(22)} ${cq(26)}`,
                  }}
                >
                  <p
                    className="font-normal"
                    style={{
                      color: ACCENT,
                      fontSize: cq(12),
                      lineHeight: cq(16),
                      letterSpacing: cq(1.73),
                      textTransform: "uppercase",
                    }}
                  >
                    {step.num}
                  </p>
                  <p
                    className="font-semibold"
                    style={{
                      marginTop: cq(4),
                      color: DARK,
                      fontSize: cq(22.93),
                      lineHeight: cq(30),
                      letterSpacing: cq(0.23),
                      textTransform: "uppercase",
                    }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="font-normal"
                    style={{
                      marginTop: cq(14),
                      color: DARK,
                      fontSize: cq(12),
                      lineHeight: cq(16),
                      letterSpacing: cq(1.73),
                      textTransform: "uppercase",
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* петля: от шага 4 вниз, влево к шагу 2 и стрелкой вверх */}
          <div
            style={{ position: "relative", height: cq(LOOP_H), width: "100%" }}
          >
            <div
              style={{
                position: "absolute",
                left: `${(stepCenter(3) / 1440) * 100}%`,
                top: 0,
                width: 1,
                height: cq(LOOP_H),
                background: LINE_SOFT,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(stepCenter(1) / 1440) * 100}%`,
                width: `${((stepCenter(3) - stepCenter(1)) / 1440) * 100}%`,
                top: cq(LOOP_H),
                height: 1,
                background: LINE_SOFT,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(stepCenter(1) / 1440) * 100}%`,
                top: cq(LOOP_ARROW_H),
                width: 1,
                height: cq(LOOP_H - LOOP_ARROW_H),
                background: LINE_SOFT,
              }}
            />
            <svg
              viewBox="0 0 18 15"
              style={{
                position: "absolute",
                left: `${(stepCenter(1) / 1440) * 100}%`,
                marginLeft: cq(-9),
                top: 0,
                width: cq(18),
                height: cq(15),
                display: "block",
              }}
            >
              <path d="M0 15 L18 15 L9 0 Z" fill={ACCENT} />
            </svg>
            <p
              className="font-normal"
              style={{
                position: "absolute",
                left: `${(stepCenter(1) / 1440) * 100}%`,
                width: `${((stepCenter(3) - stepCenter(1)) / 1440) * 100}%`,
                top: cq(LOOP_H - 40),
                whiteSpace: "pre-line",
                color: DARK,
                fontSize: cq(12),
                lineHeight: cq(16),
                letterSpacing: cq(1.73),
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {`If not approved —
repeat step 2 and 3`}
            </p>
          </div>
        </motion.div>

        {/* текст про ресайзы + дерево пакетов */}
        <div style={{ display: "flex", marginTop: cq(SECTION_GAP) }}>
          <div
            style={{
              width: cq(700),
              display: "flex",
              flexDirection: "column",
              gap: cq(32),
            }}
          >
            {RESIZE_TEXT.map((p, i) => (
              <FadeUp
                key={i}
                className="font-light"
                delay={i * 0.1}
                style={{
                  color: INK,
                  fontSize: cq(23),
                  lineHeight: cq(32),
                  textAlign: "left",
                }}
              >
                {p}
              </FadeUp>
            ))}
          </div>
          <motion.div
            style={{
              marginLeft: cq(80),
              width: cq(RESIZE_TREE_W),
              height: cq(RESIZE_TREE_H),
              position: "relative",
            }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.8, ease: EASE_SOFT }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: cq(215),
                width: cq(TREE_TRUNK_X - 1),
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  gap: cq(11),
                  padding: `${cq(7)} ${cq(18)}`,
                  borderRadius: cq(6),
                  border: `1px solid ${LINE_SOFT}`,
                  background: FILL_SOFT,
                  whiteSpace: "nowrap",
                }}
              >
                <svg
                  viewBox="0 0 18 18"
                  aria-hidden
                  style={{ width: cq(18), height: cq(18), display: "block" }}
                >
                  <rect
                    x="1"
                    y="1"
                    width="16"
                    height="16"
                    rx="3"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2"
                  />
                  <path
                    d="M4.5 9.2 L7.6 12.3 L14 5.6"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2"
                  />
                </svg>
                <span
                  className="font-light"
                  style={{
                    color: DARK,
                    fontSize: cq(15),
                    lineHeight: cq(21),
                  }}
                >
                  Approved Master Banner
                </span>
              </div>
              <div
                aria-hidden
                style={{ flex: 1, height: 1, background: LINE_SOFT }}
              />
              <svg
                viewBox="0 0 11 13"
                aria-hidden
                style={{
                  flex: "0 0 auto",
                  width: cq(11),
                  height: cq(13),
                  display: "block",
                }}
              >
                <path d="M0 0 L11 6.5 L0 13 Z" fill={ACCENT} />
              </svg>
            </div>
            {/* ствол дерева */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: cq(TREE_TRUNK_X),
                top: cq(TREE_FIRST_Y),
                width: 1,
                height: cq((RESIZE_PACK_LABELS.length - 1) * TREE_ROW_H),
                background: LINE_SOFT,
              }}
            />
            {RESIZE_PACK_LABELS.map((label, i) => {
              const y = TREE_FIRST_Y + i * TREE_ROW_H;
              return (
                <div key={label}>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: cq(TREE_TRUNK_X),
                      top: cq(y),
                      width: cq(58),
                      height: 1,
                      background: LINE_SOFT,
                    }}
                  />
                  <svg
                    viewBox="0 0 11 13"
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: cq(420),
                      top: cq(y - 6.5),
                      width: cq(11),
                      height: cq(13),
                      display: "block",
                    }}
                  >
                    <path d="M0 0 L11 6.5 L0 13 Z" fill={ACCENT} />
                  </svg>
                  <span
                    className="font-light"
                    style={{
                      position: "absolute",
                      left: cq(TREE_LABEL_X),
                      top: cq(y - 16.5),
                      display: "inline-flex",
                      alignItems: "center",
                      padding: `${cq(5)} ${cq(18)}`,
                      borderRadius: cq(6),
                      border: `1px solid ${LINE_SOFT}`,
                      background: FILL_SOFT,
                      color: DARK,
                      fontSize: cq(15),
                      lineHeight: cq(21),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>

        <FadeUp
          className="font-normal"
          style={{
            marginTop: cq(71 - 7.16 + 1.9),
            marginLeft: "auto",
            marginRight: "auto",
            width: cq(760),
            color: DARK,
            fontSize: cq(22.93),
            lineHeight: cq(30),
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {RESIZE_BOARD_NOTE}
        </FadeUp>

        <motion.div
          style={{ marginTop: cq(152 - 123.84) }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
        >
          <ResizeBoard />
        </motion.div>

        {/* гайдлайны + папка */}
        <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
          <div
            style={{
              width: cq(700),
              display: "flex",
              flexDirection: "column",
              gap: cq(32),
            }}
          >
            {GUIDELINE_TEXT.map((p, i) => (
              <FadeUp
                key={i}
                className="font-light"
                delay={i * 0.1}
                style={{
                  color: INK,
                  fontSize: cq(23),
                  lineHeight: cq(32),
                  textAlign: "left",
                }}
              >
                {p}
              </FadeUp>
            ))}
          </div>
          <div
            style={{
              width: cq(740),
              display: "flex",
              justifyContent: "center",
            }}
          >
            <GuidelineFolder />
          </div>
        </div>

        <div style={{ marginTop: cq(SECTION_GAP) }}>
          <GuideChat />
        </div>

        {/* три фотографии в ряд */}
        <div
          style={{ display: "flex", gap: cq(PHOTO_GAP), marginTop: cq(SECTION_GAP) }}
        >
          {[1, 2, 3].map((n, i) => (
            <motion.img
              key={n}
              src={`/yan/exp_${n}.webp`}
              alt=""
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 0.8, ease: EASE_SOFT, delay: i * 0.12 }}
              style={{
                width: cq(PHOTO_SIZE),
                height: cq(PHOTO_SIZE),
                borderRadius: cq(12),
                display: "block",
                maxWidth: "none",
                objectFit: "cover",
              }}
            />
          ))}
        </div>

        <Rule style={{ width: "100%", marginTop: cq(SECTION_GAP) }} />

        {/* ускорение производства + 30% FASTER */}
        <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
          <div style={{ width: cq(480), paddingRight: cq(40) }}>
            <FadeUp
              className="font-bold"
              style={{
                marginTop: cq(0.98),
                color: DARK,
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
                whiteSpace: "pre-line",
              }}
            >
              {SPEEDING_UP.title}
            </FadeUp>
            <FadeUp delay={0.2} style={{ marginTop: cq(72) }}>
              <span
                className="font-semibold"
                style={{
                  display: "block",
                  color: DARK,
                  fontSize: cq(STAT_FONT_SIZE),
                  lineHeight: cq(STAT_LINE_HEIGHT),
                  letterSpacing: cq(2.63),
                  textTransform: "uppercase",
                }}
              >
                <CountUp value="30% faster" />
              </span>
              <span
                className="font-light"
                style={{
                  display: "block",
                  marginTop: cq(10),
                  color: DARK,
                  fontSize: cq(12),
                  lineHeight: cq(16),
                  letterSpacing: cq(1.73),
                  textTransform: "uppercase",
                }}
              >
                {
                  "Production speed with banner builder (well, approximately — it’s really tough to count)"
                }
              </span>
            </FadeUp>
            {/* токены и бейджи — слева от текста про них */}
            <FadeUp delay={0.3} style={{ marginTop: cq(TOKENS_TOP) }}>
              <img
                src="/yan/tokens.webp"
                alt=""
                aria-hidden
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  borderRadius: cq(16),
                }}
              />
            </FadeUp>
          </div>
          <div
            style={{
              width: cq(960),
              display: "flex",
              flexDirection: "column",
              gap: cq(32),
            }}
          >
            {SPEEDING_UP.text.map((p, i) => (
              <FadeUp
                key={i}
                className="font-light"
                delay={i * 0.1}
                style={{
                  color: INK,
                  fontSize: cq(23),
                  lineHeight: cq(32),
                  textAlign: "left",
                }}
              >
                {p}
              </FadeUp>
            ))}
          </div>
        </div>

        <FadeUp
          className="font-normal"
          style={{
            marginTop: cq(SECTION_GAP),
            marginLeft: "auto",
            marginRight: "auto",
            width: cq(760),
            color: DARK,
            fontSize: cq(22.93),
            lineHeight: cq(30),
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {BUILDER_BOARD_NOTE}
        </FadeUp>

        <motion.div
          style={{ marginTop: cq(152 - 123.84) }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
        >
          <BuilderBoard />
        </motion.div>

        <Rule style={{ width: "100%", marginTop: cq(SECTION_GAP) }} />

        {/* Design That Performs + Grand Slam */}
        <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
          <div
            style={{
              width: cq(480),
              paddingRight: cq(40),
              display: "flex",
              flexDirection: "column",
            }}
          >
            <FadeUp
              className="font-bold"
              style={{
                marginTop: cq(0.98),
                color: DARK,
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
                whiteSpace: "pre-line",
              }}
            >
              {DESIGN_PERFORMS.title}
            </FadeUp>
            <motion.img
              src="/yan/grand_slam.webp"
              alt=""
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 0.8, ease: EASE_SOFT }}
              style={{
                marginTop: "auto",
                width: cq(GRAND_SLAM_W),
                height: cq(GRAND_SLAM_W / GRAND_SLAM_AR),
                borderRadius: cq(12),
                display: "block",
                maxWidth: "none",
                objectFit: "cover",
              }}
            />
          </div>
          <div
            style={{
              width: cq(960),
              display: "flex",
              flexDirection: "column",
              gap: cq(32),
            }}
          >
            {DESIGN_PERFORMS.text.map((p, i) => (
              <FadeUp
                key={i}
                className="font-light"
                delay={i * 0.1}
                style={{
                  color: INK,
                  fontSize: cq(23),
                  lineHeight: cq(32),
                  textAlign: "left",
                }}
              >
                {p}
              </FadeUp>
            ))}
          </div>
        </div>

        {/* центрированная заметка между двумя линейками */}
        <Rule style={{ width: "100%", marginTop: cq(71 - 2.96) }} />
        <FadeUp
          className="font-normal"
          style={{
            marginTop: cq(36 - 7.16),
            width: "100%",
            color: DARK,
            fontSize: cq(22.93),
            lineHeight: cq(30),
            textTransform: "uppercase",
            textAlign: "center",
            whiteSpace: "pre-line",
          }}
        >
          {TENNIS_NOTE}
        </FadeUp>
        <Rule style={{ width: "100%", marginTop: cq(28.16) }} />

        {/* три подборки баннеров перед финальным панно */}
        {[1, 2, 3].map((n) => (
          <motion.img
            key={n}
            src={`/yan/banners_${n}.webp`}
            alt=""
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.8, ease: EASE_SOFT }}
            style={{
              marginTop: cq(n === 1 ? SECTION_GAP : PHOTO_GAP),
              width: "100%",
              height: "auto",
              borderRadius: cq(12),
              display: "block",
            }}
          />
        ))}

        <motion.img
          src="/yan/banners_fin.webp"
          alt=""
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
          style={{
            marginTop: cq(SECTION_GAP),
            width: "100%",
            height: cq(1440 / BANNERS_FIN_AR),
            borderRadius: cq(12),
            display: "block",
            maxWidth: "none",
            objectFit: "cover",
          }}
        />
      </div>
    </section>
  );
}

/* ───────────────────────────── панно из баннеров ───────────────────────── */

const WALL_COLS = 9;
const WALL_ROWS = 24;
/** Пропорции одной плитки баннера */
const WALL_TILE_AR = 440 / 92;
/** Промежуток между плитками, px */
const WALL_GAP = 2;
const WALL_PAD = 164;

/** Панно 24×9 из рекламных баннеров; плитка увеличивается на ховере */
function BannerWall() {
  const rows = Array.from({ length: WALL_ROWS }, (_, r) =>
    Array.from({ length: WALL_COLS }, (__, c) => r * WALL_COLS + c + 1),
  );
  return (
    <section
      className="relative z-20"
      style={{
        paddingTop: cq(WALL_PAD),
        paddingBottom: cq(WALL_PAD),
        background: LIGHT,
      }}
      aria-label="Yandex Market advertising banners"
    >
      <div style={{ marginLeft: cq(240), width: cq(1440) }}>
        {rows.map((row, r) => (
          <motion.div
            key={r}
            style={{ display: "flex", gap: WALL_GAP, marginTop: r ? WALL_GAP : 0 }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -8% 0px" }}
            transition={{ duration: 0.7, ease: EASE_SOFT }}
          >
            {row.map((n) => (
              <div
                key={n}
                className="yb-tile"
                style={{
                  flex: "1 1 0",
                  aspectRatio: `${WALL_TILE_AR}`,
                  position: "relative",
                }}
              >
                <img
                  src={`/yanban/b${String(n).padStart(3, "0")}.webp`}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                    objectFit: "cover",
                  }}
                />
              </div>
            ))}
          </motion.div>
        ))}
        <motion.p
          className="font-light"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
          style={{
            marginTop: cq(24),
            color: DARK,
            fontSize: cq(12),
            lineHeight: cq(14),
            letterSpacing: cq(1.73),
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          Here is just a small selection of my work
        </motion.p>
      </div>
      <style>{`
        .yb-tile { transition: transform .9s cubic-bezier(.22,1,.36,1), z-index 0s .9s; z-index: 0; }
        .yb-tile:hover { transform: scale(2.09); z-index: 2; transition: transform .35s cubic-bezier(.22,1,.36,1), z-index 0s; }
      `}</style>
    </section>
  );
}

/* ───────────────────────────── история Nuetel: геометрия ───────────────── */

/** Высота синего экрана «про компанию» */
const ABOUT_H = 605;
/** Промежуток в коллаже гайдлайнов */
const GUIDE_GAP = 20;
const GUIDE_COLS = 3;
const GUIDE_COL_W = (1440 - GUIDE_GAP * (GUIDE_COLS - 1)) / GUIDE_COLS;

/** Развороты гайдлайна: имя файла и натуральная высота при ширине 1920 */
const GUIDE_SHOTS = (
  [
    ["/nuetel_guide_1.jpg", 2872],
    ["/nuetel_guide_2.jpg", 4830],
    ["/nuetel_guide_3.jpg", 4074],
    ["/nuetel_guide_4.jpg", 4760],
    ["/nuetel_guide_6.jpg", 3934],
    ["/nuetel_guide_5.jpg", 4202],
  ] as [string, number][]
).map(([src, h]) => ({ src, h: (GUIDE_COL_W * h) / 1920 }));

/** Раскладка по колонкам «змейкой» через GUIDE_COLS */
const GUIDE_COLUMNS = Array.from({ length: GUIDE_COLS }, (_, col) =>
  GUIDE_SHOTS.filter((_s, i) => i % GUIDE_COLS === col),
);

/** Высота самой длинной колонки коллажа */
const GUIDE_MAX_H = Math.max(
  ...GUIDE_COLUMNS.map((col) =>
    col.reduce((sum, s) => sum + s.h, GUIDE_GAP * (col.length - 1)),
  ),
);

/** Верх коллажа гайдлайнов внутри липкого экрана */
const GUIDE_TOP = 730;
/** Запас прокрутки под липкой «историей» */
const STORY_TAIL = 420;
/** Верх блока со статистикой дизайн-системы */
const SYSTEM_STATS_TOP = GUIDE_TOP + GUIDE_MAX_H + SECTION_GAP - 140;

const SYSTEM_STATS = {
  h: 506,
  rule1: 140,
  lead: 176,
  rule2: 257,
  num: 328,
  label: 357,
  text: "A compact set of reusable components and visual assets to keep Nuetel brand consistent.",
  items: [
    { x: 637, n: "10+", label: "Typography styles" },
    { x: 867, n: "6", label: "Colors in the main palette" },
    { x: 1168, n: "30+", label: "Custom icons" },
  ],
};

/** Низ подписи статистики: cap-top + cap-height кегля 12 */
const SYSTEM_STATS_LABEL_BOTTOM = SYSTEM_STATS.label + 0.7 * 12;
/** Полная высота липкого экрана дизайн-системы */
const SYSTEM_STICKY_H = SYSTEM_STATS_TOP + SYSTEM_STATS_LABEL_BOTTOM;

/** Ширина картинки на синем экране и её наезд по скроллу */
const ABOUT_IMG_W = 2401.7;
const ABOUT_SCALE_FROM = 1.17;
const ABOUT_SCALE_TO = 0.86;

/** Текст и логотип про визуальный язык */
const LOGO_STORY = {
  text: [
    {
      y: 140,
      text: "The visual brand style should be simple and minimalist, but not primitive. Graphic elements should feel stylized but not cartoonish. Overall, the brand should come across as clean, concise, and technological.",
    },
    {
      y: 290,
      text: 'All of these qualities are reflected in the logo – simple shapes connected into a single structure. The grid of squares of varying sizes, connected by thin lines, represents nodes and the links between them – literally a network diagram. At the same time, the silhouette also reads as a stylized "#" symbol – the hash key from a telephone keypad.',
    },
  ],
  logoY: 231,
  ruleY: 566,
};

/** Кадры «пролистывания» сайта на ноутбуке */
const LAPTOP_FRAMES = [
  "/laptop/laptop_1.webp",
  "/laptop/laptop_2.webp",
  "/laptop/laptop_3.webp",
  "/laptop/laptop_4.webp",
  "/laptop/laptop_5.webp",
  "/laptop/laptop_6.webp",
  "/laptop/laptop_7.webp",
  "/laptop/laptop_8.webp",
  "/laptop/laptop_9.webp",
  "/laptop/laptop_10.webp",
  "/laptop/laptop_11.webp",
  "/laptop/laptop_12.webp",
  "/laptop/laptop_13.webp",
  "/laptop/laptop_14.webp",
  "/laptop/laptop_15.webp",
  "/laptop/laptop_16.webp",
];

/** Высота мозаики рекламных материалов */
const ADV_GRID_H = 1840;

const ADV_BANNERS = [
  { src: "/banners/banner_parrot.jpg", x: 0, y: 0, w: 343.5, h: 544 },
  { src: "/banners/banner_abstract.jpg", x: 365.5, y: 0, w: 343.5, h: 544 },
  { src: "/banners/banner_icons.jpg", x: 731, y: 0, w: 351, h: 144 },
  { src: "/banners/banner_screen.jpg", x: 1104, y: 0, w: 336, h: 344 },
  { src: "/banners/banner_cloud.jpg", x: 731, y: 166, w: 351, h: 543 },
  { src: "/banners/banner_3d.jpg", x: 1104, y: 366, w: 336, h: 343 },
  { src: "/banners/banner_hero.jpg", x: 0, y: 566, w: 709, h: 708 },
  { src: "/banners/banner_adv.jpg", x: 731, y: 731, w: 709, h: 543 },
  { src: "/banners/banner_poster.jpg", x: 0, y: 1296, w: 1066, h: 544 },
  { src: "/banners/banner_siprout.jpg", x: 1088, y: 1296, w: 352, h: 544 },
];

const ADV_CAMPAIGN = {
  title: "Advertising campaign",
  text: "For the Argentine market, I proposed a locally inspired advertising concept featuring a llama, jaguar, macaw, capybara (or carpincho), and Andean condor as Nuetel call center employees. A clean, tech-focused style, the brand’s signature color palette, and a touch of humor made the communication more engaging and memorable.",
};

/** Отступ сверху у липкого экрана кампании */
const CAMPAIGN_PAD_TOP = 40;
/** Прокрутка на один кадр телефона, svh */
const PHONE_STEP_VH = 66;
/** Хвост прокрутки после последнего кадра, svh */
const PHONE_TAIL_VH = 60;
const PHONE_SCROLL_VH = 4 * PHONE_STEP_VH + PHONE_TAIL_VH;
/** Доля прокрутки, за которую сменяется один кадр */
const PHONE_SEGMENT = PHONE_STEP_VH / PHONE_SCROLL_VH;
const EASE_PHONE: [number, number, number, number] = [0.42, 0, 0.25, 1];
/** Пропорции кадра с телефонами */
const PHONE_SHOT_AR = 2e3 / 888;

const PHONE_FRAMES = [
  "/phones/nuetel_phone_2.webp",
  "/phones/nuetel_phone_3.webp",
  "/phones/nuetel_phone_4.webp",
  "/phones/nuetel_phone_5.webp",
];

/** Всё, что занимает высоту над кадром телефонов в липком экране */
const PHONE_CHROME_H = CAMPAIGN_PAD_TOP + 1 + (71 - 8.14) + 128 + 32;

const FINAL_SHOT_IMG = { src: "/nuetel_final.webp", ar: 3840 / 2160 };
const FINAL_PAD_TOP = 72;

/* Коллаж «от скетча к системе» */
const SKETCH_GAP = 29;
/** Высота верхнего ряда коллажа */
const SKETCH_ROW_H = 721;
/** Ширина левой колонки со скетчами */
const SKETCH_COL_W = 333;
/** Вертикальный зазор между тремя скетчами, чтобы ряд сошёлся по высоте */
const SKETCH_V_GAP =
  (SKETCH_ROW_H -
    (SKETCH_COL_W * 480) / 752 -
    (SKETCH_COL_W * 650) / 752 -
    (SKETCH_COL_W * 406) / 752) /
  2;
const SKETCH_WIDE_H = (1440 * 1827) / 3248;

/* Сетка 3×3 с кадрами Frame_nuetel_1…9 */
const GRID_COLS = 3;
const GRID_CELL_W = (1440 - (GRID_COLS - 1) * SKETCH_GAP) / GRID_COLS;
const GRID_CELL_H = (GRID_CELL_W * 1080) / 1920;
const GRID_H = GRID_COLS * GRID_CELL_H + (GRID_COLS - 1) * SKETCH_GAP;
const GRID_TOP = SKETCH_ROW_H + SKETCH_GAP;
const GRID_SHOTS = Array.from({ length: 9 }, (_, i) => ({
  src: `/sketch/frame_${i + 1}.webp`,
  x: (i % GRID_COLS) * (GRID_CELL_W + SKETCH_GAP),
  y: GRID_TOP + Math.floor(i / GRID_COLS) * (GRID_CELL_H + SKETCH_GAP),
  w: GRID_CELL_W,
  h: GRID_CELL_H,
}));
const WIDE_TOP = GRID_TOP + GRID_H + SKETCH_GAP;

const SKETCH_SHOTS = [
  {
    src: "/sketch/sketch_1.webp",
    x: 0,
    y: 0,
    w: SKETCH_COL_W,
    h: (SKETCH_COL_W * 480) / 752,
  },
  {
    src: "/sketch/sketch_2.webp",
    x: 0,
    y: (SKETCH_COL_W * 480) / 752 + SKETCH_V_GAP,
    w: SKETCH_COL_W,
    h: (SKETCH_COL_W * 650) / 752,
  },
  {
    src: "/sketch/sketch_3.webp",
    x: 0,
    y: SKETCH_ROW_H - (SKETCH_COL_W * 406) / 752,
    w: SKETCH_COL_W,
    h: (SKETCH_COL_W * 406) / 752,
  },
  {
    /* один кадр вместо двух баннеров: кадрируется по ширине слота */
    src: "/sketch/laptop_tablet.webp",
    x: SKETCH_COL_W + SKETCH_GAP,
    y: 0,
    w: 1440 - SKETCH_COL_W - SKETCH_GAP,
    h: SKETCH_ROW_H,
  },
  ...GRID_SHOTS,
  {
    src: "/sketch/final_wide.webp",
    x: 0,
    y: WIDE_TOP,
    w: 1440,
    h: SKETCH_WIDE_H,
  },
];

const SKETCH_TOTAL_H = WIDE_TOP + SKETCH_WIDE_H;

const SKETCH_TO_SYSTEM = {
  title: "From Sketch to System",
  text: [
    "A rough sketch became more than a logo. It became the foundation for a scalable system – from brand identity and digital products to marketing communications.",
    "Not just a bunch of beautiful images, but a flexible system for creating content across website and other platforms.",
  ],
};

/* Липкий ноутбук с кадрами сайта */
const LAPTOP_AR = 2432 / 1737;
/** Отступ ноутбука от низа экрана, svh */
const LAPTOP_PAD_VH = 11;
const LAPTOP_H = `min(${100 - 2 * LAPTOP_PAD_VH}svh, ${cq(1440 / LAPTOP_AR)})`;
/** Общая прокрутка секции с ноутбуком, svh */
const LAPTOP_SCROLL_VH = 210;
/** Разгон до начала смены кадров, svh */
const LAPTOP_LEAD_VH = 60;
const LAPTOP_START = LAPTOP_LEAD_VH / LAPTOP_SCROLL_VH;
/** Доля прокрутки, за которую проигрываются все кадры */
const LAPTOP_SPAN = 0.54;
/** Доля прокрутки, за которую гаснет блок статистики под ноутбуком */
const FADE_SPAN = 0.35;
const LAPTOP_SECTION_VH = 100 + LAPTOP_SCROLL_VH;
/** Доля пустоты под крышкой ноутбука в кадре */
const LAPTOP_BOTTOM_RATIO = 102 / 1737;
/** Верх липкого экрана дизайн-системы: подгоняем под низ ноутбука */
const LAPTOP_STICKY_TOP = `calc(${100 - LAPTOP_PAD_VH}svh - ${cq(SECTION_GAP)} - ${LAPTOP_BOTTOM_RATIO} * (${LAPTOP_H}))`;

const NUETEL_BLUE = "#09A6F3";

const ABOUT_TEXT = [
  "Nuetel is a telecommunications company based in Buenos Aires, Argentina, providing cloud-based phone systems, SIP trunking, and business communication integrations.",
  "The design system was built around two core principles: simplicity and flexibility — a minimal, consistent foundation designed to scale without unnecessary complexity.",
];

/** Вертикальная «ось» истории с ромбами */
const STORY_SPINE = { x: 251, y: 948, h: 706 };
/** Колонки шагов истории */
const STORY_COL = { num: 307, title: 346, rule: 307, desc: 307 };
const STORY_DESC_W = 368;
/** Размер ромба-маркера */
const STORY_MARK = 22;

const STORY_STEPS = [
  {
    y: 937,
    num: "01",
    title: "Sketch",
    desc: "A hand-drawn mark from the founders — the idea, before any system.",
  },
  {
    y: 1102,
    num: "02",
    title: "Logo",
    desc: "Refined proportions and geometry",
  },
  {
    y: 1249,
    num: "03",
    title: "Visual Language",
    desc: `Typography, colours, graphic
and images`,
  },
  {
    y: 1412,
    num: "04",
    title: "Design system",
    desc: `Reusable components, layout
rules, one consistent voice`,
  },
  {
    y: 1575,
    num: "05",
    title: "Website",
    desc: "Reusable components, layout rules, one consistent voice. Website content and advertising materials.",
  },
];

/* Задержки внутри одного шага истории */
const STORY_TEXT_DELAY = 0;
const STORY_RULE_DELAY = 0.5;
const STORY_DESC_DELAY = 0.85;

/** Ширина текстовой колонки */
const TEXT_COL_W = 720;

const STORY_INTRO = [
  {
    y: 223,
    text: "The project began with a simple logo sketch created by the founders of Nuetel. Apart from this sketch and a few preferences regarding the color palette, there was nothing else – literally a tabula rasa, a blank board.",
  },
  {
    y: 405,
    text: "After some initial sketches on paper and discussions about the brand’s character, I began developing a visual system that would become the foundation of the entire brand. I refined the logo and started exploring how its geometry could extend beyond the mark itself. Its shapes, proportions, and graphic principles gradually evolved into a broader design system, defining the typography, color palette, graphic elements, imagery, and layout principles.",
  },
  {
    y: 715,
    text: "What started as a single sketch eventually grew into a complete brand experience – from one graphic symbol to a scalable design system, website, and advertising materials.",
  },
];

/* ─────────────────────────── мозаика из скриншотов ─────────────────────── */

/** колонок в мозаике */
const MOSAIC_COLS = 3;
/** зазор между плитками, единицы макета */
const MOSAIC_GAP = 24;
/** ширина мозаики = ширина текстового разворота страницы */
const MOSAIC_W = 1440;
const MOSAIC_TILE_W = (MOSAIC_W - (MOSAIC_COLS - 1) * MOSAIC_GAP) / MOSAIC_COLS;
/** исходники 1440×900 */
const MOSAIC_TILE_H = (MOSAIC_TILE_W * 900) / 1440;
const MOSAIC_RADIUS = 12;
/** отступ от текста вступления до мозаики */
const MOSAIC_TOP = 120;
/** воздух под мозаикой до конца светлой панели */
const MOSAIC_TAIL = 164;
/** масштаб плиток в начале анимации */
const MOSAIC_SCALE_FROM = 0.74;
/** насколько плитки разъезжаются от центра в начале анимации */
const MOSAIC_SPREAD = 64;

/** 3×3: плитки выезжают из «россыпи» и собираются в ровную мозаику по скроллу */
function ScreenMosaic({ screens }: { screens: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  /* прогресс считаем от момента, когда верх мозаики заходит снизу экрана,
     до момента, когда её низ не дойдёт до нижней кромки — так сборка
     гарантированно успевает закончиться даже на короткой странице,
     где скроллить дальше уже некуда */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", "end 0.9"],
  });

  const rows = Math.ceil(screens.length / MOSAIC_COLS);
  const height = rows * MOSAIC_TILE_H + (rows - 1) * MOSAIC_GAP;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        marginLeft: cq(240),
        marginTop: cq(MOSAIC_TOP),
        width: cq(MOSAIC_W),
        height: cq(height),
      }}
    >
      {screens.map((src, i) => (
        <MosaicTile
          key={src}
          src={src}
          col={i % MOSAIC_COLS}
          row={Math.floor(i / MOSAIC_COLS)}
          rows={rows}
          progress={scrollYProgress}
        />
      ))}
    </div>
  );
}

function MosaicTile({
  src,
  col,
  row,
  rows,
  progress,
}: {
  src: string;
  col: number;
  row: number;
  rows: number;
  progress: MotionValue<number>;
}) {
  /* смещение от центра сетки: крайние плитки разъезжаются сильнее всего */
  const centerCol = (MOSAIC_COLS - 1) / 2;
  const centerRow = (rows - 1) / 2;
  const dx = ((col - centerCol) / Math.max(centerCol, 1)) * MOSAIC_SPREAD;
  const dy = ((row - centerRow) / Math.max(centerRow, 1)) * MOSAIC_SPREAD;

  const scale = useTransform(progress, [0, 1], [MOSAIC_SCALE_FROM, 1]);
  const x = useTransform(progress, [0, 1], [cq(dx), "0cqw"]);
  const y = useTransform(progress, [0, 1], [cq(dy), "0cqw"]);
  const opacity = useTransform(progress, [0, 0.45], [0.45, 1]);

  return (
    <motion.img
      src={src}
      alt=""
      aria-hidden
      style={{
        position: "absolute",
        left: cq(col * (MOSAIC_TILE_W + MOSAIC_GAP)),
        top: cq(row * (MOSAIC_TILE_H + MOSAIC_GAP)),
        width: cq(MOSAIC_TILE_W),
        height: cq(MOSAIC_TILE_H),
        objectFit: "cover",
        borderRadius: cq(MOSAIC_RADIUS),
        x,
        y,
        scale,
        opacity,
      }}
    />
  );
}

/* ─────────────────────── карточки «подходы к работе» ───────────────────── */

/** Колонки встают ровно под плитки мозаики 3×3 выше */
const CONCEPT_CARD_W = MOSAIC_TILE_W;
const CONCEPT_CARD_GAP = MOSAIC_GAP;
const CONCEPT_PAD = 28;
const CONCEPT_ICON = 36;
/** Отступ от иконки до заголовка и от заголовка до текста */
const CONCEPT_ICON_GAP = 20;
const CONCEPT_TEXT_GAP = 16;

/** Минималистичные иконки: рисуются в сетке 24, масштабируются до 36 */
const CONCEPT_ICONS: Record<string, React.ReactNode> = {
  // встречные стрелки — «преобразовать одно в другое»
  adapt: (
    <path d="M3 8.5h14M13.5 5 17 8.5 13.5 12M21 15.5H7M10.5 12 7 15.5 10.5 19" />
  ),
  // искра — «сделать с нуля»
  create: (
    <path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" />
  ),
  // круговая стрелка — «обновить существующее»
  update: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path d="M20.5 3v5h-5" />
    </>
  ),
};

type ConceptCard = { icon: string; title: string; text: string };

/** Ряд карточек под текстовым фреймом: не на всю ширину разворота */
function ConceptCards({
  cards,
  marginTop,
}: {
  cards: ConceptCard[];
  marginTop: number;
}) {
  return (
    <div
      style={{
        marginLeft: cq(240),
        marginTop: cq(marginTop),
        display: "flex",
        alignItems: "stretch",
        gap: cq(CONCEPT_CARD_GAP),
      }}
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT, delay: i * 0.1 }}
          style={{
            flex: `0 0 ${cq(CONCEPT_CARD_W)}`,
            width: cq(CONCEPT_CARD_W),
            border: `1px solid ${LINE_SOFT}`,
            background: FILL_SOFT,
            borderRadius: cq(6),
            padding: cq(CONCEPT_PAD),
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{
              width: cq(CONCEPT_ICON),
              height: cq(CONCEPT_ICON),
              display: "block",
            }}
          >
            {CONCEPT_ICONS[card.icon]}
          </svg>
          <p
            className="font-semibold"
            style={{
              marginTop: cq(CONCEPT_ICON_GAP),
              color: DARK,
              fontSize: cq(22.93),
              lineHeight: cq(30),
              letterSpacing: cq(0.23),
              textTransform: "uppercase",
            }}
          >
            {card.title}
          </p>
          <p
            className="font-normal"
            style={{
              marginTop: cq(CONCEPT_TEXT_GAP),
              color: DARK,
              fontSize: cq(12),
              lineHeight: cq(16),
              letterSpacing: cq(1.73),
              textTransform: "uppercase",
            }}
          >
            {card.text}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/* ──────────────────── доска с лендингами и кнопками ────────────────────── */

/** Доска выше прежних (660), но всё ещё влезает в экран целиком */
const LBOARD_H = 860;
/** Пропорции выгруженных лендингов */
const LBOARD_IMG_AR = 700 / 1755;
const LBOARD_IMG_W = 256;
const LBOARD_IMG_H = Math.round(LBOARD_IMG_W / LBOARD_IMG_AR);
/** Токен задачи стоит слева вверху от лендинга */
const LBOARD_TOKEN_W = 180;
const LBOARD_TOKEN_GAP = 12;
const LBOARD_BTN_GAP = 18;

const LBOARD_BTN_H = 60;
/** Ширина группы: токен + лендинг */
const LBOARD_COL_W = LBOARD_TOKEN_W + LBOARD_TOKEN_GAP + LBOARD_IMG_W;
/** Высота группы: лендинг + кнопка под ним */
const LBOARD_COL_H = LBOARD_IMG_H + LBOARD_BTN_GAP + LBOARD_BTN_H;
const LBOARD_TOP = (LBOARD_H - LBOARD_COL_H) / 2 / LBOARD_H;
/** Группы стоят с равными промежутками по ширине разворота */
const LBOARD_SIDE = (1440 - 3 * LBOARD_COL_W) / 4;

const LANDINGS = [
  {
    id: "samsung",
    src: "/yan/landings/samsung.webp",
    done: "/yan/landings/samsung-new.webp",
    task: "Task 1.",
    note: "We have vendor’s visual concepts here. Adapt it for market platform.",
    label: "Adapt",
  },
  {
    id: "fashion",
    src: "/yan/landings/fashion.webp",
    done: "/yan/landings/fashion-new.webp",
    task: "Task 2.",
    note: "I developed my own visual concept. Now we need to create landing from scratch.",
    label: "Create",
  },
  {
    id: "delonghi",
    src: "/yan/landings/delonghi.webp",
    done: "/yan/landings/delonghi-new.webp",
    task: "Task 3.",
    note: "I’ve already completed landing but now we need to update some info in it.",
    label: "Update",
  },
];

/** Кнопка под лендингом: стрелка поворачивается, надпись расшифровывается */
function LandingButton({
  label,
  done,
  gone,
  onDone,
  onCursor,
}: {
  label: string;
  done: boolean;
  gone: boolean;
  onDone: () => void;
  onCursor: (c: CursorPoint | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const shown = useDecrypt(done ? LABEL_DONE : label, hover);
  /* распорка считается по самой длинной из двух надписей */
  const sizer = label.length >= LABEL_DONE.length ? label : LABEL_DONE;

  return (
    <button
      type="button"
      onClick={done ? undefined : onDone}
      /* на доске кнопка не должна начинать перетаскивание группы */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={(e) => {
        e.pointerType === "mouse" &&
          (setHover(true), onCursor({ x: e.clientX, y: e.clientY }));
      }}
      onPointerMove={(e) =>
        e.pointerType === "mouse" && onCursor({ x: e.clientX, y: e.clientY })
      }
      onPointerLeave={(e) => {
        e.pointerType === "mouse" && (setHover(false), onCursor(null));
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: cq(20),
        height: cq(LBOARD_BTN_H),
        padding: `0 ${cq(36)}`,
        borderRadius: cq(6),
        border: `1px solid ${ACCENT}`,
        background:
          hover || done ? "rgba(185,19,114,0.05)" : "rgba(255,255,255,0.04)",
        opacity: gone ? 0 : 1,
        pointerEvents: gone || done ? "none" : "auto",
        transition: "background .3s ease, opacity .7s ease",
        cursor: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "block",
          transform: hover || done ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform .35s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <ApproveArrow />
      </span>
      <span
        className="font-bold"
        style={{
          position: "relative",
          display: "inline-block",
          color: "#fff",
          fontSize: cq(23),
          lineHeight: cq(28),
          letterSpacing: cq(1.15),
          textTransform: "uppercase",
        }}
      >
        {/* распорка, чтобы ширина не дёргалась на широких глифах шифра */}
        <span aria-hidden style={{ visibility: "hidden" }}>
          {sizer}
        </span>
        <span
          style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}
        >
          {shown}
        </span>
      </span>
    </button>
  );
}

/** Доска: три лендинга с задачами, каждый таскается вместе со своей кнопкой */
function LandingBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Positions>(() => {
    const init: Positions = {};
    LANDINGS.forEach((l, i) => {
      init[l.id] = {
        x: (LBOARD_SIDE * (i + 1) + LBOARD_COL_W * i) / 1440,
        y: LBOARD_TOP,
      };
    });
    return init;
  });
  const [order, setOrder] = useState<string[]>(LANDINGS.map((l) => l.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const [glitch, setGlitch] = useState<Record<string, boolean>>({});
  const drag = useRef<DragState | null>(null);

  /* по клику: надпись DONE!, токен задачи гаснет, лендинг меняется
     на обновлённую версию, через 4 с исчезает и сама кнопка */
  const finish = (id: string) => () => {
    if (done[id]) return;
    setDone((prev) => ({ ...prev, [id]: true }));
    setGlitch((prev) => ({ ...prev, [id]: true }));
    setTimeout(
      () => setGlitch((prev) => ({ ...prev, [id]: false })),
      GLITCH_MS,
    );
    setTimeout(() => setGone((prev) => ({ ...prev, [id]: true })), 4e3);
  };

  const onDown = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = { id, dx: e.clientX - box.left, dy: e.clientY - box.top };
    setDragging(id);
    setOrder((prev) => [...prev.filter((x) => x !== id), id]);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const board = boardRef.current;
    if (!state || !board) return;
    const rect = board.getBoundingClientRect();
    setPos((prev) => ({
      ...prev,
      [state.id]: {
        x: (e.clientX - rect.left - state.dx) / rect.width,
        y: (e.clientY - rect.top - state.dy) / rect.height,
      },
    }));
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      ref={boardRef}
      style={{
        position: "relative",
        width: "100%",
        height: `min(${cq(LBOARD_H)}, 86svh)`,
        background: BOARD_BG,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MAJOR} 1px, transparent 1px),
            linear-gradient(to right, ${BOARD_GRID_MINOR} 1px, transparent 1px),
            linear-gradient(to bottom, ${BOARD_GRID_MINOR} 1px, transparent 1px)`,
          backgroundSize: `
            ${cq(BOARD_CELL_BIG)} 100%,
            100% ${cq(BOARD_CELL_BIG)},
            ${cq(BOARD_CELL_SMALL)} 100%,
            100% ${cq(BOARD_CELL_SMALL)}`,
        }}
      />

      {LANDINGS.map((item) => (
        <div
          key={item.id}
          onPointerDown={onDown(item.id)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            position: "absolute",
            left: `${pos[item.id].x * 100}%`,
            top: `${pos[item.id].y * 100}%`,
            width: cq(LBOARD_COL_W),
            height: cq(LBOARD_COL_H),
            zIndex: 1 + order.indexOf(item.id),
            cursor: dragging === item.id ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <span
            className="font-light"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cq(LBOARD_TOKEN_W),
              padding: `${cq(10)} ${cq(14)}`,
              borderRadius: cq(7),
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.9)",
              fontSize: cq(12),
              lineHeight: cq(16),
              textTransform: "uppercase",
              opacity: done[item.id] ? 0 : 1,
              transition: "opacity .7s ease",
            }}
          >
            <span className="font-bold" style={{ display: "block" }}>
              {item.task}
            </span>
            {item.note}
          </span>

          <div
            style={{
              position: "absolute",
              left: cq(LBOARD_TOKEN_W + LBOARD_TOKEN_GAP),
              top: 0,
              width: cq(LBOARD_IMG_W),
              height: cq(LBOARD_IMG_H),
              borderRadius: cq(4),
              overflow: "hidden",
              pointerEvents: "none",
              background: "#0b0b0b",
            }}
          >
            {[item.src, item.done].map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                draggable={false}
                className={i === 1 && glitch[item.id] ? "lp-glitch" : undefined}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top",
                  opacity: (i === 1) === !!done[item.id] ? 1 : 0,
                  transition: glitch[item.id] ? "none" : "opacity .8s ease",
                }}
              />
            ))}

            {/* срезы со сдвигом по цвету и мерцающая развёртка — только на миг подмены */}
            {glitch[item.id] && (
              <>
                <img
                  src={item.done}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="lp-glitch-slice lp-glitch-slice--cyan"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                  }}
                />
                <img
                  src={item.done}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="lp-glitch-slice lp-glitch-slice--magenta"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                  }}
                />
                <div
                  aria-hidden
                  className="lp-glitch-scan"
                  style={{ position: "absolute", inset: "-15% 0" }}
                />
              </>
            )}
          </div>

          {/* кнопка — по центру лендинга, а не всей группы */}
          <div
            style={{
              position: "absolute",
              left: cq(LBOARD_TOKEN_W + LBOARD_TOKEN_GAP),
              top: cq(LBOARD_IMG_H + LBOARD_BTN_GAP),
              width: cq(LBOARD_IMG_W),
              display: "flex",
              justifyContent: "center",
            }}
          >
            <LandingButton
              label={item.label}
              done={!!done[item.id]}
              gone={!!gone[item.id]}
              onDone={finish(item.id)}
              onCursor={setCursor}
            />
          </div>
        </div>
      ))}

      {cursor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: cursor.x,
              top: cursor.y,
              width: 26,
              height: 26,
              marginLeft: -13,
              marginTop: -13,
              borderRadius: "50%",
              background: ACCENT,
              pointerEvents: "none",
              zIndex: 120,
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/** Зацикленное видео: само стартует, когда заезжает в экран */
function LoopVideo({ sources, poster }: { sources: string[]; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          /* play() может отклониться, если вкладка неактивна — это не ошибка */
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: EASE_SOFT }}
      style={{
        marginLeft: cq(240),
        marginTop: cq(VIDEO_TOP),
        width: cq(1440),
      }}
    >
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        aria-label="Landing page editing process"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: cq(MOSAIC_RADIUS),
        }}
      >
        {sources.map((src) => (
          <source
            key={src}
            src={src}
            type={src.endsWith(".webm") ? "video/webm" : "video/mp4"}
          />
        ))}
      </video>
    </motion.div>
  );
}

/** Пара абзацев под видео, набранных как блок про ресайзы на странице
    Yandex Market, и кадр с баннерами справа от них */
function VideoNote({ text, image }: { text: string[]; image?: string }) {
  return (
    <div
      style={{
        marginLeft: cq(240),
        marginTop: cq(VIDEO_NOTE_TOP),
        width: cq(1440),
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: cq(VIDEO_NOTE_TEXT_W),
          display: "flex",
          flexDirection: "column",
          gap: cq(32),
        }}
      >
        {text.map((p, i) => (
          <FadeUp
            key={i}
            className="font-light"
            delay={i * 0.1}
            style={{
              color: INK,
              fontSize: cq(23),
              lineHeight: cq(32),
              textAlign: "left",
            }}
          >
            {tieShortWords(p)}
          </FadeUp>
        ))}
      </div>
      {image && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT }}
          style={{ marginLeft: "auto", width: cq(VIDEO_NOTE_IMG_W) }}
        >
          <img
            src={image}
            alt=""
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: cq(MOSAIC_RADIUS),
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

/** Карточка превью: по наведению кадр уходит в расфокус, снизу выезжает
    подложка с названием и пояснением — набраны как строки в таблице опыта */
function PreviewCard({
  item,
  delay,
  onCursor,
  onOpen,
}: {
  item: { src: string; title: string; text: string; full?: string };
  delay: number;
  onCursor: (p: CursorPoint | null) => void;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: EASE_SOFT, delay }}
      onPointerEnter={(e) =>
        e.pointerType === "mouse" &&
        (setHover(true), onCursor({ x: e.clientX, y: e.clientY }))
      }
      onPointerMove={(e) =>
        e.pointerType === "mouse" && onCursor({ x: e.clientX, y: e.clientY })
      }
      onPointerLeave={(e) =>
        e.pointerType === "mouse" && (setHover(false), onCursor(null))
      }
      onClick={onOpen}
      style={{
        width: cq(MOSAIC_TILE_W),
        position: "relative",
        overflow: "hidden",
        borderRadius: cq(MOSAIC_RADIUS),
        cursor: "none",
      }}
    >
      <img
        src={item.src}
        alt=""
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          /* лёгкий подъём масштаба прячет размытые края кадра */
          transform: hover ? "scale(1.03)" : "none",
          filter: hover ? "blur(4px)" : "none",
          transition: "filter .4s ease, transform .4s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: PREVIEW_PANEL,
          padding: `${cq(20)} ${cq(20)} ${cq(22)}`,
          opacity: hover ? 1 : 0,
          transform: hover ? "none" : "translateY(12%)",
          transition: "opacity .35s ease, transform .35s ease",
        }}
      >
        <div
          className="font-bold whitespace-pre text-white"
          style={{
            fontSize: cq(23),
            lineHeight: cq(26),
            letterSpacing: cq(0.7),
          }}
        >
          {item.title}
        </div>
        <div
          className="font-light text-white"
          style={{
            marginTop: cq(8),
            fontSize: cq(15),
            lineHeight: cq(22.5),
          }}
        >
          {tieShortWords(item.text)}
        </div>
      </div>
    </motion.div>
  );
}

/** Отбивка и сетка превью лендингов по ширине плиток мозаики 3×3 */
function PreviewGrid({
  items,
}: {
  items: { src: string; title: string; text: string; full?: string }[];
}) {
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [shot, setShot] = useState<number | null>(null);

  return (
    <div style={{ marginLeft: cq(240), marginTop: cq(SECTION_GAP), width: cq(1440) }}>
      <Rule style={{ width: "100%" }} />
      <div
        style={{
          marginTop: cq(PREVIEW_RULE_TO_GRID),
          display: "flex",
          flexWrap: "wrap",
          gap: cq(MOSAIC_GAP),
        }}
      >
        {items.map((item, i) => (
          <PreviewCard
            key={item.src}
            item={item}
            delay={(i % 3) * 0.1}
            onCursor={setCursor}
            onOpen={() => item.full && (setCursor(null), setShot(i))}
          />
        ))}
      </div>

      {cursor &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[130] rounded-full"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: PREVIEW_CURSOR,
              height: PREVIEW_CURSOR,
              marginLeft: -PREVIEW_CURSOR / 2,
              marginTop: -PREVIEW_CURSOR / 2,
              boxSizing: "border-box",
              border: `${(PREVIEW_CURSOR - PREVIEW_CURSOR_HOLE) / 2}px solid ${ACCENT}`,
            }}
          />,
          document.body,
        )}
      {shot !== null && items[shot].full && (
        <Lightbox
          src={items[shot].full}
          alt={items[shot].title}
          onClose={() => setShot(null)}
        />
      )}
    </div>
  );
}

/** Три кадра в ряд по сетке мозаики 3×3 */
function SketchRow({
  images,
  captions,
}: {
  images: string[];
  captions?: string[];
}) {
  return (
    <div
      style={{
        marginLeft: cq(240),
        marginTop: cq(SKETCH_TOP),
        display: "flex",
        gap: cq(MOSAIC_GAP),
      }}
    >
      {images.map((src, i) => (
        <motion.div
          key={src}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.8, ease: EASE_SOFT, delay: i * 0.1 }}
          style={{ width: cq(MOSAIC_TILE_W) }}
        >
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: cq(MOSAIC_RADIUS),
            }}
          />
          {captions?.[i] && (
            <p
              className="font-light"
              style={{
                marginTop: cq(24),
                color: DARK,
                fontSize: cq(12),
                lineHeight: cq(14),
                letterSpacing: cq(1.73),
                textTransform: "uppercase",
              }}
            >
              {captions[i]}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────────── текстовый фрейм «линейка + колонки» ───────────────── */

/** Отступ от линейки до cap-top заголовка, в единицах макета */
const FRAME_RULE_TO_TITLE = 71 - 8.14;
/** Отступ от текстового блока до кадров — как от линейки до текста над ними */
const SKETCH_TOP = FRAME_RULE_TO_TITLE;
/** Видео стоит от подписей на том же расстоянии, что кадры от текста.
    Поправка — на разницу полулидинга: над кадрами строка 23/32, над видео 12/14 */
const VIDEO_TOP = SKETCH_TOP + (32 - 1.219 * 23) / 2 - (14 - 1.219 * 12) / 2;
/** Отступ от низа мозаики до cap-top текстового фрейма — 100 за вычетом
    подъёма первой строки по метрикам Montserrat */
const OUTRO_TOP = 100 - ((32 - 1.219 * 23) / 2 + 0.968 * 23 - 0.7 * 23);
/** Текст под видео стоит от него так же, как заголовок фрейма от линейки */
const VIDEO_NOTE_TOP = FRAME_RULE_TO_TITLE + 1.09;
/** Короткие слова в начале строки — приклеиваем к следующему слову,
    чтобы предлоги и артикли не висели в конце строки; плюс последние два
    слова абзаца, чтобы не оставалось одиночки на последней строке */
function tieShortWords(text: string) {
  const parts = text.split(" ");
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    out += w;
    if (i === parts.length - 1) break;
    const bare = w.replace(/[^A-Za-z\u2019'-]/g, "");
    const tie = (bare.length > 0 && bare.length <= 3) || i === parts.length - 2;
    out += tie ? "\u00A0" : " ";
  }
  return out;
}

/** Отступ от отбивки до сетки превью — тот же, что от линейки до текста */
const PREVIEW_RULE_TO_GRID = 71;
/** Подложка описания превью — цвет подложки меню */
const PREVIEW_PANEL = "#07273C";
/** Кружок курсора над превью: размер как у «Back», но с дыркой */
const PREVIEW_CURSOR = 74;
const PREVIEW_CURSOR_HOLE = 32;

/** Узкая колонка текста под видео */
const VIDEO_NOTE_TEXT_W = 560;
/** Ширина кадра с баннерами: прижат к правому краю полосы контента */
const VIDEO_NOTE_IMG_W = 820;

/** Карточки стоят от текста на том же расстоянии, что текст от мозаики выше.
    Сверху мерим от края мозаики до верха букв, снизу — от низа букв до края
    карточки, поэтому поправляем на разницу «ascender − cap» и полулидинг. */
const CARDS_TOP =
  100 - (0.968 - 0.7) * 23 - (32 - 1.219 * 23) / 2;

/** Отступ заметки над доской до самой доски — как у досок Yandex Market */
const BOARD_NOTE_TO_BOARD = 152 - 123.84;
/** Зазор «карточки → заметка» равен зазору «текст → карточки» (93.84 до букв),
    с поправкой на полулидинг строки заметки 22.93/30 */
const CARDS_TO_NOTE = 93.84 - (30 - 1.219 * 22.93) / 2;

const LANDING_BOARD_NOTE = `Let me show you 3 main approaches to my work.
We have 3 different tasks and 3 different landing pages.`;

/** Ширина левой колонки с заголовком */
const FRAME_TITLE_W = 480;
/** Ширина правой колонки с текстом */
const FRAME_TEXT_W = 960;

/** Тот же фрейм, что «Balancing brand identity…» на странице Yandex Market:
    линейка, слева заголовок, справа абзацы */
function TextFrame({
  title,
  text,
  marginTop,
  rule = true,
}: {
  title?: string;
  text: string[];
  marginTop: number;
  /** линейка над фреймом: на странице кейса она есть не всегда */
  rule?: boolean;
}) {
  return (
    <div style={{ marginLeft: cq(240), width: cq(1440), marginTop: cq(marginTop) }}>
      {rule && <Rule style={{ width: "100%" }} />}
      <div style={{ display: "flex", marginTop: rule ? cq(FRAME_RULE_TO_TITLE) : 0 }}>
        <div style={{ width: cq(FRAME_TITLE_W), paddingRight: cq(40) }}>
          {title && (
            <FadeUp
              className="font-bold"
              style={{
                marginTop: cq(0.98),
                color: DARK,
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
                whiteSpace: "pre-line",
              }}
            >
              {title}
            </FadeUp>
          )}
        </div>
        <div
          style={{
            width: cq(FRAME_TEXT_W),
            display: "flex",
            flexDirection: "column",
            gap: cq(32),
          }}
        >
          {text.map((p, i) => (
            <FadeUp
              key={i}
              className="font-light"
              delay={0.1 + i * 0.1}
              style={{
                color: INK,
                fontSize: cq(23),
                lineHeight: cq(32),
                textAlign: "left",
              }}
            >
              {p}
            </FadeUp>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── мобильная вёрстка кейса Nuetel ────────────────── */

/** Включается, когда страница уже не влезает в «настольную» раскладку */
const MOBILE_MAX = 900;

function useMobileLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const read = () => setMobile(window.innerWidth <= MOBILE_MAX);
    read();
    /* ширина бывает не финальной на первом эффекте — перечитываем */
    const t = window.setTimeout(read, 400);
    const ro = new ResizeObserver(read);
    ro.observe(document.documentElement);
    window.addEventListener("resize", read);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", read);
      window.clearTimeout(t);
    };
  }, []);
  return mobile;
}

/** Поля мобильной версии — те же, что на главной */
const MPAD = "var(--gutter-mobile)";
const M = {
  title: 44,
  head: 20,
  lead: 16,
  body: 15,
  bodyLh: 23,
  caption: 11,
  gap: 56,
};

function MRule({ color = "rgba(5,28,46,0.25)" }: { color?: string }) {
  return (
    <motion.div
      aria-hidden
      className="origin-left"
      style={{ width: "100%", height: 1, background: color }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1, ease: EASE_OUT }}
    />
  );
}

function MBody({
  children,
  color = INK,
  delay = 0,
}: {
  children: React.ReactNode;
  color?: string;
  delay?: number;
}) {
  return (
    <FadeUp
      className="font-light"
      delay={delay}
      style={{
        color,
        fontSize: M.body,
        lineHeight: `${M.bodyLh}px`,
      }}
    >
      {children}
    </FadeUp>
  );
}

function MHead({ children, color = DARK }: { children: React.ReactNode; color?: string }) {
  return (
    <FadeUp
      className="font-bold"
      style={{
        color,
        fontSize: M.head,
        lineHeight: "26px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </FadeUp>
  );
}

function MCaption({
  children,
  color = "rgba(5,28,46,0.65)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="font-normal"
      style={{
        color,
        fontSize: M.caption,
        lineHeight: "15px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

/** Картинка во всю колонку, со скруглением и мягким появлением */
function MShot({
  src,
  ar,
  radius = 10,
  fit = "cover",
}: {
  src: string;
  ar?: number;
  radius?: number;
  fit?: "cover" | "contain";
}) {
  return (
    <motion.img
      src={src}
      alt=""
      aria-hidden
      style={{
        display: "block",
        width: "100%",
        maxWidth: "none",
        ...(ar ? { aspectRatio: `${ar}` } : {}),
        objectFit: fit,
        borderRadius: radius,
      }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1.1, ease: EASE_SOFT }}
    />
  );
}

/** Доля кадра, занятая самим телефоном: x, y, ширина, высота (0…1) */
const PHONE_CROPS: [string, number, number, number, number][] = [
  ["/phones/nuetel_phone_1.webp", 0.0265, 0.0574, 0.202, 0.857],
  ["/phones/nuetel_phone_2.webp", 0.1995, 0.0541, 0.196, 0.8862],
  ["/phones/nuetel_phone_3.webp", 0.3845, 0.045, 0.1885, 0.9178],
  ["/phones/nuetel_phone_4.webp", 0.5845, 0.0293, 0.1795, 0.9504],
  ["/phones/nuetel_phone_5.webp", 0.7985, 0.0068, 0.169, 0.9864],
];

/** Кадр кампании, обрезанный по самому телефону */
function MPhone({ crop }: { crop: [string, number, number, number, number] }) {
  const [src, x, y, w, h] = crop;
  return (
    <motion.div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${(w * 2000) / (h * 888)}`,
        overflow: "hidden",
      }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1.1, ease: EASE_SOFT }}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          left: `${(-x / w) * 100}%`,
          top: `${(-y / h) * 100}%`,
          width: `${(1 / w) * 100}%`,
          height: `${(1 / h) * 100}%`,
          maxWidth: "none",
        }}
      />
    </motion.div>
  );
}

/** Вертикальный стек с одинаковыми полями по краям экрана */
function MStack({
  children,
  gap = 20,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap,
        paddingLeft: MPAD,
        paddingRight: MPAD,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Шапка мобильной страницы кейса */
function MHero({
  title,
  tagline,
  years,
  hero,
  /** точка кадрирования: больше 50% — картинка уезжает левее */
  focus = "50% 50%",
}: {
  title: string;
  tagline: string;
  years: string;
  hero: string;
  focus?: string;
}) {
  return (
    <section
      style={{
        position: "relative",
        height: "62svh",
        minHeight: 420,
        background: DARK,
        overflow: "hidden",
      }}
    >
      <motion.img
        src={hero}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "cover",
          objectPosition: focus,
        }}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: EASE_OUT }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,28,46,0.55) 0%, rgba(5,28,46,0.15) 42%, rgba(5,28,46,0.75) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: MPAD,
          right: MPAD,
          bottom: 40,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
        {title.split(`
`).map((line, i) => (
          <RevealLine
            key={line}
            delay={0.2 + i * 0.08}
            className="font-semibold"
            style={{
              color: "#fff",
              fontSize: "min(44px, 9.2vw)",
              lineHeight: 1.04,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {line}
          </RevealLine>
        ))}
        </div>
        <MRule color="rgba(255,255,255,0.75)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MCaption color="rgba(255,255,255,0.88)">{tagline}</MCaption>
          <MCaption color="rgba(255,255,255,0.7)">{years}</MCaption>
        </div>
      </div>
    </section>
  );
}

/** Шапка кейса: тема, описание, теги */
function MIntro({
  kicker,
  subtitle,
  tokens,
}: {
  kicker: string;
  subtitle: string;
  tokens: string[];
}) {
  return (
    <MStack gap={18} style={{ paddingTop: 48 }}>
      <MRule />
      <MHead>
        {kicker.replace(`
`, " ")}
      </MHead>
      <FadeUp
        className="font-normal"
        style={{
          color: DARK,
          fontSize: M.lead,
          lineHeight: "22px",
          textTransform: "uppercase",
        }}
      >
        {subtitle}
      </FadeUp>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tokens.map((t) => (
          <span
            key={t}
            className="font-normal"
            style={{
              border: "1px solid rgba(5,28,46,0.35)",
              borderRadius: 4,
              padding: "6px 10px",
              color: DARK,
              fontSize: 12,
              lineHeight: "14px",
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <MRule />
    </MStack>
  );
}

function MFooterButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-normal uppercase"
      style={{
        border: "1px solid rgba(5,28,46,0.35)",
        borderRadius: 4,
        padding: "14px 18px",
        color: DARK,
        fontSize: 12,
        letterSpacing: "0.14em",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

/** Подвал мобильной страницы кейса */
function MFooter({
  onBack,
  onContacts,
}: {
  onBack: () => void;
  onContacts: () => void;
}) {
  return (
    <MStack gap={18} style={{ paddingTop: M.gap, paddingBottom: 72 }}>
      <MRule />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MFooterButton label="Back to Projects" onClick={onBack} />
        <MFooterButton label="Contacts" onClick={onContacts} />
      </div>
      <MCaption>2026 © MakS Novikov</MCaption>
    </MStack>
  );
}

/** Картинка, которая по тапу открывается во весь экран с прокруткой */
function MZoomShot({
  src,
  radius = 8,
  preview,
}: {
  /** что открывается по тапу */
  src: string;
  radius?: number;
  /** что показано в потоке страницы, если это не сама картинка */
  preview?: string;
}) {
  const [open, setOpen] = useState(false);
  /* открываем по ширине экрана; тап по картинке — приблизить */
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!open) return;
    setZoom(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-label="Open image"
        onClick={() => setOpen(true)}
        style={{ display: "block", width: "100%", padding: 0, border: "none", background: "none" }}
      >
        <MShot src={preview ?? src} radius={radius} />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[150]"
            style={{ background: "rgba(3,24,40,0.96)", overflow: "auto" }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                minWidth: "100%",
                minHeight: "100%",
                width: zoom ? "190%" : "100%",
                padding: "64px 0 80px",
                /* фон на внутреннем слое: иначе при сдвиге вбок он кончается */
                background: "rgba(3,24,40,0.96)",
              }}
            >
              <img
                src={src}
                alt=""
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom((z) => !z);
                }}
                style={{ display: "block", width: "100%", maxWidth: "none" }}
              />
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="fixed flex items-center justify-center rounded-full"
              style={{
                top: 20,
                right: 20,
                width: 44,
                height: 44,
                background: ACCENT,
                border: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
                <path
                  d="M1 1 L17 17 M17 1 L1 17"
                  stroke="#fff"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Мобильная версия страницы Nuetel: один поток, без 3D и липких экранов */
function NuetelMobile({
  title,
  tagline,
  subtitle,
  hero,
  years,
  kicker,
  tokens,
  onBack,
  onContacts,
}: {
  title: string;
  tagline: string;
  subtitle: string;
  hero: string;
  years: string;
  kicker: string;
  tokens: string[];
  onBack: () => void;
  onContacts: () => void;
}) {
  return (
    <main
      className="relative select-text"
      style={{ background: LIGHT, overflowX: "clip" }}
      aria-label={`${title} — project`}
    >
      {/* стрелка «назад» — только наверху страницы, уезжает со скроллом */}
      <BackArrow onClick={onBack} onCursor={() => {}} pinned={false} />
      <MHero title={title} tagline={tagline} years={years} hero={hero} />
      <MIntro kicker={kicker} subtitle={subtitle} tokens={tokens} />

      {/* вступление */}
      <MStack gap={18} style={{ paddingTop: 36 }}>
        {STORY_INTRO.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p.text}
          </MBody>
        ))}
      </MStack>

      <MStack style={{ paddingTop: 32 }}>
        <MShot src="/nuetel_phone.webp" />
      </MStack>

      {/* шаги истории */}
      <MStack gap={0} style={{ paddingTop: M.gap }}>
        {STORY_STEPS.map((s, i) => (
          <div
            key={s.num}
            style={{
              position: "relative",
              paddingLeft: 26,
              paddingBottom: i === STORY_STEPS.length - 1 ? 0 : 28,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 3,
                top: 4,
                width: 9,
                height: 9,
                background: "#E6007E",
                transform: "rotate(45deg)",
              }}
            />
            {i !== STORY_STEPS.length - 1 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 7,
                  top: 16,
                  bottom: 0,
                  width: 1,
                  background: "rgba(5,28,46,0.28)",
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <MCaption>{s.num}</MCaption>
                <span
                  className="font-bold"
                  style={{
                    color: DARK,
                    fontSize: 16,
                    lineHeight: "20px",
                    textTransform: "uppercase",
                  }}
                >
                  {s.title}
                </span>
              </div>
              <MRule />
              <MBody>{s.desc.replace(/\n/g, " ")}</MBody>
            </div>
          </div>
        ))}
      </MStack>

      {/* синий экран про компанию */}
      <section
        style={{
          position: "relative",
          marginTop: M.gap,
          background: NUETEL_BLUE,
          overflow: "hidden",
        }}
      >
        <img
          src="/nuetel_about.jpg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxWidth: "none",
            objectFit: "cover",
            opacity: 0.9,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(3,24,40,0.55)",
          }}
        />
        <MStack gap={18} style={{ position: "relative", paddingTop: 48, paddingBottom: 48 }}>
          {ABOUT_TEXT.map((t, i) => (
            <MBody key={i} color="#fff" delay={i * 0.05}>
              {t}
            </MBody>
          ))}
        </MStack>
      </section>

      {/* визуальный язык и логотип */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        {LOGO_STORY.text.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p.text}
          </MBody>
        ))}
        <img
          src="/nuetel_logo.svg"
          alt=""
          aria-hidden
          style={{
            display: "block",
            width: "62%",
            maxWidth: 220,
            margin: "18px auto 6px",
          }}
        />
        <MRule />
      </MStack>

      {/* развороты гайдлайна */}
      <MStack gap={14} style={{ paddingTop: 28 }}>
        {GUIDE_SHOTS.map((s) => (
          <MShot key={s.src} src={s.src} />
        ))}
      </MStack>

      {/* цифры дизайн-системы */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MRule />
        <FadeUp
          className="font-normal"
          style={{
            color: DARK,
            fontSize: M.lead,
            lineHeight: "22px",
            textTransform: "uppercase",
          }}
        >
          {SYSTEM_STATS.text}
        </FadeUp>
        <MRule />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {SYSTEM_STATS.items.map((it) => (
            <div
              key={it.label}
              style={{
                flex: "1 1 40%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                className="font-bold"
                style={{ color: DARK, fontSize: 22, lineHeight: "26px" }}
              >
                {it.n}
              </span>
              <MCaption>{it.label}</MCaption>
            </div>
          ))}
        </div>
      </MStack>

      {/* сайт */}
      <MStack gap={14} style={{ paddingTop: M.gap }}>
        <MHead>Website</MHead>
        <MShot src={LAPTOP_FRAMES[LAPTOP_FRAMES.length - 1]} />
      </MStack>

      {/* рекламные материалы */}
      <MStack gap={12} style={{ paddingTop: M.gap }}>
        <MHead>Advertising materials</MHead>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: `${1440 / ADV_GRID_H}`,
          }}
        >
          {ADV_BANNERS.map((b) => (
            <img
              key={b.src}
              src={b.src}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left: `${(b.x / 1440) * 100}%`,
                top: `${(b.y / ADV_GRID_H) * 100}%`,
                width: `${(b.w / 1440) * 100}%`,
                height: `${(b.h / ADV_GRID_H) * 100}%`,
                maxWidth: "none",
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
          ))}
        </div>
      </MStack>

      {/* рекламная кампания */}
      <MStack gap={16} style={{ paddingTop: M.gap }}>
        <MRule />
        <MHead>{ADV_CAMPAIGN.title}</MHead>
        <MBody>{ADV_CAMPAIGN.text}</MBody>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            paddingTop: 6,
          }}
        >
          {PHONE_CROPS.map((c) => (
            <MPhone key={c[0]} crop={c} />
          ))}
        </div>
      </MStack>

      {/* финальный кадр и коллаж */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MShot src={FINAL_SHOT_IMG.src} ar={FINAL_SHOT_IMG.ar} />
        <MRule />
        <MHead>{SKETCH_TO_SYSTEM.title}</MHead>
        {SKETCH_TO_SYSTEM.text.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
      </MStack>

      <MStack gap={14} style={{ paddingTop: 28 }}>
        {/* три скетча в один ряд: ширина поровну, пропорции свои */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(
            [
              ["/sketch/sketch_1.webp", 752 / 480],
              ["/sketch/sketch_2.webp", 752 / 650],
              ["/sketch/sketch_3.webp", 752 / 406],
            ] as [string, number][]
          ).map(([src, ar]) => (
            <div key={src} style={{ flex: "1 1 0", minWidth: 0 }}>
              <MShot src={src} ar={ar} radius={6} />
            </div>
          ))}
        </div>
        <MShot src="/sketch/laptop_tablet.webp" radius={8} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {GRID_SHOTS.map((s) => (
            <MShot key={s.src} src={s.src} ar={16 / 9} radius={8} />
          ))}
        </div>
        <MShot src="/sketch/final_wide.webp" radius={8} />
      </MStack>

      <MFooter onBack={onBack} onContacts={onContacts} />
    </main>
  );
}

/* ────────────────── мобильная вёрстка кейса Yandex Market ──────────────── */

/** Панно из баннеров на мобиле: 4 плитки в ряд, 54 ряда */
const WALL_M_COLS = 4;

/** Шаг процесса: номер, название, описание и кружок-маркер */
function MStep({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 6,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: ACCENT,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <MCaption>{num}</MCaption>
          <span
            className="font-bold"
            style={{
              color: DARK,
              fontSize: 16,
              lineHeight: "20px",
              textTransform: "uppercase",
            }}
          >
            {title}
          </span>
        </div>
        <MBody>{desc}</MBody>
      </div>
    </div>
  );
}

function YandexMobile({
  title,
  tagline,
  subtitle,
  hero,
  years,
  kicker,
  tokens,
  intro,
  stats,
  onBack,
  onContacts,
}: {
  title: string;
  tagline: string;
  subtitle: string;
  hero: string;
  years: string;
  kicker: string;
  tokens: string[];
  intro?: string[];
  stats?: { n: string; label: string }[];
  onBack: () => void;
  onContacts: () => void;
}) {
  const wallRows = Array.from({ length: 216 / WALL_M_COLS }, (_, r) =>
    Array.from({ length: WALL_M_COLS }, (__, c) => r * WALL_M_COLS + c + 1),
  );
  return (
    <main
      className="relative select-text"
      style={{ background: LIGHT, overflowX: "clip" }}
      aria-label={`${title} — project`}
    >
      <BackArrow onClick={onBack} onCursor={() => {}} pinned={false} />
      <MHero title={title} tagline={tagline} years={years} hero={hero} />
      <MIntro kicker={kicker} subtitle={subtitle} tokens={tokens} />

      {/* вступление и цифры */}
      <MStack gap={18} style={{ paddingTop: 36 }}>
        {(intro ?? []).map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
        {!!stats?.length && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              paddingTop: 10,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  flex: "1 1 40%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  className="font-bold"
                  style={{ color: DARK, fontSize: 22, lineHeight: "26px" }}
                >
                  {s.n}
                </span>
                <MCaption>{s.label}</MCaption>
              </div>
            ))}
          </div>
        )}
      </MStack>

      {/* панно из баннеров: подпись сверху, 4 в ряд */}
      <MStack gap={12} style={{ paddingTop: M.gap }}>
        <MCaption>Here is just a small selection of my work</MCaption>
        <div style={{ display: "flex", flexDirection: "column", gap: WALL_GAP }}>
          {wallRows.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: WALL_GAP }}>
              {row.map((n) => (
                <div
                  key={n}
                  style={{
                    flex: "1 1 0",
                    aspectRatio: `${WALL_TILE_AR}`,
                    position: "relative",
                  }}
                >
                  <img
                    src={`/yanban/b${String(n).padStart(3, "0")}.webp`}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      maxWidth: "none",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </MStack>

      {/* баланс бренда и площадки */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MRule />
        <MHead>{BRAND_BALANCE.title.replace(/\n/g, " ")}</MHead>
        {BRAND_BALANCE.text.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
      </MStack>

      {/* как устроен типовой заказ */}
      <MStack gap={22} style={{ paddingTop: M.gap }}>
        {PROCESS_STEPS.map((s) => (
          <MStep key={s.num} num={s.num} title={s.title} desc={s.desc} />
        ))}
      </MStack>

      {/* ресайзы (схему-дерево на мобиле не показываем) */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        {RESIZE_TEXT.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
      </MStack>

      {/* гайдлайны */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MRule />
        <MHead>Design guidelines</MHead>
        {GUIDELINE_TEXT.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
      </MStack>

      {/* три фотографии в ряд */}
      <MStack style={{ paddingTop: 28 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ flex: "1 1 0", minWidth: 0 }}>
              <MShot src={`/yan/exp_${n}.webp`} ar={1} radius={6} />
            </div>
          ))}
        </div>
      </MStack>

      {/* ускорение производства */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MRule />
        <MHead>{SPEEDING_UP.title.replace(/\n/g, " ")}</MHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            className="font-semibold"
            style={{
              color: DARK,
              fontSize: 28,
              lineHeight: "32px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            30% faster
          </span>
          <MCaption>
            Production speed with banner builder (well, approximately — it’s
            really tough to count)
          </MCaption>
        </div>
        {SPEEDING_UP.text.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
        <MShot src="/yan/tokens.webp" radius={8} />
      </MStack>

      {/* дизайн, который работает */}
      <MStack gap={18} style={{ paddingTop: M.gap }}>
        <MRule />
        <MHead>{DESIGN_PERFORMS.title.replace(/\n/g, " ")}</MHead>
        <MShot src="/yan/grand_slam.webp" ar={GRAND_SLAM_AR} radius={8} />
        {DESIGN_PERFORMS.text.map((p, i) => (
          <MBody key={i} delay={i * 0.05}>
            {p}
          </MBody>
        ))}
      </MStack>

      {/* заметка про теннисные корты */}
      <MStack gap={16} style={{ paddingTop: M.gap }}>
        <MRule />
        <FadeUp
          className="font-normal"
          style={{
            color: DARK,
            fontSize: M.lead,
            lineHeight: "22px",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {TENNIS_NOTE.replace(/\n/g, " ")}
        </FadeUp>
        <MRule />
      </MStack>

      {/* подборки баннеров — тап открывает крупно */}
      <MStack gap={12} style={{ paddingTop: 32 }}>
        {[1, 2, 3].map((n) => (
          <MZoomShot key={n} src={`/yan/banners_${n}.webp`} />
        ))}
        <MZoomShot src="/yan/banners_fin.webp" />
      </MStack>

      <MFooter onBack={onBack} onContacts={onContacts} />
    </main>
  );
}

/* ─────────────── мобильная вёрстка кейса Landings & Brandzones ─────────── */

/** Вступление и цифры — общий блок мобильных страниц */
function MLead({
  intro,
  stats,
}: {
  intro?: string[];
  stats?: { n: string; label: string }[];
}) {
  return (
    <MStack gap={18} style={{ paddingTop: 36 }}>
      {(intro ?? []).map((p, i) => (
        <MBody key={i} delay={i * 0.05}>
          {p}
        </MBody>
      ))}
      {!!stats?.length && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 10 }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 40%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                className="font-bold"
                style={{ color: DARK, fontSize: 22, lineHeight: "26px" }}
              >
                {s.n}
              </span>
              <MCaption>{s.label}</MCaption>
            </div>
          ))}
        </div>
      )}
    </MStack>
  );
}

function LandingsMobile({
  title,
  tagline,
  subtitle,
  hero,
  years,
  kicker,
  tokens,
  intro,
  stats,
  screens,
  outro,
  cards,
  sketch,
  onBack,
  onContacts,
}: {
  title: string;
  tagline: string;
  subtitle: string;
  hero: string;
  years: string;
  kicker: string;
  tokens: string[];
  intro?: string[];
  stats?: { n: string; label: string }[];
  screens?: string[];
  outro?: { title?: string; text: string[] };
  cards?: ConceptCard[];
  sketch?: Props["sketch"];
  onBack: () => void;
  onContacts: () => void;
}) {
  /* скриншоты лендингов — по три в ряд */
  const screenRows: string[][] = [];
  for (let i = 0; i < (screens?.length ?? 0); i += 3)
    screenRows.push((screens as string[]).slice(i, i + 3));

  return (
    <main
      className="relative select-text"
      style={{ background: LIGHT, overflowX: "clip" }}
      aria-label={`${title} — project`}
    >
      <BackArrow onClick={onBack} onCursor={() => {}} pinned={false} />
      <MHero title={title} tagline={tagline} years={years} hero={hero} />
      <MIntro kicker={kicker} subtitle={subtitle} tokens={tokens} />
      <MLead intro={intro} stats={stats} />

      {/* скриншоты лендингов по три в ряд */}
      {!!screenRows.length && (
        <MStack gap={8} style={{ paddingTop: M.gap }}>
          {screenRows.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: 8 }}>
              {row.map((src) => (
                <div key={src} style={{ flex: "1 1 0", minWidth: 0 }}>
                  <MShot src={src} ar={1440 / 900} radius={5} />
                </div>
              ))}
            </div>
          ))}
        </MStack>
      )}

      {/* текст про баланс стилей */}
      {!!outro?.text?.length && (
        <MStack gap={18} style={{ paddingTop: M.gap }}>
          <MRule />
          {outro.title && <MHead>{outro.title.replace(/\n/g, " ")}</MHead>}
          {outro.text.map((p, i) => (
            <MBody key={i} delay={i * 0.05}>
              {p}
            </MBody>
          ))}
        </MStack>
      )}

      {/* карточки Adapt / Create / Update — друг под другом */}
      {!!cards?.length && (
        <MStack gap={12} style={{ paddingTop: 36 }}>
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 0.8, ease: EASE_SOFT, delay: i * 0.08 }}
              style={{
                border: `1px solid ${LINE_SOFT}`,
                background: FILL_SOFT,
                borderRadius: 6,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 28, height: 28, display: "block" }}
              >
                {CONCEPT_ICONS[card.icon]}
              </svg>
              <span
                className="font-bold"
                style={{
                  color: DARK,
                  fontSize: 16,
                  lineHeight: "20px",
                  textTransform: "uppercase",
                }}
              >
                {card.title}
              </span>
              <MBody>{card.text}</MBody>
            </motion.div>
          ))}
        </MStack>
      )}

      {/* от скетча к запуску; доску с задачами на мобиле не показываем */}
      {sketch && (
        <>
          <MStack gap={18} style={{ paddingTop: M.gap }}>
            <MRule />
            <MHead>{sketch.title.replace(/\n/g, " ")}</MHead>
            {sketch.text.map((p, i) => (
              <MBody key={i} delay={i * 0.05}>
                {p}
              </MBody>
            ))}
          </MStack>

          {/* три кадра правок в один ряд, тап — крупно */}
          <MStack gap={10} style={{ paddingTop: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {sketch.images.map((src, i) => (
                <div
                  key={src}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <MZoomShot src={src} radius={6} />
                  {sketch.captions?.[i] && (
                    <MCaption>{sketch.captions[i]}</MCaption>
                  )}
                </div>
              ))}
            </div>
          </MStack>

          {/* видео с процессом */}
          {!!sketch.video?.length && (
            <MStack style={{ paddingTop: 28 }}>
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={sketch.videoPoster}
                style={{ display: "block", width: "100%", borderRadius: 8 }}
              >
                {sketch.video.map((src) => (
                  <source
                    key={src}
                    src={src}
                    type={src.endsWith(".webm") ? "video/webm" : "video/mp4"}
                  />
                ))}
              </video>
            </MStack>
          )}

          {!!sketch.videoNote?.length && (
            <MStack gap={18} style={{ paddingTop: 36 }}>
              {sketch.videoNote.map((p, i) => (
                <MBody key={i} delay={i * 0.05}>
                  {p}
                </MBody>
              ))}
              {sketch.videoNoteImage && (
                <MZoomShot src={sketch.videoNoteImage} />
              )}
            </MStack>
          )}

          {/* превью лендингов: тап открывает полную страницу */}
          {!!sketch.previews?.length && (
            <MStack gap={28} style={{ paddingTop: M.gap }}>
              <MRule />
              {sketch.previews.map((pv) => (
                <div
                  key={pv.src}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <span
                    className="font-bold"
                    style={{
                      color: DARK,
                      fontSize: 16,
                      lineHeight: "20px",
                      textTransform: "uppercase",
                    }}
                  >
                    {pv.title}
                  </span>
                  <MBody>{pv.text}</MBody>
                  <MZoomShot src={pv.full ?? pv.src} preview={pv.src} />
                </div>
              ))}
            </MStack>
          )}
        </>
      )}

      <MFooter onBack={onBack} onContacts={onContacts} />
    </main>
  );
}

/* ──────────────── мобильная вёрстка кейса Additional works ─────────────── */

/** Заголовок секции и абзацы под ним */
function MSection({
  title,
  text,
  children,
}: {
  title: string;
  text?: string[];
  children?: React.ReactNode;
}) {
  return (
    <MStack gap={18} style={{ paddingTop: M.gap }}>
      <MRule />
      <MHead>{title.replace(/\n/g, " ")}</MHead>
      {(text ?? []).map((p, i) => (
        <MBody key={i} delay={i * 0.05}>
          {p}
        </MBody>
      ))}
      {children}
    </MStack>
  );
}

function AdditionalMobile({
  title,
  tagline,
  subtitle,
  hero,
  years,
  kicker,
  tokens,
  intro,
  outro,
  onBack,
  onContacts,
}: {
  title: string;
  tagline: string;
  subtitle: string;
  hero: string;
  years: string;
  kicker: string;
  tokens: string[];
  intro?: string[];
  outro?: { title?: string; text: string[] };
  onBack: () => void;
  onContacts: () => void;
}) {
  return (
    <main
      className="relative select-text"
      style={{ background: LIGHT, overflowX: "clip" }}
      aria-label={`${title} — project`}
    >
      <BackArrow onClick={onBack} onCursor={() => {}} pinned={false} />
      {/* кадр сдвинут влево: иначе морда леопарда уезжает за правую кромку */}
      <MHero
        title={title}
        tagline={tagline}
        years={years}
        hero={hero}
        focus="72% 50%"
      />
      <MIntro kicker={kicker} subtitle={subtitle} tokens={tokens} />
      <MLead intro={intro} />

      {/* Gza: приложение-навигатор */}
      <MSection title={outro?.title ?? "Gza navigation app concept"} text={outro?.text}>
        <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <MShot src="/gza/logo_card.webp" ar={413.38 / 383.4} />
          </div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <MShot src="/icon_render_1.jpg" ar={418.29 / 383.08} />
          </div>
        </div>
        {/* иконки приложения в ряд */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "space-between",
            paddingTop: 6,
          }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <img
              key={i}
              src={`/gza/icon_${i + 1}.svg`}
              alt=""
              aria-hidden
              style={{ flex: "1 1 0", minWidth: 0, display: "block" }}
            />
          ))}
        </div>
        {/* обложка — отдельным блоком под иконками */}
        <div style={{ paddingTop: 6 }}>
          <MShot src="/gza/cover.webp" ar={562 / 501} />
        </div>
        {/* экраны приложения: два в ряд, без синей линии */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            paddingTop: 6,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <MShot key={n} src={`/gza/phone_${n}.webp`} ar={307 / 620} />
          ))}
        </div>
        <div style={{ paddingTop: 6 }}>
          <MShot src="/gza/image_fin.webp" />
        </div>
      </MSection>

      {/* 4dev: презентации и отчёты */}
      <MSection
        title={"Presentations, stats & financial reports"}
        text={[
          "For the 4dev.com platform, I created reports and presentations with statistics and analytical content, adapting them to the company’s design guidelines. I also worked with marketing creatives and content for email campaigns.",
          "Since the information is under NDA, some text has been replaced with Lorem Ipsum.",
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 6,
          }}
        >
          {[1, 2].map((n) => (
            <MZoomShot key={n} src={`/dev4/shot_${n}.webp`} />
          ))}
        </div>
      </MSection>

      {/* pocket photo studio: кадры уже колонки, без подложки */}
      <MSection
        title={"Pocket photo studio app creatives"}
        text={[
          "A series of marketing creatives and Instagram Stories for a pocket photo studio app. The application uses Face Swap technology to transform photos of real people into stylish portraits, giving users a way to create professional-looking images without a photo shoot.",
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            paddingTop: 6,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ width: "74%" }}>
              <MZoomShot src={`/pocket/shot_${n}.webp`} />
            </div>
          ))}
          <MZoomShot src="/pocket/fin.webp" />
        </div>
      </MSection>

      {/* лендинги и презентации */}
      <MSection
        title={"Landing Pages & Presentations"}
        text={[
          "A series of landing pages and presentations designed for a financial platform",
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 6,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <MZoomShot key={n} src={`/refund/shot_${n}.webp`} />
          ))}
        </div>
      </MSection>

      {/* превью и промо-материалы */}
      <MSection
        title={"Thumbnails and promotion materials"}
        text={[
          "Content for a sports video game. All 3D scenes were created in Blender 3D, with post-processing done in Photoshop and Figma.",
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 6,
          }}
        >
          {["thumb_1", "thumb_2", "thumb_3", "task_1", "task_2", "task_3", "task_4"].map(
            (s) => (
              <MZoomShot key={s} src={`/thumbs/${s}.webp`} />
            ),
          )}
        </div>
      </MSection>

      {/* пет-проект */}
      <MSection
        title={"Pet-project"}
        text={[
          "Some time ago, I started drawing custom portraits. What began as a small hobby gradually grew into a personal project.",
          "It was a fun way to combine my love for drawing with running a small creative project of my own.",
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 6,
          }}
        >
          {[1, 2].map((n) => (
            <MZoomShot key={n} src={`/pet/shot_${n}.webp`} />
          ))}
        </div>
      </MSection>

      <MFooter onBack={onBack} onContacts={onContacts} />
    </main>
  );
}

/* ───────────────────────────── страница кейса ──────────────────────────── */

type Props = {
  title: string;
  tagline?: string;
  subtitle?: string;
  hero?: string;
  titleSize?: number;
  heroInk?: string;
  /** линейка в шапке — во всю ширину заголовка, а не фиксированные 502 */
  heroRuleFull?: boolean;
  years?: string;
  kicker?: string;
  tokens?: string[];
  intro?: string[];
  stats?: { n: string; label: string }[];
  wall?: boolean;
  story?: boolean;
  /** мозаика из скриншотов 3×3 под вступлением */
  screens?: string[];
  /** текстовый фрейм под мозаикой: слева заголовок, справа абзацы */
  outro?: { title?: string; text: string[]; media?: "gza" };
  /** ряд карточек под текстовым фреймом */
  cards?: ConceptCard[];
  /** интерактивная доска под карточками */
  board?: "landings";
  /** отбивка, текстовый фрейм и три кадра в ряд под доской */
  sketch?: {
    title: string;
    text: string[];
    images: string[];
    captions?: string[];
    video?: string[];
    videoPoster?: string;
    videoNote?: string[];
    videoNoteImage?: string;
    /** превью лендингов под отбивкой */
    previews?: { src: string; title: string; text: string; full?: string }[];
  };
};

export default function ProjectView({
  title,
  tagline,
  subtitle,
  hero = "/nuetel_hero.jpg",
  titleSize = 96,
  heroInk = "#fff",
  heroRuleFull = false,
  years = "",
  kicker = "",
  tokens = [],
  intro,
  stats,
  wall = false,
  story = false,
  screens,
  outro,
  cards,
  board,
  sketch,
}: Props) {
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const mobile = useMobileLayout();
  const { back } = useTransitionNav();
  /* страница, у которой контент разложен на два «слоёных» фрейма */
  const hasDev4 = !story && !!intro && outro?.media === "gza";
  /* первый фрейм липнет так, чтобы его низ упёрся в низ экрана */
  const [panelRef, panelTop] = useStickyTop(hasDev4);
  const titleLines = title.split(`
`);

  /* линейка под заголовком тянется на его ширину — меряем по факту,
     потому что ширина зависит от шрифта и кегля */
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleWidth, setTitleWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el || !heroRuleFull) return;
    const measure = () => setTitleWidth(el.getBoundingClientRect().width);
    measure();
    /* шрифт может доехать позже — перемеряем */
    const t = window.setTimeout(measure, 600);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [heroRuleFull, title, titleSize]);

  /* Блок цифр выравниваем по левому краю группы токенов.
     Храним не пиксели, а долю ширины: вся панель задана в cqw, поэтому
     доля постоянна — колонка цифр едет вместе с токенами при любом
     изменении ширины, без задержки ResizeObserver. */
  const tokensRef = useRef<HTMLDivElement>(null);
  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  useEffect(() => {
    const el = tokensRef.current;
    if (!el) return;
    const measure = () => {
      /* узел мог открепиться при переключении на мобильную вёрстку —
         такие замеры дают 0 и портят позицию, их отбрасываем */
      const node = tokensRef.current;
      if (!node || !node.isConnected) return;
      const parent = node.offsetParent as HTMLElement | null;
      const w = parent?.clientWidth || document.documentElement.clientWidth;
      const ratio = w > 0 ? node.offsetLeft / w : 0;
      ratio > 0.2 && ratio < 1 && setTokensLeft(ratio);
    };
    measure();
    /* шрифт может доехать позже — перемеряем */
    const t = window.setTimeout(measure, 600);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.offsetParent && ro.observe(el.offsetParent);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tokens, mobile]);

  // шапка «уезжает» вглубь, пока прокручиваем её собственную высоту
  const heroRef = useRef<HTMLElement>(null);
  const heroHeight = useRef(1);
  const { scrollY } = useScroll();
  const heroScale = useTransform(scrollY, (y) => {
    const p = Math.min(1, Math.max(0, y / (heroHeight.current || 1)));
    return HERO_SCALE_FROM + (HERO_SCALE_TO - HERO_SCALE_FROM) * p;
  });

  const sceneAnchorRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: aboutProgress } = useScroll({
    target: aboutRef,
    offset: ["start end", "end start"],
  });
  const aboutScale = useTransform(
    aboutProgress,
    [0, 1],
    [ABOUT_SCALE_FROM, ABOUT_SCALE_TO],
  );

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const measure = () => {
      heroHeight.current = el.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, window.scrollY / heroHeight.current));
      heroScale.set(HERO_SCALE_FROM + (HERO_SCALE_TO - HERO_SCALE_FROM) * p);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heroScale]);

  const goBack = () => {
    try {
      sessionStorage.setItem(TO_PROJECTS_KEY, "1");
    } catch {}
    back("/");
  };

  /* на главную и сразу к экрану контактов — тем же способом, что в меню */
  const goContacts = () => {
    try {
      sessionStorage.setItem(MENU_TARGET_KEY, "#contacts");
    } catch {}
    back("/");
  };

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-scrollbar");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && goBack();
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("no-scrollbar"),
        window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (mobile && hasDev4)
    return (
      <AdditionalMobile
        title={title}
        tagline={tagline ?? ""}
        subtitle={subtitle ?? ""}
        hero={hero}
        years={years}
        kicker={kicker}
        tokens={tokens}
        intro={intro}
        outro={outro}
        onBack={goBack}
        onContacts={goContacts}
      />
    );

  if (mobile && board === "landings")
    return (
      <LandingsMobile
        title={title}
        tagline={tagline ?? ""}
        subtitle={subtitle ?? ""}
        hero={hero}
        years={years}
        kicker={kicker}
        tokens={tokens}
        intro={intro}
        stats={stats}
        screens={screens}
        outro={outro}
        cards={cards}
        sketch={sketch}
        onBack={goBack}
        onContacts={goContacts}
      />
    );

  if (mobile && wall)
    return (
      <YandexMobile
        title={title}
        tagline={tagline ?? ""}
        subtitle={subtitle ?? ""}
        hero={hero}
        years={years}
        kicker={kicker}
        tokens={tokens}
        intro={intro}
        stats={stats}
        onBack={goBack}
        onContacts={goContacts}
      />
    );

  if (mobile && story)
    return (
      <NuetelMobile
        title={title}
        tagline={tagline ?? ""}
        subtitle={subtitle ?? ""}
        hero={hero}
        years={years}
        kicker={kicker}
        tokens={tokens}
        onBack={goBack}
        onContacts={goContacts}
      />
    );

  return (
    <main
      className="@container relative"
      style={{ background: LIGHT, overflowX: "clip" }}
      aria-label={`${title} — project`}
    >
      <BackArrow onClick={goBack} onCursor={setCursor} pinned={!mobile} />
      <div className="relative">
        {/* шапка: hero-картинка, заголовок, линейка, подписи */}
        <section
          ref={heroRef}
          className="sticky top-0 z-0 overflow-hidden"
          style={{ height: cq(892), background: DARK }}
        >
          <motion.div
            style={{ position: "absolute", inset: 0, scale: heroScale }}
          >
            <motion.img
              src={hero}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left: cq(-200),
                top: cq(-200),
                width: cq(2320),
                height: cq(1186),
                maxWidth: "none",
                objectFit: "cover",
              }}
              initial={{ scale: HERO_IMAGE_SCALE_IN }}
              animate={{ scale: 1 }}
              transition={{
                duration: HERO_IMAGE_DURATION,
                ease: EASE_OUT,
                delay: HERO_TITLE_DELAY,
              }}
            />
          </motion.div>
          <div
            className="select-text"
            style={{
              position: "absolute",
              left: cq(240),
              top: 0,
              width: cq(1440),
            }}
          >
            {/* многострочный заголовок растёт вверх от cap-top 356 */}
            <div
              ref={titleRef}
              style={{
                position: "absolute",
                top: capTop(
                  356 - (titleLines.length - 1) * titleSize,
                  titleSize,
                  titleSize,
                ),
              }}
            >
              {titleLines.map((line, i) => (
                <RevealLine
                  key={line}
                  delay={HERO_TITLE_DELAY + i * 0.08}
                  className="font-semibold"
                  style={{
                    color: heroInk,
                    fontSize: cq(titleSize),
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {line}
                </RevealLine>
              ))}
            </div>
            <motion.div
              aria-hidden
              className="origin-left"
              style={{
                position: "absolute",
                top: cq(460),
                width:
                  heroRuleFull && titleWidth !== null
                    ? titleWidth
                    : cq(HERO_RULE_W),
                height: 1,
                background: heroInk,
              }}
              initial={{ scaleX: 0 }}
              animate={{
                scaleX: 1,
                transition: {
                  duration: RULE_DURATION,
                  delay: HERO_RULE_DELAY,
                  ease: EASE_OUT,
                },
              }}
            />
            {tagline && (
            <RevealLine
              delay={HERO_TAGLINE_DELAY}
              className="font-normal"
              style={{
                color: heroInk,
                position: "absolute",
                top: capTop(498, 12, 16),
                fontSize: cq(12),
                lineHeight: cq(16),
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {tagline}
            </RevealLine>
            )}
            {/* без подзаголовка годы поднимаются на его строку */}
            <RevealLine
              delay={tagline ? HERO_YEARS_DELAY : HERO_TAGLINE_DELAY}
              className="font-normal"
              style={{
                color: heroInk,
                position: "absolute",
                top: capTop(tagline ? 532 : 498, 12, 16),
                fontSize: cq(12),
                lineHeight: cq(16),
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {years}
            </RevealLine>
          </div>
        </section>

        {/* история Nuetel: липкий экран поверх шапки */}
        {story && (
          <div
            style={{
              position: "relative",
              zIndex: 10,
              height: cq(STORY_PANEL_H + STORY_TAIL),
              background: LIGHT,
            }}
          >
            <section
              className="select-text"
              style={{
                position: "sticky",
                top: `calc(100svh - ${cq(STORY_PANEL_H)})`,
                height: cq(STORY_PANEL_H),
                background: LIGHT,
                overflow: "hidden",
              }}
            >
              <NuetelScene
                anchorRef={sceneAnchorRef}
                className="pointer-events-none fixed inset-0 z-0"
              />
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(35),
                  width: cq(1440),
                }}
              />
              <p
                className="font-normal"
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: capTop(71, 22.93, 30),
                  width: cq(420),
                  color: DARK,
                  fontSize: cq(22.93),
                  lineHeight: cq(30),
                  textTransform: "uppercase",
                }}
              >
                {subtitle}
              </p>
              <p
                className="font-bold"
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: capTop(71, 22.93, 30),
                  color: DARK,
                  fontSize: cq(22.93),
                  lineHeight: cq(30),
                  textTransform: "uppercase",
                  whiteSpace: "pre-line",
                }}
              >
                {kicker}
              </p>
              <div
                style={{
                  position: "absolute",
                  right: cq(240),
                  top: cq(77),
                  display: "flex",
                  gap: cq(12),
                }}
              >
                {tokens.map((t) => (
                  <TokenChip key={t} label={t} />
                ))}
              </div>
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(152),
                  width: cq(1440),
                }}
              />
              {STORY_INTRO.map((p) => (
                <FadeUp
                  key={p.y}
                  className="font-light"
                  style={{
                    position: "absolute",
                    left: cq(240),
                    top: capTop(p.y, 23, 32),
                    width: cq(TEXT_COL_W),
                    color: INK,
                    fontSize: cq(23),
                    lineHeight: cq(32),
                    textAlign: "left",
                  }}
                >
                  {p.text}
                </FadeUp>
              ))}
              <img
                src="/nuetel_phone.webp"
                alt=""
                aria-hidden
                style={{
                  position: "absolute",
                  left: cq(1064),
                  top: cq(188),
                  width: cq(535),
                  height: cq(778),
                  maxWidth: "none",
                  display: "block",
                }}
              />
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(865),
                  width: cq(TEXT_COL_W),
                }}
              />
              {/* вертикальная ось шагов */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: cq(STORY_SPINE.x),
                  top: cq(STORY_SPINE.y),
                  width: cq(1),
                  height: cq(STORY_SPINE.h),
                  background: DARK,
                  opacity: 0.7,
                }}
              />
              {STORY_STEPS.map((step) => (
                <motion.div
                  key={step.num}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: cq(step.y),
                    width: "100%",
                    height: cq(STORY_MARK),
                  }}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "200% 0px -12% 0px" }}
                >
                  <svg
                    viewBox="0 0 22 22"
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: cq(STORY_SPINE.x - STORY_MARK / 2),
                      top: 0,
                      width: cq(STORY_MARK),
                      height: cq(STORY_MARK),
                    }}
                  >
                    <path d="M11 0 L22 11 L11 22 L0 11 Z" fill={ACCENT} />
                  </svg>
                  <VariantMaskLine
                    delay={STORY_TEXT_DELAY}
                    className="font-normal"
                    style={{
                      position: "absolute",
                      left: cq(STORY_COL.num),
                      top: cq(8 - 3.9),
                      color: DARK,
                      fontSize: cq(12),
                      lineHeight: cq(16),
                      letterSpacing: "0.14em",
                    }}
                  >
                    {step.num}
                  </VariantMaskLine>
                  <VariantMaskLine
                    delay={STORY_TEXT_DELAY}
                    className="font-semibold"
                    style={{
                      position: "absolute",
                      left: cq(STORY_COL.title),
                      top: cq(-7.16),
                      color: DARK,
                      fontSize: cq(22.93),
                      lineHeight: cq(30),
                      letterSpacing: "0.01em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.title}
                  </VariantMaskLine>
                  <motion.div
                    aria-hidden
                    className="origin-left"
                    style={{
                      position: "absolute",
                      left: cq(STORY_COL.rule),
                      top: cq(27),
                      width: cq(STORY_DESC_W),
                      height: 1,
                      background: DARK,
                      opacity: 0.7,
                    }}
                    variants={{
                      hidden: { scaleX: 0 },
                      show: {
                        scaleX: 1,
                        transition: {
                          duration: RULE_DURATION,
                          delay: STORY_RULE_DELAY,
                          ease: EASE_OUT,
                        },
                      },
                    }}
                  />
                  <VariantFade
                    delay={STORY_DESC_DELAY}
                    className="font-normal"
                    style={{
                      position: "absolute",
                      left: cq(STORY_COL.desc),
                      top: cq(39 - 3.9),
                      width: cq(STORY_DESC_W),
                      color: DARK,
                      fontSize: cq(12),
                      lineHeight: cq(16),
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {step.desc}
                  </VariantFade>
                </motion.div>
              ))}
              {/* якорь для three.js-сцены с клавиатурой */}
              <div
                ref={sceneAnchorRef}
                aria-hidden
                style={{
                  position: "absolute",
                  left: cq(578),
                  top: cq(1045),
                  width: cq(1200),
                  height: cq(675),
                }}
              />
            </section>
          </div>
        )}

        {/* светлая панель с заголовком, токенами, вступлением и цифрами */}
        {!story && intro && (
          <section
            className="select-text"
            ref={panelRef}
            style={{
              /* когда снизу есть второй фрейм — первый останавливается,
                 упёршись нижней кромкой в низ экрана, и второй наезжает
                 на него слоем */
              position: hasDev4 ? "sticky" : "relative",
              top: hasDev4 ? panelTop : undefined,
              zIndex: 10,
              background: LIGHT,
            }}
          >
            <div style={{ position: "relative", height: cq(PANEL_HEAD_H) }}>
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(35),
                  width: cq(1440),
                }}
              />
              <p
                className="font-normal"
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: capTop(71, 22.93, 30),
                  width: cq(420),
                  color: DARK,
                  fontSize: cq(22.93),
                  lineHeight: cq(30),
                  textTransform: "uppercase",
                }}
              >
                {subtitle}
              </p>
              <p
                className="font-bold"
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: capTop(71, 22.93, 30),
                  color: DARK,
                  fontSize: cq(22.93),
                  lineHeight: cq(30),
                  textTransform: "uppercase",
                  whiteSpace: "pre-line",
                }}
              >
                {kicker}
              </p>
              <div
                ref={tokensRef}
                style={{
                  position: "absolute",
                  right: cq(240),
                  top: cq(77),
                  display: "flex",
                  gap: cq(12),
                }}
              >
                {tokens.map((t) => (
                  <TokenChip key={t} label={t} />
                ))}
              </div>
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(152),
                  width: cq(1440),
                }}
              />
            </div>
            <div
              style={{
                position: "relative",
                /* запас под колонку цифр нужен только когда она есть */
                minHeight: stats ? cq(INTRO_MIN_H) : 0,
                marginTop: cq(INTRO_TOP),
                paddingBottom: cq(8),
              }}
            >
              <div
                style={{
                  marginLeft: cq(240),
                  width: cq(TEXT_COL_W),
                  display: "flex",
                  flexDirection: "column",
                  gap: cq(32),
                }}
              >
                {intro.map((p, i) => (
                  <FadeUp
                    key={i}
                    className="font-light"
                    delay={i * 0.1}
                    style={{
                      color: INK,
                      fontSize: cq(23),
                      lineHeight: cq(32),
                      textAlign: "left",
                    }}
                  >
                    {p}
                  </FadeUp>
                ))}
              </div>
              {stats && (
                <div
                  style={{
                    position: "absolute",
                    left:
                      tokensLeft === null
                        ? cq(1064)
                        : `${(tokensLeft * 100).toFixed(4)}%`,
                    right: cq(240),
                    top: cq(STATS_TOP),
                    display: "flex",
                    flexDirection: "column",
                    gap: cq(40),
                  }}
                >
                  {stats.map((s, i) => (
                    <FadeUp key={s.label} delay={0.1 + i * 0.1}>
                      <span
                        className="font-semibold"
                        style={{
                          display: "block",
                          color: DARK,
                          fontSize: cq(STAT_FONT_SIZE),
                          lineHeight: cq(STAT_LINE_HEIGHT),
                          letterSpacing: cq(2.63),
                          textTransform: "uppercase",
                        }}
                      >
                        <CountUp value={s.n} />
                      </span>
                      <span
                        className="font-light"
                        style={{
                          display: "block",
                          marginTop: cq(10),
                          color: DARK,
                          fontSize: cq(12),
                          lineHeight: cq(14),
                          letterSpacing: cq(1.73),
                          textTransform: "uppercase",
                        }}
                      >
                        {s.label}
                      </span>
                    </FadeUp>
                  ))}
                </div>
              )}
            </div>

            {screens && screens.length > 0 && (
              <ScreenMosaic screens={screens} />
            )}

            {outro && (
              <>
                {/* если мозаики сверху нет — отбиваем фрейм линейкой */}
                <TextFrame
                  title={outro.title}
                  text={outro.text}
                  /* −8 компенсирует нижний внутренний отступ блока вступления,
                     чтобы расстояние от текста до линейки было ровно SECTION_GAP */
                  marginTop={screens ? OUTRO_TOP : SECTION_GAP - 8}
                  rule={!screens}
                />
                {outro.media === "gza" && <GzaBlock />}
              </>
            )}

            {cards && cards.length > 0 && (
              <ConceptCards cards={cards} marginTop={CARDS_TOP} />
            )}

            {board === "landings" && (
              <>
                <FadeUp
                  className="font-normal"
                  style={{
                    marginTop: cq(CARDS_TO_NOTE),
                    marginLeft: cq(240),
                    width: cq(1440),
                    color: DARK,
                    fontSize: cq(22.93),
                    lineHeight: cq(30),
                    textTransform: "uppercase",
                    textAlign: "center",
                    whiteSpace: "pre-line",
                  }}
                >
                  {LANDING_BOARD_NOTE}
                </FadeUp>
                <div style={{ marginTop: cq(BOARD_NOTE_TO_BOARD) }}>
                  <LandingBoard />
                </div>
              </>
            )}

            {sketch && (
              <>
                <TextFrame
                  title={sketch.title}
                  text={sketch.text}
                  marginTop={SECTION_GAP}
                />
                <SketchRow images={sketch.images} captions={sketch.captions} />
                {sketch.video && (
                  <LoopVideo
                    sources={sketch.video}
                    poster={sketch.videoPoster}
                  />
                )}
                {sketch.videoNote && (
                  <VideoNote
                    text={sketch.videoNote}
                    image={sketch.videoNoteImage}
                  />
                )}
                {sketch.previews && <PreviewGrid items={sketch.previews} />}
              </>
            )}

            {(screens || outro || cards || sketch) && (
              <div
                style={{
                  /* воздух под Gza image fin до нижней кромки первого фрейма —
                     такой же, как от вступления до линейки под ним */
                  height: cq(hasDev4 ? FRAME_TAIL : MOSAIC_TAIL),
                }}
                aria-hidden
              />
            )}
          </section>
        )}
        {/* следующие фреймы наезжают на предыдущие по мере скрола */}
        {hasDev4 && <Dev4Section />}
        {hasDev4 && <PocketSection />}
        {hasDev4 && <RefundSection />}
        {hasDev4 && <ThumbsSection />}
        {hasDev4 && <PetSection />}
      </div>

      {/* синий экран про компанию + липкий экран дизайн-системы */}
      {story && (
        <section className="relative z-20 select-text">
          <div
            ref={aboutRef}
            style={{
              position: "relative",
              width: "100%",
              height: cq(ABOUT_H),
              background: NUETEL_BLUE,
              overflow: "hidden",
            }}
          >
            <motion.img
              src="/nuetel_about.jpg"
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left: cq(-250),
                top: 0,
                width: cq(ABOUT_IMG_W),
                height: cq(869),
                maxWidth: "none",
                objectFit: "cover",
                transformOrigin: "50% 0%",
                scale: aboutScale,
              }}
            />
            <p
              className="font-semibold"
              style={{
                position: "absolute",
                left: cq(240),
                top: capTop(70, 22.93, 30),
                width: cq(720),
                color: "#fff",
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
              }}
            >
              {ABOUT_TEXT[0]}
            </p>
            <div
              style={{
                position: "absolute",
                left: cq(240),
                top: cq(246),
                width: cq(502),
                height: 1,
                background: "#fff",
              }}
            />
            <p
              className="font-semibold"
              style={{
                position: "absolute",
                left: cq(240),
                top: capTop(317, 22.93, 30),
                width: cq(720),
                color: "#fff",
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
              }}
            >
              {ABOUT_TEXT[1]}
            </p>
            <div
              style={{
                position: "absolute",
                left: cq(240),
                top: cq(493),
                display: "flex",
                gap: cq(50),
              }}
            >
              {["Simplicity", "Flexibility"].map((t) => (
                <span
                  key={t}
                  className="font-semibold"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: `${cq(12)} ${cq(28)}`,
                    borderRadius: cq(6),
                    border: "1px solid rgba(255,255,255,0.7)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    fontSize: cq(22.93),
                    lineHeight: cq(30),
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: `calc(${cq(SYSTEM_STICKY_H)} + ${LAPTOP_LEAD_VH}svh)` }}>
            <div
              style={{
                position: "sticky",
                top: `calc(${LAPTOP_STICKY_TOP} - ${cq(SYSTEM_STICKY_H)})`,
                width: "100%",
                height: cq(SYSTEM_STICKY_H),
                background: LIGHT,
              }}
            >
              {LOGO_STORY.text.map((p, i) => (
                <FadeUp
                  key={i}
                  className="font-light"
                  delay={i * 0.12}
                  style={{
                    position: "absolute",
                    left: cq(720),
                    top: capTop(p.y, 23, 32),
                    width: cq(960),
                    color: INK,
                    fontSize: cq(23),
                    lineHeight: cq(32),
                    textAlign: "left",
                  }}
                >
                  {p.text}
                </FadeUp>
              ))}
              <img
                src="/nuetel_logo.svg"
                alt="Nuetel"
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(LOGO_STORY.logoY),
                  width: cq(390),
                  height: cq(90.76),
                  maxWidth: "none",
                }}
              />
              <Rule
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(LOGO_STORY.ruleY),
                  width: cq(1440),
                }}
              />
              {/* коллаж разворотов гайдлайна в три колонки */}
              <div
                style={{
                  position: "absolute",
                  left: cq(240),
                  top: cq(GUIDE_TOP),
                  width: cq(1440),
                  display: "flex",
                  gap: cq(GUIDE_GAP),
                  alignItems: "flex-start",
                }}
              >
                {GUIDE_COLUMNS.map((col, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: cq(GUIDE_GAP),
                      width: cq(GUIDE_COL_W),
                    }}
                  >
                    {col.map((shot) => (
                      <img
                        key={shot.src}
                        src={shot.src}
                        alt="Nuetel design system"
                        style={{
                          width: cq(GUIDE_COL_W),
                          height: cq(shot.h),
                          display: "block",
                          maxWidth: "none",
                          borderRadius: cq(12),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {/* статистика дизайн-системы — гаснет, когда наезжает ноутбук */}
              <div
                ref={fadeRef}
                style={{
                  position: "absolute",
                  left: 0,
                  top: cq(SYSTEM_STATS_TOP),
                  width: "100%",
                  height: cq(SYSTEM_STATS.h),
                }}
              >
                <Rule
                  style={{
                    position: "absolute",
                    left: cq(240),
                    top: cq(SYSTEM_STATS.rule1),
                    width: cq(1440),
                  }}
                />
                <FadeUp
                  className="font-normal"
                  style={{
                    position: "absolute",
                    left: cq(598),
                    top: capTop(SYSTEM_STATS.lead, 22.93, 30),
                    width: cq(724),
                    color: DARK,
                    fontSize: cq(22.93),
                    lineHeight: cq(30),
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {SYSTEM_STATS.text}
                </FadeUp>
                <Rule
                  style={{
                    position: "absolute",
                    left: cq(240),
                    top: cq(SYSTEM_STATS.rule2),
                    width: cq(1440),
                  }}
                />
                {SYSTEM_STATS.items.map((item, i) => (
                  <div key={item.label}>
                    <FadeUp
                      className="font-bold"
                      delay={i * 0.1}
                      style={{
                        position: "absolute",
                        left: cq(item.x),
                        top: capTop(SYSTEM_STATS.num, 22.93, 30),
                        color: DARK,
                        fontSize: cq(22.93),
                        lineHeight: cq(30),
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.n}
                    </FadeUp>
                    <FadeUp
                      className="font-normal"
                      delay={i * 0.1 + 0.08}
                      style={{
                        position: "absolute",
                        left: cq(item.x),
                        top: capTop(SYSTEM_STATS.label, 12, 16),
                        color: DARK,
                        fontSize: cq(12),
                        lineHeight: cq(16),
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </FadeUp>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {story && <LaptopSequence fadeRef={fadeRef} />}
      {story && <AdvMaterials />}
      {story && <AdvCampaign />}
      {story && <FinalShot />}
      {wall && <BannerWall />}
      {wall && <MarketProcess />}

      <ProjectFooter onBack={goBack} onContacts={goContacts} />

      {cursor &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[130] flex items-center justify-center rounded-full font-semibold text-white uppercase"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: 74,
              height: 74,
              marginLeft: -37,
              marginTop: -37,
              backgroundColor: ACCENT,
              fontSize: 14,
              letterSpacing: "0.14em",
            }}
          >
            Back
          </div>,
          document.body,
        )}
    </main>
  );
}

/* ───────────────────────────── ноутбук с кадрами сайта ─────────────────── */

/**
 * Липкий ноутбук: по прокрутке перелистываем кадры сайта,
 * параллельно гасим блок статистики под ним (fadeRef).
 */
function LaptopSequence({
  fadeRef,
}: {
  fadeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const last = LAPTOP_FRAMES.length - 1;
    const apply = (p: number) => {
      const t = Math.max(0, Math.min(1, (p - LAPTOP_START) / LAPTOP_SPAN));
      setFrame(Math.round(t * last));
      const fade = fadeRef.current;
      fade && (fade.style.opacity = String(1 - Math.min(1, t / FADE_SPAN)));
    };
    apply(scrollYProgress.get());
    return scrollYProgress.on("change", apply);
  }, [scrollYProgress, fadeRef]);

  return (
    <section
      ref={sectionRef}
      className="relative z-30"
      style={{
        height: `${LAPTOP_SECTION_VH}svh`,
        marginTop: `calc(-1 * (${LAPTOP_STICKY_TOP}) - ${LAPTOP_LEAD_VH}svh)`,
      }}
      aria-label="Nuetel website"
    >
      <div
        className="sticky top-0 flex items-end justify-center overflow-hidden"
        style={{ height: "100svh", paddingBottom: `${LAPTOP_PAD_VH}svh` }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: LAPTOP_H,
            aspectRatio: `${LAPTOP_AR}`,
          }}
        >
          {LAPTOP_FRAMES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === LAPTOP_FRAMES.length - 1 ? "Nuetel website" : ""}
              aria-hidden={i !== LAPTOP_FRAMES.length - 1}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "bottom center",
                maxWidth: "none",
                opacity: i === frame ? 1 : 0,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── мозаика рекламных материалов ────────────── */

/** Панно из рекламных баннеров Nuetel, выложенное по координатам Figma */
function AdvMaterials() {
  return (
    <section
      className="relative z-20"
      style={{
        background: LIGHT,
        paddingTop: `max(0px, calc(${cq(SECTION_GAP)} - ${LAPTOP_PAD_VH}svh))`,
        paddingBottom: cq(SECTION_GAP - CAMPAIGN_PAD_TOP),
      }}
      aria-label="Nuetel advertising materials"
    >
      <div
        style={{
          position: "relative",
          marginLeft: cq(240),
          width: cq(1440),
          height: cq(ADV_GRID_H),
        }}
      >
        {ADV_BANNERS.map((b, i) => (
          <motion.img
            key={b.src}
            src={b.src}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              left: cq(b.x),
              top: cq(b.y),
              width: cq(b.w),
              height: cq(b.h),
              objectFit: "cover",
              display: "block",
              maxWidth: "none",
              borderRadius: cq(12),
            }}
            initial={{ opacity: 0, y: "1.2em" }}
            whileInView={{ opacity: 1, y: "0em" }}
            viewport={{ once: true, margin: "0px 0px -12% 0px" }}
            transition={{
              duration: 1.4,
              ease: EASE_SOFT,
              delay: i * 0.07,
              opacity: { duration: 1.2, ease: "easeInOut", delay: i * 0.07 },
            }}
          />
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────── рекламная кампания ──────────────────────── */

/**
 * Липкий экран кампании: четыре кадра телефонов по очереди
 * выезжают снизу по мере прокрутки секции.
 */
function AdvCampaign() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const ease = cubicBezier(
    EASE_PHONE[0],
    EASE_PHONE[1],
    EASE_PHONE[2],
    EASE_PHONE[3],
  );
  const y1 = useTransform(
    scrollYProgress,
    [0 * PHONE_SEGMENT, 1 * PHONE_SEGMENT],
    ["100%", "0%"],
    { ease },
  );
  const y2 = useTransform(
    scrollYProgress,
    [1 * PHONE_SEGMENT, 2 * PHONE_SEGMENT],
    ["100%", "0%"],
    { ease },
  );
  const y3 = useTransform(
    scrollYProgress,
    [2 * PHONE_SEGMENT, 3 * PHONE_SEGMENT],
    ["100%", "0%"],
    { ease },
  );
  const y4 = useTransform(
    scrollYProgress,
    [3 * PHONE_SEGMENT, 4 * PHONE_SEGMENT],
    ["100%", "0%"],
    { ease },
  );
  const offsets = [y1, y2, y3, y4];

  return (
    <section
      ref={sectionRef}
      className="relative z-20"
      style={{ height: `calc(100svh + ${PHONE_SCROLL_VH}svh)`, background: LIGHT }}
      aria-label="Nuetel advertising campaign"
    >
      <div className="sticky top-0 overflow-hidden" style={{ height: "100svh" }}>
        <div
          style={{
            marginLeft: cq(240),
            width: cq(1440),
            paddingTop: cq(CAMPAIGN_PAD_TOP),
          }}
        >
          <Rule style={{ width: "100%" }} />
          <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
            <FadeUp
              className="font-bold"
              style={{
                width: cq(480),
                marginTop: cq(0.98),
                paddingRight: cq(40),
                color: DARK,
                fontSize: cq(22.93),
                lineHeight: cq(30),
                textTransform: "uppercase",
              }}
            >
              {ADV_CAMPAIGN.title}
            </FadeUp>
            <FadeUp
              className="font-light"
              delay={0.1}
              style={{
                width: cq(960),
                color: INK,
                fontSize: cq(23),
                lineHeight: cq(32),
                textAlign: "left",
              }}
            >
              {ADV_CAMPAIGN.text}
            </FadeUp>
          </div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              marginTop: cq(32),
              width: "100%",
              height: `min(${cq(1440 / PHONE_SHOT_AR)}, calc(100svh - ${cq(PHONE_CHROME_H)}))`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                aspectRatio: `${PHONE_SHOT_AR}`,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <img
                src="/phones/nuetel_phone_1.webp"
                alt=""
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxWidth: "none",
                }}
              />
              {PHONE_FRAMES.map((src, i) => (
                <motion.img
                  key={src}
                  src={src}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                    y: offsets[i],
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── финальный постер ────────────────────────── */

/** Финальный кадр, текст «от скетча к системе» и коллаж скетчей */
function FinalShot() {
  return (
    <section
      className="relative z-20"
      style={{
        paddingTop: cq(FINAL_PAD_TOP),
        paddingBottom: cq(SECTION_GAP),
        background: LIGHT,
      }}
    >
      <div style={{ marginLeft: cq(240), width: cq(1440) }}>
        <img
          src={FINAL_SHOT_IMG.src}
          alt=""
          aria-hidden
          style={{
            display: "block",
            width: "100%",
            maxWidth: "none",
            aspectRatio: `${FINAL_SHOT_IMG.ar}`,
            objectFit: "cover",
            borderRadius: cq(12),
          }}
        />
        <Rule style={{ width: "100%", marginTop: cq(SECTION_GAP) }} />
        <div style={{ display: "flex", marginTop: cq(71 - 8.14) }}>
          <FadeUp
            className="font-bold"
            style={{
              width: cq(480),
              marginTop: cq(0.98),
              paddingRight: cq(40),
              color: DARK,
              fontSize: cq(22.93),
              lineHeight: cq(30),
              textTransform: "uppercase",
            }}
          >
            {SKETCH_TO_SYSTEM.title}
          </FadeUp>
          <FadeUp
            className="font-light"
            delay={0.1}
            style={{
              width: cq(960),
              color: INK,
              fontSize: cq(23),
              lineHeight: cq(32),
              textAlign: "left",
            }}
          >
            {SKETCH_TO_SYSTEM.text.map((p, i) => (
              <p key={i} style={{ marginTop: i ? cq(24) : 0 }}>
                {p}
              </p>
            ))}
          </FadeUp>
        </div>
        <div
          style={{
            position: "relative",
            width: "100%",
            marginTop: cq(71 - 8.14),
            height: cq(SKETCH_TOTAL_H),
          }}
        >
          {SKETCH_SHOTS.map((s) => (
            <img
              key={s.src}
              src={s.src}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left: `${(s.x / 1440) * 100}%`,
                top: `${(s.y / SKETCH_TOTAL_H) * 100}%`,
                width: `${(s.w / 1440) * 100}%`,
                height: `${(s.h / SKETCH_TOTAL_H) * 100}%`,
                maxWidth: "none",
                objectFit: "cover",
                borderRadius: cq(12),
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
