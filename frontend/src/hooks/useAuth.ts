// Hook personnalisé pour gérer l'authentification
//
// ✅ 2026-05-21 — Migration cookie httpOnly :
// Le JWT n'est plus accessible côté JS (fix XSS). L'état d'authentification
// est restauré au mount via un appel /api/auth/me (cookie envoyé automatiquement).
// La fonction `login(token)` ne stocke plus le token (déjà posé en cookie par
// le backend) — elle met juste à jour l'état isAuthenticated.

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

interface AuthState {
  isAuthenticated: boolean;
  /** Conservé pour compat — toujours `null` côté web (token en cookie httpOnly).
   * Le mobile RN, qui n'utilise pas ce hook, garde son flow Bearer. */
  token: string | null;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    isLoading: true,
  });

  // Vérifier l'état d'authentification au montage en interrogeant /auth/me.
  // Le wrapper window.fetch global envoie les cookies (credentials: 'include').
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`);
        if (cancelled) return;
        setAuthState({
          isAuthenticated: res.ok,
          token: null,
          isLoading: false,
        });
      } catch {
        if (!cancelled) {
          setAuthState({ isAuthenticated: false, token: null, isLoading: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Connexion : le cookie est déjà posé par le backend dans la réponse de
  // /auth/login. On marque juste l'état comme authentifié.
  const login = useCallback((_token: string) => {
    setAuthState({ isAuthenticated: true, token: null, isLoading: false });
  }, []);

  // Déconnexion : appelle POST /auth/logout qui blacklist le JWT + clear le cookie.
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
    } catch { /* non bloquant */ }
    // Purge un éventuel legacy localStorage (migration)
    try { localStorage.removeItem('token'); } catch { /* noop */ }
    setAuthState({ isAuthenticated: false, token: null, isLoading: false });
  }, []);

  // ⚠️ Compat : retourner des headers vides — le cookie httpOnly suffit pour
  // s'authentifier. Conservé pour ne pas casser les appelants legacy.
  const getAuthHeaders = useCallback((): Record<string, string> => {
    return {};
  }, []);

  const cleanInvalidToken = useCallback(() => {
    try { localStorage.removeItem('token'); } catch { /* noop */ }
    setAuthState((prev) => ({ ...prev, isAuthenticated: false, token: null }));
  }, []);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    cleanInvalidToken,
  };
};
