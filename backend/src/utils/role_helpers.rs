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

// ============================================================================
// Patch H3 (2026-05-12) — Admins de la librairie Yukpo officielle
//
// La Bourse du Livre a une « librairie Yukpo officielle » gérée en interne :
// stock central, opérations marketplace, supervision des libraires partenaires.
// Les admins de cette librairie doivent avoir TOUS les accès admin Bourse,
// au même titre que super_admin/admin globaux.
//
// Les libraires externes (partenaires), eux, sont restreints à leurs propres
// stocks et ventes — ils n'ont PAS accès à marketplace-overview ou aux
// agrégats globaux.
//
// Identification de la librairie officielle (au choix, sans migration DB) :
//   - Variable d'env YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS = "1,42,108"
//     (liste CSV d'IDs utilisateurs qui sont admins de la librairie officielle)
//   - Évolution future : flag DB `users.is_yukpo_official_librairie` quand
//     l'équipe deviendra plus grande.
// ============================================================================

/// Vérifie si le user est admin de la librairie Yukpo officielle (via env var).
/// ⚠️ Source de vérité héritée — préférer `is_yukpo_official_librairie_admin_async`
/// qui interroge le flag DB `users.is_yukpo_official_librairie` (révocable runtime).
pub fn is_yukpo_official_librairie_admin(user_id: i32) -> bool {
    let csv = match std::env::var("YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => return false,
    };
    csv.split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .any(|id| id == user_id)
}

/// ✅ 2026-05-16 — Vérifie le flag DB `users.is_yukpo_official_librairie`
/// avec fallback sur l'env var (transition douce). À privilégier dans les
/// nouveaux endpoints car révocable au runtime sans redéploiement.
pub async fn is_yukpo_official_librairie_admin_async(user_id: i32, pg: &sqlx::PgPool) -> bool {
    // 1) Flag DB prioritaire
    let from_db = sqlx::query_scalar::<_, bool>(
        "SELECT COALESCE(is_yukpo_official_librairie, FALSE) FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten()
    .unwrap_or(false);
    if from_db {
        return true;
    }
    // 2) Fallback env var (legacy)
    is_yukpo_official_librairie_admin(user_id)
}

/// Vérifie qu'un user a accès aux opérations admin de la Bourse du Livre :
///   - super_admin / admin globaux Yukpo
///   - admin de la librairie Yukpo officielle (env var legacy — sync seulement)
///
/// Pour la version async qui consulte aussi le flag DB, utiliser
/// `ensure_bourse_admin_async`.
pub fn ensure_bourse_admin(user: &AuthenticatedUser) -> AppResult<()> {
    if is_admin_role(&user.role) {
        return Ok(());
    }
    if is_yukpo_official_librairie_admin(user.id) {
        return Ok(());
    }
    Err(AppError::Forbidden(
        "Accès réservé aux administrateurs Yukpo et aux admins de la librairie officielle".into(),
    ))
}

/// ✅ 2026-05-16 — Variante async qui consulte le flag DB en plus de l'env var.
/// À utiliser dans les endpoints sensibles (marketplace-overview,
/// recover_consignation, etc.) pour permettre la révocation runtime.
pub async fn ensure_bourse_admin_async(
    user: &AuthenticatedUser,
    pg: &sqlx::PgPool,
) -> AppResult<()> {
    if is_admin_role(&user.role) {
        return Ok(());
    }
    if is_yukpo_official_librairie_admin_async(user.id, pg).await {
        return Ok(());
    }
    Err(AppError::Forbidden(
        "Accès réservé aux administrateurs Yukpo et aux admins de la librairie officielle".into(),
    ))
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
        assert!(!is_admin_role("librairie"));
        assert!(!is_admin_role("libraire"));
    }

    #[test]
    fn test_ensure_admin_role_str() {
        assert!(ensure_admin_role_str("admin").is_ok());
        assert!(ensure_admin_role_str("super_admin").is_ok());
        assert!(ensure_admin_role_str("user").is_err());
    }

    #[test]
    fn test_yukpo_official_librairie_admin_env() {
        std::env::set_var("YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS", "1, 42 , 108");
        assert!(is_yukpo_official_librairie_admin(1));
        assert!(is_yukpo_official_librairie_admin(42));
        assert!(is_yukpo_official_librairie_admin(108));
        assert!(!is_yukpo_official_librairie_admin(99));
        std::env::set_var("YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS", "");
        assert!(!is_yukpo_official_librairie_admin(1));
        std::env::remove_var("YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS");
        assert!(!is_yukpo_official_librairie_admin(1));
    }
}
