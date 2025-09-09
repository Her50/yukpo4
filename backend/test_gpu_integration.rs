use std::env;
use yukpomnang_backend::services::gpu_detector::GPUDetector;
use yukpomnang_backend::config::production_config::ProductionConfig;
use yukpomnang_backend::services::gpu_optimizer::GPUOptimizer;

/// 🧪 Test d'intégration GPU pour Yukpo
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 Test d'intégration GPU pour Yukpo");
    println!("=====================================");
    
    // 1. Test du détecteur GPU
    println!("\n1. Test du détecteur GPU:");
    let gpu_detector = GPUDetector::new();
    println!("   - GPU disponible: {}", gpu_detector.is_gpu_available());
    println!("   - Type GPU: {:?}", gpu_detector.gpu_type);
    println!("   - CUDA disponible: {}", gpu_detector.cuda_available);
    println!("   - Mémoire GPU: {:?}GB", gpu_detector.memory_gb);
    println!("   - Environnement: {}", if gpu_detector.is_production_environment() { "PRODUCTION" } else { "LOCAL" });
    println!("   - Info complète: {}", gpu_detector.get_gpu_info());
    
    // 2. Test de la configuration de production
    println!("\n2. Test de la configuration de production:");
    let production_config = ProductionConfig::new();
    println!("   - GPU activé: {}", production_config.gpu_enabled);
    println!("   - Environnement: {}", production_config.environment);
    println!("   - Taille max image: {}px", production_config.image_optimization.max_size);
    println!("   - Qualité image: {}", production_config.image_optimization.quality);
    println!("   - Traitement parallèle: {}", production_config.image_optimization.parallel_processing);
    println!("   - Timeout multimodal: {}s", production_config.api_timeouts.multimodal);
    println!("   - Timeout texte: {}s", production_config.api_timeouts.text_only);
    println!("   - Info optimisation: {}", production_config.get_optimization_info());
    
    // 3. Test de l'optimiseur GPU
    println!("\n3. Test de l'optimiseur GPU:");
    let gpu_optimizer = GPUOptimizer::new();
    println!("   - Stats: {}", gpu_optimizer.get_stats());
    
    // 4. Test de simulation d'image
    println!("\n4. Test de simulation d'image:");
    let test_input = yukpomnang_backend::types::MultiModalInput {
        texte: Some("Test d'image avec fournitures scolaires".to_string()),
        base64_image: Some(vec!["fake_image_data_for_test".to_string()]),
        audio_base64: None,
        video_base64: None,
        doc_base64: None,
        excel_base64: None,
        site_web: None,
        gps_mobile: None,
    };
    
    println!("   - Input créé avec 1 image de test");
    println!("   - Texte: {}", test_input.texte.as_ref().unwrap());
    println!("   - Images: {} images", test_input.base64_image.as_ref().unwrap().len());
    
    // 5. Test de conversion optimisée
    println!("\n5. Test de conversion optimisée:");
    let start_time = std::time::Instant::now();
    let optimized_images = gpu_optimizer.convert_all_modals_to_images_optimized(&test_input).await;
    let conversion_time = start_time.elapsed();
    
    println!("   - Temps de conversion: {:?}", conversion_time);
    println!("   - Images générées: {}", optimized_images.len());
    
    // 6. Résumé des performances
    println!("\n6. Résumé des performances:");
    println!("   - Mode: {}", if production_config.gpu_enabled { "GPU" } else { "CPU" });
    println!("   - Optimisation: {}", if production_config.gpu_enabled { "HAUTE" } else { "STANDARD" });
    println!("   - Temps estimé: {}", if production_config.gpu_enabled { "2-5 secondes" } else { "15-30 secondes" });
    
    // 7. Variables d'environnement recommandées
    println!("\n7. Variables d'environnement pour production GPU:");
    println!("   - CUDA_VISIBLE_DEVICES=0");
    println!("   - GPU_AVAILABLE=true");
    println!("   - GPU_TYPE=nvidia");
    println!("   - GPU_MEMORY_GB=16");
    println!("   - RUST_ENV=production");
    
    println!("\n✅ Test d'intégration GPU terminé avec succès!");
    
    Ok(())
} 