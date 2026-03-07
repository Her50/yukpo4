const https = require('https');

// Vérifier s'il y a des produits avec des vidéos
const checkVideosInDB = async () => {
    const url = 'https://yukpo-backend-376093909298.europe-west1.run.app/api/content/mixed?limit=50';
    
    console.log('🔍 Vérification des produits avec vidéos...');
    
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
                    
                    console.log(`\n📊 Total items: ${items.length}`);
                    
                    let itemsWithVideos = 0;
                    let itemsWithImages = 0;
                    let paidItems = 0;
                    
                    items.forEach((item, index) => {
                        const hasVideo = item.data?.videos && item.data.videos.length > 0;
                        const hasImages = item.data?.images && item.data.images.length > 0;
                        const isPaid = item.is_paid;
                        
                        if (hasVideo) itemsWithVideos++;
                        if (hasImages) itemsWithImages++;
                        if (isPaid) paidItems++;
                        
                        if (index < 5) {
                            console.log(`\n🎯 Item ${index + 1}: ${item.data?.nom || 'Sans nom'}`);
                            console.log(`   📹 Vidéos: ${item.data?.videos?.length || 0}`);
                            console.log(`   🖼️  Images: ${item.data?.images?.length || 0}`);
                            console.log(`   💰 Paid: ${isPaid}`);
                            console.log(`   🆔 Service: ${item.data?.service_id}`);
                        }
                    });
                    
                    console.log(`\n📈 Résumé:`);
                    console.log(`   📹 Items avec vidéos: ${itemsWithVideos}/${items.length} (${(itemsWithVideos/items.length*100).toFixed(1)}%)`);
                    console.log(`   🖼️  Items avec images: ${itemsWithImages}/${items.length} (${(itemsWithImages/items.length*100).toFixed(1)}%)`);
                    console.log(`   💰 Items payants: ${paidItems}/${items.length} (${(paidItems/items.length*100).toFixed(1)}%)`);
                    
                    if (itemsWithVideos === 0) {
                        console.log(`\n❌ PROBLÈME CONFIRMÉ: Aucun produit n'a de vidéos !`);
                        console.log(`\n💡 Solutions:`);
                        console.log(`   1. Ajoutez des vidéos aux produits via l'application mobile`);
                        console.log(`   2. Vérifiez que les vidéos sont correctement uploadées`);
                        console.log(`   3. Le VideoFeed filtrera les items sans vidéos (comportement normal)`);
                    }
                    
                    resolve({ items, itemsWithVideos, itemsWithImages, paidItems });
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

checkVideosInDB().catch(console.error);
