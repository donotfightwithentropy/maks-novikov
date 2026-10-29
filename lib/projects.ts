/**
 * Общий список проектов: им пользуются и превью в разделе Projects,
 * и маршруты страниц проектов (/projects/<slug>).
 */

export type Project = {
  /** превью в разделе Projects */
  src: string;
  /** заголовок страницы проекта */
  title: string;
  /** строка под заголовком в шапке страницы проекта */
  tagline?: string;
  /** подпись на карточке при наведении */
  brand?: string;
  /** пояснение под заголовком и на карточке */
  desc?: string;
  /** адрес страницы: /projects/<slug>. Без него карточка не кликается */
  slug?: string;
  /** картинка в шапке страницы проекта */
  hero?: string;
  /** кегль заголовка в шапке, если 96 не влезает */
  titleSize?: number;
  /** заголовок в шапке, если он разбит на строки: \n — перевод строки */
  heroTitle?: string;
  /** цвет подписей и линейки в шапке: на светлой картинке — чёрный */
  heroInk?: string;
  /** годы под подзаголовком в шапке */
  years?: string;
  /** заголовок раздела слева в светлой панели */
  kicker?: string;
  /** теги справа в светлой панели */
  tokens?: string[];
  /** текст по центру светлой панели, если он отличается от desc */
  panelNote?: string;
  /** абзацы вступления */
  intro?: string[];
  /** цифры справа от вступления */
  stats?: { n: string; label: string }[];
  /** панно из рекламных баннеров и весь рассказ про Yandex Market */
  wall?: boolean;
  /** мозаика из скриншотов 3×3 под вступлением */
  screens?: string[];
  /** текстовый фрейм под мозаикой: слева заголовок, справа абзацы,
      media — блок с кадрами под текстом */
  outro?: { title?: string; text: string[]; media?: "gza" };
  /** ряд карточек под текстовым фреймом */
  cards?: { icon: string; title: string; text: string }[];
  /** интерактивная доска под карточками */
  board?: "landings";
  /** отбивка, текстовый фрейм и три кадра в ряд под доской */
  sketch?: {
    title: string;
    text: string[];
    images: string[];
    captions?: string[];
    /** источники зацикленного видео под кадрами */
    video?: string[];
    videoPoster?: string;
    /** абзацы под видео, в левой части полосы контента */
    videoNote?: string[];
    /** картинка справа от этих абзацев */
    videoNoteImage?: string;
    /** превью лендингов под отбивкой: кадр, название и пояснение */
    previews?: {
      src: string;
      title: string;
      text: string;
      /** скриншот проекта целиком — открывается по клику */
      full?: string;
    }[];
  };
  /** линейка в шапке — во всю ширину заголовка */
  heroRuleFull?: boolean;
};

