/**
 * Script pour configurer la Bucket Policy Wasabi via l'API
 * Utilise l'API AWS S3 (compatible Wasabi)
 * 
 * Usage:
 *   node scripts/configure-wasabi-bucket-policy.js
 * 
 * Variables d'environnement requises:
 *   WASABI_ACCESS_KEY ou S3_ACCESS_KEY
 *   WASABI_SECRET_KEY ou S3_SECRET_KEY
 *   WASABI_ENDPOINT ou S3_ENDPOINT (optionnel, par défaut: s3.wasabisys.com)
 *   WASABI_BUCKET ou S3_BUCKET (optionnel, par défaut: yukpo-video-prod)
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const BUCKET_NAME = process.env.WASABI_BUCKET || process.env.S3_BUCKET || 'yukpo-video-prod';
const ACCESS_KEY = process.env.WASABI_ACCESS_KEY || process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.WASABI_SECRET_KEY || process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const ENDPOINT = process.env.WASABI_ENDPOINT || process.env.S3_ENDPOINT || 's3.wasabisys.com';
const REGION = process.env.WASABI_REGION || process.env.S3_REGION || 'eu-central-1';

// Bucket Policy JSON
const BUCKET_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": `arn:aws:s3:::${BUCKET_NAME}/*`
        }
    ]
};

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
 * Génère la signature AWS Signature Version 4
 */
