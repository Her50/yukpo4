import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useNavigation, Link, useSearchParams } from "@react-navigation/native";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import OAuthButton from "@/components/auth/OAuthButton";
import { useUser } from '@/hooks/useUser';
import toast from 'react-hot-toast';

const RegisterPage: React.FC = () => {
  const navigate = useNavigation();
  const [searchParams] = useSearchParams();
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
  
  // Gestion de la redirection après inscription
  const redirectUrl = searchParams.get('redirect');
  const source = searchParams.get('source');
  const isSharedService = source === 'shared_service';

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
      const res = await fetch(`/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          name: form.nom || form.prenom || `${form.nom} ${form.prenom}`.trim(),
          email: form.email,
          password: form.password,
          lang: 'fr',
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Inscription réussie
        setRegistrationSuccess(true);
        toast.success('Compte créé avec succès ! 🎉');
        
        // Si un token est retourné, connecter automatiquement l'utilisateur
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('tokens_balance', data.tokens_balance.toString());
          window.dispatchEvent(new CustomEvent('tokens_updated'));
          login(data.token);
          
          // Redirection intelligente selon la source
          if (isSharedService && redirectUrl) {
            // Rediriger vers le service partagé
            toast.success('Compte créé ! Redirection vers le service...');
            navigation.navigate(decodeURIComponent(redirectUrl));
          } else {
            // Redirection normale vers l'accueil
            navigation.navigate(ROUTES.HOME);
          }
          window.location.reload();
        }
        
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
    navigation.navigate(ROUTES.LOGIN, { 
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
      <main style="min-h-screen bg-yellow-50 pt-24">
        <View style="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center">
          <View style="mb-6">
            <View style="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg style="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <Textath strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </View>
            <Text style="text-3xl font-bold mb-4 text-gray-900">
              Inscription réussie ! 🎉
            </Text>
            <Text style="text-gray-600 mb-6">
              Votre compte <Text style="font-semibold">{form.email}</Text> a été créé avec succès.
            </Text>
            <Text style="text-sm text-gray-500 mb-8">
              {isSharedService 
                ? "Vous allez être redirigé vers le service partagé dans quelques instants..."
                : "Vous pouvez maintenant vous connecter pour accéder à toutes les fonctionnalités de Yukpo."
              }
            </Text>
          </View>
          
          <View style="space-y-3">
            <TouchableOpacity
              onPress={goToLoginWithCredentials}
              style="block w-full bg-yellow-500 text-black py-3 px-6 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
            >
              Se connecter maintenant →
            </TouchableOpacity>
            <Link
              to={ROUTES.HOME}
              style="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Retour à l'accueil
            </Link>
          </View>
          
          <Text style="text-xs text-gray-500 mt-6">
            En cas de problème, contactez notre support à support@yukpo.com
          </Text>
        </View>
      </main>
    );
  }

  return (
    <main style="min-h-screen bg-yellow-50 pt-24">
      <View style="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto">
        <Text style="text-3xl font-bold mb-6 text-center text-gray-900">
          Créer un compte{" "}
          <Text style="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </Text>
        </Text>
        
        {isSharedService && (
          <View style="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <View style="flex items-center text-blue-800 mb-2">
              <svg style="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <Textath strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <Text style="font-medium">Service partagé</Text>
            </View>
            <Text style="text-blue-700 text-sm">
              Créez votre compte pour accéder au service complet. 
              Vous serez automatiquement redirigé vers le service après votre inscription.
            </Text>
          </View>
        )}
        <Text style="text-center text-gray-600 mb-4">
          Utilisez votre compte <strong>Google</strong> ou <strong>Facebook</strong> pour vous inscrire rapidement :
        </Text>
        <View style="flex justify-center gap-4 mb-6">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
        </View>
        <View style="relative mb-6">
          <View style="absolute inset-0 flex items-center">
            <View style="w-full border-t border-gray-300"></View>
          </View>
          <View style="relative flex justify-center text-sm">
            <Text style="px-2 bg-white text-gray-500">ou créez un compte manuellement</Text>
          </View>
        </View>
        <form onSubmit={handleSubmit} style="space-y-4">
          <TextInput
            type="text"
            name="nom"
            placeholder="Nom de famille"
            value={form.nom}
            onChange={handleChange}
            style="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <TextInput
            type="text"
            name="prenom"
            placeholder="Prénom"
            value={form.prenom}
            onChange={handleChange}
            style="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <TextInput
            type="email"
            name="email"
            placeholder="Adresse email"
            value={form.email}
            onChange={handleChange}
            style="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <TextInput
            type="password"
            name="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={handleChange}
            style="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <TextInput
            type="password"
            name="confirmPassword"
            placeholder="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChange={handleChange}
            style="w-full border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            required
            disabled={loading}
          />
          <Text style="text-xs text-gray-500 italic">
            Mot de passe requis : 8 caractères, 1 majuscule, 1 chiffre.
          </Text>
          {error && (
            <View style="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg text-center">
              {error}
            </View>
          )}
          <TouchableOpacity
            type="submit"
            style="w-full bg-yellow-500 text-black py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <Text style="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></Text>
                Création du compte...
              </>
            ) : (
              'Créer mon compte'
            )}
          </TouchableOpacity>
        </form>
        
        <View style="mt-6 text-center">
          <Text style="text-sm text-gray-600">
            Vous avez déjà un compte ?{' '}
            <Link to={ROUTES.LOGIN} style="text-yellow-600 hover:text-yellow-700 font-medium">
              Connectez-vous
            </Link>
          </Text>
        </View>
      </View>
    </main>
  );
};

export default RegisterPage;





