"use client";

import { isPhoneDevice } from "@/lib/device";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useInView,
  useScroll,
  useTransform,
} from "motion/react";
import { HeroTitle } from "@/components/HeroTitle";
import { HeroImage } from "@/components/HeroImage";

const ACCENT = "#B91372";
const INK = "#031828";
/* затемнение поверх видео, чтобы текст читался */
const VEIL =
  "linear-gradient(90deg, rgba(3,24,40,0.82) 0%, rgba(3,24,40,0.72) 45%, rgba(3,24,40,0.5) 100%)";
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─────────────────── привязка к сетке плюсиков ───────────────────────────
   Экран собран по макету 1920×1080 (Figma 1384:171), где левый край
   контента стоит на центре первой колонки плюсиков, а правый — на центре
   четвёртой. Сами плюсики рисует HeroTitle по своим px-константам, поэтому
   их центры считаем по той же формуле и от них задаём масштаб. */
const FIG = { c1: 302.5, c2: 747.5, c4: 1617.5, midY: 540 };
/** ширина контентной полосы по макету */
const COL_W = FIG.c4 - FIG.c1;

/* геометрия сетки HeroTitle: бокс min(1300, 100% - 24px), четыре колонки
   по 25px с justify-between, крайние сдвинуты на 20px */
const BOX_MAX = 1300;
/** колонка заголовка PORTFOLIO на первом экране */
const HERO_BOX = 1215;
/** весь контент экрана контактов чуть мельче макета */
const CONTENT_SCALE = 0.82;
/* бокс поджимается так, чтобы центр крайнего крестика не подходил к краю
   ближе, чем на 120 — то же охранное поле, что у контента hero */
const BOX_GUTTER_WIDE = 255;
const BOX_GUTTER_NARROW = 175;
const CROSS_W = 25;
const EDGE_SHIFT = 20;

/* Вертикальная «полезная» зона макета: от верха капители Let's work together
   до низа подвала. По ней экран подгоняется под невысокие окна, чтобы
   контент не обрезался. */
const CONTENT_TOP = 255;
const CONTENT_BOTTOM = 832;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
/** минимальный воздух сверху (под иконкой меню) и снизу */
const PAD_TOP = 110;
const PAD_BOTTOM = 40;

/* ───────────────────────────── разметка макета ────────────────────────────
   Все Y — верх текстового бокса из макета, межстрочное задано явно,
   поэтому блоки стоят ровно так же, как в Figma. */
const KICKER = { size: 12, lh: 16, ls: 1.68 };
const KICKER_Y = 255;
const KICKER_LINKS_Y = 702;
const TITLE = { y: 291, size: 85, lh: 85, ls: -1.7 };
const INTRO = { y: 452, w: 899, size: 23, lh: 32, ls: 1.15 };
const EMAIL = { y: 609, size: 42, lh: 52 };
const RULES = [431, 661];
const LINKS_Y = 731;
const LINK = {
  w: 247,
  h: 64,
  step: 267,
  radius: 4,
  arrow: 18,
  arrowX: 23,
  arrowY: 22,
  labelX: 61,
  labelY: 22,
  labelSize: 15,
  labelLh: 18,
  labelLs: 0.45,
};
const FOOTER_Y = 816;

const INTRO_LINES = [
  "No more scrolling, I promise.",
  "And if you are still here, we probably have something to talk about.",
  "Let\u2019s keep in touch!",
];

const EMAIL_ADDRESS = "sima.novikov@gmail.com";
/** подпись справа от адреса после копирования */
const COPIED_LABEL = "Email copied";
const COPIED = { x: 573, y: 627, ms: 3000 };

/** ссылки-кнопки: href пустой — кнопка пока не кликается */
const LINKS: { label: string; href: string; download?: boolean }[] = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/maks-now-draw/" },
  { label: "Behance", href: "https://www.behance.net/maksnovikov1" },
  { label: "Instagram", href: "https://www.instagram.com/maks_now_draw/" },
  {
    label: "Download my CV",
    href: "https://drive.google.com/file/d/1sr74mEryijgHXHisPvCAYlPAU2a_8Iuy/view?usp=sharing",
  },
];

/* ───────────────────────────── тайминги ────────────────────────────────── */
/* Экран подъезжает на треть медленнее страницы — зеркально HERO */
const SLOW_SVH = 50;
const RISE_VH = 7;
/** доля прокрутки, на которой экран уже полностью развёрнут */
const EXPAND_END = 0.9;

const RULE_DURATION = 1.6;
const REVEAL_DURATION = 1.6;
const HOVER_DURATION = 0.5;
const PLUS_DELAY = 0.15;
const BASE_DELAY = 0.2;

