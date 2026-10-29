"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useInView } from "motion/react";
import {
  SKILL_ICON,
  SKILL_LABEL,
  SKILL_TOKEN,
  SKILL_TOKENS,
} from "./SkillTokens";

const ACCENT = "#B91372";
/** подсветка по наведению — та же, что у строк таблицы Projects */
const HOVER_FILL = "rgba(255,255,255,0.02)";
/** заливка токена tech stack по наведению */
const TOKEN_FILL = "rgba(255,255,255,0.18)";
const EASE = [0.22, 1, 0.36, 1] as const;

/* ── строка, выезжающая из-под маски: та же механика, что у SplitText,
      но блочная — поэтому держит выключку по формату ── */
const EASE_SPLIT = (t: number) => 1 - Math.pow(1 - t, 2.3);

function RevealLine({
  delay = 0,
  once = true,
  style,
  children,
}: {
  delay?: number;
  /** false — проигрывать заново каждый раз, когда строка снова попадает в кадр */
  once?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  /* наблюдаем за самой маской: сдвинутая вниз строка целиком выходит
     за её clip-прямоугольник, и IntersectionObserver её просто не видит */
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, amount: 0.6 });
  return (
    <span
      ref={ref}
      style={{
        display: "block",
        overflow: "clip",
        paddingBottom: "0.3em",
        marginBottom: "-0.3em",
      }}
    >
      <motion.span
        style={{ display: "block", ...style }}
        initial={{ y: "110%", opacity: 0 }}
        animate={inView ? { y: "0%", opacity: 1 } : { y: "110%", opacity: 0 }}
        transition={{ duration: 1, ease: EASE_SPLIT, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ── эффект decrypted text: буквы расшифровываются слева направо ── */
const DECRYPT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>-_\\/[]{}=+*^?#";
const DECRYPT_STEP_MS = 45;

function useDecrypt(text: string, active: boolean) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    const rand = () =>
      DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
    /* шаг считаем по времени, а не по тикам: при просадке кадров
       расшифровка всё равно укладывается в ту же длительность */
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const i = Math.floor((performance.now() - start) / DECRYPT_STEP_MS);
      if (i > text.length) {
        setOut(text);
        return;
      }
      setOut(
        text
          .split("")
          .map((ch, k) => (ch === " " || ch === "\n" || k < i ? ch : rand()))
          .join(""),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active]);
  return out;
}

/* ── способности: на время подменяем аватар (подмигивание, шлем, кофе),
      у pet the cat ещё и котик, у battle cry — циановая вспышка рамки,
      у cup of coffee — вспышка life bar, плюсик, два новых сегмента HP
      и прирост энергии. Колонки живут в разных компонентах, поэтому
      состояние держим в маленьком общем сторе. Каждая кнопка
      срабатывает один раз за посещение страницы ── */
const ABILITY_MS = [3000, 4000, 3400];
/** циан вспышки — тот же, что у подсветки энергии в макете */
const CYAN = "#3FE0FF";
/** насколько полоска энергии прирастает вправо */
const ENERGY_GAIN = 54;

type AbilityState = { active: number | null; used: boolean[]; energy: boolean };
let abilityState: AbilityState = {
  active: null,
  used: [false, false, false],
  energy: false,
};
const abilityListeners = new Set<(s: AbilityState) => void>();
let abilityTimer = 0;

function pushAbility(next: Partial<AbilityState>) {
  abilityState = { ...abilityState, ...next };
  abilityListeners.forEach((f) => f(abilityState));
}

export function triggerAbility(i: number) {
  if (abilityState.used[i]) return;
  const used = abilityState.used.slice();
  used[i] = true;
  pushAbility({ active: i, used, energy: abilityState.energy || i === 2 });
  window.clearTimeout(abilityTimer);
  abilityTimer = window.setTimeout(
    () => pushAbility({ active: null }),
    ABILITY_MS[i],
  );
}

function useAbilityState() {
  const [s, setS] = useState(abilityState);
  useEffect(() => {
    abilityListeners.add(setS);
    return () => {
      abilityListeners.delete(setS);
    };
  }, []);
  return s;
}

/** Курсор-кружок «USE» поверх всего документа */
function UseCursor({ at }: { at: { x: number; y: number } | null }) {
  if (!at) return null;
  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: at.x,
        top: at.y,
        zIndex: 120,
        pointerEvents: "none",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 74,
        height: 74,
        borderRadius: "50%",
        background: ACCENT,
        color: "#fff",
        fontWeight: 600,
        fontSize: 14,
        letterSpacing: "0.14em",
      }}
    >
      USE
    </div>,
    document.body,
  );
}

