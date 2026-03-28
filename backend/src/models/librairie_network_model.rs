// ✅ NOUVEAU 2026-03-16: Modèles pour le réseau de librairies
// `CommandeMixte` / `ChaineLivraisonUnifiee` (ancienne ébauche) ont été retirés : utiliser `models::librairie_network` pour le schéma SQL `create_librairie_network_tables.sql`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum LibrairieStatut {
    EnAttente,
    Valide,
    Rejete,
    Suspendu,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeFournisseur {
    Librairie,
    FournisseurScolaire,
    Editeur,
    Distributeur,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LivreNeufCommande {
    pub livre_id: i32,
    pub titre: String,
    pub auteur: String,
    pub classe: String,
    pub matiere: String,
    pub prix_unitaire: f64,
    pub quantite: i32,
    pub fournisseur_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LivreOccasionCommande {
    pub livre_id: i32,
    pub titre: String,
    pub auteur: String,
    pub classe: String,
    pub matiere: String,
    pub prix_unitaire: f64,
    pub quantite: i32,
    pub vendeur_id: i32,
    pub qualite: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum CommandeStatut {
    EnAttente,
    Confirmee,
    EnPreparation,
    EnLivraison,
    Livree,
    Annulee,
    Retournee,
}

impl std::fmt::Display for CommandeStatut {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PrixOfficielProgramme {
    pub id: i32,
    pub classe: String,
    pub matiere: String,
    pub titre_livre: String,
    pub auteur: String,
    pub editeur: String,
    pub isbn: Option<String>,
    pub prix_officiel: f64,
    pub devise: String,
    pub annee_scolaire: String,
    pub date_mise_a_jour: DateTime<Utc>,
    pub valide_par: i32,
    pub source: String, // "programme_officiel", "fournisseur", "ia_prediction"
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct QRCodeCoursier {
    pub id: Uuid,
    pub commande_id: Option<Uuid>,
    pub paquet_id: Option<Uuid>,
    pub coursier_id: i32,
    pub code_secret: Option<String>,
    pub qr_code_data: String,
    pub statut: QRStatut,
    pub timestamp_generation: DateTime<Utc>,
    pub date_generation: DateTime<Utc>,
    pub date_scan: Option<DateTime<Utc>>,
    pub location_scan: Option<String>,
    pub valide: bool,
    pub livres_attendus: Option<serde_json::Value>,
    pub destinations: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum QRStatut {
    Genere,
    Scanne,
    Expire,
    Invalide,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct NotificationLibrairie {
    pub id: Uuid,
    pub librairie_id: i32,
    pub user_id: i32,
    pub type_notification: TypeNotification,
    pub titre: String,
    pub message: String,
    pub date_envoi: DateTime<Utc>,
    pub date_lecture: Option<DateTime<Utc>>,
    pub lue: bool,
    pub donnees_supplementaires: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeNotification {
    NouvelleCommande,
    CommandeConfirmee,
    LivraisonPlanifiee,
    PaiementRecu,
    Relance,
    Information,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TransactionAgregee {
    pub id: Uuid,
    pub user_id: i32,
    pub montant: f64,
    pub devise: String,
    pub methode_paiement: MethodePaiement,
    pub statut: TransactionStatut,
    pub reference_fournisseur: String,
    pub date_creation: DateTime<Utc>,
    pub date_validation: Option<DateTime<Utc>>,
    pub frais_transaction: f64,
    pub commission_yukpo: f64,
    pub montant_net: f64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum MethodePaiement {
    OrangeMoney,
    MTNMobileMoney,
    Wave,
    CarteBancaire,
    Wallet,
    VirementBancaire,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TransactionStatut {
    EnAttente,
    Confirme,
    Echoue,
    Annule,
    Rembourse,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum EtapeLivraison {
    CommandeRecue,
    EnPreparation,
    PretPourLivraison,
    EnCoursDeLivraison,
    Livre,
    RetourEnCours,
    RetourReçu,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TraductionSysteme {
    pub id: i32,
    pub cle: String,
    pub langue: String,
    pub traduction: String,
    pub contexte: Option<String>,
    pub date_creation: DateTime<Utc>,
    pub date_mise_a_jour: DateTime<Utc>,
    pub valide: bool,
    pub traduit_par: Option<i32>,
}

// DTOs pour les requêtes API
/// Point de vente / succursale (GPS Yukpo — même réseau, notifications géographiques).
#[derive(Debug, Deserialize, Clone)]
pub struct LibrairieLieuIn {
    #[serde(default)]
    pub libelle: Option<String>,
    pub gps: String,
    #[serde(default)]
    pub ville: Option<String>,
    #[serde(default)]
    pub pays: Option<String>,
    #[serde(default)]
    pub adresse: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLibrairieRequest {
    pub nom: String,
    pub email: String,
    pub telephone: String,
    pub adresse: String,
    pub ville: String,
    pub pays: String,
    pub type_fournisseur: TypeFournisseur,
    pub gps: Option<String>,
    /// Succursales / points de représentation (si vide, un seul « siège » est dérivé du GPS principal).
    #[serde(default)]
    pub lieux: Option<Vec<LibrairieLieuIn>>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateLibrairieRequest {
    pub librairie_id: i32,
    pub action: String, // "valider" ou "rejeter"
    pub motif: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrixOfficielRequest {
    pub prix_officiel: f64,
    pub devise: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotificationRequest {
    pub librairie_id: i32,
    pub user_id: i32,
    pub type_notification: TypeNotification,
    pub titre: String,
    pub message: String,
    pub donnees_supplementaires: Option<serde_json::Value>,
}
