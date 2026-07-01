import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange, signOut as signOutApi } from './api';
import { AuthContext, type AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((session) => {
      setSession(session);
      setLoading(false);
    });

    return onAuthStateChange((newSession) => {
      setSession(newSession);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: signOutApi,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
