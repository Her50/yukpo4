const https = require('https');

// Vérifier si les services retournés ont des informations de livraison
const checkDeliveryInfo = async () => {
    const url = 'https://yukpo-backend-376093909298.europe-west1.run.app/api/content/mixed?limit=20';
    
    console.log('🔍 Vérification des informations de livraison...');
    
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
                    
                    let itemsWithDelivery = 0;
                    let servicesWithDeliveryConfig = 0;
                    
                    items.forEach((item, index) => {
                        const serviceData = item.data?.service?.data;
                        const hasDelivery = serviceData?.delivery_config || 
                                        serviceData?.delivery_enabled || 
                                        serviceData?.has_delivery ||
                                        serviceData?.delivery_type;
                        
                        if (hasDelivery) {
                            itemsWithDelivery++;
                            console.log(`\n🎯 Item ${index + 1} avec livraison: ${item.data?.nom}`);
                            console.log(`   📦 Service ID: ${item.data?.service_id}`);
                            console.log(`   🚚 Config livraison:`, JSON.stringify(hasDelivery, null, 2));
                        }
                        
                        if (index < 3) {
                            console.log(`\n🔍 Item ${index + 1}: ${item.data?.nom || 'Sans nom'}`);
                            console.log(`   🆔 Service: ${item.data?.service_id}`);
                            console.log(`   🚚 delivery_config: ${serviceData?.delivery_config ? 'OUI' : 'NON'}`);
                            console.log(`   🚚 delivery_enabled: ${serviceData?.delivery_enabled ? 'OUI' : 'NON'}`);
                            console.log(`   🚚 has_delivery: ${serviceData?.has_delivery ? 'OUI' : 'NON'}`);
                            console.log(`   🚚 delivery_type: ${serviceData?.delivery_type || 'NON'}`);
                        }
                    });
                    
                    console.log(`\n📈 Résumé:`);
                    console.log(`   🚚 Items avec livraison: ${itemsWithDelivery}/${items.length} (${(itemsWithDelivery/items.length*100).toFixed(1)}%)`);
                    
                    if (itemsWithDelivery === 0) {
                        console.log(`\n❌ Aucun service n'a de configuration de livraison!`);
                        console.log(`\n💡 Le VideoFeed n'affichera pas de bouton de livraison.`);
                    } else {
                        console.log(`\n✅ ${itemsWithDelivery} services ont une configuration de livraison!`);
                        console.log(`\n💡 Le VideoFeed devrait afficher un bouton de livraison pour ces services.`);
                    }
                    
                    resolve({ items, itemsWithDelivery });
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

checkDeliveryInfo().catch(console.error);
