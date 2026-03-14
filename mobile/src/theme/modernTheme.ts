// Thème moderne avec gradients et effets visuels
import { DefaultTheme } from 'react-native-paper';

// Couleurs modernes 2024
export const modernColors = {
    // Gradients principaux (tuples pour LinearGradient)
    primaryGradient: ['#667eea', '#764ba2'] as const,
    secondaryGradient: ['#f093fb', '#f5576c'] as const,
    successGradient: ['#4facfe', '#00f2fe'] as const,
    warningGradient: ['#43e97b', '#38f9d7'] as const,

    // Couleurs de base modernes
    primary: '#667eea',
    primaryDark: '#5a6fd8',
    secondary: '#f093fb',
    accent: '#764ba2',

    // Couleurs neutres modernes
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',

    // Texte moderne
    text: '#1e293b',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',

    // États modernes
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Effets modernes
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowDark: 'rgba(0, 0, 0, 0.25)',
    glass: 'rgba(255, 255, 255, 0.25)',
    glassDark: 'rgba(0, 0, 0, 0.1)',

    // Danger (alias pour error)
    danger: '#ef4444',

    // Bordures modernes
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    borderDark: '#cbd5e1',

    // Couleurs supplémentaires utilisées dans les composants
    backgroundSecondary: '#f1f5f9',
    textPrimary: '#1e293b',
    textLight: '#94a3b8',
    gradientStart: '#667eea',
    gradientEnd: '#764ba2',
    card: '#ffffff',
    cardBorder: '#e2e8f0',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBackground: '#f8fafc',
    inputBorder: '#e2e8f0',
    disabled: '#94a3b8',
    divider: '#e2e8f0',
    white: '#ffffff',
    black: '#000000',
};

// Thème Paper moderne
export const modernTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: modernColors.primary,
        accent: modernColors.accent,
        background: modernColors.background,
        surface: modernColors.surface,
        text: modernColors.text,
        placeholder: modernColors.textSecondary,
        backdrop: modernColors.glass,
        notification: modernColors.error,
    },
    roundness: 16, // Bordures plus arrondies
};

// Styles modernes réutilisables
export const modernStyles = {
    // Gradients
    primaryGradient: {
        colors: modernColors.primaryGradient,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    secondaryGradient: {
        colors: modernColors.secondaryGradient,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // Ombres modernes
    shadowSmall: {
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    shadowLight: {
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    shadowMedium: {
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    shadowHeavy: {
        shadowColor: modernColors.shadowDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },

    // Glassmorphism
    glass: {
        backgroundColor: modernColors.glass,
        backdropFilter: 'blur(10px)',
        borderWidth: 1,
        borderColor: modernColors.glass,
    },

    // Bordures modernes
    borderRadius: {
        xs: 4,
        sm: 6,
        md: 12,
        lg: 16,
        xl: 24,
        small: 8,
        medium: 12,
        large: 16,
        xlarge: 24,
    },

    // Espacement moderne
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
};

export default modernTheme;