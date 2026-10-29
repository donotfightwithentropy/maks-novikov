# Maks Portfolio

Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + motion + three.js.

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # продакшен-сборка
```

## Структура

```
app/
  layout.tsx              корневой layout, шрифт Montserrat, обёртка PageTransition
  page.tsx                главная страница
  globals.css             Tailwind + несколько своих правил (.cross, .no-scrollbar, .chat-caret)
  projects/[slug]/page.tsx  страница проекта, пропсы берутся из lib/projects.ts
lib/
  projects.ts             единый список проектов: превью на главной + страницы кейсов
components/
  Hero.tsx                первый экран главной (HeroImage + HeroTitle + бегущий список ролей)
  HeroImage.tsx           картинка героя с WebGL-искажением по скроллу
  HeroTitle.tsx           крупный заголовок с крестиками-маркерами
  WordReveal.tsx          появление текста по буквам внутри слов
  SplitText.tsx           построчное появление текста
  ShaderBackdrop.tsx      фоновый WebGL-градиент (сырой WebGL2, не three.js)
  CharacterExperience.tsx блок About / Work experience: 3D-персонаж + опыт работы
  Gallery.tsx             панель-карточка персонажа (навыки, карточки способностей)
  ProjectsSection.tsx     раздел Projects: плиточная галерея + таблица проектов
  SiteMenu.tsx            бургер-меню с выезжающими слоями
  PageTransition.tsx      переходы между страницами, контекст useTransitionNav
  HomeScrollRestore.tsx   возврат позиции скролла на главной
  ProjectView.tsx         страница кейса целиком (самый большой файл)
  NuetelScene.tsx         three.js-сцена с клавиатурой для кейса Nuetel
  RoomEnvironment.ts      окружение для IBL (порт из three.js)
preview/
  build.mjs               статическая сборка без Next.js (esbuild + Tailwind CLI)
  entry.tsx               точка входа preview
  next-navigation.ts      hash-роутер, подменяет next/navigation в preview
  input.css               копия app/globals.css для preview
public/                   все картинки, SVG и 3D-модели
```

## Preview-сборка

Нужна, чтобы быстро посмотреть сайт одним статическим файлом (и публиковать артефакт):

```bash
node preview/build.mjs          # результат в preview/dist
cd preview/dist && python3 -m http.server 8777
# главная: http://127.0.0.1:8777/
# кейс:    http://127.0.0.1:8777/#/projects/yandex-market
```

В preview Montserrat самохостится из `@fontsource/montserrat` — в офлайне Google Fonts недоступны, а без правильного шрифта едет вся метрика (`capTop`, ширины кнопок).

## Соглашения в коде

- Вся геометрия страниц кейсов — в координатах макета Figma шириной 1920:
  `const cq = (v: number) => \`${(v / 1920) * 100}cqw\`;` внутри `@container`.
- `capTop(y, size, lh)` пересчитывает cap-top из Figma в CSS `top` по метрикам Montserrat
  (ascender 0.968, cap-height 0.70, глиф-бокс 1.219em).
- Ритм отбивок: линейка → cap-top заголовка = 71, низ блока заголовка → линейка = 28.16,
  зазор между крупными блоками = 164.
- Палитра: `#B91372` (акцент), `#051C2E` (тёмный), `#E7E7E7` (светлый), `#031828` (фон).
- Линейки рисует компонент `Rule` — он сам доводит себя до целого девайс-пикселя,
  иначе 1px на дробном `cqw` размазывается в две строки.

## Мобильная вёрстка

Главная и About адаптируются внутри своих компонентов. Страницы кейсов при ширине
`<= 900` отдают отдельное дерево вместо масштабированного десктопа — `useMobileLayout()`
в `ProjectView.tsx`, дальше по типу кейса:

```
NuetelMobile      story      — Nuetel
YandexMobile      wall       — Yandex Market
LandingsMobile    board      — Landings & Brandzones
AdditionalMobile  hasDev4    — Additional works
```

Общие кирпичи мобильных страниц: `MHero`, `MIntro`, `MLead`, `MSection`, `MStack`,
`MHead`, `MBody`, `MCaption`, `MRule`, `MShot`, `MZoomShot` (тап — просмотр во весь
экран), `MFooter`. Боковые поля везде `var(--gutter-mobile)` — та же переменная, что
на главной, объявлена в `app/globals.css` и продублирована в `preview/input.css`.

Тяжёлые десктопные вещи (three.js-сцена, липкие экраны, интерактивные доски,
hover-эффекты) в мобильном дереве не рендерятся вообще.

## Деплой

Проект — обычное приложение Next.js, разворачивается без дополнительной настройки:

```bash
npm ci
npm run build
npm start          # или деплой на Vercel: импортировать репозиторий, пресет Next.js
```

## Публикация на GitHub

```bash
cd <папка проекта>
git init
git add .
git commit -m "Maks Novikov portfolio"
git branch -M main
git remote add origin https://github.com/<логин>/<репозиторий>.git
git push -u origin main
```

`.gitignore` уже отсекает `node_modules/`, `.next/`, `preview/dist/` и служебные файлы.
В репозиторий попадают исходники (`app/`, `components/`, `lib/`, `preview/`), ассеты
`public/` (~46 МБ, 513 файлов) и конфиги. Самый крупный файл — 1,5 МБ, лимиты GitHub
(100 МБ на файл) не задеты.

## История

Исходники были восстановлены из продакшен-бандла после потери рабочего окружения.
Материалы восстановления лежат в `site-recovery/` рядом с проектом.
