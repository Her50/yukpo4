/**
 * Test d'intégration pour la création de livraison
 * Valide le format de payload et l'extraction de réponse
 */

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || null; // Optionnel pour tests authentifiés

// Fonction de normalisation (identique à deliveryApi.ts)
function normalizePayload(payload) {
    return {
        ...payload,
        parcel: {
            ...payload.parcel,
            photos: payload.parcel.photos || [],
            constraints: payload.parcel.constraints || {},
        },
        metadata: payload.metadata || {},
        initial_event_payload: payload.initial_event_payload || {},
    };
}

// Fonction d'extraction de réponse (identique à deliveryApi.ts)
function extractDeliveryResponse(data) {
    const delivery = data.delivery || data;
    const kind = delivery.metadata?.kind || (delivery.shopping_required ? 'shopping' : 'parcel');

    return {
        id: delivery.id,
        status: delivery.status,
        kind: kind,
    };
}

// Test 1: Validation du format de payload Parcel
function testParcelPayloadFormat() {
    console.log('\n🧪 Test 1: Format Payload Parcel\n');

    const frontendPayload = {
        parcel: {
            type_id: 2,
            weight_kg: 5.5,
            volume_cm3: 10000,
            declared_value: 50000,
            notes: 'Colis fragile',
            photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
            constraints: {
                is_moving: false,
            },
        },
        pickup: {
            latitude: 4.0511,
            longitude: 9.7679,
            address: '123 Avenue de la République, Douala',
        },
        dropoff: {
            latitude: 4.0522,
            longitude: 9.7680,
            address: '456 Boulevard de la Liberté, Douala',
        },
        metadata: {
            kind: 'parcel',
            is_moving: false,
            preferred_delivery_date: '2025-01-25',
            preferred_delivery_time_start: '10:00',
            preferred_delivery_time_end: '12:00',
            is_flexible: true,
            flexibility_window_days: 2,
            urgency_level: 'normal',
        },
    };

    const normalized = normalizePayload(frontendPayload);

    const validations = [
        { name: 'photos est un tableau', valid: Array.isArray(normalized.parcel.photos) },
        { name: 'constraints est un objet', valid: typeof normalized.parcel.constraints === 'object' && !Array.isArray(normalized.parcel.constraints) },
        { name: 'metadata est un objet', valid: typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata) },
        { name: 'initial_event_payload est présent', valid: typeof normalized.initial_event_payload === 'object' },
        { name: 'metadata.kind est "parcel"', valid: normalized.metadata.kind === 'parcel' },
        { name: 'pickup a latitude/longitude', valid: typeof normalized.pickup.latitude === 'number' && typeof normalized.pickup.longitude === 'number' },
        { name: 'dropoff a latitude/longitude', valid: typeof normalized.dropoff.latitude === 'number' && typeof normalized.dropoff.longitude === 'number' },
    ];

    const allValid = validations.every(v => v.valid);
    validations.forEach(v => console.log(`  ${v.valid ? '✅' : '❌'} ${v.name}`));
    console.log(`\n  Résultat: ${allValid ? '✅ PASS' : '❌ FAIL'}`);

    return { valid: allValid, payload: normalized };
}

// Test 2: Validation du format de payload Shopping
function testShoppingPayloadFormat() {
    console.log('\n🧪 Test 2: Format Payload Shopping\n');

    const frontendPayload = {
        parcel: {
            type_id: 1,
            notes: 'Courses supermarché: Carrefour Market',
            // photos et constraints non fournis (devraient être normalisés)
        },
        pickup: {
            latitude: 4.0511,
            longitude: 9.7679,
            address: 'Carrefour Market, Douala',
        },
        dropoff: {
            latitude: 4.0522,
            longitude: 9.7680,
            address: '456 Boulevard de la Liberté, Douala',
        },
        metadata: {
            kind: 'shopping',
            supermarket_id: '1',
            supermarket_name: 'Carrefour Market',
            basket_items: [
                { name: 'Pain', quantity: 2, unit: 'pièce', estimated_price: 500 },
                { name: 'Lait', quantity: 1, unit: 'litre', estimated_price: 1200 },
            ],
            basket_total: 2200,
        },
    };

    const normalized = normalizePayload(frontendPayload);

    const validations = [
        { name: 'photos est un tableau vide', valid: Array.isArray(normalized.parcel.photos) && normalized.parcel.photos.length === 0 },
        { name: 'constraints est un objet vide', valid: typeof normalized.parcel.constraints === 'object' && Object.keys(normalized.parcel.constraints).length === 0 },
        { name: 'metadata est un objet', valid: typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata) },
        { name: 'metadata.kind est "shopping"', valid: normalized.metadata.kind === 'shopping' },
        { name: 'metadata.basket_items est présent', valid: Array.isArray(normalized.metadata.basket_items) },
    ];

    const allValid = validations.every(v => v.valid);
    validations.forEach(v => console.log(`  ${v.valid ? '✅' : '❌'} ${v.name}`));
    console.log(`\n  Résultat: ${allValid ? '✅ PASS' : '❌ FAIL'}`);

    return { valid: allValid, payload: normalized };
}

