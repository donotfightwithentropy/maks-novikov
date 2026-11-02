"use client";

import { useEffect, useState } from "react";

export type Viewport = { w: number; h: number };

/**
 * Высота «малого» вьюпорта — того, что остаётся, когда панели браузера
 * развёрнуты. В отличие от window.innerHeight она не меняется, пока Safari
 * на iPhone прячет адресную строку по ходу прокрутки, поэтому раскладку
 * считаем именно от неё: иначе каждый шаг скролла пересчитывал бы сцену,
 * а на границе условий — ещё и переключал режим раскладки.
 *
 * Меряем скрытый элемент высотой 100svh: это тот же источник правды, что у
 * секций, свёрстанных в svh. Если браузер не знает svh, высота получится
 * нулевой — тогда откатываемся на window.innerHeight.
 */
function createProbe() {
  if (typeof document === "undefined") return null;
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden";
  document.body.appendChild(el);
  return el;
}

/**
 * initial — значения для серверного рендера и первого кадра гидратации.
 * Во время гидратации React не правит расхождения с серверной разметкой,
 * поэтому первый клиентский рендер обязан совпасть с серверным, а реальные
 * размеры приходят кадром позже.
 */
export function useStableViewport(initial: Viewport) {
  const [size, setSize] = useState<Viewport>(initial);

  useEffect(() => {
    const probe = createProbe();

    const measure = () => {
      const probed = probe ? Math.round(probe.getBoundingClientRect().height) : 0;
      const next = {
        w: window.innerWidth,
        h: probed > 0 ? probed : window.innerHeight,
      };
      /* Пересчитываем раскладку только когда размер действительно изменился.
         На iPhone resize прилетает пачками во время прокрутки — без этой
         проверки каждый такой вызов давал бы новый объект состояния и
         перерисовку всей сцены прямо посреди анимации. */
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    /* поворот телефона меняет и ширину, и базовую высоту — это ловим */
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      probe?.remove();
    };
  }, []);

  return size;
}
