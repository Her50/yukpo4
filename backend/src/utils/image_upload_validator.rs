// ✅ Patch sécurité C4 (2026-05-12) — Validation des uploads d'images base64
//
// Tous les endpoints Bourse du Livre qui acceptent des images encodées en
// base64 (scan recto-verso, scan programme scolaire, photo livre standalone)
// passent par ce validateur avant d'envoyer les bytes à l'IA ou au CDN.
//
// Vérifications :
//   1. Le base64 décode correctement (formé).
//   2. La taille décodée ≤ MAX_IMAGE_BYTES (anti-DoS storage et coût LLM).
//   3. Les magic bytes correspondent à un type image/PDF supporté
//      (anti-RCE via polyglottes, anti-uploads d'exécutables).
//
// La défense en profondeur se complète côté infra par :
//   - DefaultBodyLimit sur les routes (10 MB pour scan unique, 15 MB pour batch)
//   - Quota / rate-limit côté middleware (à venir, ticket dédié)
//   - Scan AV externe (ClamAV) avant publication CDN (à venir)

use crate::core::types::AppError;
use base64::Engine;

/// Taille maximale d'une image décodée (avant base64). 5 MB suffisent largement
/// pour une photo HD 4000×3000 JPEG compressée (qualité 85 ≈ 2-3 MB).
/// Permet de bloquer les payloads anormaux ou intentionnellement gonflés.
pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

/// Taille maximale d'un fichier programme (PDF/Excel ou image scannée).
/// Plus haut que MAX_IMAGE_BYTES car une liste scolaire scannée peut faire
/// plusieurs pages.
pub const MAX_PROGRAMME_BYTES: usize = 15 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectedKind {
    Jpeg,
    Png,
    Webp,
    Gif,
    Pdf,
    HeicHeif,
    /// XLSX / DOCX / PPTX (ZIP-based Office documents)
    OfficeOpenXml,
    /// XLS / DOC / PPT legacy (OLE Compound Document)
    OfficeLegacy,
}

impl DetectedKind {
    pub fn mime(&self) -> &'static str {
        match self {
            DetectedKind::Jpeg => "image/jpeg",
            DetectedKind::Png => "image/png",
            DetectedKind::Webp => "image/webp",
            DetectedKind::Gif => "image/gif",
            DetectedKind::Pdf => "application/pdf",
            DetectedKind::HeicHeif => "image/heic",
            DetectedKind::OfficeOpenXml => {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            DetectedKind::OfficeLegacy => "application/vnd.ms-excel",
        }
    }

    pub fn is_image(&self) -> bool {
        matches!(
            self,
            DetectedKind::Jpeg
                | DetectedKind::Png
                | DetectedKind::Webp
                | DetectedKind::Gif
                | DetectedKind::HeicHeif
        )
    }

    pub fn is_document(&self) -> bool {
        matches!(
            self,
            DetectedKind::Pdf | DetectedKind::OfficeOpenXml | DetectedKind::OfficeLegacy
        )
    }
}

/// Décode et valide un payload base64. Si le champ commence par
/// `data:<mime>;base64,…`, le préfixe est strippé automatiquement.
pub fn decode_and_validate_image(
    input: &str,
    max_bytes: usize,
) -> Result<(Vec<u8>, DetectedKind), AppError> {
    if input.trim().is_empty() {
        return Err(AppError::BadRequest("Image vide".to_string()));
    }

    // Strip data URI prefix s'il existe
    let b64 = if let Some(idx) = input.find(',') {
        if input.starts_with("data:") {
            &input[idx + 1..]
        } else {
            input
        }
    } else {
        input
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| AppError::BadRequest(format!("Base64 invalide: {}", e)))?;

    if bytes.len() > max_bytes {
        return Err(AppError::BadRequest(format!(
            "Image trop volumineuse : {} octets (max {} MB)",
            bytes.len(),
            max_bytes / (1024 * 1024)
        )));
    }

    if bytes.len() < 12 {
        return Err(AppError::BadRequest(
            "Fichier trop petit pour être une image valide".to_string(),
        ));
    }

    let kind = detect_kind(&bytes).ok_or_else(|| {
        AppError::BadRequest(
            "Format de fichier non supporté (formats acceptés : JPEG, PNG, WebP, GIF, PDF, HEIC)"
                .to_string(),
        )
    })?;

    Ok((bytes, kind))
}

/// Détection par magic bytes. Référence : https://en.wikipedia.org/wiki/List_of_file_signatures
pub fn detect_kind(bytes: &[u8]) -> Option<DetectedKind> {
    if bytes.len() < 12 {
        return None;
    }
    // JPEG : FF D8 FF
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(DetectedKind::Jpeg);
    }
    // PNG : 89 50 4E 47 0D 0A 1A 0A
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(DetectedKind::Png);
    }
    // GIF : "GIF87a" ou "GIF89a"
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(DetectedKind::Gif);
    }
    // WebP : "RIFF" + 4 bytes + "WEBP"
    if bytes.starts_with(b"RIFF") && bytes.len() >= 12 && &bytes[8..12] == b"WEBP" {
        return Some(DetectedKind::Webp);
    }
    // PDF : "%PDF-"
    if bytes.starts_with(b"%PDF-") {
        return Some(DetectedKind::Pdf);
    }
    // HEIC / HEIF : box 'ftyp' à l'offset 4, marqueurs heic/heix/mif1/msf1
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        let brand = &bytes[8..12];
        if matches!(
            brand,
            b"heic" | b"heix" | b"mif1" | b"msf1" | b"hevc" | b"hevx" | b"heim" | b"heis"
        ) {
            return Some(DetectedKind::HeicHeif);
        }
    }
    // XLSX / DOCX / PPTX = ZIP container : "PK\x03\x04"
    if bytes.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
        return Some(DetectedKind::OfficeOpenXml);
    }
    // XLS / DOC / PPT legacy = OLE2 : D0 CF 11 E0 A1 B1 1A E1
    if bytes.starts_with(&[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) {
        return Some(DetectedKind::OfficeLegacy);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_jpeg() {
        assert_eq!(
            detect_kind(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]),
            Some(DetectedKind::Jpeg)
        );
    }

    #[test]
    fn detects_png() {
        let png_header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
        assert_eq!(detect_kind(&png_header), Some(DetectedKind::Png));
    }

    #[test]
    fn rejects_random_bytes() {
        let payload = [0x00u8; 64];
        assert_eq!(detect_kind(&payload), None);
    }

    #[test]
    fn rejects_executable() {
        // PE (Windows .exe) : MZ header
        assert_eq!(
            detect_kind(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"),
            None
        );
    }

    #[test]
    fn enforces_max_size() {
        let huge = base64::engine::general_purpose::STANDARD.encode(vec![0u8; MAX_IMAGE_BYTES + 1]);
        let res = decode_and_validate_image(&huge, MAX_IMAGE_BYTES);
        assert!(res.is_err());
        assert!(res.unwrap_err().to_string().contains("trop volumineuse"));
    }
}
