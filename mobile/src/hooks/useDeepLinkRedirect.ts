import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handlePendingDeepLink } from '../utils/deepLinkHandler';

/**
 * Hook pour gérer la redirection vers un deep link en attente après connexion/inscription
 * À utiliser dans un composant à l'intérieur de NavigationContainer
 * 
 * ⚠️ IMPORTANT: Ce hook ne gère PAS la redirection des partenaires vers leur dashboard.
 * La redirection partenaire est gérée dans AppNavigator.optimized.tsx via:
 *   1. initialRouteName='GestionServicesSpecialises' dans MainTabNavigator
 *   2. PartnerDashboardTab qui rend dynamiquement le bon écran selon partner_type
 * Toute navigation directe vers un écran stack (ex: navNavigate('PharmacieForm'))
 * cassait cette logique car elle poussait un écran STACK au-dessus des onglets.
 */
export const useDeepLinkRedirect = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    useEffect(() => {
        if (!navigation) {
            console.log('[useDeepLinkRedirect] Navigation non disponible encore');
            return;
        }

        const navNavigate = (navigation as any)?.navigate;
        if (typeof navNavigate !== 'function') {
            console.log('[useDeepLinkRedirect] navigation.navigate n\'est pas une fonction, attente...');
            return;
        }

        // Gérer uniquement les deep links en attente (PAS la redirection partenaire)
        if (user) {
            const checkDeepLink = async () => {
                try {
                    const redirected = await handlePendingDeepLink(navigation);
                    if (redirected) {
                        console.log('✅ Redirection vers deep link en attente effectuée');
                    } else {
                        console.log('[useDeepLinkRedirect] ℹ️ Pas de deep link en attente');
                    }
                } catch (error) {
                    console.error('❌ Erreur redirection deep link:', error);
                }
            };

            const timer = setTimeout(() => {
                const nav = navigation as any;
                if (nav && typeof nav?.navigate === 'function') {
                    checkDeepLink().catch(error => {
                        console.error('[useDeepLinkRedirect] Erreur checkDeepLink:', error);
                    });
                } else {
                    console.warn('[useDeepLinkRedirect] Navigation non disponible après délai');
                }
            }, 50);

            return () => clearTimeout(timer);
        }
        return undefined;
    }, [user, navigation]);
};

