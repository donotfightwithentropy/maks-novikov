"use client";

import { useEffect, useState } from "react";

/** Максимальная физическая сторона экрана, которую считаем телефоном */
const PHONE_MAX_SIDE = 1024;

/**
 * Телефон определяем по самому устройству, а не по ширине окна: палец вместо
 * мыши плюс небольшой физический экран. `screen.width/height` не меняются при
 * повороте, поэтому альбомная ориентация не превращает телефон в десктоп.
 */
export function isPhoneDevice() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.bind(window);
  if (!mq) return false;
  const touch = mq("(pointer: coarse)").matches || mq("(hover: none)").matches;
  const side = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0);
  return touch && side > 0 && side <= PHONE_MAX_SIDE;
}

/**
 * null — пока не знаем (серверный рендер и первый кадр гидратации).
 * Значение появляется кадром позже: во время гидратации React не правит
 * расхождения с серверной разметкой, поэтому первый рендер обязан совпасть.
 */
export function usePhoneDevice() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const read = () => setPhone(isPhoneDevice());
    const id = requestAnimationFrame(read);
    /* смена ориентации и перенос окна на другой экран */
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", read);
    };
  }, []);
  return phone;
}
