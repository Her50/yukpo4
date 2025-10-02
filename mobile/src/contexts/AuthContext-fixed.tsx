import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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

    console.log('[AuthContext] État actuel:', { user: !!user, loading, userId: user?.id });

    // Vérifier l'authentification au démarrage
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('auth_token');
            console.log('[AuthContext] Token trouvé:', !!token);

            if (token) {
                const decoded = jwtDecode<DecodedToken>(token);
                console.log('[AuthContext] Token décodé:', decoded);

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

                    console.log('[AuthContext] Utilisateur connecté depuis JWT:', userData);
                    setUser(userData);
                } else {
                    console.log('[AuthContext] Token expiré, déconnexion...');
                    await authApi.logout();
                    setUser(null);
                }
            } else {
                console.log('[AuthContext] Aucun token trouvé');
                setUser(null);
            }
        } catch (error) {
            console.error('[AuthContext] Erreur vérification auth:', error);
            await authApi.logout();
            setUser(null);
        } finally {
            setLoading(false);
            console.log('[AuthContext] Vérification auth terminée, loading = false');
        }
    };

    const login = async (email: string, password: string): Promise<void> => {
        try {
            setLoading(true);
            console.log('[AuthContext] Tentative de connexion pour:', email);

            const response = await authApi.login(email, password);
            console.log('[AuthContext] Réponse login:', response);

            if (response.data?.token) {
                console.log('[AuthContext] Token reçu, décodage JWT...');
                const decoded = jwtDecode<DecodedToken>(response.data.token);
                console.log('[AuthContext] Token décodé:', decoded);

                if (decoded.exp * 1000 > Date.now()) {
                    // Sauvegarder le token
                    await AsyncStorage.setItem('auth_token', response.data.token);

                    const userData: User = {
                        id: String(decoded.sub),
                        email: decoded.email,
                        role: decoded.role,
                        name: decoded.name || '',
                        credits: decoded.tokens_balance ?? 0,
                        phone: '',
                        photo: '',
                        token: response.data.token
                    };

                    console.log('[AuthContext] Utilisateur créé depuis JWT:', userData);
                    setUser(userData);
                    console.log('[AuthContext] Utilisateur défini dans le contexte');
                } else {
                    console.log('[AuthContext] Token expiré');
                    throw new Error('Token expiré');
                }
            } else {
                console.log('[AuthContext] Aucun token dans la réponse:', response);
                throw new Error('Token non reçu lors de la connexion');
            }
        } catch (error) {
            console.error('[AuthContext] Erreur connexion:', error);
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
            console.log('[AuthContext] Tentative d\'inscription pour:', userData.email);

            const response = await authApi.register(userData);
            console.log('[AuthContext] Réponse inscription:', response);

            if (response.success) {
                if (response.data?.token) {
                    console.log('[AuthContext] Token reçu lors de l\'inscription, décodage JWT...');
                    const decoded = jwtDecode<DecodedToken>(response.data.token);
                    console.log('[AuthContext] Token décodé:', decoded);

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
                        console.log('[AuthContext] Inscription réussie avec token direct:', newUserData);
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
                throw new Error(response.message || 'Erreur lors de l\'inscription');
            }
        } catch (error) {
            console.error('[AuthContext] Erreur inscription:', error);
            setUser(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
            await AsyncStorage.removeItem('auth_token');
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
            const token = await AsyncStorage.getItem('auth_token');
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
                    await AsyncStorage.removeItem('auth_token');
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
