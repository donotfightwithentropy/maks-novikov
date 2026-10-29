"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import ShaderBackdrop from "@/components/ShaderBackdrop";
import SiteMenu from "@/components/SiteMenu";
import { HeroTitle } from "@/components/HeroTitle";
import SplitText, { SPLIT_TEXT_STAGGER } from "@/components/SplitText";
import { useTransitionNav } from "@/components/PageTransition";

const ACCENT = "#B91372";
const INK = "#031828";
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ──────────────────── привязка к сетке плюсиков ─────────────────────────
   Плюсики — маяки: по ним выставлены границы обоих контейнеров.
   В макете (1920×1080) центры плюсиков стоят по X на 302.5 / 747.5 / 1617.5,
   ряды — по Y на 193 и 887. На экране их считает сама сетка главной
   страницы, поэтому позиции меряем по факту и от них строим всю вёрстку. */
const FIG = {
  c1: 302.5,
  c2: 747.5,
  c4: 1617.5,
  /** середина между рядами плюсиков = центр кадра по вертикали */
  midY: 540,
};

/** hold frame: левый край — центр первой колонки, правый — центр второй */
const HOLD = { x: 302, w: 446 };
/** scroll frame: правый край — центр четвёртой колонки */
const SCROLL = { x: 800, w: 818 };

const PHOTO = { x: 42, y: 229, w: 350, h: 534, notch: 96 };
/* Снимок вписан в рамку по ширине без искажения пропорций: 1050×1834
   даёт при ширине 350 высоту 611.3, то есть 77.3 запаса по высоте.
   На старте окно стоит внизу кадра, а по мере прокрутки страницы
   снимок съезжает вниз — то есть против хода страницы. */
const PHOTO_IMG = { w: 350, h: (350 * 1834) / 1050 };
const PHOTO_PAN = PHOTO_IMG.h - 534;
const PHOTO_ARROW = { x: 318, y: 0, size: 32 };
const CAPTION = { x: 98, y: 777, w: 294 };
const VLINE = { x: 445, y: 267, h: 546 };
/** логотип академии внутри карточки — проявляется по наведению */
const LOGO = { x: 147, y: 26, w: 99.1, h: 152.21 };
/** верхние границы блоков фактов в координатах правой колонки */
const FACT_STEP = 345;
const FACT_ONE_Y = 763;
const FACTS = {
  one: FACT_ONE_Y,
  two: FACT_ONE_Y + FACT_STEP,
  three: FACT_ONE_Y + FACT_STEP * 2,
  four: FACT_ONE_Y + FACT_STEP * 3,
  five: FACT_ONE_Y + FACT_STEP * 4,
  six: FACT_ONE_Y + FACT_STEP * 5,
};
/** блок со ссылкой на контакты — следующим шагом после последнего факта */
const CONTACTS_Y = FACTS.six + FACT_STEP;
const CONTACTS_LINES = [
  "Are you still here? Great!",
  "Let\u2019s stay in touch.",
];
/** кнопки, нижняя линейка и подпись в блоке со ссылкой на контакты */
const CONTACTS_BLOCK = {
  text: 66,
  mail: 158,
  back: 246,
  rule: 380,
  footer: 404,
};
const LINK_BTN = {
  h: 64,
  radius: 4,
  arrow: 18,
  arrowX: 23,
  arrowY: 22,
  labelX: 58,
  labelY: 22,
  size: 15,
  lh: 18,
  ls: 0.45,
};
/** почтовая кнопка раздвигается при наведении и показывает адрес целиком */
const MAIL_BTN = { w: 205, hoverW: 364, envW: 43, envH: 32, envRight: 21, envY: 16 };
const BACK_BTN = { w: 251 };
const MAIL_ADDRESS = "sima.novikov@gmail.com";
/** сколько висит всплывающее окно mail copied, мс */
const COPIED_MS = 3000;
/** окошко справа от кнопки: размер кнопки, отступ от её раскрытой ширины */
const COPIED_BOX = { w: MAIL_BTN.w, gap: 23 };
/** высота блока факта */
const FACT_H = 345;
/** внутренняя разметка блока факта */
const FACT = { kicker: 19, kickerAlt: 15, num: 70, text: 131, card: 70, button: 240 };
/** кадры 3D-проектов: первый подставляется в карточку, все шесть — в галерею */
const PHOTOS_3D = Array.from(
  { length: 7 },
  (_, i) => `/about/3d/photo_${i + 1}.webp`,
);

const PHOTOS_BOOK = Array.from(
  { length: 4 },
  (_, i) => `/about/book/photo_${i + 1}.webp`,
);
/* шестой кадр из галереи убран — сразу после пятого идёт седьмой */
const PHOTOS_SKETCHES = [1, 2, 3, 4, 5, 7].map(
  (n) => `/about/sketches/photo_${n}.webp`,
);

const TATLER_PREVIEW = "/about/tatler/preview.webp";
const PHOTOS_TATLER = Array.from(
  { length: 2 },
  (_, i) => `/about/tatler/photo_${i + 1}.webp`,
);

const PHOTOS_PHOTO = Array.from(
  { length: 9 },
  (_, i) => `/about/photo/photo_${i + 1}.webp`,
);

/** цветовой фильтр поверх снимков — как на панно главной страницы */
const TILE_TINT = "#0DA4C1";
const TILE_TINT_OPACITY = 0.35;
const TILE_SATURATE = 0.3;
/** рамка, скругление и непрозрачность снимков в карточках до наведения */
const PHOTO_CARD = { border: 0.5, radius: 2, rest: 0.5 };

/** кольцо курсора над фотографией — как над превью на странице лендингов */
const RING = 74;
const RING_HOLE = 32;
/** подсветка строки по наведению — как в таблице Projects на главной */
const ROW_HOVER = "rgba(255,255,255,0.02)";
/** кнопка «2 cats tavern» во втором факте */
const BUTTON = { w: 182, h: 34, radius: 4 };
/** стрелка внутри тёмной карточки */
const CARD_ARROW = { x: 15, y: 176, size: 13 };