/** Алфавит для эффекта decrypted text — как на страницах проектов */
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

type Geometry = {
  left: number;
  span: number;
  k: number;
  h: number;
  /** узкий экран: сетка плюсиков не используется и не рисуется */
  tight: boolean;
};

/** Линейка во всю ширину полосы — прочерчивается слева направо */
function Rule({
  inView,
  delay,
  top,
}: {
  inView: boolean;
  delay: number;
  top: number;
}) {
  return (
    <motion.div
      aria-hidden
      className="w-full origin-left"
      style={{ marginTop: top, height: 1, background: "rgba(255,255,255,0.3)" }}
      initial={{ scaleX: 0 }}
      animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
      transition={{ duration: RULE_DURATION, delay, ease: EASE_OUT }}
    />
  );
}

/** Стрелка ↗ из макета */
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

export default function ContactsSection() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.5 });

  /* анимация HERO-баннера, проигранная в обратную сторону:
     экран подъезжает уменьшенным и со скруглением, а разворачивается
     на всю ширину, когда встаёт в верх окна */
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start end", "end end"],
  });
  /* Разворачивание заканчиваем с запасом по прокрутке: если довести его
     ровно до единицы, финальное состояние достижимо только в самой крайней
     точке скролла. На телефоне до неё часто не доезжают — мешает резинка и
     адресная строка, — и экран остаётся чуть уменьшенным, с полями по бокам. */
  const scale = useTransform(scrollYProgress, [0, EXPAND_END], [0.48, 1], {
    clamp: true,
  });
  const y = useTransform(
    scrollYProgress,
    [0, EXPAND_END],
    [`${RISE_VH - SLOW_SVH}svh`, "0vh"],
    { clamp: true },
  );
  const borderRadius = useTransform(
    scrollYProgress,
    [0, EXPAND_END],
    ["28px", "0px"],
    { clamp: true },
  );

  const [mailHover, setMailHover] = useState(false);
  const mail = useDecrypt(EMAIL_ADDRESS, mailHover);
  const [copied, setCopied] = useState(false);
  const copiedLabel = useDecrypt(COPIED_LABEL, copied);

  /* клик по адресу кладёт его в буфер и показывает подпись на три секунды */
  const copyMail = useCallback(() => {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = EMAIL_ADDRESS;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        /* буфер недоступен — подпись всё равно покажем */
      }
      document.body.removeChild(area);
    };
    const done = () => setCopied(true);
    navigator.clipboard?.writeText(EMAIL_ADDRESS).then(done, () => {
      fallback();
      done();
    }) ?? (fallback(), done());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED.ms);
    return () => window.clearTimeout(t);
  }, [copied]);
  const [geo, setGeo] = useState<Geometry>({
    left: FIG.c1,
    span: COL_W,
    k: 1,
    h: 1080,
    tight: false,
  });
  const stackRef = useRef<HTMLDivElement>(null);
  const [stackH, setStackH] = useState(CONTENT_H);

  const measure = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    /* размеры берём из layout: секция в этот момент может быть ещё
       уменьшена анимацией, и getBoundingClientRect вернул бы масштаб */
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W) return;
    /* контент равняется по заголовку PORTFOLIO на первом экране:
       та же колонка mx-auto min(1215, 100% - поля) со сдвигом 5 px */
    const heroBox = Math.min(
      HERO_BOX,
      W - (W >= 1024 ? 240 : W >= 768 ? 96 : 40),
    );
    const heroLeft = (W - heroBox) / 2 + 5;
    /* кегли фиксированы: при сужении окна ужимается контентная полоса,
       а масштаб уходит вниз только в низком окне, чтобы экран не обрезался */
    const kFit = (H - PAD_TOP - PAD_BOTTOM) / CONTENT_H;
    /* на узком экране колонка просто встаёт по охранным полям окна */
    const tight = isPhoneDevice() || W < 900;
    /* то же охранное поле, что у текста в кадре персонажа */
    const pad = Math.min(60, 17.74 + 0.0564 * W);
    setGeo({
      left: tight ? pad : heroLeft,
      span: tight ? W - 2 * pad : heroBox,
      k: Math.min(1, kFit) * CONTENT_SCALE,
      h: H,
      tight,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [measure]);

  /* высота стопки меняется, когда текст переносится — следим за ней,
     чтобы блок не выезжал за нижнюю кромку экрана */
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStackH(el.offsetHeight));
    ro.observe(el);
    setStackH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const { k } = geo;
  const p = (v: number) => v * k;
  /* на телефоне кнопки-ссылки крупнее остального контента */
  const pBig = (v: number) => v * k * 1.32;
  /** x макета → отступ внутри контентной полосы */
  const fx = (v: number) => p(v - FIG.c1);
  /* на узком экране ряд кнопок поджимается, чтобы остаться в полосе */
  const linkStep = Math.min(LINK.step, (geo.span - p(LINK.w)) / 3);
  /* кадр центрируется по окну, как на HERO, но не даёт контенту вылезти
     за края невысокого окна */
  /* в низком окне стопка не помещается целиком — тогда ужимаем её
     целиком трансформом: layout от этого не меняется, поэтому нет
     перерасчёта по кругу */
  const avail = geo.h - PAD_TOP - PAD_BOTTOM;
  const fit = stackH > avail && stackH > 0 ? Math.max(0.42, avail / stackH) : 1;
  /* стопка центрируется по окну и не вылезает за нижнее поле */
  const sceneTop = Math.max(
    PAD_TOP,
    Math.min((geo.h - stackH * fit) / 2, geo.h - PAD_BOTTOM - stackH * fit),
  );

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 22, filter: "blur(8px)" },
    animate: inView
      ? { opacity: 1, y: 0, filter: "blur(0px)" }
      : { opacity: 0, y: 22, filter: "blur(8px)" },
    transition: { duration: REVEAL_DURATION, delay, ease: EASE_OUT },
  });

  const kickerStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontSize: p(KICKER.size),
    lineHeight: `${p(KICKER.lh)}px`,
    letterSpacing: p(KICKER.ls),
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={wrapRef} className="relative z-10 h-[150svh] min-h-0 md:min-h-[900px]">
        <motion.section
          ref={sectionRef}
          style={{ scale, y, borderRadius, background: INK }}
          className="absolute bottom-0 left-0 h-[100svh] min-h-0 w-full overflow-clip will-change-transform md:min-h-[600px]"
          aria-label="Contacts"
        >
          {/* фоновое видео со стеклянными панелями справа — как на HERO */}
          <HeroImage
            src="/contacts/back.webp"
            video={["/contacts/back.webm", "/contacts/back.mp4"]}
            className="absolute inset-0 z-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: VEIL }}
          />

          {/* контентная полоса: от центра первой колонки плюсиков до
              четвёртой. Внутри — вертикальный автолэйаут: отступы взяты
              из макета, поэтому на 1920 всё стоит ровно как в Figma, а на
              узких экранах блоки переносятся, а не наезжают друг на друга */}
          <div
            ref={stackRef}
            className="absolute z-10 flex flex-col items-start"
            style={{
              left: geo.left,
              top: sceneTop,
              width: geo.span,
              paddingBottom: p(44),
              transform: fit < 1 ? `scale(${fit})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {/* Let's work together */}
            <motion.div
              className="font-normal"
              style={kickerStyle}
              {...reveal(BASE_DELAY)}
            >
              Let&rsquo;s work together
            </motion.div>

            {/* CONTACTS */}
            <motion.h2
              className="font-bold text-white"
              style={{
                marginTop: p(20),
                fontSize: `min(${p(TITLE.size)}px, 18cqw)`,
                lineHeight: 1,
                letterSpacing: p(TITLE.ls),
                whiteSpace: "nowrap",
              }}
              initial={{ opacity: 0, y: 70, filter: "blur(14px)" }}
              animate={
                inView
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: 70, filter: "blur(14px)" }
              }
              transition={{ duration: 1.2, delay: BASE_DELAY + 0.1, ease: EASE_OUT }}
            >
              CONTACTS
            </motion.h2>

            <Rule inView={inView} delay={BASE_DELAY + 0.3} top={p(55)} />

            {/* No more scrolling, I promise. */}
            <motion.div
              className="font-bold text-white"
              style={{
                marginTop: p(20),
                width: `min(${p(INTRO.w)}px, 100%)`,
                fontSize: p(INTRO.size),
                lineHeight: `${p(INTRO.lh)}px`,
                letterSpacing: p(INTRO.ls),
              }}
              {...reveal(BASE_DELAY + 0.45)}
            >
              {INTRO_LINES.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </motion.div>

            {/* почта: при наведении расшифровывается, как кнопки на
                страницах проектов */}
            <motion.div
              className="flex w-full flex-wrap items-baseline"
              style={{ marginTop: p(61), columnGap: p(40), rowGap: p(8) }}
              {...reveal(BASE_DELAY + 0.6)}
            >
              <a
                href={`mailto:${EMAIL_ADDRESS}`}
                className="font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  copyMail();
                }}
                onPointerEnter={(e) =>
                  e.pointerType === "mouse" && setMailHover(true)
                }
                onPointerLeave={(e) =>
                  e.pointerType === "mouse" && setMailHover(false)
                }
                style={{
                  display: "inline-block",
                  color: ACCENT,
                  /* адрес ужимается, когда полоса становится уже него */
                  fontSize: `min(${p(EMAIL.size)}px, ${(geo.span / 13.2).toFixed(2)}px)`,
                  lineHeight: `${p(EMAIL.lh)}px`,
                  textDecoration: "none",
                  whiteSpace: "pre",
                }}
              >
                {mail}
              </a>

              {/* подпись «email copied» справа от адреса */}
              <AnimatePresence>
                {copied && (
                  <motion.span
                    key="copied"
                    className="font-normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: p(KICKER.size),
                      lineHeight: `${p(KICKER.lh)}px`,
                      letterSpacing: p(KICKER.ls),
                      textTransform: "uppercase",
                      whiteSpace: "pre",
                    }}
                  >
                    {copiedLabel}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <Rule inView={inView} delay={BASE_DELAY + 0.42} top={0} />

            {/* Find me here */}
            <motion.div
              className="font-normal"
              style={{ marginTop: p(41), ...kickerStyle }}
              {...reveal(BASE_DELAY + 0.7)}
            >
              Find me here
            </motion.div>

            {/* кнопки-ссылки: ряд переносится, когда полосы не хватает */}
            <div
              className="flex w-full flex-wrap"
              style={{ marginTop: p(13), gap: p(20) }}
            >
              {LINKS.map((link, i) => (
                <motion.div key={link.label} {...reveal(BASE_DELAY + 0.8 + i * 0.08)}>
                  <LinkButton link={link} p={geo.tight ? pBig : p} />
                </motion.div>
              ))}
            </div>

            {/* подвал */}
            <motion.div
              className="font-normal"
              style={{
                marginTop: p(21),
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
                fontSize: p(KICKER.size),
                lineHeight: `${p(KICKER.lh)}px`,
                letterSpacing: p(KICKER.ls),
                textTransform: "uppercase",
              }}
              {...reveal(BASE_DELAY + 1.1)}
            >
              2026 &copy; MakS Novikov
            </motion.div>
          </div>

          {/* плюсики — те же, что на HERO-баннере: все четыре колонки,
              ряды 1 и 3; собираются, когда экран заезжает в окно */}
          {inView && !geo.tight && (
            <HeroTitle delay={PLUS_DELAY} rows={[0, 2]} fadeFirst={false} />
          )}
        </motion.section>
      </div>
    </MotionConfig>
  );
}

type LinkButtonProps = {
  link: { label: string; href: string; download?: boolean };
  p: (v: number) => number;
};

function LinkButton({ link, p }: LinkButtonProps) {
  const [hover, setHover] = useState(false);
  const live = !!link.href;

  const content = (
    <>
      <motion.div
        style={{
          position: "absolute",
          left: p(LINK.arrowX),
          top: p(LINK.arrowY),
        }}
        animate={{ rotate: hover ? 45 : 0 }}
        transition={{ duration: HOVER_DURATION, ease: EASE_OUT }}
      >
        <CornerArrow size={p(LINK.arrow)} color={hover ? "#fff" : ACCENT} />
      </motion.div>
      <span
        className="absolute font-normal text-white"
        style={{
          left: p(LINK.labelX),
          top: p(LINK.labelY),
          fontSize: p(LINK.labelSize),
          lineHeight: `${p(LINK.labelLh)}px`,
          letterSpacing: p(LINK.labelLs),
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {link.label}
      </span>
    </>
  );

  const style: React.CSSProperties = {
    position: "relative",
    display: "block",
    width: p(LINK.w),
    height: p(LINK.h),
    borderRadius: p(LINK.radius),
    border: `1px solid ${ACCENT}`,
    background: hover ? ACCENT : "rgba(255,255,255,0.04)",
    transition: `background-color ${HOVER_DURATION}s cubic-bezier(0.16,1,0.3,1)`,
    textDecoration: "none",
    cursor: live ? "pointer" : "default",
  };

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) =>
      e.pointerType === "mouse" && setHover(true),
    onPointerLeave: (e: React.PointerEvent) =>
      e.pointerType === "mouse" && setHover(false),
  };

  return live ? (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      download={link.download || undefined}
      style={style}
      {...handlers}
    >
      {content}
    </a>
  ) : (
    <div style={style} {...handlers}>
      {content}
    </div>
  );
}
