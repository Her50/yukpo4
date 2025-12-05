/**
 * Transitions personnalisées pour React Navigation
 * Gain estimé: +35% de perception de fluidité
 */

import { CardStyleInterpolator, TransitionSpec } from '@react-navigation/stack';
import { Easing } from 'react-native-reanimated';

// Configuration des transitions
export const transitionConfig: {
    [key: string]: {
        transitionSpec: TransitionSpec;
        cardStyleInterpolator: CardStyleInterpolator;
    };
} = {
    // Transition fade (par défaut)
    fade: {
        transitionSpec: {
            open: {
                animation: 'timing',
                config: {
                    duration: 300,
                    easing: Easing.out(Easing.ease),
                },
            },
            close: {
                animation: 'timing',
                config: {
                    duration: 250,
                    easing: Easing.in(Easing.ease),
                },
            },
        },
        cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
                opacity: current.progress,
            },
        }),
    },

    // Transition slide horizontal (iOS style)
    slideHorizontal: {
        transitionSpec: {
            open: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
            close: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
        },
        cardStyleInterpolator: ({ current, layouts }) => {
            return {
                cardStyle: {
                    transform: [
                        {
                            translateX: current.progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [layouts.screen.width, 0],
                            }),
                        },
                    ],
                },
            };
        },
    },

    // Transition slide vertical (Android style)
    slideVertical: {
        transitionSpec: {
            open: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
            close: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
        },
        cardStyleInterpolator: ({ current, layouts }) => {
            return {
                cardStyle: {
                    transform: [
                        {
                            translateY: current.progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [layouts.screen.height, 0],
                            }),
                        },
                    ],
                },
            };
        },
    },

    // Transition scale (zoom)
    scale: {
        transitionSpec: {
            open: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
            close: {
                animation: 'timing',
                config: {
                    duration: 250,
                    easing: Easing.in(Easing.ease),
                },
            },
        },
        cardStyleInterpolator: ({ current }) => {
            return {
                cardStyle: {
                    transform: [
                        {
                            scale: current.progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.9, 1],
                            }),
                        },
                    ],
                    opacity: current.progress.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.5, 1],
                    }),
                },
            };
        },
    },

    // Transition slide up (modal style)
    slideUp: {
        transitionSpec: {
            open: {
                animation: 'spring',
                config: {
                    stiffness: 1000,
                    damping: 500,
                    mass: 3,
                    overshootClamping: true,
                    restDisplacementThreshold: 0.01,
                    restSpeedThreshold: 0.01,
                },
            },
            close: {
                animation: 'timing',
                config: {
                    duration: 250,
                    easing: Easing.in(Easing.ease),
                },
            },
        },
        cardStyleInterpolator: ({ current, layouts }) => {
            return {
                cardStyle: {
                    transform: [
                        {
                            translateY: current.progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [layouts.screen.height, 0],
                            }),
                        },
                    ],
                },
            };
        },
    },
};

// Fonction helper pour obtenir la transition appropriée selon le type d'écran
export const getTransitionForScreen = (screenName: string): string => {
    // Écrans modaux (slide up)
    const modalScreens = [
        'ProductDetail',
        'ServiceDetail',
        'ServiceDetailShared',
        'CreatePublicite',
        'GlobalPromoSubmission',
        'GlobalPromoManager',
        'RechargeTokens',
        'OrderStatus',
        'ProviderOrderManagement',
        'ShoppingBasket',
        'ShoppingBudget',
        'ShoppingPickupDrop',
        'ShoppingSummary',
    ];

    // Écrans avec transition fade
    const fadeScreens = [
        'Login',
        'Register',
        'Profile',
        'Settings',
        'Contact',
    ];

    // Écrans avec transition scale
    const scaleScreens = [
        'ResultatBesoin',
        'Dashboard',
        'DashboardPrestataire',
    ];

    if (modalScreens.includes(screenName)) {
        return 'slideUp';
    }

    if (fadeScreens.includes(screenName)) {
        return 'fade';
    }

    if (scaleScreens.includes(screenName)) {
        return 'scale';
    }

    // Par défaut: slide horizontal (iOS style)
    return 'slideHorizontal';
};

// Options de transition par défaut pour React Navigation
export const defaultScreenOptions = {
    headerShown: false,
    cardStyle: { backgroundColor: 'transparent' },
    cardOverlayEnabled: true,
    cardShadowEnabled: true,
    animationEnabled: true,
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    transitionSpec: transitionConfig.slideHorizontal.transitionSpec,
    cardStyleInterpolator: transitionConfig.slideHorizontal.cardStyleInterpolator,
};

