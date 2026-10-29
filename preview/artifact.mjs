/* Собирает одностраничный HTML для публикации артефакта:
   CSS и JS инлайнятся, картинки и модели остаются отдельными файлами артефакта. */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "preview", "dist");

const css = readFileSync(join(dist, "bundle.css"), "utf8");
let js = readFileSync(join(dist, "bundle.js"), "utf8");

/* В артефакте страница живёт не в корне домена, поэтому абсолютные пути
   к ассетам (нужные Next.js на реальном сайте) здесь делаем относительными */
const EXT = "webp|jpg|jpeg|png|svg|mp4|webm|glb";
/* обычные строки: "/yan/tokens.webp" */
js = js.replace(
  new RegExp(`"\\/((?:[A-Za-z0-9_\\-]+\\/)*[A-Za-z0-9_\\-.]+\\.(?:${EXT}))"`, "g"),
  '"$1"',
);
/* шаблонные строки: `/yanban/b${n}.webp` */
js = js.replace(
  new RegExp("`\\/((?:[^`\\\\]|\\\\.)*?\\.(?:" + EXT + "))`", "g"),
  "`$1`",
);
/* фоны: url(/yan/packs/${id}.webp) */
js = js.replace(
  new RegExp("url\\(\\/((?:[A-Za-z0-9_\\-]+\\/)+)", "g"),
  "url($1",
);

/* .glb артефакт отдавать отдельным файлом не умеет — инлайним модели data-URI,
   загрузчики в NuetelScene и CharacterExperience такую ветку поддерживают */
for (const name of ["character", "nuetel-keyboard"]) {
  const path = `models/${name}.glb`;
  const uri =
    "data:model/gltf-binary;base64," +
    readFileSync(join(dist, path)).toString("base64");
  const before = js.length;
  js = js.split(JSON.stringify(path)).join(JSON.stringify(uri));
  if (js.length === before) throw new Error(`не нашёл ссылку на ${path} в бандле`);
}

const html = `<title>Maks Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700&family=Cormorant+Garamond:wght@400;700&display=swap">
<style>${css}
body{margin:0;background:#031828}</style>
<div id="root"></div>
<script>${js}</script>
`;

writeFileSync(join(dist, "artifact.html"), html);
console.log(`artifact.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
