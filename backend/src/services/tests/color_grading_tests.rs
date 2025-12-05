// ✅ Tests unitaires pour color_grading_service

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::services::color_grading_service::{get_color_grading_preset, ColorAdjustments};

    #[test]
    fn test_get_color_grading_presets() {
        // Test que tous les presets existent
        let presets = ["cinematic", "vibrant", "moody", "warm", "cool"];
        
        for preset_name in presets.iter() {
            let preset = get_color_grading_preset(preset_name);
            assert!(preset.is_some(), "Preset '{}' devrait exister", preset_name);
            
            let adjustments = preset.unwrap();
            // Vérifier que les valeurs sont dans des plages raisonnables
            assert!(adjustments.exposure >= -1.0 && adjustments.exposure <= 1.0);
            assert!(adjustments.contrast >= -1.0 && adjustments.contrast <= 1.0);
            assert!(adjustments.saturation >= -1.0 && adjustments.saturation <= 1.0);
        }
    }

    #[test]
    fn test_preset_cinematic() {
        let preset = get_color_grading_preset("cinematic").unwrap();
        
        // Le preset cinematic devrait avoir un contraste élevé et saturation réduite
        assert!(preset.contrast > 0.0);
        assert!(preset.saturation < 0.0);
    }

    #[test]
    fn test_preset_vibrant() {
        let preset = get_color_grading_preset("vibrant").unwrap();
        
        // Le preset vibrant devrait avoir une saturation élevée
        assert!(preset.saturation > 0.0);
        assert!(preset.vibrance > 0.0);
    }

    #[test]
    fn test_preset_unknown() {
        let preset = get_color_grading_preset("unknown_preset");
        assert!(preset.is_none());
    }
}

