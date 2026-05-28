// =============================================================================
// LoginPhonePage — connexion parent par téléphone + PIN 4 chiffres
// =============================================================================
// 2026-05-28 — Cible : parent qui a déjà créé son compte.
// Pas d'OAuth, pas d'email, pas de mot de passe complexe.
// Rate-limit & lockout gérés côté serveur (5 essais / 15 min).
//
// Lien discret "Ce n'est pas mon compte ?" en bas : ouvre un modal de
// réclamation pour les cas où un fraudeur aurait squatté le numéro.
// Volontairement secondaire pour ne pas alourdir le flux de connexion.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  loginPhone,
  normalizePhone,
  reclaimPhone,
} from '@/services/authPhoneService';
import { useUser } from '@/hooks/useUser';

const PIN_LENGTH = 4;

const LoginPhonePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUser();

  const initialPhone = searchParams.get('phone') ?? '';
  const [phone, setPhone] = useState(initialPhone);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // État du modal de réclamation (squatting).
  const [showReclaim, setShowReclaim] = useState(false);
  const [reclaimContact, setReclaimContact] = useState('');
  const [reclaimReason, setReclaimReason] = useState('');
  const [reclaimLoading, setReclaimLoading] = useState(false);

  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPhone) {
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  }, [initialPhone]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      setError('Numéro de téléphone invalide.');
      return;
    }
    if (pin.length !== PIN_LENGTH || !/^\d{4}$/.test(pin)) {
      setError(`Le PIN doit comporter ${PIN_LENGTH} chiffres.`);
      return;
    }

    setLoading(true);
    try {
      const data = await loginPhone(normalized, pin);
      if (data?.token) {
        if (data.user?.tokens_balance !== undefined) {
          localStorage.setItem(
            'tokens_balance',
            String(data.user.tokens_balance),
          );
          window.dispatchEvent(new CustomEvent('tokens_updated'));
        }
        if (data.user?.phone) {
          localStorage.setItem('yukpo_user_phone', data.user.phone);
        }
        await login(data.token);
        toast.success(`Bonjour ${data.user?.nom_complet ?? ''} !`);
        navigate('/');
      } else {
        setError('Réponse inattendue du serveur.');
      }
    } catch (err: any) {
      setError(err?.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  const handleReclaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      toast.error("Saisissez d'abord le numéro concerné en haut.");
      return;
    }
    if (!reclaimContact.trim()) {
      toast.error('Indiquez un email ou un autre numéro pour vous joindre.');
      return;
    }
    setReclaimLoading(true);
    try {
      await reclaimPhone({
        phone: normalized,
        contact: reclaimContact.trim(),
        reason: reclaimReason.trim() || undefined,
      });
      toast.success(
        'Signalement enregistré. Un admin vous contactera sous 48 h.',
      );
      setShowReclaim(false);
      setReclaimContact('');
      setReclaimReason('');
    } catch (err: any) {
      toast.error(err?.message || "Impossible d'envoyer le signalement.");
    } finally {
      setReclaimLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-12 pb-24 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4">
      <div className="max-w-md mx-auto bg-white shadow-xl rounded-2xl p-6 mt-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white text-2xl">
            🔐
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Connexion
        </h1>
        <p className="text-center text-sm text-gray-600 mt-1 mb-5">
          Saisissez votre téléphone et votre PIN.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Numéro de téléphone
            </span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="ex. 677 12 34 56"
              className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={loading}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Code PIN ({PIN_LENGTH} chiffres)
            </span>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none tracking-[0.5em] text-center text-lg"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))
              }
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link
            to="/register-phone"
            className="text-amber-600 font-medium underline"
          >
            S'inscrire
          </Link>
        </div>

        {/* Lien volontairement discret — rare cas où l'user est sûr qu'il
            ne s'est jamais inscrit mais checkPhone dit que le numéro est pris. */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowReclaim(true)}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline"
          >
            Ce n'est pas votre compte ? Signaler
          </button>
        </div>
      </div>

      {/* Modal réclamation — visible uniquement si l'user clique le lien discret. */}
      {showReclaim && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center px-4"
          onClick={() => setShowReclaim(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              Signaler un numéro pris à tort
            </h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Si vous êtes certain de ne jamais avoir créé de compte avec ce
              numéro mais qu'il apparaît déjà utilisé, signalez-le. Un admin
              vérifiera votre demande sous 48 h.
            </p>

            <form onSubmit={handleReclaim} className="flex flex-col gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Numéro concerné
                </span>
                <input
                  type="tel"
                  className="mt-1 w-full p-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-700"
                  value={normalizePhone(phone) || '— saisir en haut —'}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Comment vous joindre ?
                </span>
                <input
                  type="text"
                  placeholder="email ou autre numéro"
                  className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  value={reclaimContact}
                  onChange={(e) => setReclaimContact(e.target.value)}
                  disabled={reclaimLoading}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Détails (optionnel)
                </span>
                <textarea
                  rows={3}
                  placeholder="Depuis quand utilisez-vous ce numéro, etc."
                  className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                  value={reclaimReason}
                  onChange={(e) => setReclaimReason(e.target.value)}
                  disabled={reclaimLoading}
                />
              </label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowReclaim(false)}
                  disabled={reclaimLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={reclaimLoading}
                  className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
                >
                  {reclaimLoading ? 'Envoi…' : 'Envoyer le signalement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default LoginPhonePage;