export const PROJECTS: Project[] = [
  {
    src: "project_preview_1.jpg",
    title: "Nuetel",
    tagline: "Building a telecom brand from scratch",
    brand: "NUETEL",
    desc: "Design system, company site and advertising content.",
    slug: "nuetel",
    hero: "nuetel_hero.jpg",
    years: "2025 — 2026",
    kicker: "From Sketch\nto System",
    tokens: ["Brand Identity", "Web Design", "Art Direction"],
  },
  {
    src: "project_preview_2.webp",
    title: "Yandex Market",
    tagline: "advertising campaigns",
    brand: "Yandex Market",
    desc: "Designing at Marketplace Scale",
    slug: "yandex-market",
    hero: "yandex_hero.jpg",
    heroTitle: "Yandex\nMarket",
    heroInk: "#051C2E",
    years: "2021 — 2025",
    kicker: "Designing at\nMarketplace Scale",
    panelNote: "Content for advertising campaigns",
    tokens: ["Advertising Production", "Design Systems", "E-commerce"],
    intro: [
      "I created advertising and visual content for Yandex Market, bringing together thousands of sellers and millions of products. Beyond online shopping, it’s a place where users can compare products, write and read reviews.",
      "I worked across a wide range of product categories and campaigns, with brands ranging from small sellers to big brands.",
      "Through the entire period of work, I produced significant amount of content.",
    ],
    stats: [
      { n: "12,000+", label: "Advertising banners" },
      { n: "800+", label: "Icons and tokens" },
      { n: "100+", label: "Landing pages and brand zones" },
    ],
    wall: true,
  },
  {
    src: "project_preview_3.webp",
    title: "Landings and Brandzones",
    brand: "Landings and Brandzones",
    desc: "Many brands in Yandex Market Ecosystem",
    slug: "landings-brandzones",
    /* пока типовое оформление: шапка, hero и первый экран сняты
       со страницы Yandex Market, содержание поменяем позже */
    hero: "landings_hero.jpg",
    heroTitle: "Landings &\nBrandzones",
    heroInk: "#fff",
    heroRuleFull: true,
    years: "2021 — 2025",
    kicker: "Different Brands\nin One Ecosystem",
    panelNote: "Brandzones and landing pages for special events",
    tokens: ["Landing Pages", "Advertising Content", "E-commerce"],
    intro: [
      "Yandex Market is a big shopping service that brings together hundreds of brands, each with its own visual identity, communication style, and design requirements.",
      "My work involved creating landing pages and brand zones for brands, promotional campaigns, and special events. The main challenge was to integrate vendor-provided materials into the Yandex Market design system while preserving each brand’s unique character.",
    ],
    stats: [
      { n: "100+", label: "Brandzones" },
      { n: "30+", label: "Landing pages" },
    ],
    screens: Array.from(
      { length: 9 },
      (_, i) => `1440x900_screen_${i + 1}.jpg`,
    ),
    outro: {
      text: [
        "Every brand has its own visual identity and design guidelines. My main task was to bring these different styles into the Yandex Market ecosystem. Users should always recognize that they are on Yandex Market, while still being able to identify the unique style of each brand. Finding the right balance wasn\u2019t always easy. Sometimes it required several rounds of discussions and approvals.",
      ],
    },
    cards: [
      {
        icon: "adapt",
        title: "Adapt",
        text: "Sometimes vendors provided ready-made visual concepts. My task was to adapt them to the Yandex Market design system.",
      },
      {
        icon: "create",
        title: "Create",
        text: "In other cases, I developed my own visual concepts based on the brand\u2019s materials, project goals, and platform requirements.",
      },
      {
        icon: "update",
        title: "Update",
        text: "Not every project required a complete redesign. Sometimes the task was to update one or several sections of an existing landing page or brand zone.",
      },
    ],
    board: "landings",
    sketch: {
      title: `From Sketch
to Launch`,
      text: [
        "Not all landing pages were created for specific brands. Many were also designed for promotional campaigns and special events, such as New Year sales or Black Friday (or something else).",
        "Besides landing pages, I also worked a lot with brand zones. It\u2019s a bit simplified version of landing page, built with stricter design rules and a more standardized structure.",
        "Many brands had their own brand zones within the Yandex Market ecosystem, and as a designer, I periodically updated their content.",
        "Some projects started with rough sketches and several possible directions before taking their final shape. Here is an example of how I developed a landing page for a fashion brands sale.",
      ],
      images: [
        "yan/landing_edit_1.webp",
        "yan/landing_edit_2.webp",
        "yan/landing_edit_3.webp",
      ],
      captions: [
        "Receiving an assignment",
        "Editing the landing page concept",
        "Finalizing the result",
      ],
      video: [
        "yan/video/landing_process.webm",
        "yan/video/landing_process.mp4",
      ],
      videoPoster: "yan/video/landing_process.webp",
      videoNote: [
        "Of course, each landing page also needed a mobile version, with layouts and content adapted to different screen sizes.",
        "Another part of the project was creating a set of entry-point banners. These ads were placed on external platforms and directed users to the landing page, where they could explore the featured products.",
        "Together, the desktop and mobile versions of a landing page, along with advertising banners, formed a connected experience \u2013 a complete design project where all the elements worked together like a combo :)",
        "And I created dozens of such combos for Yandex Market.",
      ],
      videoNoteImage: "yan/banners_fashion_landing.webp",
      previews: [
        {
          src: "yan/previews/landing_preview_1.webp",
          full: "yan/previews/full/fashion.webp",
          title: "FASHION SALE",
          text: "A project dedicated to a pre-New Year fashion sale. The goal was to bring together products from well-known brands and local fashion brands.",
        },
        {
          src: "yan/previews/landing_preview_2.webp",
          full: "yan/previews/full/discount.webp",
          title: "DISCOUNT PRICES",
          text: "A project highlighting the opportunity to buy discounted products.",
        },
        {
          src: "yan/previews/landing_preview_3.webp",
          full: "yan/previews/full/delonghi.webp",
          title: "DELONGHI",
          text: "A landing page for De\u2019Longhi showcasing its range of coffee machines.",
        },
        {
          src: "yan/previews/landing_preview_4.webp",
          full: "yan/previews/full/samsung.webp",
          title: "SAMSUNG",
          text: "A landing page for Samsung presenting a smartphone model.",
        },
        {
          src: "yan/previews/landing_preview_5.webp",
          full: "yan/previews/full/kstati.webp",
          title: "KSTATI",
          text: "A brand zone for KSTATI, a Yandex Market product line focused on healthy and nutritious food.",
        },
        {
          src: "yan/previews/landing_preview_6.webp",
          full: "yan/previews/full/karcher.webp",
          title: "K\u00C4RCHER",
          text: "A brand zone for K\u00e4rcher on Yandex Market, with seasonal updates.",
        },
      ],
    },
  },
  {
    src: "project_preview_4.webp",
    title: "Additional works",
    brand: "Additional works",
    desc: "Other things I\u2019ve made",
    slug: "additional-works",
    /* шапка оформлена как у Landings & Brandzones: заголовок во всю ширину,
       линейка под ним, светлая панель с токенами и вступление слева */
    hero: "additional_hero.webp",
    heroTitle: "Additional\nworks",
    /* картинка светлая — подписи и линейка тёмные, как на Yandex Market */
    heroInk: "#051C2E",
    heroRuleFull: true,
    /* в шапке под линейкой — только годы */
    tagline: "",
    years: "2020 \u2014 2026",
    kicker: "Other things\nI have made",
    panelNote: "",
    tokens: [
      "Landing Pages",
      "Application concepts",
      "Advertising content",
      "Pet-projects",
      "Presentations",
    ],
    intro: [
      "An overview of my other design projects I\u2019ve worked on over the last years \u2013 different clients and pet-projects, from branding to digital campaigns. Experiments and 3d are included.",
    ],
    outro: {
      title: "Gza navigation app\nconcept",
      text: [
        "Gza is a walking navigation app designed for exploring Tbilisi. It helps users discover interesting places, from museums and bars to hidden street art, while taking the city\u2019s hilly terrain into account.",
        "The app shows elevation changes along each route, shares local stories and interesting facts, and lets users create, save, and share their own walking routes.",
      ],
      media: "gza",
    },
  },
];

/** проекты, у которых есть своя страница */
export const PROJECT_PAGES = PROJECTS.filter((p): p is Project & { slug: string } => !!p.slug);

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug);

export const projectHref = (slug: string) => `/projects/${slug}`;
