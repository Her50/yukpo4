//! Helper : gate les actions sensibles sur la vérification du téléphone.
//!
//! 2026-05-28 — L'auth phone+PIN n'a pas (encore) d'étape OTP. Un fraudeur
//! peut donc squatter un numéro qui n'est pas le sien. Pour neutraliser le
//! gain d'un tel squat, on refuse les actions à risque tant que le compte
//! n'a pas `phone_verified = TRUE` :
//!   * Demande de payout cash (parrainage / wallet)
//!   * Création de troc (envoyer un livre à un inconnu)
//!   * Toute action où un tiers transfère valeur vers le compte
//!
//! Les ACHATS (livres, cahiers) restent permis : l'argent vient du compte
//! lui-même, donc aucun risque pour les autres utilisateurs.
//!
//! Les comptes legacy email+password sont considérés vérifiés (cf. migration
//! 20260528_001 qui force `phone_verified=TRUE` pour eux).

use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

/// Renvoie Ok(()) si le compte est vérifié, ou un 403 explicite sinon.
/// La requête frontend peut alors afficher un message de type "Validez votre
/// numéro chez une librairie partenaire pour activer cette action".
pub async fn require_phone_verified(pool: &PgPool, user_id: i32) -> AppResult<()> {
    let verified: Option<bool> = sqlx::query_scalar(
        "SELECT phone_verified FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("DB phone_verified: {e}")))?;

    match verified {
        Some(true) => Ok(()),
        Some(false) => Err(AppError::Forbidden(
            "Votre numéro doit être vérifié pour cette action. \
             Rendez-vous chez une librairie Yukpo partenaire ou contactez le support."
                .into(),
        )),
        None => Err(AppError::Unauthorized("Utilisateur introuvable".into())),
    }
}
