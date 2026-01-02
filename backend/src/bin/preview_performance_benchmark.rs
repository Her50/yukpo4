// ✅ Script de benchmark pour mesurer la performance preview
// Usage: cargo run --bin preview_performance_benchmark

use std::time::Instant;
use yukpomnang_backend::services::app_ia::{TimelineScene, VideoTimeline};
use yukpomnang_backend::services::preview_generation_service::{
    generate_quick_preview, QuickPreviewRequest,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔍 Benchmark Performance Preview");
    println!("==================================");
    println!();

    // Créer une timeline de test
    let test_timeline = VideoTimeline {
        total_duration: 30.0,
        scenes: vec![
            TimelineScene {
                scene_index: 0,
                start_time: 0.0,
                duration: 5.0,
                media_id: None,
                media_url: None,
                text: Some("Scène 1".to_string()),
                text_position: Some("center".to_string()),
                transition: Some("fade".to_string()),
                effects: vec!["blur".to_string()],
                audio_cue: None,
            },
            TimelineScene {
                scene_index: 1,
                start_time: 5.0,
                duration: 5.0,
                media_id: None,
                media_url: None,
                text: Some("Scène 2".to_string()),
                text_position: Some("center".to_string()),
                transition: Some("slide".to_string()),
                effects: vec!["glow".to_string()],
                audio_cue: None,
            },
        ],
    };

    let request = QuickPreviewRequest {
        timeline: test_timeline,
        quality: Some("low".to_string()),
        max_duration: Some(10.0),
    };

    // Mesurer plusieurs fois pour avoir une moyenne
    let mut times = Vec::new();
    let iterations = 5;

    println!("Exécution de {} itérations...", iterations);
    println!();

    for i in 1..=iterations {
        let start = Instant::now();

        match generate_quick_preview(request.clone(), None).await {
            Ok(response) => {
                let elapsed = start.elapsed();
                let elapsed_ms = elapsed.as_millis() as u64;
                times.push(elapsed_ms);

                println!(
                    "Itération {}: {}ms (backend: {}ms)",
                    i, elapsed_ms, response.processing_time_ms
                );

                if elapsed_ms < 100 {
                    println!("  ✅ Performance < 100ms");
                } else {
                    println!(
                        "  ⚠️  Performance > 100ms ({}ms au-dessus)",
                        elapsed_ms - 100
                    );
                }
            }
            Err(e) => {
                println!("❌ Erreur itération {}: {}", i, e);
            }
        }
    }

    println!();
    println!("📊 Résultats:");
    println!("-------------");

    if !times.is_empty() {
        let avg = times.iter().sum::<u64>() as f64 / times.len() as f64;
        let min = *times.iter().min().unwrap();
        let max = *times.iter().max().unwrap();

        println!("Moyenne: {:.2}ms", avg);
        println!("Min: {}ms", min);
        println!("Max: {}ms", max);
        println!();

        if avg < 100.0 {
            println!("✅ Performance moyenne < 100ms ({:.2}ms)", avg);
        } else {
            println!(
                "⚠️  Performance moyenne > 100ms ({:.2}ms, {}ms au-dessus)",
                avg,
                avg - 100.0
            );
        }
    }

    Ok(())
}
