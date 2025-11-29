// backend/src/utils/validation.rs
// ✅ SÉCURITÉ: Utilitaires de validation des entrées utilisateur

use crate::core::types::AppError;
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    /// Email regex - RFC 5322 simplifié
    static ref EMAIL_REGEX: Regex = Regex::new(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    ).unwrap();
    
    /// Mot de passe fort: min 8 caractères, au moins une majuscule, une minuscule, un chiffre
    static ref PASSWORD_REGEX: Regex = Regex::new(
        r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
    ).unwrap();
}

/// ✅ SÉCURITÉ: Valide un email
pub fn validate_email(email: &str) -> Result<(), AppError> {
    if email.is_empty() {
        return Err(AppError::BadRequest("L'email est requis".into()));
    }
    
    if email.len() > 255 {
        return Err(AppError::BadRequest("L'email est trop long (max 255 caractères)".into()));
    }
    
    if !EMAIL_REGEX.is_match(email) {
        return Err(AppError::BadRequest("Format d'email invalide".into()));
    }
    
    Ok(())
}

/// ✅ SÉCURITÉ: Valide la force d'un mot de passe
pub fn validate_password_strength(password: &str) -> Result<(), AppError> {
    if password.is_empty() {
        return Err(AppError::BadRequest("Le mot de passe est requis".into()));
    }
    
    if password.len() < 8 {
        return Err(AppError::BadRequest(
            "Le mot de passe doit contenir au moins 8 caractères".into()
        ));
    }
    
    if password.len() > 128 {
        return Err(AppError::BadRequest(
            "Le mot de passe est trop long (max 128 caractères)".into()
        ));
    }
    
    // Vérifier qu'il contient au moins une majuscule
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err(AppError::BadRequest(
            "Le mot de passe doit contenir au moins une majuscule".into()
        ));
    }
    
    // Vérifier qu'il contient au moins une minuscule
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err(AppError::BadRequest(
            "Le mot de passe doit contenir au moins une minuscule".into()
        ));
    }
    
    // Vérifier qu'il contient au moins un chiffre
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Le mot de passe doit contenir au moins un chiffre".into()
        ));
    }
    
    // Optionnel: vérifier qu'il contient au moins un caractère spécial
    // Commenté pour ne pas être trop strict, mais recommandé
    // if !password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) {
    //     return Err(AppError::BadRequest(
    //         "Le mot de passe doit contenir au moins un caractère spécial".into()
    //     ));
    // }
    
    Ok(())
}

/// ✅ SÉCURITÉ: Valide la longueur d'un champ texte
pub fn validate_text_length(text: &str, field_name: &str, min: usize, max: usize) -> Result<(), AppError> {
    let len = text.trim().len();
    
    if len < min {
        return Err(AppError::BadRequest(
            format!("{} doit contenir au moins {} caractères", field_name, min)
        ));
    }
    
    if len > max {
        return Err(AppError::BadRequest(
            format!("{} est trop long (max {} caractères)", field_name, max)
        ));
    }
    
    Ok(())
}

/// ✅ SÉCURITÉ: Nettoie et valide une chaîne contre les injections
pub fn sanitize_string(input: &str, max_length: usize) -> Result<String, AppError> {
    let cleaned = input.trim();
    
    if cleaned.len() > max_length {
        return Err(AppError::BadRequest(
            format!("Le champ est trop long (max {} caractères)", max_length)
        ));
    }
    
    // Vérifier les caractères dangereux basiques
    if cleaned.contains('\0') {
        return Err(AppError::BadRequest("Caractères non autorisés détectés".into()));
    }
    
    Ok(cleaned.to_string())
}

/// ✅ SÉCURITÉ: Valide un nom (prénom, nom de famille)
pub fn validate_name(name: &str, field_name: &str) -> Result<(), AppError> {
    validate_text_length(name, field_name, 1, 100)?;
    
    // Vérifier que le nom ne contient que des lettres, espaces, tirets et apostrophes
    let name_regex = Regex::new(r"^[a-zA-ZÀ-ÿ\s\-'\.]+$").unwrap();
    if !name_regex.is_match(name) {
        return Err(AppError::BadRequest(
            format!("{} contient des caractères non autorisés", field_name)
        ));
    }
    
    Ok(())
}

/// ✅ SÉCURITÉ: Valide une URL
pub fn validate_url(url: &str) -> Result<(), AppError> {
    if url.is_empty() {
        return Err(AppError::BadRequest("L'URL est requise".into()));
    }
    
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(AppError::BadRequest("L'URL doit commencer par http:// ou https://".into()));
    }
    
    if url.len() > 2048 {
        return Err(AppError::BadRequest("L'URL est trop longue".into()));
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_email() {
        assert!(validate_email("test@example.com").is_ok());
        assert!(validate_email("invalid").is_err());
        assert!(validate_email("").is_err());
    }
    
    #[test]
    fn test_validate_password_strength() {
        assert!(validate_password_strength("Password123").is_ok());
        assert!(validate_password_strength("short").is_err());
        assert!(validate_password_strength("nouppercase123").is_err());
        assert!(validate_password_strength("NOLOWERCASE123").is_err());
        assert!(validate_password_strength("NoNumbers").is_err());
    }
    
    #[test]
    fn test_validate_name() {
        assert!(validate_name("Jean", "Prénom").is_ok());
        assert!(validate_name("Jean-Pierre", "Nom").is_ok());
        assert!(validate_name("O'Brien", "Nom").is_ok());
        assert!(validate_name("Jean123", "Nom").is_err());
        assert!(validate_name("", "Nom").is_err());
    }
}

