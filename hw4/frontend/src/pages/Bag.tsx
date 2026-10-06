import { Link } from "react-router-dom";
import Dan from "../components/Dan";
import { formatPrice } from "../lib/api";
import { useBag } from "../lib/BagContext";

export default function Bag() {
  const { items, count, total, adjust, remove, clear } = useBag();

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <Dan state="sitting" size={150} />
          <h2>Your bag is empty</h2>
          <p>
            Dan is guarding it anyway. Nothing in here yet — the catalogue is a good place
            to start.
          </p>
          <Link className="btn btn-primary" to="/products">
            Browse the catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Your Bag</p>
        <h1>
          {count} {count === 1 ? "item" : "items"}
        </h1>
      </div>

      <div className="bag-layout">
        <div className="bag-items">
          {items.map((item) => (
            <div className="bag-item" key={`${item.product_id}-${item.size}`}>
              <Link to={`/products/${item.product_id}`} className="bag-item-image">
                <img src={item.image_url} alt={item.name} loading="lazy" />
              </Link>

              <div className="bag-item-body">
                <Link to={`/products/${item.product_id}`} className="bag-item-name">
                  {item.name}
                </Link>
                <p className="bag-item-meta">
                  Size {item.size} · {formatPrice(item.price)} each
                </p>
                {item.quantity >= item.available && (
                  <p className="bag-item-cap">
                    That's all we have in {item.size}.
                  </p>
                )}
              </div>

              <div className="bag-item-qty">
                <button
                  onClick={() => adjust(item.product_id, item.size, -1)}
                  aria-label={`Decrease quantity of ${item.name} size ${item.size}`}
                >
                  −
                </button>
                <span>{item.quantity}</span>
                <button
                  disabled={item.quantity >= item.available}
                  onClick={() => adjust(item.product_id, item.size, 1)}
                  aria-label={`Increase quantity of ${item.name} size ${item.size}`}
                >
                  +
                </button>
              </div>

              <div className="bag-item-line">
                <strong>{formatPrice(item.price * item.quantity)}</strong>
                <button
                  className="link-button"
                  onClick={() => remove(item.product_id, item.size)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="bag-summary">
          <h2>Summary</h2>
          <div className="bag-summary-row">
            <span>
              Subtotal ({count} {count === 1 ? "item" : "items"})
            </span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <p className="bag-summary-note">
            Shipping and tax are worked out at checkout.
          </p>
          <button className="btn btn-navy" disabled>
            Checkout
          </button>
          <p className="bag-summary-note">
            Checkout isn't live yet — bring this list to the shop in New Haven.
          </p>
          <button className="link-button bag-clear" onClick={clear}>
            Empty bag
          </button>
        </aside>
      </div>
    </div>
  );
}
