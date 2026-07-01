import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;

/** Sesión actual, si existe (para el arranque de `AuthProvider`). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Se suscribe a cambios de sesión; devuelve la función para cancelar la suscripción. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => listener.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Devuelve el perfil del usuario autenticado, o `null` si todavía no existe. */
export async function getMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Crea o actualiza la fila en `profiles` del usuario autenticado (id = auth.uid()). */
export async function upsertMyProfile(name: string): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const payload: TablesInsert<'profiles'> = { id: user.id, name };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