/* Цитата выезжает построчно, как заголовки на главной. Разбивка задана
   вручную: ширина колонки и кегль масштабируются вместе, поэтому переносы
   одинаковы на любом экране — проверено на 1920, 1600 и 1366. */
const QUOTE_LINES = [
  "I love travelling, interesting conversations, and",
  "mountain air at sunrise. I enjoy interesting projects",
  "and working with creative people. I\u2019ve been involved",
  "in design for a long time, you could say since",
  "childhood. Back then, I just loved looking at beautiful",
  "pictures. Now I try to create beautiful pictures myself,",
  "but with a purpose.",
];
/** ширина линеек и текстовой колонки внутри scroll frame */
const COL_W = 766;
/** низ контента правой колонки */
const COL_H = CONTACTS_Y + 470;

/** cap-top макета → CSS top по метрикам Montserrat */
const capTop = (y: number, size: number, lh: number) =>
  y - ((lh - 1.219 * size) / 2 + 0.968 * size - 0.7 * size);

/* ───────────────────────────── тайминги ────────────────────────────────── */
const PHOTO_DELAY = 0.25;
const TITLE_DELAY = 0.35;
const RULE_DURATION = 0.9;
/** линейки правой колонки прочерчиваются медленнее */
const SCROLL_RULE_DURATION = 2.2;
/** появление текста в правой колонке */
const REVEAL_DURATION = 2.4;
/** доворот стрелок и выцветание карточек по наведению */
const HOVER_DURATION = 0.8;
const CARD_FADE_DURATION = 0.9;
const RULE_1_DELAY = 0.5;
const RULE_2_DELAY = 0.62;
const VLINE_DELAY = 0.45;
/** Правая колонка ждёт, пока доиграет занавес перехода на страницу */
const SCROLL_DELAY = 0.9;

const QUOTE_PATH =
  "M 26.58122971577216 22.574011063518103 C 29.34175812421101 23.909749834668894 31.478941060020656 25.86883371954032 32.992781530928426 28.45126307198266 C 34.506619347959145 30.944644234565757 35.263537814161666 33.9277980491555 35.263537814161666 37.400725223452426 C 35.263537814161666 42.565586759139265 33.61612523430627 46.70638261131104 30.32129972074519 49.82310888761478 C 27.02647420718412 52.93983516391852 22.796631900080335 54.49819564819336 17.631770322481927 54.49819564819336 C 12.466908391033243 54.49819564819336 8.237063960827818 52.93983516391852 4.942238447266746 49.82310888761478 C 1.6474129337056733 46.70638261131104 0 42.565586759139265 0 37.400725223452426 C 0 35.08544044058781 0.3116726478520332 32.77015884237562 0.9350179435560997 30.454879367265068 C 1.5583634161853028 28.139594584400452 2.983152954171608 24.622142784398502 5.209386557515015 19.90252502881003 L 14.559567231551968 0 L 33.25992999502697 0 L 26.58122971577216 22.574011063518103 Z M 65.31768624000613 22.574011063518103 C 68.07821730232203 23.909749834668894 70.21540324585901 25.86883371954032 71.72924371676677 28.45126307198266 C 73.24307887992045 30.944644234565757 74 33.9277980491555 74 37.400725223452426 C 74 42.565586759139265 72.35258458934243 46.70638261131104 69.05775907578135 49.82310888761478 C 65.76293356222027 52.93983516391852 61.53309408591868 54.49819564819336 56.36823533912246 54.49819564819336 C 51.203371284572135 54.49819564819336 46.973525792815884 52.93983516391852 43.67870027925481 49.82310888761478 C 40.38387476569374 46.70638261131104 38.73646218583834 42.565586759139265 38.73646218583834 37.400725223452426 C 38.73646218583834 35.08544044058781 39.04813368367698 32.77015884237562 39.67147897938105 30.454879367265068 C 40.29482427508512 28.139594584400452 41.719614786159674 24.622142784398502 43.94584874335335 19.90252502881003 L 53.29603366359359 0 L 71.99639218086531 0 L 65.31768624000613 22.574011063518103 Z";

