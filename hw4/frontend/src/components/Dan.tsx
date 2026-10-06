/**
 * Handsome Dan, the Yale bulldog — drawn as SVG so he scales cleanly and can be
 * animated by state rather than swapped between images.
 *
 * States:
 *   sleeping — eyes closed, snoozing (idle chat launcher)
 *   awake    — eyes open, ears up (chat open, hero)
 *   thinking — head tilted, one ear cocked (agent is working)
 *   confused — head tilted the other way, eyebrow raised (empty search)
 *   sitting  — full body, sitting down (empty bag)
 */

import { useEffect, useRef, useState } from "react";

export type DanState = "sleeping" | "awake" | "thinking" | "confused" | "sitting";

interface Props {
  state?: DanState;
  size?: number;
  className?: string;
  /** Renders as a flat silhouette for the hero watermark. */
  silhouette?: boolean;
  /** Pupils follow the cursor. */
  track?: boolean;
}

/** How far a pupil may slide from center, in viewBox units. */
const EYE_RANGE = 2.6;

/**
 * Cursor offset for the eyes, normalized to [-1, 1] and scaled by EYE_RANGE.
 *
 * The listener is passive and writes through rAF, so moving the mouse across the hero
 * doesn't schedule a React render per pixel. Returns a zero offset — eyes front — when
 * tracking is off or the visitor has asked for reduced motion.
 */
function useEyeOffset(enabled: boolean, ref: React.RefObject<SVGSVGElement | null>) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let latest = { x: 0, y: 0 };

    const apply = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) return;
      // Distance from the face's center, in units of half the element — so the pupils
      // reach full deflection about one element-width away and then stay pinned.
      const dx = (latest.x - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (latest.y - (box.top + box.height / 2)) / (box.height / 2);
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      setOffset({ x: clamp(dx) * EYE_RANGE, y: clamp(dy) * EYE_RANGE });
    };

    const onMove = (event: MouseEvent) => {
      latest = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
    };
  }, [enabled, ref]);

  return offset;
}

