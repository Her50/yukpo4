/**
 * Extracteur de caractéristiques dynamiques
 * Analyse les produits pour extraire toutes les caractéristiques autocomplete disponibles
 */

/**
 * Extrait toutes les caractéristiques autocomplete disponibles des produits
 * @param products Liste des produits à analyser
 * @returns Map de caractéristiques avec leurs valeurs possibles
 */
export function extractAvailableCharacteristics(products: any[]): Record<string, Set<string>> {
    const characteristics: Record<string, Set<string>> = {};

    if (!Array.isArray(products) || products.length === 0) {
        return characteristics;
    }

    products.forEach(product => {
        // Source 1: Depuis le champ autocomplete du service
        const serviceData = product._service?.data || product.service?.data;
        const produitsField = serviceData?.produits;

        if (produitsField) {
            // Structure { sous_caracteristiques: { marque: [...], modele: [...] } }
            const sousCaracs = produitsField.sous_caracteristiques;

            if (sousCaracs && typeof sousCaracs === 'object') {
                Object.entries(sousCaracs).forEach(([key, values]) => {
                    if (!characteristics[key]) {
                        characteristics[key] = new Set();
                    }

                    // Ajouter toutes les valeurs disponibles
                    if (Array.isArray(values)) {
                        values.forEach(val => {
                            if (val && typeof val === 'string') {
                                characteristics[key].add(val);
                            }
                        });
                    }
                });
            }

            // Ajouter aussi les valeurs concrètes du produit actuel
            const valeursConcatenees = produitsField.valeur;
            const separateur = produitsField.separateur || ',';

            if (Array.isArray(valeursConcatenees)) {
                valeursConcatenees.forEach(modalite => {
                    if (typeof modalite === 'string') {
                        const parts = modalite.split(separateur).map(p => p.trim());
                        const keys = Object.keys(sousCaracs || {});

                        parts.forEach((value, index) => {
                            const key = keys[index];
                            if (key && value) {
                                if (!characteristics[key]) {
                                    characteristics[key] = new Set();
                                }
                                characteristics[key].add(value);
                            }
                        });
                    }
                });
            }
        }

        // Source 2: Depuis les champs directs du produit (fallback)
        // Pour compatibilité avec produits sans autocomplete
        const commonFields = [
            'marque', 'modele', 'couleur', 'taille', 'pointure',
            'matiere', 'style', 'etat', 'type', 'version'
        ];

        commonFields.forEach(field => {
            const value = product[field];
            if (value && typeof value === 'string') {
                if (!characteristics[field]) {
                    characteristics[field] = new Set();
                }
                characteristics[field].add(value);
            }
        });
    });

    return characteristics;
}

/**
 * Filtre les produits selon les filtres autocomplete sélectionnés
 * @param products Liste des produits
 * @param filters Filtres sélectionnés { marque: ['Toyota'], couleur: ['Noir'] }
 * @returns Produits filtrés
 */
export function filterProductsByAutocomplete(products: any[], filters: Record<string, string[]>): any[] {
    if (!filters || Object.keys(filters).length === 0) {
        return products;
    }

    return products.filter(product => {
        // Vérifier chaque filtre
        for (const [charKey, selectedValues] of Object.entries(filters)) {
            if (!selectedValues || selectedValues.length === 0) {
                continue;
            }

            let hasMatch = false;

            // Chercher dans le champ autocomplete du service
            const serviceData = product._service?.data || product.service?.data;
            const produitsField = serviceData?.produits;

            if (produitsField) {
                const valeursConcatenees = produitsField.valeur;
                const separateur = produitsField.separateur || ',';
                const sousCaracs = produitsField.sous_caracteristiques;
                const keys = Object.keys(sousCaracs || {});
                const charIndex = keys.indexOf(charKey);

                if (charIndex >= 0 && Array.isArray(valeursConcatenees)) {
                    // Vérifier chaque modalité du produit
                    valeursConcatenees.forEach(modalite => {
                        if (typeof modalite === 'string') {
                            const parts = modalite.split(separateur).map(p => p.trim());
                            const productValue = parts[charIndex];

                            // Si la valeur du produit correspond à une valeur filtrée
                            if (productValue && selectedValues.includes(productValue)) {
                                hasMatch = true;
                            }
                        }
                    });
                }
            }

            // Fallback: Chercher dans les champs directs du produit
            if (!hasMatch) {
                const productValue = product[charKey];
                if (productValue && selectedValues.includes(productValue)) {
                    hasMatch = true;
                }
            }

            // Si aucune correspondance trouvée pour ce filtre, exclure le produit
            if (!hasMatch) {
                return false;
            }
        }

        // Tous les filtres correspondent
        return true;
    });
}

