//! Service CRUD pour les demandes d'achat de livres d'occasion.
//!
//! ✅ 2026-05-16 — Intègre les acheteurs d'occasion comme nœuds-sinks dans
//! le DAG du moteur de matching (`troc_intelligent_service::find_matching_chaine`).

use crate::core::types::{AppError, AppResult};
use crate::models::livre_scolaire_demande::{
    CreateLivreDemandeRequest, LivreScolaireDemande, UpdateLivreDemandeRequest,
};
use log::info;
use sqlx::PgPool;
use std::sync::Arc;

pub struct LivreScolaireDemandeService {
    pool: Arc<PgPool>,
}

impl LivreScolaireDemandeService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Crée une demande d'achat. Idempotent sur (user_id, panier_item_id) :
    /// si une demande existe déjà pour ce slot panier, elle est mise à jour
    /// plutôt que dupliquée.
    pub async fn create(
        &self,
        user_id: i32,
        req: CreateLivreDemandeRequest,
    ) -> AppResult<LivreScolaireDemande> {
        info!(
            "[DEMANDES] Création demande: user={} titre={} classe={} matiere={}",
            user_id, req.titre, req.classe_souhaitee, req.matiere
        );

        // Idempotence par panier_item_id si fourni
        if let Some(ref pid) = req.panier_item_id {
            let existing = sqlx::query_as::<_, LivreScolaireDemande>(
                r#"
                SELECT * FROM livres_scolaires_demandes
                WHERE user_id = $1 AND panier_item_id = $2 AND is_active = true
                LIMIT 1
                "#,
            )
            .bind(user_id)
            .bind(pid)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur lookup demande: {}", e)))?;

            if let Some(d) = existing {
                // Met à jour les champs en cas de re-soumission
                let updated = sqlx::query_as::<_, LivreScolaireDemande>(
                    r#"
                    UPDATE livres_scolaires_demandes
                    SET titre = $1, matiere = $2, classe_souhaitee = $3,
                        budget_max_xaf = COALESCE($4, budget_max_xaf),
                        gps = COALESCE($5, gps),
                        ville = COALESCE($6, ville),
                        quartier = COALESCE($7, quartier),
                        is_active = true
                    WHERE id = $8
                    RETURNING *
                    "#,
                )
                .bind(&req.titre)
                .bind(&req.matiere)
                .bind(&req.classe_souhaitee)
                .bind(req.budget_max_xaf)
                .bind(&req.gps)
                .bind(&req.ville)
                .bind(&req.quartier)
                .bind(d.id)
                .fetch_one(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur update demande: {}", e)))?;
                return Ok(updated);
            }
        }

        let demande = sqlx::query_as::<_, LivreScolaireDemande>(
            r#"
            INSERT INTO livres_scolaires_demandes (
                user_id, titre, auteur, editeur, isbn, matiere,
                classe_souhaitee, niveau, budget_max_xaf,
                gps, ville, quartier,
                panier_item_id, commande_mixte_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&req.titre)
        .bind(&req.auteur)
        .bind(&req.editeur)
        .bind(&req.isbn)
        .bind(&req.matiere)
        .bind(&req.classe_souhaitee)
        .bind(&req.niveau)
        .bind(req.budget_max_xaf)
        .bind(&req.gps)
        .bind(&req.ville)
        .bind(&req.quartier)
        .bind(&req.panier_item_id)
        .bind(req.commande_mixte_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création demande: {}", e)))?;

        Ok(demande)
    }

    /// Liste les demandes actives d'un user.
    pub async fn list_for_user(&self, user_id: i32) -> AppResult<Vec<LivreScolaireDemande>> {
        let demandes = sqlx::query_as::<_, LivreScolaireDemande>(
            r#"
            SELECT * FROM livres_scolaires_demandes
            WHERE user_id = $1 AND is_active = true
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur list demandes: {}", e)))?;
        Ok(demandes)
    }

    /// Charge TOUTES les demandes actives ouvertes (pour le matching DAG).
    /// Exclut les demandes déjà satisfaites ou expirées.
    pub async fn list_all_open_for_matching(&self) -> AppResult<Vec<LivreScolaireDemande>> {
        let demandes = sqlx::query_as::<_, LivreScolaireDemande>(
            r#"
            SELECT * FROM livres_scolaires_demandes
            WHERE is_active = true
              AND is_satisfied = false
              AND matched_chaine_id IS NULL
              AND expires_at > NOW()
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur list demandes ouvertes: {}", e)))?;
        Ok(demandes)
    }

    pub async fn get(&self, demande_id: i32) -> AppResult<Option<LivreScolaireDemande>> {
        let d = sqlx::query_as::<_, LivreScolaireDemande>(
            "SELECT * FROM livres_scolaires_demandes WHERE id = $1",
        )
        .bind(demande_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur get demande: {}", e)))?;
        Ok(d)
    }

    pub async fn update(
        &self,
        demande_id: i32,
        user_id: i32,
        req: UpdateLivreDemandeRequest,
    ) -> AppResult<LivreScolaireDemande> {
        let updated = sqlx::query_as::<_, LivreScolaireDemande>(
            r#"
            UPDATE livres_scolaires_demandes
            SET budget_max_xaf = COALESCE($1, budget_max_xaf),
                gps = COALESCE($2, gps),
                is_active = COALESCE($3, is_active)
            WHERE id = $4 AND user_id = $5
            RETURNING *
            "#,
        )
        .bind(req.budget_max_xaf)
        .bind(&req.gps)
        .bind(req.is_active)
        .bind(demande_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update demande: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Demande introuvable ou non propriétaire".to_string()))?;
        Ok(updated)
    }

    /// Annule (soft-delete) une demande. Idempotent.
    pub async fn cancel(&self, demande_id: i32, user_id: i32) -> AppResult<()> {
        sqlx::query(
            "UPDATE livres_scolaires_demandes SET is_active = false WHERE id = $1 AND user_id = $2",
        )
        .bind(demande_id)
        .bind(user_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur cancel demande: {}", e)))?;
        Ok(())
    }

    /// Marque une demande comme matchée à une chaîne.
    pub async fn mark_matched(
        &self,
        demande_id: i32,
        chaine_id: i32,
    ) -> AppResult<()> {
        sqlx::query(
            "UPDATE livres_scolaires_demandes SET matched_chaine_id = $1 WHERE id = $2",
        )
        .bind(chaine_id)
        .bind(demande_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mark matched: {}", e)))?;
        Ok(())
    }

    /// Marque une demande comme satisfaite (chaîne complétée + livraison OK).
    pub async fn mark_satisfied(&self, demande_id: i32) -> AppResult<()> {
        sqlx::query(
            "UPDATE livres_scolaires_demandes SET is_satisfied = true, is_active = false WHERE id = $1",
        )
        .bind(demande_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mark satisfied: {}", e)))?;
        Ok(())
    }
}
