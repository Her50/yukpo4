/**
 * Service pour gérer l'historique des caractéristiques autocomplete
 * Permet de récupérer les suggestions intelligentes depuis le backend
 */

import { apiCall, apiGet } from './api';

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

class AutocompleteHistoryService {
    /**
     * Récupérer les suggestions autocomplete pour une sous-caractéristique
     * @param identifiant_base Ex: "caracteristiques_vehicule"
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
            console.error('[AutocompleteHistoryService] Erreur récupération suggestions:', error);
            return [];
        }
    }

    /**
     * Récupérer toutes les sous-caractéristiques disponibles pour un identifiant_base
     * @param identifiant_base Ex: "caracteristiques_vehicule"
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
            console.error('[AutocompleteHistoryService] Erreur récupération sous-caractéristiques:', error);
            return [];
        }
    }

    /**
     * Récupérer toutes les valeurs pour une combinaison identifiant_base + sous_caracteristique
     * @param identifiant_base Ex: "caracteristiques_vehicule"
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
            console.error('[AutocompleteHistoryService] Erreur récupération valeurs:', error);
            return [];
        }
    }

    /**
     * Insérer ou mettre à jour une caractéristique autocomplete
     * @param identifiant_base Ex: "caracteristiques_vehicule"
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
            const response = await apiCall<{
                success: boolean;
                id: number;
                message: string;
            }>('/api/autocomplete/upsert', {
                method: 'POST',
                body: JSON.stringify({
                    identifiant_base,
                    sous_caracteristique,
                    valeur,
                    origine_champs,
                    user_id,
                    service_id,
                }),
            });

            if (response.success && response.data?.id) {
                return response.data.id;
            }

            return null;
        } catch (error) {
            console.error('[AutocompleteHistoryService] Erreur upsert caractéristique:', error);
            return null;
        }
    }

    /**
     * Historiser un champ autocomplete complet
     * Découpe les valeurs concaténées et historise chaque sous-caractéristique
     * @param identifiant_base Ex: "caracteristiques_vehicule"
     * @param valeurs Tableau de valeurs concaténées Ex: ["Toyota,RAV4,2018,4x4"]
     * @param separateur Séparateur utilisé (défaut: ",")
     * @param sous_caracteristiques Objet avec les noms des sous-caractéristiques
     * @param origine_champs "ia" ou "utilisateur"
     * @param user_id ID de l'utilisateur (optionnel)
     * @param service_id ID du service (optionnel)
     */
    async historizeField(
        identifiant_base: string,
        valeurs: string[],
        separateur: string,
        sous_caracteristiques: Record<string, string[]>,
        origine_champs: 'ia' | 'utilisateur' = 'utilisateur',
        user_id?: number,
        service_id?: number
    ): Promise<number[]> {
        try {
            const response = await apiCall<{
                success: boolean;
                ids: number[];
                count: number;
                message: string;
            }>('/api/autocomplete/historize', {
                method: 'POST',
                body: JSON.stringify({
                    identifiant_base,
                    valeurs,
                    separateur,
                    sous_caracteristiques,
                    origine_champs,
                    user_id,
                    service_id,
                }),
            });

            if (response.success && Array.isArray(response.data?.ids)) {
                return response.data.ids;
            }

            return [];
        } catch (error) {
            console.error('[AutocompleteHistoryService] Erreur historisation:', error);
            return [];
        }
    }

    /**
     * Historiser automatiquement un champ autocomplete depuis les données d'un produit
     * Cette fonction est appelée lors de la création d'un produit pour enrichir l'historique
     * @param fieldData Données du champ autocomplete depuis le formulaire
     * @param user_id ID de l'utilisateur (optionnel)
     * @param service_id ID du service (optionnel)
     */
    async historizeFromFieldData(
        fieldData: {
            identifiant_base?: string;
            valeur?: string[] | string;
            separateur?: string;
            sous_caracteristiques?: Record<string, string[]>;
            origine_champs?: string;
        },
        user_id?: number,
        service_id?: number
    ): Promise<void> {
        try {
            // Vérifier que c'est bien un champ autocomplete
            if (!fieldData.identifiant_base || !fieldData.sous_caracteristiques) {
                return;
            }

            // Normaliser les valeurs
            const valeurs = Array.isArray(fieldData.valeur)
                ? fieldData.valeur
                : fieldData.valeur
                    ? [fieldData.valeur]
                    : [];

            if (valeurs.length === 0) {
                return;
            }

            const separateur = fieldData.separateur || ',';
            const origine_champs = (fieldData.origine_champs as 'ia' | 'utilisateur') || 'utilisateur';

            // Historiser le champ complet
            await this.historizeField(
                fieldData.identifiant_base,
                valeurs,
                separateur,
                fieldData.sous_caracteristiques,
                origine_champs,
                user_id,
                service_id
            );

            console.log(
                `[AutocompleteHistoryService] ✅ Champ historisé: ${fieldData.identifiant_base} (${valeurs.length} valeurs)`
            );
        } catch (error) {
            console.error('[AutocompleteHistoryService] Erreur historisation depuis fieldData:', error);
        }
    }
}

export const autocompleteHistoryService = new AutocompleteHistoryService();

