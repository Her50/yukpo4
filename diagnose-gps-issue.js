// diagnose-gps-issue.js
// Script pour diagnostiquer le problème GPS "R29M+8G Worumokato, Nigeria"

console.log('🔍 Diagnostic du problème GPS');

// Simuler les coordonnées problématiques
const problemCoords = '9.818276,4.033640'; // Coordonnées Nigeria par défaut

// Fonction pour simuler convertGpsToLocation
async function simulateConvertGpsToLocation(gpsString) {
    console.log(`\n📍 Simulation convertGpsToLocation avec: ${gpsString}`);

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

        console.log(`✅ Coordonnées extraites: lat=${coords[0]}, lng=${coords[1]}`);

        // Simuler l'appel à l'API de géocodage
        const mockApiResponse = {
            formatted_address: "R29M+8G Worumokato, Nigeria",
            address_components: [
                { long_name: "Worumokato", short_name: "Worumokato", types: ["locality", "political"] },
                { long_name: "Nigeria", short_name: "NG", types: ["country", "political"] }
            ]
        };

        console.log(`🌍 Réponse API simulée: ${mockApiResponse.formatted_address}`);

        // Simuler l'optimisation du nom
        const optimizedName = optimizeLocationName(mockApiResponse.formatted_address);
        console.log(`✨ Nom optimisé: ${optimizedName}`);

        return optimizedName;

    } catch (error) {
        console.error('❌ Erreur:', error);
        return gpsString;
    }
}

// Fonction pour optimiser le nom de lieu (simulée)
function optimizeLocationName(locationName) {
    console.log(`🔧 Optimisation de: ${locationName}`);

    // Supprimer les codes postaux et codes
    let optimized = locationName
        .replace(/^[A-Z0-9+]+/, '') // Supprimer les codes comme "R29M+8G"
        .replace(/^[\s,]+/, '') // Supprimer les espaces et virgules en début
        .trim();

    console.log(`📝 Après suppression des codes: "${optimized}"`);

    return optimized;
}

// Fonction pour simuler formatLocation
async function simulateFormatLocation(service) {
    console.log('\n🏠 Simulation formatLocation');
    console.log('Service data:', JSON.stringify(service, null, 2));

    // 1. Priorité: gps_fixe
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié') {
            if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
                console.log('🔄 Géocodage des coordonnées gps_fixe...');
                const location = await simulateConvertGpsToLocation(gpsFixe);
                return location;
            }
            return gpsFixe;
        }
    }

    // 2. Priorité: adresse
    if (service?.data?.adresse) {
        const adresse = getServiceFieldValue(service.data.adresse);
        console.log(`🏠 adresse trouvée: ${adresse}`);
        if (adresse && adresse !== 'Non spécifié') {
            return adresse;
        }
    }

    // 3. Fallback
    console.log('⚠️ Aucune localisation trouvée, fallback');
    return 'Localisation non disponible';
}

// Fonction pour extraire la valeur d'un champ (simulée)
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

// Test avec un service simulé
async function testGpsIssue() {
    console.log('🧪 Test du problème GPS\n');

    // Service simulé avec coordonnées Nigeria par défaut
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

    console.log('📋 Service de test:');
    console.log('- gps_fixe: 9.818276,4.033640 (Nigeria par défaut)');
    console.log('- adresse: Douala, Cameroun (vraie adresse)');

    const result = await simulateFormatLocation(testService);

    console.log(`\n🎯 Résultat final: "${result}"`);

    if (result.includes('Nigeria') || result.includes('Worumokato')) {
        console.log('\n❌ PROBLÈME CONFIRMÉ: Les coordonnées Nigeria par défaut sont prioritaires !');
        console.log('🔧 SOLUTION: Modifier la logique pour ignorer les coordonnées Nigeria par défaut');
    } else {
        console.log('\n✅ Pas de problème détecté');
    }
}

// Exécuter le test
testGpsIssue().catch(console.error);



















