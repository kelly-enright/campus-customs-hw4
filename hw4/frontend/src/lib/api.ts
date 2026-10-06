import type { CategoryCount, ProductDetail, ProductSummary } from "./types";

// Vite proxies /api and /static to the FastAPI app in dev (see vite.config.ts).
const BASE = "";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function fetchProducts(params: { search?: string; category?: string } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category && params.category !== "All") query.set("category", params.category);
  const suffix = query.toString() ? `?${query}` : "";
  return getJson<ProductSummary[]>(`/api/products${suffix}`);
}

export function fetchProduct(productId: string) {
  return getJson<ProductDetail>(`/api/products/${encodeURIComponent(productId)}`);
}

export function fetchCategories() {
  return getJson<CategoryCount[]>("/api/categories");
}

/** Product images are served by the API, not bundled by Vite. */
export function imageUrl(product: { image_url: string }) {
  return `${BASE}${product.image_url}`;
}

export function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}
