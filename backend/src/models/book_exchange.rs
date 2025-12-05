// ✅ Modèles pour Bourse du Livre avancée (échanges, recommandations IA, prix, analytics)

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Modèle : Échange de livre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookExchange {
    pub id: i32,
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub initiateur_id: i32,
    pub participant_id: i32,
    pub troc_id: Option<i32>,
    pub exchange_type: String, // "troc", "achat", "vente", "don"
    pub prix_negocie: Option<Decimal>,
    pub statut: String,
    pub rating_initiateur: Option<i32>,
    pub rating_participant: Option<i32>,
    pub comment_initiateur: Option<String>,
    pub comment_participant: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_echange: Option<DateTime<Utc>>,
    pub date_complete: Option<DateTime<Utc>>,
}

/// Modèle : Recommandation IA de livre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookRecommendation {
    pub id: i32,
    pub user_id: Option<i32>,
    pub livre_id: Option<i32>,
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub score_recommendation: Decimal,
    pub reasoning: Option<String>,
    pub alternative_books: Vec<i32>,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Historique des prix
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookPriceHistory {
    pub id: i32,
    pub livre_id: i32,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub etat_livre: Option<String>,
    pub prix_vente: Decimal,
    pub prix_achat: Option<Decimal>,
    pub devise: String,
    pub source_type: String,
    pub source_user_id: Option<i32>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub gps: Option<String>,
    pub created_at: DateTime<Utc>,
    pub is_verified: bool,
}

/// Modèle : Analytics Bourse du Livre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookAnalytics {
    pub id: i32,
    pub user_id: Option<i32>,
    pub livre_id: Option<i32>,
    pub nombre_vues: i32,
    pub nombre_contacts: i32,
    pub nombre_echanges_completes: i32,
    pub nombre_echanges_annules: i32,
    pub score_popularite: Decimal,
    pub score_satisfaction: Option<Decimal>,
    pub repartition_classes: serde_json::Value,
    pub repartition_villes: serde_json::Value,
    pub periode_debut: chrono::NaiveDate,
    pub periode_fin: chrono::NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO : Création recommandation IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBookRecommendationRequest {
    pub classe_actuelle: String,
    pub classe_souhaitee: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub ville: Option<String>,
}

/// DTO : Matching IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMatchingRequest {
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub participant_id: i32,
    pub distance_km: Option<f64>,
    pub etat_livre_offert: Option<String>,
    pub etat_livre_souhaite: Option<String>,
}

/// DTO : Suggestion prix
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSuggestionRequest {
    pub livre_id: i32,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub etat_livre: String,
    pub ville: Option<String>,
    pub prix_marche: Option<f64>,
}