/* Текстовый слой экрана Maks Novikov.
   Графика лежит отдельными SVG без текста (char-art / abilities-art),
   а все надписи — настоящий текст в DOM: его видно поиску и можно выделить
   и скопировать. Координаты взяты из макета 1542:1120, где Figma отдаёт
   видимые границы набора, поэтому верх считаем от капители. */

/** Метрики Montserrat: от верха строки до капители */
const capTop = (y: number, size: number, lh: number) =>
  y - ((lh - 1.219 * size) / 2 + 0.268 * size);

type Item = {
  /** левый край набора в координатах кадра */
  x: number;
  /** верх капители первой строки */
  y: number;
  w: number;
  size: number;
  lh: number;
  /** трекинг в пикселях */
  ls?: number;
  weight: number;
  /** прозрачность белого */
  alpha?: number;
  align?: "left" | "right" | "justify";
  /** в макете набрано капителью */
  upper?: boolean;
  /** y из макета — верх строки, а не капитель (узлы внутри автолэйаута) */
  raw?: boolean;
  /** абзацный отступ первой строки */
  indent?: number;
  text: string;
};

const base = (i: Item): React.CSSProperties => ({
  position: "absolute",
  left: i.x,
  top: i.raw ? i.y : capTop(i.y, i.size, i.lh),
  width: i.w,
  fontSize: i.size,
  lineHeight: `${i.lh}px`,
  letterSpacing: i.ls ?? 0,
  fontWeight: i.weight,
  color: i.alpha ? `rgba(255,255,255,${i.alpha})` : "#fff",
  textAlign: i.align ?? "left",
  textIndent: i.indent ?? 0,
  whiteSpace: i.align === "justify" ? "normal" : "pre-wrap",
  textTransform: i.upper ? "uppercase" : "none",
  margin: 0,
});

function Line({ item }: { item: Item }) {
  return <p style={base(item)}>{item.text}</p>;
}

/* ───────────────────────────── колонка персонажа ───────────────────────── */

const QUOTE =
  "‘T-shaped’ designer with 12 years of experience. Visual content for large advertising campaigns, design systems and guidelines, book covers and illustrations. Have a strong artistic background as an individual executor and as a member of a large team. Adapt easily, learn fast, prioritize quickly.";

/** строки абзаца: разбивка совпадает с макетом при ширине 629 и отступе 32 */
const QUOTE_LINES = [
  "\u2018T-shaped\u2019 designer with 12 years of experience.",
  "Visual content for large advertising campaigns, design",
  "systems and guidelines, book covers and illustrations.",
  "Have a strong artistic background as an individual",
  "executor and as a member of a large team. Adapt",
  "easily, learn fast, prioritize quickly.",
];

/** пилюли tech stack в координатах кадра персонажа */
const TOKEN_PILLS: [number, number, number][] = [
  [40, 817, 191], [243, 817, 105], [360, 817, 180],
  [40, 862, 111], [163, 862, 200], [375, 862, 207],
  [40, 907, 140], [192, 907, 177], [381, 907, 173],
  [40, 952, 109], [161, 952, 174], [347, 952, 144], [503, 952, 109],
];
const PILL_H = 33;
const PILL_R = 6;
/** линейка заголовка tech stack: сдвигается влево по наведению на фрейм */
const TECH_RULE = { y: 792, from: 240, w: 429 };

