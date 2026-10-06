/**
 * Pennant bunting strung across the top of the hero, swaying slightly — the string of
 * triangular flags over the entrance to a 1936 stadium.
 *
 * Each flag gets its own animation delay so the line ripples along its length instead of
 * every flag swinging in unison, which reads as a sheet rather than a string.
 */

const COLORS = ["var(--crimson)", "var(--gold)", "var(--cream)", "var(--navy-light)"];

export default function Bunting({ count = 14 }: { count?: number }) {
  return (
    <div className="bunting" aria-hidden="true">
      <svg viewBox="0 0 1400 54" preserveAspectRatio="none" className="bunting-rope">
        {/* the slack rope the flags hang from */}
        <path
          d="M0 8 Q 350 30 700 16 T 1400 8"
          fill="none"
          stroke="rgba(246,239,223,0.38)"
          strokeWidth="2"
        />
      </svg>
      <div className="bunting-flags">
        {Array.from({ length: count }, (_, index) => (
          <span
            className="pennant"
            key={index}
            style={{
              background: COLORS[index % COLORS.length],
              animationDelay: `${(index % 7) * 0.22}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
