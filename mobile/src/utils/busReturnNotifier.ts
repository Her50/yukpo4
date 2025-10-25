import { apiPost } from '../services/api';

/**
 * Vérifie et notifie automatiquement les utilisateurs en attente d'un bus retour
 * À appeler immédiatement après la création d'un nouveau bus de voyage
 * 
 * @param busId - ID du nouveau bus créé
 * @param departureCity - Ville de départ
 * @param arrivalCity - Ville d'arrivée
 * @param departureDate - Date de départ (format: JJ/MM/AAAA)
 * @param departureTime - Heure de départ (format: HH:MM)
 * @returns Le nombre d'utilisateurs notifiés
 */
export const checkAndNotifyReturnRequests = async (
    busId: string,
    departureCity: string,
    arrivalCity: string,
    departureDate: string,
    departureTime: string
): Promise<number> => {
    try {
        console.log('🔍 Vérification demandes de retour pour nouveau bus:', busId);
        
        const response = await apiPost('/api/bus/check-return-requests', {
            busId,
            departureCity,
            arrivalCity,
            departureDate,
            departureTime
        });

        const notifiedCount = response.notifiedCount || 0;
        
        if (notifiedCount > 0) {
            console.log(`✅ ${notifiedCount} utilisateur${notifiedCount > 1 ? 's' : ''} notifié${notifiedCount > 1 ? 's' : ''} pour le bus retour`);
        } else {
            console.log('ℹ️ Aucune demande de retour correspondante pour ce bus');
        }

        return notifiedCount;
    } catch (error) {
        console.error('⚠️ Erreur vérification demandes retour:', error);
        // Ne pas bloquer la création du bus si la notification échoue
        return 0;
    }
};

/**
 * Appeler après création d'un produit de type ticket_voyage
 * 
 * Exemple d'utilisation dans YukpointIntelligentScreen ou ProductManager parent:
 * 
 * ```typescript
 * // Après création réussie du produit
 * if (newProduct.type === 'ticket_voyage') {
 *     await checkAndNotifyReturnRequests(
 *         productId,
 *         newProduct.depart,
 *         newProduct.destination,
 *         newProduct.dateDepart,
 *         newProduct.heureDepart
 *     );
 * }
 * ```
 */
export const handleBusCreated = async (
    productId: string,
    productData: {
        depart: string;
        destination: string;
        dateDepart: string;
        heureDepart: string;
    }
): Promise<void> => {
    await checkAndNotifyReturnRequests(
        productId,
        productData.depart,
        productData.destination,
        productData.dateDepart,
        productData.heureDepart
    );
};

