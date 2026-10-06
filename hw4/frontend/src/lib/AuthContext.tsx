import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  clearToken,
  fetchMe,
  login as loginRequest,
  signup as signupRequest,
  storeToken,
  storedToken,
} from "./auth";
import type { PublicUser } from "./auth";

interface AuthValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load; a stale or tampered token simply resolves to null.
  useEffect(() => {
    const token = storedToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe(token)
      .then((me) => {
        if (me) setUser(me);
        else clearToken();
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: me } = await loginRequest({ email, password });
    storeToken(token);
    setUser(me);
  }, []);

  const signup = useCallback(
    async (input: {
      first_name: string;
      last_name: string;
      email: string;
      password: string;
    }) => {
      const { token, user: me } = await signupRequest(input);
      storeToken(token);
      setUser(me);
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
