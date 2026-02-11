/**
 * Script de test pour créer un produit avec des images
 * 
 * Usage: node mobile/test-create-product-with-images.js
 * 
 * Ce script teste:
 * 1. Authentification avec le compte fourni
 * 2. Récupération d'un service existant
 * 3. Création d'un produit avec des images base64
 * 4. Vérification que les images sont sauvegardées dans la table media
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';

// Identifiants de test
const TEST_EMAIL = 'lelehernandez2007@gmail.com';
const TEST_PASSWORD = 'Hernandez87';

let authToken = null;
let authenticatedUserId = null;

// Fonction helper pour faire des requêtes HTTP avec authentification
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (url.startsWith('https') ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                ...(options.headers || {})
            }
        };
        
        const req = client.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: json,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        headers: res.headers,
                        parseError: e.message
                    });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// Fonction pour se connecter et obtenir un token
async function login() {
    console.log('🔐 Authentification...');
    const loginUrl = `${API_BASE_URL}/api/auth/login`;
    
    try {
        const response = await makeRequest(loginUrl, {
            method: 'POST',
            body: {
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            }
        });
        
        if (response.status === 200) {
            authToken = response.data.token || response.data.data?.token;
            // ✅ NOUVEAU: Extraire l'user_id depuis le token (décoder JWT)
            if (authToken) {
                try {
                    // Décoder le token JWT (format: header.payload.signature)
                    const payload = authToken.split('.')[1];
                    if (payload) {
                        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
                        authenticatedUserId = decoded.sub || decoded.user_id || decoded.id;
                    }
                } catch (e) {
                    console.warn('⚠️ Impossible de décoder le token JWT:', e.message);
                }
                console.log('✅ Authentification réussie');
                console.log(`   User ID: ${authenticatedUserId || 'N/A'}`);
                console.log(`   Tokens balance: ${response.data.tokens_balance || 'N/A'}\n`);
                return true;
            } else {
                console.error('❌ Token non trouvé dans la réponse');
                console.log('Réponse:', JSON.stringify(response.data, null, 2));
                return false;
            }
        } else {
            console.error('❌ Erreur d\'authentification:', response.status);
            console.log('Réponse:', JSON.stringify(response.data, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur lors de l\'authentification:', error.message);
        return false;
    }
}

// Fonction pour créer une image base64 de test (petite image PNG rouge)
function createTestImageBase64() {
    // Image PNG 1x1 rouge en base64 (très petite pour le test)
    // Format: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

// Fonction principale de test
async function testCreateProductWithImages() {
    console.log('🧪 Test de création d\'un produit avec des images\n');
    console.log(`📍 API Base URL: ${API_BASE_URL}\n`);
    
    // Authentification d'abord
    const authenticated = await login();
    if (!authenticated) {
        console.error('❌ Impossible de s\'authentifier. Arrêt du test.');
        return;
    }
    
    try {
        // Étape 1: Récupérer un service existant
        console.log('📡 Étape 1: Récupération d\'un service existant...');
        const servicesResponse = await makeRequest(`${API_BASE_URL}/api/services/1`);
        
        if (servicesResponse.status !== 200 || !servicesResponse.data) {
            console.error('❌ Erreur récupération service:', servicesResponse.status);
            console.log('Réponse:', JSON.stringify(servicesResponse.data, null, 2).substring(0, 500));
            return;
        }
        
        const service = servicesResponse.data.data || servicesResponse.data;
        const serviceId = service.id || 1;
        // ✅ CORRIGÉ: Utiliser l'user_id authentifié
        const userId = authenticatedUserId;
        
        if (!userId || typeof userId !== 'number') {
            console.error('❌ Impossible de déterminer user_id (doit être authentifié)');
            return;
        }
        
        console.log(`✅ Service trouvé: ID ${serviceId}, User ID: ${userId}`);
        console.log(`   Titre: ${service.titre || service.name || 'N/A'}\n`);
        
        // Étape 2: Créer un produit avec des images
        console.log('📦 Étape 2: Création d\'un produit avec des images...');
        
        const testImage1 = createTestImageBase64();
        const testImage2 = createTestImageBase64();
        
        const productData = {
            nom: `Test Produit avec Images - ${new Date().toISOString()}`,
            description: 'Produit de test créé pour vérifier la sauvegarde des images',
            prix: 5000,
            devise: 'XAF',
            categorie: 'Test',
            // ✅ CRITIQUE: Les images doivent être dans ces champs pour être extraites
            images: [testImage1, testImage2],
            base64_image: [testImage1, testImage2],
            imageUrls: [], // Vide pour ce test
            origine_champs: 'test'
        };
        
        console.log(`   Produit à créer:`);
        console.log(`   - Nom: ${productData.nom}`);
        console.log(`   - Images dans 'images': ${productData.images.length}`);
        console.log(`   - Images dans 'base64_image': ${productData.base64_image.length}`);
        
        const createProductResponse = await makeRequest(`${API_BASE_URL}/api/services/${serviceId}/products`, {
            method: 'POST',
            body: {
                user_id: userId,
                product_data: productData
            }
        });
        
        if (createProductResponse.status !== 200 || !createProductResponse.data) {
            console.error('❌ Erreur création produit:', createProductResponse.status);
            console.log('Réponse:', JSON.stringify(createProductResponse.data, null, 2));
            return;
        }
        
        const createResult = createProductResponse.data;
        console.log(`✅ Produit créé avec succès!`);
        console.log(`   Job ID: ${createResult.job_id || 'N/A'}`);
        console.log(`   Status: ${createResult.status || 'N/A'}`);
        console.log(`   Cost: ${createResult.cost || 'N/A'} FCFA\n`);
        
        // Si un job_id est retourné, attendre un peu puis vérifier le statut
        if (createResult.job_id) {
            console.log('⏳ Attente de 5 secondes pour le traitement du job...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log(`📊 Étape 3: Vérification du statut du job ${createResult.job_id}...`);
            const jobStatusResponse = await makeRequest(
                `${API_BASE_URL}/api/services/${serviceId}/products/queue/${createResult.job_id}`
            );
            
            if (jobStatusResponse.status === 200 && jobStatusResponse.data) {
                const job = jobStatusResponse.data;
                console.log(`   Status: ${job.status}`);
                console.log(`   Attempt count: ${job.attempt_count}/${job.max_attempts}`);
                if (job.error_message) {
                    console.log(`   ⚠️ Erreur: ${job.error_message}`);
                }
                if (job.result_data) {
                    console.log(`   ✅ Résultat:`, JSON.stringify(job.result_data, null, 2));
                }
            }
        }
        
        // Étape 4: Vérifier que les images sont sauvegardées dans la table media
        console.log('\n🔍 Étape 4: Vérification des médias sauvegardés...');
        
        // Attendre un peu plus pour que le traitement soit terminé
        console.log('⏳ Attente de 10 secondes supplémentaires...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // ✅ NOUVEAU: Récupérer le résultat du job pour obtenir le product_index
        let productIndex = null;
        let productId = null;
        if (createResult.job_id) {
            const jobStatusResponse = await makeRequest(
                `${API_BASE_URL}/api/services/${serviceId}/products/queue/${createResult.job_id}`
            );
            
            if (jobStatusResponse.status === 200 && jobStatusResponse.data) {
                console.log(`📋 Résultat complet du job:`, JSON.stringify(jobStatusResponse.data, null, 2));
                
                if (jobStatusResponse.data.result_data) {
                    const resultData = jobStatusResponse.data.result_data;
                    productIndex = resultData.product_index;
                    productId = resultData.product_id;
                    console.log(`✅ Product index depuis job: ${productIndex}`);
                    console.log(`✅ Product ID depuis job: ${productId}`);
                }
            }
        }
        
        // Si on n'a pas le product_index, essayer de récupérer les produits
        if (productIndex === null || productIndex === undefined) {
            console.log('📦 Tentative de récupération des produits...');
            const productsResponse = await makeRequest(`${API_BASE_URL}/api/services/${serviceId}/products`);
            
            if (productsResponse.status === 200 && productsResponse.data) {
                const products = Array.isArray(productsResponse.data.data) 
                    ? productsResponse.data.data 
                    : (productsResponse.data.data?.data || []);
                
                console.log(`✅ ${products.length} produit(s) trouvé(s) pour le service ${serviceId}`);
                
                if (products.length > 0) {
                    // Prendre le dernier produit (le plus récent)
                    const testProduct = products[products.length - 1];
                    productIndex = testProduct.product_index || testProduct.index || null;
                    console.log(`   Product index trouvé: ${productIndex}`);
                }
            }
        }
        
        // Vérifier les médias dans la table media
        // Essayer plusieurs méthodes pour trouver les médias
        console.log(`\n🔍 Vérification des médias sauvegardés...`);
        
        let mediaFound = false;
        
        // Méthode 1: Par product_index si disponible
        if (productIndex !== null && productIndex !== undefined) {
            const mediaUrl = `${API_BASE_URL}/api/media/product/${serviceId}/${productIndex}`;
            console.log(`   Tentative 1: ${mediaUrl}`);
            
            const mediaResponse = await makeRequest(mediaUrl);
            
            if (mediaResponse.status === 200 && mediaResponse.data) {
                const mediaData = mediaResponse.data.data || mediaResponse.data;
                const mediaItems = Array.isArray(mediaData) ? mediaData : (mediaData.items || []);
                
                if (mediaItems.length > 0) {
                    console.log(`\n✅ ${mediaItems.length} média(s) trouvé(s) dans la table media:`);
                    mediaItems.forEach((media, idx) => {
                        console.log(`   ${idx + 1}. Type: ${media.type || media.media_type || 'N/A'}`);
                        console.log(`      Path: ${media.path || media.url || media.media_url || 'N/A'}`);
                        console.log(`      Product ID: ${media.product_id || 'N/A'}`);
                        console.log(`      Product Index: ${media.product_index || 'N/A'}`);
                        console.log(`      Is Main: ${media.is_main_image || false}`);
                        console.log('');
                    });
                    mediaFound = true;
                }
            }
        }
        
        // Méthode 2: Récupérer tous les médias du service et chercher les plus récents
        if (!mediaFound) {
            console.log(`   Tentative 2: Récupération de tous les médias du service ${serviceId}...`);
            const serviceMediaUrl = `${API_BASE_URL}/api/services/${serviceId}/media`;
            const serviceMediaResponse = await makeRequest(serviceMediaUrl);
            
            if (serviceMediaResponse.status === 200 && serviceMediaResponse.data) {
                const serviceMediaData = serviceMediaResponse.data.data || serviceMediaResponse.data;
                const allMediaItems = Array.isArray(serviceMediaData) ? serviceMediaData : (serviceMediaData.items || []);
                
                // Filtrer les médias de produits (avec product_id ou product_index)
                const productMedia = allMediaItems.filter(m => 
                    (m.product_id && m.product_id !== null) || 
                    (m.product_index !== null && m.product_index !== undefined)
                );
                
                // Filtrer aussi les médias récents (créés dans les 5 dernières minutes)
                const now = new Date();
                const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
                const recentMedia = allMediaItems.filter(m => {
                    if (m.uploaded_at) {
                        const uploaded = new Date(m.uploaded_at);
                        return uploaded > fiveMinutesAgo;
                    }
                    return false;
                });
                
                console.log(`   Total médias du service: ${allMediaItems.length}`);
                console.log(`   Médias avec product_id/index: ${productMedia.length}`);
                console.log(`   Médias récents (5 min): ${recentMedia.length}`);
                
                if (productIndex !== null && productIndex !== undefined) {
                    // Chercher spécifiquement les médias pour ce product_index
                    const mediaForThisProduct = allMediaItems.filter(m => 
                        m.product_index === productIndex || m.product_index === parseInt(productIndex)
                    );
                    console.log(`   Médias pour product_index ${productIndex}: ${mediaForThisProduct.length}`);
                    
                    if (mediaForThisProduct.length > 0) {
                        console.log(`\n✅ ${mediaForThisProduct.length} média(x) trouvé(s) pour product_index ${productIndex}:`);
                        mediaForThisProduct.forEach((media, idx) => {
                            console.log(`   ${idx + 1}. Type: ${media.type || media.media_type || 'N/A'}`);
                            console.log(`      Path: ${media.path || media.url || media.media_url || 'N/A'}`);
                            console.log(`      Product ID: ${media.product_id || 'N/A'}`);
                            console.log(`      Product Index: ${media.product_index || 'N/A'}`);
                            console.log(`      Uploaded: ${media.uploaded_at || 'N/A'}`);
                            console.log('');
                        });
                        mediaFound = true;
                    }
                }
                
                if (!mediaFound && recentMedia.length > 0) {
                    console.log(`\n⚠️ ${recentMedia.length} média(x) récent(s) trouvé(s) mais sans product_index:`);
                    recentMedia.slice(-5).forEach((media, idx) => {
                        console.log(`   ${idx + 1}. Type: ${media.type || media.media_type || 'N/A'}`);
                        console.log(`      Path: ${media.path || media.url || media.media_url || 'N/A'}`);
                        console.log(`      Product ID: ${media.product_id || 'N/A'}`);
                        console.log(`      Product Index: ${media.product_index || 'N/A'}`);
                        console.log(`      Uploaded: ${media.uploaded_at || 'N/A'}`);
                        console.log('');
                    });
                }
                
                if (!mediaFound && productMedia.length > 0) {
                    console.log(`\n⚠️ ${productMedia.length} média(x) de produit(s) trouvé(s) mais pas pour ce product_index:`);
                    productMedia.slice(-5).forEach((media, idx) => {
                        console.log(`   ${idx + 1}. Type: ${media.type || media.media_type || 'N/A'}`);
                        console.log(`      Path: ${media.path || media.url || media.media_url || 'N/A'}`);
                        console.log(`      Product ID: ${media.product_id || 'N/A'}`);
                        console.log(`      Product Index: ${media.product_index || 'N/A'}`);
                        console.log(`      Uploaded: ${media.uploaded_at || 'N/A'}`);
                        console.log('');
                    });
                }
                
                if (!mediaFound) {
                    console.log(`   ⚠️ Aucun média trouvé pour le produit créé (product_index: ${productIndex})`);
                }
            }
        }
        
        if (!mediaFound) {
            console.log(`\n❌ Aucun média trouvé dans la table media pour ce produit`);
            console.log(`   ⚠️ PROBLÈME: Les images n'ont pas été sauvegardées!`);
            console.log(`   Vérifiez les logs du backend pour voir pourquoi.`);
            console.log(`   Le job est complété mais les médias ne sont pas présents.`);
        }
        
        console.log('\n✅ Test terminé');
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        console.error(error.stack);
    }
}

testCreateProductWithImages();

