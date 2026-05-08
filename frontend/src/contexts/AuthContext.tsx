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
        phone?: string;
        credits?: number;
        currency?: string;
        isPartner?: boolean;
        partnerType?: string | null;
    } | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isPartner: boolean;
    partnerType: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isLoading } = useUser();

    const isPartner = !!user?.isPartner;
    const partnerType = user?.partnerType ?? null;

    const value: AuthContextType = {
        user: user ? {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            photo: user.photo,
            phone: user.phone,
            credits: user.credits,
            currency: user.currency,
            isPartner,
            partnerType,
        } : null,
        isAuthenticated: !!user,
        isLoading,
        isPartner,
        partnerType,
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
