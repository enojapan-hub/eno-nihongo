import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authStatus, type AuthStatus } from "@/lib/auth-flow";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** loading ≠ unauthenticated: jangan menganggap sesi belum terbaca sebagai logout. */
  status: AuthStatus;
}

/**
 * Session reader untuk UI (header, CTA, dsb).
 * Proteksi route tetap ditangani oleh layout `_authenticated`, bukan hook ini.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!active) return;
      setSession(current);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading, status: authStatus(loading, !!session) };
}