/** кадры аватара под каждую способность, координаты кадра персонажа */
const AVATARS = [
  { src: "avatar-wink.webp", top: 66, h: 392.72 },
  { src: "avatar-cry.webp", top: 84, h: 374.72 },
  { src: "avatar-coffee.webp", top: 84, h: 374.72 },
];

/** зона аватара, по наведению на которую персонаж подмигивает */
const AVATAR_HIT = { x: 59, y: 84, w: 316, h: 374 };
/** белая стрелка под подписью designer (в char-art.svg её нет) */
const ARROW_PATH =
  "M636 478H639V451.233L665.721 477.954L667.842 475.833L641.01 449H668V446H636V478Z";

/** рамка вокруг аватара — те же контуры, что в макете */
const BORDER_PATHS = [
  "M101.443 238.922L43.6864 296.678C41.6504 298.714 41.6504 302.015 43.6864 304.051L101.443 361.807",
  "M333.435 238.922L391.192 296.678C393.227 298.714 393.227 302.015 391.192 304.051L333.435 361.807",
  "M278.882 416.362L221.126 474.118C219.09 476.154 215.789 476.154 213.753 474.118L155.997 416.362",
  "M307.948 391.266L344.829 428.147",
  "M126.994 391.258L90.1125 428.139",
];

/** сегменты life bar: первые шесть горят, последние четыре приглушены */
const HP_SEGMENTS: string[] = [
  "M329.942 149.917C329.659 149.641 329.279 149.486 328.883 149.486L304.727 149.484C303.367 149.484 302.695 151.136 303.669 152.086L320.059 168.067C320.342 168.343 320.721 168.497 321.117 168.497L345.259 168.499C346.619 168.5 347.291 166.848 346.318 165.898L329.942 149.917Z",
  "M363.942 149.917C363.659 149.641 363.279 149.486 362.883 149.486L338.727 149.484C337.367 149.484 336.695 151.136 337.669 152.086L354.059 168.067C354.342 168.343 354.721 168.497 355.117 168.497L379.259 168.499C380.619 168.5 381.291 166.848 380.318 165.898L363.942 149.917Z",
  "M397.942 149.917C397.659 149.641 397.279 149.486 396.883 149.486L372.727 149.484C371.367 149.484 370.695 151.136 371.669 152.086L388.059 168.067C388.342 168.343 388.721 168.497 389.117 168.497L413.259 168.499C414.619 168.5 415.291 166.848 414.318 165.898L397.942 149.917Z",
  "M431.942 149.917C431.659 149.641 431.279 149.486 430.883 149.486L406.727 149.484C405.367 149.484 404.695 151.136 405.669 152.086L422.059 168.067C422.342 168.343 422.721 168.497 423.117 168.497L447.259 168.499C448.619 168.5 449.291 166.848 448.318 165.898L431.942 149.917Z",
  "M466.942 149.917C466.659 149.641 466.279 149.486 465.883 149.486L441.727 149.484C440.367 149.484 439.695 151.136 440.669 152.086L457.059 168.067C457.342 168.343 457.721 168.497 458.117 168.497L482.259 168.499C483.619 168.5 484.291 166.848 483.318 165.898L466.942 149.917Z",
  "M499.942 149.917C499.659 149.641 499.279 149.486 498.883 149.486L474.727 149.484C473.367 149.484 472.695 151.136 473.669 152.086L490.059 168.067C490.342 168.343 490.721 168.497 491.117 168.497L515.259 168.499C516.619 168.5 517.291 166.848 516.318 165.898L499.942 149.917Z",
  "M533.942 149.917C533.659 149.641 533.279 149.486 532.883 149.486L508.727 149.484C507.367 149.484 506.695 151.136 507.669 152.086L524.059 168.067C524.342 168.343 524.721 168.497 525.117 168.497L549.259 168.499C550.619 168.5 551.291 166.848 550.318 165.898L533.942 149.917Z",
  "M567.942 149.917C567.659 149.641 567.279 149.486 566.883 149.486L542.727 149.484C541.367 149.484 540.695 151.136 541.669 152.086L558.059 168.067C558.342 168.343 558.721 168.497 559.117 168.497L583.259 168.499C584.619 168.5 585.291 166.848 584.318 165.898L567.942 149.917Z",
  "M601.942 149.917C601.659 149.641 601.279 149.486 600.883 149.486L576.727 149.484C575.367 149.484 574.695 151.136 575.669 152.086L592.059 168.067C592.342 168.343 592.721 168.497 593.117 168.497L617.259 168.499C618.619 168.5 619.291 166.848 618.318 165.898L601.942 149.917Z",
  "M635.942 149.917C635.659 149.641 635.279 149.486 634.883 149.486L610.727 149.484C609.367 149.484 608.695 151.136 609.669 152.086L626.059 168.067C626.342 168.343 626.721 168.497 627.117 168.497L651.259 168.499C652.619 168.5 653.291 166.848 652.318 165.898L635.942 149.917Z",
];
/** индексы приглушённых сегментов, которые зажигает кофе */
const HP_WAKE = [6, 7];
/** обводка life bar */
const HP_FRAME =
  "M297.271 143.967L637.399 143.967C638.424 143.967 639.407 144.374 640.132 145.098L667.632 172.599C667.868 172.834 668 173.154 668 173.487C668 174.18 667.438 174.742 666.744 174.742L320.117 174.742C319.086 174.742 318.098 174.33 317.373 173.598L294.527 150.552C292.109 148.112 293.837 143.967 297.271 143.967Z";

