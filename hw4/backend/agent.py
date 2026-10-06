"""PydanticAI agent wiring for the Campus Customs assistant.

The agent is assembled from three things:
  1. the system prompt in prompts/prompt.md (edited as text, not buried in code)
  2. the tools in tools.py (its only route to the catalogue)
  3. a chat model reached through the Portkey gateway
"""

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field
from functools import lru_cache
from itertools import combinations_with_replacement
from pathlib import Path

from dotenv import load_dotenv
from pydantic_ai import Agent, ModelRetry, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

import audit
from models import (
    AgentReply,
    ChatTurn,
    PageContext,
    PriceAnswer,
    ProductInfo,
    StockReport,
    ToolProduct,
)
from tools import (
    check_stock,
    get_price,
    get_product_info,
    list_categories,
    price_range,
    search_products,
)

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"

PORTKEY_BASE_URL = "https://api.portkey.ai/v1"

# The course gateway currently routes every request to one model regardless of the name
# sent, so this is really a label. Overridable in case that changes.
DEFAULT_MODEL = "gpt-5-mini"

# The assistant should answer from tools in a couple of hops; this is a runaway guard.
MAX_TOOL_STEPS = 6


@dataclass
class Observations:
    """What the tools actually returned during one run.

    The anti-hallucination validator checks the agent's reply against this. Anything the
    agent says about a product or a price has to appear here first, because here is the
    only place catalogue data enters the conversation.
    """

    product_ids: set[str] = field(default_factory=set)
    prices: set[float] = field(default_factory=set)

    def record_product(self, product_id: str, price: float | None = None) -> None:
        self.product_ids.add(product_id)
        if price is not None:
            self.prices.add(round(float(price), 2))

    def allowed_amounts(self) -> set[float]:
        """Prices the agent may legitimately state.

        Every observed price, plus sums of up to four of them — the prompt permits adding
        real prices ("what would three of these cost?"), so a genuine total shouldn't be
        treated as a fabrication.
        """
        allowed = set(self.prices)
        values = sorted(self.prices)
        if values:
            for size in (2, 3, 4):
                for combo in combinations_with_replacement(values, size):
                    allowed.add(round(sum(combo), 2))
        return allowed


@dataclass
class CustomerContext:
    """Per-conversation context handed to the agent as PydanticAI *deps*.

    This is the "put code into the agent context" pattern: rather than pasting the
    shopper's details into the message text, they travel as typed data that the dynamic
    system prompt and any tool can read through `RunContext`.

    Two things live here, and nothing else:

      * **Who is chatting** — first name and email, so the assistant can greet them and
        so nothing about identity has to be guessed. `user_id` is present only for
        signed-in shoppers; `None` means a guest.
      * **Where they are** — the page they're on, and the product they're looking at if
        it's a detail page. This is what gives "do you have this in pink?" a referent.

    Deliberately absent: the password hash, the session token, and every other account
    field. The agent sees a name and an email address because those improve the
    conversation; it has no reason to see anything else, so it isn't given anything else.
    """

    user_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    page: PageContext | None = None

    # Filled in by the tools as they run; read by the output validator.
    observed: Observations = field(default_factory=Observations)

    # Audit bookkeeping. `run_id` ties every record from one turn together; `tool_calls`
    # is what the run_end record reports. Set by ask_agent().
    run_id: str = ""
    tool_calls: int = 0

    @property
    def is_signed_in(self) -> bool:
        return self.user_id is not None

    @property
    def display_name(self) -> str | None:
        if self.first_name and self.first_name.strip():
            return self.first_name.strip()
        return None


def _audited(ctx: RunContext[CustomerContext], tool: str, call, **args):
    """Run a tool, count it, and append one `tool_call` record to the audit trail.

    Wrapping every tool in one place means the trail cannot drift out of step with what
    the agent can actually do: a new tool that isn't routed through here simply has no
    audit record, which is obvious the first time anyone reads the file.
    """
    started = time.perf_counter()
    result = call()
    ctx.deps.tool_calls += 1
    audit.log(
        "tool_call",
        run_id=ctx.deps.run_id,
        tool=tool,
        args=audit.describe_args(args),
        result=audit.describe(result),
        ms=round((time.perf_counter() - started) * 1000, 1),
    )
    return result


