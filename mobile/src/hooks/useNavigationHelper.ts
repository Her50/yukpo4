import { useNavigation } from '@react-navigation/native';

/**
 * Hook pour simplifier la navigation entre Tab Navigator et Stack Navigator
 */
export const useNavigationHelper = () => {
    const navigation = useNavigation();

    /**
     * Navigue vers un écran dans le Stack Navigator depuis un Tab Navigator
     */
    const navigateToStack = (route: string, params?: any) => {
        try {
            const parent = (navigation as any).getParent();
            if (parent) {
                parent.navigate(route, params);
            } else {
                navigation.navigate(route as never, params as never);
            }
        } catch (error) {
            console.error('[useNavigationHelper] Erreur navigation:', error);
            // Fallback: navigation directe
            try {
                navigation.navigate(route as never, params as never);
            } catch (fallbackError) {
                console.error('[useNavigationHelper] Erreur navigation fallback:', fallbackError);
            }
        }
    };

    return { navigateToStack };
};