/** Стрелка ↗ из макета: верхняя планка, правая планка и диагональ */
function CornerArrow({ size, color }: { size: number; color: string }) {
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

/** Конверт из макета: рамка со скруглением и «клапан» внутри */
function Envelope({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <svg
      viewBox="0 0 43 32"
      aria-hidden
      style={{ width: w, height: h, display: "block", overflow: "visible" }}
    >
      <g stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round">
        <rect x="1" y="1" width="41" height="30" rx="2.5" />
        <path d="M3.5 4.5 L21.5 18.5 L39.5 4.5" />
      </g>
    </svg>
  );
}

type ContactButtonProps = {
  p: (v: number) => number;
  /** верх кнопки в координатах блока контактов */
  y: number;
  w: number;
  /** ширина при наведении, если кнопка раздвигается */
  hoverW?: number;
  label: string;
  hoverLabel?: string;
  /** на сколько доворачивается стрелка при наведении */
  rotate: number;
  envelope?: boolean;
  onClick: () => void;
  delay: number;
};

/** Кнопка из блока link to contacts: по наведению заливается маджентой,
    стрелка доворачивается и белеет */
function ContactButton({
  p,
  y,
  w,
  hoverW,
  label,
  hoverLabel,
  rotate,
  envelope,
  onClick,
  delay,
}: ContactButtonProps) {
  const [hover, setHover] = useState(false);
  const wide = hover && hoverW ? hoverW : w;
  const text = hover && hoverLabel ? hoverLabel : label;
  const ink = hover ? "#fff" : ACCENT;

  return (
    <Reveal
      delay={delay}
      inView
      style={{ position: "absolute", left: 0, top: p(y) }}
    >
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
        style={{
          position: "relative",
          display: "block",
          width: p(wide),
          height: p(LINK_BTN.h),
          padding: 0,
          borderRadius: p(LINK_BTN.radius),
          border: `1px solid ${ACCENT}`,
          background: hover ? ACCENT : "rgba(255,255,255,0.04)",
          overflow: "hidden",
          cursor: "pointer",
          transition:
            "width 520ms cubic-bezier(0.16,1,0.3,1), background-color 400ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            left: p(LINK_BTN.arrowX),
            top: p(LINK_BTN.arrowY),
          }}
          animate={{ rotate: hover ? rotate : 0 }}
          transition={{ duration: HOVER_DURATION, ease: EASE_OUT }}
        >
          <CornerArrow size={p(LINK_BTN.arrow)} color={ink} />
        </motion.div>
        <span
          className="font-normal"
          style={{
            position: "absolute",
            left: p(LINK_BTN.labelX),
            top: p(LINK_BTN.labelY),
            color: "#fff",
            fontSize: p(LINK_BTN.size),
            lineHeight: `${p(LINK_BTN.lh)}px`,
            letterSpacing: p(LINK_BTN.ls),
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
        {envelope && (
          <div
            style={{
              position: "absolute",
              right: p(MAIL_BTN.envRight),
              top: p(MAIL_BTN.envY),
            }}
          >
            <Envelope w={p(MAIL_BTN.envW)} h={p(MAIL_BTN.envH)} color="#fff" />
          </div>
        )}
      </button>
    </Reveal>
  );
}

/** Линия, которая при первом появлении прочерчивается слева направо */
function DrawnRule({
  top,
  width,
  delay,
  inView = false,
}: {
  top: number;
  width: number;
  delay: number;
  inView?: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      className="origin-left"
      style={{
        position: "absolute",
        left: 0,
        top,
        width,
        height: 1,
        background: "rgba(255,255,255,0.3)",
      }}
      initial={{ scaleX: 0 }}
      {...(inView
        ? { whileInView: { scaleX: 1 }, viewport: { once: true, margin: "0px 0px -15% 0px" } }
        : { animate: { scaleX: 1 } })}
      transition={{ duration: SCROLL_RULE_DURATION, delay, ease: EASE_OUT }}
    />
  );
}

function Reveal({
  children,
  delay,
  style,
  className,
  inView = false,
}: {
  children: React.ReactNode;
  delay: number;
  style?: React.CSSProperties;
  className?: string;
  /** блоки ниже первого экрана появляются, когда доезжают до него */
  inView?: boolean;
}) {
  const shown = { opacity: 1, y: 0, filter: "blur(0px)" };
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
      {...(inView
        ? { whileInView: shown, viewport: { once: true, margin: "0px 0px -15% 0px" } }
        : { animate: shown })}
      transition={{ duration: REVEAL_DURATION, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Галерея поверх страницы: листается стрелками и клавишами,
    закрывается крестиком, кликом по фону и клавишей Esc */
function Gallery({
  images,
  start,
  onClose,
}: {
  images: string[];
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const step = (d: number) =>
    setIndex((i) => (i + d + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, images.length]);

  const nav = (d: number, label: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        step(d);
      }}
      className="fixed flex items-center justify-center rounded-full"
      style={{
        top: "50%",
        [d < 0 ? "left" : "right"]: 32,
        marginTop: -28,
        width: 56,
        height: 56,
        background: "rgba(255,255,255,0.06)",
        border: "none",
        cursor: "pointer",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path
          d={d < 0 ? "M13 2 L5 10 L13 18" : "M7 2 L15 10 L7 18"}
          stroke="#fff"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
    </button>
  );

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      onClick={onClose}
      className="fixed inset-0 z-[140] flex items-center justify-center"
      style={{ background: "rgba(3,24,40,0.94)" }}
    >
      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "82vw",
          maxHeight: "82vh",
          width: "auto",
          height: "auto",
          display: "block",
          borderRadius: 12,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.6)",
          fontSize: 13,
          letterSpacing: "0.14em",
        }}
      >
        {index + 1} / {images.length}
      </div>
      {nav(-1, "Previous")}
      {nav(1, "Next")}
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
          <path d="M1 1 L17 17 M17 1 L1 17" stroke="#fff" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
    </motion.div>,
    document.body,
  );
}

/* ───────────────────────────── блок факта ──────────────────────────────
   Нечётные факты: номер и текст слева, тёмная карточка справа со срезом
   в правом верхнем углу. Чётные — зеркально, и текст встаёт по левому
   краю карточек соседних фактов. */
/** содержимое одного факта — без привязки к раскладке */
type FactData = Pick<
  FactProps,
  "num" | "kicker" | "text" | "textW" | "card" | "logo" | "button" | "photo"
>;

type FactProps = {
  p: (v: number) => number;
  /** верх блока в координатах правой колонки */
  y: number;
  num: string;
  /** подзаголовок капителью над номером */
  kicker: string;
  text: React.ReactNode;
  /** ширина текстовой колонки по макету */
  textW: number;
  /** на какой стороне тёмная карточка */
  card: "right" | "left";
  /** базовая задержка появления; inView — ждать прокрутки */
  delay: number;
  inView?: boolean;
  /** логотип, который проявляется в карточке по наведению */
  logo?: { src: string; x: number; y: number; w: number; h: number };
  /** кнопка под текстом */
  button?: { label: string; href: string };
  /** фотография вместо тёмной карточки по наведению + галерея по клику */
  photo?: { src: string; gallery: string[] };
};

function Fact({
  p,
  y,
  num,
  kicker,
  text,
  textW,
  card,
  delay,
  inView,
  logo,
  button,
  photo,
}: FactProps) {
  const [hover, setHover] = useState(false);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [gallery, setGallery] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const right = card === "right";
  const cardX = right ? 373 : 0;
  const cardW = right ? 393 : 321;
  const textX = right ? 1 : 373;
  const clip = right
    ? `polygon(0 0, ${p(cardW - 73.5)}px 0, ${p(cardW)}px ${p(73.5)}px, ${p(
        cardW,
      )}px ${p(204)}px, 0 ${p(204)}px)`
    : `polygon(${p(73.5)}px 0, ${p(cardW)}px 0, ${p(cardW)}px ${p(204)}px, 0 ${p(
        204,
      )}px, 0 ${p(73.5)}px)`;

  return (
    <div
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      style={{
        position: "absolute",
        left: 0,
        top: p(y),
        width: p(COL_W),
        height: p(FACT_H),
        backgroundColor: hover ? ROW_HOVER : "rgba(255,255,255,0)",
        transition: "background-color 450ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <DrawnRule top={0} width={p(COL_W)} delay={delay} inView={inView} />

      <Reveal
        delay={delay + 0.15}
        inView={inView}
        className="font-normal"
        style={{
          position: "absolute",
          left: p(textX - 1),
          top: p(right ? FACT.kicker : FACT.kickerAlt),
          color: "#fff",
          fontSize: p(12),
          lineHeight: `${p(16)}px`,
          letterSpacing: p(1.68),
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {kicker}
      </Reveal>

      <Reveal
        delay={delay + 0.2}
        inView={inView}
        className="font-medium"
        style={{
          position: "absolute",
          left: p(textX),
          top: p(capTop(FACT.num, 52, 52)),
          color: ACCENT,
          fontSize: p(52),
          lineHeight: `${p(52)}px`,
        }}
      >
        {num}
      </Reveal>

      <Reveal
        delay={delay + 0.3}
        inView={inView}
        className="font-light"
        style={{
          position: "absolute",
          left: p(textX),
          top: p(FACT.text),
          width: p(textW),
          color: "#fff",
          fontSize: p(15),
          lineHeight: `${p(22)}px`,
        }}
      >
        {text}
      </Reveal>

      <motion.div
        style={{
          position: "absolute",
          left: p(cardX),
          top: p(FACT.card),
          width: p(cardW),
          height: p(204),
        }}
        initial={{ opacity: 0, y: 24 }}
        {...(inView
          ? {
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: "0px 0px -15% 0px" },
            }
          : { animate: { opacity: 1, y: 0 } })}
        transition={{ duration: 1, delay: delay + 0.25, ease: EASE_OUT }}
      >
        {/* тёмная плашка остаётся только там, где нет снимка */}
        {!photo && (
          <motion.div
            style={{ position: "absolute", inset: 0, background: INK, clipPath: clip }}
            animate={{ opacity: logo ? 0 : 1 }}
            transition={{ duration: CARD_FADE_DURATION, ease: EASE_OUT }}
          />
        )}
        {photo && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              cursor: "none",
              opacity: hover ? 1 : PHOTO_CARD.rest,
              transition: "opacity 500ms ease",
            }}
            onPointerEnter={(e) =>
              e.pointerType === "mouse" && setRing({ x: e.clientX, y: e.clientY })
            }
            onPointerMove={(e) =>
              e.pointerType === "mouse" && setRing({ x: e.clientX, y: e.clientY })
            }
            onPointerLeave={(e) => e.pointerType === "mouse" && setRing(null)}
            onClick={() => {
              setRing(null);
              setGallery(true);
            }}
          >
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: clip }}>
              <img
                src={photo.src}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: `saturate(${hover ? 1 : TILE_SATURATE})`,
                  transition: "filter 500ms ease",
                }}
              />
              {/* тот же цветовой фильтр, что на панно у «I’ve always loved…» */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: TILE_TINT,
                  mixBlendMode: "color",
                  opacity: hover ? 0 : TILE_TINT_OPACITY,
                  transition: "opacity 500ms ease",
                  pointerEvents: "none",
                }}
              />
            </div>
            {/* контур по срезанному углу: clip-path обрезал бы обычную рамку */}
            <svg
              viewBox={`0 0 ${cardW} 204`}
              preserveAspectRatio="none"
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
              <path
                d={
                  right
                    ? `M0.25 0.25 H${cardW - 73.5} L${cardW - 0.25} 73.5 V203.75 H0.25 Z`
                    : `M73.5 0.25 H${cardW - 0.25} V203.75 H0.25 V73.5 Z`
                }
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth={PHOTO_CARD.border}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}
        {logo && (
          <img
            src={logo.src}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              left: p(logo.x),
              top: p(logo.y),
              width: p(logo.w),
              height: p(logo.h),
              opacity: hover ? 1 : PHOTO_CARD.rest,
              transition: "opacity 500ms ease",
            }}
          />
        )}
        <motion.div
          style={{
            position: "absolute",
            left: p(CARD_ARROW.x),
            top: p(CARD_ARROW.y),
          }}
          animate={{ rotate: hover ? 45 : 0 }}
          transition={{ duration: HOVER_DURATION, ease: EASE_OUT }}
        >
          {/* стрелки на карточках с фотографиями — маджентовые,
              белая остаётся только в первом факте, где лежит логотип */}
          <CornerArrow size={p(CARD_ARROW.size)} color={logo ? "#fff" : ACCENT} />
        </motion.div>
      </motion.div>

      {ring &&
        hover &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[130] rounded-full"
            style={{
              left: ring.x,
              top: ring.y,
              width: RING,
              height: RING,
              marginLeft: -RING / 2,
              marginTop: -RING / 2,
              boxSizing: "border-box",
              border: `${(RING - RING_HOLE) / 2}px solid ${ACCENT}`,
            }}
          />,
          document.body,
        )}

      <AnimatePresence>
        {gallery && photo && (
          <Gallery
            images={photo.gallery}
            start={0}
            onClose={() => setGallery(false)}
          />
        )}
      </AnimatePresence>

      {button && (
        <Reveal
          delay={delay + 0.4}
          inView={inView}
          style={{
            position: "absolute",
            left: p(textX),
            top: p(FACT.button),
            width: p(BUTTON.w),
            height: p(BUTTON.h),
          }}
        >
          <a
            href={button.href}
            target="_blank"
            rel="noreferrer noopener"
            onPointerEnter={(e) => e.pointerType === "mouse" && setBtnHover(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setBtnHover(false)}
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              background: btnHover ? ACCENT : "rgba(255,255,255,0.04)",
              border: `1px solid ${ACCENT}`,
              borderRadius: p(BUTTON.radius),
              boxSizing: "border-box",
              textDecoration: "none",
              transition: "background-color 400ms ease",
            }}
          >
            <motion.div
              style={{ position: "absolute", left: p(16), top: p((BUTTON.h - 13) / 2) }}
              animate={{ rotate: btnHover ? 45 : 0 }}
              transition={{ duration: HOVER_DURATION, ease: EASE_OUT }}
            >
              <CornerArrow size={p(13)} color={btnHover ? "#fff" : ACCENT} />
            </motion.div>
            <div
              className="font-normal"
              style={{
                position: "absolute",
                left: p(44),
                top: p(capTop(11.4, 15, 18)),
                color: "#fff",
                fontSize: p(15),
                lineHeight: `${p(18)}px`,
                letterSpacing: p(0.45),
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {button.label}
            </div>
          </a>
        </Reveal>
      )}
    </div>
  );
}

