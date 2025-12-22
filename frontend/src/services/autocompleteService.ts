/**
 * Service pour gérer l'autocomplete des caractéristiques produits
 * Adapté depuis mobile/src/services/autocompleteHistoryService.ts
 */

import { apiGet, apiPost } from './api';

export interface AutocompleteSuggestion {
    valeur: string;
    usage_count: number;
}

export interface AutocompleteCharacteristic {
    id: number;
    identifiant_base: string;
    sous_caracteristique: string;
    valeur: string;
    origine_champs: string;
    user_id?: number;
    service_id?: number;
    usage_count: number;
    created_at: string;
    updated_at: string;
}

class AutocompleteService {
    /**
     * Récupérer les suggestions autocomplete pour une sous-caractéristique
     * @param identifiant_base Ex: "produits"
     * @param sous_caracteristique Ex: "marque", "modele", "annee"
     * @param prefix Préfixe de recherche (optionnel)
     * @param limit Nombre maximum de suggestions (défaut: 10)
     */
    async getSuggestions(
        identifiant_base: string,
        sous_caracteristique: string,
        prefix?: string,
        limit: number = 10
    ): Promise<AutocompleteSuggestion[]> {
        try {
            const params = new URLSearchParams({
                identifiant_base,
                sous_caracteristique,
                limit: limit.toString(),
            });

            if (prefix) {
                params.append('prefix', prefix);
            }

            const response = await apiGet<{
                success: boolean;
                data: AutocompleteSuggestion[];
                count: number;
            }>(`/api/autocomplete/suggestions?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[AutocompleteService] Erreur récupération suggestions:', error);
            return [];
        }
    }

    /**
     * Récupérer toutes les sous-caractéristiques disponibles pour un identifiant_base
     * @param identifiant_base Ex: "produits"
     */
    async getSubCharacteristics(identifiant_base: string): Promise<string[]> {
        try {
            const response = await apiGet<{
                success: boolean;
                data: string[];
                count: number;
            }>(`/api/autocomplete/sub-characteristics/${encodeURIComponent(identifiant_base)}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[AutocompleteService] Erreur récupération sous-caractéristiques:', error);
            return [];
        }
    }

    /**
     * Récupérer toutes les valeurs pour une combinaison identifiant_base + sous_caracteristique
     * @param identifiant_base Ex: "produits"
     * @param sous_caracteristique Ex: "marque"
     */
    async getAllValues(
        identifiant_base: string,
        sous_caracteristique: string
    ): Promise<string[]> {
        try {
            const response = await apiGet<{
                success: boolean;
                data: string[];
                count: number;
            }>(
                `/api/autocomplete/values/${encodeURIComponent(identifiant_base)}/${encodeURIComponent(sous_caracteristique)}`
            );

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[AutocompleteService] Erreur récupération valeurs:', error);
            return [];
        }
    }

    /**
     * Insérer ou mettre à jour une caractéristique autocomplete
     * @param identifiant_base Ex: "produits"
     * @param sous_caracteristique Ex: "marque"
     * @param valeur Ex: "Toyota"
     * @param origine_champs "ia" ou "utilisateur"
     * @param user_id ID de l'utilisateur (optionnel)
     * @param service_id ID du service (optionnel)
     */
    async upsertCharacteristic(
        identifiant_base: string,
        sous_caracteristique: string,
        valeur: string,
        origine_champs: 'ia' | 'utilisateur' = 'utilisateur',
        user_id?: number,
        service_id?: number
    ): Promise<number | null> {
        try {
            const response = await apiPost<{
                success: boolean;
                id: number;
                message: string;
            }>('/api/autocomplete/upsert', {
                identifiant_base,
                sous_caracteristique,
                valeur,
                origine_champs,
                user_id,
                service_id,
            });

            if (response.success && response.id) {
                return response.id;
            }

            return null;
        } catch (error) {
            console.error('[AutocompleteService] Erreur upsert caractéristique:', error);
            return null;
        }
    }

    /**
     * Historiser un champ autocomplete (pour améliorer les suggestions futures)
     * @param identifiant_base Ex: "produits"
     * @param valeurs Array de valeurs (modalités concaténées)
     * @param separateur Séparateur utilisé (ex: ",")
     * @param sousCaracteristiques Objet avec les sous-caractéristiques
     * @param origine_champs "ia" ou "utilisateur"
     */
    async historizeField(
        identifiant_base: string,
        valeurs: string[],
        separateur: string,
        sousCaracteristiques: Record<string, string[]>,
        origine_champs: 'ia' | 'utilisateur' = 'utilisateur'
    ): Promise<void> {
        try {
            // Décomposer chaque valeur en caractéristiques individuelles
            const characteristics: Array<{
                identifiant_base: string;
                sous_caracteristique: string;
                valeur: string;
                origine_champs: string;
            }> = [];

            valeurs.forEach(valeur => {
                const parts = valeur.split(separateur).map(p => p.trim());
                const subCharKeys = Object.keys(sousCaracteristiques);

                parts.forEach((part, index) => {
                    const key = subCharKeys[index] || `item_${index}`;
                    if (part) {
                        characteristics.push({
                            identifiant_base,
                            sous_caracteristique: key,
                            valeur: part,
                            origine_champs,
                        });
                    }
                });
            });

            // Upsert chaque caractéristique
            await Promise.all(
                characteristics.map(char =>
                    this.upsertCharacteristic(
                        char.identifiant_base,
                        char.sous_caracteristique,
                        char.valeur,
                        char.origine_champs
                    )
                )
            );
        } catch (error) {
            console.error('[AutocompleteService] Erreur historisation:', error);
        }
    }
}

export const autocompleteService = new AutocompleteService();


