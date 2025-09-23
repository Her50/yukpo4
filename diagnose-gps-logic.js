// diagnose-gps-logic.js
// Diagnostic complet de la logique GPS de l'application

console.log('🔍 Diagnostic complet de la logique GPS de l\'application\n');

// 1. ANALYSE DE LA LOGIQUE ACTUELLE
console.log('📋 LOGIQUE ACTUELLE IDENTIFIÉE:');
console.log('1. Priorité 1: gps_fixe du service (si défini)');
console.log('2. Priorité 2: GPS du créateur du service');
console.log('3. Priorité 3: Adresse textuelle du service');
console.log('4. Priorité 4: Position courante de l\'utilisateur (SUPPRIMÉE!)');
console.log('5. Fallback: "Localisation non disponible"');

console.log('\n❌ PROBLÈMES IDENTIFIÉS:');
console.log('1. La position courante de l\'utilisateur est supprimée (getCurrentUserLocation retourne null)');
console.log('2. Les coordonnées Nigeria par défaut sont prioritaires même si l\'utilisateur a choisi des coordonnées');
console.log('3. Pas de vérification si les coordonnées gps_fixe sont valides vs par défaut');

console.log('\n🎯 LOGIQUE ATTENDUE SELON VOS SPÉCIFICATIONS:');
console.log('1. Priorité 1: gps_fixe du service (SI l\'utilisateur a choisi des coordonnées valides)');
console.log('2. Priorité 2: Position courante de l\'utilisateur (par défaut)');
console.log('3. Priorité 3: GPS du créateur du service');
console.log('4. Priorité 4: Adresse textuelle du service');
console.log('5. Fallback: "Localisation non disponible"');

// 2. SIMULATION DE LA LOGIQUE CORRIGÉE
console.log('\n🧪 SIMULATION DE LA LOGIQUE CORRIGÉE:\n');

// Fonction pour détecter les coordonnées Nigeria par défaut
function isNigeriaDefaultCoords(lat, lng) {
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

    return false;
}

// Fonction pour obtenir la position courante de l'utilisateur
async function getCurrentUserLocation() {
    console.log('🌍 Tentative d\'obtention de la position courante...');

    // Simulation de l'obtention de la position GPS
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simuler une position à Douala
            const currentPos = '4.0511,9.7679'; // Douala, Cameroun
            console.log(`📍 Position courante simulée: ${currentPos}`);
            resolve(currentPos);
        }, 1000);
    });
}

// Fonction pour extraire la valeur d'un champ
function getServiceFieldValue(field) {
    if (!field) return 'Non spécifié';

    if (typeof field === 'string') return field;

    if (field && typeof field === 'object' && field.valeur !== undefined) {
        return field.valeur;
    }

    return 'Non spécifié';
}

// Fonction formatLocation CORRIGÉE selon vos spécifications
async function formatLocationCorrected(service, prestatairesMap, currentUser) {
    console.log('🏠 [formatLocationCorrected] Début avec service:', service?.id);

    // 1. Priorité: gps_fixe du service (SI coordonnées valides choisies par l'utilisateur)
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié' && gpsFixe.includes(',')) {
            const coords = gpsFixe.split(',').map(coord => parseFloat(coord.trim()));
            if (coords.length === 2 && !coords.some(isNaN)) {
                const [lat, lng] = coords;

                // Vérifier si ce sont des coordonnées Nigeria par défaut
                if (!isNigeriaDefaultCoords(lat, lng)) {
                    console.log(`✅ Coordonnées gps_fixe valides choisies par l'utilisateur: ${gpsFixe}`);
                    return `Coordonnées choisies: ${gpsFixe}`;
                } else {
                    console.log('🚫 Coordonnées Nigeria par défaut détectées, ignorées');
                }
            }
        }
    }

    // 2. Priorité: Position courante de l'utilisateur (par défaut)
    console.log('🌍 Tentative d\'obtention de la position courante...');
    try {
        const currentLocation = await getCurrentUserLocation();
        if (currentLocation) {
            console.log(`✅ Utilisation de la position courante: ${currentLocation}`);
            return `Position courante: ${currentLocation}`;
        }
    } catch (error) {
        console.log('❌ Erreur obtention position courante:', error.message);
    }

    // 3. Priorité: GPS du créateur du service
    if (service?.user_id && prestatairesMap.has(service.user_id)) {
        const prestataire = prestatairesMap.get(service.user_id);
        if (prestataire?.gps && prestataire.gps !== 'Non spécifié') {
            console.log(`👤 GPS du créateur: ${prestataire.gps}`);
            return `GPS créateur: ${prestataire.gps}`;
        }
    }

    // 4. Priorité: Adresse textuelle
    if (service?.data?.adresse) {
        const adresse = getServiceFieldValue(service.data.adresse);
        if (adresse && adresse !== 'Non spécifié') {
            console.log(`🏠 Adresse textuelle: ${adresse}`);
            return `Adresse: ${adresse}`;
        }
    }

    // 5. Fallback
    console.log('⚠️ Aucune localisation valide trouvée');
    return 'Localisation non disponible';
}

// 3. TESTS DE LA LOGIQUE CORRIGÉE
async function testCorrectedLogic() {
    console.log('🧪 TESTS DE LA LOGIQUE CORRIGÉE:\n');

    // Test 1: Service avec coordonnées Nigeria par défaut
    console.log('📋 TEST 1: Service avec coordonnées Nigeria par défaut');
    const service1 = {
        id: 1,
        data: {
            gps_fixe: { valeur: '9.818276,4.033640' }, // Nigeria par défaut
            adresse: { valeur: 'Douala, Cameroun' }
        }
    };

    const result1 = await formatLocationCorrected(service1, new Map(), null);
    console.log(`🎯 Résultat: ${result1}\n`);

    // Test 2: Service avec coordonnées valides choisies par l'utilisateur
    console.log('📋 TEST 2: Service avec coordonnées valides choisies');
    const service2 = {
        id: 2,
        data: {
            gps_fixe: { valeur: '4.0511,9.7679' }, // Douala (valide)
            adresse: { valeur: 'Yaoundé, Cameroun' }
        }
    };

    const result2 = await formatLocationCorrected(service2, new Map(), null);
    console.log(`🎯 Résultat: ${result2}\n`);

    // Test 3: Service sans gps_fixe valide
    console.log('📋 TEST 3: Service sans gps_fixe valide');
    const service3 = {
        id: 3,
        data: {
            adresse: { valeur: 'Yaoundé, Cameroun' }
        }
    };

    const result3 = await formatLocationCorrected(service3, new Map(), null);
    console.log(`🎯 Résultat: ${result3}\n`);
}

// Exécuter les tests
testCorrectedLogic().catch(console.error);


