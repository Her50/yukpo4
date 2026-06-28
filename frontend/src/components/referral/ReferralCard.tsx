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

import { Check, Copy, Loader2, Share2, Sparkles, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { apiGet } from '../../services/apiService';

interface ReferralData {
  code: string;
  share_url: string;
  // 2026-06-08 — Modèle pourcentage (remplace l'ancien bonus_amount_xaf=500
  // fixe). Cf. backend referral_controller::MyReferralResponse.
  bonus_percent_vente: number;
  bonus_percent_troc: number;
  bonus_seuil_min_xaf: number;
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  total_bonus_xaf: number;
  // 2026-06-08 — Détail commissions troc + vente d'occasion (filleuls).
  total_trocs_filleuls: number;
  total_troc_commission_xaf: number;
  total_seller_commission_xaf: number;
  // 2026-06-24 — Cycle 4 phases : Espérée → Initiée → Effective → RolledBack.
  // Espérée : scan/listing — potentiel terrain, pas créditée.
  // Initiée : troc/vente validé — créditée mais bloquée (released_at IS NULL).
  // Effective : livraison confirmée — retirable en cash via Mobile Money.
  commission_esperee_xaf: number;
  total_initiee_xaf: number;
  total_effective_xaf: number;
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
            {t('referral.subtitle', {
              defaultValue:
                'Touchez {{pctVente}} % sur chaque commande de vos filleuls (≥ {{min}} FCFA) + {{pctTroc}} % sur leurs commissions troc — à vie.',
              pctVente: data.bonus_percent_vente,
              pctTroc: data.bonus_percent_troc,
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

      {/* 2026-06-28 — Cycle 4 phases : Espérée → Initiée → Effective.
          Vue financière qui MOTIVE le parrain en montrant ce que son réseau
          peut rapporter (espérée), ce qu'il a déjà gagné (initiée) et ce
          qu'il peut retirer maintenant (effective). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-indigo-100">
        <PhaseTile
          tone="amber"
          phase={t('referral.phases.esperee', { defaultValue: 'Potentiel terrain' })}
          value={data.commission_esperee_xaf}
          hint={t('referral.phases.esperee_hint', {
            defaultValue:
              'Si tous les livres scannés par tes filleuls trouvent preneur — incitation à pousser le terrain.',
          })}
        />
        <PhaseTile
          tone="indigo"
          phase={t('referral.phases.initiee', { defaultValue: 'En cours de validation' })}
          value={data.total_initiee_xaf}
          hint={t('referral.phases.initiee_hint', {
            defaultValue:
              'Commission gagnée — débloquée dès que le coursier confirme la livraison.',
          })}
        />
        <PhaseTile
          tone="emerald"
          phase={t('referral.phases.effective', { defaultValue: 'Retirable en cash' })}
          value={data.total_effective_xaf}
          hint={t('referral.phases.effective_hint', {
            defaultValue:
              'Disponible pour retrait Mobile Money (Orange Money / MTN MoMo / Wave).',
          })}
        />
      </div>

      {/* Stats secondaires — activité réseau */}
      <div className="grid grid-cols-4 gap-2 mt-3">
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
          label={t('referral.stats.trocs', { defaultValue: 'Trocs' })}
          value={data.total_trocs_filleuls.toLocaleString('fr-FR')}
        />
      </div>

      {/* Détail bonus / troc / vente — pour transparence */}
      {(data.total_bonus_xaf > 0 ||
        data.total_troc_commission_xaf > 0 ||
        data.total_seller_commission_xaf > 0) && (
        <div className="mt-3 text-[10px] sm:text-[11px] text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-700">Détail des gains : </span>
          Bonus ventes {data.total_bonus_xaf.toLocaleString('fr-FR')} XAF ·{' '}
          Commission troc {data.total_troc_commission_xaf.toLocaleString('fr-FR')} XAF ·{' '}
          Commission vente {data.total_seller_commission_xaf.toLocaleString('fr-FR')} XAF
        </div>
      )}
    </section>
  );
};

interface PhaseTileProps {
  tone: 'amber' | 'indigo' | 'emerald';
  phase: string;
  value: number;
  hint: string;
}

const PhaseTile: React.FC<PhaseTileProps> = ({ tone, phase, value, hint }) => {
  const toneClasses = {
    amber: 'bg-amber-50 border-amber-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    emerald: 'bg-emerald-50 border-emerald-200',
  }[tone];
  const labelTone = {
    amber: 'text-amber-700',
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClasses}`}>
      <div className={`text-[10px] sm:text-[11px] uppercase font-bold tracking-wider ${labelTone}`}>
        {phase}
      </div>
      <div className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">
        {value.toLocaleString('fr-FR')} <span className="text-xs font-medium text-gray-500">XAF</span>
      </div>
      <div className="text-[10px] text-gray-600 mt-1 leading-snug">{hint}</div>
    </div>
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
