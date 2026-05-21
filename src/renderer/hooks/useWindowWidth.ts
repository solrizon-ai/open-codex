import { useEffect, useState } from "react";

function currentWindowWidth() {
  return typeof window !== "undefined" ? Math.round(window.innerWidth) : 1280;
}

export function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(currentWindowWidth);

  useEffect(() => {
    let frame: number | null = null;

    const commit = () => {
      frame = null;
      const next = currentWindowWidth();
      setWidth((current) => (current === next ? current : next));
    };

    const onResize = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(commit);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return width;
}
