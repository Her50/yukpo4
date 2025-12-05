// backend/src/utils/sanitize_logs.rs
// ✅ SÉCURITÉ: Fonctions pour masquer les données sensibles dans les logs

use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    /// Regex pour détecter les emails
    static ref EMAIL_REGEX: Regex = Regex::new(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    ).unwrap();

    /// Regex pour détecter les tokens (longues chaînes alphanumériques)
    static ref TOKEN_REGEX: Regex = Regex::new(
        r"\b[A-Za-z0-9]{20,}\b"
    ).unwrap();

    /// Regex pour détecter les mots de passe dans les logs
    static ref PASSWORD_REGEX: Regex = Regex::new(
        r"(?i)(password|passwd|pwd|mot.?de.?passe)[\s:=]+([^\s,}]+)"
    ).unwrap();
}

/// ✅ SÉCURITÉ: Masque un email en gardant seulement le début et le domaine
/// Exemple: "john.doe@example.com" -> "jo***@example.com"
pub fn mask_email(email: &str) -> String {
    if email.is_empty() {
        return String::new();
    }

    if let Some(at_pos) = email.find('@') {
        if at_pos <= 2 {
            // Si très court, masquer complètement
            format!("***@{}", &email[at_pos + 1..])
        } else {
            // Garder les 2 premiers caractères
            format!("{}***@{}", &email[..2.min(at_pos)], &email[at_pos + 1..])
        }
    } else {
        // Pas d'@, masquer complètement
        "***".to_string()
    }
}

/// ✅ SÉCURITÉ: Masque un token en gardant seulement les premiers et derniers caractères
/// Exemple: "abcdefghijklmnopqrstuvwxyz123456" -> "abc***456"
pub fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        return "***".to_string();
    }

    let keep_chars = 3;
    format!(
        "{}***{}",
        &token[..keep_chars],
        &token[token.len() - keep_chars..]
    )
}

/// ✅ SÉCURITÉ: Nettoie une chaîne de log pour masquer les données sensibles
pub fn sanitize_log_message(message: &str) -> String {
    let mut sanitized = message.to_string();

    // Masquer les emails
    sanitized = EMAIL_REGEX
        .replace_all(&sanitized, |caps: &regex::Captures| {
            mask_email(caps.get(0).unwrap().as_str())
        })
        .to_string();

    // Masquer les mots de passe
    sanitized = PASSWORD_REGEX
        .replace_all(&sanitized, |caps: &regex::Captures| {
            format!("{}: ***", &caps[1])
        })
        .to_string();

    sanitized
}

/// ✅ SÉCURITÉ: Nettoie un email pour les logs
pub fn log_safe_email(email: &str) -> String {
    mask_email(email)
}

/// ✅ SÉCURITÉ: Nettoie un token pour les logs
pub fn log_safe_token(token: &str) -> String {
    mask_token(token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_email() {
        assert_eq!(mask_email("john.doe@example.com"), "jo***@example.com");
        assert_eq!(mask_email("a@example.com"), "***@example.com");
        assert_eq!(mask_email(""), "");
    }

    #[test]
    fn test_mask_token() {
        assert_eq!(mask_token("abcdefghijklmnopqrstuvwxyz123456"), "abc***456");
        assert_eq!(mask_token("short"), "***");
    }

    #[test]
    fn test_sanitize_log_message() {
        let msg = "Login attempt for user@example.com with password secret123";
        let sanitized = sanitize_log_message(msg);
        assert!(sanitized.contains("jo***@example.com"));
        assert!(sanitized.contains("password: ***"));
        assert!(!sanitized.contains("secret123"));
    }
}
