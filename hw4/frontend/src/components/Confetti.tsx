/**
 * A short burst of paper confetti, fired when something good happens — adding to the bag.
 *
 * Deliberately a *moment*, not an ambient effect: it mounts, plays once for ~1.1s, and
 * unmounts itself. Confetti that lingers stops being a reward and becomes decoration.
 *
 * Each piece gets its trajectory from the render, not from CSS, so no two bursts look the
 * same — a burst that replays identically reads as a loading spinner.
 */

import { useEffect, useState } from "react";

const COLORS = [
  "var(--crimson)",
  "var(--gold)",
  "var(--navy-light)",
  "var(--cream)",
  "var(--gold-light)",
];

const DURATION = 1100;
const PIECES = 26;

export default function Confetti({ onDone }: { onDone?: () => void }) {
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, index) => ({
      key: index,
      color: COLORS[index % COLORS.length],
      // Spread across the width, drifting out further the nearer the edges.
      x: (Math.random() - 0.5) * 220,
      rise: 60 + Math.random() * 90,
      spin: (Math.random() - 0.5) * 720,
      delay: Math.random() * 120,
      scale: 0.65 + Math.random() * 0.7,
    })),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => onDone?.(), DURATION + 200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          className="confetti-piece"
          key={piece.key}
          style={
            {
              background: piece.color,
              animationDelay: `${piece.delay}ms`,
              "--cx": `${piece.x}px`,
              "--rise": `${piece.rise}px`,
              "--spin": `${piece.spin}deg`,
              "--scale": piece.scale,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
