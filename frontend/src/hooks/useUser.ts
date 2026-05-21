// src/hooks/useUser.ts
//
// ✅ 2026-05-21 — Migration cookie httpOnly (fix XSS) :
// Le JWT n'est plus accessible côté JS. On fetch `/api/auth/me` pour restaurer
// l'utilisateur courant. Plus aucun `jwtDecode(localStorage.getItem('token'))`.
import { useState, useEffect, useCallback, useRef } from 'react';
import { isAdminRole } from '@/utils/roleHelpers';
import { API_BASE_URL } from '../config/api';

export type Role = 'admin' | 'user' | 'client' | 'public';

/** @deprecated — Conservé pour compat type des écrans qui importent encore.
 * Le JWT n'est plus décodé côté JS ; les claims viennent de /auth/me.
 */
export interface DecodedToken {
  sub: string | number;
  email: string;
  role: Role | string;
  exp: number;
  name?: string;
  photo?: string;
  picture?: string;
  tokens_balance?: number;
  currency?: string;
  partner_type?: string | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isUser: boolean;
  isPartner: boolean;
  partnerType?: string | null;
  name: string;
  photo: string;
  nom?: string;
  prenom?: string;
  nom_complet?: string;
  photo_profil?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  lang?: string;
  credits?: number;
  currency?: string;
}

interface MeResponse {
  id: number;
  email: string;
  role: string;
  name?: string | null;
  partner_type?: string | null;
  tokens_balance?: number;
}

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializationRef = useRef(false);
  const lastUserRef = useRef<User | null>(null);

  const buildUserFromMe = useCallback((me: MeResponse): User => {
    const partnerType = me.partner_type ?? null;
    const isPartner = me.role === 'partenaire' || !!partnerType;
    return {
      id: String(me.id),
      email: me.email,
      role: me.role as Role,
      isAdmin: isAdminRole(me.role),
      isUser: me.role === 'user',
      isPartner,
      partnerType,
      name: me.name ?? '',
      photo: '',
      credits: me.tokens_balance ?? 0,
      currency: 'XAF',
    };
  }, []);

  // Récupère l'utilisateur depuis /auth/me. Override dev-fake-user géré ici aussi.
  const refreshUser = useCallback(async (): Promise<User | null> => {
    const isFakeUserMode =
      typeof window !== 'undefined' &&
      localStorage.getItem('__DEV_FAKE_USER__') === 'true';

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`);
      if (res.ok) {
        const me = (await res.json()) as MeResponse;
        const built = buildUserFromMe(me);
        // Override solde si présent dans localStorage (post-IA)
        const storedBalance =
          typeof window !== 'undefined'
            ? localStorage.getItem('tokens_balance')
            : null;
        if (storedBalance !== null) {
          built.credits = parseInt(storedBalance, 10);
        }
        return built;
      }
    } catch (e) {
      console.warn('[useUser] /auth/me erreur:', e);
    }

    // Fallback DEV fake user
    if (!user && import.meta.env.DEV && isFakeUserMode) {
      return {
        id: 'fake-dev-id',
        email: 'admin@yukpo.dev',
        role: 'admin',
        isAdmin: true,
        isUser: false,
        isPartner: false,
        partnerType: null,
        name: 'Dev Admin',
        photo: '',
        credits: 9999,
        currency: 'XAF',
      };
    }
    return null;
  }, [buildUserFromMe, user]);

  // Effet initial : appelle /auth/me + écoute les changements de tokens_balance
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    let cancelled = false;
    const updateUser = async () => {
      const current = await refreshUser();
      if (cancelled) return;
      if (JSON.stringify(current) !== JSON.stringify(lastUserRef.current)) {
        setUser(current);
        lastUserRef.current = current;
      }
      setIsLoading(false);
    };
    updateUser();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tokens_balance' || e.key === 'token') {
        updateUser();
      }
    };
    const handleTokensUpdate = () => {
      updateUser();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokens_updated', handleTokensUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokens_updated', handleTokensUpdate);
    };
  }, [refreshUser]);

  // 🔁 Bascule dynamique via console (mode dev)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__YUKPO_TOGGLE_DEV = () => {
        const current = localStorage.getItem('__DEV_FAKE_USER__') === 'true';
        localStorage.setItem('__DEV_FAKE_USER__', current ? 'false' : 'true');
        window.location.reload();
      };
    }
  }, []);

  const fetchUserDetails = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`);
      if (response.ok) {
        const userDetails = await response.json();
        setUser((prev) => (prev ? { ...prev, ...userDetails } : null));
      }
    } catch (error) {
      console.error('[useUser] Erreur récupération détails utilisateur:', error);
    }
  }, [user?.id]);

  return {
    user,
    isLoading,
    fetchUserDetails,
    // login : le cookie est déjà posé par le backend, on rafraîchit juste le state.
    login: async (_token: string) => {
      const next = await refreshUser();
      setUser(next);
    },
    logout: async () => {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
      } catch { /* non bloquant */ }
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('__DEV_FAKE_USER__');
      } catch { /* noop */ }
      window.location.href = '/';
    },
  };
};
