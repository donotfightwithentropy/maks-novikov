"use client";

import { useEffect, useRef } from "react";

/** "#RRGGBB" → [r, g, b] в диапазоне 0..1 для uniform3fv */
const hexToRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace("#", ""), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

// Вершинный шейдер: один большой треугольник, накрывающий весь экран
const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2  iResolution;
uniform float iTime;
uniform float uTimeSpeed, uColorBalance, uWarpStrength, uWarpFrequency, uWarpSpeed, uWarpAmplitude;
uniform float uBlendAngle, uBlendSoftness, uRotationAmount, uNoiseScale;
uniform float uGrainAmount, uGrainScale, uGrainAnimated;
uniform float uContrast, uGamma, uSaturation, uZoom;
uniform float uFadeStart, uFadeEnd;
uniform vec3  uColor1, uColor2, uColor3;
out vec4 fragColor;

#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  return 0.5 + 0.5 * n;
}

void main(){
  float t = iTime * uTimeSpeed;
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float ratio = iResolution.x / iResolution.y;

  vec2 tuv = uv - 0.5;
  tuv /= max(uZoom, 0.001);

  // медленно плывущий угол поворота — главный источник движения пятен
  float degree = noise(vec2(t * 0.1, tuv.x * tuv.y) * uNoiseScale);
  tuv.y *= 1.0 / ratio;
  tuv *= Rot(radians((degree - 0.5) * uRotationAmount + 180.0));
  tuv.y *= ratio;

  // синусный варп
  float frequency = uWarpFrequency;
  float ws = max(uWarpStrength, 0.001);
  float amplitude = uWarpAmplitude / ws;
  float warpTime = t * uWarpSpeed;
  tuv.x += sin(tuv.y * frequency + warpTime) / amplitude;
  tuv.y += sin(tuv.x * (frequency * 1.5) + warpTime) / (amplitude * 0.5);

  // смешение трёх цветов вдоль наклонной оси
  float b = uColorBalance;
  float s = max(uBlendSoftness, 0.0);
  float blendX = (tuv * Rot(radians(uBlendAngle))).x;
  float edge0 = -0.3 - b - s;
  float edge1 =  0.2 - b + s;
  float v0 =  0.5 - b + s;
  float v1 = -0.3 - b - s;
  vec3 layer1 = mix(uColor3, uColor2, S(edge0, edge1, blendX));
  vec3 layer2 = mix(uColor2, uColor1, S(edge0, edge1, blendX));
  vec3 col = mix(layer1, layer2, S(v0, v1, tuv.y));

  // растворение внизу — до пост-обработки, чтобы стык был незаметен
  float d = 1.0 - uv.y;
  col = mix(col, uColor2, S(uFadeStart, uFadeEnd, d));

  // зерно
  vec2 grainUv = uv * iResolution.xy / max(uGrainScale, 0.001) * 0.0015;
  if (uGrainAnimated > 0.5) grainUv += vec2(iTime * 0.05);
  float grain = fract(sin(dot(gl_FragCoord.xy * max(uGrainScale, 0.001), vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * uGrainAmount;

  // пост-обработка
  col = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col = pow(max(col, 0.0), vec3(1.0 / max(uGamma, 0.001)));
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

type Props = {
  className?: string;
  color1?: string;
  color2?: string;
  color3?: string;
  timeSpeed?: number;
  colorBalance?: number;
  warpStrength?: number;
  warpFrequency?: number;
  warpSpeed?: number;
  warpAmplitude?: number;
  blendAngle?: number;
  blendSoftness?: number;
  rotationAmount?: number;
  noiseScale?: number;
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  zoom?: number;
  fadeStart?: number;
  fadeEnd?: number;
};

export default function ShaderBackdrop({
  className,
  color1 = "#092D45",
  color2 = "#031828",
  color3 = "#092D45",
  timeSpeed = 0.25,
  colorBalance = 0,
  warpStrength = 1,
  warpFrequency = 5,
  warpSpeed = 2,
  warpAmplitude = 50,
  blendAngle = 0,
  blendSoftness = 0.05,
  rotationAmount = 500,
  noiseScale = 2,
  grainAmount = 0.02,
  grainScale = 2,
  grainAnimated = false,
  contrast = 1,
  gamma = 1,
  saturation = 1,
  zoom = 0.9,
  fadeStart = 0.82,
  fadeEnd = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
    });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    gl.useProgram(program);

    // Один треугольник с запасом по краям вместо двух — хватает, чтобы накрыть клип-спейс
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const posLocation = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    const loc = (name: string) => gl.getUniformLocation(program, name);

    gl.uniform3fv(loc("uColor1"), hexToRgb(color1));
    gl.uniform3fv(loc("uColor2"), hexToRgb(color2));
    gl.uniform3fv(loc("uColor3"), hexToRgb(color3));

    const setFloat = (name: string, value: number) =>
      gl.uniform1f(loc(name), value);

    setFloat("uTimeSpeed", timeSpeed);
    setFloat("uColorBalance", colorBalance);
    setFloat("uWarpStrength", warpStrength);
    setFloat("uWarpFrequency", warpFrequency);
    setFloat("uWarpSpeed", warpSpeed);
    setFloat("uWarpAmplitude", warpAmplitude);
    setFloat("uBlendAngle", blendAngle);
    setFloat("uBlendSoftness", blendSoftness);
    setFloat("uRotationAmount", rotationAmount);
    setFloat("uNoiseScale", noiseScale);
    setFloat("uGrainAmount", grainAmount);
    setFloat("uGrainScale", grainScale);
    setFloat("uGrainAnimated", grainAnimated ? 1 : 0);
    setFloat("uContrast", contrast);
    setFloat("uGamma", gamma);
    setFloat("uSaturation", saturation);
    setFloat("uZoom", zoom);
    setFloat("uFadeStart", fadeStart);
    setFloat("uFadeEnd", fadeEnd);

    const resolutionLocation = loc("iResolution");
    const timeLocation = loc("iTime");

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // DPR ограничен 1.5 — выше смысла нет, а нагрузка растёт квадратично
    const getDpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

    let lastWidth = 0;
    let lastHeight = 0;

    /* Только запоминаем нужный размер: присваивание canvas.width очищает
       буфер, и если сделать это вне кадра отрисовки, слой на мгновение
       становится пустым. На телефоне при скролле адресная строка меняет
       высоту постоянно — получается заметное мерцание. */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      lastWidth = Math.max(1, Math.round(rect.width * getDpr()));
      lastHeight = Math.max(1, Math.round(rect.height * getDpr()));
    };

    /* применяется в начале кадра, сразу перед drawArrays */
    const applySize = () => {
      if (canvas.width === lastWidth && canvas.height === lastHeight) return;
      canvas.width = lastWidth;
      canvas.height = lastHeight;
      gl.viewport(0, 0, lastWidth, lastHeight);
      gl.uniform2f(resolutionLocation, lastWidth, lastHeight);
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // Не рисуем, пока слой далеко от вьюпорта
    let isVisible = true;
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    intersectionObserver.observe(canvas);

    let frameId = 0;
    const startTime = performance.now();

    const render = () => {
      frameId = requestAnimationFrame(render);
      if (isVisible) {
        applySize();
        // при prefers-reduced-motion время замораживаем на нуле
        gl.uniform1f(
          timeLocation,
          prefersReducedMotion ? 0 : (performance.now() - startTime) / 1e3,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, [
    color1,
    color2,
    color3,
    timeSpeed,
    colorBalance,
    warpStrength,
    warpFrequency,
    warpSpeed,
    warpAmplitude,
    blendAngle,
    blendSoftness,
    rotationAmount,
    noiseScale,
    grainAmount,
    grainScale,
    grainAnimated,
    contrast,
    gamma,
    saturation,
    zoom,
    fadeStart,
    fadeEnd,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      // статический градиент как подложка до первого кадра WebGL
      style={{
        background: `linear-gradient(160deg, ${color1}, ${color2} 55%, ${color2})`,
      }}
    />
  );
}
