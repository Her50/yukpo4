import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { authApi } from '../services/api';
import { jwtDecode } from '../utils/jwtDecode';
import SafeStorage from '../utils/safeStorage';

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
  const [forceRender, setForceRender] = useState(0);

  // ✅ CORRECTION: Debug désactivé pour éviter les re-renders
  // Debug minimal - COMPLÈTEMENT DÉSACTIVÉ
  // if (false) { 
  //   console.log('[AuthContext] État:', { user: !!user, loading });
  // }

  // Vérifier l'authentification au démarrage avec gestion d'erreur
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      try {
        // ✅ CRITIQUE: Ajouter un timeout de sécurité pour éviter le blocage indéfini
        // Si checkAuthStatus prend plus de 8 secondes, on force loading à false
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('[AuthContext] ⚠️ Timeout initialisation auth (8s), continuation sans auth');
            setLoading(false);
          }
        }, 8000); // 8 secondes max

        await checkAuthStatus();
      } catch (error) {
        console.error('[AuthContext] Erreur lors de l\'initialisation:', error);
        // En cas d'erreur, continuer sans authentification
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      } finally {
        // Nettoyer le timeout si toujours actif
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    initializeAuth().catch(error => {
      console.error('[AuthContext] Erreur initializeAuth:', error);
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
    });

    // ✅ CRITIQUE: Cleanup pour éviter les mises à jour après démontage
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      // ✅ CRITIQUE: Ajouter un timeout pour éviter le blocage indéfini
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('[AuthContext] ⚠️ Timeout vérification auth (5s), continuation sans token');
          resolve(null);
        }, 5000); // 5 secondes max
      });

      const tokenPromise = SafeStorage.getItem('auth_token');
      const token = await Promise.race([tokenPromise, timeoutPromise]);

      if (token) {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || decoded.email.split('@')[0] || 'Utilisateur',
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);
        } else {
          await SafeStorage.removeItem('auth_token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Erreur auth:', error);
      await SafeStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      console.log('[AuthContext] Tentative de connexion pour:', email);

      const response = await authApi.login(email, password);
      console.log('[AuthContext] Réponse login complète:', JSON.stringify(response, null, 2));
      console.log('[AuthContext] response.success:', response.success);
      console.log('[AuthContext] response.data:', response.data);
      console.log('[AuthContext] response.data?.token:', response.data?.token);

      // ✅ CORRECTION: Vérifier plusieurs formats de réponse possibles
      let token: string | undefined = undefined;

      if (response.success && response.data) {
        // Format attendu: { success: true, data: { token, tokens_balance } }
        token = response.data.token;

        // ✅ FALLBACK: Si le token n'est pas dans data, vérifier si data est directement le token
        if (!token && typeof response.data === 'object') {
          // Vérifier si response.data est directement { token, tokens_balance }
          token = (response.data as any)?.token;
        }
      }

      console.log('[AuthContext] Token extrait:', token ? '✅ Présent' : '❌ Absent');
      console.log('[AuthContext] Structure response:', {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        tokenInData: !!response.data?.token,
      });

      if (token) {
        console.log('[AuthContext] ✅ Token reçu, décodage JWT...');
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          // Sauvegarder le token
          await SafeStorage.setItem('auth_token', token);

          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || decoded.email.split('@')[0] || 'Utilisateur',
            credits: decoded.tokens_balance ?? (response.data as any)?.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);

          // ✅ Enregistrer le token push pour notifications (en arrière-plan)
          try {
            const pushModule = await import('../services/pushNotifications');
            if (pushModule?.registerForPushNotificationsAsync) {
              pushModule.registerForPushNotificationsAsync(token).catch(() => {
                // Push échoue silencieusement
              });
            }
          } catch (pushError) {
            // Ne pas bloquer le login si push échoue
          }
          setForceRender(prev => prev + 1);
        } else {
          throw new Error('Token expiré');
        }
      } else {
        throw new Error(response.error || 'Token non reçu lors de la connexion');
      }
    } catch (error) {
      console.error('[AuthContext] Erreur login:', error);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      setLoading(true);

      const response = await authApi.register(userData);

      if (response.success) {
        if (response.data?.token) {
          const decoded = jwtDecode<DecodedToken>(response.data.token);

          if (decoded.exp * 1000 > Date.now()) {
            await SafeStorage.setItem('auth_token', response.data.token);

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
            return { success: true, data: newUserData };
          } else {
            throw new Error('Token expiré');
          }
        } else {
          // Sinon, connecter automatiquement avec les identifiants
          await login(userData.email, userData.password);
          return { success: true, data: user };
        }
      } else {
        throw new Error(response.error || 'Erreur lors de l\'inscription');
      }
    } catch (error: any) {
      console.error('[AuthContext] Erreur inscription:', error);
      setUser(null);

      // Améliorer le message d'erreur pour le 409 Conflict
      if (error?.message?.includes('409') || error?.response?.status === 409) {
        throw new Error('Cet email est déjà utilisé');
      }

      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      await SafeStorage.removeItem('auth_token');
      setUser(null);
      console.log('[AuthContext] Déconnexion réussie');
    } catch (error) {
      console.error('[AuthContext] Erreur déconnexion:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  const refreshUser = async () => {
    try {
      const token = await SafeStorage.getItem('auth_token');
      if (token) {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || '',
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);
          console.log('[AuthContext] Utilisateur actualisé depuis JWT:', userData);
        } else {
          console.log('[AuthContext] Token expiré lors de l\'actualisation');
          await SafeStorage.removeItem('auth_token');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('[AuthContext] Erreur actualisation utilisateur:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
  const safeChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={index}>{String(child)}</Text>;
    }
    if (child == null) {
      return null;
    }
    return child;
  });

  return (
    <AuthContext.Provider value={value}>
      {safeChildren}
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
