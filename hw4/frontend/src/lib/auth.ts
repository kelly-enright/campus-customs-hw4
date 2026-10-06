export interface PublicUser {
  id: number;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string;
  created_at: string;
}

interface AuthResponse {
  token: string;
  user: PublicUser;
}

const TOKEN_KEY = "campus-customs-token";

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Pull the server's message out of a failed response so forms can show it. */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    /* non-JSON error body */
  }
  return fallback;
}

async function post(path: string, payload: unknown, fallback: string): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response, fallback));
  }
  return response.json();
}

export function signup(input: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  return post("/api/auth/signup", input, "Could not create your account.");
}

export function login(input: { email: string; password: string }) {
  return post("/api/auth/login", input, "Could not log you in.");
}

/** Resolve the logged-in user from a stored token, or null if it is missing/expired. */
export async function fetchMe(token: string): Promise<PublicUser | null> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}