/** содержимое фактов: одно и то же для десктопа и мобильной версии */
const FACT_DATA: FactData[] = [
  {
            num: "01",
            kicker: "Art education",
            textW: 328,
            card: "right",
            logo: { src: "/about/usaaa.svg", ...LOGO },
            text: (
              <>
                I have an art background and a degree in Urban Planning. I
                spent seven years studying at the Ural Architectural Academy.
                And then I never worked a single day in that field &ndash;
                I&rsquo;ve been involved in design in one way or another from
                the very beginning.
              </>
            ),
  },
  {
            num: "02",
            kicker: "3d modelling",
            textW: 324,
            card: "left",
            button: {
              label: "2 cats tavern",
              href: "https://www.artstation.com/artwork/QKLwD3",
            },
            photo: {
              src: PHOTOS_3D[0],
              gallery: PHOTOS_3D,
            },
            text: (
              <>
                I spent a long time working with 3D modelling, and I still
                occasionally create some projects in my spare time. You can
                check out one of these pet projects here:
              </>
            ),
  },
  {
            num: "03",
            kicker: "Published book",
            photo: { src: PHOTOS_BOOK[0], gallery: PHOTOS_BOOK },
            textW: 328,
            card: "right",
            text: (
              <>
                I also write a lot, and one day I wrote and published my own
                book. You can find the digital version on Amazon. It&rsquo;s a
                collection of short stories, almost 300 pages long. I wrote it,
                drew all the illustrations, and designed the entire book
                myself.
              </>
            ),
  },
  {
            num: "04",
            kicker: "art & sketches",
            photo: { src: PHOTOS_SKETCHES[0], gallery: PHOTOS_SKETCHES },
            textW: 324,
            card: "left",
            text: (
              <>
                Apart from my own book and its illustrations, I spent several
                years working on custom book covers and portraits. You can see
                some of these works here. All of them were created by hand,
                before the rise of AI era.
              </>
            ),
  },
  {
            num: "05",
            kicker: "The Tbilisi Tatler",
            photo: { src: TATLER_PREVIEW, gallery: PHOTOS_TATLER },
            textW: 328,
            card: "right",
            text: (
              <>
                I&rsquo;ve been living in Tbilisi since 2022, and while living
                here, I started publishing a newspaper just to make fun of my
                friends. I wrote all the articles and designed every issue
                myself. People still occasionally ask me when the next one is
                coming out.
              </>
            ),
  },
  {
            num: "06",
            kicker: "Photography",
            photo: { src: PHOTOS_PHOTO[0], gallery: PHOTOS_PHOTO },
            textW: 324,
            card: "left",
            text: (
              <>
                Besides design and writing, I also love photography. Especially
                candid shots captured in the right moment. Here are some photos
                &ndash; from the mountains of Georgia to the wildlife of
                Argentina, from European cities to the forests of the remote
                Ural taiga.
              </>
            ),
  },
];


