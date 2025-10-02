import * as React from 'react';
import { createContext, ReactNode, useContext, useState } from 'react';

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
    const [loading, setLoading] = useState(false);

    // Debug minimal
    if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] État:', { user: !!user, loading });
    }

    const login = async (email: string, password: string): Promise<void> => {
        console.log('[AuthContext] Tentative de connexion pour:', email);
        // Simulation de connexion pour le moment
        setLoading(true);
        setTimeout(() => {
            setUser({
                id: '1',
                name: 'Utilisateur Test',
                email: email,
                role: 'user',
                credits: 100,
                phone: '',
                photo: '',
            });
            setLoading(false);
        }, 1000);
    };

    const register = async (userData: {
        name: string;
        email: string;
        password: string;
        phone?: string;
    }) => {
        console.log('[AuthContext] Tentative d\'inscription pour:', userData.email);
        setLoading(true);
        setTimeout(() => {
            const newUser = {
                id: '1',
                name: userData.name,
                email: userData.email,
                role: 'user',
                credits: 100,
                phone: userData.phone || '',
                photo: '',
            };
            setUser(newUser);
            setLoading(false);
            return { success: true, data: newUser };
        }, 1000);
        return { success: true, data: null };
    };

    const logout = async () => {
        setUser(null);
        console.log('[AuthContext] Déconnexion réussie');
    };

    const updateUser = (userData: Partial<User>) => {
        setUser(prev => prev ? { ...prev, ...userData } : null);
    };

    const refreshUser = async () => {
        // Simulation de refresh
        console.log('[AuthContext] Actualisation utilisateur');
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