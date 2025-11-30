/**
 * Script de test standalone pour analyser la détection des produits
 * 
 * Ce script peut être exécuté indépendamment pour tester la détection
 * des produits existants avec un compte spécifique.
 * 
 * Usage:
 * import { testProductDetectionForAccount } from './testProductDetectionStandalone';
 * await testProductDetectionForAccount('lelehernandez02007@yahoo.fr', 'Hernandez87');
 */

import { formatTestResult, runProductDetectionTest } from './productDetectionTest';

/**
 * Teste la détection des produits pour un compte spécifique
 */
export const testProductDetectionForAccount = async (
    email: string,
    password: string
): Promise<void> => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 TEST DE DÉTECTION DES PRODUITS - STANDALONE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Mot de passe: ${password}`);
    console.log('');

    try {
        // Étape 1: Connexion
        console.log('📡 Étape 1: Connexion...');
        const { authApi } = await import('../services/api');
        const loginResponse = await authApi.login(email, password);

        if (!loginResponse.success || !loginResponse.data) {
            console.error('❌ Échec de la connexion:', loginResponse);
            return;
        }

        // Extraire user_id depuis le token JWT
        const token = loginResponse.data.token || (loginResponse.data as any).token;
        let userId: string | number | null = null;

        if (token) {
            try {
                const tokenParts = token.split('.');
                if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    userId = payload.sub || payload.user_id || payload.id;
                }
            } catch (e) {
                console.warn('⚠️ Impossible de décoder le token:', e);
            }
        }

        // Fallback: chercher user_id dans la réponse
        if (!userId) {
            userId = (loginResponse.data as any).user?.id || (loginResponse.data as any).user_id || (loginResponse.data as any).id;
        }

        if (!userId) {
            console.error('❌ Impossible de déterminer user_id');
            return;
        }

        console.log('✅ Connexion réussie');
        console.log(`👤 User ID: ${userId}`);
        console.log('');

        // Étape 2: Test de détection
        console.log('📡 Étape 2: Test de détection des produits...');
        const testResult = await runProductDetectionTest(userId, email);

        // Étape 3: Affichage des résultats
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📊 RÉSULTATS DU TEST');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(formatTestResult(testResult));

        // Étape 4: Analyse détaillée
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🔍 ANALYSE DÉTAILLÉE');
        console.log('═══════════════════════════════════════════════════════════════');

        analyzeTestResults(testResult);

    } catch (error: any) {
        console.error('❌ Erreur lors du test:', error);
        console.error('Stack:', error?.stack);
    }
};

/**
 * Analyse les résultats du test pour identifier les problèmes
 */
const analyzeTestResults = (result: any): void => {
    console.log('');
    console.log('📋 RÉSUMÉ DES TENTATIVES:');
    console.log('───────────────────────────────────────────────────────────────');

    result.attempts.forEach((attempt: any, index: number) => {
        console.log(`\n${index + 1}. ${attempt.endpoint}`);
        console.log(`   ✅ Succès: ${attempt.success ? 'OUI' : 'NON'}`);

        if (attempt.error) {
            console.log(`   ❌ Erreur: ${JSON.stringify(attempt.error, null, 2)}`);
        }

        if (attempt.servicesFound !== undefined) {
            console.log(`   📋 Services trouvés: ${attempt.servicesFound}`);
            console.log(`   🛍️ Services avec produits: ${attempt.servicesWithProducts}`);
            console.log(`   📦 Produits trouvés: ${attempt.productsFound}`);
        }

        if (attempt.sampleService) {
            console.log(`   🔍 Structure service:`, JSON.stringify(attempt.sampleService, null, 2));
        }

        if (attempt.sampleProducts && attempt.sampleProducts.length > 0) {
            console.log(`   🔍 Exemple produit:`, JSON.stringify(attempt.sampleProducts[0], null, 2));
        }
    });

    console.log('');
    console.log('🎯 DÉCISION FINALE:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`✅ Service avec produits: ${result.hasExistingServiceWithProducts ? 'OUI' : 'NON'}`);
    console.log(`🆔 Service ID: ${result.firstServiceId || 'N/A'}`);
    console.log(`📱 Navigation: ${result.finalDecision}`);
    console.log(`💡 Raison: ${result.reason}`);

    // Analyse des problèmes
    console.log('');
    console.log('🔍 DIAGNOSTIC:');
    console.log('───────────────────────────────────────────────────────────────');

    if (!result.hasExistingServiceWithProducts) {
        console.log('❌ PROBLÈME: Aucun service avec produits détecté');
        console.log('');

        // Analyser pourquoi
        const successfulAttempts = result.attempts.filter((a: any) => a.success);
        if (successfulAttempts.length === 0) {
            console.log('⚠️ Toutes les tentatives ont échoué');
            console.log('   → Vérifier la connexion réseau');
            console.log('   → Vérifier les endpoints API');
        } else {
            console.log(`✅ ${successfulAttempts.length} tentative(s) réussie(s)`);

            successfulAttempts.forEach((attempt: any) => {
                if (attempt.servicesFound > 0 && attempt.servicesWithProducts === 0) {
                    console.log(`\n⚠️ ${attempt.endpoint}:`);
                    console.log(`   → ${attempt.servicesFound} service(s) trouvé(s)`);
                    console.log(`   → Mais aucun n'a de produits détectés`);
                    console.log(`   → Problème probable: Structure des produits non reconnue`);

                    if (attempt.sampleService) {
                        console.log(`   → Structure produits:`, attempt.sampleService.produitsType);
                        console.log(`   → Clés produits:`, attempt.sampleService.produitsKeys || 'N/A');
                    }
                }
            });
        }

        // Vérifier les produits directement
        const productsAttempt = result.attempts.find((a: any) => a.endpoint === '/api/products/my-products');
        if (productsAttempt && productsAttempt.productsFound > 0) {
            console.log(`\n✅ Produits trouvés directement: ${productsAttempt.productsFound}`);
            if (!result.firstServiceId) {
                console.log(`   ⚠️ Mais service_id manquant dans les produits`);
                if (productsAttempt.sampleProducts && productsAttempt.sampleProducts.length > 0) {
                    const product = productsAttempt.sampleProducts[0];
                    console.log(`   → Clés du produit:`, Object.keys(product));
                    console.log(`   → service_id:`, product.service_id || 'NON TROUVÉ');
                    console.log(`   → serviceId:`, product.serviceId || 'NON TROUVÉ');
                    console.log(`   → service:`, product.service ? 'OUI' : 'NON');
                }
            }
        }
    } else {
        console.log('✅ SUCCÈS: Service avec produits détecté');
        console.log(`   → Service ID: ${result.firstServiceId}`);
        console.log(`   → Navigation: ${result.finalDecision}`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
};

/**
 * Test rapide avec les identifiants fournis
 */
export const runQuickTest = async (): Promise<void> => {
    await testProductDetectionForAccount('lelehernandez02007@gmail.com', 'Hernandez87');
};

