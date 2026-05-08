// 📁 frontend/src/hooks/useGuestAuth.ts
//
// Auto-registration silencieuse d'un compte invité pour la Bourse du Livre.
// L'utilisateur peut utiliser tout le workflow (scan, troc, vente, commande)
// sans jamais voir d'écran de login. Le compte invité est créé à la première
// visite, persisté en localStorage, et réutilisé ensuite.
//
// Le user peut plus tard "promouvoir" son compte invité (ajouter email + mot
// de passe perso) via la page profil.

import { useEffect, useRef } from 'react';

const GUEST_FLAG_KEY = 'yukpo_guest_account';
const TOKEN_KEY = 'token';

/** Génère un email + mot de passe pseudo-aléatoires pour le compte invité.
 *  L'email a un domaine `.yukpo.guest` pour qu'on puisse les distinguer. */
function generateGuestCredentials(): { email: string; password: string; nom: string } {
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const short = uuid.replace(/-/g, '').slice(0, 12);
  const password = `Gst-${uuid.replace(/-/g, '').slice(0, 24)}!`;
  // ⚠️ Le backend valide `nom` avec une regex qui REJETTE les chiffres.
  // On utilise donc un nom 100% alphabétique (l'email/password contiennent
  // l'identifiant unique pour distinguer les comptes invités).
  return {
    email: `guest-${short}@yukpo.guest`,
    password,
    nom: 'Invité Yukpo',
  };
}

async function registerGuest(): Promise<string | null> {
  const creds = generateGuestCredentials();
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creds.email,
        password: creds.password,
        nom: creds.nom,
        prenom: 'Parent',
        name: creds.nom,
        lang: localStorage.getItem('yukpo_lang') || 'fr',
      }),
    });
    if (!res.ok) {
      console.warn('[useGuestAuth] Auto-register HTTP', res.status);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const token: string | undefined =
      data?.token || data?.access_token || data?.data?.token || data?.data?.access_token;
    if (!token) {
      console.warn('[useGuestAuth] register OK mais pas de token retourné', data);
      return null;
    }
    // Persiste les credentials guest pour traçabilité (le user peut promouvoir plus tard)
    localStorage.setItem(GUEST_FLAG_KEY, JSON.stringify({
      email: creds.email,
      created_at: new Date().toISOString(),
    }));
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn('[useGuestAuth] Auto-register échec réseau', e);
    return null;
  }
}

/** Hook à appeler dans AppBourse — déclenche l'auto-création de compte invité
 *  si le visiteur n'a pas de token au montage de l'app Bourse. */
export function useGuestAuth() {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) {
      // Déjà authentifié (compte normal ou invité existant) — rien à faire
      return;
    }

    // Pas de token : créer un compte invité silencieusement
    registerGuest().then((token) => {
      if (token) {
        // Force un reload léger pour que useUser/useAuth recapent le token
        // (ils ont des effets initialisés au mount).
        // On évite de reload toute la page : à la place on dispatch un event
        // que useUser écoute déjà.
        window.dispatchEvent(new Event('tokens_updated'));
        // En cas de race condition, un reload doux après 200ms force le pickup
        setTimeout(() => {
          window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: token }));
        }, 200);
      }
    });
  }, []);
}

/** Retourne true si l'utilisateur courant est un compte invité auto-créé.
 *  Vérifie le payload JWT en priorité (email @yukpo.guest) car le flag
 *  localStorage peut subsister après une connexion avec un vrai compte. */
export function isGuestAccount(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const email: string = (payload?.email || '').toLowerCase();
        // Compte non-invité = email réel (pas du domaine guest)
        if (email && !email.endsWith('@yukpo.guest')) {
          // Nettoie le flag obsolète pour éviter de futurs faux positifs
          try { localStorage.removeItem(GUEST_FLAG_KEY); } catch {}
          return false;
        }
        if (email.endsWith('@yukpo.guest')) {
          return true;
        }
      }
    }
    // Fallback : flag local si JWT non décodable
    const flag = localStorage.getItem(GUEST_FLAG_KEY);
    return !!flag;
  } catch { return false; }
}