export default function Dan({
  state = "awake",
  size = 64,
  className = "",
  silhouette = false,
  track = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Closed eyes have no pupils to move, so don't bother tracking while he's dozing.
  const eyes = useEyeOffset(track && state !== "sleeping", svgRef);
  const tilt = state === "thinking" ? -8 : state === "confused" ? 9 : 0;
  const body = silhouette ? "currentColor" : "var(--dan-fur)";
  const shade = silhouette ? "currentColor" : "var(--dan-shade)";
  const muzzle = silhouette ? "currentColor" : "var(--dan-muzzle)";

  if (state === "sitting") {
    return (
      <svg
        className={`dan dan-sitting ${className}`}
        width={size}
        height={size * 1.25}
        viewBox="0 0 120 165"
        role="img"
        aria-label="Handsome Dan, sitting"
      >
        {/* Body first, then the head on top — the head is scaled down and lifted so it
            sits above the shoulders instead of covering them. */}
        <g>
          {/* haunches + seat */}
          <ellipse cx="60" cy="140" rx="44" ry="21" fill={shade} />
          <path d="M26 142c0-34 15-54 34-54s34 20 34 54z" fill={body} />
          {/* tail */}
          <path d="M96 132c9-2 13 5 9 10" stroke={shade} strokeWidth="7" fill="none" strokeLinecap="round" />
          {/* front legs + paws */}
          <rect x="40" y="112" width="15" height="36" rx="7.5" fill={body} />
          <rect x="65" y="112" width="15" height="36" rx="7.5" fill={body} />
          <ellipse cx="47.5" cy="150" rx="10" ry="6" fill={shade} />
          <ellipse cx="72.5" cy="150" rx="10" ry="6" fill={shade} />
        </g>
        <g transform="translate(9, -6) scale(0.85)">
          <DanHead
            body={body}
            shade={shade}
            muzzle={muzzle}
            state="awake"
            silhouette={silhouette}
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`dan dan-${state} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Handsome Dan"
    >
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "60px 70px" }}>
        <DanHead
          body={body}
          shade={shade}
          muzzle={muzzle}
          state={state}
          silhouette={silhouette}
          eyes={eyes}
        />
      </g>
      {state === "sleeping" && !silhouette && (
        <g className="dan-zzz" fill="var(--ink-soft)" fontFamily="var(--font-display)">
          <text x="92" y="30" fontSize="13">z</text>
          <text x="101" y="19" fontSize="10">z</text>
        </g>
      )}
    </svg>
  );
}

function DanHead({
  body,
  shade,
  muzzle,
  state,
  silhouette,
  eyes = { x: 0, y: 0 },
}: {
  body: string;
  shade: string;
  muzzle: string;
  state: DanState;
  silhouette: boolean;
  eyes?: { x: number; y: number };
}) {
  const earUp = state === "awake" || state === "thinking";

  return (
    <g>
      {/* ears — folded down when dozing, lifted when alert */}
      <path
        className="dan-ear dan-ear-left"
        d={
          earUp
            ? "M22 44c-7-9-4-21 5-22 7-1 12 6 13 14z"
            : "M22 48c-7-4-6-16 3-18 7-1 13 5 14 13z"
        }
        fill={shade}
      />
      <path
        className="dan-ear dan-ear-right"
        d={
          earUp
            ? "M98 44c7-9 4-21-5-22-7-1-12 6-13 14z"
            : "M98 48c7-4 6-16-3-18-7-1-13 5-14 13z"
        }
        fill={shade}
      />

      {/* head */}
      <rect x="20" y="34" width="80" height="62" rx="26" fill={body} />

      {/* brow wrinkles — the bulldog tell */}
      {!silhouette && (
        <>
          <path d="M40 52c5-4 12-4 17 0" stroke={shade} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M63 52c5-4 12-4 17 0" stroke={shade} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* eyes */}
      {state === "sleeping" ? (
        <>
          <path d="M40 66c4 4 10 4 14 0" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 66c4 4 10 4 14 0" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* The pupils ride a translate so Dan can glance around without the drawing
              having to be redrawn per direction. */}
          <g
            className="dan-eyes"
            style={{ transform: `translate(${eyes.x}px, ${eyes.y}px)` }}
          >
            <circle cx="47" cy="65" r="6" fill="var(--ink)" />
            <circle cx="73" cy="65" r="6" fill="var(--ink)" />
            {!silhouette && (
              <>
                <circle cx="49" cy="63" r="2" fill="#fff" />
                <circle cx="75" cy="63" r="2" fill="#fff" />
              </>
            )}
          </g>
          {state === "confused" && (
            <path d="M66 54c4-3 10-3 14 1" stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
        </>
      )}

      {/* muzzle + jowls */}
      <ellipse cx="60" cy="82" rx="26" ry="17" fill={muzzle} />
      <ellipse cx="60" cy="74" rx="9" ry="6.5" fill="var(--ink)" />
      {!silhouette && (
        <>
          <path d="M60 79v5" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 84c-4 4-11 3-12-2" stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M60 84c4 4 11 3 12-2" stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* underbite */}
          <rect x="54" y="88" width="5" height="4" rx="1.5" fill="#fff" />
          <rect x="61" y="88" width="5" height="4" rx="1.5" fill="#fff" />
        </>
      )}

      {/* collar with a Y tag */}
      {!silhouette && (
        <>
          <rect x="30" y="95" width="60" height="9" rx="4.5" fill="var(--crimson)" />
          <circle cx="60" cy="108" r="7" fill="var(--gold)" />
          <text
            x="60"
            y="112"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="var(--ink)"
            fontFamily="var(--font-display)"
          >
            Y
          </text>
        </>
      )}
    </g>
  );
}

/** A trail of paw prints, used wherever something is loading. */
export function PawTrail({ label = "Loading" }: { label?: string }) {
  return (
    <div className="paw-trail" role="status" aria-label={label}>
      {[0, 1, 2, 3].map((index) => (
        <svg
          key={index}
          className="paw"
          style={{ animationDelay: `${index * 0.18}s` }}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="15.5" rx="6" ry="5" fill="currentColor" />
          <circle cx="5.5" cy="9" r="2.6" fill="currentColor" />
          <circle cx="10" cy="6" r="2.6" fill="currentColor" />
          <circle cx="14.6" cy="6" r="2.6" fill="currentColor" />
          <circle cx="19" cy="9" r="2.6" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
