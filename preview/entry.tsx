/* Точка входа preview-сборки: один статический bundle без Next.js.
   Роутинг — по hash (#/projects/<slug>), см. ./next-navigation.ts */
import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import ProjectView from "@/components/ProjectView";
import HomePage from "@/app/page";
import AboutView from "@/components/AboutView";
import { projectBySlug } from "@/lib/projects";

function PreviewApp() {
  const path = usePathname();
  const slug = path.startsWith("/projects/") ? path.slice(10) : null;
  const project = slug ? projectBySlug(slug) : null;
  const about = path === "/about";

  return (
    <PageTransition>
      {about ? (
        <AboutView />
      ) : project ? (
        <ProjectView
          title={project.heroTitle ?? project.title}
          tagline={project.tagline ?? project.desc ?? ""}
          subtitle={project.panelNote ?? project.desc ?? ""}
          hero={project.hero ?? "nuetel_hero.jpg"}
          titleSize={project.titleSize ?? 96}
          heroInk={project.heroInk ?? "#fff"}
          heroRuleFull={project.heroRuleFull}
          years={project.years ?? ""}
          kicker={project.kicker ?? ""}
          tokens={project.tokens ?? []}
          intro={project.intro}
          stats={project.stats}
          wall={project.wall}
          screens={project.screens}
          outro={project.outro}
          cards={project.cards}
          board={project.board}
          sketch={project.sketch}
          story={project.slug === "nuetel"}
        />
      ) : (
        <HomePage />
      )}
    </PageTransition>
  );
}

createRoot(document.getElementById("root")!).render(<PreviewApp />);
