// ✅ Tests unitaires pour video_analysis_service

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::services::video_analysis_service::{SceneCut, Highlight, detect_highlights_from_scenes};

    #[test]
    fn test_detect_highlights_from_scenes() {
        let scenes = vec![
            SceneCut {
                start_time: 0.0,
                end_time: 5.0,
                duration: 5.0,
                confidence: 0.9,
                scene_type: "action".to_string(),
                thumbnail_url: None,
                audio_level: -25.0,
                motion_score: 0.85,
            },
            SceneCut {
                start_time: 5.0,
                end_time: 10.0,
                duration: 5.0,
                confidence: 0.7,
                scene_type: "dialogue".to_string(),
                thumbnail_url: None,
                audio_level: -40.0,
                motion_score: 0.3,
            },
        ];

        // Test avec tokio runtime
        let rt = tokio::runtime::Runtime::new().unwrap();
        let highlights = rt.block_on(detect_highlights_from_scenes(&scenes)).unwrap();

        // La première scène devrait être un highlight (motion_score élevé)
        assert!(!highlights.is_empty());
        assert_eq!(highlights[0].start_time, 0.0);
        assert!(highlights[0].score > 0.7);
    }

    #[test]
    fn test_scene_cut_serialization() {
        let scene = SceneCut {
            start_time: 0.0,
            end_time: 5.0,
            duration: 5.0,
            confidence: 0.9,
            scene_type: "action".to_string(),
            thumbnail_url: None,
            audio_level: -25.0,
            motion_score: 0.85,
        };

        let json = serde_json::to_string(&scene).unwrap();
        let deserialized: SceneCut = serde_json::from_str(&json).unwrap();

        assert_eq!(scene.start_time, deserialized.start_time);
        assert_eq!(scene.duration, deserialized.duration);
        assert_eq!(scene.scene_type, deserialized.scene_type);
    }
}

