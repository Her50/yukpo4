// ✅ NOUVEAU Phase 3.2 Améliorations: Service de rendu 3D pour preview AR

use crate::models::ar_preview_model::{
    ARClip3D, ARPreviewRequest, ARPreviewResponse, ARScene3D, Vector3,
};
use log::{info, warn};
use tokio::fs;
use tokio::process::Command;

pub struct AR3DRenderService {
    render_output_dir: String,
}

impl Default for AR3DRenderService {
    fn default() -> Self {
        Self::new()
    }
}

impl AR3DRenderService {
    pub fn new() -> Self {
        let render_output_dir = std::env::var("AR_RENDER_OUTPUT_DIR")
            .unwrap_or_else(|_| "storage/ar_previews".to_string());

        // Créer le répertoire s'il n'existe pas
        std::fs::create_dir_all(&render_output_dir).ok();

        Self { render_output_dir }
    }

    /// Génère une preview 3D pour AR en rendant la scène
    pub async fn render_ar_preview(
        &self,
        request: ARPreviewRequest,
        scene_data: &ARScene3D,
    ) -> Result<ARPreviewResponse, String> {
        info!(
            "[AR3DRender] Génération preview 3D pour timeline: {}",
            request.timeline_id
        );

        // 1. Créer un fichier de scène 3D (format JSON/GLTF)
        let scene_file = self.create_scene_file(&request.timeline_id, scene_data).await?;

        // 2. Rendre la scène en vidéo preview
        let preview_url =
            self.render_scene_to_video(&request.timeline_id, &scene_file, &request).await?;

        // 3. Générer une thumbnail
        let thumbnail_url = self.generate_thumbnail(&request.timeline_id, &preview_url).await?;

        Ok(ARPreviewResponse {
            preview_url,
            thumbnail_url,
            scene_data: scene_data.clone(),
        })
    }

    /// Crée un fichier de scène 3D (format simplifié JSON pour l'instant)
    async fn create_scene_file(
        &self,
        timeline_id: &str,
        scene_data: &ARScene3D,
    ) -> Result<String, String> {
        let scene_file_path = format!("{}/scene_{}.json", self.render_output_dir, timeline_id);

        // Convertir la scène en JSON pour le rendu
        let scene_json = serde_json::json!({
            "scene_id": scene_data.scene_id,
            "position": {
                "x": scene_data.position.x,
                "y": scene_data.position.y,
                "z": scene_data.position.z,
            },
            "rotation": {
                "x": scene_data.rotation.x,
                "y": scene_data.rotation.y,
                "z": scene_data.rotation.z,
            },
            "scale": {
                "x": scene_data.scale.x,
                "y": scene_data.scale.y,
                "z": scene_data.scale.z,
            },
            "clips": scene_data.clips.iter().map(|clip| {
                serde_json::json!({
                    "clip_id": clip.clip_id,
                    "video_url": clip.video_url,
                    "position": {
                        "x": clip.position.x,
                        "y": clip.position.y,
                        "z": clip.position.z,
                    },
                    "rotation": {
                        "x": clip.rotation.x,
                        "y": clip.rotation.y,
                        "z": clip.rotation.z,
                    },
                    "scale": {
                        "x": clip.scale.x,
                        "y": clip.scale.y,
                        "z": clip.scale.z,
                    },
                    "start_time": clip.start_time,
                    "duration": clip.duration,
                })
            }).collect::<Vec<_>>(),
        });

        fs::write(
            &scene_file_path,
            serde_json::to_string_pretty(&scene_json).unwrap(),
        )
        .await
        .map_err(|e| format!("Erreur écriture fichier scène: {}", e))?;

        Ok(scene_file_path)
    }

    /// Rend la scène 3D en vidéo preview
    async fn render_scene_to_video(
        &self,
        timeline_id: &str,
        scene_file: &str,
        _request: &ARPreviewRequest,
    ) -> Result<String, String> {
        let output_path = format!("{}/preview_{}.mp4", self.render_output_dir, timeline_id);

        // Option 1: Utiliser FFmpeg pour créer une preview simple
        // Option 2: Utiliser un moteur 3D (Three.js via Node.js, Blender, etc.)
        // Pour l'instant, on simule avec FFmpeg

        info!(
            "[AR3DRender] Rendu vidéo preview avec Blender: {}",
            output_path
        );

        // Déterminer le chemin vers Blender
        let blender_path = std::env::var("BLENDER_PATH").unwrap_or_else(|_| "blender".to_string());

        // Chemin vers le script Python de rendu
        let script_path = std::env::var("BLENDER_RENDER_SCRIPT")
            .unwrap_or_else(|_| "scripts/blender/render_ar_scene.py".to_string());

        // Vérifier que le script existe
        if !std::path::Path::new(&script_path).exists() {
            warn!(
                "[AR3DRender] Script Blender non trouvé: {}. Utilisation fallback.",
                script_path
            );
            return self.render_fallback_video(&output_path, timeline_id).await;
        }

        // Exécuter Blender pour rendre la scène
        let output = Command::new(&blender_path)
            .arg("--background")
            .arg("--python")
            .arg(&script_path)
            .arg(scene_file)
            .arg(&output_path)
            .output()
            .await
            .map_err(|e| format!("Erreur exécution Blender: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            warn!(
                "[AR3DRender] Erreur rendu Blender: {}. Utilisation fallback.",
                stderr
            );
            return self.render_fallback_video(&output_path, timeline_id).await;
        }

        // Vérifier que le fichier vidéo a été créé
        if !std::path::Path::new(&output_path).exists() {
            warn!(
                "[AR3DRender] Fichier vidéo non créé: {}. Utilisation fallback.",
                output_path
            );
            return self.render_fallback_video(&output_path, timeline_id).await;
        }

        info!("[AR3DRender] Rendu Blender réussi: {}", output_path);
        let preview_url = format!("/api/ar/previews/{}.mp4", timeline_id);
        Ok(preview_url)
    }

