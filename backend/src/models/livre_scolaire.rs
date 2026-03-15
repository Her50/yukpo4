// ✅ Modèle pour livres scolaires - V2 avec recto/verso, modes, valorisation, IA

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LivreScolaire {
    pub id: i32,
    pub service_id: Option<i32>,
    pub user_id: i32,

    // Informations livre
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: String, // Classe actuelle de l'élève (ex: "6ème", "5ème")
    pub classe_souhaitee: String, // Classe souhaitée (ex: "5ème", "4ème")
    pub matiere: String,         // "Mathématiques", "Français", etc.
    pub niveau: Option<String>,  // "Primaire", "Collège", "Lycée"

    // État et médias
    pub etat_livre: String, // "Neuf", "Très bon", "Bon", "Acceptable"
    pub description_etat: Option<String>,
    #[sqlx(default)]
    pub images_urls: Vec<String>, // URLs des images du livre (stocké en array PostgreSQL ou JSON)
    pub video_url: Option<String>, // URL vidéo d'appréciation de l'état

    // ✅ V2: Images recto/verso
    pub image_recto: Option<String>,
    pub image_verso: Option<String>,

    // ✅ V2: Mode listing (troc, vente, don)
    pub mode_listing: Option<String>, // 'troc', 'vente', 'don'

    // ✅ V2: Prix détecté par IA et valorisation
    pub prix_detecte: Option<Decimal>,
    pub devise_detectee: Option<String>,
    pub valeur_calculee: Option<Decimal>,
    pub ratio_etat: Option<Decimal>, // ex: 0.70 pour "Bon"

    // ✅ V2: Classification état 3 niveaux
    pub etat_classification: Option<String>, // 'bon', 'acceptable', 'rejete'

    // ✅ V2: Programme scolaire
    pub programme_scolaire_id: Option<i32>,
    pub est_au_programme: Option<bool>,
    pub programme_match_details: Option<serde_json::Value>,

    // ✅ V2: Statut analyse IA
    pub ia_analysis_status: Option<String>, // 'pending', 'analyzing', 'done', 'error'
    pub ia_analysis_result: Option<serde_json::Value>,
    pub ia_confidence: Option<Decimal>,

    // ✅ V2: Situation troc
    pub situation_troc: Option<String>, // 'offre', 'offre_demande'
    pub offre_matchee: Option<bool>,

    // ✅ V2: Session d'upload
    pub upload_session_id: Option<String>,

    // Géolocalisation
    pub gps: Option<String>, // Format: "lat,lng"
    pub ville: Option<String>,
    pub quartier: Option<String>,

    // Disponibilité
    pub is_available: bool,
    pub is_active: bool,

    // Métadonnées
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLivreScolaireRequest {
    pub service_id: Option<i32>,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: String,
    pub classe_souhaitee: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub etat_livre: String,
    pub description_etat: Option<String>,
    pub images_urls: Option<Vec<String>>,
    pub video_url: Option<String>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    // ✅ V2
    pub image_recto: Option<String>,
    pub image_verso: Option<String>,
    pub mode_listing: Option<String>,
    pub prix_detecte: Option<f64>,
    pub devise_detectee: Option<String>,
    pub valeur_calculee: Option<f64>,
    pub ratio_etat: Option<f64>,
    pub etat_classification: Option<String>,
    pub programme_scolaire_id: Option<i32>,
    pub est_au_programme: Option<bool>,
    pub ia_analysis_result: Option<serde_json::Value>,
    pub ia_confidence: Option<f64>,
    pub situation_troc: Option<String>,
    pub upload_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLivreScolaireRequest {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub etat_livre: Option<String>,
    pub description_etat: Option<String>,
    pub images_urls: Option<Vec<String>>,
    pub video_url: Option<String>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub is_available: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLivresScolairesRequest {
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub etat_livre: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub gps_lat: Option<f64>, // Pour recherche de proximité
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<f64>, // Rayon de recherche en km (défaut: 10 km)
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    // ✅ V2
    pub mode_listing: Option<String>, // 'troc', 'vente', 'don'
    pub etat_classification: Option<String>, // 'bon', 'acceptable'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivreScolaireWithDistance {
    #[serde(flatten)]
    pub livre: LivreScolaire,
    pub distance_km: Option<f64>,
}

// ============================================================================
// ✅ V2: NOUVEAUX MODÈLES
// ============================================================================

/// Programme scolaire officiel (géré par admin)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProgrammeScolaire {
    pub id: i32,
    pub pays: String,
    pub systeme_educatif: String,
    pub niveau: String,
    pub classe: String,
    pub matiere: String,
    pub titre_livre: String,
    pub auteur_livre: Option<String>,
    pub editeur_livre: Option<String>,
    pub isbn_livre: Option<String>,
    pub annee_scolaire: Option<String>,
    pub est_obligatoire: bool,
    #[sqlx(default)]
    pub keywords: Vec<String>,
    pub prix_officiel: Option<Decimal>,
    pub devise: Option<String>,
    pub created_by: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // V2 Phase 2: Upload fichier + extraction IA
    pub fichier_url: Option<String>,
    pub fichier_type: Option<String>, // 'pdf', 'excel', 'image'
    pub fichier_nom: Option<String>,
    pub periode_academique: Option<String>, // "2025-2026"
    pub date_debut_validite: Option<chrono::NaiveDate>,
    pub date_fin_validite: Option<chrono::NaiveDate>,
    pub extraction_status: Option<String>, // 'pending','extracting','done','error'
    pub extraction_result: Option<serde_json::Value>,
    pub livres_extraits: Option<serde_json::Value>, // [{titre, auteur, classe, matiere...}]
    pub nombre_livres_extraits: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProgrammeScolaireRequest {
    pub pays: Option<String>,
    pub systeme_educatif: Option<String>,
    pub niveau: String,
    pub classe: String,
    pub matiere: String,
    pub titre_livre: String,
    pub auteur_livre: Option<String>,
    pub editeur_livre: Option<String>,
    pub isbn_livre: Option<String>,
    pub annee_scolaire: Option<String>,
    pub est_obligatoire: Option<bool>,
    pub keywords: Option<Vec<String>>,
    pub prix_officiel: Option<f64>,
}

/// Requête upload fichier programme (admin)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadProgrammeFileRequest {
    pub pays: Option<String>,
    pub systeme_educatif: Option<String>,
    pub niveau: String,
    pub classe: Option<String>,     // Peut couvrir toutes les classes
    pub periode_academique: String, // "2025-2026" obligatoire
    pub date_debut_validite: Option<String>, // "2025-09-01"
    pub date_fin_validite: Option<String>, // "2026-07-31"
    pub fichier_base64: String,     // Fichier encodé base64
    pub fichier_nom: String,        // Nom original du fichier
    pub fichier_type: String,       // 'pdf', 'excel', 'image'
}

/// Achat direct d'un livre (sans échange)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookPurchase {
    pub id: i32,
    pub acheteur_id: i32,
    pub livre_id: i32,
    pub vendeur_id: Option<i32>,
    pub prix_achat: Decimal,
    pub commission_app: Option<Decimal>,
    pub montant_vendeur: Option<Decimal>,
    pub frais_livraison: Option<Decimal>,
    pub montant_total: Option<Decimal>,
    pub devise: Option<String>,
    pub package_id: Option<i32>,
    pub mode_livraison: Option<String>, // 'depot_seulement', 'depot_et_recuperation'
    pub adresse_livraison: Option<String>,
    pub gps_livraison: Option<String>,
    pub paiement_statut: Option<String>,
    pub paiement_reference: Option<String>,
    pub paiement_methode: Option<String>,
    pub statut: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Requête achat direct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBookPurchaseRequest {
    pub livre_id: i32,
    pub adresse_livraison: Option<String>,
    pub gps_livraison: Option<String>,
    pub mode_livraison: Option<String>, // 'depot_seulement' par défaut
    pub paiement_methode: Option<String>,
}

/// Livre extrait d'un fichier programme par IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivreExtraitProgramme {
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub prix_officiel: Option<f64>,
    pub est_obligatoire: Option<bool>,
}

/// Session d'upload progressive
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookUploadSession {
    pub id: String, // UUID
    pub user_id: i32,
    pub total_livres: i32,
    pub livres_analyses: i32,
    pub livres_acceptes: i32,
    pub livres_rejetes: i32,
    pub recap_par_classe: serde_json::Value,
    pub valeur_totale: Option<Decimal>,
    pub devise: Option<String>,
    pub gps_recuperation: Option<String>,
    pub adresse_recuperation: Option<String>,
    pub mode_listing_defaut: Option<String>,
    pub statut: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_validation: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUploadSessionRequest {
    pub gps_recuperation: String,
    pub adresse_recuperation: Option<String>,
    pub mode_listing_defaut: Option<String>,
}

/// Paquet de livraison livres
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookDeliveryPackage {
    pub id: i32,
    pub reference: String,
    pub destinataire_id: i32,
    pub destinataire_gps: Option<String>,
    pub destinataire_adresse: Option<String>,
    pub expediteur_id: i32,
    pub expediteur_gps: Option<String>,
    pub expediteur_adresse: Option<String>,
    pub livres: serde_json::Value,
    pub nombre_livres: i32,
    pub troc_ids: Option<serde_json::Value>,
    pub delivery_id: Option<i32>,
    pub coursier_id: Option<i32>,
    pub valeur_totale: Option<Decimal>,
    pub commission_app: Option<Decimal>,
    pub frais_livraison: Option<Decimal>,
    pub montant_net_a_payer: Option<Decimal>,
    pub devise: Option<String>,
    pub statut: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_constitution: Option<DateTime<Utc>>,
    pub date_livraison: Option<DateTime<Utc>>,
    pub date_confirmation: Option<DateTime<Utc>>,
}

/// Commission sur transaction livre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookExchangeCommission {
    pub id: i32,
    pub livre_id: i32,
    pub troc_id: Option<i32>,
    pub package_id: Option<i32>,
    pub vendeur_id: Option<i32>,
    pub acheteur_id: Option<i32>,
    pub type_transaction: String,
    pub valeur_livre: Decimal,
    pub taux_commission: Decimal,
    pub montant_commission: Decimal,
    pub montant_reversement_vendeur: Option<Decimal>,
    pub devise: Option<String>,
    pub reversement_statut: Option<String>,
    pub reversement_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Demande de don de livre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookDonationRequest {
    pub id: i32,
    pub demandeur_id: i32,
    pub livre_id: i32,
    pub motif: String,
    pub justificatif_url: Option<String>,
    pub est_verifie: bool,
    pub verifie_par: Option<i32>,
    pub verification_date: Option<DateTime<Utc>>,
    pub verification_notes: Option<String>,
    pub statut: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDonationRequestPayload {
    pub livre_id: i32,
    pub motif: String,
    pub justificatif_url: Option<String>,
}

// ============================================================================
// CONSTANTES DE VALORISATION
// ============================================================================

/// Ratios de valorisation par état de classification
/// - "bon" : le livre est en très bon état → 70% du prix détecté
/// - "acceptable" : le livre est usé mais utilisable → 40% du prix détecté
/// - "rejete" : le livre est trop dégradé → valeur 0
pub const RATIO_ETAT_BON: f64 = 0.70;
pub const RATIO_ETAT_ACCEPTABLE: f64 = 0.40;
pub const RATIO_ETAT_REJETE: f64 = 0.0;

/// Taux de commission de l'application (20%)
pub const TAUX_COMMISSION_APP: f64 = 0.20;

/// Calculer la valeur d'un livre selon son état et son prix détecté
pub fn calculer_valeur_livre(prix_detecte: f64, etat_classification: &str) -> (f64, f64) {
    let ratio = match etat_classification {
        "bon" => RATIO_ETAT_BON,
        "acceptable" => RATIO_ETAT_ACCEPTABLE,
        "rejete" => RATIO_ETAT_REJETE,
        _ => RATIO_ETAT_ACCEPTABLE,
    };
    let valeur = prix_detecte * ratio;
    (valeur, ratio)
}

/// Calculer le montant net à payer pour un échange
/// montant_net = (valeur_livres_recus + commission + frais_livraison) - valeur_livres_donnes
pub fn calculer_montant_net(
    valeur_livres_recus: f64,
    valeur_livres_donnes: f64,
    frais_livraison: f64,
) -> (f64, f64) {
    let commission = valeur_livres_recus * TAUX_COMMISSION_APP;
    let montant_net = (valeur_livres_recus + commission + frais_livraison) - valeur_livres_donnes;
    (montant_net.max(0.0), commission)
}

/// Générer une référence simple pour un paquet (ex: "BL-A1B2")
pub fn generer_reference_paquet() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
    let code: String = (0..4).map(|_| chars[rng.gen_range(0..chars.len())]).collect();
    format!("BL-{}", code)
}
