// test-final-gps-logic.js
// Test final avec la logique GPS corrigée

console.log('🧪 TEST FINAL DE LA LOGIQUE GPS CORRIGÉE\n');

// Simulation des fonctions de l'application
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

    if (lat >= 9.5 && lat <= 10.5 && lng >= 3.5 && lng <= 4.5) {
        return true;
    }

    return false;
}

async function getCurrentUserLocation() {
    console.log('🌍 [SIMULATION] Récupération de la position courante...');
    return '4.0511,9.7679'; // Douala
}

async function convertGpsToLocation(gpsString) {
    console.log(`🔄 [SIMULATION] Géocodage de: ${gpsString}`);

    if (gpsString.includes('4.0511,9.7679')) return 'Douala, Cameroun';
    if (gpsString.includes('9.818276,4.033640')) return 'Worumokato, Nigeria';
    if (gpsString.includes('3.8480,11.5021')) return 'Yaoundé, Cameroun';
    if (gpsString.includes('10.3167,9.7167')) return 'Bamenda, Cameroun';

    return gpsString;
}

function getServiceFieldValue(field) {
    if (!field) return 'Non spécifié';
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object' && field.valeur !== undefined) {
        return field.valeur;
    }
    return 'Non spécifié';
}

// FONCTION formatLocation CORRIGÉE selon vos spécifications
async function formatLocation(service, prestatairesMap, currentUser) {
    console.log('🏠 [formatLocation] Début avec service:', service?.id);

    // 1. PRIORITÉ 1: gps_fixe du service (SI coordonnées valides choisies par l'utilisateur)
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 [formatLocation] gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié' && gpsFixe.includes(',')) {
            const coords = gpsFixe.split(',').map((coord) => parseFloat(coord.trim()));
            if (coords.length === 2 && !coords.some(isNaN)) {
                let lat, lng;
                if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
                else { lat = coords[1]; lng = coords[0]; }

                // Vérifier si ce sont des coordonnées Nigeria par défaut
                if (!isNigeriaDefaultCoords(lat, lng)) {
                    console.log('✅ [formatLocation] Coordonnées gps_fixe valides choisies par l\'utilisateur:', gpsFixe);
                    const result = await convertGpsToLocation(gpsFixe);
                    if (result && result !== 'Localisation non disponible') {
                        return result;
                    }
                } else {
                    console.log('🚫 [formatLocation] Coordonnées Nigeria par défaut détectées, ignorées');
                }
            }
        }
    }

    // 2. PRIORITÉ 2: Position courante de l'utilisateur (par défaut SI pas de gps_fixe valide)
    console.log('🌍 [formatLocation] Tentative d\'obtention de la position courante...');
    try {
        const currentLocation = await getCurrentUserLocation();
        if (currentLocation) {
            console.log('✅ [formatLocation] Utilisation de la position courante:', currentLocation);
            const result = await convertGpsToLocation(currentLocation);
            if (result && result !== 'Localisation non disponible') {
                return result;
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
                const coords = prestataire.gps.split(',').map((coord) => parseFloat(coord.trim()));
                if (coords.length === 2 && !coords.some(isNaN)) {
                    let lat, lng;
                    if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
                    else { lat = coords[1]; lng = coords[0]; }

                    if (!isNigeriaDefaultCoords(lat, lng)) {
                        const result = await convertGpsToLocation(prestataire.gps);
                        if (result) {
                            console.log(`✅ [formatLocation] Localisation créateur: ${result}`);
                            return result;
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
}

// Tests automatiques
async function runFinalTests() {
    console.log('🚀 DÉMARRAGE DES TESTS FINAUX\n');

    const tests = [
        {
            name: 'Service avec coordonnées Nigeria par défaut',
            description: 'Vérifier que les coordonnées Nigeria par défaut sont ignorées et que la position courante est utilisée',
            service: {
                id: 1,
                data: {
                    gps_fixe: { valeur: '9.818276,4.033640' }, // Nigeria par défaut
                    adresse: { valeur: 'Douala, Cameroun' }
                }
            },
            prestatairesMap: new Map(),
            expected: 'Douala, Cameroun', // Position courante
            expectedBehavior: 'Position courante utilisée (gps_fixe Nigeria ignoré)'
        },
        {
            name: 'Service avec coordonnées valides choisies par l\'utilisateur',
            description: 'Vérifier que les coordonnées valides choisies par l\'utilisateur sont prioritaires',
            service: {
                id: 2,
                data: {
                    gps_fixe: { valeur: '3.8480,11.5021' }, // Yaoundé (valide)
                    adresse: { valeur: 'Douala, Cameroun' }
                }
            },
            prestatairesMap: new Map(),
            expected: 'Yaoundé, Cameroun', // Coordonnées choisies
            expectedBehavior: 'Coordonnées choisies prioritaires'
        },
        {
            name: 'Service sans gps_fixe valide',
            description: 'Vérifier que la position courante est utilisée par défaut',
            service: {
                id: 3,
                data: {
                    adresse: { valeur: 'Bamenda, Cameroun' }
                }
            },
            prestatairesMap: new Map(),
            expected: 'Douala, Cameroun', // Position courante
            expectedBehavior: 'Position courante par défaut'
        },
        {
            name: 'Service avec GPS créateur Nigeria par défaut',
            description: 'Vérifier que le GPS créateur Nigeria est ignoré et que la position courante est utilisée',
            service: {
                id: 4,
                data: {
                    adresse: { valeur: 'Bamenda, Cameroun' }
                },
                user_id: 1
            },
            prestatairesMap: new Map([[1, { gps: '9.818276,4.033640' }]]), // Nigeria par défaut
            expected: 'Douala, Cameroun', // Position courante
            expectedBehavior: 'Position courante utilisée (GPS créateur Nigeria ignoré)'
        },
        {
            name: 'Service avec GPS créateur valide',
            description: 'Vérifier que le GPS créateur valide est utilisé',
            service: {
                id: 5,
                data: {
                    adresse: { valeur: 'Douala, Cameroun' }
                },
                user_id: 1
            },
            prestatairesMap: new Map([[1, { gps: '10.3167,9.7167' }]]), // Bamenda (valide)
            expected: 'Bamenda, Cameroun', // GPS créateur
            expectedBehavior: 'GPS créateur valide utilisé'
        },
        {
            name: 'Service avec adresse textuelle seulement',
            description: 'Vérifier que l\'adresse textuelle est utilisée en fallback',
            service: {
                id: 6,
                data: {
                    adresse: { valeur: 'Garoua, Cameroun' }
                }
            },
            prestatairesMap: new Map(),
            expected: 'Garoua, Cameroun', // Adresse textuelle
            expectedBehavior: 'Adresse textuelle utilisée'
        }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n📋 TEST ${i + 1}: ${test.name}`);
        console.log(`📝 Description: ${test.description}`);
        console.log(`🎯 Comportement attendu: ${test.expectedBehavior}`);
        console.log(`📍 Résultat attendu: ${test.expected}`);
        console.log('─'.repeat(80));

        try {
            const result = await formatLocation(test.service, test.prestatairesMap, null);
            console.log(`🎯 Résultat obtenu: ${result}`);

            const passed = result === test.expected;
            if (passed) {
                console.log(`✅ TEST ${i + 1} PASSÉ - ${test.expectedBehavior}`);
                passedTests++;
            } else {
                console.log(`❌ TEST ${i + 1} ÉCHOUÉ - Attendu: ${test.expected}, Obtenu: ${result}`);
            }
        } catch (error) {
            console.log(`💥 TEST ${i + 1} ERREUR - ${error.message}`);
        }

        console.log('─'.repeat(80));
    }

    // Résumé des tests
    console.log(`\n🎉 RÉSUMÉ DES TESTS FINAUX`);
    console.log(`✅ Tests passés: ${passedTests}/${totalTests}`);
    console.log(`❌ Tests échoués: ${totalTests - passedTests}/${totalTests}`);
    console.log(`📊 Taux de réussite: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
        console.log(`\n🎊 TOUS LES TESTS SONT PASSÉS ! L'application GPS fonctionne parfaitement.`);
        console.log(`\n✅ VÉRIFICATIONS RÉUSSIES:`);
        console.log(`✅ 1. Coordonnées Nigeria par défaut détectées et ignorées`);
        console.log(`✅ 2. Position courante récupérée et utilisée par défaut`);
        console.log(`✅ 3. Coordonnées valides choisies par l'utilisateur prioritaires`);
        console.log(`✅ 4. Logique de priorité respectée selon vos spécifications`);
        console.log(`✅ 5. Fallbacks fonctionnels (GPS créateur, adresse textuelle)`);
    } else {
        console.log(`\n⚠️ Certains tests ont échoué. Vérifiez les corrections appliquées.`);
    }
}

// Exécuter les tests
runFinalTests().catch(console.error);









