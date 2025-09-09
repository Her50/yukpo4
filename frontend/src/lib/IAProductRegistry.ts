// @ts-check
import React from 'react';

export type YukpomnangPlan = 'free' | 'pro' | 'enterprise';

export interface YukpomnangProduct {
  id: string;
  name: string; // ✅ utilisé dans DashboardIA.tsx
  description: string;
  plans: YukpomnangPlan[];
}

export const Yukpomnang_PRODUCTS: YukpomnangProduct[] = [
  {
    id: 'ia_match_auto',
    name: 'Match automatique intelligent',
    description: 'Associe chaque bien au profil utilisateur le plus pertinent.',
    plans: ['pro', 'enterprise'],
  },
  {
    id: 'ia_fiche_auto',
    name: 'Génération automatique de fiches',
    description: 'Crée une fiche descriptive Yukpomnang à partir des données.',
    plans: ['free', 'pro', 'enterprise'],
  },
  {
    id: 'ia_voice_search',
    name: 'Recherche vocale',
    description: 'Permet aux utilisateurs de rechercher par commande vocale.',
    plans: ['pro', 'enterprise'],
  },
  {
    id: 'ia_prediction',
    name: 'Prédictions Yukpomnang',
    description: 'Analyse les tendances pour prédire les opportunités.',
    plans: ['enterprise'],
  },
  {
    id: 'ia_playlist_ai',
    name: 'Playlist musicale personnalisée',
    description: 'Génère une playlist adaptée à l’humeur ou à l’activité.',
    plans: ['pro', 'enterprise'],
  },
  {
    id: 'ia_chat_recherche',
    name: 'Recherche conversationnelle (type ChatGPT)',
    description: 'Permet aux utilisateurs de dialoguer pour explorer les offres.',
    plans: ['free', 'pro', 'enterprise'],
  },
];

/**
 * Retourne la liste des produits Yukpomnang accessibles selon le plan
 */
export function getProductsByPlan(plan: YukpomnangPlan): YukpomnangProduct[] {
  return Yukpomnang_PRODUCTS.filter((p) => p.plans.includes(plan));
}
