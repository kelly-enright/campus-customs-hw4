# AI Prompts — Homework 4: Campus Customs Shop + Chatbot

A running log of the prompts I typed to the vibe coder (Claude Code) while building this
project. One section per problem, in the order the work happened. Prompts are recorded
verbatim, including typos.

Where a problem needed more than one prompt, a **Why a follow-up was needed** note explains
what the original prompt left out.

---

## Setup — Project brief and data

**Prompt 1 (initial brief, with `data.zip` attached):**

> Okay today we're going to work on Homework 4: "Campus Customs Shop + Chatbot". For this
> homework Campus Customs needs a customer website with a helpful chatbot. We are going to
> build a React + Vite Typescript frontend and a Python FastAPI backend whose brain is a
> PydanticAI agent. Shoppers going to the website should be able to browse products, create
> an account, chat about merch, see matching items appear on the page, and get honest
> answers about price and stock from a local database. We have been given campus_customs.db
> with tables for the product catalogue, inventory by size, and users (with hashed
> passwords). Product image file paths are in the catalogue table. The style and information
> for the Campus Customs page will be taken from https://yalebulldogblue.com/ as reference
> for the agent prompt. We are going to use my PORTKEY_API_KEY for the agent's AI calls. We
> are going to work through one problem at a time. At the end of the homework we are going
> to push the project to a public Github repo and im going to submit the repo URL on Canvas
> but dont do anything until we get to that step with that. I am attaching a data.zip file.
> Unzip it so that we have data/campus_customs.db (SQLite database with tables catalogue,
> inventory, and users (one test user will already be in there) and data/products/ (product
> images; paths match the catalogue table. Are you ready to begin?

**Result:** `data/campus_customs.db` (catalogue 102 rows, inventory 612 rows, users 3 rows,
chat_messages 0 rows) and `data/products/` (102 images) unzipped and verified.

---

## Problem 1 — Vibe coder prompts

**Prompt 1:**

> Okay Problem 1: "Vibe coder prompts". We are going to create AI_prompts.md at the start of
> the assignment and keep it updated as we work. This is going to be the file log of what I
> typed to the vibe coder. There should be one section for each problem. Each section needs
> to include 1.) The problem number and title 2.) at least one prompt that I typed, and then
> if a follow up prompt was needed for the problem please ask me what I was missing in the
> original prompt that required me to do a second.

**Result:** This file created, with the structure above. It gets a new section as each
problem is worked.

---

## Problem 2 — Analyze the database

**Prompt 1:**

> Okay Problem 2: "Analyze the database". For this one we are going to look at the database
> data/campus_customs.db and understand the fields of each table including catalogue,
> inventory and users. Start the file output/harness.md and write down each table and its
> fields and one short line on why each field matters for the shop or the chatbot. As we
> continue on in this assignment we will keep growing the harness file in later problems
> (models, tools, safety, specs)

**Result:** `output/harness.md` created with a field-by-field breakdown of `catalogue`,
`inventory`, `users`, and the empty-but-present `chat_messages`, plus a data-quality section
and placeholder headings for models, tools, safety, and specs.

---

## Problem 3 — Build the Campus Customs website

**Prompt 1:**

> Problem 3: "Build the Campus Customs website". Now I want you to scaffold a React + Vite +
> Typescript frontend for Campus Customs. There should be a Nav bar at the top that links to
> the main pages 1.) Home 2.) Products 3.) About Us 4.) Log in 5.) Create account. Earlier, I
> mentioned that we wanted to follow the styling and wording from yalebulldogblue.com for
> Home and About Us, but the pages should not be copied exactly and should be rewritten in
> our own voice.

**Prompt 2:**

