// ✅ 2026-05-15 — Carte "Parrainage" insérable dans tout dashboard.
//
// Affiche :
//   - Le code unique de l'utilisateur connecté
//   - Le lien complet partageable
//   - Boutons : copier le code, copier le lien, partager (Web Share API)
//   - Un QR code pour scan en face-à-face
//   - 4 stats : clics / inscrits / commandes converties / bonus gagnés (XAF)
//
// La logique business (seuil de 10 000 FCFA, déclenchement) est documentée
// côté backend (referral_service.rs) — l'UI affiche le bonus en valeur
// effective déjà gagnée (referrals.bonus_amount_xaf sommé).

import { ArrowLeftRight, Check, Copy, Loader2, Share2, Sparkles, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { apiGet } from '../../services/apiService';

interface ReferralData {
  code: string;
  share_url: string;
  /** 2026-06-08 — Nouveau modèle de rémunération parrainage :
   *  - bonus_percent_vente % du montant de la 1re commande qualifiante du filleul
   *  - bonus_percent_troc % de la commission Yukpo sur chaque troc effectué
   *    par un filleul (cumulable indéfiniment, pas seulement à la 1re fois)
   */
  bonus_percent_vente: number;
  bonus_percent_troc: number;
  bonus_seuil_min_xaf: number;
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  total_bonus_xaf: number;
  total_trocs_filleuls: number;
  total_troc_commission_xaf: number;
  total_gains_xaf: number;
}

const ReferralCard: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/referral/me');
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as ReferralData;
      setData(json);
    } catch {
      // Silencieux : si non authentifié, on n'affiche tout simplement rien.
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.share_url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error(t('referral.copy_error', { defaultValue: 'Copie impossible' }));
    }
  };

  const share = async () => {
    if (!data) return;
    // ✅ 2026-05-17 — Pas besoin de citer le code : le lien (data.share_url)
    // contient déjà ?ref=XXX qui est capturé automatiquement à l'ouverture
    // (cf. captureRefFromUrl). Le message est purement promotionnel.
    const shareText = t('referral.share_message', {
      defaultValue: 'Rejoins Yukpo et économise sur la rentrée scolaire !',
    });
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Yukpo',
          text: shareText,
          url: data.share_url,
        });
      } catch {
        // user cancelled
      }
    } else {
      void copyLink();
    }
  };

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section
      className="bg-gradient-to-br from-indigo-50 via-white to-amber-50 rounded-2xl border-2 border-indigo-200 p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm"
      aria-labelledby="referral-title"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            <h2 id="referral-title" className="font-bold text-sm sm:text-base text-gray-900">
              {t('referral.title', { defaultValue: 'Parrainez et gagnez' })}
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-600 mt-1 leading-snug">
            {t('referral.subtitle_v2', {
              defaultValue:
                'Gagnez {{pct_vente}}% sur la 1re commande ≥ {{min}} FCFA de chaque filleul + {{pct_troc}}% sur les commissions Yukpo de chacun de leurs trocs réussis.',
              pct_vente: data.bonus_percent_vente,
              pct_troc: data.bonus_percent_troc,
              min: data.bonus_seuil_min_xaf.toLocaleString('fr-FR'),
            })}
          </p>
        </div>
      </div>

      {/* ✅ 2026-05-16 — Suppression de l'affichage du code en gros. Le code
          est déjà intégré dans le share_url, l'utilisateur n'a pas besoin de
          le voir séparément : il partage le LIEN, l'app fait le reste.
          Garde : lien à partager + QR code (pour scan in-person). */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">
            {t('referral.share_link', { defaultValue: 'Votre lien à partager' })}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={data.share_url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 min-w-0 text-[11px] sm:text-xs font-mono bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <button
              onClick={copyLink}
              className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              aria-label={t('referral.copy_link', { defaultValue: 'Copier le lien' })}
              title={t('referral.copy_link', { defaultValue: 'Copier le lien' })}
            >
              {copiedLink ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={share}
              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              aria-label={t('referral.share', { defaultValue: 'Partager' })}
              title={t('referral.share', { defaultValue: 'Partager' })}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5 italic">
            {t('referral.share_hint', {
              defaultValue:
                'Cliquez Partager pour envoyer via WhatsApp, SMS, ou copier le lien.',
            })}
          </p>
        </div>

        {/* QR pour scan en face-à-face (in-person sharing) */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <QRCodeSVG value={data.share_url} size={88} level="M" />
          </div>
          <p className="text-[9px] text-gray-500 mt-1">
            {t('referral.scan_hint', { defaultValue: 'Scanner sur place' })}
          </p>
        </div>
      </div>

      {/* Stats — 2 lignes :
          1) Indicateurs d'activité (clics, inscrits, commandes, trocs effectifs)
          2) Gains détaillés (ventes, troc, total) — TOTAL en vert highlight */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 pt-4 border-t border-indigo-100">
        <StatTile
          label={t('referral.stats.clicks', { defaultValue: 'Clics' })}
          value={data.total_clicks.toLocaleString('fr-FR')}
        />
        <StatTile
          label={t('referral.stats.signups', { defaultValue: 'Inscrits' })}
          value={data.total_signups.toLocaleString('fr-FR')}
          icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
        />
        <StatTile
          label={t('referral.stats.conversions', { defaultValue: 'Commandes' })}
          value={data.total_conversions.toLocaleString('fr-FR')}
        />
        <StatTile
          label={t('referral.stats.trocs', { defaultValue: 'Trocs réussis' })}
          value={data.total_trocs_filleuls.toLocaleString('fr-FR')}
          icon={<ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-2 sm:mt-3">
        <StatTile
          label={t('referral.stats.bonus_vente', { defaultValue: 'Gains ventes' })}
          value={`${data.total_bonus_xaf.toLocaleString('fr-FR')} XAF`}
        />
        <StatTile
          label={t('referral.stats.bonus_troc', { defaultValue: 'Gains troc' })}
          value={`${data.total_troc_commission_xaf.toLocaleString('fr-FR')} XAF`}
        />
        <StatTile
          label={t('referral.stats.total_gains', { defaultValue: 'Total gagné' })}
          value={`${data.total_gains_xaf.toLocaleString('fr-FR')} XAF`}
          highlight
        />
      </div>
    </section>
  );
};

const StatTile: React.FC<{ label: string; value: string; icon?: React.ReactNode; highlight?: boolean }> = ({
  label,
  value,
  icon,
  highlight,
}) => (
  <div
    className={`rounded-lg px-2 py-2 text-center ${
      highlight ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-200'
    }`}
  >
    <div className="flex items-center justify-center gap-1 mb-0.5">
      {icon}
      <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">{label}</p>
    </div>
    <p
      className={`text-sm sm:text-base font-bold tabular-nums leading-none ${
        highlight ? 'text-emerald-700' : 'text-gray-900'
      }`}
    >
      {value}
    </p>
  </div>
);

export default ReferralCard;
