"""Database access, and the tools the agent is allowed to call.

Everything the chatbot knows about products comes through here. The agent has no other
route to the catalogue, which is what makes "honest about price and stock" enforceable
rather than aspirational: it cannot quote a number that did not come out of this file.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path

import search
from models import (
    PriceAnswer,
    ProductDetail,
    ProductInfo,
    ProductSummary,
    SizeAvailability,
    SizeStock,
    StockReport,
    ToolProduct,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
LOW_STOCK = 3

# Keep tool results small: a long list wastes context and makes the model less decisive.
MAX_RESULTS = 6


# ---------------------------------------------------------------------------- db


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise RuntimeError(f"Database not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def parse_json_list(raw: str) -> list[str]:
    """colors and search_tags are TEXT columns holding JSON arrays."""
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(item) for item in value] if isinstance(value, list) else []


def normalize_category(garment_type: str) -> str:
    """The catalogue has 22 garment_type spellings for about six real categories.

    Order matters: "short-sleeve crew-neck t-shirt" must land in T-Shirts, not Crewnecks.
    """
    g = garment_type.lower()
    if "hood" in g:
        return "Hoodies"
    if "quarter-zip" in g or "1/4 zip" in g:
        return "Quarter-Zips"
    if "jacket" in g:
        return "Jackets & Fleece"
    if "performance" in g:
        return "Performance"
    if "t-shirt" in g or "tee" in g:
        return "T-Shirts"
    if "crew" in g or "mockneck" in g:
        return "Crewnecks"
    return "Other"


CATEGORIES = [
    "Hoodies",
    "Crewnecks",
    "T-Shirts",
    "Quarter-Zips",
    "Jackets & Fleece",
    "Performance",
]


def resolve_category(value: str) -> str | None:
    """Map a loosely-worded category onto one of the six canonical names.

    The agent passes along roughly what the shopper said — "hoodies", "hoodie",
    "hooded sweatshirt". The filter used to be an exact, case-sensitive compare against
    "Hoodies", so every one of those matched nothing: the audit trail shows a run
    spending two tool calls on empty `category=` searches before stumbling onto a plain
    text query, and one run exhausting its whole six-call budget that way.

    `normalize_category` already knows how to fold 22 garment_type spellings into six
    names, so reuse it rather than inventing a second vocabulary.

    Returns None when the string names nothing the shop carries, which the caller treats
    as "no matches" rather than "no filter" — the shop genuinely has no socks.
    """
    text = value.strip()
    if not text:
        return None

    for canonical in CATEGORIES:
        if text.casefold() == canonical.casefold():
            return canonical

    # normalize_category keys off hyphenated spellings ("quarter-zip"), so try the
    # spaced form the shopper is more likely to type as well.
    for variant in (text, text.replace(" ", "-"), text.replace("-", " ")):
        guess = normalize_category(variant)
        if guess != "Other":
            return guess

    # "fleece" on its own doesn't contain "jacket", but it is that aisle.
    if "fleece" in text.casefold():
        return "Jackets & Fleece"

    return None


def shorten(description: str, limit: int = 120) -> str:
    """Card-sized blurb: cut on a word boundary rather than mid-word."""
    if len(description) <= limit:
        return description
    return description[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def row_to_summary(row: sqlite3.Row) -> ProductSummary:
    return ProductSummary(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        category=normalize_category(row["garment_type"]),
        description=row["description"],
        short_description=shorten(row["description"]),
        colors=parse_json_list(row["colors"]),
        price=row["price"],
        image_url=f"/static/{row['image_file_path']}",
    )


def load_product(conn: sqlite3.Connection, product_id: str) -> ProductDetail | None:
    row = conn.execute(
        "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
    ).fetchone()
    if row is None:
        return None

    stock_rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    by_size = {r["size"]: r["quantity"] for r in stock_rows}
    sizes = [
        SizeStock(size=size, quantity=by_size[size]) for size in SIZE_ORDER if size in by_size
    ]

    summary = row_to_summary(row).model_dump()
    # ProductDetail restates these, so drop the parent's defaults before splatting.
    summary.pop("total_quantity", None)
    summary.pop("sizes_available", None)

    return ProductDetail(
        **summary,
        search_tags=parse_json_list(row["search_tags"]),
        sizes=sizes,
        total_quantity=sum(s.quantity for s in sizes),
        sizes_available=sum(1 for s in sizes if s.quantity > 0),
    )


def money(price: float) -> str:
    """Format a price once, here, so the model never has to render a float itself."""
    return f"${price:.2f}"


def _size_rows(conn: sqlite3.Connection, product_id: str) -> dict[str, int]:
    rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    return {r["size"]: r["quantity"] for r in rows}


def _availability(by_size: dict[str, int]) -> list[SizeAvailability]:
    """Turn raw quantities into labeled availability, in the order shoppers think in."""
    out = []
    for size in SIZE_ORDER:
        if size not in by_size:
            continue
        quantity = by_size[size]
        if quantity == 0:
            status = "sold out"
        elif quantity <= LOW_STOCK:
            status = f"low stock — only {quantity} left"
        else:
            status = "in stock"
        out.append(
            SizeAvailability(
                size=size, quantity=quantity, available=quantity > 0, status=status
            )
        )
    return out


def _stock_summary(name: str, sizes: list[SizeAvailability]) -> str:
    """One ready-to-say sentence covering the whole size run."""
    available = [s for s in sizes if s.available]
    sold_out = [s.size for s in sizes if not s.available]

    if not available:
        return f"{name} is sold out in every size right now."

    parts = [f"{name} is available in {', '.join(s.size for s in available)}"]
    low = [s for s in available if s.quantity <= LOW_STOCK]
    if low:
        parts.append(
            "only " + ", ".join(f"{s.quantity} left in {s.size}" for s in low)
        )
    if sold_out:
        parts.append(f"sold out in {', '.join(sold_out)}")
    return "; ".join(parts) + "."


def _to_tool_product(conn: sqlite3.Connection, row: sqlite3.Row) -> ToolProduct:
    by_size = _size_rows(conn, row["product_id"])

    return ToolProduct(
        product_id=row["product_id"],
        name=row["name"],
        category=normalize_category(row["garment_type"]),
        description=row["description"],
        colors=parse_json_list(row["colors"]),
        price=row["price"],
        price_display=money(row["price"]),
        sizes_in_stock=[s for s in SIZE_ORDER if by_size.get(s, 0) > 0],
        sizes_sold_out=[s for s in SIZE_ORDER if s in by_size and by_size[s] == 0],
    )


# ------------------------------------------------------------------------- tools


def search_products(
    query: str = "",
    color: str | None = None,
    category: str | None = None,
    max_price: float | None = None,
) -> list[ToolProduct]:
    """Search the Campus Customs catalogue.

    Args:
        query: What the shopper is after — a garment, team, sport, residential college,
            event, or graphic. Matched against names, descriptions, and search tags.
        color: Restrict to products available in this color, e.g. "navy".
        category: One of Hoodies, Crewnecks, T-Shirts, Quarter-Zips, Jackets & Fleece,
            Performance.
        max_price: Only products at or below this price in dollars.

    Returns up to six products, each with its real price and which sizes are in stock.
    """
    wanted_category: str | None = None
    if category and category.strip():
        wanted_category = resolve_category(category)
        if wanted_category is None:
            # A category the shop doesn't carry. Returning everything unfiltered would
            # invite the agent to answer "here are our socks" with six sweatshirts.
            return []

    with closing(connect()) as conn:
        rows = {row["product_id"]: row for row in conn.execute("SELECT * FROM catalogue")}

        def passes_filters(row: sqlite3.Row) -> bool:
            if color:
                colors = [c.lower() for c in parse_json_list(row["colors"])]
                if not any(color.lower() in c for c in colors):
                    return False
            if wanted_category and normalize_category(row["garment_type"]) != wanted_category:
                return False
            if max_price is not None and row["price"] > max_price:
                return False
            return True

        if query.strip():
            # Relevance order comes from the FTS index (synonyms + typo repair applied).
            ordered = [rows[pid] for pid in search.search_ids(query) if pid in rows]
        else:
            # No query — the filters alone are the search.
            ordered = sorted(rows.values(), key=lambda r: r["name"])

        matched = [row for row in ordered if passes_filters(row)]
        return [_to_tool_product(conn, row) for row in matched[:MAX_RESULTS]]


def get_product_info(product_id: str) -> ProductInfo | None:
    """Look up one product: its description, price, colors, and stock in every size.

    Use this whenever the shopper asks what an item is, what it looks like, what it's
    made of, or for any detail about a product already mentioned.

    Args:
        product_id: Exact product_id from a previous search result.

    Returns None if no such product exists — say the shop doesn't carry it rather than
    inventing one.
    """
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            return None

        sizes = _availability(_size_rows(conn, product_id))

    return ProductInfo(
        product_id=row["product_id"],
        name=row["name"],
        category=normalize_category(row["garment_type"]),
        garment_type=row["garment_type"],
        description=row["description"],
        colors=parse_json_list(row["colors"]),
        price=row["price"],
        price_display=money(row["price"]),
        sizes=sizes,
        sizes_in_stock=[s.size for s in sizes if s.available],
        sizes_sold_out=[s.size for s in sizes if not s.available],
        stock_summary=_stock_summary(row["name"], sizes),
    )


def get_price(product_id: str) -> PriceAnswer | None:
    """Look up the exact current price of one product.

    Call this for any question about cost. Quote `price_display` verbatim — never
    calculate, round, or estimate a price yourself.

    Args:
        product_id: Exact product_id from a previous search result.
    """
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT product_id, name, price, garment_type FROM catalogue WHERE product_id = ?",
            (product_id,),
        ).fetchone()

    if row is None:
        return None

    return PriceAnswer(
        product_id=row["product_id"],
        name=row["name"],
        price=row["price"],
        price_display=money(row["price"]),
        category=normalize_category(row["garment_type"]),
    )


def check_stock(product_id: str, size: str | None = None) -> StockReport | None:
    """Check how many of a product are in stock, by size.

    Call this for every availability question — never answer from memory or from an
    earlier turn, because stock changes.

    Args:
        product_id: Exact product_id from a previous search result.
        size: One of XS, S, M, L, XL, XXL. Omit it to get the full size run, which is
            the better choice when the shopper hasn't named a size.

    Returns the true quantity on hand. Report zero as sold out, plainly.
    """
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT product_id, name FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            return None

        all_sizes = _availability(_size_rows(conn, product_id))

    name = row["name"]

    if size is None:
        return StockReport(
            product_id=product_id,
            name=name,
            size=None,
            sizes=all_sizes,
            any_available=any(s.available for s in all_sizes),
            summary=_stock_summary(name, all_sizes),
        )

    normalized = size.strip().upper()
    match = next((s for s in all_sizes if s.size == normalized), None)

    if match is None:
        # Asked for a size the shop doesn't carry at all (e.g. "XXXL").
        carried = ", ".join(s.size for s in all_sizes)
        return StockReport(
            product_id=product_id,
            name=name,
            size=normalized,
            sizes=all_sizes,
            any_available=any(s.available for s in all_sizes),
            summary=(
                f"We don't carry {name} in size {normalized}. It comes in {carried}."
            ),
        )

    if match.available:
        summary = (
            f"Only {match.quantity} left in {normalized}."
            if match.quantity <= LOW_STOCK
            else f"{name} is in stock in {normalized} ({match.quantity} available)."
        )
    else:
        others = [s.size for s in all_sizes if s.available]
        summary = f"{name} is sold out in {normalized}."
        if others:
            summary += f" It is still available in {', '.join(others)}."

    return StockReport(
        product_id=product_id,
        name=name,
        size=normalized,
        sizes=[match],
        any_available=match.available,
        summary=summary,
    )


def list_categories() -> list[str]:
    """List the product categories Campus Customs carries, with how many items are in each."""
    with closing(connect()) as conn:
        rows = conn.execute("SELECT garment_type FROM catalogue").fetchall()

    counts: dict[str, int] = {}
    for row in rows:
        category = normalize_category(row["garment_type"])
        counts[category] = counts.get(category, 0) + 1

    return [
        f"{name} ({count} items)"
        for name, count in sorted(counts.items(), key=lambda item: -item[1])
    ]


# ----------------------------------------------------------------- chat history


# Enough to keep a conversation coherent without sending an unbounded transcript to the
# model on every turn.
HISTORY_LIMIT = 20


def save_chat_message(
    user_id: int, role: str, content: str, products: list[dict] | None = None
) -> None:
    """Persist one turn for a signed-in shopper.

    Guests are never written to the database — `chat()` simply doesn't call this for them.
    """
    with closing(connect()) as conn:
        conn.execute(
            """INSERT INTO chat_messages (user_id, role, content, products_json)
               VALUES (?, ?, ?, ?)""",
            (user_id, role, content, json.dumps(products) if products else None),
        )
        conn.commit()


def load_chat_history(user_id: int, limit: int = HISTORY_LIMIT) -> list[sqlite3.Row]:
    """The most recent turns for one shopper, oldest first.

    Scoped by user_id, so one shopper can never see another's conversation.
    """
    with closing(connect()) as conn:
        rows = conn.execute(
            """SELECT id, role, content, products_json, created_at
               FROM chat_messages
               WHERE user_id = ?
               ORDER BY id DESC
               LIMIT ?""",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def clear_chat_history(user_id: int) -> int:
    """Delete a shopper's stored conversation. Returns how many turns were removed."""
    with closing(connect()) as conn:
        cursor = conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount


def price_range() -> str:
    """The overall price range of the catalogue, for 'how much is your stuff?' questions."""
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT MIN(price) AS low, MAX(price) AS high FROM catalogue"
        ).fetchone()
    return f"Products run from {money(row['low'])} to {money(row['high'])}."


def build_search_index() -> None:
    """Populate the in-memory FTS index. Called once at API startup."""
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT product_id, name, garment_type, colors, search_tags, description FROM catalogue"
        ).fetchall()
    search.build_index(rows)
