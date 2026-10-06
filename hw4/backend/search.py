"""Full-text catalogue search with synonyms and typo tolerance.

The original search was a substring match, which quietly failed on the words shoppers
actually use: "sweatshirt" missed every crewneck, "jumper" and "hoody" found nothing at
all, and one slipped key ("crewnek") returned an empty page.

This builds a small FTS5 index over the 102-row catalogue and puts two steps in front of
it:

  1. **Synonyms** — shopper vocabulary mapped onto catalogue vocabulary.
  2. **Typo repair** — an unknown word is matched against the catalogue's own vocabulary
     by edit distance before the query runs.

The index lives in memory, built once at startup from the catalogue. The shipped database
file is never modified.
"""

from __future__ import annotations

import difflib
import json
import re
import sqlite3
import threading

# Words shoppers use that the catalogue doesn't, mapped to words it does.
SYNONYMS: dict[str, list[str]] = {
    "sweatshirt": ["sweatshirt", "crewneck", "hoodie", "pullover"],
    "sweater": ["sweatshirt", "crewneck", "fleece"],
    "jumper": ["sweatshirt", "crewneck", "pullover"],
    "hoody": ["hoodie", "hooded"],
    "hoodies": ["hoodie", "hooded"],
    "hood": ["hoodie", "hooded"],
    "tee": ["t-shirt", "tshirt", "shirt"],
    "tees": ["t-shirt", "tshirt", "shirt"],
    "tshirt": ["t-shirt", "tshirt", "shirt"],
    "shirt": ["shirt", "t-shirt"],
    "jacket": ["jacket", "fleece", "bomber"],
    "coat": ["jacket", "fleece", "bomber"],
    "quarterzip": ["quarter-zip", "zip"],
    "halfzip": ["quarter-zip", "zip"],
    "pullover": ["pullover", "hoodie", "crewneck"],
    "crewneck": ["crewneck", "crew"],
    "gym": ["performance", "athletic", "sports"],
    "workout": ["performance", "athletic", "sports"],
    "athletic": ["performance", "athletic", "sports"],
    "game": ["game", "football", "harvard"],
    "tailgate": ["football", "game", "harvard"],
    "grey": ["gray", "grey", "heather"],
    "gray": ["gray", "grey", "heather"],
    "blue": ["blue", "navy"],
    "navy": ["navy", "blue"],
    "warm": ["fleece", "hoodie", "sweatshirt"],
    "cozy": ["fleece", "hoodie", "sweatshirt"],
    "cheap": ["t-shirt"],
    "dog": ["bulldog", "handsome dan"],
    "bulldog": ["bulldog", "handsome dan"],
    "mascot": ["bulldog", "handsome dan"],
    "college": ["college", "residential"],
    "rowing": ["crew", "rowing"],
    "soccer": ["soccer", "football"],
}

# Words too common in this catalogue to narrow anything — every product is Yale merch.
STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "for", "with", "in", "on", "to", "my", "me",
    "i", "you", "do", "have", "has", "any", "some", "what", "show", "find", "looking",
    "want", "need", "get", "something", "anything", "please", "can", "is", "are", "it",
    "that", "this", "your", "yale", "campus", "customs", "merch", "merchandise",
}

_lock = threading.Lock()
_index: sqlite3.Connection | None = None
_vocabulary: set[str] = set()


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def build_index(rows: list[sqlite3.Row]) -> None:
    """Build the in-memory FTS5 index and the vocabulary used for typo repair."""
    global _index, _vocabulary

    index = sqlite3.connect(":memory:", check_same_thread=False)
    index.execute(
        """CREATE VIRTUAL TABLE catalogue_fts USING fts5(
               product_id UNINDEXED,
               name,
               garment_type,
               colors,
               tags,
               description
           )"""
    )

    vocabulary: set[str] = set()
    for row in rows:
        colors = " ".join(json.loads(row["colors"] or "[]"))
        tags = " ".join(json.loads(row["search_tags"] or "[]"))
        index.execute(
            "INSERT INTO catalogue_fts VALUES (?, ?, ?, ?, ?, ?)",
            (
                row["product_id"],
                row["name"],
                row["garment_type"],
                colors,
                tags,
                row["description"],
            ),
        )
        for field in (row["name"], row["garment_type"], colors, tags):
            vocabulary.update(_tokenize(field))

    index.commit()
    _index = index
    _vocabulary = {word for word in vocabulary if len(word) > 2}


def _repair(term: str) -> str:
    """Map a misspelled term onto the closest word the catalogue actually contains.

    "crewnek" -> "crewneck". Only fires for words the catalogue doesn't know, and only
    when the match is close, so real words are never rewritten.
    """
    if term in _vocabulary or len(term) < 4:
        return term
    close = difflib.get_close_matches(term, _vocabulary, n=1, cutoff=0.82)
    return close[0] if close else term


def expand(query: str) -> list[str]:
    """Turn a shopper's phrasing into the terms to search for."""
    terms: list[str] = []
    for raw in _tokenize(query):
        if raw in STOPWORDS:
            continue
        term = _repair(raw)
        # Match a plural against its singular too ("hoodies" -> "hoodie").
        candidates = SYNONYMS.get(term) or SYNONYMS.get(raw) or [term]
        if term.endswith("s") and term[:-1] in _vocabulary:
            candidates = [*candidates, term[:-1]]
        terms.extend(candidates)

    # Preserve order, drop duplicates.
    seen: set[str] = set()
    return [t for t in terms if not (t in seen or seen.add(t))]


def _fts_query(terms: list[str]) -> str:
    """Build an FTS5 MATCH expression: any term may match, prefixes allowed."""
    parts = []
    for term in terms:
        safe = re.sub(r"[^a-z0-9]", "", term.lower())
        if safe:
            # Prefix search so "crew" finds "crewneck".
            parts.append(f'"{safe}"*')
    return " OR ".join(parts)


def search_ids(query: str, limit: int = 40) -> list[str]:
    """Product ids best matching the query, most relevant first.

    Returns [] for an empty query — the caller then falls back to filters alone.
    """
    if _index is None:
        return []

    terms = expand(query)
    if not terms:
        return []

    match = _fts_query(terms)
    if not match:
        return []

    with _lock:
        try:
            rows = _index.execute(
                """SELECT product_id
                   FROM catalogue_fts
                   WHERE catalogue_fts MATCH ?
                   ORDER BY bm25(catalogue_fts, 0.0, 10.0, 3.0, 4.0, 8.0, 2.0)
                   LIMIT ?""",
                (match, limit),
            ).fetchall()
        except sqlite3.OperationalError:
            # A query FTS5 can't parse shouldn't take the shop down.
            return []

    return [row[0] for row in rows]
