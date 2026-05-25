// Détecte le type de partenaire ciblé par le build/sous-domaine courant.
// - dist-pharmacie  → pharmacie  (subdomain pharmacie.* ou VITE_APP_PARTNER_TYPE)
// - dist-restaurant → restaurant (subdomain restaurant.* ou VITE_APP_PARTNER_TYPE)
// - autres builds  → null (multi-rôles)
import { useMemo } from 'react';

export type PartnerType =
  | 'pharmacie'
  | 'restaurant'
  | 'hopital'
  | 'laboratoire'
  | 'agence de voyage'
  | 'demenagement'
  | 'livraison'
  | 'livraison_courses_marche'
  | 'transport'
  | 'assureur'
  | 'supermarche'
  | 'telecom'
  | 'hotel'
  | 'meuble'
  | 'etablissementscolaire'
  | 'banquesang';

export interface PartnerContext {
  /** Le partner_type que cette app standalone gère (null si app générique) */
  appPartnerType: PartnerType | null;
  /** Nom affiché ("Yukpo Pharmacie" / "Yukpo Restaurant") */
  appName: string;
  /** Couleur principale (tailwind class accent) */
  accentColor: string;
  /** Couleur hex (PWA theme) */
  themeColor: string;
}

const DETECTORS: Array<{ match: () => boolean; type: PartnerType; name: string; accent: string; theme: string }> = [
  {
    match: () => /pharmacie/i.test(window.location.hostname) || import.meta.env.VITE_APP_PARTNER_TYPE === 'pharmacie',
    type: 'pharmacie',
    name: 'Yukpo Pharmacie',
    accent: 'emerald',
    theme: '#059669',
  },
  {
    match: () => /restaurant/i.test(window.location.hostname) || import.meta.env.VITE_APP_PARTNER_TYPE === 'restaurant',
    type: 'restaurant',
    name: 'Yukpo Restaurant',
    accent: 'red',
    theme: '#dc2626',
  },
];

export const usePartnerContext = (): PartnerContext => {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { appPartnerType: null, appName: 'Yukpo', accentColor: 'blue', themeColor: '#2563eb' };
    }
    const hit = DETECTORS.find((d) => d.match());
    if (hit) {
      return { appPartnerType: hit.type, appName: hit.name, accentColor: hit.accent, themeColor: hit.theme };
    }
    return { appPartnerType: null, appName: 'Yukpo', accentColor: 'blue', themeColor: '#2563eb' };
  }, []);
};
