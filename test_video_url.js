const https = require('https');

// Tester si l'URL de la vidéo est accessible
const testVideoUrl = async () => {
    const videoUrl = "https://yukpo-project-yukpo-backend-media.storage.googleapis.com/uploads/services/6/videos/video_5a9d3f98-2a59-40a6-a1d5-f5563f58919b.mp4?x-id=GetObject&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=GOOG1ELCEDJ22NILPPCNBCUEV7WZAVCQ6LZOJG2ZOXSSPVYJMVB5SCTCS2Y2B%2F20260303%2Feurope-west1%2Fs3%2Faws4_request&X-Amz-Date=20260303T232435Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=0586787057f05cf2a39d8713fa7e0185ad68c67a1938ba8ed607edb85493b68e";
    
    console.log('🔍 Test de l\'URL de la vidéo...');
    console.log(`URL: ${videoUrl.substring(0, 100)}...`);
    
    return new Promise((resolve, reject) => {
        const req = https.request(videoUrl, { method: 'HEAD' }, (res) => {
            console.log(`\n📊 Status HTTP: ${res.statusCode}`);
            console.log(`📋 Headers:`, Object.keys(res.headers));
            
            if (res.statusCode === 200) {
                console.log(`✅ URL accessible - Content-Type: ${res.headers['content-type']}`);
                console.log(`📏 Content-Length: ${res.headers['content-length'] || 'Inconnu'}`);
            } else {
                console.log(`❌ URL non accessible - Status: ${res.statusCode}`);
                console.log(`📄 Status Message: ${res.statusMessage}`);
            }
            
            resolve(res.statusCode);
        });
        
        req.on('error', (e) => {
            console.log(`💥 Erreur réseau:`, e.message);
            reject(e);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout après 10s'));
        });
        
        req.end();
    });
};

testVideoUrl().catch(console.error);
