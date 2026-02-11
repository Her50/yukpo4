/**
 * Script de test pour vérifier la récupération des images de produits
 * 
 * Usage: node mobile/test-product-images.js
 * 
 * Ce script teste:
 * 1. Récupération des services avec produits
 * 2. Vérification de la présence des images dans les réponses API
 * 3. Test de chargement des images réelles
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com';
// Tester avec quelques service_ids connus (à adapter selon votre base de données)
const TEST_SERVICE_IDS = [1, 2, 3, 4, 5]; // Tester avec les premiers services

// Identifiants de test
const TEST_EMAIL = 'lelehernandez2007@gmail.com';
const TEST_PASSWORD = 'Hernandez87';

let authToken = null;

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
            // La réponse peut être directement { token: ... } ou { success: true, data: { token: ... } }
            authToken = response.data.token || response.data.data?.token || (response.data.success && response.data.data?.token);
            if (authToken) {
                console.log('✅ Authentification réussie');
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

// Fonction pour tester si une URL d'image est accessible
function testImageUrl(url) {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string') {
            resolve({ accessible: false, error: 'URL invalide' });
            return;
        }
        
        if (url.startsWith('data:')) {
            resolve({ accessible: true, type: 'base64' });
            return;
        }
        
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, (res) => {
            const contentType = res.headers['content-type'] || '';
            const isImage = contentType.startsWith('image/');
            const statusCode = res.statusCode;
            
            // Consommer la réponse pour libérer la connexion
            res.on('data', () => {});
            res.on('end', () => {
                resolve({
                    accessible: statusCode === 200,
                    statusCode,
                    contentType,
                    isImage,
                    size: parseInt(res.headers['content-length'] || '0', 10)
                });
            });
        });
        
        req.on('error', (err) => {
            resolve({
                accessible: false,
                error: err.message,
                code: err.code
            });
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({
                accessible: false,
                error: 'Timeout'
            });
        });
    });
}

// Fonction principale de test
async function testProductImages() {
    console.log('🧪 Test de récupération des images de produits\n');
    console.log(`📍 API Base URL: ${API_BASE_URL}\n`);
    
    // Authentification d'abord
    const authenticated = await login();
    if (!authenticated) {
        console.error('❌ Impossible de s\'authentifier. Arrêt du test.');
        return;
    }
    
    try {
        // Étape 1: Tester directement avec des service_ids connus
        console.log('📡 Étape 1: Test avec service_ids spécifiques...');
        console.log(`   Service IDs à tester: ${TEST_SERVICE_IDS.join(', ')}\n`);
        
        // Étape 2: Pour chaque service_id, récupérer ses produits
        for (const serviceId of TEST_SERVICE_IDS) {
            console.log(`\n📦 Service ID: ${serviceId}`);
            
            try {
                // Récupérer d'abord les infos du service
                const serviceUrl = `${API_BASE_URL}/api/services/${serviceId}`;
                console.log(`   🔍 Récupération service: ${serviceUrl}`);
                const serviceResponse = await makeRequest(serviceUrl);
                
                let serviceTitle = 'N/A';
                let serviceData = null;
                
                // Gérer différents formats de réponse
                if (serviceResponse.status === 200) {
                    if (serviceResponse.data && serviceResponse.data.success && serviceResponse.data.data) {
                        serviceData = serviceResponse.data.data;
                    } else if (serviceResponse.data && serviceResponse.data.id) {
                        // Réponse directe sans wrapper success
                        serviceData = serviceResponse.data;
                    } else if (serviceResponse.data) {
                        serviceData = serviceResponse.data;
                    }
                    
                    if (serviceData) {
                        serviceTitle = serviceData.titre || serviceData.title || serviceData.nom || 'N/A';
                        console.log(`   ✅ Service trouvé: ${serviceTitle} (ID: ${serviceData.id || serviceId})`);
                    } else {
                        console.log(`   ⚠️ Service ${serviceId} - Format de réponse inattendu (status: ${serviceResponse.status})`);
                        console.log(`      Réponse:`, JSON.stringify(serviceResponse.data, null, 2).substring(0, 200));
                        continue;
                    }
                } else {
                    console.log(`   ⚠️ Service ${serviceId} non trouvé (status: ${serviceResponse.status})`);
                    continue;
                }
                
                // Récupérer les produits du service
                const productsUrl = `${API_BASE_URL}/api/services/${serviceId}/products`;
                console.log(`   🔍 Récupération produits: ${productsUrl}`);
                
                const productsResponse = await makeRequest(productsUrl);
                
                let products = [];
                
                // Gérer différents formats de réponse
                if (productsResponse.status === 200) {
                    if (productsResponse.data && productsResponse.data.success && Array.isArray(productsResponse.data.data)) {
                        products = productsResponse.data.data;
                    } else if (Array.isArray(productsResponse.data)) {
                        products = productsResponse.data;
                    } else if (productsResponse.data && productsResponse.data.data && Array.isArray(productsResponse.data.data)) {
                        products = productsResponse.data.data;
                    } else {
                        console.log(`   ⚠️ Format de réponse produits inattendu (status: ${productsResponse.status})`);
                        console.log(`      Réponse:`, JSON.stringify(productsResponse.data, null, 2).substring(0, 300));
                        continue;
                    }
                } else {
                    console.log(`   ⚠️ Erreur récupération produits (status: ${productsResponse.status})`);
                    continue;
                }
                
                console.log(`   ✅ ${products.length} produits trouvés`);
                
                if (products.length === 0) {
                    console.log(`   ℹ️ Aucun produit pour ce service`);
                    continue;
                }
                
                // Étape 3: Analyser chaque produit pour trouver les images
                for (const product of products) {
                    console.log(`\n   📦 Produit Index: ${product.product_index || 'N/A'}`);
                    console.log(`      Nom: ${product.product_name || product.product_data?.nom || 'N/A'}`);
                    
                    // Extraire les images depuis différentes sources
                    const images = [];
                    
                    // Source 1: product.images (direct)
                    if (Array.isArray(product.images)) {
                        images.push(...product.images);
                        console.log(`      ✅ Images directes (product.images): ${product.images.length}`);
                    }
                    
                    // Source 2: product.product_data.images
                    if (product.product_data) {
                        if (Array.isArray(product.product_data.images)) {
                            const newImages = product.product_data.images.filter(img => !images.includes(img));
                            images.push(...newImages);
                            console.log(`      ✅ Images depuis product_data: ${product.product_data.images.length} (${newImages.length} nouvelles)`);
                        }
                        
                        // Afficher la structure de product_data
                        console.log(`      📋 Clés product_data:`, Object.keys(product.product_data).join(', '));
                    }
                    
                    // Source 3: product.videos (pour info)
                    if (Array.isArray(product.videos)) {
                        console.log(`      🎥 Vidéos: ${product.videos.length}`);
                    }
                    
                    console.log(`      📊 Total images trouvées: ${images.length}`);
                    
                    // Étape 4: Tester chaque image
                    if (images.length > 0) {
                        console.log(`      🖼️ Test d'accessibilité des images:`);
                        for (let i = 0; i < Math.min(images.length, 3); i++) {
                            const imageUrl = images[i];
                            const urlType = typeof imageUrl === 'string' ? imageUrl : (imageUrl?.url || imageUrl?.path || imageUrl?.valeur || '');
                            
                            console.log(`         Image ${i + 1}: ${urlType.substring(0, 80)}...`);
                            
                            if (urlType && typeof urlType === 'string') {
                                const testResult = await testImageUrl(urlType);
                                if (testResult.accessible) {
                                    console.log(`            ✅ Accessible (${testResult.contentType || 'type inconnu'}, ${testResult.size || 0} bytes)`);
                                } else {
                                    console.log(`            ❌ Non accessible: ${testResult.error || 'Erreur inconnue'}`);
                                }
                            } else {
                                console.log(`            ⚠️ Format d'URL invalide`);
                            }
                        }
                    } else {
                        console.log(`      ⚠️ Aucune image trouvée pour ce produit`);
                        
                        // ✅ NOUVEAU: Vérifier directement la table media via l'API
                        const mediaUrl = `${API_BASE_URL}/api/media/product/${serviceId}/${product.product_index || product.index || 0}`;
                        console.log(`      🔍 Vérification table media: ${mediaUrl}`);
                        try {
                            const mediaResponse = await makeRequest(mediaUrl);
                            if (mediaResponse.status === 200 && mediaResponse.data) {
                                const mediaData = mediaResponse.data.data || mediaResponse.data;
                                const mediaItems = Array.isArray(mediaData) ? mediaData : (mediaData.items || []);
                                if (mediaItems.length > 0) {
                                    console.log(`      ✅ ${mediaItems.length} média(s) trouvé(s) dans la table media:`);
                                    mediaItems.forEach((media, idx) => {
                                        console.log(`         ${idx + 1}. Type: ${media.type || media.media_type}, Path: ${media.path || media.url || 'N/A'}`);
                                    });
                                } else {
                                    console.log(`      ℹ️ Aucun média dans la table media pour ce produit`);
                                }
                            } else {
                                console.log(`      ⚠️ Erreur récupération media (status: ${mediaResponse.status})`);
                            }
                        } catch (mediaError) {
                            console.log(`      ⚠️ Erreur lors de la vérification media:`, mediaError.message);
                        }
                        
                        console.log(`      📋 Structure complète du produit:`, JSON.stringify(product, null, 2).substring(0, 500));
                    }
                }
                
            } catch (error) {
                console.error(`   ❌ Erreur lors du test du service ${serviceId}:`, error.message);
            }
        }
        
        console.log('\n✅ Test terminé');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}

// Exécuter le test
if (require.main === module) {
    testProductImages().catch(console.error);
}

module.exports = { testProductImages, testImageUrl };

