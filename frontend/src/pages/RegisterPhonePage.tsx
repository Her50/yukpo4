// =============================================================================
// RegisterPhonePage — inscription parent par téléphone + PIN 4 chiffres
// =============================================================================
// 2026-05-28 — Page d'entrée par défaut au 1er accès Bourse du Livre.
// Flux 2 étapes :
//   1. saisie téléphone → checkPhone() → si existe, redirect /login-phone
//   2. confirmation téléphone + nom + prénom + PIN + confirm PIN → registerPhone()
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  checkPhone,
  normalizePhone,
  registerPhone,
} from '@/services/authPhoneService';
import { useUser } from '@/hooks/useUser';
import { getStoredRefCode } from '@/utils/referralStorage';

type Step = 'phone' | 'details';

const PIN_LENGTH = 4;

const RegisterPhonePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUser();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [phoneConfirm, setPhoneConfirm] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  // 2026-05-29 — Affichage en clair du PIN à l'inscription (default ON).
  // Une fois choisi, l'user le voit pour confirmer sans erreur. Reste un
  // PIN à 4 chiffres, donc l'enjeu de masquage est faible. Peut être
  // re-caché via le bouton œil.
  const [pinVisible, setPinVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prenomRef = useRef<HTMLInputElement>(null);
  const referral = searchParams.get('ref');

  // Au switch vers l'étape "details", on focus le prénom (humain avant tout).
  useEffect(() => {
    if (step === 'details') {
      setTimeout(() => prenomRef.current?.focus(), 100);
    }
  }, [step]);

  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      setError('Numéro de téléphone invalide.');
      return;
    }

    setLoading(true);
    try {
      const res = await checkPhone(normalized);
      if (res.exists) {
        toast.success('Ce numéro a déjà un compte. Connectez-vous.');
        navigate(`/login-phone?phone=${encodeURIComponent(normalized)}`);
        return;
      }
      // Nouveau numéro → pré-remplit le confirm et passe à l'étape suivante.
      setPhoneConfirm(normalized);
      setPhone(normalized);
      setStep('details');
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prenom.trim() || !nom.trim()) {
      setError('Prénom et nom obligatoires.');
      return;
    }
    if (normalizePhone(phoneConfirm) !== normalizePhone(phone)) {
      setError('Les deux numéros saisis ne correspondent pas.');
      return;
    }
    if (pin.length !== PIN_LENGTH || !/^\d{4}$/.test(pin)) {
      setError(`Le PIN doit comporter ${PIN_LENGTH} chiffres.`);
      return;
    }
    if (pin !== pinConfirm) {
      setError('Les deux PIN ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // 2026-07-01 — Fix propagation parrainage : on récupère le code capté
      // à l'ouverture de l'URL (?ref=XXX → localStorage via captureRefFromUrl)
      // ET on l'envoie au backend qui set users.referred_by + insère
      // dans la table referrals. Avant : code stocké mais jamais envoyé.
      const refCode = referral || getStoredRefCode() || undefined;
      const data = await registerPhone({
        phone,
        phone_confirm: phoneConfirm,
        pin,
        pin_confirm: pinConfirm,
        nom: nom.trim(),
        prenom: prenom.trim(),
        ref_code: refCode,
      });
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
        toast.success(`Bienvenue ${data.user?.nom_complet ?? prenom} !`);
        // Si arrivé via lien parrainage, on stocke pour bonus côté backend.
        if (referral) {
          try {
            localStorage.setItem('yukpo_referral_used', referral);
          } catch {
            /* noop */
          }
        }
        navigate('/');
      } else {
        setError('Réponse inattendue du serveur.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-12 pb-24 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4">
      <div className="max-w-md mx-auto bg-white shadow-xl rounded-2xl p-6 mt-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white text-2xl">
            📚
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Bienvenue sur la Bourse du Livre
        </h1>
        <p className="text-center text-sm text-gray-600 mt-1 mb-5">
          {step === 'phone'
            ? 'Créez votre compte en 30 secondes.'
            : 'Quelques infos et votre compte est prêt.'}
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleCheckPhone} className="flex flex-col gap-3">
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
              <span className="block text-[11px] text-gray-500 mt-1">
                Sert d'identifiant. Aucun SMS envoyé pour l'instant.
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Vérification…' : 'Continuer'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                Confirmez votre numéro
              </span>
              <input
                type="tel"
                inputMode="tel"
                className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                value={phoneConfirm}
                onChange={(e) => setPhoneConfirm(e.target.value)}
                autoComplete="tel"
                disabled={loading}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Prénom
                </span>
                <input
                  ref={prenomRef}
                  type="text"
                  className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  autoComplete="given-name"
                  disabled={loading}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Nom</span>
                <input
                  type="text"
                  className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoComplete="family-name"
                  disabled={loading}
                  required
                />
              </label>
            </div>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  Code PIN ({PIN_LENGTH} chiffres)
                </span>
                <button
                  type="button"
                  onClick={() => setPinVisible((v) => !v)}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-medium"
                >
                  {pinVisible ? '🙈 Masquer' : '👁️ Afficher'}
                </button>
              </div>
              <input
                type={pinVisible ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={PIN_LENGTH}
                className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none tracking-[0.5em] text-center text-lg"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))
                }
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                Confirmez le PIN
              </span>
              <input
                type={pinVisible ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={PIN_LENGTH}
                className="mt-1 w-full p-3 rounded-lg border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none tracking-[0.5em] text-center text-lg"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(
                    e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH),
                  )
                }
                autoComplete="new-password"
                disabled={loading}
                required
              />
              <span className="block text-[11px] text-gray-500 mt-1">
                Évitez 0000, 1234 ou un PIN trop simple.
              </span>
            </label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                disabled={loading}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg disabled:opacity-50"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link
            to="/login-phone"
            className="text-amber-600 font-medium underline"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
};

export default RegisterPhonePage;