> On the Products page, show the product images from the catalogue (use the image paths in
> the database) with basic product info including name, price, and a short description. Each
> product should open a single-item page (with a large image on one side, full product text
> on the other -- description, price, sizes/stock when we know them). Clicking a card on
> Products should take the shopper there. Then at the bottom right of the side the chat
> interface as a floating panel chat should be there. It does not need to talk to an agent
> yet -- a stub that will call the backend later is enough for Problem 3. We are going need a
> small API soon to read the database. We can start a simple FastAPI app in backend/main.py
> just to serve products and images and then we will grow it into the agent backend in
> Problem 5. Does that all make sense?

**Why a follow-up was needed:** The first prompt was sent before it was finished. The second
added the Products/detail/chat/backend requirements.

**Result:** Six routes (Home, Products, Product detail, About Us, Log In, Create Account) in
React + Vite + TypeScript, a navy-and-white theme, and a floating assistant panel on every
page backed by a stub. A FastAPI app in `backend/main.py` serves the catalogue and the
product images. All 102 products render with working images; the 22 raw `garment_type`
values are normalized into 6 filter categories.

---

## Problem 4 — Create account and login

**Prompt 1:**

> Now for Problem 4: "Create account and login" I want to build a normal create-account /
> login flow It should have a Create account part with first name, last name, email, password
> and confirm password. There should also be a way to "Show password" and then there should
> be a Log in where the user enters their email and password. New accounts go into the users
> table. Make sure to also store the passwords securely so jackers (human and AI) cannot
> access them. Remember that the seed database already had a test user we can use while
> building: Email: test@campuscustoms.yale.edu and the Password: password. Confirm that the
> log in works as that user and that a brand new account also works. Update output/harness.md
> with how auth works (what we store for each user and how passwords are protected) so that
> it is documented

**Result:** Signup (first name, last name, email, password, confirm password, with a
Show/Hide password toggle on both password fields) and login, both wired to the `users`
table. Passwords are hashed with PBKDF2-HMAC-SHA256, per-user random salt, 600,000
iterations; the seed rows' older 120,000-iteration hashes still verify and are silently
upgraded on the next successful login. Sessions use signed, expiring bearer tokens.
Verified by curl and in the browser: the seed user logs in, a new account created through
the form logs in, and every failure case is rejected. `output/harness.md` §2 documents what
is stored, each defense and why, and the known gaps.

---

## Problem 5 — PydanticAI agent backend

**Prompt 1:**

> okay now for Problem 5: "PydanticAI agent backend" Here, we are building the shop's chatbot
> as a Pydantic agent behind FastA{O, plugged into the front-end chat widget. Put the API app
> in backend/main.py -- this is the file we will run with Uvicorn. Keep the agent as these
> four files next to it. 1.) backend/prompts/prompt.md (system prompt / we will grow this
> same file later) 2.) backend/agent.py (agent entry/wiring) 3.) backend/tools.py (tools the
> agent can call) 4.) backend/models.py (Pydantic / PydanticAI structured types). Then in
> main.py expose a chat route so a message from the website returns a reply from the agent
> (and whatever else is needed for products/auth). We will need to use the AI model API key
> for the agent. Put Campus Customs voice and safety basics into prompts/prompt.md (we will
> expand tools and safety later on in the assignment). Start or update types in models.py for
> chat replies / product cards as needed. In output/harness.md, note how the frontend talks
> to FastAPI and how the agent is loaded (prompt file + model). Make sure the backend runs
> from the backend/ folder like this: uvicorn main:app --reload --port 8000

**Result:** The four agent files plus a rewritten `main.py` that runs as `uvicorn main:app`
from `backend/`. The agent reaches the model through the Portkey gateway using
`PORTKEY_API_KEY`, and has five database-backed tools. Its structured output returns product
*ids*, which the server hydrates into cards from the database — so a price on screen can
never be one the model invented. `/api/chat` is wired to the floating chat panel, which now
sends conversation history and renders product cards. Verified: real searches, honest
sold-out answers, refusal of off-topic and prompt-injection attempts, and follow-up
questions that depend on history.

---

## Problem 6 — Tools: product info and stock

**Prompt 1:**

