// ✅ Widget de sélection de langue compact pour la Bourse du Livre
// Date : 2026-05-08
//
// Affiche un bouton drapeau qui ouvre un menu déroulant avec les 5 langues
// supportées (FR/EN/PT/AR/FF). Persiste le choix dans localStorage `yukpo_lang`
// (clé utilisée par i18nAutoDetector). Force le sens RTL pour l'arabe.

import { ChevronDown, Globe } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGS: { code: string; label: string; flag: string; rtl?: boolean }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'ff', label: 'Pulaar', flag: '🌍' },
];

interface Props {
  /** Variante d'affichage : "minimal" = juste un drapeau, "labeled" = drapeau + nom */
  variant?: 'minimal' | 'labeled';
  /** Couleur du texte ("white" sur fond coloré, "dark" sur fond clair) */
  tone?: 'white' | 'dark';
}

const LanguageSwitcherBourse: React.FC<Props> = ({
  variant = 'minimal',
  tone = 'dark',
}) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const change = (code: string, rtl?: boolean) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem('yukpo_lang', code);
    } catch { /* */ }
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
    setOpen(false);
  };

  const btnColor = tone === 'white'
    ? 'text-white bg-white/20 hover:bg-white/30'
    : 'text-gray-700 bg-gray-100 hover:bg-gray-200';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${btnColor}`}
        aria-label="Langue"
      >
        <span className="text-base leading-none">{current.flag}</span>
        {variant === 'labeled' && <span>{current.label}</span>}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden min-w-[140px]">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => change(l.code, l.rtl)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-gray-50 ${
                l.code === current.code ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-700'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcherBourse;
