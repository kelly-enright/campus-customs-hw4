# Campus Customs — Shop + Chatbot

A Yale merch storefront with an AI shopping assistant. React + Vite + TypeScript frontend,
FastAPI backend, PydanticAI agent.

Shoppers can browse 102 products, create an account, and chat with the assistant about
merchandise — matching items appear on the page as real product cards, and every price and
stock figure comes from the live database rather than from the model.

---

## 1. Drop in the data pack

**The repository does not include the database or the product images.** They are supplied
separately. Unpack them so the tree looks like this:

```
hw4/
└── data/
    ├── campus_customs.db     # SQLite: catalogue, inventory, users, chat_messages
    └── products/             # 102 product images
```

`data/` is gitignored, so it will not be committed back.

The catalogue stores each image as `products/<product_id>.jpg`, and the backend mounts
`data/` at `/static`, so the stored path resolves unchanged with no rewriting anywhere.

Check it is in the right place:

```bash
ls data/campus_customs.db && ls data/products | wc -l   # expect 102
```

## 2. Add the API key

```bash
cp .env.example .env
```

Then open `.env` and set `PORTKEY_API_KEY` to the real key.

Without it the catalogue, product pages, accounts, and browsing all work normally — only
the chat assistant fails, with a readable error.

## 3. Install

Python (3.14; a virtual environment keeps it isolated):

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Node:

```bash
npm install --prefix frontend
```

## 4. Run it

Two terminals. **Backend first** — the frontend proxies to it.

Terminal 1 — the API:

```bash
cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000
```

Terminal 2 — the site:

```bash
npm run dev --prefix frontend
```

Open the URL Vite prints — `http://localhost:5173` unless that port is taken.

**If port 8000 is already in use**, start the API elsewhere and tell Vite where it went:

```bash
API_PORT=8010 npm run dev --prefix frontend
```

Vite proxies `/api` and `/static` to the API, so the frontend is same-origin in development
and every URL in the client stays a plain relative path.

Health check:

```bash
curl localhost:8000/api/health     # {"status":"ok","products":102}
```

---

## Layout

```
AI_prompts.md          Log of the prompts used to build this, one section per problem
requirements.txt       Python dependencies
.env.example           Environment template — copy to .env
backend/
  main.py              FastAPI app — catalogue, images, auth, chat route
  agent.py             PydanticAI agent wiring (prompt + model + tools)
  tools.py             Database access and the agent's tools
  models.py            Pydantic types
  auth.py              Password hashing and session tokens
  search.py            FTS5 catalogue search with synonyms and typo repair
  audit.py             Append-only audit trail of agent-loop activity
  prompts/prompt.md    System prompt, including the safety rules
frontend/              React + Vite + TypeScript client
output/
  harness.md           How the system works: data, models, tools, safety, specs
  design.md            The visual identity and why
  usability.md         Four usability improvements and their rationale
  app_check.html       Live site testing, with screenshots — open in a browser
  app_check_images/    Screenshots linked from app_check.html
  audit_trail.json     What the agent did: tool calls, arguments, stop reasons
```

The agent itself is four files: `backend/prompts/prompt.md`, `backend/agent.py`,
`backend/tools.py`, and `backend/models.py`.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness plus product count |
| `GET /api/products` | Catalogue; optional `search` and `category` filters |
| `GET /api/products/{product_id}` | One product, with per-size stock |
| `GET /api/categories` | Normalized categories with counts |
| `GET /static/products/*.jpg` | Product images |
| `POST /api/auth/signup` · `login` · `GET /api/auth/me` | Accounts |
| `POST /api/chat` | One turn with the shop assistant |
| `GET`/`DELETE /api/chat/history` | A signed-in shopper's saved conversation |

## Pages

- **Home** — hero, three value props, a featured row from the live catalogue
- **Products** — all 102 items with search, category filters, and sorting; filters live in
  the URL, so any view can be linked or bookmarked
- **Product detail** — large image beside full text, price, and per-size stock
- **Bag** — per-size lines, quantity steppers capped at real stock, saved to the browser
- **About Us** — the shop's story
- **Log In / Create Account** — real accounts, hashed passwords, signed session tokens
- **Assistant** — a floating panel on every page, backed by the PydanticAI agent

## How the assistant stays honest

The agent returns product **ids**, never prices or images. The server looks each id up and
builds the card from the database, so a hallucinated price has no route to the screen and
an invented id simply renders nothing. An output validator additionally rejects any dollar
figure or id in the reply text that no tool returned on that turn.

Full detail, including the safety rules and every loop limit and result cap, is in
[output/harness.md](output/harness.md).