/* ───────────────────────── мобильная раскладка ──────────────────────────
   Экран собирается в одну колонку: заголовок, портрет, подпись, линейка,
   цитата и факты. Поля — те же, что на главной (--gutter-mobile). */

const M = {
  title: 36,
  caption: 11,
  captionLh: 15,
  quote: 17,
  quoteLh: 26,
  kicker: 11,
  num: 40,
  text: 14,
  textLh: 21,
  gap: 28,
};

function MobileRule({ top = 0 }: { top?: number }) {
  return (
    <motion.div
      aria-hidden
      className="w-full origin-left"
      style={{ marginTop: top, height: 1, background: "rgba(255,255,255,0.3)" }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: RULE_DURATION, ease: EASE_OUT }}
    />
  );
}

function MobileButton({
  label,
  href,
  onClick,
  rotate = 45,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  rotate?: number;
}) {
  const inner = (
    <>
      <span style={{ display: "block", transform: `rotate(${rotate - 45}deg)` }}>
        <CornerArrow size={13} color={ACCENT} />
      </span>
      <span
        className="font-normal"
        style={{
          color: "#fff",
          fontSize: 13,
          lineHeight: "16px",
          letterSpacing: 0.45,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </>
  );
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    height: 44,
    padding: "0 18px",
    border: `1px solid ${ACCENT}`,
    borderRadius: 4,
    background: "rgba(255,255,255,0.04)",
    textDecoration: "none",
    width: "fit-content",
  };
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" style={style}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} style={style}>
      {inner}
    </button>
  );
}

/** Факт в мобильной раскладке: линейка, подзаголовок, номер, текст,
    под ними — снимок или логотип и кнопка */
