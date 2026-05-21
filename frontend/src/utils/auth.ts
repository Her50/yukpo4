// Utilitaires d'authentification pour gérer les tokens JWT
//
// ✅ 2026-05-21 — Migration cookie httpOnly (fix XSS) :
// Le JWT n'est plus accessible côté JS — il est dans un cookie HttpOnly que
// le navigateur envoie automatiquement via `withCredentials` (axios) ou via
// le wrapper `window.fetch` configuré dans `config/axios.ts`. Les fonctions
// de ce module deviennent no-op pour le stockage du token tout en conservant
// l'API publique pour ne pas casser les ~30 appelants existants.

/**
 * @deprecated Le JWT n'est plus côté JS. Retourne toujours `null`.
 * Les requêtes web s'authentifient via le cookie httpOnly automatiquement.
 */
export const getValidToken = (): string | null => {
  // Pendant la transition, on tolère un legacy localStorage pour les écrans
  // qui décodent encore le JWT (ex: jwtDecode dans yukpoaclient/CreatePublicitePage).
  // Cette tolérance sera supprimée après migration complète de ces écrans.
  try {
    const legacy = localStorage.getItem('token');
    if (legacy && legacy !== 'null' && legacy !== 'undefined' && legacy.trim() !== '') {
      const parts = legacy.split('.');
      if (parts.length === 3) return legacy;
    }
  } catch { /* noop */ }
  return null;
};

/**
 * @deprecated Le cookie httpOnly fournit l'authentification. Retourne `{}`.
 */
export const getAuthHeaders = (): Record<string, string> => {
  return {};
};

/**
 * Vérifie via /api/auth/me si une session est active. Utilise un cache courte
 * durée en module pour éviter de spammer l'endpoint.
 */
let _cachedAuthState: { ts: number; value: boolean } | null = null;
const AUTH_CACHE_MS = 30_000;

export const isAuthenticated = (): boolean => {
  // Synchrone : on s'appuie sur le cache si récent, sinon on retourne `false`
  // par défaut (le composant doit appeler `refreshAuthState` pour relancer).
  if (_cachedAuthState && Date.now() - _cachedAuthState.ts < AUTH_CACHE_MS) {
    return _cachedAuthState.value;
  }
  // Fallback : un legacy token en localStorage est toléré pendant la transition.
  return getValidToken() !== null;
};

export const refreshAuthState = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/me`);
    const ok = res.ok;
    _cachedAuthState = { ts: Date.now(), value: ok };
    return ok;
  } catch {
    _cachedAuthState = { ts: Date.now(), value: false };
    return false;
  }
};

/**
 * @deprecated Plus rien à nettoyer côté JS — le cookie est géré par le serveur.
 * Conservé pour compat ; purge également un éventuel legacy localStorage.
 */
export const clearInvalidToken = (): void => {
  try {
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      localStorage.removeItem('token');
    }
  } catch { /* noop */ }
};

/**
 * @deprecated NO-OP : le JWT est déjà posé en cookie HttpOnly par le backend
 * dans la réponse de /auth/login. Stocker en localStorage ré-introduirait le
 * vector XSS qu'on vient de fermer.
 *
 * Conservé comme no-op pour ne pas casser les ~15 appelants.
 */
export const setValidToken = (_token: string): void => {
  // Volontairement vide. Cf. doc.
  console.info('[auth] setValidToken : no-op (JWT en cookie httpOnly)');
};

/**
 * Déconnexion : appelle POST /auth/logout qui blacklist le JWT serveur et
 * efface le cookie. Aussi purge un éventuel legacy localStorage.
 */
export const logout = async (apiBaseUrl?: string): Promise<void> => {
  try {
    if (apiBaseUrl) {
      await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST' });
    }
  } catch { /* non bloquant */ }
  try { localStorage.removeItem('token'); } catch { /* noop */ }
  _cachedAuthState = { ts: Date.now(), value: false };
};
