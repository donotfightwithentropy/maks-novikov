import { notFound } from "next/navigation";
import ProjectView from "@/components/ProjectView";
import { PROJECT_PAGES, projectBySlug } from "@/lib/projects";

export function generateStaticParams() {
  return PROJECT_PAGES.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  /* дефолты ровно те же, что были в точке входа сборки */
  return (
    <ProjectView
      title={project.heroTitle ?? project.title}
      tagline={project.tagline ?? project.desc ?? ""}
      subtitle={project.panelNote ?? project.desc ?? ""}
      hero={project.hero ?? "/nuetel_hero.jpg"}
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
  );
}
