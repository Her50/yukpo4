use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::controllers::ia_status_controller::IAStats;

/// ? Repr?sente un utilisateur stock? en base
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    /// Cl? primaire
    pub id: i32,
    /// Email unique
    pub email: String,
    /// Mot de passe hach?
    pub password_hash: String,
    /// R?le de l'utilisateur (ex: "user", "admin")
    pub role: String,
    /// Est-ce que cet utilisateur est un prestataire ?
    pub is_provider: bool,
    /// Solde actuel de tokens
    pub tokens_balance: i64,
    /// Prix unitaire des tokens pour les utilisateurs
    pub token_price_user: Option<f64>,
    /// Prix unitaire des tokens pour les prestataires
    pub token_price_provider: Option<f64>,
    /// Pourcentage de commission sur les transactions
    pub commission_pct: Option<f32>,
    /// Langue pr?f?r?e ("fr", "en", etc.)
    pub preferred_lang: Option<String>,
    /// Horodatage de cr?ation
    pub created_at: DateTime<Utc>,
    /// Horodatage de derni?re mise ? jour
    pub updated_at: DateTime<Utc>,
    /// Coordonn?es GPS de l'utilisateur (latitude et longitude)
    pub gps: Option<String>,
    /// Consentement ? l'utilisation des donn?es GPS
    pub gps_consent: bool,
    /// Nom de famille de l'utilisateur
    pub nom: Option<String>,
    /// Prénom de l'utilisateur
    pub prenom: Option<String>,
    /// Nom complet de l'utilisateur
    pub nom_complet: Option<String>,
    /// Chemin vers la photo de profil stockée localement
    pub photo_profil: Option<String>,
    /// URL vers l'avatar de l'utilisateur
    pub avatar_url: Option<String>,
}

impl Default for User {
    fn default() -> Self {
        Self {
            id: 0,
            email: "".to_string(),
            password_hash: "".to_string(),
            role: "user".to_string(),
            is_provider: false,
            tokens_balance: 0,
            token_price_user: None,
            token_price_provider: None,
            commission_pct: None,
            preferred_lang: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            gps: None,
            gps_consent: true, // Défini à true par défaut
            nom: None,
            prenom: None,
            nom_complet: None,
            photo_profil: None,
            avatar_url: None,
        }
    }
}

/// ? Donn?es utilis?es lors de l'inscription d'un nouvel utilisateur
#[derive(Debug, Deserialize)]
pub struct NewUserRequest {
    /// Email saisi
    pub email: String,
    /// Mot de passe d?j? hach?
    pub password_hash: String,
    /// Langue pr?f?r?e (facultative)
    pub lang: Option<String>,
}

/// ? R?ponse standardis?e pour les utilisateurs connect?s
#[derive(Debug, Serialize)]
pub struct UserAuthResponse {
    /// Jeton JWT attribu?
    pub token: String,
    /// Solde de tokens actuel
    pub tokens_balance: i64,
    /// Identifiant utilisateur
    pub user_id: i32,
    /// R?le ("user", "admin", etc.)
    pub role: String,
}

/// ? R?ponse enrichie pour les administrateurs
#[derive(Debug, Serialize)]
pub struct AdminAuthResponse {
    /// Jeton JWT sign?
    pub token: String,
    /// Identifiant de l'admin
    pub user_id: i32,
    /// R?le attendu : "admin"
    pub role: String,
    /// Solde de tokens
    pub tokens_balance: i64,
    /// Statistiques IA actuelles
    pub ia_stats: IAStats,
    /// Permission : gestion des utilisateurs
    pub can_manage_users: bool,
    /// Permission : acc?s aux logs syst?me
    pub can_view_logs: bool,
    /// Permission : r?initialiser ou cr?diter manuellement
    pub can_reset_tokens: bool,
}
