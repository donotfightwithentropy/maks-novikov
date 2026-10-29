"use client";

import HomeScrollRestore from "@/components/HomeScrollRestore";
import ShaderBackdrop from "@/components/ShaderBackdrop";
import Hero from "@/components/Hero";
import CharacterExperience from "@/components/CharacterExperience";
import ProjectsSection from "@/components/ProjectsSection";
import ContactsSection from "@/components/ContactsSection";
import SiteMenu from "@/components/SiteMenu";

export default function HomePage() {
  return (
    <main className="relative">
      <HomeScrollRestore />
      <ShaderBackdrop className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
      <Hero />
      {/* HERO уезжает медленно и к концу своей рельсы уже за экраном —
          подтягиваем следующий экран вверх, чтобы не было пустоты */}
      <div className="-mt-[30svh]" aria-hidden />
      <CharacterExperience />
      <div className="h-[10svh]" aria-hidden />
      <ProjectsSection />
      <ContactsSection />
      <SiteMenu />
    </main>
  );
}
