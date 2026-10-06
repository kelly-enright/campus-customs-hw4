import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProductSummary } from "./types";

interface ChatResults {
  /** Products the agent matched on its most recent turn. */
  products: ProductSummary[];
  /** The shopper's question that produced them, shown as context on the page. */
  query: string;
  /** Bumped on every new result set so the page can replay its reveal animation. */
  revision: number;
}

interface ChatResultsValue extends ChatResults {
  show: (products: ProductSummary[], query: string) => void;
  clear: () => void;
}

const EMPTY: ChatResults = { products: [], query: "", revision: 0 };

const ChatResultsContext = createContext<ChatResultsValue | null>(null);

/**
 * Holds the product matches from the latest chat turn.
 *
 * This is the bridge between the chat panel and the page: the panel writes matches here,
 * the Products page reads them. Keeping it in context rather than in the panel's own state
 * is what lets the results survive navigation — click a card, view the item, come back, and
 * the row is still there.
 */
export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatResults>(EMPTY);

  const show = useCallback((products: ProductSummary[], query: string) => {
    setResults((prev) => ({ products, query, revision: prev.revision + 1 }));
  }, []);

  const clear = useCallback(() => setResults(EMPTY), []);

  const value = useMemo(() => ({ ...results, show, clear }), [results, show, clear]);

  return <ChatResultsContext.Provider value={value}>{children}</ChatResultsContext.Provider>;
}

export function useChatResults() {
  const value = useContext(ChatResultsContext);
  if (!value) throw new Error("useChatResults must be used inside ChatResultsProvider");
  return value;
}
