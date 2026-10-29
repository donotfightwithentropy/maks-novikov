/* Статическая preview-сборка: один IIFE-бандл + Tailwind CSS, без Next.js.
   Нужна, чтобы быстро смотреть страницы в headless-браузере и публиковать артефакт.
   Запуск: node preview/build.mjs */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "preview", "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/* ---------- JS ---------- */
await build({
  entryPoints: [join(root, "preview", "entry.tsx")],
  bundle: true,
  format: "iife",
  minify: true,
  jsx: "automatic",
  target: ["chrome120"],
  loader: {
    ".glb": "dataurl", // модели инлайним: их всего две
    ".jpg": "file",
    ".png": "file",
    ".webp": "file",
    ".svg": "file",
  },
  assetNames: "[name]",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    // в preview нет Next.js — подменяем роутер hash-шимом
    "next/navigation": join(root, "preview", "next-navigation.ts"),
  },
  tsconfig: join(root, "tsconfig.json"),
  outfile: join(out, "bundle.js"),
  logLevel: "info",
});

/* ---------- CSS ---------- */
execFileSync(
  "npx",
  [
    "@tailwindcss/cli",
    "-i",
    join(root, "preview", "input.css"),
    "-o",
    join(out, "bundle.css"),
    "--minify",
  ],
  { cwd: root, stdio: "inherit" },
);

/* ---------- статика ---------- */
/* картинки и модели кладём рядом с бандлом — в коде они указаны как относительные пути */
const copyTree = (from, to) => {
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyTree(src, dst);
    } else {
      copyFileSync(src, dst);
    }
  }
};
copyTree(join(root, "public"), out);

/* ---------- локальный Montserrat ---------- */
/* в headless-окружении Google Fonts недоступны, а без Montserrat вся метрика
   (capTop, ширины кнопок) едет — поэтому в preview шрифт самохостим */
mkdirSync(join(out, "fonts"), { recursive: true });
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
let fontCss = "";
for (const w of FONT_WEIGHTS) {
  for (const subset of ["latin", "latin-ext", "cyrillic"]) {
    const file = `montserrat-${subset}-${w}-normal.woff2`;
    const src = join(root, "node_modules", "@fontsource", "montserrat", "files", file);
    try {
      copyFileSync(src, join(out, "fonts", file));
      fontCss +=
        `@font-face{font-family:"Montserrat";font-style:normal;font-weight:${w};` +
        `font-display:block;src:url("fonts/${file}") format("woff2")}\n`;
    } catch {
      /* такого сабсета нет — не страшно */
    }
  }
}
/* Cormorant Garamond — им набраны заголовок и слоган в блоке про Gza */
for (const w of [400, 700]) {
  const file = `cormorant-garamond-latin-${w}-normal.woff2`;
  const src = join(root, "node_modules", "@fontsource", "cormorant-garamond", "files", file);
  try {
    copyFileSync(src, join(out, "fonts", file));
    fontCss +=
      `@font-face{font-family:"Cormorant Garamond";font-style:normal;font-weight:${w};` +
      `font-display:block;src:url("fonts/${file}") format("woff2")}\n`;
  } catch {
    /* шрифта нет — не страшно */
  }
}

writeFileSync(join(out, "fonts.css"), fontCss);

/* ---------- html ---------- */
writeFileSync(
  join(out, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maks — Portfolio</title>
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="bundle.css">
<style>body{margin:0;background:#031828}</style>
</head>
<body>
<div id="root"></div>
<script src="bundle.js"></script>
</body>
</html>
`,
);

const size = (f) => (readFileSync(join(out, f)).length / 1024).toFixed(0);
console.log(`preview/dist готов: bundle.js ${size("bundle.js")} KB, bundle.css ${size("bundle.css")} KB`);
