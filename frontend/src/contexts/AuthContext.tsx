// ✅ Context d'authentification pour compatibilité avec les pages offres d'emploi
import React, { createContext, ReactNode, useContext } from 'react';
import { useUser } from '../hooks/useUser';

interface AuthContextType {
    user: {
        id: string;
        email: string;
        role?: string;
        name?: string;
        photo?: string;
        credits?: number;
        currency?: string;
    } | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isLoading } = useUser();

    const value: AuthContextType = {
        user: user ? {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            photo: user.photo,
            credits: user.credits,
            currency: user.currency,
        } : null,
        isAuthenticated: !!user,
        isLoading,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

