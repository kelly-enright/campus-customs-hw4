/**
 * The game-day ticker — a strip under the masthead that scrolls announcements the way a
 * stadium scoreboard runs them between plays.
 *
 * Half the items are live: the category counts come from the API, so the strip is
 * reporting the actual shop rather than reciting fixed marketing copy. If that request
 * fails the slogans alone still make a complete ticker, so a dead API degrades to
 * something that looks deliberate.
 */

import { useEffect, useState } from "react";
import { fetchCategories } from "../lib/api";

const SLOGANS = [
  "Printed in New Haven",
  "Heavyweight cotton · honest fits",
  "Ask Dan about sizes",
  "Bulldog blue that holds its color",
  "Straight answers on stock",
];

export default function Ticker() {
  const [live, setLive] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((categories) => {
        if (!active) return;
        setLive(categories.map((c) => `${c.count} ${c.category}`));
      })
      .catch(() => setLive([]));
    return () => {
      active = false;
    };
  }, []);

  // Interleave live counts with slogans so the strip alternates fact, voice, fact.
  const items: string[] = [];
  const longest = Math.max(live.length, SLOGANS.length);
  for (let i = 0; i < longest; i += 1) {
    if (live[i]) items.push(live[i]);
    if (SLOGANS[i]) items.push(SLOGANS[i]);
  }

  // The track is rendered twice. The animation translates it by exactly -50%, so the
  // second copy is in the first one's place when the loop restarts and the seam never
  // shows. Any other duplication count makes the wrap visible.
  const track = (
    <div className="ticker-track" aria-hidden="true">
      {items.map((item, index) => (
        <span className="ticker-item" key={index}>
          {item}
          <span className="ticker-sep">◆</span>
        </span>
      ))}
    </div>
  );

  if (items.length === 0) return null;

  return (
    <div className="ticker" role="complementary" aria-label="Shop announcements">
      <div className="ticker-rail">
        {track}
        {track}
      </div>
      {/* The scrolling copy is aria-hidden; this is what a screen reader gets. */}
      <span className="sr-only">{items.join(". ")}</span>
    </div>
  );
}
