import ProductCard from "./ProductCard";
import { useChatResults } from "../lib/ChatResultsContext";

/**
 * The band of products the assistant just matched, rendered on the page.
 *
 * Cards here are the same ProductCard used by the catalogue grid, so they link to the
 * same detail page — a card the chat put on the page behaves exactly like one that was
 * always there.
 */
export default function ChatResults() {
  const { products, query, revision, clear } = useChatResults();

  if (products.length === 0) return null;

  return (
    // key on revision so the reveal animation replays for each new result set
    <section className="chat-results" key={revision} aria-live="polite">
      <div className="chat-results-head">
        <div>
          <p className="eyebrow chat-results-eyebrow">
            <span className="chat-results-dot" aria-hidden="true" />
            From your conversation
          </p>
          <h2>
            {products.length} {products.length === 1 ? "match" : "matches"}
            {query && <span className="chat-results-query"> for “{query}”</span>}
          </h2>
        </div>
        <button className="chat-results-clear" onClick={clear}>
          Clear
        </button>
      </div>

      <div className="product-grid chat-results-grid">
        {products.map((product, index) => (
          <div
            key={product.product_id}
            className="chat-results-item"
            // Staggered so the row arrives as a wave rather than all at once.
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
