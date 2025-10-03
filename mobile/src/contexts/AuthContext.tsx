import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';
import { jwtDecode } from '../utils/jwtDecode';

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

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        // En cas d'erreur, continuer sans authentification
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');

      if (token) {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || 'Utilisateur',
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);
        } else {
          // Token expiré, nettoyer
          await AsyncStorage.removeItem('auth_token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      // En cas d'erreur, déconnecter l'utilisateur
      await AsyncStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await authApi.login(email, password);
      
      if (response.success && response.data) {
        const { user: userData, token } = response.data;
        
        // Sauvegarder le token
        await AsyncStorage.setItem('auth_token', token);
        
        // Mettre à jour l'utilisateur
        setUser({
          ...userData,
          token: token
        });
      } else {
        throw new Error(response.message || 'Échec de la connexion');
      }
    } catch (error) {
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
      
      if (response.success && response.data) {
        const { user: newUser, token } = response.data;
        
        // Sauvegarder le token
        await AsyncStorage.setItem('auth_token', token);
        
        // Mettre à jour l'utilisateur
        setUser({
          ...newUser,
          token: token
        });
        
        return { success: true, data: newUser };
      } else {
        return { success: false, data: null };
      }
    } catch (error) {
      return { success: false, data: null };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      setUser(null);
    } catch (error) {
      // Même en cas d'erreur, déconnecter l'utilisateur
      setUser(null);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  const refreshUser = async () => {
    try {
      await checkAuthStatus();
    } catch (error) {
      // En cas d'erreur, ne rien faire
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};