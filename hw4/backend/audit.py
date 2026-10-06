"""Append-only audit trail for the Campus Customs agent loop.

Every agent run, every tool call, and every rejected reply is appended to
`output/audit_trail.json`. The file is **append-only**: it is opened in `"a"` mode and
never truncated, so restarting the server or running the agent again adds to the record
rather than replacing it.

### Format

One complete JSON object per line (JSON Lines). This is what makes "append-only" real —
a single `"a"`-mode write of one line can't corrupt earlier entries, and a crash
mid-write costs at most the last line. A top-level JSON array would have to be read,
re-serialized, and rewritten on every tool call, which is exactly the "wipe it between
runs" failure mode this is meant to avoid.

Read it back with one `json.loads` per line:

    with open("output/audit_trail.json") as f:
        records = [json.loads(line) for line in f if line.strip()]

### What is recorded

| Event | When | Key fields |
|---|---|---|
| `run_start` | A chat turn begins | `actor`, `message`, `page`, `history_turns` |
| `tool_call` | A tool returns | `tool`, `args`, `result`, `ms` |
| `output_rejected` | The validator refuses a reply | `reason` |
| `run_end` | The turn finishes, however it finishes | `stop_reason`, `tool_calls`, `ms` |

### What is deliberately not recorded

The shopper's email address, their session token, the Portkey API key, and anything
password-related. The trail answers *what the agent did*, which needs the tool names,
the arguments, and the shape of what came back — not a second copy of the customer's
personal details. A signed-in shopper appears as `user:3`, a guest as `guest`.

Shopper messages and tool results are truncated (see `MESSAGE_CHARS` / `RESULT_CHARS`),
both to keep the file readable and to keep it from becoming a transcript in its own
right.

### Failure policy

Auditing never breaks a conversation. Every write is wrapped: if the file can't be
written, the failure is logged once to the server log and the chat turn continues.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("campus_customs.audit")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = PROJECT_ROOT / "output" / "audit_trail.json"

# Truncation limits. Long enough to tell what happened, short enough that the file stays
# skimmable and doesn't quietly become a full conversation log.
MESSAGE_CHARS = 160
RESULT_CHARS = 200
ARG_CHARS = 80

# One process may serve several chat turns at once, and PydanticAI runs sync tools in a
# worker thread. A lock keeps two appends from interleaving inside one line.
_write_lock = threading.Lock()

# Only complain about an unwritable trail once, rather than on every tool call.
_warned = False


def new_run_id() -> str:
    """A short id tying one turn's records together."""
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


# Patterns worth scrubbing before anything a shopper typed reaches the file.
#
# The prompt tells the assistant never to ask for these, and it doesn't — but a shopper
# can volunteer one unprompted, and the first test run of this module duly wrote a test
# card number into the trail. An audit log is a file that gets committed, copied, and
# read by people who have no business seeing a card number, so it gets scrubbed here
# rather than trusted not to receive one.
_REDACTIONS = [
    # 13–19 digits, optionally in groups — card numbers. Ends on a digit so the match
    # doesn't swallow the space after it.
    (re.compile(r"\b\d(?:[ -]?\d){12,18}\b"), "[redacted-number]"),
    # US Social Security number.
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[redacted-ssn]"),
    # Long opaque tokens: API keys, session tokens, bearer strings.
    (re.compile(r"\b[A-Za-z0-9_-]{32,}\b"), "[redacted-token]"),
]


def redact(text: str) -> str:
    """Remove things that must never be written to an audit file.

    Applied to shopper-typed text only. Tool arguments and results come from the
    catalogue, which contains no secrets.
    """
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def truncate(text: str, limit: int) -> str:
    """Shorten `text`, marking that it was shortened."""
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def describe(value: Any) -> str:
    """A short, readable summary of what a tool returned.

    Tool results are Pydantic models or lists of them. Logging them in full would make
    the trail enormous and would duplicate the database; what matters for an audit is
    *how many* rows came back and *which* ones, so a reader can check the agent's reply
    against them.
    """
    if value is None:
        return "None"

    if isinstance(value, list):
        if not value:
            return "[] (no matches)"
        ids = [getattr(item, "product_id", None) for item in value]
        named = [pid for pid in ids if pid]
        if named:
            return truncate(f"{len(value)} result(s): {', '.join(named)}", RESULT_CHARS)
        return truncate(f"{len(value)} result(s): {', '.join(str(v) for v in value)}", RESULT_CHARS)

    # A single Pydantic model — prefer the fields an auditor would actually check.
    for field in ("summary", "stock_summary", "price_display"):
        text = getattr(value, field, None)
        if text:
            product_id = getattr(value, "product_id", None)
            prefix = f"{product_id}: " if product_id else ""
            return truncate(prefix + str(text), RESULT_CHARS)

    product_id = getattr(value, "product_id", None)
    if product_id:
        return truncate(str(product_id), RESULT_CHARS)

    return truncate(str(value), RESULT_CHARS)


def describe_args(args: dict[str, Any]) -> dict[str, Any]:
    """Keep the arguments that were actually supplied, each one short."""
    kept: dict[str, Any] = {}
    for key, value in args.items():
        if value is None or value == "":
            continue
        kept[key] = truncate(value, ARG_CHARS) if isinstance(value, str) else value
    return kept


def log(event: str, **fields: Any) -> None:
    """Append one record. Never raises."""
    global _warned

    record = {"ts": _now(), "event": event, **fields}
    try:
        line = json.dumps(record, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        logger.warning("Could not serialize audit record for event %r", event)
        return

    try:
        with _write_lock:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            # "a" — append. The file is never opened for writing or truncation anywhere
            # in this project, which is what makes the trail append-only.
            with AUDIT_PATH.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
    except OSError as error:
        if not _warned:
            logger.warning("Audit trail is not writable (%s); continuing without it", error)
            _warned = True


def read_records() -> list[dict[str, Any]]:
    """Read the trail back. Used by the tests and for inspecting a session."""
    if not AUDIT_PATH.exists():
        return []
    records = []
    for line in AUDIT_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            logger.warning("Skipping unreadable audit line")
    return records
