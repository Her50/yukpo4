// 📁 examples/multimodal_usage.rs
// Exemple d'utilisation du service d'optimisation multimodale

use serde_json::json;
use yukpomnang_backend::services::multimodal_optimizer::{
    MultimodalConfig, MultimodalOptimizer, OptimizerFactory,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Démonstration du service d'optimisation multimodale");

    // 1. Créer des optimiseurs pour différentes APIs
    let openai_optimizer = OptimizerFactory::for_openai();
    let gemini_optimizer = OptimizerFactory::for_gemini();
    let claude_optimizer = OptimizerFactory::for_claude();

    // 2. Exemple d'image (simulation base64)
    let image_data = b"fake_image_data_for_demo";

    println!("\n📸 Optimisation d'image pour différentes APIs :");

    // OpenAI Vision
    let openai_image = openai_optimizer.optimize_image(image_data, "jpeg").await?;
    println!("✅ OpenAI - Taille optimisée: {} bytes", openai_image.size);

    let openai_format = openai_optimizer.prepare_for_openai_vision(&openai_image).await?;
    println!(
        "🎯 Format OpenAI Vision: {}",
        serde_json::to_string_pretty(&openai_format)?
    );

    // Google Gemini
    let gemini_image = gemini_optimizer.optimize_image(image_data, "jpeg").await?;
    let gemini_format = gemini_optimizer.prepare_for_gemini(&gemini_image).await?;
    println!(
        "🎯 Format Gemini: {}",
        serde_json::to_string_pretty(&gemini_format)?
    );

    // Anthropic Claude
    let claude_image = claude_optimizer.optimize_image(image_data, "jpeg").await?;
    let claude_format = claude_optimizer.prepare_for_claude(&claude_image).await?;
    println!(
        "🎯 Format Claude: {}",
        serde_json::to_string_pretty(&claude_format)?
    );

    // 3. Exemple de PDF
    let pdf_data = b"fake_pdf_data_for_demo";

    println!("\n📄 Optimisation de PDF :");
    let optimized_pdf = openai_optimizer.optimize_pdf(pdf_data).await?;
    println!("✅ PDF optimisé - Taille: {} bytes", optimized_pdf.size);
    println!("📝 Notes: {}", optimized_pdf.optimization_notes);

    // 4. Configuration personnalisée
    let custom_config = MultimodalConfig {
        max_image_size: 1024,
        image_quality: 75,
        max_pdf_pages: 5,
        text_chunk_size: 2000,
        enable_ocr: false,
        enable_preprocessing: true,
    };

    let custom_optimizer = MultimodalOptimizer::new(custom_config);
    let custom_image = custom_optimizer.optimize_image(image_data, "png").await?;
    println!(
        "\n🔧 Optimiseur personnalisé - Taille: {} bytes",
        custom_image.size
    );

    println!("\n🎉 Démonstration terminée avec succès !");

    Ok(())
}