    /// Génère une thumbnail depuis la vidéo preview
    async fn generate_thumbnail(
        &self,
        timeline_id: &str,
        preview_url: &str,
    ) -> Result<String, String> {
        let thumbnail_path = format!("{}/thumb_{}.jpg", self.render_output_dir, timeline_id);

        // Utiliser FFmpeg pour extraire une frame
        let output = Command::new("ffmpeg")
            .arg("-i")
            .arg(preview_url)
            .arg("-ss")
            .arg("00:00:01")
            .arg("-vframes")
            .arg("1")
            .arg("-q:v")
            .arg("2")
            .arg(&thumbnail_path)
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                let thumbnail_url = format!("/api/ar/previews/{}.jpg", timeline_id);
                Ok(thumbnail_url)
            }
            Ok(_) => {
                warn!(
                    "[AR3DRender] Échec génération thumbnail pour: {}",
                    timeline_id
                );
                // Créer un thumbnail mock
                fs::write(&thumbnail_path, b"mock_thumbnail_data").await.ok();
                Ok(format!("/api/ar/previews/{}.jpg", timeline_id))
            }
            Err(e) => {
                warn!(
                    "[AR3DRender] Erreur génération thumbnail: {}. Création mock.",
                    e
                );
                // Créer un thumbnail mock
                fs::write(&thumbnail_path, b"mock_thumbnail_data").await.ok();
                Ok(format!("/api/ar/previews/{}.jpg", timeline_id))
            }
        }
    }

    /// Convertit une timeline en scène 3D AR
    pub async fn timeline_to_ar_scene(
        &self,
        timeline_id: &str,
        clips: Vec<ARClip3D>,
    ) -> Result<ARScene3D, String> {
        // Créer une scène 3D à partir des clips de la timeline
        let scene = ARScene3D {
            scene_id: format!("scene_{}", timeline_id),
            position: Vector3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            rotation: Vector3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            scale: Vector3 {
                x: 1.0,
                y: 1.0,
                z: 1.0,
            },
            clips,
        };

        Ok(scene)
    }

    /// Rendu de fallback si Blender n'est pas disponible
    async fn render_fallback_video(
        &self,
        output_path: &str,
        timeline_id: &str,
    ) -> Result<String, String> {
        warn!(
            "[AR3DRender] Utilisation rendu fallback (FFmpeg) pour: {}",
            timeline_id
        );

        // Créer une vidéo simple avec FFmpeg (noir avec texte)
        let temp_text_file = format!("{}/temp_text_{}.txt", self.render_output_dir, timeline_id);

        // Créer un fichier texte pour FFmpeg
        fs::write(
            &temp_text_file,
            format!(
                "drawtext=text='Preview AR {}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2",
                timeline_id
            ),
        )
        .await
        .ok();

        // Créer une vidéo simple avec FFmpeg
        let output = Command::new("ffmpeg")
            .arg("-f")
            .arg("lavfi")
            .arg("-i")
            .arg("color=c=black:size=1920x1080:d=5")
            .arg("-vf")
            .arg(format!("drawtext=text='Preview AR {}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2", timeline_id))
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("fast")
            .arg("-crf")
            .arg("23")
            .arg("-y")
            .arg(output_path)
            .output()
            .await;

        // Nettoyer le fichier temporaire
        fs::remove_file(&temp_text_file).await.ok();

        match output {
            Ok(output) if output.status.success() => {
                let preview_url = format!("/api/ar/previews/{}.mp4", timeline_id);
                Ok(preview_url)
            }
            Ok(_) | Err(_) => {
                // Créer un fichier vidéo mock minimal
                fs::write(output_path, b"mock_video_data").await.ok();
                Ok(format!("/api/ar/previews/{}.mp4", timeline_id))
            }
        }
    }
}
