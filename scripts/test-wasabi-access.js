/**
 * Script de test pour vérifier l'accès Wasabi
 * Teste l'accès direct à Wasabi et via CDN
 */

const https = require('https');
const http = require('http');

// Configuration
const WASABI_BASE_URL = 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com';
const CDN_BASE_URL = 'https://cdn.yukpomnang.com';
const API_BASE_URL = process.env.API_BASE_URL || 'https://yukpomnang.onrender.com';

// Couleurs pour la console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Teste l'accès à une URL
 */
function testUrl(url, label) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const startTime = Date.now();
        
        const req = client.request(url, { method: 'HEAD' }, (res) => {
            const duration = Date.now() - startTime;
            const status = res.statusCode;
            const headers = res.headers;
            
            resolve({
                success: status >= 200 && status < 400,
                status,
                duration,
                headers,
                url,
                label,
            });
        });
        
        req.on('error', (error) => {
            const duration = Date.now() - startTime;
            resolve({
                success: false,
                error: error.message,
                duration,
                url,
                label,
            });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout',
                duration: 10000,
                url,
                label,
            });
        });
        
        req.end();
    });
}

/**
 * Teste plusieurs chemins communs
 */
async function testCommonPaths() {
    log('\n🔍 Test des chemins communs Wasabi...\n', 'cyan');
    
    const commonPaths = [
        '/uploads/services/1/images/test.jpg',
        '/uploads/services/1/videos/test.mp4',
        '/uploads/products/1/image.jpg',
        '/uploads/videos/test.mp4',
    ];
    
    const results = [];
    
    for (const path of commonPaths) {
        const wasabiUrl = `${WASABI_BASE_URL}${path}`;
        const cdnUrl = `${CDN_BASE_URL}${path}`;
        
        log(`\n📁 Test: ${path}`, 'blue');
        
        // Test Wasabi direct
        log(`  → Wasabi direct: ${wasabiUrl.substring(0, 80)}...`, 'yellow');
        const wasabiResult = await testUrl(wasabiUrl, 'Wasabi Direct');
        results.push(wasabiResult);
        
        if (wasabiResult.success) {
            log(`  ✅ Wasabi: ${wasabiResult.status} (${wasabiResult.duration}ms)`, 'green');
        } else {
            log(`  ❌ Wasabi: ${wasabiResult.error || wasabiResult.status} (${wasabiResult.duration}ms)`, 'red');
        }
        
        // Test CDN
        log(`  → CDN: ${cdnUrl.substring(0, 80)}...`, 'yellow');
        const cdnResult = await testUrl(cdnUrl, 'CDN');
        results.push(cdnResult);
        
        if (cdnResult.success) {
            log(`  ✅ CDN: ${cdnResult.status} (${cdnResult.duration}ms)`, 'green');
        } else {
            log(`  ❌ CDN: ${cdnResult.error || cdnResult.status} (${cdnResult.duration}ms)`, 'red');
        }
    }
    
    return results;
}

/**
 * Récupère des URLs réelles depuis l'API
 */
async function fetchRealUrls() {
    log('\n🔍 Récupération d\'URLs réelles depuis l\'API...\n', 'cyan');
    
    try {
        const url = `${API_BASE_URL}/api/rechercher-besoin?query=test&limit=1`;
        log(`  → Requête API: ${url}`, 'yellow');
        
        const response = await fetch(url);
        const data = await response.json();
        
        // Extraire les URLs des médias
        const mediaUrls = [];
        
        if (data && Array.isArray(data)) {
            data.forEach((item) => {
                if (item.images && Array.isArray(item.images)) {
                    item.images.forEach((img) => {
                        if (typeof img === 'string' && img.startsWith('http')) {
                            mediaUrls.push(img);
                        }
                    });
                }
                if (item.videos && Array.isArray(item.videos)) {
                    item.videos.forEach((vid) => {
                        if (typeof vid === 'string' && vid.startsWith('http')) {
                            mediaUrls.push(vid);
                        }
                    });
                }
                if (item.product_data?.images) {
                    item.product_data.images.forEach((img) => {
                        if (typeof img === 'string' && img.startsWith('http')) {
                            mediaUrls.push(img);
                        }
                    });
                }
            });
        }
        
        if (mediaUrls.length > 0) {
            log(`  ✅ ${mediaUrls.length} URL(s) trouvée(s)`, 'green');
            return mediaUrls.slice(0, 5); // Limiter à 5 URLs
        } else {
            log(`  ⚠️ Aucune URL trouvée dans la réponse API`, 'yellow');
            return [];
        }
    } catch (error) {
        log(`  ❌ Erreur API: ${error.message}`, 'red');
        return [];
    }
}