// Test 3: Validation de l'extraction de réponse
function testResponseExtraction() {
    console.log('\n🧪 Test 3: Extraction Réponse Backend\n');

    const backendResponse = {
        delivery: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'requested',
            metadata: {
                kind: 'parcel',
                is_moving: false,
            },
            shopping_required: false,
        },
    };

    const extracted = extractDeliveryResponse(backendResponse);

    const validations = [
        { name: 'id est extrait', valid: extracted.id === '550e8400-e29b-41d4-a716-446655440000' },
        { name: 'status est extrait', valid: extracted.status === 'requested' },
        { name: 'kind est extrait depuis metadata', valid: extracted.kind === 'parcel' },
        { name: 'kind est une string', valid: typeof extracted.kind === 'string' },
    ];

    const allValid = validations.every(v => v.valid);
    validations.forEach(v => console.log(`  ${v.valid ? '✅' : '❌'} ${v.name}`));
    console.log(`\n  Résultat: ${allValid ? '✅ PASS' : '❌ FAIL'}`);

    return { valid: allValid, extracted };
}

// Test 4: Test d'intégration réel (si backend accessible)
async function testRealAPI() {
    console.log('\n🧪 Test 4: Test API Réel (optionnel)\n');

    if (!TEST_TOKEN) {
        console.log('  ⚠️  TEST_TOKEN non fourni, test API réel ignoré');
        console.log('  💡 Pour tester: export TEST_TOKEN="votre_token"');
        return { valid: true, skipped: true };
    }

    try {
        const testPayload = {
            parcel: {
                type_id: 2,
                weight_kg: 1.0,
                notes: 'Test de livraison',
                photos: [],
                constraints: {},
            },
            pickup: {
                latitude: 4.0511,
                longitude: 9.7679,
                address: 'Test Pickup',
            },
            dropoff: {
                latitude: 4.0522,
                longitude: 9.7680,
                address: 'Test Dropoff',
            },
            metadata: {
                kind: 'parcel',
            },
            initial_event_payload: {},
        };

        const normalized = normalizePayload(testPayload);

        const response = await fetch(`${API_BASE_URL}/api/delivery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_TOKEN}`,
            },
            body: JSON.stringify(normalized),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`  ❌ Erreur HTTP ${response.status}: ${errorText}`);
            return { valid: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const extracted = extractDeliveryResponse(data);

        const validations = [
            { name: 'Réponse reçue', valid: data !== null },
            { name: 'ID extrait', valid: extracted.id !== undefined && extracted.id !== null },
            { name: 'Status extrait', valid: extracted.status !== undefined },
            { name: 'Kind extrait', valid: extracted.kind !== undefined },
        ];

        const allValid = validations.every(v => v.valid);
        validations.forEach(v => console.log(`  ${v.valid ? '✅' : '❌'} ${v.name}`));

        if (allValid) {
            console.log(`\n  ✅ Livraison créée avec succès!`);
            console.log(`     ID: ${extracted.id}`);
            console.log(`     Status: ${extracted.status}`);
            console.log(`     Kind: ${extracted.kind}`);
        }

        return { valid: allValid, extracted };
    } catch (error) {
        console.log(`  ❌ Erreur: ${error.message}`);
        console.log(`  💡 Vérifiez que le backend est accessible sur ${API_BASE_URL}`);
        return { valid: false, error: error.message };
    }
}

// Exécution des tests
async function runTests() {
    console.log('🚀 Tests d\'intégration - Format Backend Livraison');
    console.log('='.repeat(60));

    const results = [];

    // Test 1: Format Parcel
    results.push(testParcelPayloadFormat());

    // Test 2: Format Shopping
    results.push(testShoppingPayloadFormat());

    // Test 3: Extraction Réponse
    results.push(testResponseExtraction());

    // Test 4: API Réel (optionnel)
    const apiTest = await testRealAPI();
    if (!apiTest.skipped) {
        results.push(apiTest);
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    const passed = results.filter(r => r.valid).length;
    const total = results.length;
    console.log(`\n📊 Résumé: ${passed}/${total} tests passés`);

    if (passed === total) {
        console.log('✅ TOUS LES TESTS PASSENT\n');
        process.exit(0);
    } else {
        console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ\n');
        process.exit(1);
    }
}

// Lancer les tests
runTests().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});