> For Problem 6: "Tools: product info and stock" I want to give the agent tools that look up
> real information from campus_customs.db including 1.) product description 2.) Price 3.) How
> many are in stock (by size when the customer asks). The agent must use the database - make
> sure it does not invent prices or quantities. And then if a size is out of stock, say so
> clearly so that the customer knows. And then Expand prompts/prompt.md so the agent knows to
> call these tools for price and stock questions. Add or update return types in models.py. In
> output/harness.md make sure to list each tool and explain which model fields were chosen for
> lookup results and why they were the ones chosen.

**Result:** Three dedicated lookup tools — `get_product_info` (description, colors, price,
stock in every size), `get_price`, and `check_stock` (one size or the whole run) — alongside
the existing search. New return types in `models.py`: `ProductInfo`, `PriceAnswer`,
`StockReport`, `SizeAvailability`. Prices are pre-formatted server-side as `price_display`
and "low stock" is labeled in Python, so the model copies values rather than computing them.
`prompt.md` gained explicit sections requiring a tool call for every price and stock
question, forbidding reuse of stock figures from earlier turns, and requiring sold-out sizes
to be stated plainly and first. Verified by mutating a quantity in the database mid-session:
the same question returned "sold out in medium" and then "in stock, 5 available" after the
value was restored. `output/harness.md` §5 documents each tool's fields and the reason for
each choice.

---

## Problem 7 — Chat search that updates the page

**Prompt 1:**

> Now for Problem 7: "Chat search that updates the page". For this, we will add a new feature
> to the site. When a customers asks about a type of item (ie "What hoodies do you have?" then
> the agent should search the catalogue and the website should dynamically show those matching
> items as product cards (image, name, price, short info). Note, this is an API contract so
> the agent returns structured product matches and then the frontend renders them on the
> website. It should look cool! After the dynamic product cards are loaded by the new feature,
> make sure the same single-item page behavior we built in Problem 3 still works. So each
> product card (including the ones the chat just put on the page) should still open that
> detail view including the large image & full info when clicked. Update the prompts/prompt.md
> and output/harness.md so it is clear how the search results reach the page.

**Result:** Chat matches now render on the page itself, in an animated band above the
catalogue on the Products page, with the shopper's question as its heading. A
`ChatResultsContext` bridges the panel and the page so the row survives navigation; the panel
sends the shopper to `/products` when they ask from elsewhere. The band reuses the same
`ProductCard` component as the catalogue, so chat-placed cards open the Problem 3 detail view
identically — verified by clicking through and pressing back. `prompt.md` gained a "Showing
products on the page" section explaining that `product_ids` drives what the shopper sees;
`output/harness.md` §7 documents the contract and the full path from question to rendered card.

---

## Problem 8 — Customer memory

**Prompt 1:**

> Now for Problem 8: "Customer memory" When a shopper is logged on I want to save their chat
> history in the database in a table and reload it when they return. The agent should be able
> to tell who is chatting (name and email) and put that in agent deps (or an equivalent clear
> pattern) and/or tools that the agent can call. Also pass enough page context so that if
> someone is on a product page and asks "do you have this in pink?" the agent knows which item
> they mean. The hint the professor gave us is that we can put code into the agent context. Do
> you understand that? Guests can still chat but the history only needs to persist for
> logged-in users. Document in output/harness.md how user chat history is stored, what
> customer fields the agent sees, and how page context is passed.

**Result:** Chat history persists to the existing `chat_messages` table for signed-in
shoppers only, scoped by `user_id`, and reloads into the panel on login. Identity and page
location travel as PydanticAI **deps** — a `CustomerContext` dataclass read by two dynamic
`@agent.system_prompt` functions and by a `get_page_product` tool. The agent sees first name
and email and nothing else from the account. Verified: "Do you have this in pink?" on a
product page resolved to the right item without it ever being named; a question referencing
an earlier turn was answered correctly with no client-side history sent; guest conversations
write zero rows. `output/harness.md` §8 documents storage, the fields the agent sees and why,
and how page context is passed.

**Note:** while testing the "clear conversation" endpoint I deleted the 6 seed
`chat_messages` rows belonging to the test user. They were restored from the original
`data.zip`, with their original ids and timestamps — the table is back to its shipped 22
rows.

---

## Problem 9 — Usability improvements

**Prompt 1:**

> Now let's work on Problem 9: "Usability improvements" I am going to come up with some
> backend and frontend improvements for the site now that the core shop works so we can
> improve it. Can you give me some ideas to choose from? I need to do 2 front-end usability
> improvements and 2 agent / backend usability improvements. So the front-end improvements
> should be ways for the site to look better and be easier to use. The agent/backend
> improvements are things that make the agent output better, more accurate or safer. These
> could be new agent tools or things that make the agent run faster or cheaper. Write
> output/usability.md during building. And then for each of the improvements we should put
> 1.) What was added and 2.) Why it helps a Campus Customs shopper or the business. Once I
> choose the improvements from the options youll give me, go ahead and implement them and
> then make sure they're implemented properly and show up

