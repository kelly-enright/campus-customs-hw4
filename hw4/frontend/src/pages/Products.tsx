import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ChatResults from "../components/ChatResults";
import Dan, { PawTrail } from "../components/Dan";
import ProductCard from "../components/ProductCard";
import { fetchCategories, fetchProducts } from "../lib/api";
import type { CategoryCount, ProductSummary } from "../lib/types";

const SORTS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock", label: "Most in stock" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export default function Products() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Browsing state lives in the URL, so a filtered view can be linked, bookmarked,
  // and reached with the back button.
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "All";
  const sort = (params.get("sort") as SortValue) ?? "name";

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      // Defaults stay out of the URL so a plain /products link stays clean.
      if (!value || value === "All" || (key === "sort" && value === "name")) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setParams(next, { replace: true });
  }

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchProducts()
      .then((data) => {
        if (!active) return;
        setProducts(data);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (category !== "All" && product.category !== category) return false;
      if (!needle) return true;
      return [product.name, product.description, product.garment_type, ...product.colors]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    else if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    else if (sort === "stock") sorted.sort((a, b) => b.total_quantity - a.total_quantity);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, category, search, sort]);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">The Catalogue</p>
        <h1>Products</h1>
        <p>
          Everything we currently print, from game-day tees to fleece built for a cold walk
          across Old Campus. Pick anything to see sizes and what's left in stock.
        </p>
      </div>

      {/* Matches from the chat land here, above the full catalogue. */}
      <ChatResults />

      <div className="filter-bar">
        <input
          className="search-input"
          value={search}
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Search by name, color, or team…"
          aria-label="Search products"
        />

        <label className="sort-control">
          <span>Sort</span>
          <select value={sort} onChange={(event) => update({ sort: event.target.value })}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-bar filter-chips">
        <button
          className={category === "All" ? "chip active" : "chip"}
          onClick={() => update({ category: "All" })}
        >
          All ({products.length})
        </button>
        {categories.map((entry) => (
          <button
            key={entry.category}
            className={category === entry.category ? "chip active" : "chip"}
            onClick={() => update({ category: entry.category })}
          >
            {entry.category} ({entry.count})
          </button>
        ))}
      </div>

      {status === "loading" && (
        <div className="loading-block">
          <PawTrail label="Loading the catalogue" />
          <p className="state-msg">Dan is rounding up the catalogue…</p>
        </div>
      )}

      {status === "error" && (
        <p className="state-msg error">
          Couldn't load products. Is the API running on port 8000?
        </p>
      )}

      {status === "ready" && (
        <>
          <p className="result-count">
            {visible.length} {visible.length === 1 ? "item" : "items"}
            {category !== "All" && ` in ${category}`}
            {search && ` matching "${search}"`}
            {(category !== "All" || search || sort !== "name") && (
              <>
                {" · "}
                <button className="link-button" onClick={() => setParams({}, { replace: true })}>
                  Reset
                </button>
              </>
            )}
          </p>
          {visible.length > 0 ? (
            <div className="product-grid">
              {visible.map((product) => (
                <ProductCard key={product.product_id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Dan state="confused" size={110} />
              <h2>Dan can't find that one</h2>
              <p>
                Nothing in the catalogue matched that. Try a broader word — or ask Dan
                directly, he knows a few nicknames for things.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
