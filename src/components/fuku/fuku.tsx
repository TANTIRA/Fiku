"use client";

import { useEffect, useMemo, useState } from "react";
import { PALETTE, spriteRects, type Mood } from "./sprite";

type Props = {
  mood?: Mood;
  size?: number;
  /** Bob up and down and blink now and then. */
  animate?: boolean;
  /** Little pixel sparkles around Fuku (celebrations). */
  sparkle?: boolean;
  className?: string;
  title?: string;
};

export function Fuku({
  mood = "idle",
  size = 64,
  animate = true,
  sparkle = false,
  className,
  title = "Fuku",
}: Props) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!animate || (mood !== "idle" && mood !== "thinking")) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => {
          setBlinking(false);
          loop();
        }, 140);
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(timer);
  }, [animate, mood]);

  const shown: Mood = blinking ? "blink" : mood;
  const rects = useMemo(() => spriteRects(shown), [shown]);

  return (
    <span
      className={`relative inline-block ${animate ? "fuku-bob" : ""} ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label={title}
        className="pixelated"
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={PALETTE[r.c]} />
        ))}
      </svg>
      {sparkle && (
        <>
          <Sparkle className="fuku-twinkle -left-1 top-1" size={size / 6} />
          <Sparkle className="fuku-twinkle-delay -right-1 top-1/3" size={size / 7} />
          <Sparkle className="fuku-twinkle bottom-1 -left-2" size={size / 8} />
        </>
      )}
    </span>
  );
}

function Sparkle({ className, size }: { className: string; size: number }) {
  return (
    <svg
      viewBox="0 0 5 5"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
      className={`absolute ${className}`}
    >
      <rect x="2" y="0" width="1" height="5" fill="#ffd23f" />
      <rect x="0" y="2" width="5" height="1" fill="#ffd23f" />
      <rect x="2" y="2" width="1" height="1" fill="#fff" />
    </svg>
  );
}

/** Fuku with a pixel speech bubble. */
export function FukuSays({
  children,
  mood = "idle",
  size = 72,
  sparkle,
}: {
  children: React.ReactNode;
  mood?: Mood;
  size?: number;
  sparkle?: boolean;
}) {
  return (
    <div className="flex items-end gap-3">
      <Fuku mood={mood} size={size} sparkle={sparkle} />
      <div className="pixel-bubble mb-4 max-w-md text-sm leading-relaxed">{children}</div>
    </div>
  );
}
