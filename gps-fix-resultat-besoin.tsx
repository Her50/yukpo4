// gps-fix-resultat-besoin.tsx
// Corrections GPS pour ResultatBesoin_clean.tsx

// Fonction pour détecter les coordonnées Nigeria par défaut
const isNigeriaDefaultCoords = (lat: number, lng: number): boolean => {
    const nigeriaCoords = [
        { lat: 9.818276, lng: 4.033640 },
        { lat: 9.818119, lng: 4.033687 },
    ];

    const tolerance = 0.001;

    for (const coord of nigeriaCoords) {
        if (Math.abs(lat - coord.lat) < tolerance && Math.abs(lng - coord.lng) < tolerance) {
            return true;
        }
    }

    // Zone générale du Nigeria par défaut
    if (lat >= 9.5 && lat <= 10.5 && lng >= 3.5 && lng <= 4.5) {
        return true;
    }

    return false;
};

// Fonction pour obtenir la position courante de l'utilisateur
const getCurrentUserLocation = async (): Promise<string | null> => {
    console.log('🌍 [getCurrentUserLocation] Tentative d\'obtention de la position courante...');

    if (!navigator.geolocation) {
        console.warn('⚠️ [getCurrentUserLocation] Géolocalisation non supportée');
        return null;
    }

    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes de cache
                }
            );
        });

        const coords = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
        console.log(`📍 [getCurrentUserLocation] Position courante obtenue: ${coords}`);
        return coords;

    } catch (error) {
        console.warn('⚠️ [getCurrentUserLocation] Erreur obtention position courante:', error);
        return null;
    }
};

// Fonction formatLocation CORRIGÉE selon vos spécifications
const formatLocation = async (service: any, prestatairesMap: Map<number, any>, currentUser: any): Promise<string> => {
    console.log('🏠 [formatLocation] Début avec service:', service?.id);

    // 1. PRIORITÉ 1: gps_fixe du service (SI coordonnées valides choisies par l'utilisateur)
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 [formatLocation] gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié' && gpsFixe.includes(',')) {
            const coords = gpsFixe.split(',').map((coord: string) => parseFloat(coord.trim()));
            if (coords.length === 2 && !coords.some(isNaN)) {
                let lat, lng;
                if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
                else { lat = coords[1]; lng = coords[0]; }

                // Vérifier si ce sont des coordonnées Nigeria par défaut
                if (!isNigeriaDefaultCoords(lat, lng)) {
                    console.log('✅ [formatLocation] Coordonnées gps_fixe valides choisies par l\'utilisateur:', gpsFixe);
                    const location = await convertGpsToLocation(gpsFixe);
                    if (location) {
                        return location;
                    }
                } else {
                    console.log('🚫 [formatLocation] Coordonnées Nigeria par défaut détectées, ignorées');
                }
            }
        }
    }

    // 2. PRIORITÉ 2: Position courante de l'utilisateur (par défaut)
    console.log('🌍 [formatLocation] Tentative d\'obtention de la position courante...');
    try {
        const currentLocation = await getCurrentUserLocation();
        if (currentLocation) {
            console.log('✅ [formatLocation] Utilisation de la position courante:', currentLocation);
            const location = await convertGpsToLocation(currentLocation);
            if (location) {
                return location;
            }
        }
    } catch (error) {
        console.warn('⚠️ [formatLocation] Erreur obtention position courante:', error);
    }

    // 3. PRIORITÉ 3: GPS du créateur du service
    if (service?.user_id && prestatairesMap.has(service.user_id)) {
        const prestataire = prestatairesMap.get(service.user_id);
        if (prestataire?.gps && prestataire.gps !== 'Non spécifié') {
            console.log(`👤 [formatLocation] GPS du créateur: ${prestataire.gps}`);

            if (typeof prestataire.gps === 'string' && prestataire.gps.includes(',')) {
                const coords = prestataire.gps.split(',').map((coord: string) => parseFloat(coord.trim()));
                if (coords.length === 2 && !coords.some(isNaN)) {
                    let lat, lng;
                    if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
                    else { lat = coords[1]; lng = coords[0]; }

                    // Vérifier si ce ne sont pas des coordonnées Nigeria par défaut
                    if (!isNigeriaDefaultCoords(lat, lng)) {
                        const location = await convertGpsToLocation(prestataire.gps);
                        if (location) {
                            console.log(`✅ [formatLocation] Localisation créateur: ${location}`);
                            return location;
                        }
                    } else {
                        console.log('🚫 [formatLocation] GPS créateur Nigeria par défaut, ignoré');
                    }
                }
            } else {
                console.log(`✅ [formatLocation] Localisation créateur textuelle: ${prestataire.gps}`);
                return prestataire.gps;
            }
        }
    }

    // 4. PRIORITÉ 4: Adresse textuelle du service
    if (service?.data?.adresse) {
        const adresse = getServiceFieldValue(service.data.adresse);
        console.log('🏠 [formatLocation] Adresse du service:', adresse);
        if (adresse && adresse !== 'Non spécifié') {
            console.log('✅ [formatLocation] Utilisation de l\'adresse:', adresse);
            return adresse;
        }
    }

    // 5. FALLBACK
    console.log('⚠️ [formatLocation] Aucune localisation valide trouvée');
    return 'Localisation non disponible';
};

// Instructions d'application :
console.log(`
🔧 INSTRUCTIONS POUR APPLIQUER CES CORRECTIONS :

1. Ajouter ces fonctions au début de ResultatBesoin_clean.tsx :
   - isNigeriaDefaultCoords()
   - getCurrentUserLocation()

2. Remplacer toutes les fonctions formatLocation() existantes par la nouvelle version

3. Les fonctions convertGpsToLocation() existantes peuvent rester inchangées

4. Tester avec des coordonnées Nigeria par défaut pour vérifier qu'elles sont ignorées

✅ LOGIQUE CORRIGÉE :
1. gps_fixe (SI coordonnées valides choisies par l'utilisateur)
2. Position courante de l'utilisateur (par défaut)
3. GPS du créateur du service
4. Adresse textuelle du service
5. Fallback: Localisation non disponible
`);


















