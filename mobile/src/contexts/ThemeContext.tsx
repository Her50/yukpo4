/**
 * Context pour la gestion du thème (clair/sombre)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
    isDark: boolean;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    colors: typeof import('../theme/modernTheme').modernColors | typeof import('../theme/darkTheme').darkColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@yukpomnang_theme_mode';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
    const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

    // Charger le thème depuis le stockage
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto')) {
                    setThemeModeState(savedMode as ThemeMode);
                }
            } catch (error) {
                console.error('[ThemeContext] Erreur chargement thème:', error);
            }
        };
        loadTheme();
    }, []);

    // Écouter les changements du système
    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            if (themeMode === 'auto') {
                setIsDark(colorScheme === 'dark');
            }
        });

        return () => subscription.remove();
    }, [themeMode]);

    // Mettre à jour isDark selon le mode
    useEffect(() => {
        if (themeMode === 'light') {
            setIsDark(false);
        } else if (themeMode === 'dark') {
            setIsDark(true);
        } else {
            setIsDark(systemColorScheme === 'dark');
        }
    }, [themeMode, systemColorScheme]);

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (error) {
            console.error('[ThemeContext] Erreur sauvegarde thème:', error);
        }
    };

    const toggleTheme = () => {
        const newMode = isDark ? 'light' : 'dark';
        setThemeMode(newMode);
    };

    // Charger les couleurs dynamiquement
    const colors = isDark
        ? require('../theme/darkTheme').darkColors
        : require('../theme/modernTheme').modernColors;

    const value: ThemeContextType = {
        isDark,
        themeMode,
        setThemeMode,
        toggleTheme,
        colors,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};


