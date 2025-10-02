import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import * as React from 'react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  credits: number;
  photo?: string;
  token?: string;
}

interface DecodedToken {
  sub: string | number;
  email: string;
  role: string;
  exp: number;
  name?: string;
  tokens_balance?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<{ success: boolean; data: User | null; }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authCheckDone, setAuthCheckDone] = useState(false);

  console.log('[AuthContext IMPROVED] État actuel:', { 
    user: !!user, 
    loading, 
    authCheckDone,
    userId: user?.id,
    userEmail: user?.email 
  });

  // Version améliorée de checkAuthStatus avec plus de logs
  const checkAuthStatus = useCallback(async () => {
    console.log('[AuthContext IMPROVED] ═══ DÉBUT checkAuthStatus ═══');
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      console.log('[AuthContext IMPROVED] Token dans AsyncStorage:', token ? `Oui (${token.substring(0, 50)}...)` : 'Non');

      if (token) {
        try {
          const decoded = jwtDecode<DecodedToken>(token);
          console.log('[AuthContext IMPROVED] Token décodé avec succès:', {
            sub: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            exp: decoded.exp,
            expiresIn: Math.round((decoded.exp * 1000 - Date.now()) / 1000 / 60) + ' minutes'
          });

          if (decoded.exp * 1000 > Date.now()) {
            // Récupérer le nom depuis l'API /user/me
            console.log('[AuthContext IMPROVED] Token valide, récupération du profil utilisateur...');
            
            const userData: User = {
              id: String(decoded.sub),
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || decoded.email.split('@')[0], // Utiliser le début de l'email comme nom par défaut
              credits: decoded.tokens_balance ?? 0,
              phone: '',
              photo: '',
              token: token
            };

            console.log('[AuthContext IMPROVED] ✅ Utilisateur créé:', userData);
            setUser(userData);
            console.log('[AuthContext IMPROVED] ✅ setUser() appelé');
          } else {
            console.log('[AuthContext IMPROVED] ❌ Token expiré');
            await AsyncStorage.removeItem('auth_token');
            setUser(null);
          }
        } catch (decodeError) {
          console.error('[AuthContext IMPROVED] ❌ Erreur décodage token:', decodeError);
          await AsyncStorage.removeItem('auth_token');
          setUser(null);
        }
      } else {
        console.log('[AuthContext IMPROVED] ℹ️ Aucun token trouvé');
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext IMPROVED] ❌ Erreur vérification auth:', error);
      await AsyncStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
      setAuthCheckDone(true);
      console.log('[AuthContext IMPROVED] ═══ FIN checkAuthStatus ═══ loading=false, authCheckDone=true');
    }
  }, []);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    console.log('[AuthContext IMPROVED] 🚀 useEffect de démarrage déclenché');
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    console.log('[AuthContext IMPROVED] ═══════════════════════════════════════');
    console.log('[AuthContext IMPROVED] 🔐 DÉBUT LOGIN');
    console.log('[AuthContext IMPROVED] Email:', email);
    console.log('[AuthContext IMPROVED] ═══════════════════════════════════════');

    try {
      setLoading(true);
      console.log('[AuthContext IMPROVED] setLoading(true)');

      const response = await authApi.login(email, password);
      console.log('[AuthContext IMPROVED] Réponse API complète:', {
        success: response.success,
        hasToken: !!response.data?.token,
        error: response.error
      });

      if (response.success && response.data?.token) {
        console.log('[AuthContext IMPROVED] ✅ Token reçu, décodage...');
        const decoded = jwtDecode<DecodedToken>(response.data.token);
        console.log('[AuthContext IMPROVED] Token décodé:', {
          sub: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name
        });

        if (decoded.exp * 1000 > Date.now()) {
          // Sauvegarder le token
          await AsyncStorage.setItem('auth_token', response.data.token);
          console.log('[AuthContext IMPROVED] ✅ Token sauvegardé dans AsyncStorage');

          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || decoded.email.split('@')[0],
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: response.data.token
          };

          console.log('[AuthContext IMPROVED] 👤 Utilisateur créé:', userData);
          
          // IMPORTANT: Appeler setUser de manière synchrone
          setUser(userData);
          console.log('[AuthContext IMPROVED] ✅✅✅ setUser() APPELÉ avec userData');
          
          // Forcer une vérification après un délai court
          setTimeout(() => {
            console.log('[AuthContext IMPROVED] 🔄 Vérification post-login:', {
              userIsSet: !!user,
              userId: user?.id
            });
          }, 100);
        } else {
          console.log('[AuthContext IMPROVED] ❌ Token expiré');
          throw new Error('Token expiré');
        }
      } else {
        console.log('[AuthContext IMPROVED] ❌ Échec connexion:', response.error);
        throw new Error(response.error || 'Token non reçu lors de la connexion');
      }
    } catch (error: any) {
      console.error('[AuthContext IMPROVED] ❌ Erreur connexion:', error.message);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
      console.log('[AuthContext IMPROVED] ═══════════════════════════════════════');
      console.log('[AuthContext IMPROVED] 🏁 FIN LOGIN - loading=false');
      console.log('[AuthContext IMPROVED] ═══════════════════════════════════════');
    }
  }, [user]);

  const register = useCallback(async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      setLoading(true);
      console.log('[AuthContext IMPROVED] Tentative d\'inscription pour:', userData.email);

      const response = await authApi.register(userData);
      console.log('[AuthContext IMPROVED] Réponse inscription:', response);

      if (response.success) {
        if (response.data?.token) {
          console.log('[AuthContext IMPROVED] Token reçu lors de l\'inscription');
          const decoded = jwtDecode<DecodedToken>(response.data.token);

          if (decoded.exp * 1000 > Date.now()) {
            await AsyncStorage.setItem('auth_token', response.data.token);

            const newUserData: User = {
              id: String(decoded.sub),
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || userData.name,
              credits: decoded.tokens_balance ?? 0,
              phone: userData.phone || '',
              photo: '',
              token: response.data.token
            };

            setUser(newUserData);
            console.log('[AuthContext IMPROVED] ✅ Inscription réussie avec token direct');
            return { success: true, data: newUserData };
          } else {
            throw new Error('Token expiré');
          }
        } else {
          // Connecter automatiquement avec les identifiants
          await login(userData.email, userData.password);
          return { success: true, data: user };
        }
      } else {
        throw new Error(response.error || 'Erreur lors de l\'inscription');
      }
    } catch (error: any) {
      console.error('[AuthContext IMPROVED] Erreur inscription:', error);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [login, user]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      await AsyncStorage.removeItem('auth_token');
      setUser(null);
      console.log('[AuthContext IMPROVED] Déconnexion réussie');
    } catch (error) {
      console.error('[AuthContext IMPROVED] Erreur déconnexion:', error);
    }
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || decoded.email.split('@')[0],
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);
          console.log('[AuthContext IMPROVED] Utilisateur actualisé');
        } else {
          console.log('[AuthContext IMPROVED] Token expiré lors de l\'actualisation');
          await AsyncStorage.removeItem('auth_token');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('[AuthContext IMPROVED] Erreur actualisation utilisateur:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  console.log('[AuthContext IMPROVED] Provider render avec:', {
    user: !!user,
    loading,
    authCheckDone,
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};


