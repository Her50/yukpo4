// Thèmes avancés pour Yukpo
export const advancedThemes = {
    // Thème principal - Glassmorphism
    glassmorphism: {
        background: {
            primary: 'rgba(255, 255, 255, 0.1)',
            secondary: 'rgba(255, 255, 255, 0.05)',
            overlay: 'rgba(0, 0, 0, 0.1)',
        },
        glass: {
            card: 'rgba(255, 255, 255, 0.15)',
            button: 'rgba(255, 255, 255, 0.2)',
            input: 'rgba(255, 255, 255, 0.1)',
        },
        borders: {
            light: 'rgba(255, 255, 255, 0.2)',
            medium: 'rgba(255, 255, 255, 0.3)',
            strong: 'rgba(255, 255, 255, 0.4)',
        },
        shadows: {
            light: '0 8px 32px rgba(0, 0, 0, 0.1)',
            medium: '0 16px 64px rgba(0, 0, 0, 0.15)',
            strong: '0 24px 96px rgba(0, 0, 0, 0.2)',
        },
        gradients: {
            primary: ['#667eea', '#764ba2'],
            secondary: ['#f093fb', '#f5576c'],
            accent: ['#4facfe', '#00f2fe'],
        }
    },

    // Thème sombre moderne
    darkModern: {
        background: {
            primary: '#0a0a0a',
            secondary: '#1a1a1a',
            overlay: 'rgba(255, 255, 255, 0.05)',
        },
        glass: {
            card: 'rgba(255, 255, 255, 0.08)',
            button: 'rgba(255, 255, 255, 0.12)',
            input: 'rgba(255, 255, 255, 0.06)',
        },
        borders: {
            light: 'rgba(255, 255, 255, 0.1)',
            medium: 'rgba(255, 255, 255, 0.15)',
            strong: 'rgba(255, 255, 255, 0.2)',
        },
        shadows: {
            light: '0 8px 32px rgba(0, 0, 0, 0.3)',
            medium: '0 16px 64px rgba(0, 0, 0, 0.4)',
            strong: '0 24px 96px rgba(0, 0, 0, 0.5)',
        },
        gradients: {
            primary: ['#1a1a2e', '#16213e'],
            secondary: ['#0f3460', '#533483'],
            accent: ['#e94560', '#f27121'],
        }
    },

    // Thème minimaliste
    minimal: {
        background: {
            primary: '#ffffff',
            secondary: '#f8f9fa',
            overlay: 'rgba(0, 0, 0, 0.02)',
        },
        glass: {
            card: 'rgba(255, 255, 255, 0.8)',
            button: 'rgba(255, 255, 255, 0.9)',
            input: 'rgba(255, 255, 255, 0.7)',
        },
        borders: {
            light: 'rgba(0, 0, 0, 0.05)',
            medium: 'rgba(0, 0, 0, 0.1)',
            strong: 'rgba(0, 0, 0, 0.15)',
        },
        shadows: {
            light: '0 2px 8px rgba(0, 0, 0, 0.04)',
            medium: '0 4px 16px rgba(0, 0, 0, 0.08)',
            strong: '0 8px 32px rgba(0, 0, 0, 0.12)',
        },
        gradients: {
            primary: ['#f8f9fa', '#e9ecef'],
            secondary: ['#ffffff', '#f1f3f4'],
            accent: ['#6c757d', '#495057'],
        }
    },

    // Thème vibrant (pour les événements spéciaux)
    vibrant: {
        background: {
            primary: 'rgba(255, 255, 255, 0.1)',
            secondary: 'rgba(255, 255, 255, 0.05)',
            overlay: 'rgba(0, 0, 0, 0.1)',
        },
        glass: {
            card: 'rgba(255, 255, 255, 0.2)',
            button: 'rgba(255, 255, 255, 0.25)',
            input: 'rgba(255, 255, 255, 0.15)',
        },
        borders: {
            light: 'rgba(255, 255, 255, 0.3)',
            medium: 'rgba(255, 255, 255, 0.4)',
            strong: 'rgba(255, 255, 255, 0.5)',
        },
        shadows: {
            light: '0 8px 32px rgba(255, 0, 150, 0.2)',
            medium: '0 16px 64px rgba(255, 0, 150, 0.3)',
            strong: '0 24px 96px rgba(255, 0, 150, 0.4)',
        },
        gradients: {
            primary: ['#ff6b6b', '#ee5a24'],
            secondary: ['#feca57', '#ff9ff3'],
            accent: ['#48dbfb', '#0abde3'],
        }
    }
};

// Fonction pour obtenir le thème actuel
export const getCurrentTheme = (themeName: keyof typeof advancedThemes = 'glassmorphism') => {
    return advancedThemes[themeName];
};

// Fonction pour créer des styles glassmorphism
export const createGlassmorphismStyle = (theme: any, variant: 'card' | 'button' | 'input' = 'card') => {
    return {
        backgroundColor: theme.glass[variant],
        borderWidth: 1,
        borderColor: theme.borders.light,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
    };
};

// Fonction pour créer des dégradés
export const createGradientStyle = (theme: any, variant: 'primary' | 'secondary' | 'accent' = 'primary') => {
    return {
        colors: theme.gradients[variant],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    };
};