function generateSignature(method, path, queryString, headers, payload, secretKey, accessKey, region, service, endpoint) {
    const algorithm = 'AWS4-HMAC-SHA256';
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', 'T') + 'Z';
    
    // Canonical request
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key.toLowerCase()}:${headers[key]}`)
        .join('\n') + '\n';
    
    const signedHeaders = Object.keys(headers)
        .sort()
        .map(key => key.toLowerCase())
        .join(';');
    
    const canonicalRequest = [
        method,
        path,
        queryString,
        canonicalHeaders,
        signedHeaders,
        crypto.createHash('sha256').update(payload).digest('hex')
    ].join('\n');
    
    // String to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    
    // Authorization header
    const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return { authorization, amzDate, dateStamp };
}

/**
 * Configure la Bucket Policy via l'API S3
 */
function configureBucketPolicy() {
    return new Promise((resolve, reject) => {
        if (!ACCESS_KEY || !SECRET_KEY) {
            reject(new Error('❌ Credentials manquants. Définissez WASABI_ACCESS_KEY et WASABI_SECRET_KEY'));
            return;
        }
        
        const policyJson = JSON.stringify(BUCKET_POLICY);
        const path = `/${BUCKET_NAME}?policy`;
        const host = `${BUCKET_NAME}.${ENDPOINT}`;
        
        const headers = {
            'Host': host,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(policyJson),
        };
        
        const { authorization, amzDate } = generateSignature(
            'PUT',
            path,
            'policy',
            headers,
            policyJson,
            SECRET_KEY,
            ACCESS_KEY,
            REGION,
            's3',
            ENDPOINT
        );
        
        headers['Authorization'] = authorization;
        headers['X-Amz-Date'] = amzDate;
        headers['X-Amz-Content-SHA256'] = crypto.createHash('sha256').update(policyJson).digest('hex');
        
        const options = {
            hostname: host,
            port: 443,
            path: path,
            method: 'PUT',
            headers: headers,
        };
        
        log(`\n🔧 Configuration de la Bucket Policy...`, 'cyan');
        log(`   Bucket: ${BUCKET_NAME}`, 'blue');
        log(`   Endpoint: ${host}`, 'blue');
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 204) {
                    log(`\n✅ Bucket Policy configurée avec succès !`, 'green');
                    log(`   Status: ${res.statusCode}`, 'green');
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    log(`\n❌ Erreur lors de la configuration`, 'red');
                    log(`   Status: ${res.statusCode}`, 'red');
                    log(`   Réponse: ${data}`, 'yellow');
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            log(`\n❌ Erreur réseau: ${error.message}`, 'red');
            reject(error);
        });
        
        req.write(policyJson);
        req.end();
    });
}

/**
 * Vérifie la Bucket Policy actuelle
 */
function getBucketPolicy() {
    return new Promise((resolve, reject) => {
        if (!ACCESS_KEY || !SECRET_KEY) {
            reject(new Error('❌ Credentials manquants'));
            return;
        }
        
        const path = `/${BUCKET_NAME}?policy`;
        const host = `${BUCKET_NAME}.${ENDPOINT}`;
        
        const headers = {
            'Host': host,
        };
        
        const { authorization, amzDate } = generateSignature(
            'GET',
            path,
            'policy',
            headers,
            '',
            SECRET_KEY,
            ACCESS_KEY,
            REGION,
            's3',
            ENDPOINT
        );
        
        headers['Authorization'] = authorization;
        headers['X-Amz-Date'] = amzDate;
        
        const options = {
            hostname: host,
            port: 443,
            path: path,
            method: 'GET',
            headers: headers,
        };
        
        log(`\n🔍 Vérification de la Bucket Policy actuelle...`, 'cyan');
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const policy = JSON.parse(data);
                        log(`\n✅ Bucket Policy actuelle:`, 'green');
                        console.log(JSON.stringify(policy, null, 2));
                        resolve(policy);
                    } catch (e) {
                        log(`\n⚠️ Réponse reçue mais JSON invalide:`, 'yellow');
                        console.log(data);
                        resolve(null);
                    }
                } else if (res.statusCode === 404) {
                    log(`\n⚠️ Aucune Bucket Policy configurée`, 'yellow');
                    resolve(null);
                } else {
                    log(`\n❌ Erreur: ${res.statusCode}`, 'red');
                    log(`   Réponse: ${data}`, 'yellow');
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Fonction principale
 */
async function main() {
    log('\n🚀 CONFIGURATION BUCKET POLICY WASABI', 'cyan');
    log('='.repeat(60), 'cyan');
    
    // Vérifier les credentials
    if (!ACCESS_KEY || !SECRET_KEY) {
        log('\n❌ Credentials manquants !', 'red');
        log('\n📝 Variables d\'environnement requises:', 'yellow');
        log('   - WASABI_ACCESS_KEY ou S3_ACCESS_KEY', 'yellow');
        log('   - WASABI_SECRET_KEY ou S3_SECRET_KEY', 'yellow');
        log('\n💡 Exemple:', 'cyan');
        log('   $env:WASABI_ACCESS_KEY="your-access-key"', 'blue');
        log('   $env:WASABI_SECRET_KEY="your-secret-key"', 'blue');
        log('   node scripts/configure-wasabi-bucket-policy.js', 'blue');
        process.exit(1);
    }
    
    log(`\n✅ Credentials trouvés`, 'green');
    log(`   Bucket: ${BUCKET_NAME}`, 'blue');
    log(`   Endpoint: ${ENDPOINT}`, 'blue');
    log(`   Region: ${REGION}`, 'blue');
    
    try {
        // Vérifier la policy actuelle
        await getBucketPolicy().catch(() => {
            // Ignorer si pas de policy existante
        });
        
        // Configurer la nouvelle policy
        await configureBucketPolicy();
        
        // Vérifier que ça a fonctionné
        log(`\n🔍 Vérification finale...`, 'cyan');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes
        await getBucketPolicy();
        
        log(`\n✅ Configuration terminée avec succès !`, 'green');
        log(`\n📝 Prochaines étapes:`, 'cyan');
        log(`   1. Testez l'accès avec: node scripts/test-wasabi-access.js`, 'blue');
        log(`   2. Vérifiez dans Wasabi Console que la policy est bien configurée`, 'blue');
        log(`   3. Testez dans l'application mobile`, 'blue');
        
    } catch (error) {
        log(`\n❌ Erreur: ${error.message}`, 'red');
        log(`\n💡 Solutions possibles:`, 'yellow');
        log(`   1. Vérifiez que les credentials sont corrects`, 'yellow');
        log(`   2. Vérifiez que le bucket existe: ${BUCKET_NAME}`, 'yellow');
        log(`   3. Vérifiez que vous avez les permissions nécessaires`, 'yellow');
        log(`   4. Essayez de configurer manuellement dans Wasabi Console`, 'yellow');
        process.exit(1);
    }
}

// Exécuter
main().catch(console.error);

