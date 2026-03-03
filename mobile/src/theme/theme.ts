export const theme = {
  colors: {
    // Couleurs principales Yukpo
    primary: '#0F52BA', // Bleu principal
    secondary: '#3B82F6', // Bleu Yukpo (logo officiel)
    accent: '#7C3AED', // Violet Yukpo (logo officiel)

    // Couleurs de fond
    background: '#F8FAFC',
    surface: '#FFFFFF',

    // Couleurs de texte
    text: '#1F2937',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',

    // Couleurs d'état
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Couleurs de bordure
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    // Couleurs de gradient
    gradientStart: '#3B82F6', // Bleu logo
    gradientMiddle: '#6366F1', // Indigo milieu
    gradientEnd: '#7C3AED', // Violet logo
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      fontWeight: 'normal' as const,
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      fontWeight: 'normal' as const,
      lineHeight: 20,
    },
    small: {
      fontSize: 12,
      fontWeight: 'normal' as const,
      lineHeight: 16,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};







