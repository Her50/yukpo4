import { getToutesLesVilles, rechercherVilles, TOUS_LES_PAYS } from '../data/africanLocations';
import { getFieldOptions } from '../data/productModalities';
import { apiGet } from './api';

export type PlaceScope = 'city' | 'point' | 'neighborhood' | 'establishment' | 'all'; // ✅ AJOUT: Support des quartiers, établissements et 'all' pour recherche universelle

// ✅ NOUVEAU: Interface pour résultats enrichis avec types Google Places
export interface PlaceResult {
    description: string;
    place_id?: string;
    types?: string[]; // Types retournés par Google Places API
}

class PlacesService {
    /**
     * Autocomplete intelligent pour villes, quartiers, pays et lieux (format enrichi avec types)
     * - Essaie d'abord le backend Google Maps API
     * - Fallback sur la base locale (TOUS les pays d'Afrique francophone)
     * - Si scope est undefined ou 'all', recherche universelle (tous les types géographiques)
     * - Retourne les résultats avec types Google Places pour éviter le hardcodage
     */
    async autocompleteEnriched(query: string, scope?: PlaceScope, cityContext?: string): Promise<PlaceResult[]> {
        const q = (query || '').trim();
        const results: PlaceResult[] = [];

        // ✅ PRIORITÉ 1: Backend Google Maps API
        try {
            const params = encodeURI(q);
            let url: string;
            if (!scope) {
                url = `/api/places/autocomplete?query=${params}`;
            } else if (scope === 'city') {
                url = `/api/places/autocomplete?query=${params}&type=city`;
            } else if (scope === 'neighborhood') {
                url = `/api/places/autocomplete?query=${params}&type=neighborhood${cityContext ? `&city=${encodeURIComponent(cityContext)}` : ''}`;
            } else if (scope === 'establishment') {
                url = `/api/places/autocomplete?query=${params}&type=establishment${cityContext ? `&city=${encodeURIComponent(cityContext)}` : ''}`;
            } else {
                url = `/api/places/autocomplete?query=${params}&type=point${cityContext ? `&city=${encodeURIComponent(cityContext)}` : ''}`;
            }

            const response = await apiGet<{
                success: boolean;
                data?: string[];
                results?: PlaceResult[];
            }>(url);

            // ✅ FIX 2026-03-03: apiGet retourne { success, data: <backend_json> }
            // Le backend retourne { success, data: string[], results: PlaceResult[] }
            const backendResp = response.data as any;
            if (response.success && backendResp?.success) {
                // ✅ PRIORITÉ: Utiliser les résultats enrichis avec types si disponibles
                if (backendResp.results && Array.isArray(backendResp.results) && backendResp.results.length > 0) {
                    results.push(...backendResp.results);
                } else if (Array.isArray(backendResp.data) && backendResp.data.length > 0) {
                    // Fallback: convertir les strings en PlaceResult sans types
                    results.push(...backendResp.data.map((desc: string) => ({ description: desc })));
                }
            }
        } catch (_err) {
            // Fallback ci-dessous
        }

        // ✅ PRIORITÉ 2: Base de données locale (sans types Google, donc sans types)
        if (!scope || scope === 'all') {
            if (q.length > 0) {
                const qLower = q.toLowerCase();

                const paysMatches = TOUS_LES_PAYS.filter(p =>
                    p.nom.toLowerCase().includes(qLower) ||
                    p.nomComplet.toLowerCase().includes(qLower) ||
                    p.code.toLowerCase().includes(qLower)
                );
                paysMatches.forEach(pays => {
                    results.push({
                        description: pays.nom,
                        types: ['country', 'political'] // Types déduits pour pays
                    });
                });

                const villesRecherchees = rechercherVilles(q);
                villesRecherchees.forEach(v => {
                    results.push({
                        description: `${v.pays} - ${v.nom}`,
                        types: ['locality', 'political'] // Types déduits pour villes
                    });
                });

                TOUS_LES_PAYS.forEach(pays => {
                    pays.villes.forEach(ville => {
                        if (ville.quartiers) {
                            const quartiersMatches = ville.quartiers.filter(quartier =>
                                quartier.toLowerCase().includes(qLower)
                            );
                            quartiersMatches.forEach(quartier => {
                                results.push({
                                    description: `${quartier}, ${ville.nom}, ${pays.nom}`,
                                    types: ['sublocality', 'sublocality_level_1'] // Types déduits pour quartiers
                                });
                            });
                        }
                    });
                });
            } else {
                TOUS_LES_PAYS.forEach(pays => {
                    results.push({
                        description: pays.nom,
                        types: ['country', 'political']
                    });
                });

                const toutesVilles = getToutesLesVilles();
                toutesVilles.slice(0, 30).forEach(v => {
                    results.push({
                        description: `${v.pays} - ${v.nom}`,
                        types: ['locality', 'political']
                    });
                });
            }
        } else if (scope === 'city') {
            if (q.length > 0) {
                const villesRecherchees = rechercherVilles(q);
                villesRecherchees.forEach(v => {
                    results.push({
                        description: `${v.pays} - ${v.nom}`,
                        types: ['locality', 'political']
                    });
                });
            } else {
                const toutesVilles = getToutesLesVilles();
                toutesVilles.slice(0, 50).forEach(v => {
                    results.push({
                        description: `${v.pays} - ${v.nom}`,
                        types: ['locality', 'political']
                    });
                });
            }
        } else if (scope === 'neighborhood') {
            if (q.length > 0) {
                TOUS_LES_PAYS.forEach(pays => {
                    pays.villes.forEach(ville => {
                        if (cityContext && !ville.nom.toLowerCase().includes(cityContext.toLowerCase())) {
                            return;
                        }
                        if (ville.quartiers) {
                            const quartiersMatches = ville.quartiers.filter(quartier =>
                                quartier.toLowerCase().includes(q.toLowerCase())
                            );
                            quartiersMatches.forEach(quartier => {
                                results.push({
                                    description: `${quartier}, ${ville.nom}, ${pays.nom}`,
                                    types: ['sublocality', 'sublocality_level_1']
                                });
                            });
                        }
                    });
                });
            } else if (cityContext) {
                TOUS_LES_PAYS.forEach(pays => {
                    const ville = pays.villes.find(v =>
                        v.nom.toLowerCase().includes(cityContext.toLowerCase())
                    );
                    if (ville && ville.quartiers) {
                        ville.quartiers.forEach(quartier => {
                            results.push({
                                description: `${quartier}, ${ville.nom}, ${pays.nom}`,
                                types: ['sublocality', 'sublocality_level_1']
                            });
                        });
                    }
                });
            }
        } else if (scope === 'point') {
            const pointsDepart = getFieldOptions('covoiturage', 'points_depart') || [];
            const pointsArrivee = getFieldOptions('covoiturage', 'points_arrivee') || [];
            const points = Array.from(new Set([...pointsDepart, ...pointsArrivee]));
            const filtered = q ? points.filter(p => p.toLowerCase().includes(q.toLowerCase())) : points;
            filtered.forEach(p => {
                results.push({
                    description: p,
                    types: ['establishment'] // Type déduit pour points
                });
            });
        } else if (scope === 'establishment') {
            // ✅ NOUVEAU 2026-01-23: Support pour recherche d'établissements
            // Utiliser les mêmes points que 'point' mais avec un focus sur les établissements
            const pointsDepart = getFieldOptions('covoiturage', 'points_depart') || [];
            const pointsArrivee = getFieldOptions('covoiturage', 'points_arrivee') || [];
            const points = Array.from(new Set([...pointsDepart, ...pointsArrivee]));
            const filtered = q ? points.filter(p => p.toLowerCase().includes(q.toLowerCase())) : points;
            filtered.forEach(p => {
                results.push({
                    description: p,
                    types: ['establishment']
                });
            });
        }

        // Dédupliquer en conservant l'ordre
        const seen = new Set<string>();
        const unique = results.filter(item => {
            const key = item.description.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return unique.slice(0, 30);
    }

    /**
     * Autocomplete intelligent (format simple string pour compatibilité)
     * @deprecated Utiliser autocompleteEnriched pour obtenir les types Google Places
     */
    async autocomplete(query: string, scope?: PlaceScope, cityContext?: string): Promise<string[]> {
        // Utiliser la méthode enrichie et extraire seulement les descriptions
        const enriched = await this.autocompleteEnriched(query, scope, cityContext);
        return enriched.map(r => r.description);
    }
}

export const placesService = new PlacesService();


