import OAuthButton from "@/components/auth/OAuthButton";
import { API_BASE_URL } from "@/config/api";
import { useUser } from "@/hooks/useUser";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUser();
  const { appPartnerType } = usePartnerContext();
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

          // Récupérer le profil pour cacher le numéro WhatsApp en local.
          // Permet à DeliveryModal (récap d'achat) de pré-remplir le champ
          // sans dépendre d'un claim JWT supplémentaire. Best-effort, non
          // bloquant — si /api/user/me échoue, l'utilisateur saisira son
          // numéro manuellement à la commande.
          try {
            const meRes = await fetch(`${API_BASE_URL}/api/user/me`, {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            if (meRes.ok) {
              const me = await meRes.json().catch(() => ({}));
              if (me?.phone) {
                localStorage.setItem('yukpo_user_phone', String(me.phone));
                if (me.phone_country) {
                  localStorage.setItem('yukpo_user_phone_country', String(me.phone_country));
                }
              }
            }
          } catch { /* non bloquant */ }

          // ✅ Redirection contextuelle (apps standalone partenaire)
          let target: string | null = null;
          if (isSharedService && redirectUrl) {
            target = decodeURIComponent(redirectUrl);
          } else if (redirectUrl) {
            target = decodeURIComponent(redirectUrl);
          } else if (appPartnerType) {
            // Sur app standalone (pharmacie/restaurant) : si l'utilisateur est partenaire du bon type → /dashboard
            try {
              const decoded: any = jwtDecode(data.token);
              const isPartnerHere =
                decoded?.role === 'partenaire' ||
                (decoded?.partner_type && decoded.partner_type === appPartnerType);
              target = isPartnerHere ? '/dashboard' : ROUTES.HOME;
            } catch {
              target = ROUTES.HOME;
            }
          } else {
            target = ROUTES.HOME;
          }

          toast.success('Connexion réussie !');
          navigate(target);
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
    <main className="min-h-screen pt-28 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8">
        {showLogoutMessage && (
          <div className="mb-4 bg-green-100 text-green-800 px-4 py-2 rounded shadow text-center">
            ? Vous tes bien dconnect.
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow text-center">
            ? {error}
          </div>
        )}
        <h1 className="text-3xl font-bold text-center mb-4">
          Connexion {" "}
          <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent">
            Yukpo
          </span>
        </h1>
        {/* OAuth Google/Facebook désactivés temporairement (non opérationnels) */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          Saisissez vos identifiants pour vous connecter :
        </p>
        <form className="flex flex-col gap-4 mt-2" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Adresse email"
            className="p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            className="p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            ref={passwordInputRef}
          />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition font-semibold disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm mt-6 text-gray-700 dark:text-gray-300">
          Pas encore inscrit ?{" "}
          <Link to={ROUTES.REGISTER} className="text-primary underline font-medium">
            Crer un compte
          </Link>
        </p>

        {/* ✅ NOUVEAU: Bouton Devenir partenaire */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/register/partner"
            className="block w-full text-center py-2 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition font-medium"
          >
            🏢 Devenir partenaire
          </Link>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
