import { storedToken } from "./auth";
import type { ChatMessage, ProductSummary } from "./types";

interface CardPayload {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  short_description: string;
  category: string;
}

interface ChatResponse {
  reply: string;
  products: CardPayload[];
}

interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  products: CardPayload[];
  created_at: string;
}

export interface PageContext {
  path: string;
  product_id?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = storedToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** One turn of conversation with the shop's agent. */
export async function sendChatMessage(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  page?: PageContext,
): Promise<ChatMessage> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    // `page` is what lets the agent resolve "do you have this in pink?" — without it,
    // "this" has no referent. Signing in is optional; it adds a name and saved history.
    body: JSON.stringify({ message, history, page }),
  });

  if (!response.ok) {
    let detail = "The assistant is having trouble right now. Please try again.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }

  const data: ChatResponse = await response.json();

  return {
    id: `a-${Date.now()}`,
    role: "assistant",
    content: data.reply,
    products: data.products as unknown as ProductSummary[],
  };
}

/** A signed-in shopper's saved conversation. Returns [] for guests. */
export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const token = storedToken();
  if (!token) return [];

  const response = await fetch("/api/chat/history", { headers: authHeaders() });
  if (!response.ok) return [];

  const stored: StoredMessage[] = await response.json();
  return stored.map((entry) => ({
    id: `s-${entry.id}`,
    role: entry.role,
    content: entry.content,
    products: entry.products as unknown as ProductSummary[],
  }));
}

export async function clearChatHistory(): Promise<void> {
  const token = storedToken();
  if (!token) return;
  await fetch("/api/chat/history", { method: "DELETE", headers: authHeaders() });
}
