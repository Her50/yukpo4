import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

/**
 * Sélecteur de gamme pour les fournitures / cahiers / accessoires.
 *
 * 3 niveaux : entrée / standard / premium, chacun calculé via un ratio sur
 * le prix officiel. C'est une approximation côté frontend en attendant que
 * le backend retourne `prix_min`, `prix_median`, `prix_max` réels (ils existent
 * dans la table accessoires_populaires_par_classe mais pas dans la réponse scan).
 *
 * Gamme par défaut = 'standard'. Le composant remonte au parent la gamme + le
 * prix recalculé via `onChange`.
 */

export type Gamme = 'entree' | 'standard' | 'premium';

const RATIOS: Record<Gamme, number> = {
  entree: 0.6,
  standard: 1.0,
  premium: 1.5,
};

const LABELS: Record<Gamme, string> = {
  entree: 'Entrée',
  standard: 'Standard',
  premium: 'Premium',
};

const COLORS: Record<Gamme, string> = {
  entree:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-blue-50 text-blue-700 border-blue-200',
  premium:  'bg-purple-50 text-purple-700 border-purple-200',
};

const COLORS_ACTIVE: Record<Gamme, string> = {
  entree:   'bg-emerald-500 text-white border-emerald-500',
  standard: 'bg-blue-500 text-white border-blue-500',
  premium:  'bg-purple-500 text-white border-purple-500',
};

export interface GammeSelectorProps {
  prixOfficiel: number | undefined;
  gamme: Gamme;
  devise?: string;
  onChange: (g: Gamme, prixCalcule: number) => void;
  /** Compact = pill cliquable avec dropdown ; sinon = 3 boutons radio inline. */
  variant?: 'compact' | 'inline';
}

export function priceForGamme(prixOfficiel: number | undefined, g: Gamme): number {
  if (!prixOfficiel || prixOfficiel <= 0) return 0;
  return Math.round(prixOfficiel * RATIOS[g]);
}

const GammeSelector: React.FC<GammeSelectorProps> = ({
  prixOfficiel, gamme, devise = 'XAF', onChange, variant = 'compact',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ⚠️ On garde le sélecteur visible MÊME sans prix : le user peut alors choisir
  // sa gamme préférée, et l'enrichissement asynchrone (match-programmes-by-title)
  // remplira le prix plus tard. En attendant, on affiche les libellés sans le
  // prix.
  const hasPrice = !!prixOfficiel && prixOfficiel > 0;

  if (variant === 'inline') {
    // 3 boutons radio inline (peu de place horizontale requise)
    return (
      <div className="flex gap-1">
        {(Object.keys(LABELS) as Gamme[]).map(g => {
          const isActive = gamme === g;
          const price = priceForGamme(prixOfficiel, g);
          return (
            <button
              key={g}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(g, price); }}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors ${
                isActive ? COLORS_ACTIVE[g] : COLORS[g]
              }`}
              title={hasPrice ? `${LABELS[g]} : ${price.toLocaleString('fr-FR')} ${devise}` : LABELS[g]}
            >
              {LABELS[g][0]}
            </button>
          );
        })}
      </div>
    );
  }

  // Variante compacte : pill cliquable
  const currentPrice = priceForGamme(prixOfficiel, gamme);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${COLORS[gamme]}`}
        title="Changer de gamme"
      >
        {LABELS[gamme]}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden min-w-[140px]">
          {(Object.keys(LABELS) as Gamme[]).map(g => {
            const isActive = gamme === g;
            const price = priceForGamme(prixOfficiel, g);
            return (
              <button
                key={g}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(g, price);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-gray-50 ${
                  isActive ? 'bg-amber-50' : ''
                }`}
              >
                <span className="flex items-center gap-1">
                  {isActive && <Check className="w-3 h-3 text-amber-600" />}
                  <span className={isActive ? 'font-bold text-amber-700' : 'text-gray-700'}>
                    {LABELS[g]}
                  </span>
                </span>
                <span className="text-gray-500 tabular-nums">
                  {hasPrice ? `${price.toLocaleString('fr-FR')} ${devise}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GammeSelector;
