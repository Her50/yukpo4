// ✅ Page d'acceptation d'une invitation d'équipe Yukpo Librairie
// Date : 2026-05-08
//
// URL : /team/accept?token=...
//
// Workflow :
//   1. Page chargée via lien WhatsApp partagé par le gérant
//   2. Si pas connecté → propose de se connecter ou créer un compte
//      avec retour automatique sur cette page après auth
//   3. Si connecté → bouton "Accepter l'invitation" → POST /api/team/invitation-accept
//   4. Sur succès → redirige vers /librairie

import { CheckCircle2, Clock, LogIn, UserCheck, UserPlus, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiPost } from '../../services/apiService';

interface InvitationPreview {
  success: boolean;
  source?: 'librairie' | 'etablissement';
  role?: string;
  librairie_nom?: string;
  etablissement_nom?: string;
  already_accepted?: boolean;
  expired?: boolean;
}

const TeamInvitationAcceptPage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const token = params.get('token') || '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    manager: t('librairie.invitation.role_manager'),
    preparer: t('librairie.invitation.role_preparer'),
    cashier: t('librairie.invitation.role_cashier'),
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/team/invitation-preview/${encodeURIComponent(token)}`);
        const d = await res.json().catch(() => ({}));
        setPreview(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await apiPost('/api/team/invitation-accept', { token });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || d?.error || `HTTP ${res.status}`);
      toast({ title: t('librairie.invitation.accepted_title'), description: d.message });
      // Redirige vers le bon dashboard selon la source de l'invitation.
      if (d.source === 'etablissement' && d.etablissement_id) {
        navigate(`/etablissement-portal/${d.etablissement_id}`);
      } else {
        navigate('/librairie');
      }
    } catch (e: any) {
      toast({
        title: t('librairie.error'),
        description: e?.message || t('librairie.invitation.accept_error'),
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const goLogin = () => {
    const redirect = `/team/accept?token=${encodeURIComponent(token)}`;
    navigate(`/login?source=shared_service&redirect=${encodeURIComponent(redirect)}`);
  };

  const goRegister = () => {
    const redirect = `/team/accept?token=${encodeURIComponent(token)}`;
    navigate(`/register?source=shared_service&redirect=${encodeURIComponent(redirect)}`);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50">
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!token || !preview?.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 p-6 text-center">
        <XCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">{t('librairie.invitation.invalid')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('librairie.invitation.invalid_help')}</p>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          {t('librairie.invitation.back_home')}
        </button>
      </div>
    );
  }

  if (preview.expired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 p-6 text-center">
        <Clock className="w-16 h-16 text-orange-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">{t('librairie.invitation.expired')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('librairie.invitation.expired_help')}</p>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          {t('librairie.invitation.back_home')}
        </button>
      </div>
    );
  }

  if (preview.already_accepted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">{t('librairie.invitation.already_accepted')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('librairie.invitation.already_help')}</p>
        <button onClick={() => navigate('/librairie')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          {t('librairie.invitation.go_to_workspace')}
        </button>
      </div>
    );
  }

  const teamName = preview.etablissement_nom
    || preview.librairie_nom
    || t('librairie.invitation.invited_team');
  // Pour les rôles établissement (manager/editor/viewer) on prend les libellés
  // dédiés ; pour les rôles librairie (manager/preparer/cashier) on garde
  // le mapping existant. Fallback : le rôle brut.
  const ETAB_ROLE_LABELS: Record<string, string> = {
    manager: 'Gestionnaire',
    editor: 'Éditeur de contenu',
    viewer: 'Consultation',
  };
  const roleLabel = preview.source === 'etablissement'
    ? (ETAB_ROLE_LABELS[preview.role || ''] || preview.role || '')
    : (ROLE_LABELS[preview.role || ''] || preview.role || '');

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-5 flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4">
        <LanguageSwitcherBourse />
      </div>
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-100 flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-indigo-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1.5">
          {t('librairie.invitation.title')}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          <Trans
            i18nKey="librairie.invitation.invited_as"
            values={{ name: teamName, role: roleLabel }}
            components={{ b: <b className="text-indigo-700" /> }}
          />
        </p>

        {!user ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('librairie.invitation.login_help')}</p>
            <button
              onClick={goRegister}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t('librairie.invitation.create_account')}
            </button>
            <button
              onClick={goLogin}
              className="w-full bg-white border-2 border-indigo-200 text-indigo-700 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t('librairie.invitation.existing_account')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {accepting ? t('librairie.invitation.validating') : t('librairie.invitation.accept')}
          </button>
        )}
      </div>
    </div>
  );
};

export default TeamInvitationAcceptPage;
