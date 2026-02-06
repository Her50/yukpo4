// Script de test pour vérifier la configuration ML_MODELS_DIR
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("🔍 Vérification Configuration ML_MODELS_DIR\n");

    // 1. Lire la variable d'environnement
    let model_dir = env::var("ML_MODELS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("models"));

    println!("📁 Répertoire configuré: {:?}", model_dir);

    // 2. Vérifier si le répertoire existe
    if model_dir.exists() {
        println!("✅ Répertoire existe");

        // 3. Lister les fichiers
        match fs::read_dir(&model_dir) {
            Ok(entries) => {
                let files: Vec<_> =
                    entries.filter_map(|e| e.ok()).filter(|e| e.path().is_file()).collect();

                if files.is_empty() {
                    println!("⚠️  Répertoire vide - Aucun modèle trouvé");
                    println!("\n💡 Pour ajouter des modèles:");
                    println!("   - Format recommandé: .onnx");
                    println!("   - Noms attendus:");
                    println!("     * ETAPrediction.onnx");
                    println!("     * DemandForecasting.onnx");
                    println!("     * RouteOptimization.onnx");
                    println!("     * FraudDetection.onnx");
                } else {
                    println!("\n📦 Modèles trouvés ({})", files.len());
                    for file in &files {
                        let path = file.path();
                        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                        let size_mb = size as f64 / 1_000_000.0;
                        println!("   ✅ {:?} ({:.2} MB)", path.file_name().unwrap(), size_mb);
                    }
                }
            }
            Err(e) => {
                println!("❌ Erreur lecture répertoire: {}", e);
            }
        }
    } else {
        println!("❌ Répertoire n'existe pas!");
        println!("\n💡 Créez-le avec: mkdir backend\\models");
    }

    // 4. Informations système
    println!("\n📊 Informations:");
    println!(
        "   Répertoire de travail: {:?}",
        env::current_dir().unwrap_or_default()
    );
    println!(
        "   Chemin absolu: {:?}",
        if model_dir.is_absolute() {
            model_dir.clone()
        } else {
            env::current_dir().unwrap_or_default().join(&model_dir)
        }
    );
}
