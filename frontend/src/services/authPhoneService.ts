// =============================================================================
// authPhoneService — auth simplifiée par téléphone + PIN 4 chiffres
// =============================================================================
// 2026-05-28 — Cible : parents qui scannent une liste scolaire à la rentrée.
// Pas d'email, pas de mot de passe complexe. Sécurité = PIN bcrypt côté
// serveur + rate-limit (5 essais / 15 min lockout).
// =============================================================================

import { apiPost } from './apiService';

export interface CheckPhoneResponse {
  exists: boolean;
  locked: boolean;
  locked_until: string | null;
  phone_normalized: string;
}

export interface AuthUser {
  id: number;
  role: string;
  phone: string;
  nom_complet: string | null;
  tokens_balance: number;
  /** 2026-05-28 — FALSE tant que la possession de la SIM n'a pas été
   *  prouvée (OTP futur, validation admin / librairie partenaire).
   *  Gate les actions sensibles : payout cash, création troc. */
  phone_verified: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

/** Normalise un numéro côté client (cohérent avec normalize_phone() backend). */
export function normalizePhone(p: string): string {
  if (!p) return '';
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '+' && i === 0) out += '+';
    else if (c >= '0' && c <= '9') out += c;
  }
  return out;
}

/** Vérifie si un numéro a déjà un compte. */
export async function checkPhone(phone: string): Promise<CheckPhoneResponse> {
  const res = await apiPost('/api/auth/phone/check', { phone });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as CheckPhoneResponse;
}

/** Crée un nouveau compte (phone + PIN + nom + prénom). */
export async function registerPhone(input: {
  phone: string;
  phone_confirm: string;
  pin: string;
  pin_confirm: string;
  nom: string;
  prenom: string;
  email?: string;
}): Promise<AuthResponse> {
  const res = await apiPost('/api/auth/phone/register', input);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as AuthResponse;
}

/** Authentifie avec phone + PIN. */
export async function loginPhone(phone: string, pin: string): Promise<AuthResponse> {
  const res = await apiPost('/api/auth/phone/login', { phone, pin });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as AuthResponse;
}

/** Signale qu'un numéro a été pris par quelqu'un d'autre ("c'est mon numéro,
 *  pas le sien"). Crée un ticket admin sans alerter le compte cible.
 *  Anti-spam : 3 / IP / 24 h côté backend. */
export async function reclaimPhone(input: {
  phone: string;
  contact: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await apiPost('/api/auth/phone/reclaim', input);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}
