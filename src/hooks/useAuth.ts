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
    let mounted = true;

    // Escuta mudanças de auth (login/logout) — cobre redirect do OAuth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) loadProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    // Carrega sessão existente no mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadProfile(userId: string) {
    try {
    const [profileRes, favRes, progRes, sessionRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('favorites').select('tablatura_id').eq('user_id', userId),
      supabase.from('progress').select('tablatura_id, status').eq('user_id', userId),
      supabase.auth.getUser(),
    ]);

    let profile = profileRes.data;

    // Novo usuário (ex: primeiro login Google) — perfil ainda não criado pelo trigger
    if (!profile) {
      const authUser = sessionRes.data?.user;
      const fallbackName =
        authUser?.user_metadata?.full_name ??
        authUser?.user_metadata?.name ??
        authUser?.email?.split('@')[0] ??
        'Usuário';
      const fallbackAvatar = authUser?.user_metadata?.avatar_url ?? authUser?.user_metadata?.picture ?? null;

      // Cria o perfil manualmente se o trigger ainda não rodou
      await supabase.from('profiles').upsert({
        id: userId,
        name: fallbackName,
        avatar_url: fallbackAvatar,
      });

      profile = { name: fallbackName, avatar_url: fallbackAvatar, plan: null, subscribed_at: null, expires_at: null };
    }

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
    } catch (err) {
      console.error('loadProfile error:', err);
      setLoading(false);
    }
  }

  const isActive = user
    ? !!user.expiresAt && new Date(user.expiresAt) > new Date()
    : false;

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function updateName(newName: string) {
    if (!user) return;
    await supabase.from('profiles').update({ name: newName }).eq('id', user.id);
    setUser((u) => u ? { ...u, name: newName } : u);
  }

  async function updateAvatar(file: File): Promise<string | null> {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { console.error('Avatar upload error:', error); return null; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    setUser((u) => u ? { ...u, avatar: url } : u);
    return url;
  }

  return { user, loading, isActive, signOut, updateName, updateAvatar };
}
