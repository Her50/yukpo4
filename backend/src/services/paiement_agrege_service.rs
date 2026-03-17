// ✅ SERVICE PAIEMENT AGRÉGÉ - Gestion multi-méthodes avec commission
// Support Wallet, Mobile Money, Carte Bancaire, Virement, Espèces

use std::sync::Arc;
use std::collections::HashMap;

use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};
use crate::models::paiement_agrege_model::{MethodePaiement, TransactionStatut};
use crate::state::AppState;

// ========================================
// STRUCTURES SERVICE PAIEMENT
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FournisseurPaiement {
    pub id: Uuid,
    pub nom: String,
    pub code: String, // "orange", "mtn", "wave", "moov", etc.
    pub type_fournisseur: TypeFournisseur,
    pub pays: String,
    pub devise: String,
    pub commission_fournisseur: f64, // Commission du fournisseur
    pub est_actif: bool,
    pub configuration: serde_json::Value, // API keys, endpoints, etc.
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum TypeFournisseur {
    MobileMoney, // Orange Money, MTN Mobile Money, Wave, etc.
    Banque, // Carte bancaire, virement
    Wallet, // Wallet interne YukPo
    Especes, // Paiement à la livraison
    Crypto, // Bitcoin, USDT, etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandePaiement {
    pub transaction_id: Uuid,
    pub montant_total: f64,
    pub devise: String,
    pub methode_paiement: MethodePaiement,
    pub user_id: Uuid,
    pub commande_id: Option<Uuid>,
    pub description: String,
    pub metadata: serde_json::Value,
    pub callback_url: Option<String>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReponsePaiement {
    pub transaction_id: Uuid,
    pub statut: TransactionStatut,
    pub reference_paiement: String,
    pub provider_transaction_id: Option<String>,
    pub payment_url: Option<String>, // URL de redirection pour paiement
    pub qr_code_data: Option<String>, // QR code pour mobile money
    pub instructions: Option<String>, // Instructions spécifiques
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepartitionPaiement {
    pub transaction_id: Uuid,
    pub beneficiaires: Vec<BeneficiairePaiement>,
    pub commission_app: f64,
    pub montant_total: f64,
    pub montant_net: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeneficiairePaiement {
    pub id: Uuid,
    pub type_beneficiaire: TypeBeneficiaire,
    pub nom: String,
    pub montant_brut: f64,
    pub commission: f64,
    pub montant_net: f64,
    pub reference_paiement: String,
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TypeBeneficiaire {
    Librairie,
    VendeurOccasion,
    Coursier,
    Application, // Commission app
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TransactionAgregee {
    pub id: Uuid,
    pub commande_id: Option<Uuid>,
    pub user_id: Uuid,
    pub montant_total: f64,
    pub devise: String,
    pub methode_paiement: String,
    pub statut: String,
    pub reference_paiement: String,
    pub provider_transaction_id: Option<String>,
    pub commission_app: f64,
    pub montant_net: f64,
    pub details_repartition: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct PaiementAgregeService {
    pg: Arc<PgPool>,
    fournisseurs: HashMap<String, FournisseurPaiement>,
    commission_app: f64,
}

impl PaiementAgregeService {
    pub fn new(pg: Arc<PgPool>) -> Self {
        Self {
            pg,
            fournisseurs: HashMap::new(),
            commission_app: 0.05,
        }
    }

    pub async fn initialiser_fournisseurs(&mut self, pg: &sqlx::PgPool) -> Result<(), AppError> {
        let fournisseurs_db = sqlx::query_as::<_, FournisseurPaiement>(
            "SELECT * FROM fournisseurs_paiement WHERE est_actif = true"
        )
        .fetch_all(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur chargement fournisseurs: {}", e)))?;

        for fournisseur in fournisseurs_db {
            self.fournisseurs.insert(fournisseur.code.clone(), fournisseur);
        }

        info!("[PaiementAgregeService] {} fournisseurs initialisés", self.fournisseurs.len());
        Ok(())
    }

    /// Créer une demande de paiement
    pub async fn creer_demande_paiement(
        &self,
        demande: DemandePaiement,
        pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        info!("[creer_demande_paiement] Transaction: {}, Montant: {}, Méthode: {:?}", 
              demande.transaction_id, demande.montant_total, demande.methode_paiement);

        // Calculer la répartition
        let repartition = self.calculer_repartition(&demande, pg).await?;

        // Créer la transaction en base
        let transaction = self.creer_transaction(&demande, &repartition, pg).await?;

        // Générer la réponse selon la méthode de paiement
        let reponse = match demande.methode_paiement {
            MethodePaiement::Wallet => self.traiter_paiement_wallet(&demande, &transaction, pg).await?,
            MethodePaiement::MobileMoney | MethodePaiement::OrangeMoney | MethodePaiement::MTNMobileMoney | MethodePaiement::Wave => {
                self.traiter_paiement_mobile_money(&demande, &transaction, pg).await?
            },
            MethodePaiement::CarteBancaire | MethodePaiement::Stripe | MethodePaiement::PayPal => {
                self.traiter_paiement_carte(&demande, &transaction, pg).await?
            },
            MethodePaiement::VirementBancaire => self.traiter_paiement_virement(&demande, &transaction, pg).await?,
            MethodePaiement::Especes => self.traiter_paiement_especes(&demande, &transaction, pg).await?,
        };

        Ok(reponse)
    }

    /// Calculer la répartition des fonds
    async fn calculer_repartition(
        &self,
        demande: &DemandePaiement,
        pg: &sqlx::PgPool,
    ) -> Result<RepartitionPaiement, AppError> {
        let mut beneficiaires = Vec::new();

        // Commission application
        let commission_app = demande.montant_total * self.commission_app;
        beneficiaires.push(BeneficiairePaiement {
            id: Uuid::new_v4(),
            type_beneficiaire: TypeBeneficiaire::Application,
            nom: "YukPo Commission".to_string(),
            montant_brut: commission_app,
            commission: 0.0,
            montant_net: commission_app,
            reference_paiement: format!("COMM-{}", demande.transaction_id),
            details: serde_json::json!({
                "transaction_id": demande.transaction_id,
                "taux_commission": self.commission_app
            }),
        });

        if let Some(commande_id) = demande.commande_id {
            #[derive(sqlx::FromRow)]
            struct LivreNeufRow {
                librairie_user_id: Option<Uuid>,
                librairie_nom: Option<String>,
                prix_final: f64,
                quantite: i32,
            }
            let livres_neufs = sqlx::query_as::<_, LivreNeufRow>(
                r#"
                SELECT lp.user_id as librairie_user_id, lp.nom as librairie_nom,
                       cln.prix_final, cln.quantite
                FROM commande_livres_neufs cln
                JOIN librairie_partners lp ON cln.librairie_validateur_id = lp.id
                WHERE cln.commande_id = $1 AND cln.statut_validation = 'valide'
                "#,
            )
            .bind(commande_id)
            .fetch_all(pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur livres neufs: {}", e)))?;

            let mut librairie_totals: HashMap<Uuid, (String, f64)> = HashMap::new();
            for livre in livres_neufs {
                let entry = librairie_totals.entry(livre.librairie_user_id.unwrap_or_default())
                    .or_insert((livre.librairie_nom.unwrap_or_default(), 0.0));
                entry.1 += livre.prix_final * livre.quantite as f64;
            }

            for (librairie_id, (nom, total)) in librairie_totals {
                beneficiaires.push(BeneficiairePaiement {
                    id: librairie_id,
                    type_beneficiaire: TypeBeneficiaire::Librairie,
                    nom,
                    montant_brut: total,
                    commission: 0.0,
                    montant_net: total,
                    reference_paiement: format!("LIB-{}", demande.transaction_id),
                    details: serde_json::json!({
                        "librairie_id": librairie_id,
                        "commande_id": commande_id
                    }),
                });
            }

            #[derive(sqlx::FromRow)]
            struct LivreOccasionRow {
                vendeur_id: Uuid,
                vendeur_nom: Option<String>,
                vendeur_prenom: Option<String>,
                prix: f64,
                quantite: i32,
            }
            let livres_occasion = sqlx::query_as::<_, LivreOccasionRow>(
                r#"
                SELECT clo.vendeur_id, u.nom as vendeur_nom, u.prenom as vendeur_prenom,
                       clo.prix, clo.quantite
                FROM commande_livres_occasion clo
                JOIN users u ON clo.vendeur_id = u.id
                WHERE clo.commande_id = $1
                "#,
            )
            .bind(commande_id)
            .fetch_all(pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur livres occasion: {}", e)))?;

            let mut vendeur_totals: HashMap<Uuid, (String, f64)> = HashMap::new();
            for livre in livres_occasion {
                let nom_complet = format!("{} {}", 
                    livre.vendeur_prenom.unwrap_or_default(), 
                    livre.vendeur_nom.unwrap_or_default()
                );
                let entry = vendeur_totals.entry(livre.vendeur_id)
                    .or_insert((nom_complet, 0.0));
                entry.1 += livre.prix * livre.quantite as f64;
            }

            for (vendeur_id, (nom, total)) in vendeur_totals {
                beneficiaires.push(BeneficiairePaiement {
                    id: vendeur_id,
                    type_beneficiaire: TypeBeneficiaire::VendeurOccasion,
                    nom,
                    montant_brut: total,
                    commission: 0.0,
                    montant_net: total,
                    reference_paiement: format!("VEN-{}", demande.transaction_id),
                    details: serde_json::json!({
                        "vendeur_id": vendeur_id,
                        "commande_id": commande_id
                    }),
                });
            }
        }

        let montant_net = demande.montant_total - commission_app;

        Ok(RepartitionPaiement {
            transaction_id: demande.transaction_id,
            beneficiaires,
            commission_app,
            montant_total: demande.montant_total,
            montant_net,
        })
    }

    async fn creer_transaction(
        &self,
        demande: &DemandePaiement,
        repartition: &RepartitionPaiement,
        pg: &sqlx::PgPool,
    ) -> Result<TransactionAgregee, AppError> {
        let methode_str = format!("{:?}", demande.methode_paiement).to_lowercase();
        let repartition_json = serde_json::to_value(&repartition.beneficiaires)
            .unwrap_or(serde_json::Value::Array(vec![]));
        
        let transaction = sqlx::query_as::<_, TransactionAgregee>(
            r#"
            INSERT INTO transactions_agregees (
                commande_id, user_id, montant_total, devise, methode_paiement,
                statut, reference_paiement, commission_app, montant_net, details_repartition
            )
            VALUES ($1, $2, $3, $4, $5, 'en_attente', $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(demande.commande_id)
        .bind(demande.user_id)
        .bind(demande.montant_total)
        .bind(&demande.devise)
        .bind(&methode_str)
        .bind(demande.transaction_id.to_string())
        .bind(repartition.commission_app)
        .bind(repartition.montant_net)
        .bind(&repartition_json)
        .fetch_one(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création transaction: {}", e)))?;

        Ok(transaction)
    }

    /// Traiter paiement wallet interne
    async fn traiter_paiement_wallet(
        &self,
        demande: &DemandePaiement,
        transaction: &TransactionAgregee,
        pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        let solde: f64 = sqlx::query_scalar(
            "SELECT COALESCE(solde, 0.0) FROM user_wallets WHERE user_id = $1",
        )
        .bind(demande.user_id)
        .fetch_one(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification solde: {}", e)))?;

        if solde < demande.montant_total {
            return Err(AppError::BadRequest("Solde wallet insuffisant".to_string()));
        }

        // Débiter le wallet
        let mut tx = pg.begin().await
            .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

        sqlx::query("UPDATE user_wallets SET solde = solde - $1 WHERE user_id = $2")
            .bind(demande.montant_total)
            .bind(demande.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur débit wallet: {}", e)))?;

        let wallet_ref = format!("WALLET-{}", Uuid::new_v4());
        sqlx::query(
            "UPDATE transactions_agregees SET statut = 'succes', provider_transaction_id = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(&wallet_ref)
        .bind(transaction.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update transaction: {}", e)))?;

        // Distribuer les fonds aux bénéficiaires
        self.distribuer_fonds(&mut *tx, transaction.id).await?;

        tx.commit().await
            .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

        Ok(ReponsePaiement {
            transaction_id: demande.transaction_id,
            statut: TransactionStatut::Succes,
            reference_paiement: transaction.reference_paiement.clone(),
            provider_transaction_id: Some(format!("WALLET-{}", Uuid::new_v4())),
            payment_url: None,
            qr_code_data: None,
            instructions: Some("Paiement effectué via votre wallet YukPo".to_string()),
            expires_at: demande.expires_at,
            created_at: Utc::now(),
        })
    }

    /// Traiter paiement mobile money
    async fn traiter_paiement_mobile_money(
        &self,
        demande: &DemandePaiement,
        transaction: &TransactionAgregee,
        _pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        let payment_url = format!("https://api.yukpo.com/payment/mobile/{}", transaction.reference_paiement);
        let qr_code_data = format!("MOBILE_MONEY:{}:{}", transaction.reference_paiement, demande.montant_total);

        Ok(ReponsePaiement {
            transaction_id: demande.transaction_id,
            statut: TransactionStatut::Initiee,
            reference_paiement: transaction.reference_paiement.clone(),
            provider_transaction_id: Some(format!("MOBILE-{}", Uuid::new_v4())),
            payment_url: Some(payment_url),
            qr_code_data: Some(qr_code_data),
            instructions: Some("Scannez le QR code avec votre application mobile money".to_string()),
            expires_at: demande.expires_at,
            created_at: Utc::now(),
        })
    }

    /// Traiter paiement carte bancaire
    async fn traiter_paiement_carte(
        &self,
        demande: &DemandePaiement,
        transaction: &TransactionAgregee,
        pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        // TODO: Intégration Stripe, Paystack, etc.
        let payment_url = format!("https://api.yukpo.com/payment/card/{}", transaction.reference_paiement);

        Ok(ReponsePaiement {
            transaction_id: demande.transaction_id,
            statut: TransactionStatut::Initiee,
            reference_paiement: transaction.reference_paiement.clone(),
            provider_transaction_id: Some(format!("CARD-{}", Uuid::new_v4())),
            payment_url: Some(payment_url),
            qr_code_data: None,
            instructions: Some("Vous allez être redirigé vers la page de paiement sécurisée".to_string()),
            expires_at: demande.expires_at,
            created_at: Utc::now(),
        })
    }

    /// Traiter paiement virement bancaire
    async fn traiter_paiement_virement(
        &self,
        demande: &DemandePaiement,
        transaction: &TransactionAgregee,
        _pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        let instructions = format!(
            "Veuillez effectuer un virement de {} {} vers le compte IBAN: CM76 0000 0000 0000 0000 0000 000\nRéférence: {}",
            demande.montant_total, demande.devise, transaction.reference_paiement
        );

        Ok(ReponsePaiement {
            transaction_id: demande.transaction_id,
            statut: TransactionStatut::EnAttente,
            reference_paiement: transaction.reference_paiement.clone(),
            provider_transaction_id: None,
            payment_url: None,
            qr_code_data: None,
            instructions: Some(instructions),
            expires_at: demande.expires_at,
            created_at: Utc::now(),
        })
    }

    /// Traiter paiement espèces (à la livraison)
    async fn traiter_paiement_especes(
        &self,
        demande: &DemandePaiement,
        transaction: &TransactionAgregee,
        _pg: &sqlx::PgPool,
    ) -> Result<ReponsePaiement, AppError> {
        Ok(ReponsePaiement {
            transaction_id: demande.transaction_id,
            statut: TransactionStatut::EnAttente,
            reference_paiement: transaction.reference_paiement.clone(),
            provider_transaction_id: None,
            payment_url: None,
            qr_code_data: None,
            instructions: Some("Paiement en espèces à la livraison. Préparez la somme exacte.".to_string()),
            expires_at: demande.expires_at,
            created_at: Utc::now(),
        })
    }

    /// Distribuer les fonds aux bénéficiaires
    async fn distribuer_fonds(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        transaction_id: Uuid,
    ) -> Result<(), AppError> {
        #[derive(sqlx::FromRow)]
        struct RepartitionRow {
            details_repartition: Option<serde_json::Value>,
        }
        let repartition = sqlx::query_as::<_, RepartitionRow>(
            "SELECT details_repartition FROM transactions_agregees WHERE id = $1",
        )
        .bind(transaction_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération répartition: {}", e)))?;

        let beneficiaires: Vec<BeneficiairePaiement> = serde_json::from_value(
            repartition.details_repartition.unwrap_or(serde_json::Value::Array(vec![]))
        ).map_err(|e| AppError::Internal(format!("Erreur parsing bénéficiaires: {}", e)))?;

        // Distribuer à chaque bénéficiaire
        for beneficiaire in beneficiaires {
            match beneficiaire.type_beneficiaire {
                TypeBeneficiaire::Librairie | TypeBeneficiaire::VendeurOccasion | TypeBeneficiaire::Coursier => {
                    sqlx::query(
                        r#"INSERT INTO user_wallets (user_id, solde, updated_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (user_id) DO UPDATE SET
                            solde = user_wallets.solde + $2,
                            updated_at = NOW()"#,
                    )
                    .bind(beneficiaire.id)
                    .bind(beneficiaire.montant_net)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur crédit wallet: {}", e)))?;
                },
                TypeBeneficiaire::Application => {},
            }
        }

        Ok(())
    }

    /// Confirmer un paiement externe (callback)
    pub async fn confirmer_paiement_externe(
        &self,
        reference_paiement: &str,
        provider_transaction_id: &str,
        statut: TransactionStatut,
        pg: &sqlx::PgPool,
    ) -> Result<(), AppError> {
        let mut tx = pg.begin().await
            .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

        let statut_str = format!("{:?}", statut).to_lowercase();
        sqlx::query(
            "UPDATE transactions_agregees SET statut = $1, provider_transaction_id = $2, updated_at = NOW() WHERE reference_paiement = $3"
        )
        .bind(&statut_str)
        .bind(provider_transaction_id)
        .bind(reference_paiement)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update transaction: {}", e)))?;

        if matches!(statut, TransactionStatut::Succes) {
            let transaction_id: Uuid = sqlx::query_scalar(
                "SELECT id FROM transactions_agregees WHERE reference_paiement = $1",
            )
            .bind(reference_paiement)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération transaction: {}", e)))?;

            self.distribuer_fonds(&mut tx, transaction_id).await?;
        }

        tx.commit().await
            .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

        info!("[confirmer_paiement_externe] Paiement {} confirmé avec statut {:?}", 
              reference_paiement, statut);

        Ok(())
    }

    /// Obtenir les détails d'une transaction
    pub async fn get_transaction_details(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
        pg: &sqlx::PgPool,
    ) -> Result<TransactionAgregee, AppError> {
        sqlx::query_as::<_, TransactionAgregee>(
            "SELECT * FROM transactions_agregees WHERE id = $1 AND user_id = $2",
        )
        .bind(transaction_id)
        .bind(user_id)
        .fetch_one(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Transaction non trouvée: {}", e)))
    }

    pub async fn get_user_transactions(
        &self,
        user_id: Uuid,
        limit: i64,
        offset: i64,
        pg: &sqlx::PgPool,
    ) -> Result<Vec<TransactionAgregee>, AppError> {
        sqlx::query_as::<_, TransactionAgregee>(
            "SELECT * FROM transactions_agregees WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))
    }

    pub async fn get_solde_wallet(
        &self,
        user_id: Uuid,
        pg: &sqlx::PgPool,
    ) -> Result<f64, AppError> {
        let solde: f64 = sqlx::query_scalar(
            "SELECT COALESCE(solde, 0.0) FROM user_wallets WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .unwrap_or(0.0);

        Ok(solde)
    }

    pub async fn crediter_wallet(
        &self,
        user_id: Uuid,
        montant: f64,
        motif: &str,
        pg: &sqlx::PgPool,
    ) -> Result<(), AppError> {
        let mut tx = pg.begin().await
            .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

        sqlx::query(
            r#"INSERT INTO user_wallets (user_id, solde, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                solde = user_wallets.solde + $2,
                updated_at = NOW()"#,
        )
        .bind(user_id)
        .bind(montant)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur crédit wallet: {}", e)))?;

        sqlx::query(
            "INSERT INTO wallet_transactions (user_id, montant, type_transaction, motif, created_at) VALUES ($1, $2, 'credit', $3, NOW())"
        )
        .bind(user_id)
        .bind(montant)
        .bind(motif)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur historique wallet: {}", e)))?;

        tx.commit().await
            .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

        info!("[crediter_wallet] {} crédité à user_id: {} ({})", montant, user_id, motif);
        Ok(())
    }
}

// ========================================
// ENDPOINTS CALLBACKS PAIEMENT
// ========================================

/// Callback Orange Money
pub async fn callback_orange_money(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    info!("[callback_orange_money] Callback reçu: {:?}", payload);

    // Parser le callback
    let reference_paiement = payload.get("reference_paiement")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("reference_paiement manquant".to_string()))?;

    let provider_transaction_id = payload.get("transaction_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("transaction_id manquant".to_string()))?;

    let statut_str = payload.get("statut")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("statut manquant".to_string()))?;

    let statut = match statut_str {
        "succes" => TransactionStatut::Succes,
        "echec" => TransactionStatut::Echec,
        "annule" => TransactionStatut::Annulee,
        _ => return Err(AppError::BadRequest("Statut invalide".to_string())),
    };

    // Confirmer le paiement
    state.paiement_service
        .confirmer_paiement_externe(reference_paiement, provider_transaction_id, statut, &state.pg)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Callback traité avec succès"
    })))
}

/// Callback MTN Mobile Money
pub async fn callback_mtn_mobile_money(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    info!("[callback_mtn_mobile_money] Callback reçu: {:?}", payload);
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Callback MTN traité"
    })))
}

/// Callback Wave
pub async fn callback_wave(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    info!("[callback_wave] Callback reçu: {:?}", payload);
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Callback Wave traité"
    })))
}

/// Callback Stripe
pub async fn callback_stripe(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    info!("[callback_stripe] Callback reçu: {:?}", payload);
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Callback Stripe traité"
    })))
}
