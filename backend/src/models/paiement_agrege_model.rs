// ✅ NOUVEAU 2026-03-16: Modèles pour les paiements agrégés

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    pub id: Uuid,
    pub user_id: i32,
    pub solde: f64,
    pub devise: String,
    pub date_creation: DateTime<Utc>,
    pub date_mise_a_jour: DateTime<Utc>,
    pub statut: WalletStatut,
    pub limite_retrait: Option<f64>,
    pub verification_kyc: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum WalletStatut {
    Actif,
    Suspendu,
    Bloque,
    EnAttente,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TransactionPaiement {
    pub id: Uuid,
    pub user_id: i32,
    pub wallet_id: Option<Uuid>,
    pub montant: f64,
    pub devise: String,
    pub methode_paiement: MethodePaiement,
    pub statut: TransactionStatut,
    pub reference_fournisseur: String,
    pub date_creation: DateTime<Utc>,
    pub date_validation: Option<DateTime<Utc>>,
    pub date_echeance: Option<DateTime<Utc>>,
    pub frais_transaction: f64,
    pub commission_yukpo: f64,
    pub montant_net: f64,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum MethodePaiement {
    OrangeMoney,
    MTNMobileMoney,
    MobileMoney, // ✅ Ajouté pour compatibilité
    Wave,
    CarteBancaire,
    Wallet,
    VirementBancaire,
    PayPal,
    Stripe,
    Especes, // ✅ Ajouté pour compatibilité
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TransactionStatut {
    EnAttente,
    Initiee, // ✅ Ajouté pour compatibilité
    Confirme,
    Succes, // ✅ Ajouté pour compatibilité
    Echoue,
    Echec, // ✅ Ajouté pour compatibilité
    Annule,
    Annulee, // ✅ Ajouté pour compatibilité
    Rembourse,
    Expiration,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FournisseurPaiement {
    pub id: i32,
    pub nom: String,
    pub code: String,
    pub methode: MethodePaiement,
    pub actif: bool,
    pub configuration: serde_json::Value,
    pub pays_disponibles: Vec<String>,
    pub frais_fixe: f64,
    pub frais_variable: f64, // pourcentage
    pub limite_min: f64,
    pub limite_max: f64,
    pub date_creation: DateTime<Utc>,
    pub date_mise_a_jour: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Remboursement {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub user_id: i32,
    pub montant: f64,
    pub motif: String,
    pub statut: RemboursementStatut,
    pub date_demande: DateTime<Utc>,
    pub date_traitement: Option<DateTime<Utc>>,
    pub traite_par: Option<i32>,
    pub methode_remboursement: MethodePaiement,
    pub reference_remboursement: Option<String>,
    pub frais_remboursement: f64,
    pub montant_net_rembourse: f64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum RemboursementStatut {
    EnAttente,
    Approuve,
    Refuse,
    Traite,
    Echoue,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct HistoriqueWallet {
    pub id: Uuid,
    pub wallet_id: Uuid,
    pub user_id: i32,
    pub type_mouvement: TypeMouvement,
    pub montant: f64,
    pub solde_avant: f64,
    pub solde_apres: f64,
    pub description: String,
    pub reference_id: Option<String>,
    pub reference_type: Option<String>,
    pub date_mouvement: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeMouvement {
    Credit,
    Debit,
    Blocage,
    Deblocage,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CommissionPaiement {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub user_id: i32,
    pub type_commission: TypeCommission,
    pub montant_commission: f64,
    pub pourcentage_commission: f64,
    pub beneficiaire: String, // "yukpo", "partenaire", etc.
    pub date_commission: DateTime<Utc>,
    pub reglee: bool,
    pub date_reglement: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeCommission {
    Yukpo,
    Partenaire,
    Fournisseur,
    Affilie,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ConfigurationPaiement {
    pub id: i32,
    pub cle: String,
    pub valeur: serde_json::Value,
    pub description: String,
    pub publie: bool,
    pub date_creation: DateTime<Utc>,
    pub date_mise_a_jour: DateTime<Utc>,
    pub modifie_par: Option<i32>,
}

// DTOs pour les requêtes API
#[derive(Debug, Deserialize)]
pub struct CreatePaiementRequest {
    pub montant: f64,
    pub devise: String,
    pub methode_paiement: MethodePaiement,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub utiliser_wallet: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateWalletRequest {
    pub devise: String,
    pub limite_retrait: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CrediterWalletRequest {
    pub user_id: i32,
    pub montant: f64,
    pub motif: String,
    pub methode: MethodePaiement,
}

#[derive(Debug, Deserialize)]
pub struct DebiterWalletRequest {
    pub montant: f64,
    pub motif: String,
    pub reference_id: Option<String>,
    pub reference_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRemboursementRequest {
    pub transaction_id: Uuid,
    pub motif: String,
    pub methode_remboursement: MethodePaiement,
}

#[derive(Debug, Deserialize)]
pub struct CreateFournisseurRequest {
    pub nom: String,
    pub code: String,
    pub methode: MethodePaiement,
    pub configuration: serde_json::Value,
    pub pays_disponibles: Vec<String>,
    pub frais_fixe: f64,
    pub frais_variable: f64,
    pub limite_min: f64,
    pub limite_max: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFournisseurRequest {
    pub nom: Option<String>,
    pub actif: Option<bool>,
    pub configuration: Option<serde_json::Value>,
    pub pays_disponibles: Option<Vec<String>>,
    pub frais_fixe: Option<f64>,
    pub frais_variable: Option<f64>,
    pub limite_min: Option<f64>,
    pub limite_max: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct GetSoldeWalletQuery {
    pub user_id: Option<i32>,
    pub devise: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GetTransactionsQuery {
    pub user_id: Option<i32>,
    pub statut: Option<TransactionStatut>,
    pub methode: Option<MethodePaiement>,
    pub date_debut: Option<DateTime<Utc>>,
    pub date_fin: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetHistoriqueWalletQuery {
    pub wallet_id: Option<Uuid>,
    pub type_mouvement: Option<TypeMouvement>,
    pub date_debut: Option<DateTime<Utc>>,
    pub date_fin: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CallbackPaiementRequest {
    pub transaction_id: Uuid,
    pub statut: TransactionStatut,
    pub reference_fournisseur: String,
    pub metadata: Option<serde_json::Value>,
    pub code_erreur: Option<String>,
    pub message_erreur: Option<String>,
}

// Réponses API
#[derive(Debug, Serialize)]
pub struct PaiementResponse {
    pub transaction_id: Uuid,
    pub montant: f64,
    pub devise: String,
    pub statut: TransactionStatut,
    pub methode_paiement: MethodePaiement,
    pub reference_fournisseur: String,
    pub frais_transaction: f64,
    pub commission_yukpo: f64,
    pub montant_net: f64,
    pub instructions_paiement: Option<String>,
    pub url_paiement: Option<String>,
    pub qr_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WalletResponse {
    pub wallet_id: Uuid,
    pub solde: f64,
    pub devise: String,
    pub statut: WalletStatut,
    pub limite_retrait: Option<f64>,
    pub verification_kyc: bool,
    pub date_creation: DateTime<Utc>,
    pub date_mise_a_jour: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub transaction_id: Uuid,
    pub montant: f64,
    pub devise: String,
    pub statut: TransactionStatut,
    pub methode_paiement: MethodePaiement,
    pub reference_fournisseur: String,
    pub date_creation: DateTime<Utc>,
    pub date_validation: Option<DateTime<Utc>>,
    pub frais_transaction: f64,
    pub commission_yukpo: f64,
    pub montant_net: f64,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HistoriqueResponse {
    pub mouvement_id: Uuid,
    pub type_mouvement: TypeMouvement,
    pub montant: f64,
    pub solde_avant: f64,
    pub solde_apres: f64,
    pub description: String,
    pub reference_id: Option<String>,
    pub reference_type: Option<String>,
    pub date_mouvement: DateTime<Utc>,
}
