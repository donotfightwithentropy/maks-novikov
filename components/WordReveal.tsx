"use client";

import { motion } from "motion/react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type Props = {
  text: string;
  as?: React.ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
};

/**
 * Посимвольное появление текста: слова не разрываются (каждое слово —
 * inline-block с whitespace-nowrap), а задержка считается по сквозному
 * индексу символа через весь текст.
 */
export function WordReveal({
  text,
  as = "p",
  className,
  delay = 0,
  stagger = 0.03,
}: Props) {
  const Tag = as;
  // сквозной счётчик символов (не сбрасывается между словами)
  let charIndex = 0;

  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((word, wordIdx, words) => (
        <span
          key={wordIdx}
          className="inline-block whitespace-nowrap"
          aria-hidden
        >
          {[...word].map((char, i) => {
            const n = charIndex++;
            return (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, filter: "blur(7px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{
                  delay: delay + n * stagger,
                  duration: 0.6,
                  ease: EASE_OUT,
                }}
              >
                {char}
              </motion.span>
            );
          })}
          {wordIdx < words.length - 1 && (
            <span className="inline-block">{" "}</span>
          )}
        </span>
      ))}
    </Tag>
  );
}
