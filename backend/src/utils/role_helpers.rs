// ✅ Utilitaires pour la gestion des rôles utilisateur
// Vérifie les rôles admin et super_admin de manière cohérente

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;

/// Vérifie si un utilisateur a le rôle admin ou super_admin
///
/// # Arguments
/// * `role` - Le rôle de l'utilisateur (ex: "admin", "super_admin", "user")
///
/// # Returns
/// `true` si l'utilisateur est admin ou super_admin, `false` sinon
pub fn is_admin_role(role: &str) -> bool {
    matches!(role, "admin" | "super_admin")
}

/// Vérifie si un utilisateur authentifié a le rôle admin ou super_admin
///
/// # Arguments
/// * `user` - L'utilisateur authentifié
///
/// # Returns
/// `true` si l'utilisateur est admin ou super_admin, `false` sinon
pub fn is_admin_user(user: &AuthenticatedUser) -> bool {
    is_admin_role(&user.role)
}

/// Vérifie qu'un utilisateur authentifié a le rôle admin ou super_admin
/// Retourne une erreur si l'utilisateur n'est pas admin
///
/// # Arguments
/// * `user` - L'utilisateur authentifié
///
/// # Returns
/// `Ok(())` si l'utilisateur est admin ou super_admin, `Err(AppError::Forbidden)` sinon
pub fn ensure_admin_role(user: &AuthenticatedUser) -> AppResult<()> {
    if is_admin_user(user) {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".into(),
        ))
    }
}

/// Vérifie qu'un rôle est admin ou super_admin
///
/// # Arguments
/// * `role` - Le rôle à vérifier
///
/// # Returns
/// `Ok(())` si le rôle est admin ou super_admin, `Err(AppError::Forbidden)` sinon
pub fn ensure_admin_role_str(role: &str) -> AppResult<()> {
    if is_admin_role(role) {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_admin_role() {
        assert!(is_admin_role("admin"));
        assert!(is_admin_role("super_admin"));
        assert!(!is_admin_role("user"));
        assert!(!is_admin_role("client"));
        assert!(!is_admin_role("prestataire"));
    }

    #[test]
    fn test_ensure_admin_role_str() {
        assert!(ensure_admin_role_str("admin").is_ok());
        assert!(ensure_admin_role_str("super_admin").is_ok());
        assert!(ensure_admin_role_str("user").is_err());
    }
}
