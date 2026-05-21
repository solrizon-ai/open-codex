import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

interface ResizeHandleProps {
  /** Side of the panel this handle sits on. The handle drives width
   *  changes based on dragging direction relative to the panel. */
  side: "left" | "right";
  /** Returns current width of the panel being resized. */
  getWidth: () => number;
  /** Setter for the panel width, called continuously during drag. */
  onWidth: (next: number) => void;
  /** Optional final commit, called once when dragging ends. */
  onCommit?: (next: number) => void;
}

/**
 * A 4px-wide draggable splitter. On mouseDown captures the pointer,
 * tracks deltaX, and calls onWidth with the new width (clamping is the
 * store's responsibility). Renders a transparent hit-area that turns
 * accent-colored on hover/drag.
 */
export function ResizeHandle({
  side,
  getWidth,
  onWidth,
  onCommit,
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const nextWidth = useRef(0);
  const frame = useRef<number | null>(null);
  const getWidthRef = useRef(getWidth);
  const onWidthRef = useRef(onWidth);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    getWidthRef.current = getWidth;
    onWidthRef.current = onWidth;
    onCommitRef.current = onCommit;
  }, [getWidth, onWidth, onCommit]);

  const clearGlobals = () => {
    document.documentElement.removeAttribute("data-resizing-panels");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const flush = () => {
    frame.current = null;
    onWidthRef.current(nextWidth.current);
  };

  const endDrag = (pointerId?: number, target?: Element) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (pointerId !== undefined && target instanceof HTMLElement) {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone if the OS cancelled the drag.
      }
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
      onWidthRef.current(nextWidth.current);
    }
    onCommitRef.current?.(nextWidth.current);
    clearGlobals();
  };

  useEffect(() => {
    const cancelIfDragging = () => endDrag();
    const cancelOnVisibility = () => {
      if (document.visibilityState !== "visible") endDrag();
    };
    window.addEventListener("pointerup", cancelIfDragging);
    window.addEventListener("pointercancel", cancelIfDragging);
    window.addEventListener("blur", cancelIfDragging);
    document.addEventListener("visibilitychange", cancelOnVisibility);
    return () => {
      window.removeEventListener("pointerup", cancelIfDragging);
      window.removeEventListener("pointercancel", cancelIfDragging);
      window.removeEventListener("blur", cancelIfDragging);
      document.removeEventListener("visibilitychange", cancelOnVisibility);
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (dragging.current) {
        clearGlobals();
      }
    };
  }, []);

  return (
    <div
      onPointerDown={(e) => {
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = getWidthRef.current();
        nextWidth.current = startWidth.current;
        e.currentTarget.setPointerCapture(e.pointerId);
        document.documentElement.setAttribute("data-resizing-panels", "true");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dx = e.clientX - startX.current;
        const delta = side === "right" ? dx : -dx;
        nextWidth.current = startWidth.current + delta;
        if (frame.current === null) {
          frame.current = requestAnimationFrame(flush);
        }
      }}
      onPointerUp={(e) => {
        endDrag(e.pointerId, e.currentTarget);
      }}
      onPointerCancel={() => {
        endDrag();
      }}
      onLostPointerCapture={() => {
        endDrag();
      }}
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "group absolute top-0 z-30 h-full w-[10px] cursor-col-resize touch-none select-none [app-region:no-drag]",
        side === "right" ? "-right-[5px]" : "-left-[5px]",
      )}
    >
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent/40 group-active:bg-accent/70" />
    </div>
  );
}
