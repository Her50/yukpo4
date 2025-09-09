import React from 'react';
// @ts-check
export function useSemanticRedirect(input: string): {
    emoji: string;
    label: string;
    link: string;
  }[] {
  const lower = input.toLowerCase();

  if (lower.includes('transport') || lower.includes('bus') || lower.includes('ticket')) {
    return [{ emoji: '🎫', label: 'Créer un ticket', link: '/tickets' }];
  }

  if (lower.includes('maison') || lower.includes('terrain') || lower.includes('immobilier')) {
    return [{ emoji: '🏘️', label: 'Créer un bien immobilier', link: '/biens' }];
  }

  if (lower.includes('livre') || lower.includes('manuel') || lower.includes('scolaire')) {
    return [{ emoji: '📘', label: 'Publier un livre', link: '/livres' }];
  }

  return [
    { emoji: '🎯', label: 'Moteur Yukpomnang de matching', link: '/matching' },
    { emoji: '⚙️', label: 'Créer un service classique', link: '/creation' },
  ];
}
