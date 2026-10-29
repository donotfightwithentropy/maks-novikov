"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, type MotionValue } from "motion/react";
import SplitText, { SPLIT_TEXT_STAGGER } from "./SplitText";

/* ------------------------------------------------------------------ */
/* Система координат                                                   */
/* Вся панель нарисована в макете 1280×1080 (Figma).                   */
/* pctX/pctY — проценты от размера контейнера, cqw — container query    */
/* units (чтобы типографика масштабировалась вместе с панелью).         */
/* ------------------------------------------------------------------ */

const FRAME_W = 1280;
const FRAME_H = 1080;

const pctX = (v: number) => `${(v / FRAME_W) * 100}%`;
const pctY = (v: number) => `${(v / FRAME_H) * 100}%`;
const cqw = (v: number) => `${(v / FRAME_W) * 100}cqw`;

const SKILL_LABEL_FONT_SIZE = `${(15 / FRAME_W) * 100}cqw`;
const CORNER_RADIUS = `${(6 / FRAME_W) * 100}cqw`;
const SKILL_LABEL_OFFSET_DOWN = `${(10 / FRAME_W) * 100}cqw`;
const SKILL_LABEL_OFFSET_UP = `${(-5 / FRAME_W) * 100}cqw`;

/** Сдвиг нижних слоёв панели вверх */
const LOWER_SHIFT_Y = 22;

/** Ромбовидная зона лица — ховер включает подмигивание */
const FACE_ZONE = { cx: 306.25, cy: 318.75, side: 223.4 };

/** Прямоугольники-подсветки под словами-тегами в нижнем блоке */
const TAG_ZONES = [
  { x: 130, y: 823, w: 191, h: 33 },
  { x: 333, y: 823, w: 105, h: 33 },
  { x: 450, y: 823, w: 180, h: 33 },
  { x: 130, y: 868, w: 111, h: 33 },
  { x: 253, y: 868, w: 200, h: 33 },
  { x: 465, y: 868, w: 207, h: 33 },
  { x: 130, y: 913, w: 140, h: 33 },
  { x: 282, y: 913, w: 177, h: 33 },
  { x: 471, y: 913, w: 107, h: 33 },
  { x: 590, y: 913, w: 109, h: 33 },
  { x: 130, y: 958, w: 173, h: 33 },
  { x: 315, y: 958, w: 109, h: 33 },
  { x: 436, y: 958, w: 174, h: 33 },
  { x: 622, y: 958, w: 144, h: 33 },
];

/** Ряд иконок-навыков */
const SKILL_ROW_Y = 383.15;
const SKILL_LABEL_GAP = 45.75;
const SKILL_ZONE_SIZE = 64.7;
const SKILL_LABEL_TOP = SKILL_ROW_Y + SKILL_LABEL_GAP + 13;

const SKILLS = [
  { cx: 589.15, label: "VISUAL" },
  { cx: 765.15, label: "VECTOR" },
  { cx: 941.15, label: "3D" },
  { cx: 1117.15, label: "IDEAS" },
];

/**
 * Две «полоски прогресса». `full` — длина при ховере по зоне,
 * `rest` — в покое. Первая живёт в rise-слое, вторая в fade-слое.
 */
const PROGRESS_BARS = [
  {
    right: 1216,
    y: 554,
    full: 231.5,
    rest: 156,
    zone: { x: 702, y: 526.5, w: 568, h: 57 },
  },
  {
    right: 766,
    y: 798,
    full: 515.5,
    rest: 436,
    zone: { x: 0, y: 771.5, w: 820, h: 57 },
  },
];

/** Геометрия кликабельной карточки-способности */
const CARD_BOX = { x: 822, w: 401, h: 124, r: 6 };

/** Сдвиг rise-слоя по X */
const RISE_SHIFT_X = 9.5;

const CARDS = [
  {
    y: 579,
    label: "Pet the cat",
    base: "/card-base-1.svg",
    text: "/card-text-1.svg",
  },
  {
    y: 723,
    label: "Battle cry",
    base: "/card-base-2.svg",
    text: "/card-text-2.svg",
  },
  {
    y: 867,
    label: "Cup of coffee",
    base: "/card-base-3.svg",
    text: "/card-text-3.svg",
  },
];

