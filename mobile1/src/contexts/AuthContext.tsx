import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { api } from '../services/api';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    tokens?: number;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    register: (name: string, email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthState();
    }, []);

    const checkAuthState = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                const decoded = jwtDecode<{ user: User; exp: number }>(token);

                // Vérifier si le token n'est pas expiré
                if (decoded.exp * 1000 > Date.now()) {
                    setUser(decoded.user);
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                } else {
                    await AsyncStorage.removeItem('authToken');
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification de l\'authentification:', error);
            await AsyncStorage.removeItem('authToken');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            setLoading(true);
            const response = await api.post('/auth/login', { email, password });

            if (response.data.token) {
                const token = response.data.token;
                await AsyncStorage.setItem('authToken', token);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                const decoded = jwtDecode<{ user: User }>(token);
                setUser(decoded.user);

                Toast.show({
                    type: 'success',
                    text1: 'Connexion réussie',
                    text2: `Bienvenue ${decoded.user.name}`,
                });

                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Erreur de connexion:', error);
            Toast.show({
                type: 'error',
                text1: 'Erreur de connexion',
                text2: error.response?.data?.message || 'Email ou mot de passe incorrect',
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string): Promise<boolean> => {
        try {
            setLoading(true);
            const response = await api.post('/auth/register', { name, email, password });

            if (response.data.token) {
                const token = response.data.token;
                await AsyncStorage.setItem('authToken', token);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                const decoded = jwtDecode<{ user: User }>(token);
                setUser(decoded.user);

                Toast.show({
                    type: 'success',
                    text1: 'Inscription réussie',
                    text2: `Bienvenue ${decoded.user.name}`,
                });

                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Erreur d\'inscription:', error);
            Toast.show({
                type: 'error',
                text1: 'Erreur d\'inscription',
                text2: error.response?.data?.message || 'Une erreur est survenue',
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('authToken');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);

            Toast.show({
                type: 'info',
                text1: 'Déconnexion',
                text2: 'Vous avez été déconnecté',
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    };

    const updateUser = (userData: Partial<User>) => {
        if (user) {
            setUser({ ...user, ...userData });
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

