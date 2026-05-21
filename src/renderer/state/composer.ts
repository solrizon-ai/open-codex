import { create } from "zustand";

interface ComposerState {
  pendingInsert: string | null;
  insertText: (text: string) => void;
  consumeInsert: () => string | null;
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  pendingInsert: null,
  insertText: (text) =>
    set((state) => ({
      pendingInsert: state.pendingInsert
        ? `${state.pendingInsert}\n\n${text}`
        : text,
    })),
  consumeInsert: () => {
    const text = get().pendingInsert;
    if (text) set({ pendingInsert: null });
    return text;
  },
}));
