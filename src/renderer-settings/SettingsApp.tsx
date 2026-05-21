import { useState } from "react";
import { SettingsSidebar, type SectionId } from "./components/SettingsSidebar";
import { AppearanceSection } from "./components/sections/AppearanceSection";
import { ConfigSection } from "./components/sections/ConfigSection";
import { PersonalizationSection } from "./components/sections/PersonalizationSection";
import { McpSection } from "./components/sections/McpSection";
import { HooksSection } from "./components/sections/HooksSection";
import { WorktreesSection } from "./components/sections/WorktreesSection";
import { BrowserSection } from "./components/sections/BrowserSection";
import { ArchivedSection } from "./components/sections/ArchivedSection";

const SECTIONS: Record<SectionId, () => JSX.Element> = {
  appearance: AppearanceSection,
  config: ConfigSection,
  personalization: PersonalizationSection,
  mcp: McpSection,
  hooks: HooksSection,
  worktrees: WorktreesSection,
  browser: BrowserSection,
  archived: ArchivedSection,
};

export function SettingsApp() {
  const [section, setSection] = useState<SectionId>("config");
  const Section = SECTIONS[section];

  return (
    <div className="grid h-full w-full grid-cols-[220px_minmax(0,1fr)] bg-surface-elevated">
      <SettingsSidebar active={section} onSelect={setSection} />
      <main className="h-full overflow-y-auto">
        <Section />
      </main>
    </div>
  );
}
