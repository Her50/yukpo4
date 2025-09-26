import logo from "@/assets/logo.png";
import LangSwitcher from "@/components/LangSwitcher";
import MobileMenu from "@/components/MobileMenu";
import NotificationBadge from "@/components/ui/NotificationBadge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useUser } from "@/hooks/useUser";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { apiGet } from "@/services/apiService";
import { Link } from "@react-navigation/native";
import { Bell, MessageCircle } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from 'react-native';

const HeaderController: React.FC = () => {
  const { user, logout } = useUser();
  const { notifications, conversations, loading: countsLoading, refreshCounts } = useNotificationCounts();
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
        const response = await apiGet('/api/users/balance');
        const data = await response.json();
        console.log('[HeaderController] Solde récupéré:', data.tokens_balance);
        setTokensBalance(data.tokens_balance);
        // Sauvegarder dans localStorage pour affichage immédiat
        localStorage.setItem('tokens_balance', data.tokens_balance.toString());
        // Déclencher un CustomEvent pour notifier useUser
        window.dispatchEvent(new CustomEvent('tokens_updated'));
      } catch (error) {
        console.error('[HeaderController] Erreur récupération solde:', error);
        // En cas d'erreur, utiliser le solde du JWT si disponible
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

    // Priorité : solde récupéré depuis l'API
    if (tokensBalance !== null && tokensBalance !== undefined) {
      return `${tokensBalance.toLocaleString()} XAF`;
    }

    // Fallback : solde du JWT ou localStorage
    const fallbackBalance = user?.credits ??
      (() => {
        const stored = localStorage.getItem('tokens_balance');
        return stored ? parseInt(stored, 10) : 0;
      })();

    return `${fallbackBalance.toLocaleString()} XAF`;
  };

  return (
    <header style="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
      <View style="max-w-screen-2xl mx-auto px-6 h-24 flex items-center justify-between">

        {/* ✅ Bloc 1 : logo Yukpo agrandi */}
        <View style="flex items-center gap-4 min-w-[140px]">
          <Link to={ROUTES.HOME} style="flex items-center gap-2">
            <img src={logo} alt="Yukpo" style="h-14 w-auto object-contain" />
          </Link>
        </View>

        {/* ✅ Bloc 3 : profil utilisateur, solde, langue, thème */}
        <View style="flex items-center gap-1 md:gap-4 min-w-[150px] md:min-w-[300px] justify-end text-sm text-gray-700 dark:text-gray-200 relative">
          {!user?.id ? (
            <>
              <Link to={ROUTES.LOGIN} style="text-blue-600 hover:underline text-xs md:text-sm px-1 md:px-2 py-1 rounded">
                Connexion
              </Link>
              <Link to={ROUTES.REGISTER} style="text-yellow-600 hover:underline text-xs md:text-sm px-1 md:px-2 py-1 rounded">
                Inscription
              </Link>
            </>
          ) : (
            <>
              {/* ✅ Mes Services et Solde dans le même conteneur */}
              <View style="hidden sm:flex items-center space-x-2">
                <Link
                  to={ROUTES.MES_SERVICES}
                  style="text-blue-600 hover:text-blue-700 text-xs font-medium"
                  title="Voir mes services"
                >
                  📋 Mes Services
                </Link>
                <Link
                  to="/dashboard-prestataire"
                  style="text-purple-600 hover:text-purple-700 text-xs font-medium"
                  title="Dashboard prestataire avec statistiques"
                >
                  📊 Dashboard
                </Link>
                <Link
                  to="/services-interagis"
                  style="text-orange-600 hover:text-orange-700 text-xs font-medium"
                  title="Mon historique d'interactions"
                >
                  📋 Mon historique
                </Link>
                <Text style="text-gray-400">|</Text>
                <Link
                  to={ROUTES.MON_SOLDE}
                  style="text-green-600 font-bold hover:underline text-xs"
                  title="Voir mon historique de consommation"
                >
                  💰 {formatBalance()}
                </Link>
              </View>

              {/* ✅ Solde uniquement sur mobile */}
              <View style="sm:hidden">
                <Link
                  to={ROUTES.MON_SOLDE}
                  style="text-green-600 font-bold hover:underline text-xs"
                  title="Voir mon historique de consommation"
                >
                  💰 {formatBalance()}
                </Link>
              </View>

              {/* ✅ Icônes de notifications et chats en haut à droite */}
              <View style="flex items-center gap-2 mr-2">
                {/* Icône Notifications */}
                <TouchableOpacity
                  onPress={() => {
                    const event = new CustomEvent('open:notification:history');
                    window.dispatchEvent(event);
                  }}
                  style="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                  title={`Notifications${notifications > 0 ? ` (${notifications} nouvelles)` : ''}`}
                >
                  <Bell style="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <NotificationBadge
                    count={notifications}
                    variant="error"
                  />
                </TouchableOpacity>

                {/* Icône Chats/Historique des conversations */}
                <TouchableOpacity
                  onPress={() => {
                    const event = new CustomEvent('open:chat:history');
                    window.dispatchEvent(event);
                  }}
                  style="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                  title={`Conversations${conversations > 0 ? ` (${conversations} nouvelles)` : ''}`}
                >
                  <MessageCircle style="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <NotificationBadge
                    count={conversations}
                    variant="success"
                  />
                </TouchableOpacity>

              </View>

              {/* ✅ Profil utilisateur rond + menu */}
              <View style="relative">
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt="profil"
                    style="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-[#0F52BA]"
                    onPress={() => setOpenProfileMenu(!openProfileMenu)}
                  />
                ) : (
                  <View
                    style="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg cursor-pointer border-2 border-[#0F52BA] select-none"
                    onPress={() => setOpenProfileMenu(!openProfileMenu)}
                  >
                    {user.name && user.name.trim() !== ''
                      ? user.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()
                      : (user.email ? user.email[0].toUpperCase() : '?')}
                  </View>
                )}
                {openProfileMenu && (
                  <View style="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded shadow text-sm z-[100] p-3">
                    <Text style="text-gray-800 dark:text-gray-100 font-semibold mb-2">
                      👤 {user.name || "Utilisateur"}
                    </Text>
                    <Text style="text-gray-500 dark:text-gray-300">
                      🛡 Rôle : <strong>{user.role}</strong>
                    </Text>
                    <hr style="my-2 border-gray-200 dark:border-gray-700" />
                    <Link
                      to={ROUTES.RECHARGE_TOKENS}
                      style="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-green-600"
                    >
                      💳 Recharger tokens
                    </Link>
                    <Link
                      to={ROUTES.MON_SOLDE}
                      style="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      🧾 Historique de consommation
                    </Link>
                    <Link
                      to="/mon-compte"
                      style="block px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      ⚙️ Paramètres
                    </Link>
                    <TouchableOpacity
                      onPress={logout}
                      style="w-full text-left px-3 py-1 text-red-600 hover:underline mt-2"
                    >
                      🚪 Déconnexion
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
          <LangSwitcher />
          <TouchableOpacity
            onPress={toggleTheme}
            title="Changer le thème"
            style="text-xl hover:text-yellow-500"
          >
            {theme === "dark" ? "☽" : "☀"}
          </TouchableOpacity>
        </View>

        {/* ✅ Bloc 4 : menu mobile pour très petits écrans */}
        <View style="hidden sm:block">
          <MobileMenu />
        </View>
      </View>
    </header>
  );
};

export default HeaderController;





