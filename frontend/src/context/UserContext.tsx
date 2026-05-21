// frontend/src/context/UserContext.tsx
//
// ✅ 2026-05-21 — Migration cookie httpOnly :
// L'utilisateur n'est plus reconstitué en décodant le JWT du localStorage
// (devenu invisible côté JS pour fix XSS). On appelle `/api/auth/me` qui
// répond avec les claims si le cookie httpOnly est valide.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { API_BASE_URL } from '../config/api';

export type UserRole = 'admin' | 'user' | 'client' | 'public';

export interface DecodedToken {
  sub: string | number; // ID utilisateur dans le JWT (legacy, encore utilisé par d'autres écrans)
  email: string;
  role: UserRole;
  exp: number;
  tokens_balance?: number;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  exp: number;
  name?: string;
  partner_type?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  tokensBalance: number | null;
  updateTokensBalance: (newBalance: number) => void;
  refreshTokensBalance: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  tokensBalance: null,
  updateTokensBalance: () => {},
  refreshTokensBalance: async () => {},
});

export const useUserContext = () => useContext(UserContext);

interface Props {
  children: ReactNode;
}

export function UserProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [tokensBalance, setTokensBalance] = useState<number | null>(null);

  // 📡 Récupérer le solde de tokens depuis l'API
  // ✅ 2026-05-21 : credentials envoyés par le wrapper global window.fetch
  const refreshTokensBalance = useCallback(async () => {
    if (!user) {
      setTokensBalance(null);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/balance`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[UserContext] Solde récupéré pour utilisateur ${user.id}:`, data.tokens_balance);
        setTokensBalance(data.tokens_balance);
      } else {
        console.error('[UserContext] Erreur récupération solde:', response.status);
        setTokensBalance(null);
      }
    } catch (error) {
      console.error('[UserContext] Erreur réseau récupération solde:', error);
      setTokensBalance(null);
    }
  }, [user]);

  // 💰 Mettre à jour le solde de tokens localement
  const updateTokensBalance = useCallback((newBalance: number) => {
    console.log(`[UserContext] Mise à jour solde local pour utilisateur ${user?.id}: ${tokensBalance} → ${newBalance}`);
    setTokensBalance(newBalance);
  }, [user?.id, tokensBalance]);

  // 🔄 Restaurer la session depuis /api/auth/me (cookie httpOnly)
  // ✅ 2026-05-21 — Avant : décodage JWT du localStorage (cassé par fix XSS).
  //                Maintenant : appel backend qui lit le cookie et renvoie les claims.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`);
        if (cancelled) return;
        if (res.ok) {
          const me = await res.json();
          setUser({
            id: String(me.id),
            email: me.email,
            role: me.role as UserRole,
            // pas d'exp dans /me — on s'appuie sur la validité du cookie côté serveur
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            name: me.name ?? undefined,
            partner_type: me.partner_type ?? undefined,
          });
          if (typeof me.tokens_balance === 'number') {
            setTokensBalance(me.tokens_balance);
          }
        } else {
          // 401 → pas de session valide. Purger un éventuel legacy localStorage.
          localStorage.removeItem('token');
          setUser(null);
          setTokensBalance(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[UserContext] /auth/me indisponible:', err);
          setUser(null);
          setTokensBalance(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 🔄 Récupérer le solde quand l'utilisateur change
  useEffect(() => {
    if (user) {
      console.log(`[UserContext] Utilisateur changé vers ${user.id}, récupération du solde...`);
      refreshTokensBalance();
    } else {
      console.log('[UserContext] Pas d\'utilisateur, réinitialisation du solde');
      setTokensBalance(null);
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      tokensBalance, 
      updateTokensBalance, 
      refreshTokensBalance 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export default UserContext;
