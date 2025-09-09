import React, { useState } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useNavigate, Link } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import OAuthButton from "@/components/auth/OAuthButton";
import { useUser } from '@/hooks/useUser';
import { toast } from 'react-hot-toast';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useUser();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError("Mot de passe trop faible : 8 caractères, 1 majuscule, 1 chiffre minimum.");
      setLoading(false);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          password: form.password,
          lang: 'fr',
        }),
      });
      
      if (res.ok) {
        // Inscription réussie
        setRegistrationSuccess(true);
        toast.success('Compte créé avec succès ! 🎉');
        
        // PAS DE REDIRECTION AUTOMATIQUE - l'utilisateur reste sur la page de succès
        
      } else {
        const err = await res.json();
        setError(err.message || "Erreur d'inscription");
        toast.error(err.message || "Erreur d'inscription");
      }
    } catch (err) {
      setError("Échec de la connexion au serveur.");
      toast.error("Échec de la connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour naviguer vers la page de connexion avec les données pré-remplies
  const goToLoginWithCredentials = () => {
    navigate(ROUTES.LOGIN, { 
      state: { 
        fromRegistration: true, 
        email: form.email,
        message: 'Veuillez vous connecter avec vos identifiants.'
      } 
    });
  };

  // Affichage du message de succès après inscription
  if (registrationSuccess) {
    return (
      <main className="min-h-screen bg-yellow-50 pt-24">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4 text-gray-900">
              Inscription réussie ! 🎉
            </h1>
            <p className="text-gray-600 mb-6">
              Votre compte <span className="font-semibold">{form.email}</span> a été créé avec succès.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Vous pouvez maintenant vous connecter pour accéder à toutes les fonctionnalités de Yukpo.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={goToLoginWithCredentials}
              className="block w-full bg-yellow-500 text-black py-3 px-6 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
            >
              Se connecter maintenant →
            </button>
            <Link
              to={ROUTES.HOME}
              className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Retour à l'accueil
            </Link>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            En cas de problème, contactez notre support à support@yukpo.com
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-yellow-50 pt-24">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Créer un compte{" "}
          <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </span>
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Utilisez votre compte <strong>Google</strong> ou <strong>Facebook</strong> pour vous inscrire rapidement :
        </p>
        <div className="flex justify-center gap-4 mb-6">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
        </div>
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">ou créez un compte manuellement</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="nom"
            placeholder="Nom de famille"
            value={form.nom}
            onChange={handleChange}
            className="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <input
            type="text"
            name="prenom"
            placeholder="Prénom"
            value={form.prenom}
            onChange={handleChange}
            className="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <input
            type="email"
            name="email"
            placeholder="Adresse email"
            value={form.email}
            onChange={handleChange}
            className="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <input
            type="password"
            name="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={handleChange}
            className="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 italic">
            Mot de passe requis : 8 caractères, 1 majuscule, 1 chiffre.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-yellow-500 text-black py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></span>
                Création du compte...
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Vous avez déjà un compte ?{' '}
            <Link to={ROUTES.LOGIN} className="text-yellow-600 hover:text-yellow-700 font-medium">
              Connectez-vous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default RegisterPage;