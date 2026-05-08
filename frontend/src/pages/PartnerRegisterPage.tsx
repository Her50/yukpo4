// ✅ AMÉLIORATION UX: Écran de création partenaire modernisé avec design similaire à RegisterPage
import LocationSelector, { LocationObject } from '@/components/ui/LocationSelector';
import { API_BASE_URL } from '@/config/api';
import { useUser } from '@/hooks/useUser';
import { usePartnerContext } from '@/hooks/usePartnerContext';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import { AlertCircle, Building, CheckCircle, Mail as Envelope, Image as ImageIcon, Lock, KeyRound as LockKey, Phone, X, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

const PartnerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useUser();
  const { appPartnerType } = usePartnerContext(); // ✅ pré-sélection selon sous-domaine (pharmacie/restaurant)
  const [form, setForm] = useState({
    partner_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: (appPartnerType ?? '') as
      | 'pharmacie'
      | 'restaurant'
      | 'hopital'
      | 'laboratoire'
      | 'agence de voyage'
      | 'demenagement'
      | 'livraison'
      | 'livraison_courses_marche'
      | 'transport'
      | 'assureur'
      | 'supermarche'
      | 'telecom'
      | 'hotel'
      | 'meuble'
      | 'etablissementscolaire'
      | 'banquesang'
      | '',
    partner_phone: '',
    partner_address: null as LocationObject | null,
    partner_country: '',
    partner_logo: null as string | null, // ✅ NOUVEAU: Logo du partenaire (base64)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
  });
  const [confirmPasswordMatch, setConfirmPasswordMatch] = useState<boolean | null>(null);

  // ✅ TOUS les types partenaires valides selon le backend (auth_controller.rs ligne 236-256)
  const partnerTypes = [
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'banquesang', label: 'Banque de sang' },
    { value: 'etablissementscolaire', label: 'Établissement scolaire' },
    { value: 'agence de voyage', label: 'Agence de Voyage' },
    { value: 'demenagement', label: 'Déménagement' },
    { value: 'livraison', label: 'Livraison' },
    { value: 'livraison_courses_marche', label: 'Livraison - Courses au marché' },
    { value: 'transport', label: 'Transport' },
    { value: 'assureur', label: 'Assureur' },
    { value: 'supermarche', label: 'Supermarché' },
    { value: 'telecom', label: 'Télécom' },
    { value: 'hotel', label: 'Hôtel' },
    { value: 'meuble', label: 'Meublé / Location meublée' },
  ];

  // ✅ Validation du mot de passe avec feedback visuel en temps réel
  const validatePassword = (password: string) => {
    const errors = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
    };
    setPasswordErrors(errors);
    return errors.length && errors.uppercase && errors.number;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setForm({ ...form, password: text });
    if (text.length > 0) {
      validatePassword(text);
    } else {
      setPasswordErrors({ length: false, uppercase: false, number: false });
    }

    // ✅ Vérifier la correspondance avec le mot de passe de confirmation
    if (form.confirmPassword.length > 0) {
      setConfirmPasswordMatch(text === form.confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setForm({ ...form, confirmPassword: text });
    if (text.length > 0) {
      setConfirmPasswordMatch(text === form.password);
    } else {
      setConfirmPasswordMatch(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ✅ NOUVEAU: Fonction pour sélectionner et convertir le logo en base64
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Le logo ne doit pas dépasser 5MB');
        return;
      }

      // Vérifier le type
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner une image');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          setForm({ ...form, partner_logo: result });
        }
      };
      reader.onerror = () => {
        setError('Erreur lors de la lecture du fichier');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!form.partner_name || !form.email || !form.password || !form.confirmPassword) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // ✅ NOUVEAU: Validation stricte du type de partenaire
    if (!form.partner_type || form.partner_type.trim() === '') {
      setError('⚠️ Le type d\'établissement est obligatoire. Veuillez sélectionner un type de partenaire.');
      return;
    }

    if (!validatePassword(form.password)) {
      setError('Le mot de passe ne respecte pas tous les critères requis');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!form.partner_type) {
      setError('Veuillez sélectionner un type de partenaire');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.partner_name, // Nom du partenaire utilisé comme nom de compte
          prenom: '', // Pas nécessaire pour une structure morale
          name: form.partner_name,
          email: form.email,
          password: form.password,
          lang: 'fr',
          is_partner: true,
          partner_type: form.partner_type,
          partner_name: form.partner_name,
          partner_phone: form.partner_phone,
          partner_address: form.partner_address?.raw || form.partner_address?.place_name || '',
          partner_country: form.partner_country || form.partner_address?.components?.pays || '',
          partner_logo: form.partner_logo, // ✅ NOUVEAU: Logo du partenaire
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Inscription réussie ! Votre compte partenaire est en attente de validation.');
        navigate(ROUTES.LOGIN, {
          state: {
            message: 'Votre compte partenaire est en attente de validation. Vous recevrez un email une fois approuvé.',
          },
        });
      } else {
        const err = await res.json();

        // Détection des erreurs spécifiques
        let errorMessage = err.message || "Erreur d'inscription";

        if (err.message?.includes('409') || err.message?.includes('deja utilise') || err.message?.includes('already exists')) {
          errorMessage = '❌ Cet email est déjà utilisé. Essayez de vous connecter ou utilisez un autre email.';
        } else if (err.message?.includes('400') || err.message?.includes('validation')) {
          errorMessage = '❌ Données invalides. Vérifiez vos informations.';
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          errorMessage = '❌ Problème de connexion. Vérifiez votre internet.';
        }

        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err: any) {
      console.error('[PartnerRegisterPage] Erreur inscription:', err);
      const errorMessage = err.message?.includes('network') || err.message?.includes('fetch')
        ? '❌ Problème de connexion. Vérifiez votre internet.'
        : "Échec de la connexion au serveur.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-yellow-50 pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            Devenir partenaire{' '}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent">
              Yukpo
            </span>
          </h1>
          <p className="text-gray-600 text-lg">
            Créez votre compte partenaire. Votre compte sera validé par un administrateur.
          </p>
        </div>

        {/* Messages d'erreur */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 flex-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ✅ SECTION: Informations du partenaire */}
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Building className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-semibold text-gray-900">Informations de votre établissement</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6 italic">
              Détails de votre structure professionnelle
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'établissement <span className="text-red-500 font-bold">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Obligatoire)</span>
                </label>
                <select
                  name="partner_type"
                  value={form.partner_type}
                  onChange={handleChange}
                  className={`w-full p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${!form.partner_type ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : 'border-gray-300'
                    }`}
                  required
                  disabled={loading}
                >
                  <option value="">⚠️ Sélectionnez un type d'établissement...</option>
                  {partnerTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {!form.partner_type && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Ce champ est obligatoire. Vous devez sélectionner un type d'établissement pour créer un compte partenaire.</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="partner_name"
                    placeholder="Nom de l'établissement *"
                    value={form.partner_name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="partner_phone"
                    placeholder="Téléphone de l'établissement"
                    value={form.partner_phone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div className="md:col-span-2">
                  <LocationSelector
                    label="Adresse de l'établissement"
                    value={form.partner_address || ''}
                    onSelect={(location) => {
                      setForm({ ...form, partner_address: location });
                      if (location.components?.pays) {
                        setForm(prev => ({ ...prev, partner_country: location.components?.pays ?? '' }));
                      }
                    }}
                    placeholder="Rechercher l'adresse complète..."
                    scope="all"
                    required
                    className="w-full"
                  />
                </div>

                {/* ✅ NOUVEAU: Champ de téléchargement de logo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo de l'établissement
                  </label>
                  <div className="relative">
                    {form.partner_logo ? (
                      <div className="relative inline-block">
                        <img
                          src={form.partner_logo}
                          alt="Logo partenaire"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, partner_logo: null })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">
                          Cliquez pour télécharger un logo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Format recommandé: carré, max 5MB (JPG, PNG)
                  </p>
                </div>
              </div>

              {/* Informations de connexion du partenaire */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de connexion</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      placeholder="Adresse email du partenaire *"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* ✅ Amélioration : Validation du mot de passe avec feedback visuel en temps réel */}
                  <div className="relative md:col-span-2">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      placeholder="Mot de passe *"
                      value={form.password}
                      onChange={handlePasswordChange}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                      disabled={loading}
                    />
                    {form.password.length > 0 && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Critères du mot de passe :</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {passwordErrors.length ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs ${passwordErrors.length ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                              Au moins 8 caractères
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordErrors.uppercase ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs ${passwordErrors.uppercase ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                              Au moins 1 majuscule
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordErrors.number ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs ${passwordErrors.number ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                              Au moins 1 chiffre
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative md:col-span-2">
                    <LockKey className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirmer le mot de passe *"
                      value={form.confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${confirmPasswordMatch === false
                          ? 'border-red-300 bg-red-50'
                          : confirmPasswordMatch === true
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300'
                        }`}
                      required
                      disabled={loading}
                    />
                    {form.confirmPassword.length > 0 && confirmPasswordMatch === false && (
                      <div className="mt-2 flex items-center gap-2 text-red-600">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Les mots de passe ne correspondent pas</span>
                      </div>
                    )}
                    {form.confirmPassword.length > 0 && confirmPasswordMatch === true && (
                      <div className="mt-2 flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Les mots de passe correspondent</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading || !form.partner_type || form.partner_type.trim() === ''}
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Inscription en cours...
              </>
            ) : (!form.partner_type || form.partner_type.trim() === '') ? (
              "⚠️ Sélectionnez un type d'établissement"
            ) : (
              "S'inscrire comme partenaire"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Vous avez déjà un compte ?{' '}
            <Link to={ROUTES.LOGIN} className="text-orange-600 hover:text-orange-700 font-medium">
              Connectez-vous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default PartnerRegisterPage;
