use whatlang::detect;

/// ?? D?tecte automatiquement la langue d'un texte donn?
pub fn detect_language(text: &str) -> Option<String> {
    detect(text).map(|info| info.lang().code().to_string())
}
