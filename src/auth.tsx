import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (data: { email: string; password: string; name: string; organization_name: string }) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = "ledgerlane_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } });
  const [loading] = useState(false);
  const logout = () => { localStorage.removeItem("ledgerlane_token"); localStorage.removeItem(USER_KEY); setUser(null); };
  useEffect(() => { setUnauthorizedHandler(logout); return () => setUnauthorizedHandler(null); }, []);
  const value = useMemo(() => ({ user, loading, logout,
    login: async (email: string, password: string) => { const result = await authApi.login({ email, password }); localStorage.setItem("ledgerlane_token", result.token); localStorage.setItem(USER_KEY, JSON.stringify(result.user)); setUser(result.user); },
    register: async (data: { email: string; password: string; name: string; organization_name: string }) => { await authApi.register(data); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
