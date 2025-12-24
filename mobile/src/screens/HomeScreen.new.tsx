/**
 * HomeScreen - RECONSTRUCTION COMPLÈTE
 * 
 * ✅ NOUVEAU: Fichier reconstruit entièrement depuis zéro
 * ✅ Référence: HomeScreen.backup-reference.tsx (version originale avec problèmes de verrouillage)
 * 
 * Reconstruction en 5 étapes:
 * 1. Structure de base + hooks essentiels
 * 2. Header avec toutes les fonctionnalités
 * 3. Zone de recherche et mode sélection
 * 4. Contenu principal (Carousel, Promotions, Feed)
 * 5. Navigation complète, modals et boutons flottants
 */

import * as ReactNavigation from '@react-navigation/native';
import React, { useCallback, useReducer } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    View
} from 'react-native';
import ModernBackground from '../components/ModernBackground';
import { SafeNativeView } from '../components/SafeNativeView';
import { OfflineIndicator, ScreenTransition } from '../components/ux';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useRenderMonitor } from '../hooks/useRenderMonitor';
import { useScrollY } from '../hooks/useScrollY';
import { modernColors } from '../theme/modernTheme';
import { homeScreenReducer, initialState } from './HomeScreen.reducer';

// ============================================
// ✅ ÉTAPE 1: LAZY LOADING COMPOSANTS
// ============================================
const createSafeLazyComponent = <T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default?: T;[key: string]: any }>,
    fallbackName: string,
    fallbackMessage: string
): React.LazyExoticComponent<T> => {
    const SafeFallback: React.FC = () => (
        <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
            <Text style={{ fontSize: 14, color: '#666' }}>
                {fallbackMessage}
            </Text>
        </View>
    );
    SafeFallback.displayName = `${fallbackName}Fallback`;

    return React.lazy(() =>
        importFn()
            .then(module => {
                const Component = module.default || (module as any)[fallbackName] || (module as any).InfiniteFeed;
                if (!Component || typeof Component !== 'function') {
                    console.error(`[HomeScreen] ❌ ${fallbackName} invalide`);
                    return { default: SafeFallback as T };
                }
                return { default: Component as T };
            })
            .catch((error) => {
                console.error(`[HomeScreen] ❌ Erreur chargement ${fallbackName}:`, error);
                return { default: SafeFallback as T };
            })
    );
};

const GlobalPromoHighlights = createSafeLazyComponent(
    () => import('../components/promotions/GlobalPromoHighlights'),
    'GlobalPromoHighlights',
    'Promotions temporairement indisponibles'
);

const InfiniteFeed = createSafeLazyComponent(
    () => import('../components/InfiniteFeed'),
    'InfiniteFeed',
    'Feed temporairement indisponible'
);

// Dimensions statiques
const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');

// ============================================
// ✅ ÉTAPE 1: COMPOSANT PRINCIPAL - STRUCTURE DE BASE
// ============================================
const HomeScreen: React.FC = () => {
    // Monitoring des re-renders
    useRenderMonitor('HomeScreen');

    // Navigation et contextes
    const navigation = ReactNavigation.useNavigation();
    const { user, refreshUser } = useAuth();
    const { language, setLanguage, t } = useLanguageSafe();
    const { location } = useLocationSafe();
    const { colors } = useTheme();

    // Support orientation
    const { orientation, isLandscape, width, height } = useDeviceOrientation();

    // State management avec reducer
    const [state, dispatch] = useReducer(homeScreenReducer, initialState);
    const { scrollY, onScroll } = useScrollY();

    // ============================================
    // ✅ ÉTAPE 1: NAVIGATION SIMPLIFIÉE (SANS VERROUILLAGE)
    // ============================================
    const navigate = useCallback((routeName: string, params?: any) => {
        try {
            if (!navigation || typeof (navigation as any).navigate !== 'function') {
                console.error('[HomeScreen] ❌ Navigation non disponible');
                return false;
            }
            (navigation as any).navigate(routeName, params);
            return true;
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur navigation:', error);
            return false;
        }
    }, [navigation]);

    // TODO: ÉTAPE 2 - Ajouter les handlers (handleDeliveryPress, handleChatPress, etc.)
    // TODO: ÉTAPE 3 - Ajouter la logique de recherche et création
    // TODO: ÉTAPE 4 - Ajouter le rendu du contenu principal
    // TODO: ÉTAPE 5 - Ajouter les modals et boutons flottants

    // Structure temporaire - sera complétée dans les étapes suivantes
    return (
        <ModernBackground variant="home">
            <ScreenTransition type="fade" duration={300}>
                <SafeNativeView style={styles.container} pointerEvents="auto">
                    <OfflineIndicator />
                    <View style={styles.content}>
                        <Text style={styles.placeholder}>
                            ✅ ÉTAPE 1 COMPLÉTÉE: Structure de base créée
                        </Text>
                        <Text style={styles.placeholder}>
                            Prochaine étape: Header avec fonctionnalités
                        </Text>
                    </View>
                </SafeNativeView>
            </ScreenTransition>
        </ModernBackground>
    );
};

// Styles temporaires - seront complétés dans les étapes suivantes
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholder: {
        fontSize: 16,
        color: modernColors.text,
        textAlign: 'center',
        marginVertical: 10,
    },
});

export default HomeScreen;










