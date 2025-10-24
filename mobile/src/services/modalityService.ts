// Service pour gérer les modalités personnalisées avec persistance serveur
import { apiCall } from './api';

export interface CustomModality {
    id: string;
    productType: string;
    fieldName: string;
    modality: string;
    addedBy: string;
    addedAt: string;
    usageCount: number;
}

export interface ModalityResponse {
    success: boolean;
    data?: CustomModality[];
    error?: string;
}

class ModalityService {
    private customModalities: Map<string, string[]> = new Map();
    private isLoaded = false;

    // ✅ Charger les modalités personnalisées depuis le serveur
    async loadCustomModalities(): Promise<void> {
        try {
            console.log('[ModalityService] Chargement des modalités personnalisées...');

            const response = await apiCall<CustomModality[]>('/api/modalities/custom');

            if (response.success && response.data) {
                // Organiser les modalités par clé (productType + fieldName)
                this.customModalities.clear();

                response.data.forEach(modality => {
                    const key = `${modality.productType}:${modality.fieldName}`;
                    if (!this.customModalities.has(key)) {
                        this.customModalities.set(key, []);
                    }
                    this.customModalities.get(key)!.push(modality.modality);
                });

                console.log('[ModalityService] ✅ Modalités chargées:', this.customModalities.size, 'catégories');
                this.isLoaded = true;
            } else {
                console.warn('[ModalityService] ⚠️ Aucune modalité personnalisée trouvée');
                this.isLoaded = true;
            }
        } catch (error) {
            console.error('[ModalityService] ❌ Erreur chargement modalités:', error);
            this.isLoaded = true; // Marquer comme chargé pour éviter les boucles
        }
    }

    // ✅ Obtenir les modalités pour un champ spécifique
    async getModalitiesForField(productType: string, fieldName: string): Promise<string[]> {
        if (!this.isLoaded) {
            await this.loadCustomModalities();
        }

        const key = `${productType}:${fieldName}`;
        return this.customModalities.get(key) || [];
    }

    // ✅ Ajouter une nouvelle modalité personnalisée
    async addCustomModality(
        productType: string,
        fieldName: string,
        modality: string,
        userId?: string
    ): Promise<boolean> {
        try {
            console.log('[ModalityService] Ajout modalité:', { productType, fieldName, modality });

            const response = await apiCall<CustomModality>('/api/modalities/custom', {
                method: 'POST',
                body: JSON.stringify({
                    productType,
                    fieldName,
                    modality,
                    addedBy: userId || 'anonymous'
                })
            });

            if (response.success && response.data) {
                // Ajouter à la cache locale
                const key = `${productType}:${fieldName}`;
                if (!this.customModalities.has(key)) {
                    this.customModalities.set(key, []);
                }
                this.customModalities.get(key)!.push(modality);

                console.log('[ModalityService] ✅ Modalité ajoutée avec succès');
                return true;
            } else {
                console.error('[ModalityService] ❌ Erreur ajout modalité:', response.error);
                return false;
            }
        } catch (error) {
            console.error('[ModalityService] ❌ Erreur ajout modalité:', error);
            return false;
        }
    }

    // ✅ Incrémenter le compteur d'utilisation d'une modalité
    async incrementUsage(productType: string, fieldName: string, modality: string): Promise<void> {
        try {
            await apiCall(`/api/modalities/usage`, {
                method: 'POST',
                body: JSON.stringify({
                    productType,
                    fieldName,
                    modality
                })
            });
        } catch (error) {
            console.error('[ModalityService] Erreur incrément usage:', error);
            // Ne pas faire échouer l'opération pour une erreur de statistiques
        }
    }

    // ✅ Obtenir les modalités les plus utilisées
    async getPopularModalities(productType: string, fieldName: string, limit: number = 10): Promise<string[]> {
        try {
            const response = await apiCall<CustomModality[]>(`/api/modalities/popular?productType=${productType}&fieldName=${fieldName}&limit=${limit}`);

            if (response.success && response.data) {
                return response.data.map(m => m.modality);
            }
            return [];
        } catch (error) {
            console.error('[ModalityService] Erreur modalités populaires:', error);
            return [];
        }
    }

    // ✅ Vider le cache local (pour forcer le rechargement)
    clearCache(): void {
        this.customModalities.clear();
        this.isLoaded = false;
    }

    // ✅ Obtenir le statut de chargement
    getLoadedStatus(): boolean {
        return this.isLoaded;
    }
}

// Instance singleton
export const modalityService = new ModalityService();



