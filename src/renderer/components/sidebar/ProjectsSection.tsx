import { useState } from "react";
import { ProjectRow } from "./ProjectRow";
import { SessionRow } from "./SessionRow";
import type { Project } from "./types";
import { useNavigationStore } from "../../state/navigation";

type ProjectsSectionProps = {
  projects: Project[];
  onSessionClick?: (session: Project["sessions"][number]) => void;
};

export function ProjectsSection({
  projects,
  onSessionClick,
}: ProjectsSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(projects.map((p) => [p.id, p.expanded ?? true])),
  );

  return (
    <div className="flex flex-col">
      <SectionLabel>项目</SectionLabel>
      <div className="flex flex-col gap-[14px] px-[10px]">
        {projects.map((project) => {
          const isOpen = expanded[project.id] ?? true;
          // Project id is the project cwd; keep both names in scope so the
          // ProjectRow context menu can do file ops without re-deriving.
          return (
            <div key={project.id} className="flex flex-col">
              <ProjectRow
                id={project.id}
                name={project.name}
                cwd={project.id}
                expanded={isOpen}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [project.id]: !isOpen }))
                }
              />
              <div
                className={[
                  "grid transition-[grid-template-rows,opacity,margin] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isOpen
                    ? "mt-[6px] grid-rows-[1fr] opacity-100"
                    : "mt-0 grid-rows-[0fr] opacity-0",
                ].join(" ")}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-col gap-[1px] pl-[48px] pr-[12px]">
                    {project.sessions.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        cwd={project.id}
                        onClick={() => {
                          if (onSessionClick) {
                            onSessionClick(s);
                            return;
                          }
                          useNavigationStore.getState().openThread({
                            id: s.id,
                            title: s.title,
                            cwd: project.id,
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[26px] pb-[12px] pt-[2px] text-[12px] font-semibold tracking-0 text-foreground-subtle">
      {children}
    </div>
  );
}

export { SectionLabel };
