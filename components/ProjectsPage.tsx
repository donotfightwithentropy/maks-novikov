"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import ShaderBackdrop from "@/components/ShaderBackdrop";
import SiteMenu from "@/components/SiteMenu";
import { useTransitionNav } from "@/components/PageTransition";
import { PROJECTS, projectHref, type Project } from "@/lib/projects";

const ACCENT = "#B91372";
/** тёмная плашка с подписью — как у превью лендингов */
const PANEL = "#07273C";
const RADIUS = 12;
/** магентовый кружок курсора над карточкой */
const CURSOR_SIZE = 92;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Point = { x: number; y: number };

/** Карточка проекта: кадр, подпись по наведению, переход на страницу кейса */
function ProjectCard({
  project,
  delay,
  onCursor,
  onOpen,
}: {
  project: Project;
  delay: number;
  onCursor: (p: Point | null) => void;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      role="link"
      tabIndex={0}
      aria-label={project.title}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(true);
        onCursor({ x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        onCursor({ x: e.clientX, y: e.clientY });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(false);
        onCursor(null);
      }}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: RADIUS,
        cursor: "none",
        /* кадр 16:10 — как у превью проектов в таблице на главной */
        aspectRatio: "1.6",
      }}
    >
      <img
        src={project.src.startsWith("/") ? project.src : `/${project.src}`}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          /* лёгкий подъём масштаба прячет размытые края кадра */
          transform: hover ? "scale(1.03)" : "none",
          filter: hover ? "blur(4px)" : "none",
          transition: "filter .4s ease, transform .4s ease",
        }}
      />
      <div
        /* на тач-устройствах ховера нет — подпись показывает CSS,
           см. правило для @media (hover: none) в globals.css */
        className="card-caption"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: PANEL,
          padding: "20px 20px 22px",
          opacity: hover ? 1 : 0,
          transform: hover ? "none" : "translateY(12%)",
          transition: "opacity .35s ease, transform .35s ease",
        }}
      >
        <div
          className="font-bold text-white"
          style={{ fontSize: 23, lineHeight: "26px", letterSpacing: "0.7px" }}
        >
          {project.brand ?? project.title}
        </div>
        {project.desc && (
          <div
            className="font-light text-white"
            style={{ marginTop: 8, fontSize: 15, lineHeight: "22.5px" }}
          >
            {project.desc}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Отдельная страница со всеми кейсами: тот же фон, что на главной */
export default function ProjectsPage() {
  const [cursor, setCursor] = useState<Point | null>(null);
  const { go } = useTransitionNav();
  const items = PROJECTS.filter((p) => p.slug);

  return (
    <main className="relative min-h-[100svh]" aria-label="Projects">
      <ShaderBackdrop className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

      <div
        className="relative z-10 mx-auto flex flex-col"
        style={{
          width: "min(1215px, calc(100% - 2 * var(--gutter-mobile)))",
          paddingTop: "clamp(104px, 13svh, 176px)",
          paddingBottom: "clamp(72px, 12svh, 160px)",
          gap: "clamp(32px, 5svh, 64px)",
        }}
      >
        <motion.h1
          className="font-semibold text-white"
          style={{
            fontSize: "clamp(44px, 9vw, 96px)",
            lineHeight: 1,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
        >
          Projects
        </motion.h1>

        <motion.div
          aria-hidden
          className="origin-left"
          style={{ height: 1, background: "rgba(255,255,255,0.28)" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.3 }}
        />

        {/* две карточки в ряд на широком экране, одна — на телефоне */}
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: "clamp(16px, 2.2vw, 32px)" }}
        >
          {items.map((project, i) => (
            <ProjectCard
              key={project.slug}
              project={project}
              delay={(i % 2) * 0.1}
              onCursor={setCursor}
              onOpen={() => (setCursor(null), go(projectHref(project.slug!)))}
            />
          ))}
        </div>
      </div>

      <SiteMenu />

      {/* на тач-устройствах наведения нет — подпись видна сразу.
          Делаем это стилями, а не состоянием React: во время гидратации
          React не правит расхождения в разметке, и подпись осталась бы
          скрытой до первого перерендера. */}
      <style>{`
        @media (hover: none) {
          .card-caption { opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {cursor &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[120] flex items-center justify-center rounded-full font-semibold text-white"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: CURSOR_SIZE,
              height: CURSOR_SIZE,
              marginLeft: -CURSOR_SIZE / 2,
              marginTop: -CURSOR_SIZE / 2,
              backgroundColor: ACCENT,
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Explore
          </div>,
          document.body,
        )}
    </main>
  );
}
