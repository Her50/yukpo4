import OAuthButton from "@/components/auth/OAuthButton";
import { API_BASE_URL } from "@/config/api";
import { useUser } from "@/hooks/useUser";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useNavigation, useSearchParams } from "@react-navigation/native";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigation();
  const [searchParams] = useSearchParams();
  const { login } = useUser();
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Gestion de la redirection après connexion
  const redirectUrl = searchParams.get('redirect');
  const source = searchParams.get('source');
  const isSharedService = source === 'shared_service';

  useEffect(() => {
    if (location.state?.loggedOut) {
      setShowLogoutMessage(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.fromRegistration) {
      if (location.state.email) {
        setEmail(location.state.email);
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 100);
      }
      if (location.state.message) {
        toast.success(location.state.message);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    console.log('[LoginPage] Tentative de connexion pour:', email);

    try {
      const loginData = { email, password };
      console.log('[LoginPage] Donnes de connexion:', { email, password: '***' });

      // CORRECTION: Utiliser l'API_BASE_URL au lieu d'une URL relative
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      console.log('[LoginPage] Rponse du serveur:', res.status, res.statusText);

      if (res.ok) {
        const data = await res.json();
        console.log('[LoginPage] Donnes reues:', { token: !!data.token, tokens_balance: data.tokens_balance });

        if (data.token) {
          console.log('[LoginPage] Token reu, connexion...');

          if (data.tokens_balance !== undefined) {
            localStorage.setItem('tokens_balance', data.tokens_balance.toString());
            window.dispatchEvent(new CustomEvent('tokens_updated'));
            console.log('[LoginPage] Solde initial sauvegard:', data.tokens_balance);
          }

          login(data.token);
          
          // Redirection intelligente selon la source
          if (isSharedService && redirectUrl) {
            // Rediriger vers le service partagé
            toast.success('Connexion réussie ! Redirection vers le service...');
            navigation.navigate(decodeURIComponent(redirectUrl));
          } else {
            // Redirection normale vers l'accueil
            navigation.navigate(ROUTES.HOME);
          }
          window.location.reload();
        } else {
          console.error('[LoginPage] Pas de token dans la rponse');
          setError('Rponse inattendue du serveur: pas de token.');
        }
      } else {
        const errorText = await res.text();
        console.error('[LoginPage] Erreur serveur:', res.status, errorText);

        let errorMessage = 'Erreur de connexion';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${errorText}`;
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error('[LoginPage] Erreur rseau:', err);
      setError('Erreur rseau ou serveur inaccessible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style="min-h-screen pt-28 bg-gradient-to-br from-yellow-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <View style="max-w-md mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8">
        {showLogoutMessage && (
          <View style="mb-4 bg-green-100 text-green-800 px-4 py-2 rounded shadow text-center">
            ? Vous tes bien dconnect.
          </View>
        )}
        {error && (
          <View style="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow text-center">
            ? {error}
          </View>
        )}
        <h1 style="text-3xl font-bold text-center mb-4">
          Connexion {" "}
          <Text style="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </Text>
        </h1>
        <p style="text-center text-gray-600 dark:text-gray-300 mb-6">
          Connectez-vous avec votre compte <strong>Google</strong> ou <strong>Facebook</strong>
        </Text>
        <View style="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
        </View>
        <p style="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          ou utilisez vos identifiants :
        </Text>
        <form style="flex flex-col gap-4 mt-2" onSubmit={handleLogin}>
          <TextInput
            type="email"
            placeholder="Adresse email"
            style="p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            disabled={loading}
          />
          <TextInput
            type="password"
            placeholder="Mot de passe"
            style="p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            ref={passwordInputRef}
          />
          <TouchableOpacity
            type="submit"
            style="bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition font-semibold disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </TouchableOpacity>
        </form>

        <p style="text-center text-sm mt-6 text-gray-700 dark:text-gray-300">
          Pas encore inscrit ?{" "}
          <Link to={ROUTES.REGISTER} style="text-primary underline font-medium">
            Crer un compte
          </Link>
        </Text>
      </View>
    </main>
  );
};

export default LoginPage;

