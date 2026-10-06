"""Campus Customs API.

Run from the backend/ directory:

    uvicorn main:app --reload --port 8000

Serves the product catalogue, the product images, account signup/login, and the chat
route that puts the PydanticAI agent behind the website's chat panel.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import asynccontextmanager, closing
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded

from agent import CustomerContext, ask_agent
from auth import (
    create_session_token,
    hash_password,
    password_problem,
    read_session_token,
    verify_password,
)
from models import (
    AuthResponse,
    ChatRequest,
    ChatResponse,
    ChatTurn,
    LoginRequest,
    ProductCard,
    ProductDetail,
    ProductSummary,
    PublicUser,
    SignupRequest,
    StoredMessage,
)
from tools import (
    DATA_DIR,
    SIZE_ORDER,
    build_search_index,
    clear_chat_history,
    connect,
    load_chat_history,
    load_product,
    normalize_category,
    parse_json_list,
    row_to_summary,
    save_chat_message,
)

logger = logging.getLogger("campus_customs")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Build the in-memory full-text index once, at startup, from the catalogue.
    build_search_index()
    logger.info("Search index built")
    yield

app = FastAPI(title="Campus Customs API", version="0.3.0", lifespan=lifespan)

# Vite picks whatever port is free, so match any localhost origin rather than pinning one.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# catalogue.image_file_path is stored as "products/<id>.jpg", so mounting the whole data
# directory lets the stored path be used verbatim: /static/products/<id>.jpg
app.mount("/static", StaticFiles(directory=DATA_DIR), name="static")


# ------------------------------------------------------------------------- users

USER_COLUMNS = "id, name, email, first_name, last_name, created_at"


def row_to_user(row: sqlite3.Row) -> PublicUser:
    return PublicUser(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        created_at=row["created_at"],
    )


def current_user(authorization: Annotated[str | None, Header()] = None) -> PublicUser:
    """Resolve the caller from an `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")

    user_id = read_session_token(authorization.split(" ", 1)[1].strip())
    if user_id is None:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")

    with closing(connect()) as conn:
        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Account no longer exists")

    return row_to_user(row)


def optional_user(authorization: Annotated[str | None, Header()] = None) -> PublicUser | None:
    """Like current_user, but anonymous browsing is allowed."""
    try:
        return current_user(authorization)
    except HTTPException:
        return None


# ------------------------------------------------------------------------ health


@app.get("/api/health")
def health() -> dict[str, object]:
    with closing(connect()) as conn:
        count = conn.execute("SELECT COUNT(*) FROM catalogue").fetchone()[0]
    return {"status": "ok", "products": count}


# -------------------------------------------------------------------------- auth


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest) -> AuthResponse:
    problem = password_problem(payload.password)
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    email = payload.email.strip().lower()
    first = payload.first_name.strip()
    last = payload.last_name.strip()

    with closing(connect()) as conn:
        # SQLite's UNIQUE is case-sensitive, so check the normalized form ourselves
        # rather than relying on the constraint alone.
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(
                status_code=409, detail="An account with that email already exists."
            )

        try:
            cursor = conn.execute(
                """INSERT INTO users (name, email, password_hash, first_name, last_name)
                   VALUES (?, ?, ?, ?, ?)""",
                (f"{first} {last}", email, hash_password(payload.password), first, last),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Lost a race against a concurrent signup with the same address.
            raise HTTPException(
                status_code=409, detail="An account with that email already exists."
            )

        row = conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()

    user = row_to_user(row)
    return AuthResponse(token=create_session_token(user.id), user=user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    email = payload.email.strip().lower()

    with closing(connect()) as conn:
        row = conn.execute(
            f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE lower(email) = ?",
            (email,),
        ).fetchone()

        # One message for both "no such account" and "wrong password", so the endpoint
        # cannot be used to discover which addresses are registered.
        invalid = HTTPException(status_code=401, detail="Invalid email or password.")
        if row is None:
            raise invalid

        ok, should_rehash = verify_password(payload.password, row["password_hash"])
        if not ok:
            raise invalid

        if should_rehash:
            # Valid but hashed at an older, cheaper work factor — upgrade it now, while
            # we still hold the plaintext.
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(payload.password), row["id"]),
            )
            conn.commit()

    user = row_to_user(row)
    return AuthResponse(token=create_session_token(user.id), user=user)


@app.get("/api/auth/me", response_model=PublicUser)
def me(user: Annotated[PublicUser, Depends(current_user)]) -> PublicUser:
    return user


# ---------------------------------------------------------------------- products


@app.get("/api/categories")
def list_product_categories() -> list[dict[str, object]]:
    """Normalized categories with counts, for the Products page filter bar."""
    with closing(connect()) as conn:
        rows = conn.execute("SELECT garment_type FROM catalogue").fetchall()

    counts: dict[str, int] = {}
    for row in rows:
        category = normalize_category(row["garment_type"])
        counts[category] = counts.get(category, 0) + 1

    return [
        {"category": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda item: -item[1])
    ]


@app.get("/api/products", response_model=list[ProductSummary])
def list_products(
    search: str | None = Query(None, description="Free text over name, description, tags"),
    category: str | None = Query(None, description="Normalized category name"),
) -> list[ProductSummary]:
    with closing(connect()) as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        # One aggregate query for all 102 products rather than a query per card.
        stock: dict[str, tuple[int, int, list[str]]] = {}
        for r in conn.execute(
            """SELECT product_id, size, quantity FROM inventory"""
        ):
            total, available, sizes = stock.get(r["product_id"], (0, 0, []))
            total += r["quantity"]
            if r["quantity"] > 0:
                available += 1
                sizes.append(r["size"])
            stock[r["product_id"]] = (total, available, sizes)

    products = []
    for row in rows:
        summary = row_to_summary(row)
        total, available, sizes = stock.get(row["product_id"], (0, 0, []))
        summary.total_quantity = total
        summary.sizes_available = available
        summary.sizes_in_stock = [s for s in SIZE_ORDER if s in sizes]
        products.append(summary)

    if category and category.lower() != "all":
        products = [p for p in products if p.category.lower() == category.lower()]

    if search:
        # search_tags is a JSON array in a TEXT column, so match against the parsed
        # values rather than LIKE-ing the raw string (which matches across elements).
        needle = search.lower().strip()
        by_id = {row["product_id"]: row for row in rows}
        products = [
            product
            for product in products
            if needle
            in " ".join(
                [
                    product.name,
                    product.description,
                    product.garment_type,
                    *product.colors,
                    *parse_json_list(by_id[product.product_id]["search_tags"]),
                ]
            ).lower()
        ]

    return products


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def get_product(product_id: str) -> ProductDetail:
    with closing(connect()) as conn:
        product = load_product(conn, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"No product '{product_id}'")
    return product


# -------------------------------------------------------------------------- chat


# The prompt asks for at most four; this enforces it, so a chatty run can't flood the
# page with a wall of cards.
MAX_CARDS = 4


def build_cards(product_ids: list[str]) -> list[ProductCard]:
    """Turn the agent's product_ids into cards, reading every field from the database.

    This is the guard that keeps prices and images honest: the model chooses *which*
    products to show, never what they cost or look like. Ids that don't exist — a
    hallucination or a typo — are silently dropped rather than rendered.
    """
    cards: list[ProductCard] = []
    seen: set[str] = set()

    with closing(connect()) as conn:
        for product_id in product_ids[:MAX_CARDS]:
            if product_id in seen:
                continue
            seen.add(product_id)

            row = conn.execute(
                "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
            ).fetchone()
            if row is None:
                logger.warning("Agent returned unknown product_id %r; dropping", product_id)
                continue

            summary = row_to_summary(row)
            cards.append(
                ProductCard(
                    product_id=summary.product_id,
                    name=summary.name,
                    price=summary.price,
                    image_url=summary.image_url,
                    short_description=summary.short_description,
                    category=summary.category,
                )
            )

    return cards


def stored_to_turns(rows: list[sqlite3.Row]) -> list[ChatTurn]:
    return [ChatTurn(role=row["role"], content=row["content"]) for row in rows]


def stored_to_messages(rows: list[sqlite3.Row]) -> list[StoredMessage]:
    """Rebuild persisted turns, including the cards a reply originally showed."""
    messages = []
    for row in rows:
        products: list[ProductCard] = []
        if row["products_json"]:
            try:
                products = [ProductCard(**item) for item in json.loads(row["products_json"])]
            except (json.JSONDecodeError, TypeError, ValueError):
                logger.warning("Unreadable products_json on chat_messages id %s", row["id"])
        messages.append(
            StoredMessage(
                id=row["id"],
                role=row["role"],
                content=row["content"],
                products=products,
                created_at=row["created_at"],
            )
        )
    return messages


@app.get("/api/chat/history", response_model=list[StoredMessage])
def chat_history(user: Annotated[PublicUser, Depends(current_user)]) -> list[StoredMessage]:
    """The signed-in shopper's saved conversation, replayed when they return."""
    return stored_to_messages(load_chat_history(user.id))


@app.delete("/api/chat/history")
def delete_chat_history(user: Annotated[PublicUser, Depends(current_user)]) -> dict[str, int]:
    """Let a shopper delete their own conversation."""
    return {"deleted": clear_chat_history(user.id)}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: Annotated[PublicUser | None, Depends(optional_user)] = None,
) -> ChatResponse:
    """One turn of conversation with the shop assistant.

    Signing in is not required. It changes two things: the assistant is told who it is
    talking to, and the conversation is saved so it is still there on the next visit.
    """
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    # Who is chatting, and what they're looking at — passed as typed deps rather than
    # pasted into the message, so the agent can't confuse it with shopper-typed text.
    deps = CustomerContext(
        user_id=user.id if user else None,
        first_name=user.first_name if user else None,
        last_name=user.last_name if user else None,
        email=user.email if user else None,
        page=payload.page,
    )

    if user:
        # The database is the source of truth for a signed-in shopper: it survives a
        # closed browser, and it can't be edited by the client.
        history = stored_to_turns(load_chat_history(user.id))
    else:
        # Guests aren't persisted, so their transcript can only come from the browser.
        history = payload.history

    try:
        reply = await ask_agent(message, history, deps=deps)
    except UsageLimitExceeded:
        # The runaway guard fired (MAX_TOOL_STEPS). The usual cause is the agent
        # re-running a search that legitimately has no matches. The shopper asked a fair
        # question, so answer like a person who came up empty rather than showing them a
        # gateway error. Already recorded as stop_reason=tool_limit_exceeded.
        logger.warning("Tool limit reached; answering with a fallback")
        return ChatResponse(
            reply=(
                "Sorry — I couldn't pin that one down. Could you try asking a slightly "
                "different way, or tell me the garment and color you're after?"
            )
        )
    except ModelHTTPError as error:
        # The gateway runs its own content filter and rejects some prompts — notably
        # jailbreak attempts — before the model ever sees them. That is a refusal, not an
        # outage, so answer in character instead of showing an error.
        if "content_filter" in str(error.body):
            logger.info("Gateway content filter declined a message")
            return ChatResponse(
                reply=(
                    "I can't help with that one. I'm here for Campus Customs gear, "
                    "though — want me to find you something?"
                )
            )
        logger.exception("Agent run failed")
        raise HTTPException(
            status_code=502,
            detail="The assistant is having trouble right now. Please try again.",
        )
    except Exception:
        # Log the detail for us; return something a shopper can act on.
        logger.exception("Agent run failed")
        raise HTTPException(
            status_code=502,
            detail="The assistant is having trouble right now. Please try again.",
        )

    cards = build_cards(reply.product_ids)

    if user:
        # Save after a successful turn, so a failed run doesn't leave a dangling question.
        save_chat_message(user.id, "user", message)
        save_chat_message(
            user.id,
            "assistant",
            reply.reply,
            [card.model_dump() for card in cards] if cards else None,
        )

    return ChatResponse(reply=reply.reply, products=cards)
