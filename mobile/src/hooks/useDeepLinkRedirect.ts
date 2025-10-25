import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { handlePendingDeepLink } from '../utils/deepLinkHandler';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook pour gérer la redirection vers un deep link en attente après connexion/inscription
 * À utiliser dans un composant à l'intérieur de NavigationContainer
 * 
 * Exemple: Ajouter dans HomeScreen ou AppNavigator
 */
export const useDeepLinkRedirect = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    useEffect(() => {
        // Vérifier s'il y a un deep link en attente seulement si l'utilisateur vient de se connecter
        if (user) {
            const checkDeepLink = async () => {
                try {
                    const redirected = await handlePendingDeepLink(navigation);
                    if (redirected) {
                        console.log('✅ Redirection vers deep link en attente effectuée');
                    }
                } catch (error) {
                    console.error('❌ Erreur redirection deep link:', error);
                }
            };

            // Attendre un peu que la navigation soit prête
            const timer = setTimeout(() => {
                checkDeepLink();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [user, navigation]);
};

