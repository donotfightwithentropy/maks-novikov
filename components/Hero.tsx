"use client";

import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig, useScroll, useTransform } from "motion/react";
import { HeroImage } from "./HeroImage";
import { HeroTitle } from "./HeroTitle";
import { WordReveal } from "./WordReveal";
import { scrollToAnchor } from "./SiteMenu";

const ROLES = [
  "Graphic design",
  "Communication design",
  "3d modelling",
  "Branding",
];
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/* Экран уезжает на треть медленнее страницы: контейнер на 150svh, а секция
   по ходу прокрутки сдвигается вниз на лишние 50svh — так вся анимация
   растянута в полтора раза, а траектория остаётся прежней. */
const SLOW_SVH = 50;
/** подъём кадра в конце анимации (как было) */
const RISE_VH = 7;
/** задержка появления заголовка PORTFOLIO (от неё считаются и бегущие роли) */
const TITLE_DELAY = 2.5;
const ACCENT = "#B91372";
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Кнопки в правом нижнем углу (макет 1920×1080): правый край — там же, где
   у блока иконок справа сверху, нижний — по базовой линии PORTFOLIO. */
const LINKS: {
  label: string;
  w: number;
  /** куда доворачивается стрелка при наведении, град */
  rotate: number;
  href?: string;
  anchor?: string;
}[] = [
  {
    label: "My CV",
    w: 111,
    rotate: 45,
    href: "https://drive.google.com/file/d/1sr74mEryijgHXHisPvCAYlPAU2a_8Iuy/view?usp=sharing",
  },
  { label: "Projects", w: 143, rotate: 135, anchor: "#projects" },
  { label: "Contacts", w: 146, rotate: 135, anchor: "#contacts" },
];
const LINK_BTN = { h: 34, radius: 6, padX: 15, gap: 15, icon: 13, size: 15, ls: 0.45 };

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // при скролле секция уезжает вверх, сжимается и округляет углы
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.48]);
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    ["0vh", `${SLOW_SVH - RISE_VH}svh`],
  );
  const borderRadius = useTransform(scrollYProgress, [0, 1], ["0px", "28px"]);
  const arrowOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={sectionRef}
        className="relative h-[150svh] min-h-[900px]"
      >
        <motion.section
          style={{ scale, y, borderRadius }}
          className="relative h-[100svh] min-h-[600px] overflow-clip will-change-transform"
          aria-label="Intro"
        >
          <motion.div
            className="absolute inset-0 z-0 lg:bottom-auto lg:aspect-[1.79965]"
            initial={{ opacity: 0, scale: 1.6, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 1.9, ease: EASE_OUT }}
          >
            <HeroImage
              src="/hero.jpg"
              mobileSrc="/hero-mobile.jpg"
              focus={[0.5, 0.5]}
              mobileFocus={[0.5, 0.3]}
              className="absolute inset-0"
            />
            {/* на мобиле картинка растворяется в фоне сверху и снизу */}
            {/* снизу картинка растворяется в фоне; сверху — во всю кромку */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-45% to-ink lg:hidden" />
          </motion.div>

          <HeroTitle delay={0.3} />

          {/* на телефоне и планшете приветствие уходит под иконку меню,
              на широких экранах встаёт на место из макета */}
          <div className="pointer-events-none absolute inset-x-0 top-[104px] z-20 lg:top-12 xl:top-[59px]">
            <div className="mx-auto flex w-[min(1215px,calc(100%-2*var(--gutter-mobile)))] flex-col gap-7 md:w-[min(1215px,calc(100%-96px))] md:flex-row lg:w-[min(1215px,calc(100%-240px))] md:items-start md:justify-between">
              <div className="flex flex-col gap-[9px] lg:translate-x-[5px]">
                <WordReveal
                  as="p"
                  text="HI"
                  delay={0.2}
                  className="-mt-[0.158em] leading-none font-medium text-[min(52px,7.71vw)]"
                />
                <WordReveal
                  as="p"
                  text={"My name is Maks, I’m a designer,"}
                  delay={0.3}
                  className="leading-[1.3] font-normal text-[min(22.93px,3.4vw)]"
                />
                <WordReveal
                  as="p"
                  text="and you are welcome to see my"
                  delay={0.5}
                  className="leading-[1.3] font-normal text-[min(22.93px,3.4vw)]"
                />
              </div>
              <div className="hidden w-[240px] -translate-x-[7px] flex-col items-end [--iw:87%] md:flex md:w-[270px] xl:w-[325px]">
                <motion.div
                  className="flex w-[var(--iw)] items-start justify-end"
                  initial={{ opacity: 0, x: 200 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 2.3,
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                  }}
                >
                  <img
                    src="/icons.svg"
                    alt="Adobe Creative Cloud, Photoshop, Figma, Blender, Framer"
                    className="block w-full"
                  />
                </motion.div>
                <motion.div
                  className="mt-[var(--gap)] h-[2px] w-[var(--iw)] [--gap:12px] xl:[--gap:14px]"
                  initial={{ opacity: 0, x: 250 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.35, duration: 1.1, ease: EASE_OUT }}
                  aria-hidden
                >
                  <div className="h-[2px] w-full bg-white" />
                </motion.div>
                <RolesTicker delay={TITLE_DELAY} />
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[100px] z-20 md:bottom-[144px] xl:bottom-[204px]">
            <motion.h1
              className="mx-auto w-[min(1215px,calc(100%-2*var(--gutter-mobile)))] leading-none lg:translate-x-[5px] font-bold tracking-[-0.02em] whitespace-nowrap md:w-[min(1215px,calc(100%-96px))] lg:w-[min(1215px,calc(100%-240px))]"
              style={{ fontSize: "min(85px, 12.6vw)" }}
              initial={{ opacity: 0, y: 70, filter: "blur(14px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: TITLE_DELAY, duration: 1.2, ease: EASE_OUT }}
            >
              PORTFOLIO
            </motion.h1>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[209px] z-20 hidden lg:block">
            <div className="mx-auto flex w-[min(1215px,calc(100%-240px))] justify-end">
              <div className="-translate-x-[7px] flex flex-col items-end" style={{ gap: 15 }}>
                {LINKS.map((link, i) => (
                  <HeroLink key={link.label} link={link} delay={TITLE_DELAY + 0.25 + i * 0.1} />
                ))}
              </div>
            </div>
          </div>

          <motion.div
            style={{ opacity: arrowOpacity }}
            className="absolute inset-x-0 bottom-4 z-20 flex justify-center md:bottom-7"
          >
            <motion.button
              type="button"
              aria-label="Scroll down"
              onClick={() =>
                document
                  .getElementById("portfolio")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-full p-3 text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: TITLE_DELAY + 1.4,
                duration: 0.9,
                ease: EASE_OUT,
              }}
            >
              <svg
                width="40"
                height="14"
                viewBox="0 0 40 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2 2 20 12 38 2" />
              </svg>
            </motion.button>
          </motion.div>
        </motion.section>
      </div>
    </MotionConfig>
  );
}