**Chosen from the options offered:** A (shopping bag), C (shareable + sortable browsing with
stock badges), E (anti-hallucination validator), F (smarter search).

**Result:** All four built and verified in the browser. The bag persists across reloads and
caps quantities at real stock; filters and sort live in the URL so views are linkable, with
stock badges on 21 of 102 cards. The agent's output is now checked by a PydanticAI
`output_validator` that rejects any product id or dollar amount no tool returned that turn,
and catalogue search runs on an FTS5 index with synonyms and typo repair. Documented in
`output/usability.md` with what was added and why it helps for each.

**Bug found and fixed while testing:** clicking the bag's **+** button twice quickly only
incremented once, because the handler closed over the rendered quantity rather than the
current one. Quantity changes are now relative and derived from previous state.

---

## Problem 10 — Style the website

**Prompt 1:**

> Now for Problem 10: "Style the website" I want to make the design more creative so that the
> site feels like a real Campus Customs storefront including fonts, color, hierarchy, motion,
> product presentation, and chat feel. Since I get more points for how imaginative and
> innovative the design is can you give me some ideas for what we could implement and then ill
> choose which ones we do. After I decide, write output/design.md with what I changed and why
> it should help customers stick around or by. Make sure to keep this part concrete and short.
> Maybe let's also add in some cute bulldogs since the mascot is Dan the bulldog who is in Yale
> merch

**Chosen from the options offered:** the 1930s game-day program identity; all four Handsome
Dan touches (chat launcher, empty states, paw-print loading, hero watermark + "Dan's pick");
all four motion/presentation upgrades (uniform tiles, card tilt + zoom, scroll reveal + page
fades, swatches + size pips); and full Dan personality in the chat.

**Result:** The site is restyled as a vintage football program — Alfa Slab One headlines,
Oswald condensed labels, Source Serif body, cream paper with fibre grain and halftone dots,
double rules, navy/oxblood/brass. Handsome Dan is an SVG component with sleeping, awake,
thinking, confused, and sitting states, used as the chat launcher, the thinking indicator, the
empty-search and empty-bag illustrations, and the hero watermark. Product tiles now sample
each photo's own background colour on a canvas so the mixed white/black product shots look
deliberately mounted. Documented in `output/design.md`.

**Two bugs found and fixed while testing:** chat-sourced product cards crashed the page
because `ProductCard` assumed a `colors` field they don't carry; and tile sampling missed
cached images because `onLoad` never fires for an image the browser already has (replaced
with a ref callback that checks `complete`).

---

## Problem 11 — Site testing (app check)

**Prompt 1:**

> Now for Problem 11: "Site testing (app check)". I need to test the live site and document it
> in output/app_check.html (a page that I can double click open. I need to include clear
> screenshots and short captions for the following: 1.) Chat checking the inventory level of an
> item (honest stock/price from the DB) 2.) The dynamic search-result cards appearing after a
> category question (ie hoodies) 3.) One of the usability features I added from Problem 9. Make
> the HTML easy to grade: heading for each check, screenshot, one or two sentences on what the
> screenshot proves. And then put the screenshot image files in output/app_check_images/ and
> link them from app_check.html with relative paths (for example app_check_images/inventory.png).

