import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface BagItem {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  size: string;
  quantity: number;
  /** Stock on hand for this size when it was added — the cap on quantity. */
  available: number;
}

interface BagValue {
  items: BagItem[];
  count: number;
  total: number;
  add: (item: Omit<BagItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, size: string, quantity: number) => void;
  /** Relative change, computed from current state — safe against rapid clicks. */
  adjust: (productId: string, size: string, delta: number) => void;
  remove: (productId: string, size: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "campus-customs-bag";

const BagContext = createContext<BagValue | null>(null);

function load(): BagItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BagItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * The shopping bag.
 *
 * Persisted to localStorage so a bag survives a reload or a closed tab — losing a bag
 * between visits is the fastest way to lose the sale. Kept client-side because the
 * assignment has no orders table; nothing here is charged or reserved.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<BagItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find(
        (entry) => entry.product_id === item.product_id && entry.size === item.size,
      );
      if (existing) {
        // Never let the bag exceed what's actually on the shelf.
        const next = Math.min(existing.quantity + quantity, item.available);
        return prev.map((entry) =>
          entry === existing ? { ...entry, quantity: next, available: item.available } : entry,
        );
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.available) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setItems((prev) =>
      prev.flatMap((entry) => {
        if (entry.product_id !== productId || entry.size !== size) return [entry];
        const next = Math.max(0, Math.min(quantity, entry.available));
        return next === 0 ? [] : [{ ...entry, quantity: next }];
      }),
    );
  }, []);

  // Absolute setQuantity closes over the quantity that was rendered, so two fast clicks
  // both compute from the same stale value and only one lands. This derives from the
  // previous state instead.
  const adjust = useCallback((productId: string, size: string, delta: number) => {
    setItems((prev) =>
      prev.flatMap((entry) => {
        if (entry.product_id !== productId || entry.size !== size) return [entry];
        const next = Math.max(0, Math.min(entry.quantity + delta, entry.available));
        return next === 0 ? [] : [{ ...entry, quantity: next }];
      }),
    );
  }, []);

  const remove = useCallback((productId: string, size: string) => {
    setItems((prev) =>
      prev.filter((entry) => !(entry.product_id === productId && entry.size === size)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = items.reduce((sum, entry) => sum + entry.quantity * entry.price, 0);
    return { items, count, total, add, setQuantity, adjust, remove, clear };
  }, [items, add, setQuantity, adjust, remove, clear]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const value = useContext(BagContext);
  if (!value) throw new Error("useBag must be used inside BagProvider");
  return value;
}
