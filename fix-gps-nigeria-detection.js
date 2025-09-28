// fix-gps-nigeria-detection.js
// Correction pour détecter et ignorer les coordonnées Nigeria par défaut

// Fonction pour détecter les coordonnées Nigeria par défaut
function isNigeriaDefaultCoords(lat, lng) {
    // Coordonnées exactes du Nigeria par défaut
    const nigeriaCoords = [
        { lat: 9.818276, lng: 4.033640 },
        { lat: 9.818119, lng: 4.033687 },
        // Ajouter d'autres coordonnées Nigeria par défaut si nécessaire
    ];

    // Vérifier avec une tolérance de 0.001
    const tolerance = 0.001;

    for (const coord of nigeriaCoords) {
        if (Math.abs(lat - coord.lat) < tolerance && Math.abs(lng - coord.lng) < tolerance) {
            return true;
        }
    }

    // Vérifier aussi si c'est dans la zone générale du Nigeria
    // Latitude: 4-14, Longitude: 3-15 (zone approximative du Nigeria)
    if (lat >= 4 && lat <= 14 && lng >= 3 && lng <= 15) {
        // Vérifier si c'est dans une zone spécifique connue pour être par défaut
        if (lat >= 9.5 && lat <= 10.5 && lng >= 3.5 && lng <= 4.5) {
            return true;
        }
    }

    return false;
}

// Fonction convertGpsToLocation corrigée
async function convertGpsToLocationFixed(gpsString) {
    console.log(`📍 [convertGpsToLocationFixed] Traitement: ${gpsString}`);

    if (!gpsString || !gpsString.includes(',')) {
        console.log('❌ Format GPS invalide');
        return gpsString;
    }

    try {
        const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length !== 2 || coords.some(isNaN)) {
            console.log('❌ Coordonnées GPS invalides');
            return gpsString;
        }

        const [lat, lng] = coords;
        console.log(`✅ Coordonnées extraites: lat=${lat}, lng=${lng}`);

        // 🚨 CORRECTION: Détecter les coordonnées Nigeria par défaut
        if (isNigeriaDefaultCoords(lat, lng)) {
            console.log('🚫 Coordonnées Nigeria par défaut détectées, ignorées');
            return null; // Retourner null pour indiquer qu'il faut ignorer ces coordonnées
        }

        // Simuler l'appel à l'API de géocodage (votre vraie API)
        console.log('🌍 Géocodage des coordonnées...');
        const mockApiResponse = {
            formatted_address: `Localisation réelle pour ${lat}, ${lng}`,
        };

        return mockApiResponse.formatted_address;

    } catch (error) {
        console.error('❌ Erreur:', error);
        return gpsString;
    }
}

// Fonction formatLocation corrigée
async function formatLocationFixed(service, prestatairesMap, currentUser) {
    console.log('🏠 [formatLocationFixed] Début avec service:', service?.id);

    // 1. Priorité: gps_fixe (lieu fixe du service) - AVEC DÉTECTION NIGERIA
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié') {
            if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
                console.log('🔄 Géocodage des coordonnées gps_fixe...');
                const location = await convertGpsToLocationFixed(gpsFixe);

                // Si les coordonnées Nigeria sont détectées, ignorer et passer au suivant
                if (location === null) {
                    console.log('🚫 Coordonnées Nigeria ignorées, passage à l\'adresse');
                } else {
                    console.log(`✅ Localisation GPS: ${location}`);
                    return location;
                }
            } else {
                console.log(`✅ Localisation textuelle: ${gpsFixe}`);
                return gpsFixe;
            }
        }
    }

    // 2. Priorité: adresse textuelle
    if (service?.data?.adresse) {
        const adresse = getServiceFieldValue(service.data.adresse);
        console.log(`🏠 adresse trouvée: ${adresse}`);
        if (adresse && adresse !== 'Non spécifié') {
            console.log(`✅ Utilisation de l'adresse: ${adresse}`);
            return adresse;
        }
    }

    // 3. Priorité: gps du créateur du service
    if (service?.user_id && prestatairesMap.has(service.user_id)) {
        const prestataire = prestatairesMap.get(service.user_id);
        if (prestataire?.gps && prestataire.gps !== 'Non spécifié') {
            console.log(`👤 GPS du créateur: ${prestataire.gps}`);

            if (typeof prestataire.gps === 'string' && prestataire.gps.includes(',')) {
                const location = await convertGpsToLocationFixed(prestataire.gps);
                if (location !== null) {
                    console.log(`✅ Localisation créateur: ${location}`);
                    return location;
                }
            } else {
                console.log(`✅ Localisation créateur textuelle: ${prestataire.gps}`);
                return prestataire.gps;
            }
        }
    }

    // 4. Fallback
    console.log('⚠️ Aucune localisation valide trouvée');
    return 'Localisation non disponible';
}

// Fonction pour extraire la valeur d'un champ (inchangée)
function getServiceFieldValue(field) {
    if (!field) return 'Non spécifié';

    if (typeof field === 'string') return field;

    if (field && typeof field === 'object' && field.valeur !== undefined) {
        const value = field.valeur;
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'number') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    }

    return 'Non spécifié';
}

// Test de la correction
async function testGpsFix() {
    console.log('🧪 Test de la correction GPS\n');

    const testService = {
        id: 1,
        data: {
            gps_fixe: {
                type_donnee: 'gps',
                valeur: '9.818276,4.033640', // Coordonnées Nigeria par défaut
                origine_champs: 'ia'
            },
            adresse: {
                type_donnee: 'adresse',
                valeur: 'Douala, Cameroun', // Vraie adresse
                origine_champs: 'utilisateur'
            }
        }
    };

    const prestatairesMap = new Map();
    const currentUser = null;

    console.log('📋 Test avec:');
    console.log('- gps_fixe: 9.818276,4.033640 (Nigeria par défaut)');
    console.log('- adresse: Douala, Cameroun (vraie adresse)');

    const result = await formatLocationFixed(testService, prestatairesMap, currentUser);

    console.log(`\n🎯 Résultat final: "${result}"`);

    if (result === 'Douala, Cameroun') {
        console.log('\n✅ CORRECTION RÉUSSIE: L\'adresse réelle est maintenant utilisée !');
    } else if (result.includes('Nigeria') || result.includes('Worumokato')) {
        console.log('\n❌ PROBLÈME PERSISTANT: Les coordonnées Nigeria sont toujours prioritaires');
    } else {
        console.log('\n⚠️ Résultat inattendu');
    }
}

// Exécuter le test
testGpsFix().catch(console.error);







