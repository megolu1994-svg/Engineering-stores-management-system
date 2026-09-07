import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase, isSupabaseConfigured } from "../config/supabase";

const DEMO_USER: User = {
  id: "demo-user-id",
  app_metadata: {},
  user_metadata: { name: "Demo User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  email: "demo@esms.local",
  role: "authenticated",
  updated_at: new Date().toISOString(),
};

const DEMO_SESSION: Session = {
  access_token: "demo-token",
  refresh_token: "demo-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: DEMO_USER,
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInDemo: () => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("esms_demo_session") === "true") {
      return DEMO_SESSION;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("esms_demo_session") === "true";
  });

  useEffect(() => {
    if (sessionStorage.getItem("esms_demo_session") === "true") {
      setSession(DEMO_SESSION);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Auth getSession error:", err);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!sessionStorage.getItem("esms_demo_session")) {
          setSession(newSession);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signUp(email: string, password: string) {
    if (!isSupabaseConfigured) {
      signInDemo();
      return { error: null };
    }
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err?.message || "Failed to connect to Supabase" };
    }
  }

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      signInDemo();
      return { error: null };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err?.message || "Failed to connect to Supabase" };
    }
  }

  function signInDemo() {
    sessionStorage.setItem("esms_demo_session", "true");
    setIsDemo(true);
    setSession(DEMO_SESSION);
  }

  async function signOut() {
    sessionStorage.removeItem("esms_demo_session");
    setIsDemo(false);
    setSession(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
        signInDemo,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
