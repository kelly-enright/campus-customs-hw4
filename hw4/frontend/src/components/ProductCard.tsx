import { useRef } from "react";
import { Link } from "react-router-dom";
import { formatPrice, imageUrl } from "../lib/api";
import { useTileColor } from "../lib/useTileColor";
import type { ProductSummary } from "../lib/types";

/**
 * Tilt range in degrees across the full width of a card. The cursor offset runs -0.5…0.5,
 * so a corner reaches half this — TILT = 10 tips the card about 5° at its corners.
 */
const TILT = 10;

const LOW_TOTAL = 12;
const FEW_SIZES = 3;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

// Catalogue colour words mapped to something paintable. Anything unrecognised is
// skipped rather than guessed at — a wrong swatch is worse than no swatch.
const SWATCHES: Record<string, string> = {
  navy: "#1b2f52", "navy blue": "#1b2f52", blue: "#2b4c86", "light blue": "#7da7d9",
  white: "#f7f4ee", cream: "#f0e6d2", black: "#1c1c1c", charcoal: "#3a3f45",
  gray: "#9aa0a6", grey: "#9aa0a6", "heather gray": "#b6bac0", "heather grey": "#b6bac0",
  red: "#9d2a24", crimson: "#8c2020", maroon: "#6b2028", green: "#2f6b45",
  forest: "#24503a", gold: "#c8912f", yellow: "#e2be4a", orange: "#cf6b2a",
  pink: "#dda0b4", purple: "#5d4585", tan: "#c8a97e", brown: "#6b4a30",
  silver: "#c7ccd1", "royal blue": "#2b4c86",
};

function stockBadge(product: ProductSummary) {
  // Only /api/products populates the stock rollup; chat cards arrive without it, so
  // treat a missing value as "no badge" rather than "sold out".
  if (!product.total_quantity) return null;
  if (!product.sizes_available) return { label: "Sold out", tone: "out" };
  if (product.total_quantity <= LOW_TOTAL)
    return { label: `Only ${product.total_quantity} left`, tone: "low" };
  if (product.sizes_available <= FEW_SIZES)
    return { label: `${product.sizes_available} sizes left`, tone: "low" };
  return null;
}

export default function ProductCard({
  product,
  dansPick = false,
}: {
  product: ProductSummary;
  dansPick?: boolean;
}) {
  const badge = stockBadge(product);
  const { tileColor, imageRef } = useTileColor();
  // Cards built from a chat reply carry only the ProductCard fields — no colors, no
  // stock rollup — so every optional field is defaulted rather than assumed.
  const colors = product.colors ?? [];
  const swatches = colors
    .map((color) => SWATCHES[color.toLowerCase()])
    .filter(Boolean)
    .slice(0, 4);
  const inStock = product.sizes_in_stock ?? [];
  const cardRef = useRef<HTMLAnchorElement>(null);

  /**
   * Tilt the card toward the cursor, like tipping a photograph to catch the light.
   *
   * Written straight to the node's style rather than through state: this fires on every
   * mousemove over the card, and routing that through React would re-render the whole
   * grid. The CSS keeps a transition on the *reset* only, so following the cursor feels
   * immediate while letting go settles smoothly.
   */
  const onMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const node = cardRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty("--tilt-x", `${-py * TILT}deg`);
    node.style.setProperty("--tilt-y", `${px * TILT}deg`);
  };

  const onLeave = () => {
    const node = cardRef.current;
    if (!node) return;
    node.style.removeProperty("--tilt-x");
    node.style.removeProperty("--tilt-y");
  };

  return (
    <div className="card-wrap">
      {dansPick && (
        <span className="dans-pick">
          <span aria-hidden="true">🐾</span> Dan&apos;s pick
        </span>
      )}
      <Link
        ref={cardRef}
        className="product-card"
        to={`/products/${product.product_id}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div
          className="product-card-image"
          // Tile painted to match the photo's own background, so black-backdrop and
          // white-backdrop shots both look mounted rather than mismatched.
          style={tileColor ? { background: tileColor } : undefined}
        >
          <img
            ref={imageRef}
            src={imageUrl(product)}
            alt={product.name}
            loading="lazy"
          />
          {badge && <span className={`stock-badge stock-badge-${badge.tone}`}>{badge.label}</span>}
        </div>
        <div className="product-card-body">
          <h3>{product.name}</h3>
          <p className="product-card-desc">{product.short_description}</p>

          <div className="card-meta">
            <span className="product-price">{formatPrice(product.price)}</span>
            {swatches.length > 0 && (
              <span className="swatches" aria-label={`Colors: ${colors.join(", ")}`}>
                {swatches.map((hex, index) => (
                  <span key={index} className="swatch" style={{ background: hex }} />
                ))}
              </span>
            )}
          </div>

          {inStock.length > 0 && (
            <div className="size-pips" aria-label={`Sizes in stock: ${inStock.join(", ")}`}>
              {SIZE_ORDER.map((size) => (
                <span
                  key={size}
                  className={inStock.includes(size) ? "pip" : "pip pip-out"}
                  title={inStock.includes(size) ? `${size} in stock` : `${size} sold out`}
                >
                  {size}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
