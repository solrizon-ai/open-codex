export type Session = {
  id: string;
  title: string;
  time?: string;
  active?: boolean;
  muted?: boolean;
  unread?: boolean;
  pinned?: boolean;
};

export type Project = {
  id: string;
  name: string;
  expanded?: boolean;
  sessions: Session[];
};

export type NavId = "new" | "search" | "plugins" | "automations";
