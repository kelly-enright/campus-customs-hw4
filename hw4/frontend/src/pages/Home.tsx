import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Bunting from "../components/Bunting";
import Dan, { PawTrail } from "../components/Dan";
import ProductCard from "../components/ProductCard";
import Reveal from "../components/Reveal";
import { fetchProducts } from "../lib/api";
import type { ProductSummary } from "../lib/types";

export default function Home() {
  const [featured, setFeatured] = useState<ProductSummary[]>([]);

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((products) => {
        if (!active) return;
        // A stable, spread-out sample so the row shows a mix of garment types.
        setFeatured(products.filter((_, index) => index % 9 === 0).slice(0, 4));
      })
      .catch(() => setFeatured([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <Bunting />
        {/* Dan, watermarked behind the masthead — his eyes follow the cursor */}
        <Dan state="awake" size={460} className="hero-dan" silhouette track />
        <div className="hero-inner">
          <p className="eyebrow">New Haven · Since game day</p>
          <h1>Yale gear that earns its place in the rotation.</h1>
          <p>
            Campus Customs makes the hoodies, crewnecks, and tees you actually reach for —
            heavyweight cotton, honest fits, and Bulldog blue that holds its color long after
            finals week. Built for students, alumni, parents, and anyone who cheers loudest in
            November.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/products">
              Shop the catalogue
            </Link>
            <Link className="btn btn-ghost" to="/about">
              Our story
            </Link>
          </div>
        </div>
      </section>

      <div className="page">
        <Reveal>
        <div className="value-props">
          <div className="value-prop">
            <h3>Straight answers on stock</h3>
            <p>
              Our assistant reads the same inventory we do. If your size is gone, it will say
              so instead of guessing.
            </p>
          </div>
          <div className="value-prop">
            <h3>Made for the walk to class</h3>
            <p>
              Brushed fleece interiors, ribbed cuffs that keep their shape, and weights that
              work from September through the Harvard game.
            </p>
          </div>
          <div className="value-prop">
            <h3>Every college, every team</h3>
            <p>
              From residential college crewnecks to sport-specific tees, the details are
              printed right — because we hear about it when they aren't.
            </p>
          </div>
        </div>
        </Reveal>

        <div className="section-head">
          <h2>Fresh in Bulldog blue</h2>
          <Link to="/products">See everything →</Link>
        </div>

        {featured.length > 0 ? (
          <div className="product-grid">
            {featured.map((product, index) => (
              <Reveal key={product.product_id} delay={index * 80}>
                {/* the first pick gets Dan's endorsement */}
                <ProductCard product={product} dansPick={index === 0} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="loading-block">
            <PawTrail label="Fetching gear" />
            <p className="state-msg">Dan is fetching the good stuff…</p>
          </div>
        )}
      </div>
    </>
  );
}