/**
 * Teste des URLs réelles
 */
async function testRealUrls(urls) {
    if (urls.length === 0) {
        log('\n⚠️ Aucune URL réelle à tester', 'yellow');
        return;
    }
    
    log('\n🔍 Test des URLs réelles...\n', 'cyan');
    
    const results = [];
    
    for (const url of urls) {
        log(`\n📸 Test: ${url.substring(0, 100)}...`, 'blue');
        
        const result = await testUrl(url, 'URL Réelle');
        results.push(result);
        
        if (result.success) {
            log(`  ✅ ${result.status} (${result.duration}ms)`, 'green');
            if (result.headers['content-type']) {
                log(`  📄 Type: ${result.headers['content-type']}`, 'cyan');
            }
            if (result.headers['content-length']) {
                const sizeMB = (parseInt(result.headers['content-length']) / 1024 / 1024).toFixed(2);
                log(`  📦 Taille: ${sizeMB} MB`, 'cyan');
            }
        } else {
            log(`  ❌ ${result.error || result.status} (${result.duration}ms)`, 'red');
        }
    }
    
    return results;
}

/**
 * Résumé des résultats
 */
function printSummary(allResults) {
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 RÉSUMÉ DES TESTS', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    const total = allResults.length;
    
    log(`\n✅ Succès: ${successful}/${total}`, successful > 0 ? 'green' : 'red');
    log(`❌ Échecs: ${failed}/${total}`, failed > 0 ? 'red' : 'green');
    
    if (failed > 0) {
        log('\n🔴 URLs en échec:', 'red');
        allResults
            .filter(r => !r.success)
            .forEach(r => {
                log(`  - ${r.label}: ${r.url.substring(0, 80)}...`, 'red');
                log(`    Erreur: ${r.error || r.status}`, 'yellow');
            });
    }
    
    // Recommandations
    log('\n💡 RECOMMANDATIONS:', 'cyan');
    
    const wasabiFailed = allResults.filter(r => r.label === 'Wasabi Direct' && !r.success).length;
    const cdnFailed = allResults.filter(r => r.label === 'CDN' && !r.success).length;
    
    if (wasabiFailed > 0) {
        log('  1. ⚠️ Wasabi n\'est pas accessible directement', 'yellow');
        log('     → Vérifiez la Bucket Policy Wasabi', 'yellow');
        log('     → Voir: mobile/CORRECTION_ACCESS_DENIED_WASABI.md', 'yellow');
    }
    
    if (cdnFailed > 0 && wasabiFailed === 0) {
        log('  2. ⚠️ CDN n\'est pas accessible mais Wasabi fonctionne', 'yellow');
        log('     → Vérifiez la configuration Cloudflare Worker', 'yellow');
        log('     → Voir: mobile/CONFIGURATION_CLOUDFLARE_WORKER.md', 'yellow');
    }
    
    if (failed === 0) {
        log('  ✅ Tout fonctionne correctement !', 'green');
    }
    
    log('\n' + '='.repeat(60), 'cyan');
}

/**
 * Fonction principale
 */
async function main() {
    log('\n🚀 TEST D\'ACCÈS WASABI', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const allResults = [];
    
    // Test 1: Chemins communs
    const commonResults = await testCommonPaths();
    allResults.push(...commonResults);
    
    // Test 2: URLs réelles depuis l'API
    const realUrls = await fetchRealUrls();
    if (realUrls.length > 0) {
        const realResults = await testRealUrls(realUrls);
        if (realResults) {
            allResults.push(...realResults);
        }
    }
    
    // Résumé
    printSummary(allResults);
}

// Exécuter
main().catch(console.error);

