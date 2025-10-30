import { getToutesLesVilles, rechercherVilles } from '../data/africanLocations';
import { getFieldOptions } from '../data/productModalities';
import { apiGet } from './api';

export type PlaceScope = 'city' | 'point';

class PlacesService {
    /**
     * Autocomplete intelligent pour villes et lieux
     * - Essaie d'abord le backend Google Maps API
     * - Fallback sur la base locale (TOUS les pays d'Afrique francophone)
     */
    async autocomplete(query: string, scope: PlaceScope = 'city', cityContext?: string): Promise<string[]> {
        const q = (query || '').trim();
        const results: string[] = [];

        // ✅ PRIORITÉ 1: Backend Google Maps API
        try {
            const params = encodeURI(q);
            const url = scope === 'city'
                ? `/api/places/autocomplete?query=${params}&type=city`
                : `/api/places/autocomplete?query=${params}&type=point${cityContext ? `&city=${encodeURIComponent(cityContext)}` : ''}`;

            const response = await apiGet<{ success: boolean; data?: string[] }>(url);
            if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                results.push(...response.data);
            }
        } catch (_err) {
            // Fallback ci-dessous
        }

        // ✅ PRIORITÉ 2: Base de données locale (AFRIQUE FRANCOPHONE COMPLÈTE)
        if (scope === 'city') {
            // Recherche intelligente dans TOUS les pays d'Afrique francophone
            if (q.length > 0) {
                const villesRecherchees = rechercherVilles(q);
                const nomsVilles = villesRecherchees.map(v => `${v.pays} - ${v.nom}`);
                results.push(...nomsVilles);
            } else {
                // Sans recherche, retourner toutes les villes (limitées)
                const toutesVilles = getToutesLesVilles();
                const nomsVilles = toutesVilles.slice(0, 50).map(v => `${v.pays} - ${v.nom}`);
                results.push(...nomsVilles);
            }
        } else {
            // Points de départ/arrivée depuis modalités covoiturage
            const pointsDepart = getFieldOptions('covoiturage', 'points_depart') || [];
            const pointsArrivee = getFieldOptions('covoiturage', 'points_arrivee') || [];
            const points = Array.from(new Set([...pointsDepart, ...pointsArrivee]));
            const filtered = q ? points.filter(p => p.toLowerCase().includes(q.toLowerCase())) : points;
            results.push(...filtered);
        }

        // ✅ Dédupliquer en conservant l'ordre (backend prioritaire)
        const seen = new Set<string>();
        const unique = results.filter(item => {
            const key = item.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return unique.slice(0, 30); // Limiter à 30 résultats
    }
}

export const placesService = new PlacesService();