/** Уголок-стрелка ↗ из макета */
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

type HeroLinkProps = {
  link: (typeof LINKS)[number];
  delay: number;
};

/** Кнопка под заголовком: при наведении заливается маджентой,
    стрелка доворачивается (у CV — вправо, у остальных — вниз) */
function HeroLink({ link, delay }: HeroLinkProps) {
  const [hover, setHover] = useState(false);
  const ink = hover ? "#fff" : ACCENT;

  const content = (
    <>
      <span
        style={{
          display: "block",
          transform: `rotate(${hover ? link.rotate : 0}deg)`,
          transition: `transform 480ms ${EASE}`,
        }}
      >
        <CornerArrow size={LINK_BTN.icon} color={ink} />
      </span>
      <span
        className="uppercase"
        style={{
          color: "#fff",
          fontSize: LINK_BTN.size,
          letterSpacing: LINK_BTN.ls,
          lineHeight: 1,
          fontWeight: 400,
          whiteSpace: "nowrap",
        }}
      >
        {link.label}
      </span>
    </>
  );

  const style: React.CSSProperties = {
    width: link.w,
    height: LINK_BTN.h,
    gap: LINK_BTN.gap,
    padding: `0 0 0 ${LINK_BTN.padX}px`,
    borderRadius: LINK_BTN.radius,
    border: `1px solid ${ACCENT}`,
    backgroundColor: hover ? ACCENT : "rgba(255,255,255,0.04)",
    overflow: "hidden",
    cursor: "pointer",
    textDecoration: "none",
    transition: `background-color 420ms ${EASE}`,
  };

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) =>
      e.pointerType === "mouse" && setHover(true),
    onPointerLeave: (e: React.PointerEvent) =>
      e.pointerType === "mouse" && setHover(false),
  };

  return (
    <motion.div
      className="pointer-events-auto"
      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay, duration: 1, ease: EASE_OUT }}
    >
      {link.href ? (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center"
          style={style}
          {...handlers}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          className="flex items-center"
          style={style}
          onClick={() => link.anchor && scrollToAnchor(link.anchor, "smooth")}
          {...handlers}
        >
          {content}
        </button>
      )}
    </motion.div>
  );
}

type RolesTickerProps = {
  delay: number;
};

/**
 * Бегущий список ролей. В конец списка добавлен дубль первого элемента,
 * чтобы прокрутка выглядела бесконечной: доехав до дубля, список
 * мгновенно (duration: 0) возвращается в начало.
 */
function RolesTicker({ delay }: RolesTickerProps) {
  const items = [...ROLES, ROLES[0]];
  const lastIndex = items.length - 1;
  const [index, setIndex] = useState(0);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const advance = () => {
      setInstant(false);
      setIndex((prev) => (prev >= lastIndex ? 1 : prev + 1));
    };
    const timeout = setTimeout(
      () => {
        advance();
        interval = setInterval(advance, 2300);
      },
      delay * 1e3 + 1200,
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [delay, lastIndex]);

  return (
    <motion.div
      className="mt-[calc(var(--gap)-0.31em)] xl:mt-[calc(var(--gap)-0.12em)] h-[1.3em] overflow-hidden text-right text-[14px] font-light tracking-[0.01em] [--gap:12px] md:text-[15px] xl:text-[16px] xl:[--gap:14px]"
      initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay, duration: 1, ease: EASE_OUT }}
      aria-live="off"
    >
      <motion.ul
        animate={{ y: `-${(index * 100) / items.length}%` }}
        transition={
          instant
            ? { duration: 0 }
            : { duration: 0.5, ease: [0.65, 0, 0.35, 1] }
        }
        onAnimationComplete={() => {
          if (index === lastIndex) {
            setInstant(true);
            setIndex(0);
          }
        }}
      >
        {items.map((role, i) => (
          <li
            key={i}
            className="h-[1.3em] leading-[1.3]"
            aria-hidden={i === lastIndex}
          >
            {role}
          </li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

export default Hero;
