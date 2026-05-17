//! Modèle pour les demandes d'achat de livres d'occasion.
//!
//! ✅ 2026-05-16 — Intègre les acheteurs comme nœuds-sinks du DAG de matching.
//! Avant cette table, un acheteur (sans livre à offrir) n'apparaissait jamais
//! dans `find_matching_chaine` — le système ne pouvait donc pas construire
//! une chaîne `V → trocer_B → acheteur_Y` où la cash du buyer débloque la
//! vente du vendeur source.

use crate::models::livre_scolaire::LivreScolaire;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LivreScolaireDemande {
    pub id: i32,
    pub user_id: i32,

    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub matiere: String,
    pub classe_souhaitee: String,
    pub niveau: Option<String>,

    pub budget_max_xaf: Option<f64>,

    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,

    pub panier_item_id: Option<String>,
    pub commande_mixte_id: Option<i32>,

    pub is_active: bool,
    pub is_satisfied: bool,
    pub matched_chaine_id: Option<i32>,

    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLivreDemandeRequest {
    pub titre: String,
    pub matiere: String,
    pub classe_souhaitee: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub niveau: Option<String>,
    pub budget_max_xaf: Option<f64>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub panier_item_id: Option<String>,
    pub commande_mixte_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLivreDemandeRequest {
    pub budget_max_xaf: Option<f64>,
    pub gps: Option<String>,
    pub is_active: Option<bool>,
}

impl LivreScolaireDemande {
    /// Construit une `LivreScolaire` synthétique représentant cette demande
    /// pour l'injecter dans le DAG du matching comme nœud-sink.
    ///
    /// Convention :
    /// - `id` = négatif (`-demande.id`) pour distinguer des vrais livres
    /// - `user_id` = buyer
    /// - `classe_actuelle` = "" (chaîne vide → ne peut pas être sender)
    /// - `classe_souhaitee` = ce que le buyer veut
    /// - `mode_listing` = "demande" (variante dédiée, exclue du tri vente-first)
    /// - Tous les autres champs : valeurs vides/zéro/false sûres.
    pub fn into_synthetic_livre(&self) -> LivreScolaire {
        LivreScolaire {
            id: -self.id,
            service_id: None,
            user_id: self.user_id,
            titre: self.titre.clone(),
            auteur: self.auteur.clone(),
            editeur: self.editeur.clone(),
            isbn: self.isbn.clone(),
            classe_actuelle: String::new(), // ← sender impossible
            classe_souhaitee: self.classe_souhaitee.clone(),
            matiere: self.matiere.clone(),
            niveau: self.niveau.clone(),
            etat_livre: "demande".to_string(),
            description_etat: None,
            images_urls: Vec::new(),
            video_url: None,
            image_recto: None,
            image_verso: None,
            mode_listing: Some("demande".to_string()),
            prix_detecte: None,
            devise_detectee: None,
            valeur_calculee: self.budget_max_xaf.map(Decimal::try_from).and_then(Result::ok),
            ratio_etat: None,
            etat_classification: None,
            programme_scolaire_id: None,
            est_au_programme: None,
            programme_match_details: None,
            ia_analysis_status: None,
            ia_analysis_result: None,
            ia_confidence: None,
            situation_troc: Some("demande".to_string()),
            offre_matchee: None,
            troc_status: None,
            upload_session_id: None,
            gps: self.gps.clone(),
            ville: self.ville.clone(),
            quartier: self.quartier.clone(),
            is_available: true,
            is_active: true,
            created_at: self.created_at,
            updated_at: self.updated_at,
            disponibilite_debut: None,
            disponibilite_fin: None,
        }
    }
}