/**
 * Filtre les produits par proximité GPS
 * @param products Liste des produits
 * @param targetLat Latitude cible (null = pas de filtre)
 * @param targetLon Longitude cible (null = pas de filtre)
 * @param radiusKm Rayon en km (null = pas de limite)
 * @param calculateDistance Fonction de calcul de distance
 * @returns Produits filtrés avec distance ajoutée
 */
export function filterProductsByProximity(
    products: any[],
    targetLat: number | null,
    targetLon: number | null,
    radiusKm: number | null,
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number
): any[] {
    // Si pas de coordonnées cibles, retourner tous les produits sans filtrage
    if (targetLat === null || targetLon === null) {
        return products;
    }

    return products
        .map(product => {
            // ✅ CORRIGÉ: Récupérer le GPS avec priorité et fallback complet
            // Priorité 1: GPS direct du produit
            // Priorité 2: GPS fixe du service (gps_fixe peut être objet {valeur: "..."} ou string directe)
            // Priorité 3: GPS courant du service (position actuelle du vendeur)
            // Priorité 4: GPS de l'utilisateur créateur (fallback ultime)
            
            let gps: string | null | undefined = null;
            
            // 1. GPS direct du produit
            if (product.gps && typeof product.gps === 'string' && product.gps.trim() !== '') {
                gps = product.gps;
            }
            
            // 2. GPS fixe du service (priorité sur GPS courant)
            if (!gps) {
                const service = product._service || product.service;
                if (service?.data?.gps_fixe) {
                    const gpsFixe = service.data.gps_fixe;
                    // Cas 1: Objet avec structure {valeur: "...", type_donnee: "..."}
                    if (typeof gpsFixe === 'object' && gpsFixe !== null && 'valeur' in gpsFixe) {
                        const valeur = gpsFixe.valeur;
                        if (valeur && typeof valeur === 'string' && valeur.trim() !== '' && valeur !== 'false') {
                            gps = valeur;
                        }
                    }
                    // Cas 2: String directe
                    else if (typeof gpsFixe === 'string' && gpsFixe.trim() !== '' && gpsFixe !== 'false') {
                        gps = gpsFixe;
                    }
                }
            }
            
            // 3. GPS courant du service (position actuelle du vendeur)
            if (!gps) {
                const service = product._service || product.service;
                if (service?.gps && typeof service.gps === 'string' && service.gps.trim() !== '' && service.gps !== 'false') {
                    gps = service.gps;
                }
            }
            
            // 4. GPS de l'utilisateur créateur (fallback ultime)
            if (!gps) {
                const service = product._service || product.service;
                const prestataire = product._prestataire || product.prestataire;
                if (prestataire?.gps && typeof prestataire.gps === 'string' && prestataire.gps.trim() !== '' && prestataire.gps !== 'false') {
                    gps = prestataire.gps;
                }
            }

            if (!gps) {
                // Pas de GPS : garder le produit mais avec distance infinie
                return { ...product, distance: Infinity };
            }

            // Parser le GPS
            const coords = parseGPS(gps);
            if (!coords) {
                return { ...product, distance: Infinity };
            }

            // Calculer la distance
            const distance = calculateDistance(targetLat, targetLon, coords.lat, coords.lon);

            // Retourner le produit avec sa distance
            return { ...product, distance };
        })
        .filter(product => {
            // Si pas de rayon limite, garder tous les produits
            if (radiusKm === null) {
                return true;
            }

            // ✅ CORRIGÉ: Garder les produits sans GPS (distance Infinity) pour ne pas les exclure
            // Sinon, filtrer par rayon uniquement pour les produits avec GPS valide
            if (product.distance === Infinity || product.distance === undefined) {
                return true; // Garder les produits sans GPS
            }

            // Filtrer par rayon uniquement pour les produits avec GPS valide
            return product.distance <= radiusKm;
        });
}

/**
 * Parse une chaîne GPS en coordonnées
 * Formats supportés: "lat,lon" ou "POINT(lon lat)"
 */
function parseGPS(gps: string | null | undefined): { lat: number, lon: number } | null {
    if (!gps || typeof gps !== 'string') {
        return null;
    }

    // Format "lat,lon"
    if (gps.includes(',')) {
        const parts = gps.split(',');
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0].trim());
            const lon = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lon)) {
                return { lat, lon };
            }
        }
    }

    // Format "POINT(lon lat)" (PostGIS)
    const pointMatch = gps.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
        const lon = parseFloat(pointMatch[1]);
        const lat = parseFloat(pointMatch[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
            return { lat, lon };
        }
    }

    return null;
}

export default {
    extractAvailableCharacteristics,
    filterProductsByAutocomplete,
    filterProductsByProximity,
};

