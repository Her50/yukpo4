/**
 * Script de test Node.js pour analyser la détection des produits
 * 
 * Usage: node test-product-detection.js
 * 
 * Ce script peut être exécuté directement depuis le terminal
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://yukpomnang.onrender.com';

// Couleurs pour la console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '═'.repeat(60));
    log(title, 'bright');
    console.log('═'.repeat(60));
}

function logSubsection(title) {
    console.log('\n' + '─'.repeat(60));
    log(title, 'cyan');
    console.log('─'.repeat(60));
}

/**
 * Fonction pour normaliser les produits (simplifiée depuis productNormalizer.ts)
 */
function normalizeServiceProducts(produitsField) {
    if (!produitsField) {
        return [];
    }

    // Fonction récursive pour déballer les wrappers
    const unwrapProducts = (value, depth = 0, path = '') => {
        if (depth > 4) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (typeof value === 'object' && value !== null) {
            const keys = ['valeur', 'data', 'items', 'produits', 'listeproduit', 'produits_list', 'products'];

            for (const key of keys) {
                if (value[key] !== undefined && value[key] !== null) {
                    if (Array.isArray(value[key])) {
                        log(`  ✅ Format {${key}: [...]} détecté (chemin: ${path}.${key}): ${value[key].length} produits`, 'green');
                        return value[key];
                    }
                    if (typeof value[key] === 'object') {
                        const unwrapped = unwrapProducts(value[key], depth + 1, `${path}.${key}`);
                        if (unwrapped.length > 0) {
                            return unwrapped;
                        }
                    }
                }
            }
        }

        return [];
    };

    const productsArray = unwrapProducts(produitsField);

    if (productsArray.length === 0) {
        if (produitsField.type_donnee && produitsField.valeur && !Array.isArray(produitsField.valeur)) {
            log('  ✅ Format {valeur: object} détecté (produit unique), conversion en array', 'green');
            return [produitsField.valeur];
        } else {
            log('  ⚠️ Structure produits non reconnue', 'yellow');
            log(`  Type: ${typeof produitsField}`, 'yellow');
            log(`  IsArray: ${Array.isArray(produitsField)}`, 'yellow');
            log(`  Keys: ${typeof produitsField === 'object' && produitsField !== null ? Object.keys(produitsField).join(', ') : 'N/A'}`, 'yellow');
            return [];
        }
    }

    return productsArray;
}

/**
 * Vérifier si un service a des produits
 */
function serviceHasProducts(service) {
    try {
        const serviceId = service.id || service.service_id;

        // Vérifier plusieurs chemins possibles
        const produitsPaths = [
            { path: 'data.produits', value: service.data?.produits },
            { path: 'data.listeproduit', value: service.data?.listeproduit },
            { path: 'produits', value: service.produits },
            { path: 'data.data.produits', value: service.data?.data?.produits },
            { path: 'listeproduit', value: service.listeproduit }
        ];

        for (const { path, value } of produitsPaths) {
            if (value) {
                const produits = normalizeServiceProducts(value);
                if (Array.isArray(produits) && produits.length > 0) {
                    log(`  ✅ Produits trouvés via ${path}: ${produits.length}`, 'green');
                    return { hasProducts: true, count: produits.length, path };
                }
            }
        }

        return { hasProducts: false, count: 0, path: null };
    } catch (error) {
        log(`  ❌ Erreur: ${error.message}`, 'red');
        return { hasProducts: false, count: 0, path: null, error: error.message };
    }
}

/**
 * Test complet de détection
 */
