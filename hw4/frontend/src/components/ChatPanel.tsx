import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Dan, { PawTrail } from "./Dan";
import { useAuth } from "../lib/AuthContext";
import { useChatResults } from "../lib/ChatResultsContext";
import { clearChatHistory, fetchChatHistory, sendChatMessage } from "../lib/chat";
import type { ChatMessage } from "../lib/types";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Woof — I'm Dan, the shop dog. Ask me about our Yale gear: styles, prices, or " +
    "whether something's in your size.",
};

const SUGGESTIONS = [
  "Show me navy hoodies",
  "What's good for tailgates?",
  "Anything under $40?",
];

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { show: showResults } = useChatResults();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The panel lives outside <Routes>, so useParams() would always be empty here —
  // read the product id off the path instead.
  const productId = location.pathname.match(/^\/products\/(.+)$/)?.[1] ?? null;

  // Reload the saved conversation when a shopper signs in, and reset to a clean
  // greeting when they sign out — one shopper's transcript never lingers for the next.
  useEffect(() => {
    let active = true;
    if (!user) {
      setMessages([GREETING]);
      return;
    }
    fetchChatHistory()
      .then((saved) => {
        if (!active) return;
        setMessages(saved.length > 0 ? [GREETING, ...saved] : [GREETING]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, pending]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    setDraft("");
    setPending(true);

    try {
      // Send prior turns so the agent can follow "do you have that in large?".
      // The opening greeting is ours, not the model's, so it stays out of the history.
      const history = messages
        .filter((entry) => entry.id !== "greeting")
        .map((entry) => ({ role: entry.role, content: entry.content }));

      // Where they are, so "do you have this in pink?" has a referent.
      const page = { path: location.pathname, product_id: productId };

      const reply = await sendChatMessage(trimmed, history, page);
      setMessages((prev) => [...prev, reply]);

      // Matches go onto the page, not just into the transcript. The catalogue is where
      // a shopper expects to browse, so send them there if they're somewhere else.
      if (reply.products && reply.products.length > 0) {
        showResults(reply.products, trimmed);
        if (location.pathname !== "/products") navigate("/products");
      }
    } catch (caught) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            caught instanceof Error
              ? caught.message
              : "Sorry — I couldn't reach the shop just then. Please try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button className="chat-launcher" onClick={() => setOpen(true)}>
        {/* Dan dozes until you need him */}
        <Dan state="sleeping" size={42} />
        Ask Dan
      </button>
    );
  }

  return (
    <aside className="chat-panel" aria-label="Campus Customs assistant">
      <div className="chat-header">
        <div className="chat-header-id">
          <Dan state={pending ? "thinking" : "awake"} size={40} />
          <div>
            <strong>Handsome Dan</strong>
            <small>Shop dog, New Haven</small>
          </div>
        </div>
        <div className="chat-header-actions">
          {user && messages.length > 1 && (
            <button
              className="chat-clear"
              onClick={async () => {
                await clearChatHistory();
                setMessages([GREETING]);
              }}
            >
              Clear
            </button>
          )}
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
            ×
          </button>
        </div>
      </div>

      <div className="chat-log" ref={logRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.role}`}>
            {message.role === "assistant" && (
              <Dan state="awake" size={28} className="chat-avatar" />
            )}
            <div className={`chat-bubble chat-bubble-in ${message.role}`}>
              {message.content}
              {message.products && message.products.length > 0 && (
                // The cards themselves render on the page; this is just the pointer to
                // them, so the same products aren't shown twice.
                <button
                  className="chat-results-jump"
                  onClick={() => {
                    if (location.pathname !== "/products") navigate("/products");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  ↓ {message.products.length}{" "}
                  {message.products.length === 1 ? "item" : "items"} on the page
                </button>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="chat-row assistant">
            <Dan state="thinking" size={28} className="chat-avatar" />
            <div className="chat-bubble assistant chat-thinking">
              <PawTrail label="Dan is looking" />
              <span>sniffing around…</span>
            </div>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className="chat-suggestion"
              onClick={() => submit(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Dan about sizes, prices, colors…"
          aria-label="Message"
        />
        <button type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
