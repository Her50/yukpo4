// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';

const PENDING_DEEP_LINK_KEY = '@yukpomnang:pending_deep_link';

interface PendingDeepLink {
    type: 'product' | 'service';
    productId?: string;
    serviceId?: string;
    timestamp: number;
}

/**
 * Sauvegarder un deep link en attente (quand l'utilisateur n'est pas connecté)
 */
export const savePendingDeepLink = async (deepLink: PendingDeepLink): Promise<void> => {
    try {
        await SafeStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(deepLink));
        console.log('✅ Deep link sauvegardé:', deepLink);
    } catch (error) {
        console.error('❌ Erreur sauvegarde deep link:', error);
    }
};

/**
 * Récupérer et traiter le deep link en attente après connexion/inscription
 * À appeler immédiatement après login/register réussi
 * 
 * @param navigation - Navigation React Navigation
 * @returns true si un deep link a été traité, false sinon
 */
export const handlePendingDeepLink = async (navigation: any): Promise<boolean> => {
    try {
        const pendingData = await SafeStorage.getItem(PENDING_DEEP_LINK_KEY);
        
        if (!pendingData) {
            console.log('ℹ️ Aucun deep link en attente');
            return false;
        }

        const deepLink: PendingDeepLink = JSON.parse(pendingData);
        
        // Vérifier que le deep link n'est pas trop ancien (max 1 heure)
        const ageMinutes = (Date.now() - deepLink.timestamp) / (1000 * 60);
        if (ageMinutes > 60) {
            console.log('⚠️ Deep link expiré (>1h), ignoré');
            await SafeStorage.removeItem(PENDING_DEEP_LINK_KEY);
            return false;
        }

        console.log('🔗 Traitement deep link en attente:', deepLink.type);

        // Supprimer de AsyncStorage avant navigation
        await SafeStorage.removeItem(PENDING_DEEP_LINK_KEY);

        // Rediriger selon le type
        if (deepLink.type === 'product' && deepLink.productId && deepLink.serviceId) {
            console.log('📦 Redirection vers produit:', deepLink.productId);
            
            navigation.navigate('ProductDetail', {
                productId: deepLink.productId,
                serviceId: deepLink.serviceId,
            });
            
            return true;
        } else if (deepLink.type === 'service' && deepLink.serviceId) {
            console.log('🏢 Redirection vers service:', deepLink.serviceId);
            
            navigation.navigate('ServiceDetailShared', {
                id: deepLink.serviceId,
            });
            
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Erreur traitement deep link:', error);
        await SafeStorage.removeItem(PENDING_DEEP_LINK_KEY);
        return false;
    }
};

/**
 * Effacer un deep link en attente
 */
export const clearPendingDeepLink = async (): Promise<void> => {
    try {
        await SafeStorage.removeItem(PENDING_DEEP_LINK_KEY);
        console.log('✅ Deep link en attente effacé');
    } catch (error) {
        console.error('❌ Erreur effacement deep link:', error);
    }
};

