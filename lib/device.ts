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
 * Любое устройство без мыши — телефон или планшет. По этому признаку
 * выключаем всё, что держится на курсоре: 3d-сцены и ховер-эффекты.
 * Раскладку по нему не меняем, планшету достаётся десктопная.
 */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.bind(window);
  if (!mq) return false;
  return mq("(pointer: coarse)").matches || mq("(hover: none)").matches;
}

/** Планшет: пальцем, но экран уже не телефонный */
export function isTabletDevice() {
  return isTouchDevice() && !isPhoneDevice();
}

/**
 * null — пока не знаем (серверный рендер и первый кадр гидратации).
 * Значение появляется кадром позже: во время гидратации React не правит
 * расхождения с серверной разметкой, поэтому первый рендер обязан совпасть.
 */
function useDeviceFlag(read: () => boolean) {
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    const measure = () => setValue(read());
    const id = requestAnimationFrame(measure);
    /* смена ориентации и перенос окна на другой экран */
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export function usePhoneDevice() {
  return useDeviceFlag(isPhoneDevice);
}

export function useTouchDevice() {
  return useDeviceFlag(isTouchDevice);
}

export function useTabletDevice() {
  return useDeviceFlag(isTabletDevice);
}
