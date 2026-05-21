import { ChatHeader } from "./ChatHeader";
import { WelcomeState } from "./WelcomeState";
import { MessageList } from "./MessageList";
import { useUiStore } from "../../state/ui";
import { useThreadStore } from "../../state/thread";
import { useTabsStore } from "../../state/tabs";
import { useProjectStore } from "../../state/project";
import { memo } from "react";

export const ChatPane = memo(function ChatPane({
  titlebarInset = 0,
}: {
  titlebarInset?: number;
}) {
  const activeSessionId = useUiStore((s) => s.activeSessionId);
  const itemCount = useThreadStore((s) => s.items.length);
  const activeTab = useTabsStore(
    (s) => s.tabs.find((t) => t.id === s.activeId) ?? null,
  );
  const projectName = useProjectStore((s) => s.current?.name ?? "项目");

  const hasActiveSession =
    activeTab !== null || activeSessionId !== null || itemCount > 0;
  const conversationTitle =
    activeTab?.title ?? (hasActiveSession ? "新对话" : undefined);

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-elevated">
      <ChatHeader
        conversationTitle={conversationTitle}
        titlebarInset={titlebarInset}
      />
      {hasActiveSession ? (
        <MessageList />
      ) : (
        <WelcomeState projectName={projectName} />
      )}
    </main>
  );
});