/** Подъём текстовой картинки карточки при ховере */
const CARD_TEXT_LIFT = `${(-12 / FRAME_W) * 100}cqw`;
/** Стартовое смещение подписи-подсказки карточки */
const CARD_HINT_OFFSET = `${(7 / FRAME_W) * 100}cqw`;

/** Индексы карточек в массиве CARDS */
const CARD_COFFEE = 2;
const CARD_BATTLE_CRY = 1;
const CARD_PET = 0;

/** Сколько держится эффект после клика по карточке */
const EFFECT_DURATION_MS = 3e3;

/** Два шеврона справа от шкалы энергии */
const CHEVRON_PATHS = [
  "M958.042 283.455C958.325 283.178 958.705 283.023 959.101 283.023L995.838 283.023C997.198 283.023 997.87 284.676 996.897 285.625L980.506 301.607C980.223 301.883 979.844 302.037 979.448 302.037L942.725 302.037C941.365 302.037 940.693 300.386 941.666 299.436L958.042 283.455Z",
  "M1009.04 283.455C1009.33 283.178 1009.71 283.023 1010.1 283.023L1046.84 283.023C1048.2 283.023 1048.87 284.676 1047.9 285.625L1031.51 301.607C1031.22 301.883 1030.84 302.037 1030.45 302.037L993.725 302.037C992.365 302.037 991.693 300.386 992.666 299.436L1009.04 283.455Z",
];

/** Сама шкала энергии */
const ENERGY_BAR_PATH =
  "M518.25 314.313C518.536 314.02 518.928 313.854 519.337 313.854L996.391 313.832C997.732 313.832 998.413 315.444 997.478 316.405L993.297 320.706C993.012 320.999 992.62 321.165 992.21 321.165L515.15 321.193C513.809 321.193 513.128 319.581 514.063 318.62L518.25 314.313Z";

/** Полигон-маска, которая съезжает вправо по мере набора энергии */
const ENERGY_CLIP_POINTS = "0,305 1001.43,305 987.17,330 0,330";

/** Светящийся передний край шкалы */
const ENERGY_EDGE_PATH =
  "M993.32 313.832L996.391 313.832L992.21 321.165L989.14 321.165Z";

/** Базовый сдвиг маски энергии (пустая шкала) */
const ENERGY_BASE_OFFSET = 132.98;
/** Прирост энергии от кофе */
const ENERGY_GAIN_COFFEE = 102.06;
/** Прирост энергии от боевого клича */
const ENERGY_GAIN_CRY = 30.92;

/** Уголки рамки портрета: первые три — большие, последние два — засечки */
const BORDER_STROKES = [
  {
    d: "M190.443 256.92L132.686 314.676C130.65 316.712 130.65 320.013 132.686 322.049L190.443 379.805",
    w: 2.0454,
  },
  {
    d: "M422.435 256.92L480.192 314.676C482.227 316.712 482.227 320.013 480.192 322.049L422.435 379.805",
    w: 2.0454,
  },
  {
    d: "M367.882 434.358L310.126 492.114C308.09 494.15 304.789 494.15 302.753 492.114L244.997 434.358",
    w: 2.0454,
  },
  { d: "M396.948 409.266L433.829 446.147", w: 0.715892 },
  { d: "M215.994 409.258L179.113 446.139", w: 0.715892 },
];

/** Постоянно отрисованные засечки (остальные уголки уже есть в SVG-картинке) */
const STATIC_BORDER_STROKES = BORDER_STROKES.slice(3);

/** Иконки навыков: обычное состояние и «кошачье» */
const ICON_FRAMES = [
  { base: "/icon-1.svg", cat: "/cat-1.svg" },
  { base: "/icon-2.svg", cat: "/cat-2.svg" },
  { base: "/icon-3.svg", cat: "/cat-3.svg" },
  { base: "/icon-4.svg", cat: "/cat-4.svg" },
];

/** Шаг задержки при перелистывании иконок */
const ICON_STAGGER = 0.2;

const BIO_TEXT =
  "‘T-shaped’ designer with 12 years of experience. Visual content for large advertising campaigns, design systems and guidelines, book covers and illustrations. Have a strong artistic background as an individual executor and as a member of a large team. Adapt easily, learn fast, prioritize quickly.";

