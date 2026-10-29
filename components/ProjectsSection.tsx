"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWideLayout } from "./CharacterExperience";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import SplitText from "@/components/SplitText";
import { useTransitionNav } from "@/components/PageTransition";
import { PROJECTS, projectHref, type Project } from "@/lib/projects";

/* ------------------------------------------------------------------ */
/*  Галерея плиток (sticky-сетка над таблицей проектов)                */
/* ------------------------------------------------------------------ */

/** столбцов в сетке */
const COLS = 8;
/** строк в сетке */
const ROWS = 3;
/** зазор между плитками, px */
const GAP = 10;
/** максимальная непрозрачность вертикальных направляющих */
const GUIDE_OPACITY = 0.15;
/** отступ sticky-сцены сверху, svh */
const TOP_SVH = 7;
/** длина прокрутки сцены, svh */
const SCENE_SVH = 260;
/** хвост прокрутки после сцены, svh */
const TAIL_SVH = 70;
/** доля общего прогресса, в которую укладывается появление плиток */
const SCENE_SPAN = SCENE_SVH / (SCENE_SVH + TAIL_SVH);

/* Кегль заголовка таблицы фиксирован: при сужении окна он не ужимается */
const HEADING_SIZE = "52px";
const HEADING_LH = "60px";
const HEADING_LS = "2.08px";

/* А надписи на панно живут в его же единицах: те же 52/60/2.08 px при
   ширине 1920, дальше масштабируются вместе с сеткой фотографий */
const PANEL_SIZE = `${((52 / 1920) * 100).toFixed(4)}cqw`;
const PANEL_LH = `${((60 / 1920) * 100).toFixed(4)}cqw`;
const PANEL_LS = `${((2.08 / 1920) * 100).toFixed(4)}cqw`;

/** сторона ячейки сетки */
const CELL = `${100 / COLS}cqw`;
const GRID_H = `calc(${ROWS} * ${CELL})`;
/** сетка центрируется по высоте sticky-области */
const GRID_TOP = `calc((${100 - TOP_SVH}svh - ${GRID_H}) / 2)`;
const GRID_LEFT = CELL;

const tileLeft = (col: number) =>
  `calc(${GRID_LEFT} + ${col} * ${CELL} + ${GAP}px)`;
const tileTop = (row: number) =>
  `calc(${GRID_TOP} + ${row} * ${CELL} + ${GAP}px)`;
const tileSize = (span: number) => `calc(${span} * ${CELL} - ${2 * GAP}px)`;
/** верх строки заголовка: от сетки вверх на высоту строки текста */
const headingTop = (row: number) =>
  `calc(${GRID_TOP} + ${row} * ${CELL} - ${PANEL_LH})`;

/** кроссфейд кадров, мс */
const FADE_MS = 1800;
/** сдвиг кадров (slide / slideDown), мс */
const SLIDE_MS = 1600;
/** половина занавеса (curtain), мс */
const CURTAIN_MS = 700;
/** пауза между закрытием и открытием занавеса, мс */
const CURTAIN_HOLD_MS = 150;
const CURTAIN_EASE = "cubic-bezier(0.42,0,0.58,1)";
const INK = "#031828";

type CurtainSide = "l" | "r";
/** створка убрана за край кадра */
const curtainHidden = (side: CurtainSide) =>
  side === "l" ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
/** створка закрывает свою половину кадра */
const curtainClosed = (side: CurtainSide) =>
  side === "l" ? "inset(0 49.8% 0 0)" : "inset(0 0 0 49.8%)";

type TileMedia = {
  frames: string[];
  interval?: number;
  mode?: "curtain" | "slide" | "slideDown";
  fit?: "cover" | "contain";
};

