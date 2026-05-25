// Modal de consentement affiché au 1er lancement de la PWA Pharmacie.
//
// L'utilisateur doit reconnaître explicitement que les informations IA
// (posologie, interactions, alternatives) sont indicatives et ne remplacent
// pas l'avis d'un professionnel de santé.
//
// Persistance : localStorage `yukpo_pharmacie_consent_v1` (versionné pour
// pouvoir invalider et redemander si on change les conditions).
//
// ⚠️ Ce gate est obligatoire pour des raisons éthiques/réglementaires :
//   - Sans consentement explicite, on s'expose à l'exercice illégal de la
//     pharmacie (CSP L.4223-1 en France, loi 90/035 Cameroun, etc.)
//   - Le log d'acceptation côté frontend ne suffit pas en cas de litige —
//     idéalement on doublera par un POST serveur, mais pour cette première
//     itération on garde le localStorage.

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '@/services/apiService';

const STORAGE_KEY = 'yukpo_pharmacie_consent_v1';
const CONSENT_VERSION = 'v1';

interface Props {
  children: React.ReactNode;
}

export const PharmacieConsentGate: React.FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(STORAGE_KEY) === 'accepted');
    } catch {
      // localStorage inaccessible (mode privé Safari, etc.) → on demande quand même
      setAccepted(false);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      localStorage.setItem(`${STORAGE_KEY}_ts`, new Date().toISOString());
    } catch {
      // pas critique : si le user refresh on redemandera
    }
    setAccepted(true);

    // Log côté serveur, best-effort. On débloque l'UI immédiatement et on
    // n'attend pas la réponse — si le POST échoue (offline, backend down),
    // l'utilisateur reste libre d'utiliser l'app, et le localStorage est
    // déjà persisté côté client.
    void (async () => {
      try {
        const res = await apiPost('/api/pharmacies/consent', {
          consent_version: CONSENT_VERSION,
          lang: typeof document !== 'undefined' ? document.documentElement.lang : undefined,
          meta: {
            href: typeof window !== 'undefined' ? window.location.href : null,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.consent_id) {
            try {
              localStorage.setItem(`${STORAGE_KEY}_server_id`, String(data.consent_id));
            } catch { /* */ }
          }
        }
      } catch {
        /* log serveur best-effort, on ignore l'erreur */
      }
    })();
  };

  const handleDecline = () => {
    // On ne peut pas vraiment "quitter" une PWA — on redirige vers Yukpo principal
    window.location.href = 'https://yukpomnang.com';
  };

  // Pendant la lecture localStorage on ne rend rien (évite un flash de modal)
  if (accepted === null) return null;

  if (accepted) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                {t('pharmacie.consent.title')}
              </h2>
              <p className="text-xs text-gray-500">{t('pharmacie.consent.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <ConsentLine text={t('pharmacie.consent.line1')} />
            <ConsentLine text={t('pharmacie.consent.line2')} />
            <ConsentLine text={t('pharmacie.consent.line3')} />
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={handleAccept}
              className="w-full bg-blue-600 active:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 min-h-[48px]"
            >
              <ShieldCheck className="w-4 h-4" />
              {t('pharmacie.consent.accept')}
            </button>
            <button
              onClick={handleDecline}
              className="w-full text-gray-500 hover:text-gray-700 py-2.5 text-xs font-medium"
            >
              {t('pharmacie.consent.decline')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant local qui interprète **gras** style markdown (un seul niveau, sans
// dépendance markdown lib pour ne pas alourdir le bundle pharmacie).
const ConsentLine: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-gray-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};

export default PharmacieConsentGate;