async function testProductDetection(email, password) {
    logSection('🧪 TEST DE DÉTECTION DES PRODUITS');
    log(`📧 Email: ${email}`, 'cyan');
    log(`🔐 Mot de passe: ${password.replace(/./g, '*')}`, 'cyan');

    let token = null;
    let userId = null;

    try {
        // Étape 1: Connexion
        logSubsection('📡 Étape 1: Connexion');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        let loginData;
        try {
            loginData = await loginResponse.json();
        } catch (e) {
            const text = await loginResponse.text();
            log('❌ Échec de la connexion - Réponse non-JSON', 'red');
            log(`Status: ${loginResponse.status}`, 'red');
            log(`Réponse texte: ${text}`, 'red');
            return;
        }

        if (!loginResponse.ok || !loginData.token) {
            log('❌ Échec de la connexion', 'red');
            log(`Status: ${loginResponse.status}`, 'red');
            log(`Réponse: ${JSON.stringify(loginData, null, 2)}`, 'red');

            if (loginResponse.status === 401) {
                log('\n💡 Causes possibles:', 'yellow');
                log('   1. Email ou mot de passe incorrect', 'yellow');
                log('   2. Compte bloqué temporairement (anti-brute-force)', 'yellow');
                log('   3. Email non enregistré dans la base de données', 'yellow');
                log('\n⚠️ Vérifiez les identifiants et réessayez dans quelques minutes si bloqué', 'yellow');
            }
            return;
        }

        token = loginData.token;

        // Extraire user_id depuis le token JWT
        try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                userId = payload.sub || payload.user_id || payload.id;
            }
        } catch (e) {
            log(`⚠️ Impossible de décoder le token: ${e.message}`, 'yellow');
        }

        if (!userId) {
            userId = loginData.user?.id || loginData.user_id || loginData.id;
        }

        log(`✅ Connexion réussie`, 'green');
        log(`👤 User ID: ${userId}`, 'green');
        log(`🔑 Token: ${token.substring(0, 20)}...`, 'green');

        // Étape 2: Test de détection
        logSubsection('📡 Étape 2: Test de détection des produits');

        const result = {
            hasExistingServiceWithProducts: false,
            firstServiceId: null,
            attempts: []
        };

        // TENTATIVE 1: /api/prestataire/services
        log('\n1️⃣ Tentative 1: /api/prestataire/services');
        try {
            const response1 = await fetch(`${API_BASE_URL}/api/prestataire/services`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data1 = await response1.json();
            const attempt1 = {
                endpoint: '/api/prestataire/services',
                success: response1.ok,
                status: response1.status,
                servicesFound: 0,
                servicesWithProducts: 0,
                productsFound: 0,
                sampleService: null,
                sampleProducts: null
            };

            if (response1.ok) {
                // ✅ NOUVEAU: Gérer le cas où la réponse est un objet au lieu d'un array
                let servicesArray = Array.isArray(data1) ? data1 : [];

                // Si c'est un objet, essayer d'extraire un array
                if (!Array.isArray(data1) && typeof data1 === 'object') {
                    log(`  ⚠️ Réponse est un objet, pas un array`, 'yellow');
                    log(`  → Clés de l'objet: ${Object.keys(data1).join(', ')}`, 'yellow');

                    // Essayer de trouver un array dans l'objet
                    if (data1.data && Array.isArray(data1.data)) {
                        servicesArray = data1.data;
                        log(`  → Array trouvé dans data.data`, 'green');
                    } else if (data1.services && Array.isArray(data1.services)) {
                        servicesArray = data1.services;
                        log(`  → Array trouvé dans data.services`, 'green');
                    } else if (data1.result && Array.isArray(data1.result)) {
                        servicesArray = data1.result;
                        log(`  → Array trouvé dans data.result`, 'green');
                    } else {
                        log(`  → Structure complète: ${JSON.stringify(data1).substring(0, 1000)}`, 'yellow');
                    }
                }

                attempt1.servicesFound = servicesArray.length;
                log(`  📋 Services trouvés: ${servicesArray.length}`, 'blue');

                for (const service of servicesArray) {
                    const check = serviceHasProducts(service);
                    if (check.hasProducts) {
                        attempt1.servicesWithProducts++;
                        attempt1.productsFound += check.count;

                        if (!attempt1.sampleService) {
                            attempt1.sampleService = {
                                id: service.id || service.service_id,
                                hasData: !!service.data,
                                hasProduits: !!service.data?.produits,
                                hasListeproduit: !!service.data?.listeproduit,
                                dataKeys: service.data ? Object.keys(service.data) : [],
                                produitsPath: check.path
                            };
                        }

                        if (!result.hasExistingServiceWithProducts) {
                            result.hasExistingServiceWithProducts = true;
                            result.firstServiceId = service.id || service.service_id;
                        }
                    }
                }

                log(`  🛍️ Services avec produits: ${attempt1.servicesWithProducts}`, attempt1.servicesWithProducts > 0 ? 'green' : 'yellow');
                log(`  📦 Produits trouvés: ${attempt1.productsFound}`, attempt1.productsFound > 0 ? 'green' : 'yellow');
            } else {
                log(`  ⚠️ Réponse non-array ou erreur`, 'yellow');
                log(`  Status: ${response1.status}`, 'yellow');
                log(`  Data type: ${Array.isArray(data1) ? 'array' : typeof data1}`, 'yellow');
            }

            result.attempts.push(attempt1);
        } catch (error) {
            log(`  ❌ Erreur: ${error.message}`, 'red');
            result.attempts.push({
                endpoint: '/api/prestataire/services',
                success: false,
                error: error.message
            });
        }

        // FALLBACK 1: /api/services/last
        if (!result.hasExistingServiceWithProducts) {
            log('\n2️⃣ Fallback 1: /api/services/last');
            try {
                const response2 = await fetch(`${API_BASE_URL}/api/services/last`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data2 = await response2.json();
                const attempt2 = {
                    endpoint: '/api/services/last',
                    success: response2.ok,
                    status: response2.status,
                    servicesFound: 0,
                    servicesWithProducts: 0,
                    productsFound: 0
                };

                if (response2.ok && data2) {
                    const serviceData = data2.data || data2;
                    attempt2.servicesFound = 1;

                    // ✅ NOUVEAU: Afficher la structure complète du service
                    log(`  📦 Structure service complète:`, 'blue');
                    console.log(JSON.stringify(serviceData, null, 2).substring(0, 2000));

                    const check = serviceHasProducts(serviceData);
                    if (check.hasProducts) {
                        attempt2.servicesWithProducts = 1;
                        attempt2.productsFound = check.count;

                        result.hasExistingServiceWithProducts = true;
                        result.firstServiceId = serviceData.id || serviceData.service_id;
                    } else {
                        // ✅ NOUVEAU: Analyser pourquoi les produits ne sont pas détectés
                        log(`  ⚠️ Aucun produit détecté, analyse de la structure:`, 'yellow');
                        if (serviceData.data) {
                            log(`  → service.data existe`, 'yellow');
                            log(`  → Clés de service.data: ${Object.keys(serviceData.data).join(', ')}`, 'yellow');
                            if (serviceData.data.produits) {
                                log(`  → service.data.produits existe: ${typeof serviceData.data.produits}`, 'yellow');
                                log(`  → Structure produits: ${JSON.stringify(serviceData.data.produits).substring(0, 500)}`, 'yellow');
                            }
                            if (serviceData.data.listeproduit) {
                                log(`  → service.data.listeproduit existe: ${typeof serviceData.data.listeproduit}`, 'yellow');
                                log(`  → Structure listeproduit: ${JSON.stringify(serviceData.data.listeproduit).substring(0, 500)}`, 'yellow');
                            }
                        }
                    }
                }

                result.attempts.push(attempt2);
            } catch (error) {
                log(`  ❌ Erreur: ${error.message}`, 'red');
                result.attempts.push({
                    endpoint: '/api/services/last',
                    success: false,
                    error: error.message
                });
            }
        }

        // FALLBACK 2: /api/services/my-services
        if (!result.hasExistingServiceWithProducts) {
            log('\n3️⃣ Fallback 2: /api/services/my-services');
            try {
                const response3 = await fetch(`${API_BASE_URL}/api/services/my-services`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data3 = await response3.json();
                const attempt3 = {
                    endpoint: '/api/services/my-services',
                    success: response3.ok,
                    status: response3.status,
                    servicesFound: 0,
                    servicesWithProducts: 0,
                    productsFound: 0
                };

                if (response3.ok && Array.isArray(data3)) {
                    attempt3.servicesFound = data3.length;

                    for (const service of data3) {
                        const check = serviceHasProducts(service);
                        if (check.hasProducts) {
                            attempt3.servicesWithProducts++;
                            attempt3.productsFound += check.count;

                            if (!result.hasExistingServiceWithProducts) {
                                result.hasExistingServiceWithProducts = true;
                                result.firstServiceId = service.id || service.service_id;
                            }
                        }
                    }
                }

                result.attempts.push(attempt3);
            } catch (error) {
                log(`  ❌ Erreur: ${error.message}`, 'red');
                result.attempts.push({
                    endpoint: '/api/services/my-services',
                    success: false,
                    error: error.message
                });
            }
        }

        // FALLBACK 3: /api/products/my-products
        if (!result.hasExistingServiceWithProducts) {
            log('\n4️⃣ Fallback 3: /api/products/my-products');
            try {
                const response4 = await fetch(`${API_BASE_URL}/api/products/my-products`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data4 = await response4.json();
                const attempt4 = {
                    endpoint: '/api/products/my-products',
                    success: response4.ok,
                    status: response4.status,
                    productsFound: 0,
                    serviceId: null
                };

                if (response4.ok && Array.isArray(data4) && data4.length > 0) {
                    attempt4.productsFound = data4.length;
                    log(`  📦 Produits trouvés: ${data4.length}`, 'blue');

                    const firstProduct = data4[0];
                    const serviceId = firstProduct.service_id
                        || firstProduct.serviceId
                        || firstProduct.service?.id;

                    if (serviceId) {
                        attempt4.serviceId = serviceId;
                        result.hasExistingServiceWithProducts = true;
                        result.firstServiceId = serviceId;
                        log(`  ✅ Service ID trouvé: ${serviceId}`, 'green');
                    } else {
                        log(`  ⚠️ service_id manquant dans les produits`, 'yellow');
                        log(`  Clés du produit: ${Object.keys(firstProduct).join(', ')}`, 'yellow');
                    }
                }

                result.attempts.push(attempt4);
            } catch (error) {
                log(`  ❌ Erreur: ${error.message}`, 'red');
                result.attempts.push({
                    endpoint: '/api/products/my-products',
                    success: false,
                    error: error.message
                });
            }
        }

        // ✅ NOUVEAU: Simuler le flux complet de création de produit
        logSection('🎬 SIMULATION CRÉATION PRODUIT');

        // Simuler l'input utilisateur (comme dans HomeScreen)
        const mockInput = {
            texte: 'Je veux vendre un frigo américain',
            gps_mobile: null,
            gps_zone: null,
            gps_fixe: null,
            gps_fixe_coords: null
        };

        log(`📝 Input utilisateur simulé:`, 'cyan');
        console.log(JSON.stringify(mockInput, null, 2));

        // Simuler l'appel à genererSuggestionsService (sans vraiment l'appeler pour économiser les tokens)
        log(`\n🤖 Simulation appel IA (genererSuggestionsService)...`, 'cyan');
        log(`   → Dans l'app réelle, cela appellerait /api/ia/creation-service`, 'yellow');
        log(`   → Pour ce test, on simule juste le résultat`, 'yellow');

        const mockIAResult = {
            data: {
                service_data: {
                    titre_service: 'Vente de frigo américain',
                    description: 'Service de vente de frigo américain',
                    category: 'electromenager'
                },
                suggestions: {
                    nom_produit: 'Frigo américain',
                    categorie_produit: 'Electroménager',
                    description_produit: 'Frigo américain en bon état',
                    prix_produit: 50000,
                    devise_produit: 'XAF'
                }
            }
        };

        log(`✅ Résultat IA simulé reçu`, 'green');

        // Simuler l'extraction des médias et GPS (comme dans handleCreateService)
        const mockMediaData = {
            base64_image: mockInput.base64_image || null,
            audio_base64: mockInput.audio_base64 || null,
            video_base64: mockInput.video_base64 || null,
            doc_base64: mockInput.doc_base64 || null,
            excel_base64: mockInput.excel_base64 || null,
            pdf_base64: mockInput.pdf_base64 || null
        };

        const mockGpsData = {
            gps_mobile: mockInput.gps_mobile,
            gps_zone: mockInput.gps_zone,
            gps_fixe: mockInput.gps_fixe,
            gps_fixe_coords: mockInput.gps_fixe_coords
        };

        log(`\n📦 Données extraites:`, 'cyan');
        log(`   → MediaData: ${JSON.stringify(mockMediaData).substring(0, 200)}`, 'blue');
        log(`   → GpsData: ${JSON.stringify(mockGpsData)}`, 'blue');

        // ✅ DÉCISION DE NAVIGATION (comme dans handleCreateService)
        const navigationDecision = result.hasExistingServiceWithProducts
            ? 'AjouterProduitSimple'
            : 'FormulaireYukpoIntelligent';

        log(`\n🎯 DÉCISION DE NAVIGATION:`, 'bright');
        log(`   → Route choisie: ${navigationDecision}`,
            result.hasExistingServiceWithProducts ? 'green' : 'yellow');

        if (result.hasExistingServiceWithProducts) {
            log(`\n📱 Paramètres pour AjouterProduitSimple:`, 'green');
            const ajouterProduitParams = {
                serviceId: result.firstServiceId,
                suggestionIA: mockIAResult.data,
                mediaData: mockMediaData,
                gpsData: mockGpsData
            };
            console.log(JSON.stringify(ajouterProduitParams, null, 2));
            log(`\n✅ Dans l'app, navigation.navigate('AjouterProduitSimple', {...}) serait appelé`, 'green');
        } else {
            log(`\n📱 Paramètres pour FormulaireYukpoIntelligent:`, 'yellow');
            const formulaireParams = {
                suggestion: {
                    ...mockIAResult.data,
                    intention: 'creation_service',
                    data: mockIAResult.data.suggestions || mockIAResult.data.data || mockIAResult.data
                },
                type: 'creation_service',
                mode: 'create',
                mediaData: mockMediaData,
                gpsData: mockGpsData
            };
            console.log(JSON.stringify(formulaireParams, null, 2));
            log(`\n✅ Dans l'app, navigation.navigate('FormulaireYukpoIntelligent', {...}) serait appelé`, 'yellow');
        }

        // Résultats finaux
        logSection('🎯 RÉSULTATS FINAUX');
        log(`✅ Service avec produits: ${result.hasExistingServiceWithProducts ? 'OUI' : 'NON'}`,
            result.hasExistingServiceWithProducts ? 'green' : 'red');
        log(`🆔 Service ID: ${result.firstServiceId || 'N/A'}`,
            result.firstServiceId ? 'green' : 'yellow');
        log(`📱 Navigation: ${navigationDecision}`,
            result.hasExistingServiceWithProducts ? 'green' : 'yellow');

        // ✅ NOUVEAU: Résumé du test
        logSection('📋 RÉSUMÉ DU TEST');
        if (result.hasExistingServiceWithProducts) {
            log(`✅ TEST RÉUSSI: Le flux devrait ouvrir AjouterProduitSimple`, 'green');
            log(`   → Service ID ${result.firstServiceId} a des produits`, 'green');
            log(`   → L'utilisateur peut ajouter un nouveau produit au service existant`, 'green');
        } else {
            log(`⚠️ TEST: Le flux ouvrirait FormulaireYukpoIntelligent`, 'yellow');
            log(`   → Aucun service avec produits détecté`, 'yellow');
            log(`   → L'utilisateur devra créer un nouveau service + premier produit`, 'yellow');
        }

        // Détails des tentatives
        logSection('📊 DÉTAILS DES TENTATIVES');
        result.attempts.forEach((attempt, index) => {
            log(`\n${index + 1}. ${attempt.endpoint}`, 'cyan');
            log(`   Status: ${attempt.status || 'N/A'}`, attempt.success ? 'green' : 'red');
            if (attempt.servicesFound !== undefined) {
                log(`   Services trouvés: ${attempt.servicesFound}`, 'blue');
                log(`   Services avec produits: ${attempt.servicesWithProducts}`,
                    attempt.servicesWithProducts > 0 ? 'green' : 'yellow');
                log(`   Produits trouvés: ${attempt.productsFound}`,
                    attempt.productsFound > 0 ? 'green' : 'yellow');
            }
            if (attempt.productsFound !== undefined && attempt.serviceId) {
                log(`   Service ID: ${attempt.serviceId}`, 'green');
            }
            if (attempt.sampleService) {
                log(`   Exemple service:`, 'blue');
                console.log(JSON.stringify(attempt.sampleService, null, 2));
            }
            if (attempt.error) {
                log(`   ❌ Erreur: ${attempt.error}`, 'red');
            }
        });

        // Diagnostic
        if (!result.hasExistingServiceWithProducts) {
            logSection('🔍 DIAGNOSTIC');
            log('❌ PROBLÈME: Aucun service avec produits détecté', 'red');

            const successfulAttempts = result.attempts.filter(a => a.success);
            if (successfulAttempts.length === 0) {
                log('⚠️ Toutes les tentatives ont échoué', 'yellow');
                log('   → Vérifier la connexion réseau', 'yellow');
                log('   → Vérifier les endpoints API', 'yellow');
            } else {
                log(`✅ ${successfulAttempts.length} tentative(s) réussie(s)`, 'green');

                successfulAttempts.forEach(attempt => {
                    if (attempt.servicesFound > 0 && attempt.servicesWithProducts === 0) {
                        log(`\n⚠️ ${attempt.endpoint}:`, 'yellow');
                        log(`   → ${attempt.servicesFound} service(s) trouvé(s)`, 'yellow');
                        log(`   → Mais aucun n'a de produits détectés`, 'yellow');
                        log(`   → Problème probable: Structure des produits non reconnue`, 'yellow');
                    }
                });
            }
        }

    } catch (error) {
        log(`\n❌ Erreur globale: ${error.message}`, 'red');
        console.error(error);
    }
}

// Exécuter le test
const email = 'lelehernandez02007@gmail.com';
const password = 'Hernandez87';

log('🚀 Démarrage du test de détection des produits...', 'bright');
testProductDetection(email, password).catch(error => {
    log(`\n❌ Erreur fatale: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});

