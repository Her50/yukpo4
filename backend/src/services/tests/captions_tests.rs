// ✅ Tests unitaires pour captions_service

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::services::captions_service::{generate_srt_file, format_time_srt, Subtitle};

    #[test]
    fn test_format_time_srt() {
        assert_eq!(format_time_srt(0.0), "00:00:00,000");
        assert_eq!(format_time_srt(65.5), "00:01:05,500");
        assert_eq!(format_time_srt(3661.123), "01:01:01,123");
    }

    #[test]
    fn test_generate_srt_file() {
        let subtitles = vec![
            Subtitle {
                start_time: 0.0,
                end_time: 3.0,
                text: "Premier sous-titre".to_string(),
                confidence: 0.95,
                words: None,
            },
            Subtitle {
                start_time: 3.0,
                end_time: 6.0,
                text: "Deuxième sous-titre".to_string(),
                confidence: 0.95,
                words: None,
            },
        ];

        let srt = generate_srt_file(&subtitles);
        
        assert!(srt.contains("1"));
        assert!(srt.contains("Premier sous-titre"));
        assert!(srt.contains("2"));
        assert!(srt.contains("Deuxième sous-titre"));
        assert!(srt.contains("00:00:00,000"));
        assert!(srt.contains("00:00:03,000"));
    }

    #[test]
    fn test_srt_format_structure() {
        let subtitles = vec![
            Subtitle {
                start_time: 10.5,
                end_time: 15.75,
                text: "Test".to_string(),
                confidence: 0.9,
                words: None,
            },
        ];

        let srt = generate_srt_file(&subtitles);
        let lines: Vec<&str> = srt.lines().collect();
        
        // Structure SRT: numéro, timing, texte, ligne vide
        assert_eq!(lines[0], "1");
        assert!(lines[1].contains("-->"));
        assert_eq!(lines[2], "Test");
    }
}