function FactMobile({ data }: { data: FactData }) {
  const [gallery, setGallery] = useState(false);
  const { photo, logo, button } = data;

  return (
    <div style={{ marginTop: M.gap }}>
      <MobileRule />
      <Reveal delay={0} inView style={{ marginTop: 18 }}>
        <div
          className="font-normal"
          style={{
            color: "#fff",
            fontSize: M.kicker,
            lineHeight: "15px",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {data.kicker}
        </div>
        <div
          className="font-medium"
          style={{
            marginTop: 10,
            color: ACCENT,
            fontSize: M.num,
            lineHeight: `${M.num}px`,
          }}
        >
          {data.num}
        </div>
        <div
          className="font-light"
          style={{
            marginTop: 12,
            color: "#fff",
            fontSize: M.text,
            lineHeight: `${M.textLh}px`,
          }}
        >
          {data.text}
        </div>
      </Reveal>

      {button && (
        <div style={{ marginTop: 16 }}>
          <MobileButton label={button.label} href={button.href} />
        </div>
      )}

      {photo && (
        <motion.button
          type="button"
          onClick={() => setGallery(true)}
          className="block w-full"
          style={{
            marginTop: 18,
            position: "relative",
            aspectRatio: "393 / 204",
            overflow: "hidden",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.5)",
          }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 1, ease: EASE_OUT }}
        >
          <img
            src={photo.src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </motion.button>
      )}

      {logo && (
        <Reveal delay={0} inView style={{ marginTop: 18 }}>
          <img
            src={logo.src}
            alt=""
            aria-hidden
            style={{ width: 88, height: "auto", display: "block" }}
          />
        </Reveal>
      )}

      <AnimatePresence>
        {gallery && photo && (
          <Gallery
            images={photo.gallery}
            start={0}
            onClose={() => setGallery(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type Geometry = { c1: number; c2: number; c4: number; midY: number; k: number };

const FALLBACK: Geometry = { ...FIG, k: 1 };

export default function AboutView() {
  const [photoHover, setPhotoHover] = useState(false);
  const [copied, setCopied] = useState(false);
  const { go } = useTransitionNav();

  /* клик по кнопке «my mail» кладёт адрес в буфер и показывает mail copied */
  const copyMail = useCallback(() => {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = MAIL_ADDRESS;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        /* буфер недоступен — надпись всё равно покажем */
      }
      document.body.removeChild(area);
    };
    const done = () => setCopied(true);
    navigator.clipboard?.writeText(MAIL_ADDRESS).then(done, () => {
      fallback();
      done();
    }) ?? (fallback(), done());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);
  const { scrollYProgress } = useScroll();
  const [geo, setGeo] = useState<Geometry>(FALLBACK);
  /* ниже этой ширины экран собирается в одну колонку */
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    /* на телефоне ширина окна встаёт не сразу после первой отрисовки,
       поэтому следим и за размером документа, не только за resize */
    const ro = new ResizeObserver(check);
    ro.observe(document.documentElement);
    const t = window.setTimeout(check, 400);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      window.removeEventListener("resize", check);
    };
  }, []);

  /* меряем центры плюсиков и от них считаем масштаб и привязки */
  const measure = useCallback(() => {
    const center = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const c1 = center('[data-plus="c0r0"]');
    const c2 = center('[data-plus="c1r0"]');
    const c4 = center('[data-plus="c3r0"]');
    const c1b = center('[data-plus="c0r2"]');
    if (!c1 || !c2 || !c4 || !c1b) return;
    const k = (c2.x - c1.x) / (FIG.c2 - FIG.c1);
    setGeo({
      c1: c1.x,
      c2: c2.x,
      c4: c4.x,
      midY: (c1.y + c1b.y) / 2,
      k,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const t = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* колонка плюсиков уезжает вниз при наведении — позиции не трогаем,
     меряем только при изменении размера окна */
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [measure]);

  const { k } = geo;
  const p = (v: number) => v * k;
  /** верх кадра на экране */
  const sceneTop = geo.midY - p(FIG.midY);
  const holdLeft = geo.c1;
  const scrollLeft = geo.c4 - p(SCROLL.w);

  /* снимок панорамируется на PHOTO_PAN за всю прокрутку страницы */
  const photoShift = useTransform(scrollYProgress, [0, 1], [-p(PHOTO_PAN), 0]);

  const photoClip = `polygon(0 0, ${p(PHOTO.w - PHOTO.notch)}px 0, ${p(
    PHOTO.w,
  )}px ${p(PHOTO.notch)}px, ${p(PHOTO.w)}px ${p(PHOTO.h)}px, 0 ${p(
    PHOTO.h,
  )}px)`;

  if (mobile) {
    return (
      <main className="relative min-h-[100svh]" style={{ background: INK }}>
        <ShaderBackdrop className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

        <div
          className="relative z-20"
          style={{
            padding: "118px var(--gutter-mobile) 72px",
          }}
        >
          <motion.h1
            className="font-bold"
            style={{
              color: "#fff",
              fontSize: M.title,
              lineHeight: `${M.title}px`,
              letterSpacing: -0.7,
              margin: 0,
            }}
            initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, delay: TITLE_DELAY, ease: EASE_OUT }}
          >
            Ok, this is me
          </motion.h1>

          {/* портрет со срезанным углом */}
          <motion.div
            style={{
              position: "relative",
              marginTop: 26,
              width: "100%",
              aspectRatio: `${PHOTO.w} / ${PHOTO.h}`,
            }}
            initial={{ opacity: 0, scale: 1.03, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: PHOTO_DELAY, ease: EASE_OUT }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                clipPath: `polygon(0 0, calc(100% - ${
                  (PHOTO.notch / PHOTO.w) * 100
                }%) 0, 100% ${(PHOTO.notch / PHOTO.h) * 100}%, 100% 100%, 0 100%)`,
              }}
            >
              <img
                src="/about/me.webp"
                alt="Maks during a trip to India"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "50% 35%",
                  display: "block",
                }}
              />
            </div>
            <svg
              viewBox={`0 0 ${PHOTO.w} ${PHOTO.h}`}
              preserveAspectRatio="none"
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
              <path
                d={`M0.5 0.5 H${PHOTO.w - PHOTO.notch} L${PHOTO.w - 0.5} ${
                  PHOTO.notch
                } V${PHOTO.h - 0.5} H0.5 Z`}
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </motion.div>

          {/* подпись под портретом */}
          <Reveal
            delay={PHOTO_DELAY + 0.3}
            className="font-normal"
            style={{
              marginTop: 16,
              color: "rgba(255,255,255,0.6)",
              fontSize: M.caption,
              lineHeight: `${M.captionLh}px`,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            This is me during my trip to India, on the outskirts of a small
            village. The dog is also posing with me and her name is Shakti.
          </Reveal>

          <div style={{ marginTop: M.gap }}>
            <MobileRule />
          </div>

          {/* цитата */}
          <Reveal delay={0.5} style={{ marginTop: 20 }}>
            <svg
              viewBox="-1.5 -1.5 77 57.5"
              aria-hidden
              style={{ width: 44, height: 32, display: "block" }}
            >
              <path d={QUOTE_PATH} fill="none" stroke={ACCENT} strokeWidth="3" />
            </svg>
            <div
              className="font-bold"
              style={{
                marginTop: 14,
                color: "#fff",
                fontSize: M.quote,
                lineHeight: `${M.quoteLh}px`,
                letterSpacing: 0.6,
              }}
            >
              {QUOTE_LINES.join(" ")}
            </div>
          </Reveal>

          {FACT_DATA.map((f) => (
            <FactMobile key={f.num} data={f} />
          ))}

          {/* контакты */}
          <div style={{ marginTop: M.gap }}>
            <MobileRule />
          </div>
          <Reveal
            delay={0}
            inView
            className="font-bold"
            style={{
              marginTop: 20,
              color: "#fff",
              fontSize: M.quote,
              lineHeight: `${M.quoteLh}px`,
              letterSpacing: 0.6,
            }}
          >
            {CONTACTS_LINES.join(" ")}
          </Reveal>
          <div
            style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <MobileButton label="My mail" onClick={copyMail} />
            <MobileButton
              label="Back to main page"
              rotate={-90}
              onClick={() => go("/")}
            />
          </div>
          <AnimatePresence>
            {copied && (
              <motion.div
                key="copied"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="font-normal"
                style={{
                  marginTop: 12,
                  color: "rgba(255,255,255,0.7)",
                  fontSize: M.caption,
                  lineHeight: `${M.captionLh}px`,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Mail copied
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ marginTop: M.gap }}>
            <MobileRule />
          </div>
          <Reveal
            delay={0}
            inView
            className="font-normal"
            style={{
              marginTop: 16,
              color: "rgba(255,255,255,0.7)",
              fontSize: M.caption,
              lineHeight: `${M.captionLh}px`,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            2026 &copy; MakS Novikov
          </Reveal>
        </div>

        <SiteMenu />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100svh]" style={{ background: INK }}>
      <ShaderBackdrop className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

      {/* hold frame — стоит на месте при прокрутке */}
      <div
        className="pointer-events-none fixed z-10"
        style={{
          left: holdLeft,
          top: sceneTop,
          width: p(HOLD.w),
          height: p(1080),
        }}
      >
        {/* фотография со срезанным углом */}
        <motion.div
          style={{
            position: "absolute",
            left: p(PHOTO.x),
            top: p(PHOTO.y),
            width: p(PHOTO.w),
            height: p(PHOTO.h),
          }}
          initial={{ opacity: 0, scale: 1.04, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, delay: PHOTO_DELAY, ease: EASE_OUT }}
          className="pointer-events-auto"
          onPointerEnter={(e) =>
            e.pointerType === "mouse" && setPhotoHover(true)
          }
          onPointerLeave={(e) =>
            e.pointerType === "mouse" && setPhotoHover(false)
          }
        >
          <div
            style={{ position: "absolute", inset: 0, clipPath: photoClip, overflow: "hidden" }}
          >
            <motion.img
              src="/about/me.webp"
              alt="Maks during a trip to India"
              style={{
                position: "absolute",
                left: 0,
                top: photoShift,
                width: p(PHOTO_IMG.w),
                height: p(PHOTO_IMG.h),
                display: "block",
              }}
            />
          </div>
          <svg
            viewBox={`0 0 ${PHOTO.w} ${PHOTO.h}`}
            preserveAspectRatio="none"
            aria-hidden
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <path
              d={`M0.5 0.5 H${PHOTO.w - PHOTO.notch} L${PHOTO.w - 0.5} ${
                PHOTO.notch
              } V${PHOTO.h - 0.5} H0.5 Z`}
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </motion.div>

        {/* маджентовая стрелка у верхнего правого угла фотографии */}
        <motion.div
          style={{
            position: "absolute",
            left: p(PHOTO.x + PHOTO_ARROW.x),
            top: p(PHOTO.y + PHOTO_ARROW.y),
          }}
          initial={{ opacity: 0, x: -10, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: photoHover ? 45 : 0 }}
          transition={{
            opacity: { duration: 0.8, delay: PHOTO_DELAY + 0.5, ease: EASE_OUT },
            x: { duration: 0.8, delay: PHOTO_DELAY + 0.5, ease: EASE_OUT },
            y: { duration: 0.8, delay: PHOTO_DELAY + 0.5, ease: EASE_OUT },
            rotate: { duration: HOVER_DURATION, ease: EASE_OUT },
          }}
        >
          <CornerArrow size={p(PHOTO_ARROW.size)} color={ACCENT} />
        </motion.div>

        {/* подпись под фотографией */}
        <Reveal
          delay={PHOTO_DELAY + 0.35}
          className="pointer-events-auto font-normal"
          style={{
            position: "absolute",
            left: p(CAPTION.x),
            top: p(CAPTION.y),
            width: p(CAPTION.w),
            color: "rgba(255,255,255,0.6)",
            userSelect: "text",
            fontSize: p(12),
            lineHeight: `${p(16)}px`,
            letterSpacing: p(1.68),
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          This is me during my trip to India, on the outskirts of a small
          village. The dog is also posing with me and her name is Shakti.
        </Reveal>

        {/* вертикальная линия — ровно по центру второй колонки плюсиков */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: p(VLINE.x),
            top: p(VLINE.y),
            width: 1,
            height: p(VLINE.h),
            background: "rgba(255,255,255,0.55)",
            transformOrigin: "top",
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: RULE_DURATION, delay: VLINE_DELAY, ease: EASE_OUT }}
        />
      </div>

      {/* scroll frame — едет вместе со страницей */}
      <div
        className="pointer-events-none relative z-20"
        style={{ paddingTop: sceneTop, paddingBottom: p(160) }}
      >
        <div
          className="pointer-events-auto"
          style={{
            position: "relative",
            marginLeft: scrollLeft,
            width: p(SCROLL.w),
            height: p(COL_H),
          }}
        >
          <motion.h1
            className="font-bold"
            style={{
              position: "absolute",
              left: p(1),
              top: p(222),
              color: "#fff",
              fontSize: p(85),
              lineHeight: `${p(85)}px`,
              letterSpacing: p(-1.7),
              whiteSpace: "nowrap",
              margin: 0,
            }}
            initial={{ opacity: 0, y: 70, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: SCROLL_DELAY + TITLE_DELAY, duration: 1.2, ease: EASE_OUT }}
          >
            Ok, this is me
          </motion.h1>

          <DrawnRule top={p(325)} width={p(COL_W)} delay={SCROLL_DELAY + RULE_1_DELAY} />

          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              /* обводка в 3 ложится по центру контура, поэтому поле
                 расширено на 1.5 с каждой стороны — иначе края срезает */
              left: p(1 - 1.5),
              top: p(353 - 1.5),
              width: p(74 + 3),
              height: p(54.5 + 3),
            }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.9,
              delay: SCROLL_DELAY + RULE_1_DELAY + 0.25,
              ease: EASE_OUT,
            }}
          >
            <svg
              viewBox="-1.5 -1.5 77 57.5"
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              <path d={QUOTE_PATH} fill="none" stroke={ACCENT} strokeWidth="3" />
            </svg>
          </motion.div>

          <div
            className="font-bold"
            style={{
              position: "absolute",
              left: 0,
              top: p(435),
              width: p(719),
              color: "#fff",
              fontSize: p(23),
              lineHeight: `${p(32)}px`,
              letterSpacing: p(1.15),
            }}
          >
            {QUOTE_LINES.map((line, i) => (
              <SplitText
                key={line}
                text={line}
                once
                delay={SCROLL_DELAY + RULE_1_DELAY + 0.35 + i * SPLIT_TEXT_STAGGER}
                style={{ display: "block" }}
              />
            ))}
          </div>

          {FACT_DATA.map((f, i) => (
            <Fact
              key={f.num}
              p={p}
              y={FACT_ONE_Y + FACT_STEP * i}
              num={f.num}
              kicker={f.kicker}
              textW={f.textW}
              card={f.card}
              delay={i === 0 ? SCROLL_DELAY + RULE_2_DELAY : 0}
              inView={i > 0}
              logo={f.logo}
              button={f.button}
              photo={f.photo}
              text={f.text}
            />
          ))}

          <DrawnRule top={p(CONTACTS_Y)} width={p(COL_W)} delay={0} inView />
          <div
            className="font-bold"
            style={{
              position: "absolute",
              left: 0,
              top: p(CONTACTS_Y + CONTACTS_BLOCK.text),
              width: p(719),
              color: "#fff",
              fontSize: p(23),
              lineHeight: `${p(26.3)}px`,
              letterSpacing: p(1.15),
            }}
          >
            {CONTACTS_LINES.map((line, i) => (
              <SplitText
                key={line}
                text={line}
                once
                delay={0.2 + i * SPLIT_TEXT_STAGGER}
                style={{ display: "block" }}
              />
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              top: p(CONTACTS_Y),
              width: p(COL_W),
            }}
          >
            <ContactButton
              p={p}
              y={CONTACTS_BLOCK.mail}
              w={MAIL_BTN.w}
              hoverW={MAIL_BTN.hoverW}
              label="My mail"
              hoverLabel={MAIL_ADDRESS}
              rotate={45}
              envelope
              onClick={copyMail}
              delay={0.35}
            />
            {/* окошко с подтверждением — справа от раскрытой кнопки */}
            <AnimatePresence>
              {copied && (
                <motion.div
                  key="copied"
                  initial={{ opacity: 0, x: p(-16) }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: p(-16) }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                  className="font-normal"
                  style={{
                    position: "absolute",
                    left: p(MAIL_BTN.hoverW + COPIED_BOX.gap),
                    top: p(CONTACTS_BLOCK.mail),
                    width: p(COPIED_BOX.w),
                    height: p(LINK_BTN.h),
                    borderRadius: p(LINK_BTN.radius),
                    border: `1px solid ${ACCENT}`,
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: p(LINK_BTN.size),
                    lineHeight: `${p(LINK_BTN.lh)}px`,
                    letterSpacing: p(LINK_BTN.ls),
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Mail copied
                </motion.div>
              )}
            </AnimatePresence>

            <ContactButton
              p={p}
              y={CONTACTS_BLOCK.back}
              w={BACK_BTN.w}
              label="Back to main page"
              rotate={-90}
              onClick={() => go("/")}
              delay={0.45}
            />
          </div>

          <DrawnRule
            top={p(CONTACTS_Y + CONTACTS_BLOCK.rule)}
            width={p(COL_W)}
            delay={0}
            inView
          />
          <Reveal
            delay={0.2}
            inView
            className="font-normal"
            style={{
              position: "absolute",
              left: 0,
              top: p(CONTACTS_Y + CONTACTS_BLOCK.footer),
              color: "rgba(255,255,255,0.7)",
              fontSize: p(12),
              lineHeight: `${p(16)}px`,
              letterSpacing: p(1.68),
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            2026 &copy; MakS Novikov
          </Reveal>
        </div>
      </div>

      {/* плюсики — те же, что на главной: колонки 1, 2, 4 и ряды 1, 3.
          Слой идёт последним и выше колонки, иначе она перехватывает курсор */}
      <div className="pointer-events-none fixed inset-0 z-40">
        <HeroTitle delay={0.3} cols={[0, 1, 3]} rows={[0, 2]} fadeFirst={false} />
      </div>

      <SiteMenu />
    </main>
  );
}
