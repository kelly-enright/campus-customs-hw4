/**
 * Handsome Dan, seen from the side, trotting across the bottom of the page.
 *
 * The existing `Dan` is a front-facing portrait — good for the chat launcher, useless for
 * walking. This is a separate drawing in profile so the gait can be real: four legs on two
 * alternating phases, the body bobbing at twice the stride rate (a step on each side per
 * cycle), the tail and ear on their own slightly off timings so nothing looks mechanical.
 *
 * He crosses, then waits offscreen for most of the loop. The pause is what keeps him a
 * surprise — a dog continuously lapping the page is wallpaper.
 *
 * Click him and he barks.
 */

import { useState } from "react";

export default function DanTrot() {
  const [barking, setBarking] = useState(false);

  const bark = () => {
    if (barking) return;
    setBarking(true);
    window.setTimeout(() => setBarking(false), 1400);
  };

  return (
    <div className="dan-trot-lane" aria-hidden="true">
      <div className="dan-trot">
        <button
          type="button"
          className={`dan-trot-hit ${barking ? "is-barking" : ""}`}
          onClick={bark}
          tabIndex={-1}
          aria-hidden="true"
        >
          {barking && <span className="dan-bark">Woof!</span>}
          <svg width="112" height="74" viewBox="0 0 140 92" className="dan-side">
            {/* Far-side legs, in shadow tone so the near pair reads in front of them.
                Legs are grouped at the haunch and the chest, not spread evenly along the
                body — four equidistant legs read as a table, not a dog. */}
            <g className="dan-leg dan-leg-a" style={{ transformOrigin: "41px 58px" }}>
              <rect x="35" y="55" width="11" height="28" rx="5.5" fill="var(--dan-shade)" />
            </g>
            <g className="dan-leg dan-leg-b" style={{ transformOrigin: "89px 58px" }}>
              <rect x="83" y="55" width="11" height="28" rx="5.5" fill="var(--dan-shade)" />
            </g>

            <g className="dan-side-body">
              {/* tail — short and curled, behind the haunch */}
              <g className="dan-tail" style={{ transformOrigin: "33px 40px" }}>
                <path
                  d="M33 40c-9-4-14 2-11 8"
                  stroke="var(--dan-shade)"
                  strokeWidth="7"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>

              {/* low, barrel-chested body: haunch at the back, deep chest at the front */}
              <ellipse cx="66" cy="49" rx="35" ry="21" fill="var(--dan-fur)" />
              <ellipse cx="41" cy="48" rx="18" ry="20" fill="var(--dan-fur)" />
              <ellipse cx="91" cy="50" rx="17" ry="19" fill="var(--dan-fur)" />

              {/* head, carried low and forward the way a bulldog does */}
              <g className="dan-head-side">
                <rect x="95" y="20" width="41" height="35" rx="15" fill="var(--dan-fur)" />
                {/* brow wrinkles — the bulldog tell */}
                <path
                  d="M103 30c4-3 10-3 14 0"
                  stroke="var(--dan-shade)"
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx="117" cy="34" r="4" fill="var(--ink)" />
                <circle cx="118.6" cy="32.6" r="1.3" fill="#fff" />
                {/* muzzle, nose, and the underbite */}
                <ellipse cx="128" cy="45" rx="14" ry="11" fill="var(--dan-muzzle)" />
                <ellipse cx="137" cy="39" rx="4.2" ry="3.4" fill="var(--ink)" />
                <path
                  d="M133 48c-4 4-10 3-11-2"
                  stroke="var(--ink)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <rect x="128" y="50" width="4" height="3.4" rx="1.4" fill="#fff" />
                {/* floppy ear, on top of the head and a beat behind the stride */}
                <g className="dan-ear-side" style={{ transformOrigin: "107px 24px" }}>
                  <path
                    d="M107 23c8-2 13 4 12 12-1 7-8 10-13 6z"
                    fill="var(--dan-shade)"
                  />
                </g>
              </g>

            </g>

            {/* A soft shadow where the body meets the legs, so the near legs read as
                being in front of the chest rather than merging into it — they share the
                same fur tone, and without this the dog goes flat. */}
            <ellipse cx="66" cy="66" rx="32" ry="7" fill="var(--dan-shade)" opacity="0.45" />

            {/* Near-side legs, in the lighter fur tone and drawn last so they overlap the
                body. Diagonal pairing: near-front moves with far-back, which is the gait a
                real trot has. */}
            <g className="dan-leg dan-leg-b" style={{ transformOrigin: "51px 58px" }}>
              <rect x="45" y="55" width="12" height="29" rx="6" fill="var(--dan-fur)" />
            </g>
            <g className="dan-leg dan-leg-a" style={{ transformOrigin: "99px 58px" }}>
              <rect x="93" y="55" width="12" height="29" rx="6" fill="var(--dan-fur)" />
            </g>

            {/* Collar and tag last, so the tag hangs in front of the near foreleg instead
                of disappearing behind it. Banded at the neck only. */}
            <g className="dan-side-body">
              <rect
                x="92"
                y="28"
                width="8"
                height="28"
                rx="3"
                fill="var(--crimson)"
                transform="rotate(-7 96 42)"
              />
              <circle cx="94" cy="58" r="5.2" fill="var(--gold)" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
