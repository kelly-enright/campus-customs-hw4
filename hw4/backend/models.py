"""Shared Pydantic types for Campus Customs.

Three groups:
  * catalogue types the REST API returns to the website
  * agent types — what the model is allowed to hand back
  * chat types — the request/response envelope for /api/chat
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

# --------------------------------------------------------------------- catalogue


class SizeStock(BaseModel):
    size: str
    quantity: int

    @property
    def in_stock(self) -> bool:
        return self.quantity > 0


class ProductSummary(BaseModel):
    product_id: str
    name: str
    garment_type: str
    category: str
    description: str
    short_description: str
    colors: list[str]
    price: float
    image_url: str
    # Stock rollup, so the catalogue grid can show "Only N left" without a request per
    # card. Populated by /api/products; left at 0 elsewhere.
    total_quantity: int = 0
    sizes_available: int = 0
    # Which sizes are actually on the shelf, in wearing order — drives the size pips on
    # the catalogue cards.
    sizes_in_stock: list[str] = Field(default_factory=list)


class ProductDetail(ProductSummary):
    search_tags: list[str]
    sizes: list[SizeStock]
    total_quantity: int


# -------------------------------------------------------------------------- auth


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    # Deliberately unconstrained: a Field() violation makes Pydantic echo the offending
    # value back in the 422 body, which would put the password in the response and in any
    # log that records it. password_problem() checks it instead.
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PublicUser(BaseModel):
    """Everything the client is allowed to know about an account.

    Has no password field, so a hash cannot leak through a response model even if a
    future query starts selecting one.
    """

    id: int
    first_name: str | None
    last_name: str | None
    name: str
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: PublicUser


# ------------------------------------------------------------------------- agent


class ToolProduct(BaseModel):
    """A catalogue row as the agent sees it, used for search results.

    Every field here came from the database on this turn — there is nothing for the model
    to estimate. `price_display` is pre-formatted so the model copies a string rather than
    rendering a float (which is how "$58.0" and "$57.99" happen).
    """

    product_id: str
    name: str
    category: str
    description: str
    colors: list[str]
    price: float
    price_display: str
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]


class SizeAvailability(BaseModel):
    """Stock for one size of one product."""

    size: str
    quantity: int
    available: bool
    # A plain-language label, so "low stock" is decided here rather than by the model
    # picking its own threshold.
    status: str


class StockReport(BaseModel):
    """The answer to a stock question — one size, or the whole size run.

    `summary` is a ready-to-say sentence. The model may reword it, but having it means a
    correct answer exists even if the model only echoes.
    """

    product_id: str
    name: str
    size: str | None
    sizes: list[SizeAvailability]
    any_available: bool
    summary: str


class PriceAnswer(BaseModel):
    """The answer to a price question."""

    product_id: str
    name: str
    price: float
    price_display: str
    category: str


class ProductInfo(BaseModel):
    """Everything known about one product: description, price, and full stock breakdown.

    This is the "tell me about that one" tool result — deliberately complete, so a
    follow-up question ("what colors?", "does it come in large?") can usually be answered
    without another round trip.
    """

    product_id: str
    name: str
    category: str
    garment_type: str
    description: str
    colors: list[str]
    price: float
    price_display: str
    sizes: list[SizeAvailability]
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    stock_summary: str


class AgentReply(BaseModel):
    """The agent's structured output.

    The agent returns product *ids*, not product cards. The server then looks each one up
    and builds the card from the database, so a price or image on screen can never be
    something the model made up — and an invented id simply drops out.
    """

    reply: str = Field(description="The message to show the shopper, in Campus Customs' voice.")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id values to display as cards beneath the reply. Only ids returned by "
            "a tool on this turn. Empty when no specific product is being recommended."
        ),
    )


# -------------------------------------------------------------------------- chat


class ProductCard(BaseModel):
    """What the chat panel renders beneath a reply. Built server-side from the DB."""

    product_id: str
    name: str
    price: float
    image_url: str
    short_description: str
    category: str


class ChatTurn(BaseModel):
    role: str
    content: str


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message.

    This is what makes "do you have this in pink?" answerable: without it, "this" has no
    referent, because the shopper never named the product in the conversation.
    """

    path: str = ""
    # Present when they're on a product detail page.
    product_id: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Used for guests. For signed-in shoppers the server loads history from the database
    # instead, so the transcript is authoritative and survives a closed browser.
    history: list[ChatTurn] = Field(default_factory=list, max_length=40)
    page: PageContext | None = None


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)


class StoredMessage(BaseModel):
    """One persisted turn, replayed into the panel when a shopper returns."""

    id: int
    role: str
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str
