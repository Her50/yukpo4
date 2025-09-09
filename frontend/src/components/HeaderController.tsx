import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import MobileMenu from "@/components/MobileMenu";
import LangSwitcher from "@/components/LangSwitcher";
import { useUser } from "@/hooks/useUser";
import { useUserPlan } from "@/hooks/useUserPlan";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const HeaderController: React.FC = () => {
  const { user, logout } = useUser();
  const [theme, setTheme] = useState("light");
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const [tokensBalance, setTokensBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [hasFetchedBalance, setHasFetchedBalance] = useState(false);

  // Debug logs
  useEffect(() => {
    console.log('[HeaderController] user from useUser:', user);
    console.log('[HeaderController] user.credits:', user?.credits);
    
    // Réinitialiser hasFetchedBalance quand l'utilisateur change
    if (user?.id) {
      setHasFetchedBalance(false);
    }
    
    // Essayer de charger le solde depuis localStorage au démarrage
    const storedBalance = localStorage.getItem('tokens_balance');
    if (storedBalance) {
      const balance = parseInt(storedBalance, 10);
      if (!isNaN(balance)) {
        console.log('[HeaderController] Solde initial depuis localStorage:', balance);
        setTokensBalance(balance);
      }
    }
  }, [user?.id]);

  // Récupérer le solde depuis l'API
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.id) {
        setTokensBalance(null);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      // Éviter les appels multiples simultanés
      if (balanceLoading) return;

      setBalanceLoading(true);
      try {
        const response = await fetch('/api/users/balance', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[HeaderController] Solde récupéré:', data.tokens_balance);
          setTokensBalance(data.tokens_balance);
          // Sauvegarder dans localStorage pour affichage immédiat
          localStorage.setItem('tokens_balance', data.tokens_balance.toString());
          // Déclencher un CustomEvent pour notifier useUser
          window.dispatchEvent(new CustomEvent('tokens_updated'));
        } else {
          console.error('[HeaderController] Erreur récupération solde:', response.status);
          // En cas d'erreur, utiliser le solde du JWT si disponible
          if (user.credits !== undefined) {
            setTokensBalance(user.credits);
          }
        }
      } catch (error) {
        console.error('[HeaderController] Erreur réseau:', error);
        // En cas d'erreur réseau, utiliser le solde du JWT si disponible
        if (user.credits !== undefined) {
          setTokensBalance(user.credits);
        }
      } finally {
        setBalanceLoading(false);
      }
    };

    // Ne récupérer le solde qu'une seule fois au chargement de l'utilisateur
    if (user?.id && !balanceLoading && !hasFetchedBalance) {
      fetchBalance();
      setHasFetchedBalance(true);
    }
    
    // Rafraîchir toutes les 60 secondes seulement si l'utilisateur est connecté
    const interval = setInterval(() => {
      if (user?.id && !balanceLoading) {
        fetchBalance();
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [user?.id]); // Utiliser seulement user.id au lieu de tout l'objet user

  // Écouter les changements de solde depuis les headers de réponse
  useEffect(() => {
    const interceptor = (response: Response) => {
      const remainingTokens = response.headers.get('x-tokens-remaining');
      if (remainingTokens) {
        const balance = parseInt(remainingTokens, 10);
        if (!isNaN(balance)) {
          console.log('[HeaderController] Mise à jour solde depuis header:', balance);
          setTokensBalance(balance);
          localStorage.setItem('tokens_balance', balance.toString());
          // Déclencher un CustomEvent pour notifier useUser
          window.dispatchEvent(new CustomEvent('tokens_updated'));
        }
      }
      
      // 🔄 Gérer le nouveau JWT avec solde mis à jour
      const newJwt = response.headers.get('x-new-jwt');
      if (newJwt) {
        console.log('[HeaderController] Nouveau JWT reçu, mise à jour du token');
        localStorage.setItem('token', newJwt);
        // Déclencher un CustomEvent pour notifier useUser
        window.dispatchEvent(new CustomEvent('tokens_updated'));
      }
      
      return response;
    };

    // Override fetch pour intercepter les headers
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      return interceptor(response.clone());
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const active = stored || (prefersDark ? "dark" : "light");
    setTheme(active);
    document.documentElement.classList.toggle("dark", active === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Fonction pour formater le solde
  const formatBalance = () => {
    if (balanceLoading) return "⏳";
    if (tokensBalance === null) {
      // Si pas de solde, utiliser celui du JWT ou afficher 0
      const fallbackBalance = user?.credits ?? 0;
      return `${fallbackBalance.toLocaleString()} XAF`;
    }
    return `${tokensBalance.toLocaleString()} XAF`;
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
      <div className="max-w-screen-2xl mx-auto px-6 h-24 flex items-center justify-between">
        
        {/* ✅ Bloc 1 : logo Yukpo agrandi */}
        <div className="flex items-center gap-4 min-w-[140px]">
          <Link to={ROUTES.HOME} className="flex items-center gap-2">
            <img src={logo} alt="Yukpo" className="h-14 w-auto object-contain" />
          </Link>
        </div>

        {/* ✅ Bloc 3 : profil utilisateur, solde, langue, thème */}
        <div className="hidden md:flex items-center gap-4 min-w-[300px] justify-end text-sm text-gray-700 dark:text-gray-200 relative">
          {!user?.id ? (
            <>
              <Link to={ROUTES.LOGIN} className="text-blue-600 hover:underline">
                Connexion
              </Link>
              <Link to={ROUTES.REGISTER} className="text-yellow-600 hover:underline">
                Inscription
              </Link>
            </>
          ) : (
            <>
              {/* ✅ Mes Services et Solde dans le même conteneur */}
              <div className="flex items-center space-x-2">
                <Link
                  to={ROUTES.MES_SERVICES}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                  title="Voir mes services"
                >
                  📋 Mes Services
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  to={ROUTES.MON_SOLDE}
                  className="text-green-600 font-bold hover:underline text-xs"
                  title="Voir mon historique IA"
                >
                  💰 {formatBalance()}
                </Link>
              </div>

              {/* ✅ Profil utilisateur rond + menu */}
              <div className="relative">
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt="profil"
                    className="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-[#0F52BA]"
                    onClick={() => setOpenProfileMenu(!openProfileMenu)}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg cursor-pointer border-2 border-[#0F52BA] select-none"
                    onClick={() => setOpenProfileMenu(!openProfileMenu)}
                  >
                    {user.name && user.name.trim() !== ''
                      ? user.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0,2).toUpperCase()
                      : (user.email ? user.email[0].toUpperCase() : '?')}
                  </div>
                )}
                {openProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded shadow text-sm z-50 p-3">
                    <p className="text-gray-800 dark:text-gray-100 font-semibold mb-2">
                      👤 {user.name || "Utilisateur"}
                    </p>
                    <p className="text-gray-500 dark:text-gray-300">
                      🛡 Rôle : <strong>{user.role}</strong>
                    </p>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <Link
                      to="/mon-compte"
                      className="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      ⚙️ Paramètres
                    </Link>
                    <Link
                      to={ROUTES.MON_SOLDE}
                      className="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      🧾 Historique IA
                    </Link>
                    <Link
                      to={ROUTES.RECHARGE_TOKENS}
                      className="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-green-600"
                    >
                      💳 Recharger tokens
                    </Link>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-1 text-red-600 hover:underline mt-2"
                    >
                      🚪 Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          <LangSwitcher />
          <button
            onClick={toggleTheme}
            title="Changer le thème"
            className="text-xl hover:text-yellow-500"
          >
            {theme === "dark" ? "☽" : "☀"}
          </button>
        </div>

        {/* ✅ Bloc 4 : menu mobile toujours visible */}
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </div>
    </header>
  );
};

export default HeaderController;
