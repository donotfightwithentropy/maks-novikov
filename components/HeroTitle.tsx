"use client";

import { useState } from "react";
import { motion } from "motion/react";

/** количество вертикальных «колонок» с крестиками */
const COLUMN_COUNT = 4;
/** вертикальные позиции крестиков внутри колонки */
const CROSS_TOPS = ["calc(9.75% - 25px)", "50%", "calc(90.25% + 25px)"];
/** размер крестика, px */
const CROSS_SIZE = 22;
/** толщина штриха крестика, px */
const CROSS_STROKE = 1.466;
/** сдвиг колонки вниз при ховере, px */
const HOVER_SHIFT = 30;
/** ширина невидимой зоны ховера, px */
const HIT_WIDTH = 160;
/** высота невидимой зоны ховера, px */
const HIT_HEIGHT = 150;
const EASE_CROSS = [0.76, 0, 0.24, 1] as const;

type Props = {
  delay?: number;
  /** какие колонки рисовать: по умолчанию все четыре */
  cols?: number[];
  /** какие ряды рисовать: по умолчанию все три */
  rows?: number[];
  /** гасить ли первый крестик после сборки (на главной — да) */
  fadeFirst?: boolean;
};

export function HeroTitle({
  delay = 0.3,
  cols = [0, 1, 2, 3],
  rows = [0, 1, 2],
  fadeFirst = true,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      aria-hidden
    >
      <div className="flex h-[min(800px,calc(100%-100px))] w-[min(1300px,calc(100%-175px))] justify-between opacity-45 min-[1400px]:w-[min(1300px,calc(100%-255px))] lg:opacity-70">
        {Array.from({ length: COLUMN_COUNT }, (_, col) => (
          <div
            key={col}
            className={`relative h-full ${col === 0 ? "translate-x-[20px] min-[1400px]:translate-x-[-20px]" : ""} ${col === COLUMN_COUNT - 1 ? "translate-x-[-20px] min-[1400px]:translate-x-[20px]" : ""}`}
            style={{ width: 25 }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ y: hovered === col ? HOVER_SHIFT : 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 26,
                mass: 0.8,
              }}
            >
              {CROSS_TOPS.map((top, row) => {
                if (!cols.includes(col) || !rows.includes(row)) return null;
                // чётность решает, с какой стороны «влетает» штрих
                const fromRight = (row + col) % 2 === 0;
                const fromBottom = col % 2 === 0;
                const crossDelay = delay + row * 0.12 + col * 0.08;
                // самый первый крестик после сборки гаснет
                const fadeOut = fadeFirst && col === 0 && row === 0;
                return (
                  <motion.div
                    key={top}
                    data-plus={`c${col}r${row}`}
                    className="absolute left-1/2"
                    style={{
                      top,
                      width: CROSS_SIZE,
                      height: CROSS_SIZE,
                      marginLeft: -CROSS_SIZE / 2,
                      marginTop: -CROSS_SIZE / 2,
                    }}
                    animate={fadeOut ? { opacity: [1, 1, 0] } : undefined}
                    transition={
                      fadeOut
                        ? {
                            duration: crossDelay + 1.75,
                            times: [
                              0,
                              (crossDelay + 1.35) / (crossDelay + 1.75),
                              1,
                            ],
                            ease: "linear",
                          }
                        : undefined
                    }
                  >
                    <motion.span
                      className="absolute left-0 block bg-white"
                      style={{
                        top: (CROSS_SIZE - CROSS_STROKE) / 2,
                        width: CROSS_SIZE,
                        height: CROSS_STROKE,
                        originX: fromRight ? 1 : 0,
                      }}
                      initial={{
                        x: fromRight ? "-60vw" : "60vw",
                        scaleX: 14,
                        opacity: 0,
                      }}
                      animate={{ x: 0, scaleX: 1, opacity: 1 }}
                      transition={{
                        x: { delay: crossDelay, duration: 1.05, ease: EASE_CROSS },
                        scaleX: {
                          delay: crossDelay + 0.35,
                          duration: 0.75,
                          ease: EASE_CROSS,
                        },
                        opacity: { delay: crossDelay, duration: 0.25 },
                      }}
                    />
                    <motion.span
                      className="absolute top-0 block bg-white"
                      style={{
                        left: (CROSS_SIZE - CROSS_STROKE) / 2,
                        width: CROSS_STROKE,
                        height: CROSS_SIZE,
                        originY: fromBottom ? 1 : 0,
                      }}
                      initial={{
                        y: fromBottom ? "-60vh" : "60vh",
                        scaleY: 14,
                        opacity: 0,
                      }}
                      animate={{ y: 0, scaleY: 1, opacity: 1 }}
                      transition={{
                        y: {
                          delay: crossDelay + 0.1,
                          duration: 1.05,
                          ease: EASE_CROSS,
                        },
                        scaleY: {
                          delay: crossDelay + 0.45,
                          duration: 0.75,
                          ease: EASE_CROSS,
                        },
                        opacity: { delay: crossDelay + 0.1, duration: 0.25 },
                      }}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
            {/* невидимые зоны ховера (сами крестики pointer-events-none) */}
            {CROSS_TOPS.map((top, row) => (cols.includes(col) && rows.includes(row) ? (
              <div
                key={top}
                className="pointer-events-auto absolute left-1/2 -translate-x-1/2"
                style={{
                  top: `calc(${top} - ${HIT_HEIGHT / 2}px)`,
                  width: HIT_WIDTH,
                  height: HIT_HEIGHT + HOVER_SHIFT,
                }}
                onPointerEnter={(e) =>
                  e.pointerType === "mouse" && setHovered(col)
                }
                onPointerLeave={(e) =>
                  e.pointerType === "mouse" &&
                  setHovered((prev) => (prev === col ? null : prev))
                }
              />
            ) : null))}
          </div>
        ))}
      </div>
    </div>
  );
}
