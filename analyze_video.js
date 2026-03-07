const https = require('https');

// Analyser le produit qui a une vidéo
const analyzeVideoItem = async () => {
    const url = 'https://yukpo-backend-376093909298.europe-west1.run.app/api/content/mixed?limit=50';
    
    console.log('🔍 Analyse du produit avec vidéo...');
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const items = parsed.data || [];
                    
                    const videoItem = items.find(item => 
                        item.data?.videos && item.data.videos.length > 0
                    );
                    
                    if (!videoItem) {
                        console.log('❌ Aucun item avec vidéo trouvé');
                        return resolve(null);
                    }
                    
                    console.log(`\n🎯 Produit avec vidéo trouvé:`);
                    console.log(`   Nom: ${videoItem.data?.nom}`);
                    console.log(`   Service ID: ${videoItem.data?.service_id}`);
                    console.log(`   Content ID: ${videoItem.content_id}`);
                    
                    console.log(`\n📹 Données vidéos brutes:`);
                    console.log(JSON.stringify(videoItem.data?.videos, null, 2));
                    
                    // Simuler la logique de normalizeFeed
                    console.log(`\n🔍 Simulation normalizeFeed:`);
                    
                    const rawVideo = 
                        videoItem?.videoUrl ||
                        videoItem?.video ||
                        videoItem?.data?.videoUrl ||
                        videoItem?.data?.video ||
                        (videoItem?.data?.videos && Array.isArray(videoItem.data.videos) ? videoItem.data.videos[0] : null) ||
                        (videoItem?.videos && Array.isArray(videoItem.videos) ? videoItem.videos[0] : null);
                    
                    console.log(`   rawVideo trouvé: ${rawVideo}`);
                    
                    if (rawVideo) {
                        console.log(`   ✅ Vidéo détectée dans normalizeFeed`);
                        
                        // Vérifier si l'URL est valide
                        try {
                            const videoUrl = new URL(rawVideo);
                            console.log(`   🌐 URL valide: ${videoUrl.protocol}//${videoUrl.host}${videoUrl.pathname}`);
                        } catch (e) {
                            console.log(`   ❌ URL invalide: ${e.message}`);
                            console.log(`   📝 URL brute: "${rawVideo}"`);
                        }
                    } else {
                        console.log(`   ❌ Aucune vidéo détectée par normalizeFeed`);
                    }
                    
                    console.log(`\n🔍 Autres champs vidéo potentiels:`);
                    console.log(`   videoUrl: ${videoItem?.videoUrl}`);
                    console.log(`   video: ${videoItem?.video}`);
                    console.log(`   data.videoUrl: ${videoItem?.data?.videoUrl}`);
                    console.log(`   data.video: ${videoItem?.data?.video}`);
                    console.log(`   videos: ${JSON.stringify(videoItem?.videos)}`);
                    console.log(`   data.videos: ${JSON.stringify(videoItem?.data?.videos)}`);
                    
                    resolve(videoItem);
                } catch (e) {
                    console.log(`❌ Erreur parsing:`, e.message);
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
};

analyzeVideoItem().catch(console.error);
