"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { HOME_Y_KEY } from "@/components/HomeScrollRestore";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];

/** Слои занавеса при открытии проекта и при возврате назад. */
const OPEN_LAYERS = ["#B91372", "#0C3A57"];
const BACK_LAYERS = ["#0C3A57"];

const LAYER_DURATION = 0.6;
const LAYER_STAGGER = 0.22;

/** Полная длительность занавеса из N слоёв, в миллисекундах. */
const totalDuration = (layerCount: number) =>
  ((layerCount - 1) * LAYER_STAGGER + LAYER_DURATION) * 1e3;

type TransitionMode = "idle" | "cover" | "uncover";
type TransitionFrom = "left" | "right";

type OverlayProps = {
  mode: TransitionMode;
  layers: string[];
  from: TransitionFrom;
  onDone?: () => void;
};

/** Оверлей со «шторками», которые заезжают (cover) и уезжают (uncover). */
function TransitionOverlay({ mode, layers, from, onDone }: OverlayProps) {
  const duration = totalDuration(layers.length);

  useEffect(() => {
    if (!onDone) return;
    const timer = window.setTimeout(onDone, duration + 40);
    return () => window.clearTimeout(timer);
  }, [onDone, duration]);

  if (typeof document === "undefined") return null;

  const enterX = from === "left" ? "-100%" : "100%";
  const exitX = from === "left" ? "100%" : "-100%";

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[140]" aria-hidden>
      {layers.map((color, index) => (
        <motion.div
          key={color}
          className="absolute inset-0"
          style={{ background: color }}
          initial={{ x: mode === "cover" ? enterX : "0%" }}
          animate={{ x: mode === "cover" ? "0%" : exitX }}
          transition={{
            duration: LAYER_DURATION,
            ease: mode === "cover" ? EASE_OUT : EASE_IN,
            // при закрытии слои идут в прямом порядке, при открытии — в обратном
            delay:
              (mode === "cover" ? index : layers.length - 1 - index) *
              LAYER_STAGGER,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

const VARIANTS: Record<
  "open" | "back",
  { layers: string[]; from: TransitionFrom }
> = {
  open: { layers: OPEN_LAYERS, from: "left" },
  back: { layers: BACK_LAYERS, from: "right" },
};

/** Аварийный таймаут: если навигация не доехала, всё равно открываемся. */
const COVER_TIMEOUT = 4e3;

type TransitionNav = {
  go: (href: string, variant?: "open" | "back") => void;
  back: (href?: string, variant?: "open" | "back") => void;
  busy: boolean;
};

const TransitionContext = createContext<TransitionNav>({
  go: () => {},
  back: () => {},
  busy: false,
});

export const useTransitionNav = () => useContext(TransitionContext);

/** Флаг «мы уже внутри приложения» — значит можно идти history.back(). */
const INSIDE_KEY = "maks:inside";

type Props = { children: React.ReactNode };

export default function PageTransition({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<TransitionMode>("idle");
  const [variant, setVariant] = useState<"open" | "back">("open");
  // путь, с которого начали переход — ждём, пока pathname станет другим
  const fromPathRef = useRef<string | null>(null);

  const cover = useCallback(
    (nextVariant: "open" | "back", onCovered: () => void) => {
      if (mode !== "idle") return;
      setVariant(nextVariant);
      setMode("cover");
      fromPathRef.current = pathname;
      window.setTimeout(
        onCovered,
        totalDuration(VARIANTS[nextVariant].layers.length),
      );
    },
    [mode, pathname],
  );

  const go = useCallback(
    (href: string, nextVariant: "open" | "back" = "open") => {
      try {
        sessionStorage.setItem(INSIDE_KEY, "1");
        if (pathname === "/")
          sessionStorage.setItem(HOME_Y_KEY, String(window.scrollY));
      } catch {}
      cover(nextVariant, () => router.push(href));
    },
    [router, cover, pathname],
  );

  const back = useCallback(
    (href = "/", nextVariant: "open" | "back" = "back") => {
      let inside = false;
      try {
        inside = sessionStorage.getItem(INSIDE_KEY) === "1";
      } catch {}
      cover(nextVariant, () => {
        if (inside && window.history.length > 1) router.back();
        else router.push(href);
      });
    },
    [router, cover],
  );

  // новый путь приехал — через 120мс начинаем раскрывать занавес
  useEffect(() => {
    if (
      mode !== "cover" ||
      fromPathRef.current === null ||
      pathname === fromPathRef.current
    )
      return;
    fromPathRef.current = null;
    const timer = window.setTimeout(() => setMode("uncover"), 120);
    return () => window.clearTimeout(timer);
  }, [pathname, mode]);

  useEffect(() => {
    if (mode !== "cover") return;
    const timer = window.setTimeout(() => setMode("uncover"), COVER_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const handleDone = useCallback(() => setMode("idle"), []);

  return (
    <TransitionContext.Provider
      value={{ go, back, busy: mode !== "idle" }}
    >
      {children}
      {mode !== "idle" && (
        <TransitionOverlay
          key={mode}
          mode={mode}
          layers={VARIANTS[variant].layers}
          from={VARIANTS[variant].from}
          onDone={mode === "uncover" ? handleDone : undefined}
        />
      )}
    </TransitionContext.Provider>
  );
}
