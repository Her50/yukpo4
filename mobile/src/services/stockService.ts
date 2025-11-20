/**
 * Service pour gérer le stock des produits
 */

import { API_BASE_URL } from '../config/api';
import { getToken } from '../lib/yukpoaclient';

export interface UpdateStockPayload {
    quantity_available?: number;
    quantity_reserved?: number;
    is_available?: boolean;
    storage_location_id?: number;
}

export const stockService = {
    /**
     * Mettre à jour le stock
     */
    updateStock: async (configId: number, payload: UpdateStockPayload): Promise<void> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/stock/${configId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la mise à jour du stock');
            }
        } catch (error: any) {
            console.error('[stockService] Erreur mise à jour stock:', error);
            throw error;
        }
    },

    /**
     * Supprimer un lieu de stockage
     */
    removeStockLocation: async (configId: number, locationId: number): Promise<void> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/stock/${configId}/location/${locationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la suppression du lieu de stock');
            }
        } catch (error: any) {
            console.error('[stockService] Erreur suppression lieu stock:', error);
            throw error;
        }
    },
};

