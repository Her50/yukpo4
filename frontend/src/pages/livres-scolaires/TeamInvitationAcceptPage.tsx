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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiPost } from '../../services/apiService';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gestionnaire',
  preparer: 'Préparateur',
  cashier: 'Caisse',
};

interface InvitationPreview {
  success: boolean;
  role?: string;
  librairie_nom?: string;
  already_accepted?: boolean;
  expired?: boolean;
}

const TeamInvitationAcceptPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const token = params.get('token') || '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

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
      toast({ title: 'Invitation acceptée !', description: d.message });
      navigate('/librairie');
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Impossible d\'accepter l\'invitation',
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
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (!token || !preview?.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 p-6 text-center">
        <XCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Invitation invalide</h1>
        <p className="text-sm text-gray-500 mb-6">Le lien d'invitation est invalide ou introuvable.</p>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (preview.expired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 p-6 text-center">
        <Clock className="w-16 h-16 text-orange-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Invitation expirée</h1>
        <p className="text-sm text-gray-500 mb-6">Cette invitation a dépassé sa date de validité. Demandez un nouveau lien au gérant.</p>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (preview.already_accepted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Invitation déjà acceptée</h1>
        <p className="text-sm text-gray-500 mb-6">Vous avez déjà rejoint cette équipe.</p>
        <button onClick={() => navigate('/librairie')} className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold">
          Aller à mon espace librairie
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-5 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-100 flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-indigo-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1.5">
          Invitation Yukpo Librairie
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          Vous êtes invité(e) à rejoindre <b>{preview.librairie_nom || 'l\'équipe'}</b>
          {' '}en tant que <b className="text-indigo-700">{ROLE_LABELS[preview.role || ''] || preview.role}</b>.
        </p>

        {!user ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Pour accepter, créez votre compte ou connectez-vous :</p>
            <button
              onClick={goRegister}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Créer mon compte Yukpo
            </button>
            <button
              onClick={goLogin}
              className="w-full bg-white border-2 border-indigo-200 text-indigo-700 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              J'ai déjà un compte
            </button>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {accepting ? 'Validation…' : 'Accepter l\'invitation'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TeamInvitationAcceptPage;
