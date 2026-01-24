// src/hooks/useUser.ts
// @ts-check
import { useState, useEffect, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { UtilisateurYukpo } from '@/types/user_types';

export type Role = 'admin' | 'user' | 'client' | 'public';

export interface DecodedToken {
  sub: string | number; // <-- Correction : correspond à l'id utilisateur dans le JWT
  email: string;
  role: Role;
  exp: number;
  name?: string;
  photo?: string;
  picture?: string;
  tokens_balance?: number; // <-- Correspond au champ du JWT backend
  currency?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isUser: boolean;
  name: string;
  photo: string;
  // Champs de profil utilisateur
  nom?: string;
  prenom?: string;
  nom_complet?: string;
  photo_profil?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  lang?: string;
  credits?: number;
  currency?: string;
}

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ajouter une référence pour éviter les réinitialisations multiples
  const initializationRef = useRef(false);
  const lastUserRef = useRef<User | null>(null);

  // Fonction pour récupérer l'utilisateur depuis le token
  const getUserFromToken = useCallback((): User | null => {
    const token = localStorage.getItem('token');
    const isFakeUserMode = localStorage.getItem('__DEV_FAKE_USER__') === 'true';
    let currentUser: User | null = null;

    console.log('[useUser] Initialisation, token présent:', !!token);

    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        console.log('[useUser] Token décodé:', decoded);
        
        if (decoded.exp * 1000 > Date.now()) {
          currentUser = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            isAdmin: decoded.role === 'admin',
            isUser: decoded.role === 'user',
            name: decoded.name || '',
            photo: decoded.photo || decoded.picture || '',
            credits: decoded.tokens_balance ?? 0,
            currency: decoded.currency ?? 'XAF',
          };
          console.log('[useUser] Utilisateur authentifié:', currentUser);
        } else {
          console.log('[useUser] Token expiré, suppression');
          localStorage.removeItem('token');
        }
      } catch (e) {
        console.error('[useUser] Erreur décodage token:', e);
        localStorage.removeItem('token');
      }
    }

    // Override dynamique du solde si présent dans localStorage (post-IA)
    const storedBalance = localStorage.getItem('tokens_balance');
    if (storedBalance !== null && currentUser) {
      currentUser.credits = parseInt(storedBalance, 10);
      console.log('[useUser] Solde mis à jour depuis localStorage:', currentUser.credits);
    }

    // ✅ MODE DEV : injecte un utilisateur fictif si activé
    if (!currentUser && import.meta.env.DEV && isFakeUserMode) {
      currentUser = {
        id: "fake-dev-id",
        email: "admin@yukpo.dev",
        role: "admin",
        isAdmin: true,
        isUser: false,
        name: "Dev Admin",
        photo: "",
        credits: 9999,
        currency: "XAF",
      };
      console.warn("🧪 UTILISATEUR DE DÉVELOPPEMENT ACTIVÉ — via localStorage");
    }

    return currentUser;
  }, []);

  // Effet initial et écoute des changements de tokens_balance
  useEffect(() => {
    // Éviter les réinitialisations multiples
    if (initializationRef.current) return;
    initializationRef.current = true;
    
    const updateUser = () => {
      const currentUser = getUserFromToken();
      
      // Éviter les mises à jour inutiles si l'utilisateur n'a pas changé
      if (JSON.stringify(currentUser) !== JSON.stringify(lastUserRef.current)) {
        setUser(currentUser);
        lastUserRef.current = currentUser;
      }
      
      setIsLoading(false);
    };

    // Mise à jour initiale
    updateUser();

    // Écouter les changements de tokens_balance dans localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tokens_balance' || e.key === 'token') {
        console.log('[useUser] Changement détecté dans localStorage:', e.key);
        updateUser();
      }
    };

    // Écouter les changements de localStorage (entre onglets)
    window.addEventListener('storage', handleStorageChange);

    // Écouter les changements de tokens_balance via CustomEvent (même onglet)
    const handleTokensUpdate = () => {
      console.log('[useUser] CustomEvent tokens_updated reçu');
      updateUser();
    };

    window.addEventListener('tokens_updated', handleTokensUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokens_updated', handleTokensUpdate);
    };
  }, [getUserFromToken]);

  // 🔁 Bascule dynamique via console
  useEffect(() => {
    if (typeof window !== "undefined") {
      // @ts-ignore
      window.__YUKPO_TOGGLE_DEV = () => {
        const current = localStorage.getItem('__DEV_FAKE_USER__') === 'true';
        localStorage.setItem('__DEV_FAKE_USER__', current ? 'false' : 'true');
        window.location.reload();
      };
    }
  }, []);

  // Fonction pour récupérer les informations complètes de l'utilisateur
  const fetchUserDetails = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userDetails = await response.json();
        setUser(prev => prev ? { ...prev, ...userDetails } : null);
      }
    } catch (error) {
      console.error('[useUser] Erreur récupération détails utilisateur:', error);
    }
  }, [user?.id]);

  return {
    user,
    isLoading,
    fetchUserDetails,
    login: (token: string) => {
      console.log('[useUser] Login avec token de longueur:', token.length);
      localStorage.setItem('token', token);
      // Forcer une re-évaluation
      window.location.reload();
    },
    logout: () => {
      console.log('[useUser] Logout');
      localStorage.removeItem('token');
      localStorage.removeItem('__DEV_FAKE_USER__');
      window.location.href = '/';
    },
  };
}
