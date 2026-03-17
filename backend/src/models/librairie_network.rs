// ✅ MODÈLES AVANCÉS RÉSEAU LIBRAIRIES - Système intelligent de distribution

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ========================================
// PARTENAIRE LIBRAIRIE (Vendeur de livres neufs)
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LibrairiePartner {
    pub id: Uuid,
    pub user_id: Uuid,
    pub nom: String,
    pub email: String,
    pub telephone: Option<String>,
    pub gps: String, // "lat,lng"
    pub ville: String,
    pub quartier: Option<String>,
    pub rayon_service_km: i32, // Rayon de service en km
    pub statut: LibrairieStatut,
    pub rating: f64, // Note moyenne 0-5
    pub temps_moyen_validation: i32, // Temps moyen validation (minutes)
    pub commission_app: f64, // Taux commission (5% par défaut)
    pub est_actif: bool,
    pub horaires_ouverture: Option<String>, // "08:00-18:00"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum LibrairieStatut {
    Actif,
    Inactif,
    Suspendu,
    EnValidation,
}

// ========================================
// COMMANDE MIXTE (Neufs + Occasion)
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommandeMixte {
    pub id: Uuid,
    pub user_id: Uuid,
    pub reference_commande: String, // Format: CMD-2025-XXXXX
    pub budget_total: f64,
    pub devise: String,
    pub statut: CommandeStatut,
    pub mode_livraison: String, // "coursier", "depot", "retrait_magasin"
    pub adresse_livraison: Option<String>,
    pub gps_livraison: Option<String>,
    pub notes_client: Option<String>,
    pub commission_app: f64, // 5% du total
    pub montant_net_libraires: f64, // Total - commission
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum CommandeStatut {
    Edition, // Client édite sa commande
    ValidationBudget, // Client valide budget
    EnvoyeeLibrairies, // Envoyée au réseau
    EnValidation, // Librairie en train de valider
    ValideePartielle, // Validation partielle
    ValideeComplete, // Validation complète
    EnPreparation, // Librairie prépare paquet
    EnLivraison, // En cours de livraison
    Livree, // Livrée
    Annulee,
}

// ========================================
// LIVRES DANS COMMANDE MIXTE
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommandeLivreNeuf {
    pub id: Uuid,
    pub commande_id: Uuid,
    pub programme_scolaire_id: Option<Uuid>,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub prix_officiel: f64, // Prix officiel du programme
    pub prix_final: f64, // Prix final (ne change pas)
    pub quantite: i32,
    pub est_au_programme: bool,
    pub librairie_validateur_id: Option<Uuid>, // Qui a validé ce livre
    pub statut_validation: LivreValidationStatut,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommandeLivreOccasion {
    pub id: Uuid,
    pub commande_id: Uuid,
    pub livre_scolaire_id: Uuid, // Référence au livre d'occasion
    pub titre: String,
    pub auteur: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub etat_livre: String,
    pub prix: f64,
    pub vendeur_id: Uuid,
    pub quantite: i32,
    pub statut: LivreOccasionStatut,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum LivreValidationStatut {
    EnAttente, // En attente de validation librairie
    Valide, // Validé par librairie
    Indisponible, // Librairie n'a pas ce livre
    EnCoursValidation, // Librairie en train de valider
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum LivreOccasionStatut {
    Disponible,
    Reserve,
    EnPreparation,
    Livre,
}

// ========================================
// VALIDATION COMPÉTITIVE LIBRAIRIE
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommandeValidation {
    pub id: Uuid,
    pub commande_id: Uuid,
    pub librairie_id: Uuid,
    pub statut: ValidationStatut,
    pub livres_valides: Vec<String>, // IDs des livres validés
    pub timestamp_debut: DateTime<Utc>,
    pub timestamp_fin: Option<DateTime<Utc>>,
    pub verrou_exclusif: bool, // Empêche autres validations
    pub notes_validation: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum ValidationStatut {
    EnCours, // Librairie en train de valider
    ValidePartiel, // Validation partielle
    ValideComplet, // Validation complète
    Abandonne, // Librairie a abandonné
    Expire, // Délai expiré
}

// ========================================
// PRIX OFFICIEL PROGRAMME (IA)
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PrixOfficielProgramme {
    pub id: Uuid,
    pub programme_scolaire_id: Uuid,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub prix_officiel: f64,
    pub devise: String,
    pub source: PrixSource,
    pub confiance_score: f64, // Score de confiance IA 0-1
    pub fichier_source: Option<String>, // URL du fichier source
    pub date_extraction: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum PrixSource {
    FichierProgramme, // Extrait du fichier programme
    IAExtraction, // Extrait par IA
    Manuelle, // Saisie manuelle
    WebScraping, // Scraping web
}

// ========================================
// QR CODE SÉCURITÉ COURSIER
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QRCodeCoursier {
    pub id: Uuid,
    pub paquet_id: Uuid,
    pub coursier_id: Uuid,
    pub code_secret: String, // Code aléatoire 8 caractères
    pub qr_code_data: String, // Données QR encodées
    pub timestamp_generation: DateTime<Utc>,
    pub timestamp_scan: Option<DateTime<Utc>>,
    pub timestamp_validation: Option<DateTime<Utc>>,
    pub statut: QRCodeStatut,
    pub livres_attendus: Vec<LivreQRReference>, // Livres à récupérer
    pub destinations: Vec<DestinationQR>, // Points de dépôt
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum QRCodeStatut {
    Genere, // QR généré
    Scanne, // Scanné par coursier
    EnCoursValidation, // Validation en cours
    Valide, // Validé avec succès
    Expire, // Expiré (24h)
    Annule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivreQRReference {
    pub livre_id: Uuid,
    pub titre: String,
    pub auteur: Option<String>,
    pub isbn: Option<String>,
    pub quantite: i32,
    pub provenance: ProvenanceLivre, // "librairie" ou "utilisateur"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestinationQR {
    pub destination_id: Uuid,
    pub type_destination: TypeDestination, // "depot" ou "livraison"
    pub adresse: String,
    pub gps: Option<String>,
    pub destinataire: String, // Nom du destinataire
    pub telephone: Option<String>,
    pub livres_a_deposer: Vec<LivreQRReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProvenanceLivre {
    Librairie,
    Utilisateur,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeDestination {
    Depot, // Point de dépôt
    Livraison, // Livraison finale
}

// ========================================
// NOTIFICATION LIBRAIRIE
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationLibrairie {
    pub id: Uuid,
    pub librairie_id: Uuid,
    pub commande_id: Uuid,
    pub type_notification: TypeNotification,
    pub message: String,
    pub donnees_supplementaires: Option<serde_json::Value>,
    pub statut: NotificationStatut,
    pub timestamp_envoi: DateTime<Utc>,
    pub timestamp_lecture: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeNotification {
    NouvelleCommande, // Nouvelle commande à valider
    CommandeAnnulee, // Commande annulée
    ValidationComplete, // Validation complète requise
    PartieLibreeree, // Partie de commande libérée
    RappelValidation, // Rappel validation
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum NotificationStatut {
    Envoyee,
    Lue,
    Traitee,
    Ignoree,
}

// ========================================
// CONFIGURATION SYSTÈME
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConfigurationSysteme {
    pub id: Uuid,
    pub cle: String,
    pub valeur: serde_json::Value,
    pub description: Option<String>,
    pub updated_at: DateTime<Utc>,
}

// Valeurs par défaut
impl ConfigurationSysteme {
    pub const COMMISSION_APP: f64 = 0.05; // 5%
    pub const DELAI_VALIDATION_MAX: i32 = 300; // 5 minutes
    pub const RAYON_RECHERCHE_LIBRAIRIE: i32 = 50; // 50 km
    pub const DELAI_EXPIRATION_QR: i32 = 86400; // 24 heures en secondes
}

// ========================================
// PAYMENTS AGRÉGÉS
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TransactionAgregee {
    pub id: Uuid,
    pub commande_id: Option<Uuid>,
    pub user_id: Uuid,
    pub montant_total: f64,
    pub devise: String,
    pub methode_paiement: MethodePaiement,
    pub statut: TransactionStatut,
    pub reference_paiement: String,
    pub provider_transaction_id: Option<String>,
    pub commission_app: f64,
    pub montant_net: f64,
    pub details_repartition: Option<serde_json::Value>, // Répartition libraires/vendeurs
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum MethodePaiement {
    Wallet, // Wallet interne
    MobileMoney, // Orange, MTN, etc.
    CarteBancaire,
    VirementBancaire,
    Espèces, // Pour paiement à la livraison
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TransactionStatut {
    EnAttente,
    Initiee,
    Succes,
    Echec,
    Annulee,
    Remboursee,
}

// ========================================
// CHAÎNES DE LIVRAISON UNIFIÉES
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChaineLivraisonUnifiee {
    pub id: Uuid,
    pub commande_id: Uuid,
    pub reference_chaine: String, // Format: CHN-2025-XXXXX
    pub statut: ChaineStatut,
    pub coursier_id: Option<Uuid>,
    pub points_passage: Vec<PointPassage>,
    pub distance_totale_km: f64,
    pub duree_estimee_minutes: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum ChaineStatut {
    EnConstruction, // Construction de la chaîne
    Optimisee, // Itinéraire optimisé
    EnCours, // Livraison en cours
    Completee, // Livraison terminée
    Annulee,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointPassage {
    pub id: Uuid,
    pub type_point: TypePointPassage,
    pub ordre: i32,
    pub adresse: String,
    pub gps: String,
    pub destinataire: String,
    pub telephone: Option<String>,
    pub instructions: Option<String>,
    pub livres_a_recuperer: Vec<LivreQRReference>,
    pub livres_a_deposer: Vec<LivreQRReference>,
    pub statut: PointStatut,
    pub timestamp_arrivee: Option<DateTime<Utc>>,
    pub timestamp_depart: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypePointPassage {
    Librairie, // Récupération livres neufs
    UtilisateurVendeur, // Récupération livres occasion
    UtilisateurAcheteur, // Dépôt livres achetés
    PointDepot, // Point de dépôt intermédiaire
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum PointStatut {
    EnAttente,
    EnCours,
    Complete,
    Saute, // Point sauté (livre indisponible)
}

// ========================================
// INTERNATIONNALISATION
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TraductionSysteme {
    pub id: Uuid,
    pub cle_traduction: String,
    pub langue: String,
    pub traduction: String,
    pub contexte: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Messages système multilingues
impl TraductionSysteme {
    pub const NOTIFICATION_NOUVELLE_COMMANDE: &'static str = "notification.nouvelle_commande";
    pub const NOTIFICATION_VALIDATION_REQUISE: &'static str = "notification.validation_requise";
    pub const MESSAGE_COMMANDE_EN_PREPARATION: &'static str = "commande.en_preparation";
    pub const MESSAGE_COMMANDE_EN_LIVRAISON: &'static str = "commande.en_livraison";
    pub const MESSAGE_QR_CODE_GENERE: &'static str = "qr_code.genere";
    pub const MESSAGE_PAIEMENT_SUCCES: &'static str = "paiement.succes";
    pub const MESSAGE_PAIEMENT_ECHEC: &'static str = "paiement.echec";
}
