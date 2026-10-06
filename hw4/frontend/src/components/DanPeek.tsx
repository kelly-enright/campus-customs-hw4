/**
 * Three bulldogs peeking up over the top edge of the footer, like dogs with their paws on
 * a fence.
 *
 * Each one bobs on its own period and delay, so they're never all up at once — the
 * staggering is the whole joke. They're clipped by the footer's top edge rather than drawn
 * as half-dogs, so the illusion holds at any size.
 */

import Dan from "./Dan";

const PUPS = [
  { left: "12%", size: 76, delay: "0s", period: "6.5s" },
  { left: "48%", size: 64, delay: "2.1s", period: "7.8s" },
  { left: "81%", size: 70, delay: "4.4s", period: "5.9s" },
];

export default function DanPeek() {
  return (
    <div className="dan-peek-row" aria-hidden="true">
      {PUPS.map((pup, index) => (
        <span
          className="dan-peek"
          key={index}
          style={{
            left: pup.left,
            animationDelay: pup.delay,
            animationDuration: pup.period,
          }}
        >
          <Dan state="awake" size={pup.size} />
          {/* paws hooked over the edge */}
          <span className="dan-peek-paws">
            <span className="dan-peek-paw" />
            <span className="dan-peek-paw" />
          </span>
        </span>
      ))}
    </div>
  );
}
