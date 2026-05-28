// =============================================================================
// LoginPhonePage — connexion parent par téléphone + PIN 4 chiffres
// =============================================================================
// 2026-05-28 — Cible : parent qui a déjà créé son compte.
// Pas d'OAuth, pas d'email, pas de mot de passe complexe.
// Rate-limit & lockout gérés côté serveur (5 essais / 15 min).
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { loginPhone, normalizePhone } from '@/services/authPhoneService';
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

  const pinRef = useRef<HTMLInputElement>(null);

  // Si on arrive avec un phone prérempli, focus direct le PIN.
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
      </div>
    </main>
  );
};

export default LoginPhonePage;
