//! Script pour générer automatiquement une vidéo exemple
//! 
//! Usage: cargo run --bin generate_example_video

use std::env;
use std::path::Path;
use std::fs;

fn main() {
    println!("🎬 Génération de la vidéo exemple...");
    
    // Créer le dossier examples s'il n'existe pas
    let upload_dir = env::var("UPLOAD_STORAGE_PATH")
        .unwrap_or_else(|_| "./uploads".to_string());
    let examples_dir = Path::new(&upload_dir).join("examples");
    
    if !examples_dir.exists() {
        if let Err(e) = fs::create_dir_all(&examples_dir) {
            eprintln!("❌ Erreur création dossier examples: {}", e);
            return;
        }
        println!("✅ Dossier examples créé: {:?}", examples_dir);
    }
    
    let video_path = examples_dir.join("video-creation-demo.mp4");
    
    // Vérifier si la vidéo existe déjà
    if video_path.exists() {
        println!("⚠️  La vidéo exemple existe déjà: {:?}", video_path);
        println!("   Supprimez-la pour en générer une nouvelle.");
        return;
    }
    
    println!("📝 Instructions pour créer la vidéo exemple:");
    println!("");
    println!("Option 1: Utiliser FFmpeg pour créer une vidéo simple");
    println!("  ffmpeg -f lavfi -i color=c=0xEC4899:s=1920x1080:d=60 -vf \"drawtext=text='Yukpo Video Creation Demo':fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=white\" -t 60 -y {:?}", video_path);
    println!("");
    println!("Option 2: Copier une vidéo existante");
    println!("  cp [chemin_video_existante] {:?}", video_path);
    println!("");
    println!("Option 3: Utiliser le système de génération vidéo de Yukpo");
    println!("  (Voir generate_example_video_via_system.rs)");
    println!("");
    println!("📁 Emplacement cible: {:?}", video_path);
}

