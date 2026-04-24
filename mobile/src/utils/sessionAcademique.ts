/**
 * Session académique — calcul par pays.
 *
 * Règle par défaut (Afrique francophone + anglophone de la région) :
 *   mois 1-5  (janv-mai) → année_précédente / année_courante   (ex : juillet 2026 → "2025-2026")
 *   mois 6-12 (juin-déc) → année_courante / année_suivante     (ex : septembre 2026 → "2026-2027")
 *
 * Variations futures possibles : certaines années scolaires démarrent en janvier
 * (hémisphère sud), etc. Structure extensible.
 */

import type { PaysCode } from '../data/schoolSystems';

type RentreeBreakpoint = {
  /** Mois (1-12) — à partir duquel la session "suivante" démarre */
  startMonth: number;
};

const RENTREE_PAR_PAYS: Partial<Record<PaysCode, RentreeBreakpoint>> = {
  CM: { startMonth: 6 }, // septembre mais on anticipe à juin (préinscriptions)
  CI: { startMonth: 6 },
  SN: { startMonth: 6 },
  GA: { startMonth: 6 },
  CG: { startMonth: 6 },
  CD: { startMonth: 6 },
  BJ: { startMonth: 6 },
  TG: { startMonth: 6 },
  BF: { startMonth: 6 },
  ML: { startMonth: 6 },
  NE: { startMonth: 6 },
  NG: { startMonth: 6 }, // rentrée septembre
  GH: { startMonth: 6 }, // rentrée septembre/janvier selon terms
};

const DEFAULT: RentreeBreakpoint = { startMonth: 6 };

export interface SessionInfo {
  annee: string;       // "2025-2026"
  debut: number;       // 2025
  fin: number;         // 2026
  pays: PaysCode;
}

export function computeSessionAcademique(pays: PaysCode = 'CM', at: Date = new Date()): SessionInfo {
  const cfg = RENTREE_PAR_PAYS[pays] ?? DEFAULT;
  const year = at.getFullYear();
  const month = at.getMonth() + 1; // 1-12

  if (month >= cfg.startMonth) {
    return { annee: `${year}-${year + 1}`, debut: year, fin: year + 1, pays };
  }
  return { annee: `${year - 1}-${year}`, debut: year - 1, fin: year, pays };
}

/** Parse "2025-2026" → { debut:2025, fin:2026 } ; null si invalide */
export function parseSessionString(str: string): { debut: number; fin: number } | null {
  const m = str.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (!m) return null;
  const debut = parseInt(m[1], 10);
  const fin = parseInt(m[2], 10);
  if (fin !== debut + 1) return null;
  return { debut, fin };
}

/** true si la session détectée sur le document correspond à celle calculée */
export function isSessionCoherente(detected: string, expected: SessionInfo): boolean {
  const p = parseSessionString(detected);
  if (!p) return false;
  return p.debut === expected.debut && p.fin === expected.fin;
}