def _load_environment() -> None:
    """Find the .env holding PORTKEY_API_KEY.

    It lives one level above the project on this machine, so check there as well as in
    the project itself. Never logged or echoed.
    """
    for candidate in (PROJECT_ROOT / ".env", PROJECT_ROOT.parent / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def load_system_prompt() -> str:
    """Read the prompt from disk.

    Kept as a file, not a string literal, so the prompt can be edited and reviewed on its
    own — it grows in later problems.
    """
    if not PROMPT_PATH.exists():
        raise RuntimeError(f"System prompt not found at {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def _build_model() -> OpenAIChatModel:
    _load_environment()

    api_key = os.environ.get("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "PORTKEY_API_KEY is not set. Add it to a .env file at the project root "
            "(or one directory above it), or export it before starting the server."
        )

    # Portkey speaks the OpenAI chat-completions protocol, so the stock OpenAI provider
    # works as long as it is pointed at the gateway.
    return OpenAIChatModel(
        os.environ.get("CAMPUS_CUSTOMS_MODEL", DEFAULT_MODEL),
        provider=OpenAIProvider(base_url=PORTKEY_BASE_URL, api_key=api_key),
    )


@lru_cache(maxsize=1)
def get_agent() -> Agent[CustomerContext, AgentReply]:
    """Build the agent once and reuse it across requests."""
    agent = Agent(
        _build_model(),
        deps_type=CustomerContext,
        output_type=AgentReply,
        system_prompt=load_system_prompt(),
        retries=2,
    )

    @agent.system_prompt
    def who_is_chatting(ctx: RunContext[CustomerContext]) -> str:
        """Appended to the static prompt on every run, from the deps.

        Built here rather than pasted into the user's message so that it cannot be
        confused with something the shopper typed — a message claiming "I am Kelly" is
        just text, while this is the server's own statement.
        """
        deps = ctx.deps
        if not deps.is_signed_in:
            return (
                "## Who you're talking to\n\n"
                "This shopper is browsing as a guest — you don't know their name, and "
                "their conversation isn't saved. Don't ask them to sign in unless they "
                "bring it up; just help them shop."
            )

        lines = ["## Who you're talking to\n"]
        if deps.display_name:
            lines.append(f"- Name: {deps.display_name}")
        if deps.email:
            lines.append(f"- Email on the account: {deps.email}")
        lines.append(
            "\nThey're signed in, so this conversation continues from earlier visits. "
            "Use their first name naturally — once, not in every message. Never read "
            "their email address back to them unless they ask, and never ask them to "
            "confirm a password or payment detail."
        )
        return "\n".join(lines)

    @agent.system_prompt
    def where_they_are(ctx: RunContext[CustomerContext]) -> str:
        """Tell the agent which page the shopper is on, and what's on it."""
        page = ctx.deps.page
        if page is None or not page.path:
            return ""

        if page.product_id:
            product = get_product_info(page.product_id)
            if product:
                return (
                    "## What they're looking at\n\n"
                    f"They are on the product page for **{product.name}** "
                    f"(product_id `{product.product_id}`, {product.price_display}).\n\n"
                    'If they say "this", "it", or "this one" without naming a product, '
                    "they mean this item. Use `get_page_product` or pass this product_id "
                    "to the lookup tools — don't search for it by name."
                )

        where = {
            "/": "the home page",
            "/products": "the full catalogue listing",
            "/about": "the About Us page",
        }.get(page.path)
        return f"## What they're looking at\n\nThey are on {where}." if where else ""

    @agent.tool
    def get_page_product(ctx: RunContext[CustomerContext]) -> ProductInfo | None:
        """The product the shopper is currently viewing on the website.

        Call this when they refer to an item without naming it — "this", "it", "this
        one", "do you have this in pink?" — to find out which product they mean, along
        with its description, price, colors, and stock in every size.

        Returns None if they aren't on a product page; in that case ask which item they
        mean rather than guessing.
        """
        page = ctx.deps.page
        if page is None or not page.product_id:
            return _audited(ctx, "get_page_product", lambda: None)
        return _audited(
            ctx,
            "get_page_product",
            lambda: get_product_info(page.product_id),
            product_id=page.product_id,
        )

    # The catalogue tools are wrapped so that everything they return is recorded in
    # deps.observed. The wrappers keep the originals' docstrings, which are what the
    # model reads as tool descriptions.

    @agent.tool
    def search_catalogue(
        ctx: RunContext[CustomerContext],
        query: str = "",
        color: str | None = None,
        category: str | None = None,
        max_price: float | None = None,
    ) -> list[ToolProduct]:
        results = _audited(
            ctx,
            "search_catalogue",
            lambda: search_products(query, color, category, max_price),
            query=query,
            color=color,
            category=category,
            max_price=max_price,
        )
        for product in results:
            ctx.deps.observed.record_product(product.product_id, product.price)
        return results

    search_catalogue.__doc__ = search_products.__doc__

    @agent.tool
    def product_details(ctx: RunContext[CustomerContext], product_id: str) -> ProductInfo | None:
        product = _audited(
            ctx,
            "product_details",
            lambda: get_product_info(product_id),
            product_id=product_id,
        )
        if product:
            ctx.deps.observed.record_product(product.product_id, product.price)
        return product

    product_details.__doc__ = get_product_info.__doc__

    @agent.tool
    def product_price(ctx: RunContext[CustomerContext], product_id: str) -> PriceAnswer | None:
        answer = _audited(
            ctx,
            "product_price",
            lambda: get_price(product_id),
            product_id=product_id,
        )
        if answer:
            ctx.deps.observed.record_product(answer.product_id, answer.price)
        return answer

    product_price.__doc__ = get_price.__doc__

    @agent.tool
    def product_stock(
        ctx: RunContext[CustomerContext], product_id: str, size: str | None = None
    ) -> StockReport | None:
        report = _audited(
            ctx,
            "product_stock",
            lambda: check_stock(product_id, size),
            product_id=product_id,
            size=size,
        )
        if report:
            ctx.deps.observed.record_product(report.product_id)
        return report

    product_stock.__doc__ = check_stock.__doc__

    # Takes a RunContext it doesn't otherwise need, so that it is audited like the rest.
    @agent.tool
    def shop_categories(ctx: RunContext[CustomerContext]) -> list[str]:
        return _audited(ctx, "shop_categories", list_categories)

    shop_categories.__doc__ = list_categories.__doc__

    @agent.tool
    def shop_price_range(ctx: RunContext[CustomerContext]) -> str:
        answer = _audited(ctx, "shop_price_range", price_range)
        # Record the endpoints so quoting "from $32.00 to $98.00" isn't flagged.
        for amount in re.findall(r"\$(\d+(?:\.\d{2})?)", answer):
            ctx.deps.observed.prices.add(round(float(amount), 2))
        return answer

    shop_price_range.__doc__ = price_range.__doc__

    @agent.output_validator
    def no_invented_facts(ctx: RunContext[CustomerContext], output: AgentReply) -> AgentReply:
        """Reject a reply containing a product or price no tool returned this turn.

        The prompt *tells* the agent not to invent prices and products. This *checks*.
        On a violation the run retries with an explicit correction, so the shopper sees a
        corrected answer rather than a confident wrong one.
        """
        observed = ctx.deps.observed

        unknown_ids = [pid for pid in output.product_ids if pid not in observed.product_ids]
        if unknown_ids:
            audit.log(
                "output_rejected",
                run_id=ctx.deps.run_id,
                reason="unobserved_product_ids",
                detail=", ".join(unknown_ids),
            )
            raise ModelRetry(
                f"These product_ids were not returned by any tool on this turn: "
                f"{', '.join(unknown_ids)}. Only return ids from a tool result. "
                "Search again if you need them."
            )

        # Any dollar figure in the reply has to trace back to a tool result.
        quoted = {
            round(float(amount.replace(",", "")), 2)
            for amount in re.findall(r"\$\s*(\d[\d,]*(?:\.\d{1,2})?)", output.reply)
        }
        if quoted:
            allowed = observed.allowed_amounts()
            invented = sorted(amount for amount in quoted if amount not in allowed)
            if invented:
                audit.log(
                    "output_rejected",
                    run_id=ctx.deps.run_id,
                    reason="unobserved_price",
                    detail=", ".join(f"${amount:.2f}" for amount in invented),
                )
                raise ModelRetry(
                    "Your reply quotes "
                    + ", ".join(f"${amount:.2f}" for amount in invented)
                    + ", which no tool returned this turn. Call get_price or "
                    "search_products for the real price, and quote price_display exactly."
                )

        return output

    return agent


def _to_model_messages(history: list[ChatTurn]):
    """Convert stored turns into PydanticAI message history.

    Built here rather than in main.py so the route stays a thin HTTP wrapper.
    """
    from pydantic_ai.messages import (
        ModelRequest,
        ModelResponse,
        TextPart,
        UserPromptPart,
    )

    messages = []
    for turn in history:
        if not turn.content.strip():
            continue
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        elif turn.role == "assistant":
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages


def _stop_reason_for(error: BaseException) -> str:
    """Classify why a run ended badly, for the audit trail's `stop_reason`.

    Distinguishing these matters: a content-filter refusal is the safety layer working,
    a tool-limit stop is the runaway guard working, and an unexpected error is neither.
    Lumping them together as "error" would hide exactly the events worth auditing.
    """
    from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded

    if isinstance(error, UsageLimitExceeded):
        return "tool_limit_exceeded"
    if isinstance(error, ModelHTTPError):
        if "content_filter" in str(getattr(error, "body", "")):
            return "content_filter"
        return "model_http_error"
    if isinstance(error, UnexpectedModelBehavior):
        # Raised when retries are exhausted — e.g. the output validator rejected the
        # reply twice and the model never produced a clean one.
        return "validation_retries_exhausted"
    return "error"


async def ask_agent(
    message: str,
    history: list[ChatTurn] | None = None,
    deps: CustomerContext | None = None,
) -> AgentReply:
    """Run one turn of conversation and return the agent's structured reply.

    Both ends of the run are written to the audit trail, including the failure paths —
    a turn that ends in a refusal or an error is precisely the kind an auditor wants to
    find later, so it must not be the case that only successful turns get recorded.
    """
    deps = deps or CustomerContext()
    deps.run_id = audit.new_run_id()
    turns = history or []

    audit.log(
        "run_start",
        run_id=deps.run_id,
        actor=f"user:{deps.user_id}" if deps.is_signed_in else "guest",
        message=audit.truncate(audit.redact(message), audit.MESSAGE_CHARS),
        page=deps.page.path if deps.page else None,
        page_product=deps.page.product_id if deps.page else None,
        history_turns=len(turns),
    )

    started = time.perf_counter()

    def elapsed_ms() -> float:
        return round((time.perf_counter() - started) * 1000, 1)

    try:
        result = await get_agent().run(
            message,
            deps=deps,
            message_history=_to_model_messages(turns),
            usage_limits=_usage_limits(),
        )
    except BaseException as error:
        audit.log(
            "run_end",
            run_id=deps.run_id,
            stop_reason=_stop_reason_for(error),
            error=type(error).__name__,
            tool_calls=deps.tool_calls,
            ms=elapsed_ms(),
        )
        raise

    output = result.output
    audit.log(
        "run_end",
        run_id=deps.run_id,
        stop_reason="complete",
        tool_calls=deps.tool_calls,
        product_ids=output.product_ids,
        reply_chars=len(output.reply),
        ms=elapsed_ms(),
    )
    return output


def _usage_limits():
    from pydantic_ai.usage import UsageLimits

    return UsageLimits(tool_calls_limit=MAX_TOOL_STEPS)
