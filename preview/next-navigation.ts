import { useSyncExternalStore } from "react";

/**
 * Шим для preview-сборки: подменяет `next/navigation`.
 * Роутинг держится на hash-е вида `#/projects/slug`, история — в своём стеке
 * с запомненной позицией скролла.
 */

let currentPath =
  typeof location !== "undefined" && location.hash.startsWith("#/")
    ? location.hash.slice(1)
    : "/";

type HistoryEntry = { path: string; y: number };

const historyStack: HistoryEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Скроллим через два кадра: ждём, пока новая страница отрисуется. */
const scrollToY = (y: number) =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.scrollTo(0, y)),
  );

export function usePathname(): string {
  return useSyncExternalStore(
    (onStoreChange) => (
      listeners.add(onStoreChange), () => listeners.delete(onStoreChange)
    ),
    () => currentPath,
    () => currentPath,
  );
}

export function useRouter() {
  return {
    push(path: string) {
      historyStack.push({ path: currentPath, y: window.scrollY });
      currentPath = path;
      emit();
      scrollToY(0);
    },
    replace(path: string) {
      currentPath = path;
      emit();
    },
    back() {
      const entry = historyStack.pop();
      if (!entry) return;
      currentPath = entry.path;
      emit();
      scrollToY(entry.y);
    },
    forward() {},
    refresh() {},
    prefetch() {},
  };
}

/** Заглушки для совместимости с API `next/navigation`. */
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string | string[]> {
  return {};
}
