"use client";

import { useEffect } from "react";

/** Сохранённая позиция скролла главной страницы. */
export const HOME_Y_KEY = "maks:home-y";
/** Флаг «вернуться к секции проектов» (ставится при переходе на главную к проектам). */
export const TO_PROJECTS_KEY = "maks:to-projects";

/** Читает значение из sessionStorage и сразу его удаляет (одноразовый флаг). */
const takeOnce = (key: string): string | null => {
  try {
    const value = sessionStorage.getItem(key);
    if (value !== null) sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
};

/**
 * Позиция якоря секции проектов: суммируем offsetTop по цепочке offsetParent
 * и поднимаемся на 30% высоты вьюпорта, чтобы секция не упиралась в верх экрана.
 */
const projectsAnchorY = (): number | null => {
  const anchor = document.getElementById("projects-anchor");
  if (!anchor) return null;
  let top = 0;
  for (
    let node: HTMLElement | null = anchor;
    node;
    node = node.offsetParent as HTMLElement | null
  )
    top += node.offsetTop;
  return top - window.innerHeight * 0.3;
};

export default function HomeScrollRestore() {
  useEffect(() => {
    const savedY = takeOnce(HOME_Y_KEY);
    const toProjects = takeOnce(TO_PROJECTS_KEY);
    if (savedY === null && toProjects === null) return;

    const target = () => (savedY !== null ? Number(savedY) : projectsAnchorY());
    const restore = () => {
      const y = target();
      if (y === null || Number.isNaN(y)) return;
      window.scrollTo(0, Math.max(0, y));
    };

    restore();
    // Повторяем после layout и ещё несколько раз таймерами:
    // контент (шейдеры, 3D, изображения) доезжает и меняет высоту страницы.
    const raf = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
    const timers = [60, 180, 340].map((delay) =>
      window.setTimeout(restore, delay),
    );

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return null;
}
