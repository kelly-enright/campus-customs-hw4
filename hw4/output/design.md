# Campus Customs — Design

**Concept: a 1936 game-day football program.** Aged paper, heavy slab headlines, condensed
numerals, halftone dots, double rules. Navy ink and oxblood on cream, with brass accents —
so the shop reads as a New Haven institution rather than a generic storefront template.

Handsome Dan, the Yale bulldog, is drawn as SVG and runs through the whole site.

---

## What changed

### Type and color

| | Before | After |
|---|---|---|
| Headlines | System serif | **Alfa Slab One**, uppercase, crimson offset shadow |
| Labels, nav, prices | System sans | **Oswald** condensed, letter-spaced |
| Body | System sans | **Source Serif 4** |
| Background | Flat gray-blue | Cream paper with SVG fibre grain + halftone dots |
| Accents | Navy / gold | Navy ink, oxblood crimson, brass gold |

Section headings sit on **3px double rules**, straight off a program page.

**Why it should help:** a shop that looks like it has a history looks like it makes real
clothes. Generic SaaS styling on a merch store reads as drop-shipped.

### Handsome Dan

- **Chat launcher** — Dan dozes with drifting *z*'s and twitching ears; opening the panel
  wakes him; his head tilts while the agent works.
- **Thinking state** — a trail of paw prints and "sniffing around…" instead of "Thinking…".
- **Empty search** — Dan tilts his head: *"Dan can't find that one."*
- **Empty bag** — Dan sits guarding it.
- **Hero watermark** — a large Dan silhouette drifting behind the masthead.
- **"Dan's pick"** — a crimson ribbon on the first featured item.

**Why it should help:** dead ends are where people leave. An empty search result and an empty
bag are now small moments of character instead of blank pages, and the mascot gives the
assistant a face people are more willing to talk to.

### Product presentation

- **Adaptive tiles.** The catalogue photos are shot on mixed white and black backgrounds,
  which made the grid look patchy. Each card now samples its own photo's corner pixels on a
  canvas and paints the tile to match, so every product looks deliberately mounted. CSS
  alone can't do this — `multiply` keeps black black, `screen` blows out white.
- **Color swatches** on each card, mapped from the catalogue's color words.
- **Size pips** (XS–XXL) showing what's actually in stock, struck through when sold out.
- **Hover:** the card lifts and tilts 0.7°, the photo zooms 7%. On the detail page the image
  zooms 13%, like leaning in over the counter.

**Why it should help:** fit and color are the two reasons people bounce off a merch page.
Showing both before the click means fewer dead-end visits to a product that never had your
size.

### Motion

- **Scroll reveal** — sections rise in as they enter view (IntersectionObserver, once each).
- **Page transitions** — each route cross-fades and lifts on navigation.
- **Staggered cards** — chat results arrive as a wave, 70ms apart.
- All of it disabled under `prefers-reduced-motion: reduce`.

**Why it should help:** motion makes the site feel built rather than assembled, and the
staggered reveal draws the eye to the products the assistant just found.

### Chat

Dan's avatar on every reply, warmer bubbles that pop in, paw-print loading, quick-reply
chips, Escape to close, and a header reading **Handsome Dan · Shop dog, New Haven**.

**Why it should help:** the assistant is the shop's differentiator. Giving it a name, a face,
and a voice makes shoppers more likely to open it — and opening it is what leads to a
stock-accurate answer instead of a bounce.

---

## Two bugs this surfaced

1. **Cards from chat crashed the page.** `ProductCard` assumed every product had `colors`;
   chat-sourced cards don't carry that field, so the component threw and took the chat panel
   down with it. All optional fields are now defaulted.
2. **Tile sampling missed cached images.** An `onLoad` handler never fires for an image the
   browser already has. Replaced with a ref callback that checks `complete` first.
