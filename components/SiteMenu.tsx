"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useTransitionNav } from "./PageTransition";

const ACCENT = "#B91372";

/* Угловые иконки (меню и «наверх») держат натуральный размер на больших
   экранах и плавно уменьшаются на маленьких, не опускаясь ниже 3/4 */
const UI_FULL_W = 1640;
const UI_MIN = 0.75;

function useUiScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () =>
      setScale(Math.min(1, Math.max(UI_MIN, window.innerWidth / UI_FULL_W)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return scale;
}

/** Цвета выезжающих слоёв (последний — фон под панелью) */
const LAYER_COLORS = [ACCENT, "#0C3A57"];

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "#top" },
  { label: "About me", href: "/about" },
  { label: "Work experience", href: "#work" },
  { label: "Projects", href: "#projects" },
  { label: "Contacts", href: "#contacts" },
];

/** Доля прокрутки внутри секции #portfolio, на которой живёт блок Work experience */
const WORK_SCROLL_RATIO = 235 / 300;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];

/** Ширина панели: привязана к сетке макета (отступ колонки + шаг плиток) */
const PANEL_WIDTH =
  "min(850px, 100%, calc(max((100vw - 1215px) / 2, 120px) + 5px + 5.653 * min(85px, 12.6vw) + 14px))";

const NAV_FONT_SIZE = "max(26px, 2.708cqw)";
const NAV_LETTER_SPACING = "max(1.3px, 0.137cqw)";

/** Тайминги: слои идут друг за другом, панель — после них */
const LAYER_STAGGER = 0.22;
const LAYER_DURATION = 0.6;
const PANEL_DURATION = 0.85;
const PANEL_DELAY = (LAYER_COLORS.length - 1) * LAYER_STAGGER + 0.18;
const NAV_DELAY = PANEL_DELAY + PANEL_DURATION * 0.15;

/** Слои чуть шире панели, чтобы выглядывать из-под неё */
const LAYER_WIDTH = `calc(${PANEL_WIDTH} + 28px)`;

/** Куда доскроллить главную после возврата с отдельной страницы */
export const MENU_TARGET_KEY = "maks:menu-target";

const absoluteTop = (el: HTMLElement) =>
  el.getBoundingClientRect().top + window.scrollY;

/** Плавный подъём наверх: своя анимация, у браузерного smooth на длинной
    странице прокрутка тянется бесконечно */