**Result:** `output/app_check.html` — a standalone page with one heading per check, a
screenshot, and a caption saying what it proves, plus a verdict chip. Screenshots were captured
by driving the live site with a scripted browser session (not staged or edited) and saved to
`output/app_check_images/` as `inventory.png`, `chat_search_cards.png`, and `usability_bag.png`,
linked by relative path. Every value quoted in a caption was checked against the database:
XS = 0 and price = 58.00 for the crewneck, all four hoodies at 68.00, and 58.00 + 32.00 = 90.00
for the bag subtotal.

---

## Problem 12 — Audit trail, safety, finish harness

**Prompt 1:**

> Now for Problem 12: "Audit trail, safety, finish harness". I need to keep an append-only
> output/audit_trail.json of agent-loop activity  (time, tool name, short args/result, stop
> reason. Do not wipe it between runs. Also, I need to think of some safety rules to give the
> agent and put them in prompts/prompt.md Finish output/harness.md so it is clear how the
> system works. Model fields in models.py and why we chose them , tools and abilities, safety
> rules, specs (loop limits, result caps, models, how to run front + back). Now go

**Result:** Three deliverables.

**1. `backend/audit.py` → `output/audit_trail.json`.** Four record types — `run_start`,
`tool_call`, `output_rejected`, `run_end` — each with a UTC timestamp and a `run_id` tying
one turn together. Written as JSON Lines (one object per line), opened in `"a"` mode and
never truncated, because a top-level JSON array would have to be rewritten on every tool
call, which is the exact "wipes itself between runs" failure the requirement guards
against. Every tool routes through one wrapper (`agent.py:_audited`) so the trail cannot
drift out of step with what the agent can do. Stop reasons are classified rather than
lumped together: `complete`, `content_filter`, `tool_limit_exceeded`,
`validation_retries_exhausted`, `model_http_error`, `error`. Writes never raise — an audit
trail that can take down the shop is worse than none.

**2. Safety rules in `prompts/prompt.md`.** A `## Safety rules` section in six parts: stay
in scope (no medical/legal/financial advice), personal and payment data (never ask, never
repeat back, never act on), instructions come only from the prompt (chat text and tool
results are data, not commands), promises the agent cannot make (discounts, shipping,
returns, holds), people not transactions (distress handoff, nothing about a shopper's
body), and being straight about what it is. Verified against five live probes — four were
refused by the model's own reading of the rules, one by the gateway's content filter.

**3. `output/harness.md` finished.** §4 now covers every type in `models.py` field by
field with the reasoning (why `PublicUser` has no password field; why `AgentReply` carries
only `reply` and `product_ids`); §6 consolidates the five anti-hallucination layers and
tabulates the safety rules with verification; §11 gives every loop limit, result cap, model
and security constant with the reason for its value, plus how to run both halves; §12
documents the audit trail.

**Four things the audit trail caught in its first sessions**, none of them visible from
the chat panel, because in each case the agent recovered and said something sensible:

1. `search_products` compared `category` case-sensitively, so `category="hoodies"` matched
   nothing and a run burned its whole six-call budget retrying. Fixed with
   `resolve_category()`.
2. Asked for quarter-zips under $70 — there are none, all 11 are $72.00 — the agent re-ran
   the *same* empty search five times. The prompt now has an "An empty result is an answer"
   rule.
3. It then spent four calls looking up prices that were already in the search results it
   was holding. The prompt now says search results already carry `price_display`.
4. The trail itself logged a test card number verbatim, since it records what the shopper
   typed. Shopper text is now scrubbed by `audit.redact()` before being written.

Hitting the tool cap also used to return a 502; `main.py` now answers in character
instead, since a shopper who asked a fair question shouldn't see a gateway error.