/** полоска энергии под life bar: рисуем её сами, чтобы прирастала без шва
    (в char-art.svg этот контур убран) */
const energyPath = (g: number) =>
  `M${548.999 + g} 190.518C${548.999 + g} 189.68 ${548.32 + g} 189 ${547.482 + g} 189L335.345 189.014C334.003 189.014 333.323 190.63 334.261 191.59L340.174 197.639C340.459 197.93 340.85 198.095 341.258 198.095L${547.477 + g} 198.105C${548.313 + g} 198.105 ${548.992 + g} 197.427 ${548.993 + g} 196.591L${548.999 + g} 190.518Z`;

export function CharacterText() {
  const [token, setToken] = useState<number | null>(null);
  const [stackHover, setStackHover] = useState(false);
  /* заголовок расшифровывается каждый раз при наведении на фрейм */
  const techLabel = useDecrypt("Tech stack", stackHover);
  const ability = useAbilityState();
  const cry = ability.active === 1;
  const coffee = ability.active === 2;
  const [avatarHover, setAvatarHover] = useState(false);
  /* пока играет анимация способности — наведение на аватар не работает */
  const hoverWink = avatarHover && ability.active === null;

  return (
    <div className="pointer-events-none absolute inset-0 select-text">
      {/* cup of coffee: life bar вспыхивает циановым, два приглушённых
          сегмента зажигаются насовсем, над баром всплывает плюсик */}
      <svg
        aria-hidden
        viewBox="0 0 709 1080"
        width={709}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {HP_WAKE.map((n) => (
          <motion.path
            key={n}
            d={HP_SEGMENTS[n]}
            fill="white"
            initial={false}
            animate={{ opacity: ability.energy ? 1 : 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.5 + (n - 6) * 0.18 }}
          />
        ))}
        <motion.g
          initial={false}
          animate={{ opacity: coffee ? [0, 1, 0.3, 1, 0.35, 0.95, 0.1, 0] : 0 }}
          transition={{ duration: coffee ? 2.6 : 0.3, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 7px ${CYAN})` }}
        >
          {HP_SEGMENTS.map((d, i) => (
            <path key={i} d={d} fill={CYAN} />
          ))}
          <path d={HP_FRAME} fill="none" stroke={CYAN} strokeWidth={1.4} />
        </motion.g>
        <motion.g
          initial={false}
          animate={
            coffee
              ? { opacity: [0, 1, 1, 0], y: [8, -6, -18, -30], scale: [0.6, 1.15, 1, 1] }
              : { opacity: 0, y: 8, scale: 0.6 }
          }
          transition={{ duration: coffee ? 2 : 0.25, ease: "easeOut" }}
          style={{ transformOrigin: "612px 118px", filter: `drop-shadow(0 0 8px ${CYAN})` }}
        >
          <path
            d="M612 104V132M598 118H626"
            stroke={CYAN}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </motion.g>
      </svg>

      {/* полоска энергии: прирастает вправо и остаётся такой,
          во время cup of coffee подсвечивается циановым */}
      <motion.svg
        aria-hidden
        viewBox="0 0 709 1080"
        width={709}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <motion.path
          fill="white"
          opacity={0.35}
          initial={false}
          animate={{ d: energyPath(ability.energy ? ENERGY_GAIN : 0) }}
          transition={{
            duration: 0.7,
            ease: EASE,
            delay: ability.energy ? 0.25 : 0,
          }}
        />
        <motion.path
          fill={CYAN}
          animate={{
            d: energyPath(ability.energy ? ENERGY_GAIN : 0),
            opacity: coffee ? [0, 1, 0.3, 1, 0.35, 0.95, 0] : 0,
          }}
          initial={false}
          transition={{
            d: { duration: 0.7, ease: EASE, delay: ability.energy ? 0.25 : 0 },
            opacity: { duration: coffee ? 2.6 : 0.3, ease: "easeOut" },
          }}
        />
      </motion.svg>

      {/* кадры аватара для способностей — ровно поверх обычного */}
      {AVATARS.map((a, i) => (
        <motion.img
          key={a.src}
          src={a.src}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            left: 59,
            top: a.top,
            width: 315.97,
            height: a.h,
            clipPath: `inset(${84 - a.top}px 0 0 0)`,
          }}
          initial={false}
          animate={{
            opacity: ability.active === i || (i === 0 && hoverWink) ? 1 : 0,
          }}
          transition={{
            duration: ability.active === i || (i === 0 && hoverWink) ? 0.12 : 0.35,
            ease: "easeOut",
          }}
        />
      ))}

      {/* ловушка наведения на аватар */}
      <div
        className="pointer-events-auto"
        onPointerEnter={(e) => e.pointerType === "mouse" && setAvatarHover(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setAvatarHover(false)}
        style={{
          position: "absolute",
          left: AVATAR_HIT.x,
          top: AVATAR_HIT.y,
          width: AVATAR_HIT.w,
          height: AVATAR_HIT.h,
        }}
      />

      {/* стрелка под подписью designer: отвечает на наведение на аватар */}
      <svg
        aria-hidden
        viewBox="0 0 709 1080"
        width={709}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <motion.path
          d={ARROW_PATH}
          fill="white"
          initial={false}
          animate={{ rotate: hoverWink ? -45 : 0, x: hoverWink ? -5 : 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{ transformOrigin: "652px 462px" }}
        />
      </svg>

      {/* battle cry: рамка вокруг персонажа вспыхивает циановым */}
      <motion.svg
        aria-hidden
        viewBox="0 0 709 1080"
        width={709}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0 }}
        initial={false}
        animate={{ opacity: cry ? [0, 1, 0.25, 1, 0.3, 0.9, 0] : 0 }}
        transition={{ duration: cry ? 2.4 : 0.3, ease: "easeOut" }}
      >
        {BORDER_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={CYAN}
            strokeWidth={2.0454}
            fill="none"
            style={{ filter: `drop-shadow(0 0 6px ${CYAN})` }}
          />
        ))}
      </motion.svg>

      {/* имя и роль выезжают из-под маски, как заголовок work experience */}
      <div
        className="pointer-events-auto"
        style={{
          position: "absolute",
          left: 268,
          top: capTop(281, 52, 59),
          width: 400,
          textAlign: "right",
          fontSize: 52,
          lineHeight: "59px",
          letterSpacing: 2.6,
          fontWeight: 600,
          color: "#fff",
          textTransform: "uppercase",
        }}
      >
        <RevealLine>Maks</RevealLine>
        <RevealLine delay={0.07}>
          Novikov
        </RevealLine>
      </div>
      <div
        className="pointer-events-auto"
        style={{
          position: "absolute",
          left: 268,
          top: capTop(393.6, 23, 34),
          width: 400,
          textAlign: "right",
          fontSize: 23,
          lineHeight: "34px",
          fontWeight: 300,
          color: "#fff",
        }}
      >
        <RevealLine delay={0.14}>
          designer
        </RevealLine>
      </div>

      {/* абзац выезжает построчно — как цитата на странице About me */}
      <div
        className="pointer-events-auto"
        style={{
          position: "absolute",
          left: 40,
          top: capTop(542, 23, 32),
          width: 629,
          fontSize: 23,
          lineHeight: "32px",
          fontWeight: 300,
          color: "#fff",
        }}
      >
        {QUOTE_LINES.map((line, i) => (
          <RevealLine
            key={line}
            delay={0.25 + i * 0.07}
            style={{
              textAlign: "justify",
              textAlignLast: i === QUOTE_LINES.length - 1 ? "left" : "justify",
              textIndent: i === 0 ? 32 : 0,
            }}
          >
            {line}
          </RevealLine>
        ))}
      </div>

      {/* tech stack: линейка сдвигается влево, заголовок расшифровывается,
          токены подсвечиваются */}
      <div
        className="pointer-events-auto"
        style={{ position: "absolute", left: 40, top: 775, width: 629, height: 215 }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setStackHover(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setStackHover(false)}
      >
        <span className="pointer-events-auto">
          <Line
            item={{
              x: 0,
              y: 11,
              w: 160,
              size: 15,
              lh: 32,
              weight: 300,
              upper: true,
              text: techLabel,
            }}
          />
        </span>
        <motion.span
          aria-hidden
          style={{
            position: "absolute",
            left: TECH_RULE.from - 40,
            top: TECH_RULE.y - 775,
            width: TECH_RULE.w,
            height: 0.7,
            background: "rgba(255,255,255,0.7)",
          }}
        />
        {TOKEN_PILLS.map(([x, y, w], i) => (
          <span
            key={i}
            onPointerEnter={(e) => e.pointerType === "mouse" && setToken(i)}
            onPointerLeave={(e) =>
              e.pointerType === "mouse" &&
              setToken((prev) => (prev === i ? null : prev))
            }
            style={{
              position: "absolute",
              left: x - 40,
              top: y - 775,
              width: w,
              height: PILL_H,
              borderRadius: PILL_R,
              background: token === i ? TOKEN_FILL : "rgba(255,255,255,0)",
              transition: "background-color 300ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── колонка способностей ─────────────────────── */

/** три карточки: верх заголовка, строки характеристик и описания */
const CARDS: { x: number; title: string; stats: string; desc: string; y: number }[] =
  [
    {
      x: 155,
      y: 588,
      title: "Pet the cat",
      stats: "+7 calmness   +5 focus",
      desc: "Removes all negative effects",
    },
    {
      x: 155,
      y: 735,
      title: "Battle cry",
      stats: "+10 focus   +5 energy",
      desc: "Boosts concentration",
    },
    {
      x: 153,
      y: 880,
      title: "Cup of coffee",
      stats: "+ XP   +10 energy",
      desc: "Extends work sprint",
    },
  ];

/** карточки способностей в координатах кадра 460×1080 */
const CARD_BOX: [number, number, number][] = [
  [568, 440, 126],
  [715, 440, 126],
  [862, 440, 122],
];
/** внутренний фрейм special abilities: заголовок плюс кнопки */
const ABIL_BOX = { x: 20, y: 528, w: 440, h: 457 };
/** линейка заголовка special abilities: тот же сдвиг влево */
const ABIL_RULE = { y: 549, from: 258, w: 202 };

/** котик в токене: вписан по центру, высота 56 */
const TOKEN_CAT = { w: 69.6, h: 56 };

function SkillsList() {
  const [token, setToken] = useState<number | null>(null);
  const ability = useAbilityState();
  /* pet the cat: во всех шести токенах содержимое сменяется котиком,
     каждый следующий — чуть позже предыдущего */
  const cats = ability.active === 0;
  /* токены выезжают из-под маски, как Maks Novikov, только чуть позже */
  return (
    <>
      {SKILL_TOKENS.map((t, i) => (
        <div key={t.label} style={{ position: "absolute", left: t.x, top: t.y }}>
          <RevealLine delay={0.25 + i * 0.07}>
            <div
              className="pointer-events-auto"
              onPointerEnter={(e) => e.pointerType === "mouse" && setToken(i)}
              onPointerLeave={(e) =>
                e.pointerType === "mouse" &&
                setToken((prev) => (prev === i ? null : prev))
              }
              style={{
                position: "relative",
                width: SKILL_TOKEN.w,
                height: SKILL_TOKEN.h,
                borderRadius: SKILL_TOKEN.r,
                border: "1px solid rgba(255,255,255,0.22)",
                background:
                  token === i ? TOKEN_FILL : "rgba(255,255,255,0.04)",
                backdropFilter: "blur(10px)",
                transition: "background-color 300ms cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <motion.div
                initial={false}
                animate={{ opacity: cats ? 0 : 1, scale: cats ? 0.86 : 1 }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.08 }}
                style={{ position: "absolute", inset: 0 }}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 32 30"
                  width={SKILL_ICON.w}
                  height={SKILL_ICON.h}
                  style={{
                    position: "absolute",
                    left: SKILL_ICON.x - 1,
                    top: SKILL_ICON.y,
                  }}
                >
                  <path d={t.d} fill="white" />
                </svg>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: SKILL_LABEL.y,
                    width: SKILL_TOKEN.w,
                    textAlign: "center",
                    fontSize: SKILL_LABEL.size,
                    lineHeight: `${SKILL_LABEL.lh}px`,
                    fontWeight: SKILL_LABEL.weight,
                    color: "#fff",
                    whiteSpace: "pre",
                  }}
                >
                  {t.label}
                </span>
              </motion.div>
              <motion.img
                src="cat-pet.svg"
                alt=""
                aria-hidden
                draggable={false}
                initial={false}
                animate={{ opacity: cats ? 1 : 0, scale: cats ? 1 : 0.8 }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.08 }}
                style={{
                  position: "absolute",
                  left: (SKILL_TOKEN.w - TOKEN_CAT.w) / 2,
                  top: (SKILL_TOKEN.h - TOKEN_CAT.h) / 2,
                  width: TOKEN_CAT.w,
                  height: TOKEN_CAT.h,
                }}
              />
            </div>
          </RevealLine>
        </div>
      ))}
    </>
  );
}

export function AbilitiesText() {
  const [frameHover, setFrameHover] = useState(false);
  const abilLabel = useDecrypt("Special Abilities", frameHover);
  const ability = useAbilityState();
  const [card, setCard] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const frame = useRef<HTMLDivElement>(null);

  /* расшифровку запускает только внутренний фрейм special abilities
     (заголовок плюс кнопки), а не вся колонка. Между кнопками есть
     «дырки» без pointer-events, и браузер на каждой шлёт leave/enter,
     поэтому считаем попадание по координатам, а не по событию */
  const inside = (e: { clientX: number; clientY: number }) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return false;
    const k = r.width / 460;
    return (
      e.clientX >= r.left + ABIL_BOX.x * k &&
      e.clientX <= r.left + (ABIL_BOX.x + ABIL_BOX.w) * k &&
      e.clientY >= r.top + ABIL_BOX.y * k &&
      e.clientY <= r.top + (ABIL_BOX.y + ABIL_BOX.h) * k
    );
  };

  /* уйти из фрейма можно и через такую «дырку» — тогда leave не придёт
     вовсе, поэтому пока ховер активен, следим за курсором окном */
  useEffect(() => {
    if (!frameHover) return;
    const onMove = (e: PointerEvent) => {
      if (!inside(e)) setFrameHover(false);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [frameHover]);

  return (
    <div
      ref={frame}
      className="pointer-events-none absolute inset-0 select-text"
      onPointerEnter={(e) => e.pointerType === "mouse" && setFrameHover(inside(e))}
      onPointerMove={(e) => e.pointerType === "mouse" && setFrameHover(inside(e))}
      onPointerLeave={(e) =>
        e.pointerType === "mouse" && !inside(e) && setFrameHover(false)
      }
    >
      <span className="pointer-events-auto">
        <SkillsList />
      </span>

      <span className="pointer-events-auto">
        <Line
          item={{
            x: 20,
            y: 543,
            w: 240,
            size: 15,
            lh: 32,
            weight: 300,
            upper: true,
            text: abilLabel,
          }}
        />
      </span>

      <motion.span
        aria-hidden
        style={{
          position: "absolute",
          left: ABIL_RULE.from,
          top: ABIL_RULE.y,
          width: ABIL_RULE.w,
          height: 0.7,
          background: "rgba(255,255,255,0.7)",
        }}
      />

      {/* карточка целиком: подсветка под текстом, наведение ловит вся группа —
          иначе строки, лежащие выше подложки, перехватывали бы курсор */}
      {CARDS.map((c, i) => {
        const [top, w, h] = CARD_BOX[i];
        /* способность одноразовая: после срабатывания карточка
           перестаёт подсвечиваться, меняет курсор и не нажимается */
        const spent = ability.used[i];
        return (
          <div
            key={c.title}
            className="pointer-events-auto"
            onClick={() => triggerAbility(i)}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              setCard(i);
              if (!spent) setCursor({ x: e.clientX, y: e.clientY });
            }}
            onPointerMove={(e) =>
              e.pointerType === "mouse" &&
              !spent &&
              setCursor({ x: e.clientX, y: e.clientY })
            }
            onPointerLeave={(e) => {
              if (e.pointerType !== "mouse") return;
              setCard((prev) => (prev === i ? null : prev));
              setCursor(null);
            }}
            style={{
              position: "absolute",
              left: 20,
              top,
              width: w,
              height: h,
              borderRadius: 6,
              cursor: spent ? "default" : "none",
              background:
                card === i && !spent ? HOVER_FILL : "rgba(255,255,255,0)",
              transition: "background-color 420ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            {/* в покое кнопка в две строки по центру, по наведению
                выезжает третья и блок встаёт как в макете */}
            <motion.div
              initial={false}
              animate={{ y: card === i ? c.y - top : (h - 62) / 2 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ position: "absolute", left: c.x - 20, top: 0, width: 290 }}
            >
              <Line
                item={{
                  x: 0,
                  y: 0,
                  w: 290,
                  size: 23,
                  lh: 28,
                  ls: 1.15,
                  weight: 700,
                  raw: true,
                  text: c.title,
                }}
              />
              <Line
                item={{
                  x: 0,
                  y: 34,
                  w: 290,
                  size: 23,
                  lh: 28,
                  weight: 300,
                  alpha: 0.9,
                  raw: true,
                  text: c.stats,
                }}
              />
              <motion.div
                initial={false}
                animate={{ opacity: card === i ? 1 : 0 }}
                transition={{
                  duration: card === i ? 0.35 : 0.2,
                  ease: EASE,
                  delay: card === i ? 0.12 : 0,
                }}
              >
                <Line
                  item={{
                    x: 0,
                    y: 68,
                    w: 290,
                    size: 15,
                    lh: 18,
                    weight: 200,
                    alpha: 0.6,
                    raw: true,
                    text: c.desc,
                  }}
                />
              </motion.div>
            </motion.div>
          </div>
        );
      })}
      <UseCursor at={cursor} />
    </div>
  );
}
