"use client";

import { motion } from "motion/react";

/** Кастомный ease-out: быстрый старт, долгое затухание (power 2.3) */
const EASE_SPLIT = (t: number) => 1 - Math.pow(1 - t, 2.3);

/** Длительность выезда строки */
const SPLIT_DURATION = 1;

/** Задержка между соседними строками (используется снаружи) */
export const SPLIT_TEXT_STAGGER = 0.07;

type Props = {
  text: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  /** проиграть один раз за жизнь компонента, а не при каждом заезде в экран */
  once?: boolean;
};

export default function SplitText({
  text,
  delay = 0,
  className,
  style,
  once = false,
}: Props) {
  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.9 }}
      variants={{ hidden: {}, show: { transition: { delayChildren: delay } } }}
      style={{
        display: "inline-block",
        // clip + отрицательный margin: маска, из-под которой выезжает строка,
        // но не режущая нижние выносные элементы букв
        overflow: "clip",
        paddingBottom: "0.3em",
        marginBottom: "-0.3em",
        ...style,
      }}
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
        {text}
      </motion.span>
    </motion.span>
  );
}
