// Page profil utilisateur — utilisée par les apps standalone (pharmacie/restaurant).
// Affiche l'utilisateur courant, le statut partenaire, et propose login/register/logout.
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, LogOut, Briefcase, ShieldCheck, ArrowRight, Globe, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/hooks/useUser';
import { usePartnerContext } from '@/hooks/usePartnerContext';
import LangSwitcher from '@/components/ui/LanguageSwitcher';
import CreditBalance from '@/components/CreditBalance';

const ComptePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, isPartner, partnerType } = useAuth();
  const { logout } = useUser();
  const { appPartnerType, appName, accentColor } = usePartnerContext();

  const accentBtn =
    accentColor === 'red' ? 'bg-red-600 hover:bg-red-700' :
    accentColor === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' :
    'bg-blue-600 hover:bg-blue-700';

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto p-6 pt-12">
        {/* Sélecteur de langue accessible même non-connecté */}
        <div className="flex justify-end mb-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Globe size={14} />
            <LangSwitcher />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">{t('compte.title')}</h1>
        <p className="text-center text-gray-500 mb-8">{t('compte.welcome', { appName })}</p>

        <div className="space-y-3">
          <Link
            to="/login"
            className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg text-white font-semibold ${accentBtn}`}
          >
            <LogIn size={18} /> {t('compte.login')}
          </Link>
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold text-gray-800"
          >
            <UserPlus size={18} /> {t('compte.registerClient')}
          </Link>

          {appPartnerType && (
            <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={20} className="text-blue-700" />
                <h3 className="font-semibold text-blue-900">
                  {appPartnerType === 'pharmacie' ? t('compte.partnerCtaTitlePharmacien') : t('compte.partnerCtaTitleRestaurateur')}
                </h3>
              </div>
              <p className="text-sm text-blue-800 mb-3">
                {t('compte.partnerCtaText')}
              </p>
              <Link
                to="/partenaire/inscription"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                {t('compte.partnerCtaLink')} <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const partnerHere = isPartner && (!appPartnerType || partnerType === appPartnerType);

  return (
    <div className="max-w-md mx-auto p-6 pt-12">
      {/* Sélecteur de langue */}
      <div className="flex justify-end mb-3">
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Globe size={14} />
          <LangSwitcher />
        </div>
      </div>
      <div className="flex flex-col items-center mb-6">
        {user?.photo ? (
          <img src={user.photo} alt="" className="w-20 h-20 rounded-full object-cover mb-3" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-500 mb-3">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <h2 className="font-bold text-xl">{user?.name || t('compte.user')}</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>

        {isPartner && (
          <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            <ShieldCheck size={12} /> {t('compte.partnerBadge', { type: partnerType ?? '' })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {partnerHere && (
          <Link
            to="/dashboard"
            className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg text-white font-semibold ${accentBtn}`}
          >
            <Briefcase size={18} /> {t('compte.myPartnerSpace')}
          </Link>
        )}

        {!isPartner && appPartnerType && (
          <Link
            to="/partenaire/inscription"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100"
          >
            <Briefcase size={18} /> {t('compte.becomePartnerLong', { type: appPartnerType })}
          </Link>
        )}

        <button
          onClick={() => { logout(); navigate('/'); }}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
        >
          <LogOut size={18} /> {t('compte.logout')}
        </button>
      </div>

      <div className="mt-8 space-y-2">
        <CreditBalance variant="card" />
        <Link
          to="/wallet"
          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <Wallet size={16} className="text-indigo-600" />
            {t('wallet.title')}
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
};

export default ComptePage;