const TILE_MEDIA: Record<number, TileMedia> = {
  1: { frames: ["icon_render_1.jpg"] },
  2: {
    frames: ["tavern_1.jpg", "tavern_2.jpg", "tavern_3.jpg", "tavern_4.jpg"],
    interval: 7e3,
  },
  3: {
    frames: ["photostudio_1.jpg", "photostudio_2.jpg", "photostudio_3.jpg"],
    interval: 1e4,
    mode: "curtain",
  },
  4: {
    frames: ["adv_1.jpg", "adv_2.jpg", "adv_3.jpg", "adv_4.jpg"],
    interval: 5500 + SLIDE_MS,
    mode: "slide",
  },
  5: {
    frames: ["banners_1.jpg", "banners_2.jpg", "banners_3.jpg"],
    interval: 9e3,
  },
  6: {
    frames: ["landing_1.jpg", "landing_2.jpg", "landing_3.jpg", "landing_4.jpg"],
    interval: 12e3,
  },
  7: {
    frames: ["deloghi_1.jpg", "deloghi_2.jpg", "deloghi_3.jpg", "deloghi_4.jpg"],
    interval: 5e3,
  },
  8: { frames: ["3d_1.jpg", "3d_2.jpg", "3d_3.jpg"], interval: 11e3 },
  9: {
    frames: ["my_book_1.jpg", "my_book_2.jpg", "my_book_3.jpg", "my_book_4.jpg"],
    interval: 8e3,
    mode: "slideDown",
  },
};

const TILE_RADIUS = `${(6 / 1920) * 100}cqw`;
/** бирюзовый тон поверх кадра, снимается по ховеру */
const TILE_TINT = "#0DA4C1";

type Tile = {
  /** номер плитки = ключ в TILE_MEDIA */
  n: number;
  /** столбец */
  c: number;
  /** строка */
  r: number;
  /** ширина в ячейках */
  w: number;
  /** высота в ячейках */
  h: number;
};

const TILES: Tile[] = [
  { n: 1, c: 0, r: 1, w: 1, h: 1 },
  { n: 2, c: 0, r: 2, w: 1, h: 1 },
  { n: 3, c: 1, r: 1, w: 1, h: 2 },
  { n: 4, c: 2, r: 1, w: 1, h: 1 },
  { n: 5, c: 2, r: 2, w: 1, h: 1 },
  { n: 6, c: 3, r: 0, w: 1, h: 2 },
  { n: 7, c: 4, r: 0, w: 1, h: 1 },
  { n: 8, c: 4, r: 1, w: 1, h: 1 },
  { n: 9, c: 5, r: 1, w: 1, h: 1 },
];

/** порядок, в котором плитки выезжают при прокрутке */
const REVEAL_ORDER = [1, 7, 6, 9, 2, 3, 4, 5, 8];
const stepOf = (n: number) => REVEAL_ORDER.indexOf(n);

/** сдвиг прогресса между соседними плитками */
const STEP_STAGGER = 0.075;
/** длительность выезда одной плитки в единицах прогресса */
const STEP_SPAN = 0.3;
/** суммарный прогресс, который занимает вся сетка */
const TILES_TOTAL_SPAN = (TILES.length - 1) * STEP_STAGGER + STEP_SPAN;

/** плитка выезжает снизу на столько px */
const TILE_RISE = 130;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutText = (t: number) => 1 - Math.pow(1 - t, 2.3);

const TEXT_DURATION = 1;
const TEXT_LINE_STAGGER = 0.07;

type HeadingLine = { t: string; accent?: boolean }[];
type Heading = {
  /** при каком прогрессе сцены строка выезжает */
  at: number;
  left: string;
  top: string;
  lines: HeadingLine[];
};

const HEADINGS: Heading[] = [
  {
    at: 0.28,
    left: tileLeft(0),
    top: headingTop(0.5),
    lines: [[{ t: "I’ve always loved" }], [{ t: "beautiful things." }]],
  },
  {
    at: 0.8,
    left: tileLeft(3),
    top: headingTop(2.5),
    lines: [
      [{ t: "Now " }, { t: "I make", accent: true }, { t: " them" }],
      [{ t: "useful, too." }],
    ],
  },
];

