// ✅ 2026-05-15 — Page dédiée /parrainage partageable.
//
// 2 modes :
//   1. Visiteur (non connecté) qui arrive avec ?ref=XXX
//      → message "Vous avez été invité !" + CTA inscription
//      Le code reste capturé dans localStorage (via captureRefFromUrl déjà
//      appelé dans main-bourse.tsx au boot).
//
//   2. Utilisateur connecté
//      → Affiche la ReferralCard (code + QR + stats + bouton partager)
//      → Lien de partage généré pointe vers cette même page (/parrainage?ref=XXX)
//        pour que le filleul voit le contexte au lieu d'atterrir sur le home.

import { ArrowRight, Gift, Sparkles, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ReferralCard from '../../components/referral/ReferralCard';
import MesFilleulsSection from '../../components/referral/MesFilleulsSection';
import WalletPayoutSection from '../../components/wallet/WalletPayoutSection';
import { getStoredRefCode } from '../../utils/referralStorage';

const ReferralPage: React.FC = () => {
  const { t } = useTranslation();
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [pendingRefCode, setPendingRefCode] = useState<string | null>(null);

  useEffect(() => {
    setIsAuthed(!!localStorage.getItem('token'));
    setPendingRefCode(getStoredRefCode());
  }, []);

  // ─── MODE VISITEUR (non connecté + code capturé) ──────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-amber-50 to-orange-50 pb-20">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border-2 border-indigo-200">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-block bg-gradient-to-br from-indigo-500 to-amber-500 p-4 rounded-full shadow-lg mb-3">
                <Gift className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {pendingRefCode
                  ? t('referral.invited.title', {
                      defaultValue: 'Vous avez été invité sur Yukpo !',
                    })
                  : t('referral.guest.title', {
                      defaultValue: 'Programme de parrainage Yukpo',
                    })}
              </h1>
              {pendingRefCode && (
                <p className="text-sm text-gray-600 mt-2">
                  {t('referral.invited.code_label', { defaultValue: 'Code d’invitation :' })}{' '}
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                    {pendingRefCode}
                  </span>
                </p>
              )}
            </div>

            {/* Comment ça marche */}
            <div className="space-y-3 mb-6">
              <Step
                num={1}
                title={t('referral.guest.step1_title', { defaultValue: 'Créez votre compte' })}
                body={t('referral.guest.step1_body', {
                  defaultValue:
                    'Inscription gratuite en moins d\'une minute. Votre parrain sera automatiquement associé.',
                })}
              />
              <Step
                num={2}
                title={t('referral.guest.step2_title', {
                  defaultValue: 'Faites votre première commande',
                })}
                body={t('referral.guest.step2_body', {
                  defaultValue:
                    'Achetez vos livres scolaires, cahiers et accessoires sur la Bourse du Livre Yukpo.',
                })}
              />
              <Step
                num={3}
                title={t('referral.guest.step3_title', {
                  defaultValue: 'Vous parrainez à votre tour',
                })}
                body={t('referral.guest.step3_body', {
                  defaultValue:
                    'Une fois inscrit, vous obtenez votre propre lien de parrainage. Partagez-le autour de vous et accumulez des gains à vie sur les commandes et les trocs de vos filleuls.',
                })}
              />
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/register-phone"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors"
              >
                {t('referral.guest.cta_register', { defaultValue: 'Créer mon compte' })}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login-phone"
                className="flex-1 inline-flex items-center justify-center bg-white border-2 border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                {t('referral.guest.cta_login', { defaultValue: 'J’ai déjà un compte' })}
              </Link>
            </div>

            <p className="text-[11px] text-gray-500 text-center mt-4 italic">
              {t('referral.guest.disclaimer', {
                defaultValue:
                  'Programme sans engagement. Bonus crédité une seule fois par filleul, après une première commande validée ≥ 10 000 FCFA.',
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODE UTILISATEUR CONNECTÉ ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('referral.page.title', { defaultValue: 'Mon parrainage' })}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600">
            {t('referral.page.subtitle', {
              defaultValue:
                'Partagez votre lien : vous touchez 5 % de chaque commande de vos filleuls (à partir de 10 000 FCFA) + 25 % de leurs commissions troc — à vie.',
            })}
          </p>
        </div>

        {/* Carte parrainage (code + QR + stats + share) */}
        <ReferralCard />

        {/* V2.4 — Historique par filleul */}
        <MesFilleulsSection />

        {/* Section retrait cash (auto-masquée si solde insuffisant) */}
        <WalletPayoutSection />

        {/* Conseil viral */}
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <Users className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm text-emerald-900">
              {t('referral.page.tip_title', { defaultValue: 'Conseil pour parrainer vite' })}
            </h3>
            <p className="text-xs sm:text-sm text-emerald-800 mt-1 leading-relaxed">
              {t('referral.page.tip_body', {
                defaultValue:
                  'Partagez votre lien dans vos groupes WhatsApp de parents d’élèves ou d’associations scolaires. Plus efficace en début d’année scolaire et avant les rentrées.',
              })}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

const Step: React.FC<{ num: number; title: string; body: string }> = ({ num, title, body }) => (
  <div className="flex gap-3 items-start">
    <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
      {num}
    </div>
    <div className="min-w-0">
      <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
      <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{body}</p>
    </div>
  </div>
);

export default ReferralPage;