function smoothScrollToTop(duration = 1200) {
  const start = window.scrollY;
  if (start === 0) return;
  const t0 = performance.now();
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start * (1 - ease(t)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Позиция секции по якорю из меню; null — секции ещё нет в разметке */
export function anchorY(href: string): number | null {
  if (href === "#top") return 0;
  if (href === "#work") {
    // Work experience — внутри длинной pinned-секции #portfolio
    const section = document.getElementById("portfolio");
    if (!section) return null;
    const scrollable = section.offsetHeight - window.innerHeight;
    return absoluteTop(section) + scrollable * WORK_SCROLL_RATIO;
  }
  if (href === "#projects") {
    const anchor = document.getElementById("projects-anchor");
    if (!anchor) return null;
    return absoluteTop(anchor) - window.innerHeight * 0.3;
  }
  if (href === "#contacts") return document.body.scrollHeight;
  const el = document.querySelector(href) as HTMLElement | null;
  return el ? absoluteTop(el) : null;
}

/** Прокрутка главной к секции по якорю из меню */
export function scrollToAnchor(href: string, behavior: ScrollBehavior) {
  const y = anchorY(href);
  if (y === null) return false;
  window.scrollTo({ top: Math.max(0, y), behavior });
  return true;
}

type CursorPos = { x: number; y: number };

export default function SiteMenu() {
  const uiScale = useUiScale();
  const [open, setOpen] = useState(false);
  const [burgerHovered, setBurgerHovered] = useState(false);
  const [cursor, setCursor] = useState<CursorPos | null>(null);
  /** курсор-кружок «UP» у кнопки возврата наверх */
  const [upCursor, setUpCursor] = useState<CursorPos | null>(null);
  const [upHovered, setUpHovered] = useState(false);
  /** после клика кружок не показываем, пока курсор не уйдёт с кнопки */
  const upClickedRef = useRef(false);
  /** кнопка «наверх» показывается, только когда виден экран контактов */
  const [atContacts, setAtContacts] = useState(false);
  const { go } = useTransitionNav();
  const pathname = usePathname();

  /* следим за экраном контактов: он есть только на главной */
  useEffect(() => {
    const section = document.querySelector('section[aria-label="Contacts"]');
    if (!section) {
      setAtContacts(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setAtContacts(entry.intersectionRatio > 0.55),
      { threshold: [0, 0.55, 1] },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [pathname]);

  // Пока меню открыто — блокируем скролл страницы и слушаем Escape
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    /* отдельная страница — уходим на неё тем же занавесом, что и проекты */
    if (href.startsWith("/")) {
      if (pathname !== href) go(href);
      return;
    }
    /* якоря живут на главной: если мы не на ней — возвращаемся и
       доезжаем до нужной секции уже там */
    if (pathname !== "/") {
      try {
        sessionStorage.setItem(MENU_TARGET_KEY, href);
      } catch {}
      go("/", "back");
      return;
    }
    scrollToAnchor(href, "smooth");
  };

  /* приехали на главную по пункту меню с другой страницы — доводим до секции.
     Повторяем несколько раз: контент дособирается и высота страницы меняется */
  useEffect(() => {
    if (pathname !== "/") return;
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(MENU_TARGET_KEY);
      if (target) sessionStorage.removeItem(MENU_TARGET_KEY);
    } catch {}
    if (!target) return;
    const href = target;
    /* секции главной появляются не сразу (шейдеры, 3D, картинки), поэтому
       ждём, пока нужный блок окажется в разметке, и ещё немного доводим
       позицию — высота страницы по дороге меняется */
    let hits = 0;
    const timer = window.setInterval(() => {
      if (scrollToAnchor(href, "auto")) hits += 1;
      if (hits >= 10) window.clearInterval(timer);
    }, 120);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8e3);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [pathname]);

  return (
    <>
      {/* На телефоне под иконкой меню лежит полоса с размытием того,
          что под ней прокручивается */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[88px] md:hidden"
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0) 100%)",
        }}
      />

      <motion.button
        type="button"
        aria-label="Open menu"
        initial={{ x: -600 }}
        animate={{ x: 0 }}
        transition={{ delay: 2.3, type: "spring", stiffness: 120, damping: 18 }}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setBurgerHovered(true);
            setCursor({ x: event.clientX, y: event.clientY });
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse")
            setCursor({ x: event.clientX, y: event.clientY });
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setBurgerHovered(false);
            setCursor(null);
          }
        }}
        className="fixed top-8 left-[var(--gutter-mobile)] z-[90] h-8 w-[60px] md:top-12 md:left-[50px] xl:top-[59px]"
        style={{ cursor: "none", scale: uiScale, transformOrigin: "top left" }}
      >
        <span className="relative block h-8 w-[60px]">
          <motion.span
            className="absolute left-0 block h-1 w-[60px]"
            style={{ top: 0, background: ACCENT }}
            animate={{ y: burgerHovered ? 5 : 0 }}
            transition={{ duration: burgerHovered ? 0.5 : 0.4, ease: EASE_OUT }}
          />
          {/* Средняя полоска на ховере улетает влево за экран */}
          <motion.span
            className="absolute left-0 block h-1 w-[60px]"
            style={{ top: 14, background: ACCENT }}
            animate={burgerHovered ? { x: [0, 10, -900] } : { x: 0 }}
            transition={
              burgerHovered
                ? {
                    duration: 0.62,
                    times: [0, 0.4, 1],
                    ease: ["easeOut", "easeIn"],
                  }
                : { duration: 0.42, ease: EASE_OUT }
            }
          />
          <motion.span
            className="absolute left-0 block h-1 w-[60px]"
            style={{ top: 28, background: ACCENT }}
            animate={{ y: burgerHovered ? -5 : 0 }}
            transition={{ duration: burgerHovered ? 0.5 : 0.4, ease: EASE_OUT }}
          />
        </span>
      </motion.button>

      {/* Кнопка «наверх»: появляется на экране контактов, слева внизу,
          по той же линии, что иконка меню */}
      <AnimatePresence>
        {atContacts && !open && (
          <motion.button
            key="up"
            type="button"
            aria-label="Back to top"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            onClick={() => {
              // курсор-кружок гасим сразу и не возвращаем, пока мышь не уйдёт
              upClickedRef.current = true;
              setUpCursor(null);
              setUpHovered(false);
              smoothScrollToTop();
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse" && !upClickedRef.current) {
                setUpHovered(true);
                setUpCursor({ x: event.clientX, y: event.clientY });
              }
            }}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse" && !upClickedRef.current)
                setUpCursor({ x: event.clientX, y: event.clientY });
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                upClickedRef.current = false;
                setUpHovered(false);
                setUpCursor(null);
              }
            }}
            className="fixed bottom-8 left-5 z-[90] hidden h-[43px] w-[60px] md:bottom-12 md:left-[50px] md:block xl:bottom-[59px]"
            style={{ cursor: "none", scale: uiScale, transformOrigin: "bottom left" }}
          >
            <svg
              viewBox="0 0 60 43"
              aria-hidden
              className="block h-full w-full"
              fill="none"
              // шеврон уезжает вверх за пределы вьюбокса — не обрезаем его
              style={{ overflow: "visible" }}
            >
              <motion.path
                d="M2 24 L30 2 L58 24"
                stroke={ACCENT}
                strokeWidth="4"
                strokeLinecap="square"
                animate={{ y: upHovered ? -6 : 0 }}
                transition={{ duration: upHovered ? 0.5 : 0.4, ease: EASE_OUT }}
              />
              <motion.rect
                x="0"
                y="39"
                width="60"
                height="4"
                fill={ACCENT}
                animate={{ opacity: upHovered ? 0 : 1, y: upHovered ? 10 : 0 }}
                transition={{ duration: upHovered ? 0.5 : 0.4, ease: EASE_OUT }}
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Круглый курсор «UP» над кнопкой возврата */}
      {upCursor &&
        atContacts &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: upCursor.x,
              top: upCursor.y,
              width: 74,
              height: 74,
              marginLeft: -37,
              marginTop: -37,
              borderRadius: "50%",
              background: ACCENT,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.14em",
              pointerEvents: "none",
              zIndex: 120,
            }}
          >
            UP
          </div>,
          document.body,
        )}

      {/* Кастомный круглый курсор поверх всего — рисуем в body через портал */}
      {cursor &&
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

      <AnimatePresence>
        {open && (
          <div className="@container fixed inset-0 z-[100]">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.35 } }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              onClick={() => setOpen(false)}
            />
            {LAYER_COLORS.map((color, index) => (
              <motion.div
                key={color}
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{ background: color, width: LAYER_WIDTH }}
                initial={{ x: "-100%" }}
                animate={{
                  x: 0,
                  transition: {
                    duration: LAYER_DURATION,
                    ease: EASE_OUT,
                    delay: index * LAYER_STAGGER,
                  },
                }}
                exit={{ x: "-100%", transition: { duration: 0.32, ease: EASE_IN } }}
              />
            ))}
            <motion.aside
              className="absolute inset-y-0 left-0 flex flex-col justify-between overflow-y-auto bg-[#07273C] px-10 pt-24 pb-14 md:px-16"
              style={{ width: PANEL_WIDTH }}
              initial={{ x: "-100%" }}
              animate={{
                x: 0,
                transition: {
                  duration: PANEL_DURATION,
                  ease: EASE_OUT,
                  delay: PANEL_DELAY,
                },
              }}
              exit={{ x: "-100%", transition: { duration: 0.32, ease: EASE_IN } }}
              aria-label="Site menu"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute top-10 right-10 text-white/70 transition-colors hover:text-white md:right-16"
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 26 26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M3 3L23 23M23 3L3 23" />
                </svg>
              </button>

              <nav>
                <ul className="m-0 list-none p-0">
                  {NAV_ITEMS.map((item, index) => (
                    <li key={item.label} className="overflow-hidden py-1">
                      <motion.button
                        type="button"
                        onClick={() => navigate(item.href)}
                        className="group flex items-baseline gap-4 text-left"
                        initial={{ y: "140%", rotate: 10 }}
                        animate={{
                          y: 0,
                          rotate: 0,
                          transition: {
                            duration: 1,
                            ease: EASE_OUT,
                            delay: NAV_DELAY + index * 0.1,
                          },
                        }}
                      >
                        <motion.span
                          className="font-semibold"
                          style={{
                            color: ACCENT,
                            fontSize: "clamp(12px,1.1vw,16px)",
                          }}
                          initial={{ opacity: 0 }}
                          animate={{
                            opacity: 1,
                            transition: {
                              duration: 0.6,
                              delay: NAV_DELAY + 0.1 + index * 0.08,
                            },
                          }}
                        >
                          {"0"}
                          {index + 1}
                        </motion.span>
                        <span
                          className="font-semibold text-white transition-colors duration-300 group-hover:text-[#B91372]"
                          style={{
                            fontSize: NAV_FONT_SIZE,
                            letterSpacing: NAV_LETTER_SPACING,
                            lineHeight: 1.15,
                          }}
                        >
                          {item.label}
                        </span>
                      </motion.button>
                    </li>
                  ))}
                </ul>
              </nav>

            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