const BIO_BOX = { x: 130, y: 539.8, w: 636, size: 22.93, lh: 1.52, indent: 33 };

/** Подсказки, появляющиеся при ховере карточек */
const CARD_HINTS = [
  "Removes all negative effects",
  "Boosts concentration",
  "Extends work sprint",
];

const CARD_HINT_POS = { left: 135.9, top: 87.75, size: 15 };

/** Перекрестие-прицел справа от шкалы */
const CROSSHAIR = { cx: 1196, cy: 292.5, arm: 11, half: 2.3, r: 1.1 };
/** Скос перекрестия (matrix skewX) */
const CROSSHAIR_SKEW = -0.3;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Основной easing CSS-переходов энергии/шевронов */
const EASE_IN_OUT_CUBIC = "cubic-bezier(0.76,0,0.24,1)";

type Props = {
  delay?: number;
  fade: MotionValue<number>;
  /** снаружи приходит как строка с единицами (например "-170vh") */
  rise: MotionValue<number> | MotionValue<string>;
};

export default function CharacterPanel({ delay = 0.1, fade, rise }: Props) {
  const [faceHover, setFaceHover] = useState(false);
  const [petWink, setPetWink] = useState(false);
  /** Недавно использовали способность — подмигивание от ховера подавлено */
  const [recentUse, setRecentUse] = useState(false);
  const recentUseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [coffeeOn, setCoffeeOn] = useState(false);
  const [helmetOn, setHelmetOn] = useState(false);
  const [chevronsOn, setChevronsOn] = useState(false);
  const [crosshairOn, setCrosshairOn] = useState(false);
  const [energyOffset, setEnergyOffset] = useState(0);
  const [energyPulse, setEnergyPulse] = useState(0);
  const [borderPulse, setBorderPulse] = useState(0);
  const [catsOn, setCatsOn] = useState(false);
  const [cardsUsed, setCardsUsed] = useState([false, false, false]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const coffeeUsedRef = useRef(false);
  const battleCryUsedRef = useRef(false);
  const petUsedRef = useRef(false);

  // Прогреваем декодирование кадров-оверлеев, чтобы они не мигали при показе
  useEffect(() => {
    document.querySelectorAll("[data-frame]").forEach((el) => {
      (el as HTMLImageElement).decode?.().catch(() => {});
    });
  }, []);

  const isMouse = (e: React.PointerEvent) => e.pointerType === "mouse";

  const markRecentUse = () => {
    setRecentUse(true);
    if (recentUseTimer.current) clearTimeout(recentUseTimer.current);
    recentUseTimer.current = setTimeout(
      () => setRecentUse(false),
      EFFECT_DURATION_MS,
    );
  };

  useEffect(
    () => () => {
      if (recentUseTimer.current) clearTimeout(recentUseTimer.current);
    },
    [],
  );

  /** «Cup of coffee» — кофе, шевроны, прицел, +102.06 энергии */
  const useCoffee = () => {
    if (coffeeUsedRef.current) return;
    coffeeUsedRef.current = true;
    setCursorPos(null);
    markRecentUse();
    setCardsUsed((prev) => prev.map((v, i) => (i === CARD_COFFEE ? true : v)));
    setCoffeeOn(true);
    setChevronsOn(true);
    setCrosshairOn(true);
    setEnergyOffset((v) => v + ENERGY_GAIN_COFFEE);
    setEnergyPulse((v) => v + 1);
    setTimeout(() => setCrosshairOn(false), 1500);
    setTimeout(() => setCoffeeOn(false), EFFECT_DURATION_MS);
  };

  /** «Pet the cat» — подмигивание и кошачьи иконки */
  const usePetTheCat = () => {
    if (petUsedRef.current) return;
    petUsedRef.current = true;
    setCursorPos(null);
    markRecentUse();
    setCardsUsed((prev) => prev.map((v, i) => (i === CARD_PET ? true : v)));
    setPetWink(true);
    setCatsOn(true);
    setBorderPulse((v) => v + 1);
    setTimeout(() => {
      setPetWink(false);
      setCatsOn(false);
    }, EFFECT_DURATION_MS);
  };

  /** «Battle cry» — шлем, +30.92 энергии и вспышка рамки */
  const useBattleCry = () => {
    if (battleCryUsedRef.current) return;
    battleCryUsedRef.current = true;
    setCursorPos(null);
    markRecentUse();
    setCardsUsed((prev) =>
      prev.map((v, i) => (i === CARD_BATTLE_CRY ? true : v)),
    );
    setHelmetOn(true);
    setEnergyOffset((v) => v + ENERGY_GAIN_CRY);
    setEnergyPulse((v) => v + 1);
    setBorderPulse((v) => v + 1);
    setTimeout(() => setHelmetOn(false), EFFECT_DURATION_MS);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ delay, duration: 0.9, ease: EASE_OUT }}
      className="@container relative block w-full lg:absolute lg:inset-y-0 lg:left-0 lg:w-[66.667%] lg:translate-x-[max(20px,calc(120px-6.72vw))]"
    >
      <img
        src="/panel-top.svg"
        alt="Maks Novikov — character panel"
        className="block h-full w-full object-contain"
      />

      <motion.img
        src="/panel-helmet.svg"
        data-frame="helmet"
        style={{ willChange: "opacity" }}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
        animate={{ opacity: helmetOn ? 1 : 0 }}
        transition={{ duration: helmetOn ? 0.22 : 0.45, ease: "easeOut" }}
      />

      <motion.img
        src="/panel-coffee.svg"
        data-frame="coffee"
        style={{ willChange: "opacity" }}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
        animate={{ opacity: coffeeOn ? 1 : 0 }}
        transition={{ duration: coffeeOn ? 0.22 : 0.45, ease: "easeOut" }}
      />

      <svg
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      >
        <style>{`
          @keyframes energy-glow { 0% { opacity: 0 } 40% { opacity: .6 } 100% { opacity: 0 } }
          @keyframes energy-edge { 0% { opacity: 0 } 10% { opacity: 1 } 70% { opacity: 1 } 100% { opacity: 0 } }
          @keyframes border-glow { 0% { opacity: 0 } 12% { opacity: 1 } 30% { opacity: .9 } 100% { opacity: 0 } }
          @keyframes border-flash { 0% { opacity: 0 } 18% { opacity: .95 } 100% { opacity: 0 } }
          .energy-glow { animation: energy-glow 1.6s cubic-bezier(0.4,0,0.2,1) 380ms both; }
          .energy-edge { animation: energy-edge 1.05s ease-out 380ms both; }
          .cursor-use {
            display: flex; align-items: center; justify-content: center;
            width: 74px; height: 74px; border-radius: 50%;
            background: #B91372; color: #fff;
            font-weight: 600; font-size: 14px; letter-spacing: 0.14em;
            animation: cursor-pop 220ms cubic-bezier(0.16,1,0.3,1) both;
          }
          @keyframes cursor-pop { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          .border-glow { animation: border-glow 1.25s ease-out 120ms both; }
          .border-flash { animation: border-flash 0.55s ease-out 540ms both; }
        `}</style>

        <defs>
          <filter
            id="charge-glow"
            x="-80%"
            y="-300%"
            width="260%"
            height="700%"
          >
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
            </feMerge>
          </filter>
        </defs>

        {STATIC_BORDER_STROKES.map((stroke) => (
          <path
            key={stroke.d}
            d={stroke.d}
            stroke="white"
            strokeWidth={stroke.w}
            fill="none"
          />
        ))}

        {/* Вспышка рамки при каждом использовании способности */}
        {borderPulse > 0 &&
          BORDER_STROKES.map((stroke) => (
            <Fragment key={`${stroke.d}-${borderPulse}`}>
              <path
                className="border-glow"
                d={stroke.d}
                stroke="#9FE9FF"
                strokeWidth={stroke.w + 0.8}
                fill="none"
                filter="url(#charge-glow)"
              />
              <path
                className="border-flash"
                d={stroke.d}
                stroke="#FFFFFF"
                strokeWidth={stroke.w}
                fill="none"
              />
            </Fragment>
          ))}
      </svg>

      <motion.img
        src="/panel-wink.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
        animate={{ opacity: (faceHover && !recentUse) || petWink ? 1 : 0 }}
        transition={{ duration: 0.12, ease: "linear" }}
      />

      {/* Ромб-хитбокс лица */}
      <div
        className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rotate-45 max-lg:hidden"
        style={{
          left: pctX(FACE_ZONE.cx),
          top: pctY(FACE_ZONE.cy),
          width: pctX(FACE_ZONE.side),
        }}
        onPointerEnter={(e) => isMouse(e) && setFaceHover(true)}
        onPointerLeave={(e) => isMouse(e) && setFaceHover(false)}
      />

      {/* Нижний блок: био-текст, вторая полоска, подсветки тегов */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ transform: `translateY(${cqw(-LOWER_SHIFT_Y)})` }}
      >
        <img
          src="/panel-lower.svg"
          alt=""
          aria-hidden
          className="block h-full w-full object-contain"
        />

        <p
          className="pointer-events-auto absolute m-0 text-justify font-light text-white select-text"
          style={{
            left: cqw(BIO_BOX.x),
            top: cqw(BIO_BOX.y),
            width: cqw(BIO_BOX.w),
            fontSize: cqw(BIO_BOX.size),
            lineHeight: BIO_BOX.lh,
            textIndent: cqw(BIO_BOX.indent),
          }}
        >
          {BIO_TEXT}
        </p>

        {PROGRESS_BARS.slice(1).map((bar) => (
          <Fragment key={bar.y}>
            <div
              className="pointer-events-auto absolute max-lg:hidden"
              style={{
                left: pctX(bar.zone.x),
                top: pctY(bar.zone.y),
                width: pctX(bar.zone.w),
                height: pctY(bar.zone.h),
              }}
              onPointerEnter={(e) => isMouse(e) && setHoveredBar(1)}
              onPointerLeave={(e) =>
                isMouse(e) && setHoveredBar((prev) => (prev === 1 ? null : prev))
              }
            />
            <div
              className="pointer-events-none absolute bg-white/70"
              style={{
                right: pctX(FRAME_W - bar.right),
                top: pctY(bar.y),
                height: pctY(0.8),
                width: pctX(hoveredBar === 1 ? bar.full : bar.rest),
                transition: "width 450ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </Fragment>
        ))}

        {TAG_ZONES.map((zone) => (
          <div
            key={`${zone.x}-${zone.y}`}
            className="pointer-events-auto absolute bg-white/0 transition-colors duration-200 hover:bg-white/[0.115] max-lg:hidden"
            style={{
              left: pctX(zone.x),
              top: pctY(zone.y),
              width: pctX(zone.w),
              height: pctY(zone.h),
              borderRadius: CORNER_RADIUS,
            }}
          />
        ))}
      </div>

      {/* Слой «fade»: имя, иконки навыков, шкала энергии */}
      <motion.div
        data-layer="fade"
        style={{ opacity: fade }}
        className="pointer-events-none absolute inset-0 max-lg:!opacity-100"
      >
        <img
          src="/panel-fade.svg"
          alt=""
          aria-hidden
          className="block h-full w-full object-contain"
        />

        <SplitText
          text="MAKS NOVIKOV"
          className="pointer-events-auto absolute font-semibold text-white select-text"
          style={{
            left: cqw(544.39),
            top: cqw(178.08),
            fontSize: cqw(52),
            lineHeight: 1,
            letterSpacing: cqw(2.57),
          }}
        />

        <SplitText
          text="designer"
          delay={SPLIT_TEXT_STAGGER}
          className="pointer-events-auto absolute font-light text-white select-text"
          style={{
            left: cqw(544.13),
            top: cqw(236.43),
            fontSize: cqw(22.76),
            lineHeight: 1,
            letterSpacing: cqw(0.07),
          }}
        />

        {/* Перелистывание иконок навыков на «кошачьи» */}
        {ICON_FRAMES.map((frame, i) => (
          <Fragment key={frame.base}>
            <motion.img
              src={frame.base}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
              animate={{ opacity: catsOn ? 0 : 1 }}
              transition={{
                delay: i * ICON_STAGGER,
                duration: 0.25,
                ease: "easeOut",
              }}
            />
            <motion.img
              src={frame.cat}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
              animate={{ opacity: catsOn ? 1 : 0 }}
              transition={{
                delay: i * ICON_STAGGER,
                duration: 0.25,
                ease: "easeOut",
              }}
            />
          </Fragment>
        ))}

        <svg
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 block h-full w-full"
        >
          <defs>
            <filter
              id="charge-glow"
              x="-80%"
              y="-300%"
              width="260%"
              height="700%"
            >
              <feGaussianBlur stdDeviation="4.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
              </feMerge>
            </filter>
            <clipPath id="energy-clip" clipPathUnits="userSpaceOnUse">
              {/* Маска едет вправо на набранную энергию */}
              <polygon
                points={ENERGY_CLIP_POINTS}
                style={{
                  transform: `translateX(${energyOffset - ENERGY_BASE_OFFSET}px)`,
                  transition: `transform 760ms ${EASE_IN_OUT_CUBIC} 380ms`,
                }}
              />
            </clipPath>
          </defs>

          {CHEVRON_PATHS.map((d, i) => {
            const delayMs = 180 + i * 170;
            return (
              <g
                key={d.slice(1, 12)}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "left center",
                  transform: chevronsOn
                    ? "none"
                    : "translateX(-26px) scaleX(2.4)",
                  transition: `transform 620ms ${EASE_IN_OUT_CUBIC} ${delayMs}ms`,
                }}
              >
                <motion.path
                  d={d}
                  fill="#9FE9FF"
                  filter="url(#charge-glow)"
                  initial={false}
                  animate={
                    chevronsOn ? { opacity: [0, 1, 0.9, 0] } : { opacity: 0 }
                  }
                  transition={
                    chevronsOn
                      ? {
                          delay: delayMs / 1e3,
                          duration: 1.25,
                          times: [0, 0.14, 0.32, 1],
                          ease: "easeOut",
                        }
                      : { duration: 0.2 }
                  }
                />
                <motion.path
                  d={d}
                  fill="#DEDEDE"
                  initial={false}
                  animate={{ opacity: chevronsOn ? 1 : 0 }}
                  transition={{
                    delay: chevronsOn ? delayMs / 1e3 : 0,
                    duration: 0.22,
                  }}
                />
                <motion.path
                  d={d}
                  fill="#FFFFFF"
                  initial={false}
                  animate={
                    chevronsOn ? { opacity: [0, 0.95, 0] } : { opacity: 0 }
                  }
                  transition={
                    chevronsOn
                      ? {
                          delay: delayMs / 1e3 + 0.42,
                          duration: 0.55,
                          times: [0, 0.18, 1],
                          ease: "easeOut",
                        }
                      : { duration: 0.2 }
                  }
                />
              </g>
            );
          })}

          <path
            d={ENERGY_BAR_PATH}
            fill="white"
            fillOpacity={0.35}
            clipPath="url(#energy-clip)"
          />

          {energyPulse > 0 && (
            <path
              key={`glow-${energyPulse}`}
              className="energy-glow"
              d={ENERGY_BAR_PATH}
              fill="#9FE9FF"
              filter="url(#charge-glow)"
              clipPath="url(#energy-clip)"
            />
          )}

          <g
            style={{
              transform: `translateX(${energyOffset - ENERGY_BASE_OFFSET}px)`,
              transition: `transform 760ms ${EASE_IN_OUT_CUBIC} 380ms`,
            }}
          >
            {energyPulse > 0 && (
              <path
                key={`edge-${energyPulse}`}
                className="energy-edge"
                d={ENERGY_EDGE_PATH}
                fill="#E6FBFF"
                filter="url(#charge-glow)"
              />
            )}
          </g>

          {/* Перекрестие-прицел: два скрещенных прямоугольника со скосом */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: crosshairOn
                ? "none"
                : "translateX(-18px) scale(0.5)",
              transition: `transform 620ms ${EASE_IN_OUT_CUBIC} 200ms`,
            }}
          >
            <g
              transform={`matrix(1,0,${CROSSHAIR_SKEW},1,${-CROSSHAIR_SKEW * CROSSHAIR.cy},0)`}
            >
              {[
                {
                  x: CROSSHAIR.cx - CROSSHAIR.arm,
                  y: CROSSHAIR.cy - CROSSHAIR.half,
                  width: CROSSHAIR.arm * 2,
                  height: CROSSHAIR.half * 2,
                },
                {
                  x: CROSSHAIR.cx - CROSSHAIR.half,
                  y: CROSSHAIR.cy - CROSSHAIR.arm,
                  width: CROSSHAIR.half * 2,
                  height: CROSSHAIR.arm * 2,
                },
              ].map((rect, i) => (
                <Fragment key={i}>
                  <motion.rect
                    {...rect}
                    rx={CROSSHAIR.r}
                    fill="#9FE9FF"
                    filter="url(#charge-glow)"
                    initial={false}
                    animate={
                      crosshairOn ? { opacity: [0, 1, 0.9, 0] } : { opacity: 0 }
                    }
                    transition={
                      crosshairOn
                        ? {
                            delay: 0.2,
                            duration: 1.25,
                            times: [0, 0.14, 0.32, 1],
                            ease: "easeOut",
                          }
                        : { duration: 0.3 }
                    }
                  />
                  <motion.rect
                    {...rect}
                    rx={CROSSHAIR.r}
                    fill="#DEDEDE"
                    initial={false}
                    animate={{ opacity: crosshairOn ? 1 : 0 }}
                    transition={{
                      delay: crosshairOn ? 0.2 : 0,
                      duration: crosshairOn ? 0.22 : 0.4,
                    }}
                  />
                  <motion.rect
                    {...rect}
                    rx={CROSSHAIR.r}
                    fill="#FFFFFF"
                    initial={false}
                    animate={
                      crosshairOn ? { opacity: [0, 0.95, 0] } : { opacity: 0 }
                    }
                    transition={
                      crosshairOn
                        ? {
                            delay: 0.62,
                            duration: 0.55,
                            times: [0, 0.18, 1],
                            ease: "easeOut",
                          }
                        : { duration: 0.3 }
                    }
                  />
                </Fragment>
              ))}
            </g>
          </g>
        </svg>

        {/* Хитбоксы навыков и выезжающие подписи под ними */}
        {SKILLS.map((skill, i) => (
          <Fragment key={skill.label}>
            <div
              className="pointer-events-auto absolute aspect-square -translate-x-1/2 -translate-y-1/2 rotate-45 transition-colors duration-200 max-lg:hidden"
              style={{
                left: pctX(skill.cx),
                top: pctY(SKILL_ROW_Y),
                width: pctX(SKILL_ZONE_SIZE),
                borderRadius: CORNER_RADIUS,
                backgroundColor:
                  hoveredSkill === i
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0)",
              }}
              onPointerEnter={(e) => isMouse(e) && setHoveredSkill(i)}
              onPointerLeave={(e) =>
                isMouse(e) &&
                setHoveredSkill((prev) => (prev === i ? null : prev))
              }
            />
            <div
              className="pointer-events-none absolute flex items-start justify-center overflow-visible max-lg:hidden"
              style={{
                left: pctX(skill.cx - 130),
                top: pctY(SKILL_LABEL_TOP),
                width: pctX(260),
                height: pctY(70),
              }}
            >
              <span
                className="block leading-[1.35] whitespace-nowrap text-white/55"
                style={{
                  fontSize: SKILL_LABEL_FONT_SIZE,
                  fontWeight: 200,
                  letterSpacing: "0.08em",
                  opacity: hoveredSkill === i ? 1 : 0,
                  transform:
                    hoveredSkill === i
                      ? `translateY(${SKILL_LABEL_OFFSET_UP})`
                      : `translateY(${SKILL_LABEL_OFFSET_DOWN})`,
                  transition:
                    hoveredSkill === i
                      ? "opacity 200ms ease-out, transform 380ms cubic-bezier(0.16,1,0.3,1) 220ms"
                      : "opacity 200ms ease-out, transform 200ms ease-out",
                }}
              >
                {skill.label}
              </span>
            </div>
          </Fragment>
        ))}
      </motion.div>

      {/* Слой «rise»: карточки способностей, подъезжающий на скролле */}
      <motion.div
        data-layer="rise"
        style={{ y: rise }}
        className="pointer-events-none absolute inset-0 max-lg:!transform-none"
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${cqw(-RISE_SHIFT_X)}, ${cqw(-LOWER_SHIFT_Y)})`,
          }}
        >
          <img
            src="/panel-rise.svg"
            alt=""
            aria-hidden
            className="pointer-events-none block h-full w-full object-contain"
          />

          {PROGRESS_BARS.slice(0, 1).map((bar) => (
            <Fragment key={bar.y}>
              <div
                className="pointer-events-auto absolute max-lg:hidden"
                style={{
                  left: pctX(bar.zone.x),
                  top: pctY(bar.zone.y),
                  width: pctX(bar.zone.w),
                  height: pctY(bar.zone.h),
                }}
                onPointerEnter={(e) => isMouse(e) && setHoveredBar(0)}
                onPointerLeave={(e) =>
                  isMouse(e) &&
                  setHoveredBar((prev) => (prev === 0 ? null : prev))
                }
              />
              <div
                className="pointer-events-none absolute bg-white/70"
                style={{
                  right: pctX(FRAME_W - bar.right),
                  top: pctY(bar.y),
                  height: pctY(0.8),
                  width: pctX(hoveredBar === 0 ? bar.full : bar.rest),
                  transition: "width 450ms cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </Fragment>
          ))}

          {CARDS.map((card, i) => {
            const active = hoveredCard === i;
            const CARD_TRANSITION = "560ms cubic-bezier(0.22,1,0.36,1)";
            return (
              <button
                key={card.label}
                type="button"
                aria-label={card.label}
                className="pointer-events-auto absolute overflow-hidden max-lg:hidden"
                style={{
                  left: pctX(CARD_BOX.x),
                  top: pctY(card.y),
                  width: pctX(CARD_BOX.w),
                  height: pctY(CARD_BOX.h),
                  borderRadius: `${(CARD_BOX.r / FRAME_W) * 100}cqw`,
                  backdropFilter: active
                    ? "blur(9px) saturate(1.18) brightness(1.04)"
                    : "blur(0px)",
                  WebkitBackdropFilter: active
                    ? "blur(9px) saturate(1.18) brightness(1.04)"
                    : "blur(0px)",
                  transition: `backdrop-filter ${CARD_TRANSITION}`,
                  // пока способность не использована — вместо курсора кастомный «USE»
                  cursor: cardsUsed[i] ? "default" : "none",
                }}
                onClick={
                  i === CARD_COFFEE
                    ? useCoffee
                    : i === CARD_BATTLE_CRY
                      ? useBattleCry
                      : i === CARD_PET
                        ? usePetTheCat
                        : undefined
                }
                onPointerEnter={(e) => isMouse(e) && setHoveredCard(i)}
                onPointerMove={(e) => {
                  if (isMouse(e) && !cardsUsed[i])
                    setCursorPos({ x: e.clientX, y: e.clientY });
                }}
                onPointerLeave={(e) => {
                  if (isMouse(e)) {
                    setHoveredCard((prev) => (prev === i ? null : prev));
                    setCursorPos(null);
                  }
                }}
              >
                <img
                  src={card.base}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    borderRadius: "inherit",
                    background: "rgba(255,255,255,0.05)",
                    boxShadow:
                      "inset 0 0 0 1px rgba(255,255,255,0.3), inset 0 0 18px rgba(255,255,255,0.07)",
                    opacity: active ? 1 : 0,
                    transition: `opacity ${CARD_TRANSITION}`,
                  }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(115deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0) 62%)",
                    opacity: active ? 1 : 0,
                    transition: `opacity ${CARD_TRANSITION}`,
                  }}
                />
                <img
                  src={card.text}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full"
                  style={{
                    transform: active
                      ? `translateY(${CARD_TEXT_LIFT})`
                      : "translateY(0)",
                    transition: `transform ${CARD_TRANSITION}`,
                  }}
                />
                <span
                  className="absolute block whitespace-nowrap text-left font-light text-white/60"
                  style={{
                    left: cqw(CARD_HINT_POS.left),
                    top: cqw(CARD_HINT_POS.top),
                    fontSize: cqw(CARD_HINT_POS.size),
                    lineHeight: 1,
                    opacity: active ? 1 : 0,
                    transform: active
                      ? "translateY(0)"
                      : `translateY(${CARD_HINT_OFFSET})`,
                    transition: active
                      ? `opacity 340ms ease-out 150ms, transform ${CARD_TRANSITION} 120ms`
                      : "opacity 200ms ease-out, transform 260ms ease-out",
                  }}
                >
                  {CARD_HINTS[i]}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Кастомный курсор «USE» поверх всего документа */}
      {cursorPos &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: cursorPos.x,
              top: cursorPos.y,
              zIndex: 60,
              pointerEvents: "none",
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="cursor-use">USE</span>
          </div>,
          document.body,
        )}
    </motion.div>
  );
}
