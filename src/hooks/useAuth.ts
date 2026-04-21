import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type SubscriptionPlan = 'semestral' | 'anual' | null;
export type ProgressStatus = 'learning' | 'completed';

export interface AuthUser {
  id: string;
  name: string;
  avatar?: string;
  plan: SubscriptionPlan;
  subscribedAt?: string;
  expiresAt?: string;
  favorites: number[];
  progress: { tabId: number; status: ProgressStatus }[];
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carrega sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });

    // Escuta mudanças de auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const [profileRes, favRes, progRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('favorites').select('tablatura_id').eq('user_id', userId),
      supabase.from('progress').select('tablatura_id, status').eq('user_id', userId),
    ]);

    const profile = profileRes.data;
    if (!profile) { setLoading(false); return; }

    setUser({
      id: userId,
      name: profile.name ?? 'Usuário',
      avatar: profile.avatar_url ?? undefined,
      plan: profile.plan ?? null,
      subscribedAt: profile.subscribed_at ?? undefined,
      expiresAt: profile.expires_at ?? undefined,
      favorites: (favRes.data ?? []).map((f: { tablatura_id: number }) => f.tablatura_id),
      progress: (progRes.data ?? []).map((p: { tablatura_id: number; status: ProgressStatus }) => ({
        tabId: p.tablatura_id,
        status: p.status,
      })),
    });
    setLoading(false);
  }

  const isActive = user
    ? !!user.expiresAt && new Date(user.expiresAt) > new Date()
    : false;

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return { user, loading, isActive, signOut };
}
