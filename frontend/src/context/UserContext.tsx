// frontend/src/context/UserContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { jwtDecode } from 'jwt-decode';

export type UserRole = 'admin' | 'user' | 'client' | 'public';

export interface DecodedToken {
  sub: string | number; // ID utilisateur dans le JWT
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
  const refreshTokensBalance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      setTokensBalance(null);
      return;
    }

    try {
      const response = await fetch('/api/users/balance', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

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

  // 🔄 Décoder le JWT et initialiser l'utilisateur
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setTokensBalance(null);
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      if (decoded.exp * 1000 > Date.now()) {
        const userId = String(decoded.sub); // Convertir sub en string
        console.log('[UserContext] Utilisateur connecté:', userId);
        setUser({
          id: userId,
          email: decoded.email,
          role: decoded.role,
          exp: decoded.exp
        });
        // Initialiser le solde depuis le JWT si disponible
        if (decoded.tokens_balance !== undefined) {
          setTokensBalance(decoded.tokens_balance);
        }
      } else {
        console.log('[UserContext] Token expiré, déconnexion');
        localStorage.removeItem('token');
        setUser(null);
        setTokensBalance(null);
      }
    } catch (err) {
      console.warn('[UserContext] Erreur de décodage JWT', err);
      setUser(null);
      setTokensBalance(null);
    }
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
