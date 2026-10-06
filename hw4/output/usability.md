# Campus Customs — Usability Improvements

Four improvements made once the core shop was working: two on the front end (how the site
looks and how easily it's used) and two on the agent/backend (how accurate, how safe, and
how well the assistant answers).

---

## Front-end 1 — A working shopping bag

### What was added

"Add to bag" was a button that did nothing. It now works end to end:

- **Per-size bag entries.** Adding a Large and an XL of the same crewneck creates two lines,
  because they're two different things to buy.
- **A bag count in the nav bar**, on every page, so the shopper can always see what they've
  collected.
- **A bag page** (`/bag`) with quantity steppers, per-line totals, a running subtotal, remove
  and empty-bag controls.
- **Stock-aware quantities.** Each line knows how many of that size exist. The **+** button
  disables at that number and the line says "That's all we have in L." A shopper cannot put
  26 of something into a bag when there are 25 on the shelf.
- **Persistence.** The bag is saved to `localStorage`, so it survives a reload, a closed tab,
  or a trip to another page.

Checkout is deliberately a disabled button with an honest note — there is no orders table in
this assignment, and a button that pretends to take payment would be worse than one that
says it isn't live yet.

### Why it helps

**For the shopper:** the previous version had no way to collect more than one item. Everything
the shop is for — comparing two hoodies, buying a shirt for yourself and one for your
brother, holding a size while you keep browsing — was impossible. Persistence matters
specifically for a college shop, where people browse on a phone between classes and come
back later.

**For the business:** a bag that empties itself on reload is a lost sale. The stock cap also
protects the shop from a promise it can't keep: without it a shopper could fill a bag with
quantities that don't exist and only discover it at the counter.

**A bug this surfaced:** clicking **+** twice quickly only incremented once, because the
handler closed over the quantity that was on screen rather than the current one. Both clicks
computed "1 + 1". Fixed by making quantity changes relative (`adjust(±1)`) and derived from
previous state. Verified: three fast clicks on a quantity of 2 now reach 5.

---

## Front-end 2 — Shareable, sortable browsing with stock badges

### What was added

**Filters live in the URL.** Search text, category, and sort are query parameters, so
`/products?category=Hoodies&sort=price-desc` is a real, linkable page. The back button works
through filter changes, and the view can be bookmarked or sent to someone. Defaults are
omitted from the URL, so a plain `/products` link stays clean. A **Reset** link appears
whenever any filter is active.

**Sorting**, which didn't exist: Name (A–Z), Price low→high, Price high→low, and Most in
stock.

**Stock badges on the cards themselves.** A single aggregate query adds a stock rollup to
`/api/products`, so each card can show "Only 9 left" or "3 sizes left" without one request
per card. About 21 of 102 products carry a badge — enough to be informative, not so many
that it becomes wallpaper.

### Why it helps

**For the shopper:** with 102 items and no sort, "show me the cheapest hoodie" meant reading
every price. Stock badges move the disappointing news forward — previously you found out a
product only came in two sizes after clicking into it. And a filtered view you can't link to
can't be shared with the person actually buying the gift.

**For the business:** scarcity shown honestly at the browsing stage is both useful and
persuasive — "3 sizes left" tells a shopper not to wait. Shareable URLs matter for a college
shop where people send links to parents and teammates; every filtered view is now something
that can be pasted into a message.

---

## Backend 1 — Anti-hallucination output validator

### What was added

A PydanticAI `@agent.output_validator` that checks every reply against what the tools
actually returned on that turn, before the shopper sees it.

Each catalogue tool is wrapped so its results are recorded into an `Observations` object on
the run's deps — product ids and prices. The validator then rejects:

- **Any `product_id`** in the output that no tool returned this turn.
- **Any dollar amount** in the reply text that no tool returned this turn.

A violation raises `ModelRetry` with a specific correction ("Your reply quotes $45.99, which
no tool returned this turn — call get_price and quote price_display exactly"), so the model
tries again with the error in front of it. If it can't produce a clean answer, the run fails
rather than shipping a wrong one.

Legitimate arithmetic still passes: sums of up to four observed prices are allowed, so
"two of those would be $136.00" is accepted while an invented $45.99 is not.

### Why it helps

**For the shopper:** a wrong price is worse than no price. The prompt already *told* the
agent never to invent prices — this *checks*, which is a different kind of guarantee. Prompt
instructions are followed most of the time; a validator is followed every time.

**For the business:** a quoted price is close to a promise. A chatbot that confidently
invents "$45" for a $68 hoodie creates an argument at the register and a customer who feels
misled. This also protects against a subtler failure: the agent correctly looking up one
product and then attaching its price to a different one.

**Verified:** forcing the model to return `yale-space-hoodie` at `$19.99` — a product that
does not exist — was rejected, retried twice, and failed closed rather than reaching the
shopper. Across normal conversations (searches, price questions, size questions, a
two-items-total question) there were zero false rejections.

---

## Backend 2 — Smarter catalogue search

### What was added

Search was a substring match over names, descriptions, and tags. That quietly failed on the
words shoppers actually use. It's now an FTS5 full-text index with two steps in front of it:

1. **Synonyms** — a map from shopper vocabulary to catalogue vocabulary: *sweatshirt* →
   crewneck/hoodie/pullover, *jumper* → crewneck, *tee* → t-shirt, *gym* → performance,
   *tailgate* → football/game, *cozy* → fleece/hoodie.
2. **Typo repair** — a word the catalogue doesn't recognize is matched against the
   catalogue's own vocabulary by edit distance before the query runs. Only unknown words are
   rewritten, so real words are never "corrected" into something else.

Results are ranked by BM25 with field weights, so a name or tag hit outranks an incidental
mention buried in a description. The index is built in memory at startup from the 102
catalogue rows — **the shipped database file is never modified.**

Before and after:

| Shopper types | Before | After |
|---|---|---|
| "sweatshirt" | nothing (the word appears in no name) | hoodies and crewnecks |
| "jumper" | nothing | crewnecks |
| "hoody" | nothing | hoodies |
| "crewnek" (typo) | nothing | crewnecks |
| "gym shirt" | nothing | performance long-sleeves |
| "something warm for the game" | noise | game-day and fleece items |

### Why it helps

**For the shopper:** "do you have any jumpers?" now returns crewnecks instead of "we don't
carry that." Most of these failures were invisible — the shopper had no way to know the
product existed under a different word, so they'd conclude the shop didn't stock it.

**For the business:** every one of those empty results was a shopper being told *no* about
something actually on the shelf. Typo tolerance matters most on phones, where the misspelling
rate is highest and the patience for retrying is lowest.

---

## Summary

| # | Improvement | Helps by |
|---|---|---|
| 1 | Shopping bag | Makes it possible to buy more than one thing, and not lose it on reload |
| 2 | Shareable, sortable browsing + stock badges | Makes 102 items navigable, shareable, and honest about scarcity up front |
| 3 | Anti-hallucination validator | Turns "never invent a price" from an instruction into an enforced rule |
| 4 | Smarter search | Stops the shop from saying "we don't have that" about things it has |