export default function ProjectsSection() {
  /* на узких экранах, где 3d-модель уезжает под tech stack, панно с
     фотографиями не показываем — сразу таблица проектов. Сцена вынесена
     в отдельный компонент: иначе её useScroll успевал измерить пустую
     ссылку и после возврата к широкому окну прогресс оставался нулевым —
     место под панно было, а плитки и текст не появлялись */
  const wide = useWideLayout();
  return (
    <div className="relative z-10">
      {wide && <GalleryScene />}
      <ProjectsTable />
    </div>
  );
}

function GalleryScene() {
  const sceneRef = useRef<HTMLElement>(null);

  // направляющие проявляются, пока сцена подъезжает к верху экрана
  const { scrollYProgress: approachProgress } = useScroll({
    target: sceneRef,
    offset: ["start end", "start start"],
  });
  const guideOpacity = useTransform(
    approachProgress,
    [0, 1],
    [0, GUIDE_OPACITY],
  );

  const { scrollYProgress: rawProgress } = useScroll({
    target: sceneRef,
    offset: ["start 0.3", "end end"],
  });
  // плитки успевают появиться за SCENE_SPAN, остаток прокрутки — хвост
  const progress = useTransform(rawProgress, (v) =>
    Math.min(1, v / SCENE_SPAN),
  );

  const { scrollYProgress: exitProgress } = useScroll({
    target: sceneRef,
    offset: ["end end", "end start"],
  });
  // бирюзовая полоса: въезжает вместе с сеткой и уезжает на выходе из сцены
  const barX = useTransform(
    [progress, exitProgress],
    ([enter, exit]: number[]) =>
      exit > 0
        ? `${Math.min(1, exit / 0.7) * 140}cqw`
        : `${enter * 140 - 140}cqw`,
  );

  const [shown, setShown] = useState<boolean[]>([false, false]);

  useMotionValueEvent(progress, "change", (v) => {
    const next = HEADINGS.map((h) => v >= h.at);
    setShown((prev) =>
      prev[0] === next[0] && prev[1] === next[1] ? prev : next,
    );
  });

  return (
    <>
      <div
        className="@container pointer-events-none sticky top-0 h-[100svh] w-full overflow-hidden"
        style={{ marginBottom: "-100svh" }}
        aria-hidden
      >
        {/* из восьми колонок оставляем только крайние направляющие */}
        {[1, COLS - 1].map((col) => (
          <motion.div
            key={col}
            className="absolute top-0 h-full bg-white"
            style={{
              left: `${(col / COLS) * 100}%`,
              width: "0.5px",
              opacity: guideOpacity,
            }}
          />
        ))}
        <motion.div
          className="absolute"
          style={{
            left: "-20cqw",
            width: "140cqw",
            height: 100,
            top: `calc(${TOP_SVH}svh + ${GRID_TOP} + 1.5 * ${CELL} - 50px)`,
            backgroundColor: "#0DA4C1",
            x: barX,
          }}
        />
      </div>

      <section
        ref={sceneRef}
        className="relative lg:h-[var(--lay)]"
        style={
          {
            "--lay": `calc(100svh + ${SCENE_SVH + TAIL_SVH}svh)`,
          } as React.CSSProperties
        }
        aria-label="Gallery"
      >
        <div
          className="@container sticky w-full overflow-hidden"
          style={{ top: `${TOP_SVH}svh`, height: `${100 - TOP_SVH}svh` }}
        >
          {TILES.map((tile) => (
            <GalleryTile
              key={tile.n}
              tile={tile}
              step={stepOf(tile.n)}
              progress={progress}
            />
          ))}
          {HEADINGS.map((heading, i) => (
            <GalleryHeading key={i} heading={heading} show={shown[i]} />
          ))}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Таблица проектов                                                   */
/* ------------------------------------------------------------------ */

/* Таблица масштабируется вместе с шириной окна — как экран work
   experience: размеры заданы для 1920 и дальше ужимаются, но не ниже
   MIN_SCALE, чтобы текст оставался читаемым. */
const MIN_SCALE = 0.68;
const cq = (v: number) =>
  `max(${(v * MIN_SCALE).toFixed(2)}px, ${((v / 1920) * 100).toFixed(4)}cqw)`;

/** контентная колонка: кадр персонажа плюс таблица опыта, 112…1800 */
const COL_MAX = 1688;
/** минимальное охранное поле — то же, что у контента hero */
const COL_GUTTER = 120;
/** охранное поле ужимается вместе с окном, но не уже 20 px */
const GUTTER = `max(var(--gutter-mobile), min(${((COL_GUTTER / 1920) * 100).toFixed(4)}cqw, 112px))`;
/* ширину задаёт экран персонажа: кадр плюс таблица опыта, поджатые
   на INSET с каждой стороны */
const INSET = 0.09;
const TABLE_WIDTH = `min(calc(var(--work-span, ${COL_MAX}px) * ${1 - 2 * INSET}), calc(100% - 2 * ${GUTTER}))`;
/* таблица всегда стоит по центру окна — ширину берём от экрана персонажа,
   а положение считаем сами, иначе её уводит асимметрия охранных полей */
/** внутренний отступ строки */
const PAD = `clamp(16px, ${((48 / 1920) * 100).toFixed(4)}cqw, 48px)`;
/** кегли: масштабируются по ширине, но не мельче читаемого минимума */
const FS = {
  heading: `max(30px, ${((52 / 1920) * 100).toFixed(4)}cqw)`,
  headingLh: `max(34px, ${((60 / 1920) * 100).toFixed(4)}cqw)`,
  name: `max(17px, ${((23 / 1920) * 100).toFixed(4)}cqw)`,
  nameLh: `max(20px, ${((26 / 1920) * 100).toFixed(4)}cqw)`,
  desc: `max(13px, ${((15 / 1920) * 100).toFixed(4)}cqw)`,
  descLh: `max(19px, ${((22.5 / 1920) * 100).toFixed(4)}cqw)`,
};

/* Пороги ширины окна, на которых таблица теряет части: сначала кнопку,
   потом превью, в мобильной версии остаются заголовок и описание */
const W_BUTTON = 1420;
const W_PREVIEW = 1120;
const W_MOBILE = 760;

type RowMode = "full" | "noButton" | "noPreview" | "mobile";

function useRowMode(): RowMode {
  const [mode, setMode] = useState<RowMode>("full");
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setMode(
        w < W_MOBILE
          ? "mobile"
          : w < W_PREVIEW
            ? "noPreview"
            : w < W_BUTTON
              ? "noButton"
              : "full",
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return mode;
}

/** колонки строки: название и описание — обе слева, описание под названием */
const COLUMNS = { name: { x: 48, w: 760 }, desc: { x: 48, w: 420 } };

/** высота строки в покое */
const ROW_H = 128;
const PREVIEW_W = 356;
const PREVIEW_H = (PREVIEW_W * 9) / 16;
/** кнопка «jump to a project» из макета (buttonsmall / jump) */
const BUTTON = {
  w: 226,
  h: 34,
  radius: 6,
  padX: 15,
  gap: 15,
  icon: 13,
  size: 15,
  ls: 0.45,
};
/** от кнопки до правого края таблицы — столько же, сколько слева до названия */
const BUTTON_RIGHT = 48;
/** зазор между превью и левым краем кнопки */
const PREVIEW_GAP = 65;
const PREVIEW_RIGHT = BUTTON_RIGHT + BUTTON.w + PREVIEW_GAP;
const NAME_TOP = 51;
const ROW_TOP = NAME_TOP + 5.1;
/** высота строки под раскрытым превью */
const ROW_H_HOT = Math.round(ROW_TOP + PREVIEW_H + 48);
/** раскрытая строка без превью: название плюс описание */
const ROW_H_TEXT = 176;
/** мобильная строка: описание всегда видно */
const ROW_H_MOBILE = 168;
/** отступ до якоря #projects-anchor */
const ANCHOR_GAP = 40.4;
/** пауза скролла на таблице проектов, svh */
const TABLE_HOLD = 45;
/** насколько заголовок с таблицей опущены ниже центра экрана */
const HEADING_DROP = 18;

const NAME_TYPE = { size: 23, lh: 26, weight: 700, ls: 0.7 };
const DESC_TYPE = { size: 15, lh: 22.5, weight: 300 };

/** низ превью: по нему выравнивается нижняя строка описания */
const PREVIEW_BOTTOM = ROW_TOP + PREVIEW_H;
/** сдвиг вниз, чтобы по низу совпали буквы описания, а не line-box:
    полулидинг плюс поправка на реальные метрики Montserrat (выверено по замеру) */
const DESC_LEADING = (DESC_TYPE.lh - DESC_TYPE.size * 1.219) / 2 + 2.76;

const HAIRLINE = "rgba(255,255,255,0.22)";
const ACCENT = "#B91372";
const EASE = "cubic-bezier(0.22,1,0.36,1)";

type Cursor = { x: number; y: number };

/** Уголок-стрелка ↗ из макета */
function CornerArrow({ size, color }: { size: string; color: string }) {
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

function ProjectsTable() {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hotIndex, setHotIndex] = useState<number | null>(null);
  const mode = useRowMode();
  const { go, busy } = useTransitionNav();

  const open = (slug?: string) => {
    if (!slug || busy) return;
    setCursor(null);
    go(projectHref(slug));
  };

  return (
    <section className="@container relative" aria-label="Projects">
      {/* рельса с паузой: таблица залипает в экране, пока прокручивается
          TABLE_HOLD — так же, как держится экран Work experience */}
      <div
        className="relative"
        style={{ height: `calc(100svh + ${TABLE_HOLD}svh)` }}
      >
        {/* якорь для меню и восстановления скролла — вне залипающего слоя,
            иначе его позиция плывёт вместе с ним */}
        <span
          id="projects-anchor"
          className="absolute block h-0"
          style={{
            top: `calc(50svh - (${cq(60)} + ${cq(ANCHOR_GAP + PROJECTS.length * ROW_H)}) / 2 + ${cq(HEADING_DROP + 60 + ANCHOR_GAP)})`,
          }}
          aria-hidden
        />

        <div
          className="sticky top-0"
          style={{
            height: "100svh",
            // блок (заголовок + строки) встаёт по центру экрана
            paddingTop: `calc(50svh - (${cq(60)} + ${cq(ANCHOR_GAP + PROJECTS.length * ROW_H)}) / 2 + ${cq(HEADING_DROP)})`,
          }}
        >
          <div className="relative z-10 flex justify-center">
            <SplitText
              text="Projects"
              className="font-semibold text-white uppercase select-text"
              style={{
                fontSize: FS.heading,
                lineHeight: FS.headingLh,
                letterSpacing: cq(2.63),
              }}
            />
          </div>

          <div
            id="project-1"
            className="relative"
            style={{
              marginTop: cq(ANCHOR_GAP),
              marginLeft: "auto",
              marginRight: "auto",
              width: TABLE_WIDTH,
              borderBottom: `1px solid ${HAIRLINE}`,
              overflowAnchor: "none",
            }}
          >
            {PROJECTS.map((project, i) => (
              <ProjectRow
                key={project.src}
                index={i}
                project={project}
                mode={mode}
                hot={mode === "mobile" || hotIndex === i}
                dim={hotIndex !== null && hotIndex !== i}
                onHot={(on) =>
                  setHotIndex((prev) => (on ? i : prev === i ? null : prev))
                }
                onCursor={setCursor}
                onOpen={() => open(project.slug)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* воздух между таблицей и экраном контактов */}
      <div className="h-[16svh]" aria-hidden />

      {cursor &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[120] flex items-center justify-center rounded-full font-semibold text-white"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: 92,
              height: 92,
              marginLeft: -46,
              marginTop: -46,
              backgroundColor: ACCENT,
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Explore
          </div>,
          document.body,
        )}
    </section>
  );
}

type ProjectRowProps = {
  index: number;
  project: Project;
  mode: RowMode;
  hot: boolean;
  dim: boolean;
  onHot: (on: boolean) => void;
  onCursor: (cursor: Cursor | null) => void;
  onOpen: () => void;
};

function ProjectRow({
  index,
  project,
  mode,
  hot,
  dim,
  onHot,
  onCursor,
  onOpen,
}: ProjectRowProps) {
  const clickable = !!project.slug;
  const withButton = mode === "full";
  /* в мобильной версии текст встаёт по общему охранному полю страницы */
  const pad = mode === "mobile" ? "0px" : PAD;
  const withPreview = mode === "full" || mode === "noButton";
  /* превью сдвигается вправо, когда кнопки уже нет */
  const previewRight = withButton ? PREVIEW_RIGHT : BUTTON_RIGHT;
  /* высота раскрытой строки: с превью — по его низу, без превью — по
     описанию; в мобильной версии строка не раскрывается вовсе */
  const rowH =
    mode === "mobile"
      ? ROW_H_MOBILE
      : hot
        ? withPreview
          ? ROW_H_HOT
          : ROW_H_TEXT
        : ROW_H;
  /* в мобильной версии описание стоит сразу под названием */
  const descTop =
    mode === "mobile" || !withPreview
      ? NAME_TOP + NAME_TYPE.lh + 14
      : PREVIEW_BOTTOM + DESC_LEADING;
  const descShift = mode === "mobile" || !withPreview;

  return (
    <motion.div
      className="relative w-full"
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
    >
      <div
        role={clickable ? "link" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? `${project.title} — open project` : undefined}
        onClick={clickable ? onOpen : undefined}
        onKeyDown={
          clickable
            ? (e) => (e.key === "Enter" || e.key === " ") && onOpen()
            : undefined
        }
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") {
            onHot(true);
            if (clickable) onCursor({ x: e.clientX, y: e.clientY });
          }
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && clickable)
            onCursor({ x: e.clientX, y: e.clientY });
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") {
            onHot(false);
            onCursor(null);
          }
        }}
        style={{
          position: "relative",
          width: "100%",
          height: cq(rowH),
          overflow: "hidden",
          cursor: clickable && mode !== "mobile" ? "none" : "default",
          opacity: dim ? 0.4 : 1,
          backgroundColor:
            hot && mode !== "mobile"
              ? "rgba(255,255,255,0.02)"
              : "rgba(255,255,255,0)",
          transition: `height 680ms ${EASE}, opacity 450ms ${EASE}, background-color 450ms ${EASE}`,
        }}
      >
        <div
          className="absolute"
          style={{
            left: pad,
            top: cq(NAME_TOP),
            width: `calc(100% - 2 * ${pad})`,
          }}
        >
          <span
            className="select-text"
            style={{
              color: hot && mode !== "mobile" ? ACCENT : "#fff",
              fontSize: FS.name,
              lineHeight: FS.nameLh,
              letterSpacing: cq(NAME_TYPE.ls),
              fontWeight: NAME_TYPE.weight,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              transition: `color 420ms ${EASE}`,
            }}
          >
            {project.brand ?? project.title}
          </span>
        </div>

        {/* описание проекта: под названием, низ последней строки — вровень с низом превью */}
        <div
          className="absolute"
          style={{
            left: pad,
            top: cq(descTop),
            width: descShift
              ? `calc(100% - 2 * ${pad})`
              : `min(${cq(COLUMNS.desc.w)}, calc(100% - ${PAD} - ${cq(previewRight + PREVIEW_W + 32)}))`,
            opacity: hot ? 1 : 0,
            transform: descShift
              ? `translateY(${hot ? "0px" : cq(10)})`
              : `translateY(calc(-100% + ${hot ? "0px" : cq(10)}))`,
            transition: `opacity 460ms ${EASE}, transform 560ms ${EASE}`,
          }}
        >
          <span
            className="select-text text-white/75"
            style={{
              fontSize: FS.desc,
              lineHeight: FS.descLh,
              fontWeight: DESC_TYPE.weight,
            }}
          >
            {project.desc}
          </span>
        </div>

        <div
          className="absolute"
          style={{
            right: PAD,
            /* кнопка стоит по центру строки по высоте */
            top: "50%",
            transform: "translateY(-50%)",
            display: withButton ? "block" : "none",
            transition: `top 680ms ${EASE}`,
          }}
        >
          <span
            className="flex items-center"
            style={{
              width: cq(BUTTON.w),
              height: cq(BUTTON.h),
              gap: cq(BUTTON.gap),
              paddingLeft: cq(BUTTON.padX),
              borderRadius: cq(BUTTON.radius),
              border: `1px solid ${ACCENT}`,
              backgroundColor: hot ? ACCENT : "rgba(255,255,255,0.04)",
              overflow: "hidden",
              transition: `background-color 420ms ${EASE}`,
            }}
          >
            <span
              style={{
                display: "block",
                transform: `rotate(${hot ? 45 : 0}deg)`,
                transition: `transform 480ms ${EASE}`,
              }}
            >
              <CornerArrow size={cq(BUTTON.icon)} color={hot ? "#fff" : ACCENT} />
            </span>
            <span
              className="uppercase"
              style={{
                color: "#fff",
                fontSize: cq(BUTTON.size),
                letterSpacing: cq(BUTTON.ls),
                lineHeight: 1,
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              Jump to a project
            </span>
          </span>
        </div>

        {/* превью проекта, раскрывается при наведении на строку */}
        <div
          aria-hidden
          className="absolute overflow-hidden"
          style={{
            right: cq(previewRight),
            top: cq(ROW_TOP),
            width: cq(PREVIEW_W),
            height: cq(PREVIEW_H),
            display: withPreview ? "block" : "none",
            borderRadius: cq(6),
            opacity: hot ? 1 : 0,
            transform: `translateY(${hot ? "0px" : cq(24)})`,
            transition: `opacity 520ms ${EASE} ${hot ? "120ms" : "0ms"}, transform 680ms ${EASE}`,
          }}
        >
          <img src={project.src} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Плитка галереи                                                     */
/* ------------------------------------------------------------------ */

type GalleryTileProps = {
  tile: Tile;
  step: number;
  progress: MotionValue<number>;
};

function GalleryTile({ tile, step, progress }: GalleryTileProps) {
  const start = step * STEP_STAGGER;
  const local = useTransform(progress, (v) =>
    easeOutCubic(Math.min(1, Math.max(0, (v - start) / STEP_SPAN))),
  );
  const opacity = useTransform(local, [0, 1], [0, 1]);
  const y = useTransform(local, (v) => (1 - v) * TILE_RISE);

  const media = TILE_MEDIA[tile.n];
  const isCurtain = media?.mode === "curtain";

  const [frame, setFrame] = useState(0);
  const [phase, setPhase] = useState<"idle" | "cover" | "reveal">("idle");

  useEffect(() => {
    if (!media || !media.interval || media.frames.length < 2) return;

    if (!isCurtain) {
      const id = setInterval(
        () => setFrame((f) => (f + 1) % media.frames.length),
        media.interval,
      );
      return () => clearInterval(id);
    }

    // занавес: закрыли створки, подменили кадр, открыли створки
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setPhase("cover");
      swapTimer = setTimeout(() => {
        setFrame((f) => (f + 1) % media.frames.length);
        setPhase("reveal");
        settleTimer = setTimeout(
          () => setPhase("idle"),
          CURTAIN_HOLD_MS + CURTAIN_MS + 40,
        );
      }, CURTAIN_MS);
    }, media.interval);

    return () => {
      clearInterval(id);
      clearTimeout(swapTimer);
      clearTimeout(settleTimer);
    };
  }, [media, isCurtain]);

  return (
    <motion.div
      className="group absolute"
      style={{
        left: tileLeft(tile.c),
        top: tileTop(tile.r),
        width: tileSize(tile.w),
        height: tileSize(tile.h),
        opacity,
        y,
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden border border-white/45 bg-white/[0.07] transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[0.95] group-hover:saturate-100"
        style={{ borderRadius: TILE_RADIUS }}
      >
        {isCurtain && media ? (
          <>
            <img
              src={media.frames[frame]}
              alt=""
              className="absolute inset-0 h-full w-full saturate-[0.3] transition-[filter] duration-500 group-hover:saturate-100"
              style={{
                objectFit: media.fit || "cover",
                objectPosition: "center",
              }}
            />
            {(["l", "r"] as CurtainSide[]).map((side) => (
              <div
                key={`cover-${side}`}
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundColor: INK,
                  clipPath:
                    phase === "idle" ? curtainHidden(side) : curtainClosed(side),
                  transition:
                    phase === "cover"
                      ? `clip-path ${CURTAIN_MS}ms ${CURTAIN_EASE}`
                      : "none",
                }}
              />
            ))}
            {(["l", "r"] as CurtainSide[]).map((side) => (
              <img
                key={`reveal-${side}`}
                src={media.frames[frame]}
                alt=""
                className="absolute inset-0 h-full w-full saturate-[0.3] transition-[filter] duration-500 group-hover:saturate-100"
                style={{
                  objectFit: media.fit || "cover",
                  objectPosition: "center",
                  clipPath:
                    phase === "reveal"
                      ? curtainClosed(side)
                      : curtainHidden(side),
                  transition:
                    phase === "reveal"
                      ? `clip-path ${CURTAIN_MS}ms ${CURTAIN_EASE} ${CURTAIN_HOLD_MS}ms, filter 500ms`
                      : "none",
                }}
              />
            ))}
          </>
        ) : media ? (
          media.frames.map((src, i) => {
            const count = media.frames.length;
            // смещение кадра относительно текущего, по кратчайшей дуге
            let offset = (((i - frame) % count) + count) % count;
            if (offset > count / 2) offset -= count;
            const slide = media.mode === "slide";
            const slideDown = media.mode === "slideDown";
            const sliding = slide || slideDown;
            return (
              <img
                key={src}
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full saturate-[0.3] transition-[filter] duration-500 group-hover:saturate-100"
                style={{
                  objectFit: media.fit || "cover",
                  objectPosition: "center",
                  opacity: sliding || i === frame ? 1 : 0,
                  transform: slide
                    ? `translateX(${offset * 100}%)`
                    : slideDown
                      ? `translateY(${-offset * 100}%)`
                      : undefined,
                  // анимируем только уезжающий и въезжающий кадры
                  transition: sliding
                    ? offset === 0 || offset === -1
                      ? `transform ${SLIDE_MS}ms cubic-bezier(0.65,0,0.35,1), filter 500ms`
                      : "filter 500ms"
                    : `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
                }}
              />
            );
          })
        ) : (
          <span className="text-[clamp(14px,1.15vw,22px)] font-semibold text-white/45 tabular-nums">
            {tile.n}
          </span>
        )}

        {media && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-35 mix-blend-color transition-opacity duration-500 group-hover:opacity-0"
            style={{ backgroundColor: TILE_TINT }}
          />
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Заголовок внутри галереи                                           */
/* ------------------------------------------------------------------ */

type GalleryHeadingProps = {
  heading: Heading;
  show: boolean;
};

function GalleryHeading({ heading, show }: GalleryHeadingProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: heading.left, top: heading.top }}
    >
      {heading.lines.map((line, i) => (
        <motion.span
          key={i}
          className="block font-semibold text-white uppercase"
          style={{
            display: "block",
            overflow: "clip",
            fontSize: PANEL_SIZE,
            lineHeight: PANEL_LH,
            letterSpacing: PANEL_LS,
            // компенсируем «подрезание» выносных элементов при overflow: clip
            paddingBottom: "0.22em",
            marginBottom: "-0.22em",
            whiteSpace: "pre",
          }}
          initial="hidden"
          animate={show ? "show" : "hidden"}
          variants={{
            hidden: {},
            show: { transition: { delayChildren: i * TEXT_LINE_STAGGER } },
          }}
        >
          <motion.span
            style={{ display: "inline-block", whiteSpace: "pre" }}
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: {
                y: "0%",
                opacity: 1,
                transition: { duration: TEXT_DURATION, ease: easeOutText },
              },
            }}
          >
            {line.map((part, j) => (
              <span key={j} style={part.accent ? { color: "#B91372" } : undefined}>
                {part.t}
              </span>
            ))}
          </motion.span>
        </motion.span>
      ))}
    </div>
  );
}
