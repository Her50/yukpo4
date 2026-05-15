// ✅ 2026-05-15 — Stockage local du code de parrainage capturé via ?ref=XXX
//
// PHILOSOPHIE :
//   • Au load de l'app, on lit ?ref=XXX, on enregistre en localStorage
//     avec une expiration 30j, puis on notifie le backend (track-click).
//   • L'URL est nettoyée pour ne pas polluer le partage social.
//   • Au signup, RegisterPage récupère le code via getStoredRefCode()
//     et l'envoie au backend dans le payload register.
//   • Une fois le user inscrit ET attaché, on appelle clearStoredRefCode().

const STORAGE_KEY = 'yukpo_ref_code';
const STORAGE_TS_KEY = 'yukpo_ref_code_ts';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

const isValidCode = (raw: string): boolean => {
  const code = raw.trim().toUpperCase();
  // 6 chars alphanumériques (l'alphabet backend est plus strict, mais on
  // accepte large côté front pour ne pas perdre un clic légitime — le
  // backend rejettera si le code n'existe pas).
  return /^[A-Z0-9]{4,10}$/.test(code);
};

/**
 * À appeler au boot de l'app (avant le rendu React).
 * - Lit ?ref=XXX si présent
 * - Stocke en localStorage (30j)
 * - Notifie le backend (track-click) en fire-and-forget
 * - Nettoie l'URL via history.replaceState pour pas exporter le code
 *   dans les partages social/bookmarks.
 */
export function captureRefFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('ref');
    if (!raw || !isValidCode(raw)) return;

    const code = raw.trim().toUpperCase();
    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));

    // Notif backend (fire-and-forget) — landing path actuel pour analytics
    void fetch('/api/referral/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        landing_path: url.pathname,
        user_agent: navigator.userAgent,
      }),
    }).catch(() => { /* silencieux */ });

    // Nettoyage de l'URL (garde les autres query params)
    url.searchParams.delete('ref');
    window.history.replaceState(
      null,
      '',
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash,
    );
  } catch {
    // localStorage indispo (mode privé Safari, quota) — non bloquant
  }
}

/** Retourne le code stocké s'il n'a pas expiré (sinon null). */
export function getStoredRefCode(): string | null {
  try {
    const code = localStorage.getItem(STORAGE_KEY);
    const ts = parseInt(localStorage.getItem(STORAGE_TS_KEY) || '0', 10);
    if (!code || !ts) return null;
    if (Date.now() - ts > TTL_MS) {
      clearStoredRefCode();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/** À appeler une fois le signup terminé pour libérer le slot. */
export function clearStoredRefCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
  } catch {
    // ignore
  }
}
