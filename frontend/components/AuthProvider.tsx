"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { API, clearAccessToken, getAccessToken, getJson, setAccessToken } from "@/lib/api";
import { AuthResponse, User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { setLoading(false); return; }
    getJson<User>("/api/auth/me")
      .then(setUser)
      .catch(() => { clearAccessToken(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || "Unable to sign in");
    const auth = payload as AuthResponse;
    setAccessToken(auth.access_token);
    setUser(auth.user);
    return auth.user;
  }

  function logout() {
    clearAccessToken();
    setUser(null);
    window.location.assign("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
