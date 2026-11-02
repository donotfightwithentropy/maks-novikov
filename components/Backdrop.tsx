/** Единый фон сайта: ровная заливка без градиента и без WebGL.
    Раньше здесь жил шейдерный градиент — он держал на каждой странице
    отдельный контекст WebGL и перерисовывался каждый кадр, что на телефоне
    стоило заметно дороже, чем выглядело. */
export const BACKDROP = "#092D45";

export default function Backdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className} style={{ background: BACKDROP }} />
  );
}
