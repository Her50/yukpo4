// Détection intelligente de mapping de colonnes pour l'import en lot.
//
// Stratégie hybride :
// 1. Match déterministe (alias statiques + appris) → gratuit, instantané
// 2. Si colonnes obligatoires manquantes → appel LLM (/ai/chat) pour proposer un mapping
// 3. Les nouvelles correspondances sont mémorisées en localStorage → la fois suivante,
//    le même fichier est parsé en pure déterministe (0 appel LLM, 0 latence).
//
// La table d'alias appris vit côté navigateur (clé localStorage par partner_type).
// On peut plus tard la pousser côté backend pour partage entre tous les pharmaciens.

import { apiPost } from './apiService';

export type PartnerKind = 'pharmacie' | 'restaurant';

const STORAGE_KEY = (kind: PartnerKind) => `yukpo_learned_aliases_${kind}_v1`;

/** Cache en mémoire pour éviter de lire localStorage à chaque pick(). */
const cache: Record<PartnerKind, Record<string, string[]> | null> = {
  pharmacie: null,
  restaurant: null,
};

/** Normalise une clé pour le matching : lowercase + sans accents + sans non-alphanumérique. */
export const normKey = (k: string): string =>
  String(k).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');

/** Charge les alias appris depuis localStorage (cache). */
export const getLearnedAliases = (kind: PartnerKind): Record<string, string[]> => {
  if (cache[kind]) return cache[kind] as Record<string, string[]>;
  try {
    cache[kind] = JSON.parse(localStorage.getItem(STORAGE_KEY(kind)) || '{}');
  } catch {
    cache[kind] = {};
  }
  return cache[kind] as Record<string, string[]>;
};

/** Ajoute un alias appris et le persiste. */
export const addLearnedAlias = (
  kind: PartnerKind,
  canonical: string,
  headerNormalized: string,
): void => {
  const learned = getLearnedAliases(kind);
  if (!learned[canonical]) learned[canonical] = [];
  if (!learned[canonical].includes(headerNormalized)) {
    learned[canonical].push(headerNormalized);
    localStorage.setItem(STORAGE_KEY(kind), JSON.stringify(learned));
  }
};

/** Réinitialise les alias appris (debug / reset utilisateur). */
export const clearLearnedAliases = (kind: PartnerKind): void => {
  cache[kind] = {};
  localStorage.removeItem(STORAGE_KEY(kind));
};

/**
 * Appelle le LLM pour mapper des en-têtes inconnues à des champs canoniques.
 * Retourne `{ headerOriginal: canonical }` pour les en-têtes qui matchent un champ valide.
 * Persiste automatiquement les nouveaux alias.
 */
export const aiResolveHeaders = async (
  kind: PartnerKind,
  headers: string[],
  samples: any[],
  canonicalFields: string[],
): Promise<{ mapping: Record<string, string>; raw?: string }> => {
  const subject = kind === 'pharmacie' ? 'inventaire de pharmacie' : 'menu de restaurant';
  const prompt = [
    `Tu reçois les en-têtes d'un fichier d'${subject}.`,
    `Mappe chaque en-tête à l'un des champs canoniques suivants : ${canonicalFields.join(', ')}.`,
    `Si un en-tête ne correspond à aucun champ, ignore-le.`,
    ``,
    `En-têtes : ${JSON.stringify(headers)}`,
    `Premières lignes (échantillon) : ${JSON.stringify(samples.slice(0, 3))}`,
    ``,
    `Réponds UNIQUEMENT avec un objet JSON (pas de markdown, pas de texte) au format :`,
    `{"En-tête tel quel": "champ_canonique", ...}`,
  ].join('\n');

  try {
    const res = await apiPost('/ai/chat', { question: prompt, type: 'column_mapping' });
    const txt = await res.text();
    if (!txt) return { mapping: {} };
    const j = JSON.parse(txt);
    const text: string =
      j?.data?.message || j?.data?.response || j?.message || j?.response || '';

    // Extrait le premier objet JSON du texte LLM (tolère le markdown autour)
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { mapping: {}, raw: text };
    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(match[0]);
    } catch {
      return { mapping: {}, raw: text };
    }

    // Filtre aux champs valides + mémorise
    const valid: Record<string, string> = {};
    for (const [header, canonical] of Object.entries(mapping)) {
      if (typeof canonical !== 'string') continue;
      if (!canonicalFields.includes(canonical)) continue;
      valid[header] = canonical;
      addLearnedAlias(kind, canonical, normKey(header));
    }
    return { mapping: valid };
  } catch {
    return { mapping: {} };
  }
};

/**
 * Détermine si un parsing déterministe a "réussi" : au moins une ligne avec nom + prix > 0.
 * Si non, on tentera un fallback IA.
 */
export const needsAiFallback = (rows: Array<{ nom?: string; nom_produit?: string; prix?: number }>): boolean => {
  if (rows.length === 0) return true;
  const valid = rows.filter(r => (r.nom_produit || r.nom) && (r.prix ?? 0) > 0);
  return valid.length === 0;
};
