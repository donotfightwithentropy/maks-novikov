"use client";

import { useEffect, useRef } from "react";

export const MOBILE_QUERY = "(max-width: 1023px)";
/** максимальное число стеклянных панелей (размер uniform-массива act[]) */
export const MAX_PANELS = 64;

type Props = {
  src: string;
  mobileSrc?: string;
  /** источники видео: если заданы, стекло накладывается на видео, а не на картинку */
  video?: string[];
  /** точка кадрирования картинки на десктопе: [x, y] в 0..1 */
  focus?: [number, number];
  /** точка кадрирования на мобиле */
  mobileFocus?: [number, number];
  className?: string;
  panelWidth?: number;
  /** доля ширины, с которой начинаются панели */
  start?: number;
  startOffset?: number;
  distortion?: number;
  chroma?: number;
  restBlur?: number;
};

export function HeroImage({
  src,
  mobileSrc,
  video,
  focus = [0.5, 0.5],
  mobileFocus = [0.5, 0.3],
  className,
  panelWidth = 64,
  start = 0.5,
  startOffset = -70,
  distortion = 22,
  chroma = 0.18,
  restBlur = 5,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoKey = video?.join() ?? "";

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vertexSrc = `#version 300 es
      in vec2 aPos; out vec2 vUv;
      void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

    const fragmentSrc = `#version 300 es
      precision highp float; in vec2 vUv; out vec4 o;
      uniform sampler2D uImg;
      uniform vec2 res;                 // размер канваса в CSS px
      uniform vec2 coverScale; uniform vec2 coverOffset;
      uniform float panelW; uniform float startX;
      uniform float distortion; uniform float chroma;
      uniform float act[${MAX_PANELS}]; // «включённость» стекла для каждой панели 0..1

      uniform float restBlur;           // сила размытия у левого края панели в покое, CSS px

      vec3 img(vec2 uv){ return texture(uImg, uv*coverScale + coverOffset).rgb; }
      vec3 imgLod(vec2 uv, float lod){ return textureLod(uImg, uv*coverScale + coverOffset, lod).rgb; }

      // мягкое размытие: мип-уровень + кольцо из 8 выборок
      vec3 blurred(vec2 uv, float r){
        if (r < 0.05) return img(uv);
        float lod = log2(1.0 + r * 0.9);
        vec2 k = vec2(r) / res;
        vec3 c = imgLod(uv, lod) * 0.2;
        c += (imgLod(uv + vec2( k.x, 0.0), lod) + imgLod(uv + vec2(-k.x, 0.0), lod)
            + imgLod(uv + vec2(0.0,  k.y), lod) + imgLod(uv + vec2(0.0, -k.y), lod)) * 0.12;
        vec2 kd = k * 0.7071;
        c += (imgLod(uv + kd, lod) + imgLod(uv - kd, lod)
            + imgLod(uv + vec2(kd.x, -kd.y), lod) + imgLod(uv + vec2(-kd.x, kd.y), lod)) * 0.08;
        return c;
      }

      void main(){
        vec3 col = img(vUv);
        float xpx = vUv.x * res.x;
        float x0 = startX;
        if (xpx < x0) { o = vec4(col, 1.0); return; }

        float lx = xpx - x0;
        int idx = int(floor(lx / panelW));
        float t = fract(lx / panelW);            // позиция внутри панели 0..1
        float a = act[min(idx, ${MAX_PANELS - 1})];
        a = a * a * (3.0 - 2.0 * a);

        // расстояние до ближайшей грани в px
        float dEdge = min(t, 1.0 - t) * panelW;

        // в покое: мягкий градиент размытия — сильнее слева, к правому краю сходит на нет
        float bw = 1.0 - smoothstep(0.0, 0.75, t);
        bw = bw * bw;
        col = blurred(vUv, restBlur * bw);

        if (a > 0.001) {
          // Glass Surface: у краёв сильное преломление внутрь, в центре — чисто
          float edgeZone = panelW * 0.42;
          float e = 1.0 - smoothstep(0.0, edgeZone, dEdge);
          e = e * e;
          float dir = t < 0.5 ? 1.0 : -1.0;
          // вертикальная составляющая: лёгкий «наплыв» к верху/низу
          float vy = (vUv.y - 0.5) * 2.0;
          float off = dir * e * distortion * a;
          vec2 base = vUv;
          vec2 dR = vec2(off * (1.0),               vy * e * distortion * 0.15 * a) / res;
          vec2 dG = vec2(off * (1.0 + chroma),      vy * e * distortion * 0.17 * a) / res;
          vec2 dB = vec2(off * (1.0 + chroma * 2.), vy * e * distortion * 0.19 * a) / res;
          vec3 glass = vec3(img(base + dR).r, img(base + dG).g, img(base + dB).b);

          // лёгкая насыщенность и яркость стекла
          float l = dot(glass, vec3(0.299, 0.587, 0.114));
          glass = mix(vec3(l), glass, 1.15) * 1.04;

          // внутренние блики по граням (как inset box-shadow у Glass Surface)
          float rim  = 1.0 - smoothstep(0.0, 1.6, dEdge);   // тонкая светлая грань
          float halo = 1.0 - smoothstep(0.0, 12.0, dEdge);  // мягкое внутреннее свечение
          glass += vec3(1.0) * (rim * 0.28 + halo * halo * 0.07) * a;

          col = mix(col, glass, a);
        }

        // в покое — только едва заметная грань между панелями
        float line = 1.0 - smoothstep(0.0, 1.0, dEdge);
        col += vec3(1.0) * line * 0.045 * (1.0 - a);

        o = vec4(col, 1.0);
      }`;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) || "shader");
      return shader;
    };

    const program = gl.createProgram()!;
    try {
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
    } catch (err) {
      console.warn("GlassImage: shader error", err);
      return;
    }
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    gl.useProgram(program);

    const loc = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      img: loc("uImg"),
      res: loc("res"),
      coverScale: loc("coverScale"),
      coverOffset: loc("coverOffset"),
      panelW: loc("panelW"),
      startX: loc("startX"),
      distortion: loc("distortion"),
      chroma: loc("chroma"),
      act: loc("act[0]"),
      restBlur: loc("restBlur"),
    };

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    // один большой треугольник, покрывающий весь экран
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    /** источник пикселей: картинка или кадр видео */
    let image: HTMLImageElement | HTMLVideoElement | null = null;
    const mediaSize = (m: HTMLImageElement | HTMLVideoElement) =>
      m instanceof HTMLVideoElement
        ? ([m.videoWidth, m.videoHeight] as const)
        : ([m.naturalWidth, m.naturalHeight] as const);
    let isMobile = window.matchMedia(MOBILE_QUERY).matches;
    let disposed = false;
    let needsRender = true;

    const loadImage = () => {
      const next = new Image();
      next.decoding = "async";
      next.onload = () => {
        if (disposed) return;
        image = next;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          next,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        canvas.style.opacity = "1";
        if (imgRef.current) imgRef.current.style.visibility = "hidden";
        needsRender = true;
      };
      next.src = isMobile && mobileSrc ? mobileSrc : src;
    };

    /* видео грузится в ту же текстуру, кадр за кадром */
    const videoEl = videoRef.current;
    const setTextureParams = () => {
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    let lastVideoTime = -1;
    const uploadVideoFrame = () => {
      if (!videoEl || videoEl.readyState < 2) return false;
      if (videoEl.currentTime === lastVideoTime) return false;
      lastVideoTime = videoEl.currentTime;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
      gl.generateMipmap(gl.TEXTURE_2D);
      setTextureParams();
      if (!image) {
        image = videoEl;
        canvas.style.opacity = "1";
        videoEl.style.visibility = "hidden";
      }
      return true;
    };

    let cssWidth = 0;
    let cssHeight = 0;
    let panelW = panelWidth;
    let dpr = 1;
    /* желаемый размер буфера; применяется перед самой отрисовкой */
    let pendingWidth = 1;
    let pendingHeight = 1;

    const resize = () => {
      cssWidth = container.clientWidth;
      cssHeight = container.clientHeight;
      if (!cssWidth || !cssHeight) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      /* Размер буфера только запоминаем: присваивание canvas.width очищает
         содержимое, а рисуем мы позже, в requestAnimationFrame. На телефоне
         при скролле прячется адресная строка, ResizeObserver срабатывает
         пачками — и между очисткой и отрисовкой экран успевает мигнуть.
         Поэтому буфер меняем в том же кадре, где идёт drawArrays. */
      pendingWidth = Math.max(1, Math.round(cssWidth * dpr));
      pendingHeight = Math.max(1, Math.round(cssHeight * dpr));
      // панели должны ровно покрывать остаток ширины справа от startX
      const wanted = cssWidth < 768 ? panelWidth * 0.75 : panelWidth;
      const available = cssWidth - (start * cssWidth + startOffset);
      const count = Math.max(
        1,
        Math.min(MAX_PANELS, Math.round(available / wanted)),
      );
      panelW = available / count;
      const nextIsMobile = window.matchMedia(MOBILE_QUERY).matches;
      if (nextIsMobile !== isMobile) {
        isMobile = nextIsMobile;
        loadImage();
      }
      needsRender = true;
    };

    const pointer = { x: -1, inside: false };
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      pointer.x = ((e.clientX - rect.left) / rect.width) * cssWidth;
    };
    const onPointerLeave = () => {
      pointer.inside = false;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const act = new Float32Array(MAX_PANELS);
    let visible = true;
    let rafId = 0;
    let lastRect = "";

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!visible) return;
      if (videoEl && uploadVideoFrame()) needsRender = true;
      if (!image) return;

      // если канвас сдвинулся/изменился — перерисовать
      const rect = canvas.getBoundingClientRect();
      const rectKey = `${rect.left | 0},${rect.top | 0},${rect.width | 0}`;
      if (rectKey !== lastRect) {
        lastRect = rectKey;
        needsRender = true;
      }

      const startX = start * cssWidth + startOffset;
      let animating = false;
      for (let i = 0; i < MAX_PANELS; i++) {
        let target = 0;
        if (pointer.inside && pointer.x >= startX) {
          const center = startX + (i + 0.5) * panelW;
          const dist = Math.abs(pointer.x - center) / panelW;
          // панель под курсором — полностью, соседние — затухающий хвост
          target = dist < 0.5 ? 1 : Math.max(0, 1 - (dist - 0.5) / 1.1) * 0.45;
        }
        // нарастание быстрее, затухание медленнее
        const rate = target > act[i] ? 0.14 : 0.06;
        const next = act[i] + (target - act[i]) * rate;
        if (Math.abs(next - act[i]) > 8e-4) animating = true;
        act[i] = Math.abs(target - next) < 0.001 ? target : next;
      }
      if (!needsRender && !animating) return;
      needsRender = false;

      const [mediaW, mediaH] = mediaSize(image);
      if (!mediaW || !mediaH) return;

      /* буфер меняем здесь, вплотную к drawArrays: очистка и отрисовка
         попадают в один кадр, пустого канваса на экране не бывает */
      if (canvas.width !== pendingWidth) canvas.width = pendingWidth;
      if (canvas.height !== pendingHeight) canvas.height = pendingHeight;

      const w = canvas.width;
      const h = canvas.height;
      const canvasAspect = w / h;
      const imageAspect = mediaW / mediaH;
      const [focusX, focusY] = isMobile ? mobileFocus : focus;
      // эмуляция object-fit: cover через масштаб/смещение uv
      let scaleX = 1;
      let scaleY = 1;
      if (canvasAspect > imageAspect) scaleY = imageAspect / canvasAspect;
      else scaleX = canvasAspect / imageAspect;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.img, 0);
      gl.uniform2f(uniforms.res, cssWidth, cssHeight);
      gl.uniform2f(uniforms.coverScale, scaleX, scaleY);
      gl.uniform2f(
        uniforms.coverOffset,
        (1 - scaleX) * focusX,
        (1 - scaleY) * (1 - focusY),
      );
      gl.uniform1f(uniforms.panelW, panelW);
      gl.uniform1f(uniforms.startX, start * cssWidth + startOffset);
      gl.uniform1f(
        uniforms.distortion,
        cssWidth < 768 ? distortion * 0.7 : distortion,
      );
      gl.uniform1f(uniforms.chroma, chroma);
      gl.uniform1f(uniforms.restBlur, restBlur);
      gl.uniform1fv(uniforms.act, act);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      // видео за пределами экрана не крутим
      if (videoEl) {
        if (visible) videoEl.play().catch(() => {});
        else videoEl.pause();
      }
    });
    intersectionObserver.observe(container);

    resize();
    if (videoEl) {
      videoEl.play().catch(() => {});
    } else {
      loadImage();
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    src,
    mobileSrc,
    videoKey,
    focus.join(),
    mobileFocus.join(),
    panelWidth,
    start,
    startOffset,
    distortion,
    chroma,
    restBlur,
  ]);

  return (
    <div ref={containerRef} className={className}>
      {video ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={src}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
        >
          {video.map((url) => (
            <source
              key={url}
              src={url}
              type={url.endsWith(".webm") ? "video/webm" : "video/mp4"}
            />
          ))}
        </video>
      ) : (
      <picture className="absolute inset-0 block">
        {mobileSrc && <source media={MOBILE_QUERY} srcSet={mobileSrc} />}
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="h-full w-full object-cover object-[50%_30%] lg:object-center"
          fetchPriority="high"
        />
      </picture>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300"
        aria-hidden
      />
    </div>
  );
}
