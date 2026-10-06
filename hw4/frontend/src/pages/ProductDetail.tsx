import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Confetti from "../components/Confetti";
import { fetchProduct, formatPrice, imageUrl } from "../lib/api";
import { useBag } from "../lib/BagContext";
import { useTileColor } from "../lib/useTileColor";
import type { ProductDetail as Product } from "../lib/types";

const LOW_STOCK = 3;

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [added, setAdded] = useState(false);
  // Separate from `added`: the note stays on screen, the burst plays once and clears
  // itself, so re-adding the same size fires it again.
  const [burst, setBurst] = useState(0);
  const { add } = useBag();
  const { tileColor, imageRef } = useTileColor();

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setStatus("loading");
    setSelectedSize(null);
    setAdded(false);
    window.scrollTo({ top: 0 });

    fetchProduct(productId)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));

    return () => {
      active = false;
    };
  }, [productId]);

  if (status === "loading") {
    return <p className="state-msg">Loading…</p>;
  }

  if (status === "error" || !product) {
    return (
      <div className="page">
        <p className="state-msg error">We couldn't find that item.</p>
        <p className="state-msg">
          <Link to="/products">Back to all products</Link>
        </p>
      </div>
    );
  }

  const selected = product.sizes.find((entry) => entry.size === selectedSize);

  return (
    <div className="page">
      <Link className="back-link" to="/products">
        ← All products
      </Link>

      <div className="detail-layout">
        <div
          className="detail-image"
          style={tileColor ? { background: tileColor } : undefined}
        >
          <img ref={imageRef} src={imageUrl(product)} alt={product.name} />
        </div>

        <div className="detail-body">
          <p className="eyebrow">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>

          <p className="detail-description">{product.description}</p>

          <div className="detail-section">
            <h2>Sizes</h2>
            <div className="size-grid">
              {product.sizes.map((entry) => (
                <button
                  key={entry.size}
                  className={`size-option${selectedSize === entry.size ? " selected" : ""}`}
                  disabled={entry.quantity === 0}
                  onClick={() => {
                    setSelectedSize(entry.size);
                    setAdded(false);
                  }}
                  title={entry.quantity === 0 ? "Sold out" : `${entry.quantity} in stock`}
                >
                  <strong>{entry.size}</strong>
                  <small>{entry.quantity === 0 ? "Sold out" : `${entry.quantity} left`}</small>
                </button>
              ))}
            </div>

            {selected && (
              <p
                className={`stock-note ${
                  selected.quantity === 0
                    ? "stock-out"
                    : selected.quantity <= LOW_STOCK
                      ? "stock-low"
                      : "stock-ok"
                }`}
              >
                {selected.quantity === 0
                  ? `Size ${selected.size} is sold out right now.`
                  : selected.quantity <= LOW_STOCK
                    ? `Only ${selected.quantity} left in ${selected.size}.`
                    : `Size ${selected.size} is in stock (${selected.quantity} available).`}
              </p>
            )}
          </div>

          {product.colors.length > 0 && (
            <div className="detail-section">
              <h2>Colors</h2>
              <div className="tag-list">
                {product.colors.map((color) => (
                  <span key={color} className="tag">
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h2>Details</h2>
            <div className="tag-list">
              <span className="tag">{product.garment_type}</span>
              {product.search_tags.slice(0, 6).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="add-to-bag">
            {burst > 0 && <Confetti key={burst} onDone={() => setBurst(0)} />}
            <button
              className="btn btn-navy"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                add({
                  product_id: product.product_id,
                  name: product.name,
                  price: product.price,
                  image_url: imageUrl(product),
                  size: selected.size,
                  available: selected.quantity,
                });
                setAdded(true);
                setBurst(Date.now());
              }}
            >
              {selected ? `Add ${selected.size} to bag` : "Select a size"}
            </button>
          </div>

          {added && selected && (
            <p className="added-note">
              Added {selected.size} to your bag. <Link to="/bag">View bag →</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
