// ✅ Service pour gestion expériences d'anciens étudiants

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    CreateExperienceRequest, ExperienceAncienEtudiant, SearchExperiencesRequest,
};
use crate::state::AppState;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;

pub struct ExperiencesEtudiantsService {
    pool: Arc<PgPool>,
    #[allow(dead_code)]
    state: Arc<AppState>,
}

impl ExperiencesEtudiantsService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Créer une expérience d'ancien étudiant
    pub async fn create_experience(
        &self,
        user_id: i32,
        request: CreateExperienceRequest,
    ) -> AppResult<ExperienceAncienEtudiant> {
        info!(
            "[EXPERIENCES_ETUDIANTS] Création expérience: user_id={}, etablissement_id={}",
            user_id, request.etablissement_id
        );

        let experience = sqlx::query_as::<_, ExperienceAncienEtudiant>(
            r#"
            INSERT INTO experiences_anciens_etudiants (
                etablissement_id, user_id, filiere, specialite, annee_entree,
                annee_sortie, niveau_obtenu, titre, contenu, points_positifs,
                points_negatifs, note_generale, is_verified, is_approved
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
            "#,
        )
        .bind(request.etablissement_id)
        .bind(user_id)
        .bind(request.filiere)
        .bind(request.specialite)
        .bind(request.annee_entree)
        .bind(request.annee_sortie)
        .bind(request.niveau_obtenu)
        .bind(request.titre)
        .bind(request.contenu)
        .bind(request.points_positifs.unwrap_or_default())
        .bind(request.points_negatifs.unwrap_or_default())
        .bind(request.note_generale)
        .bind(false) // is_verified (nécessite modération admin)
        .bind(true) // is_approved (par défaut, peut être modéré après)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[EXPERIENCES_ETUDIANTS] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création expérience: {}", e))
        })?;

        info!(
            "[EXPERIENCES_ETUDIANTS] ✅ Expérience créée: id={}",
            experience.id
        );
        Ok(experience)
    }

    /// Lister les expériences d'un établissement
    pub async fn list_experiences_by_etablissement(
        &self,
        etablissement_id: i32,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ExperienceAncienEtudiant>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let experiences = sqlx::query_as::<_, ExperienceAncienEtudiant>(
            r#"
            SELECT * FROM experiences_anciens_etudiants
            WHERE etablissement_id = $1 AND is_approved = true
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(etablissement_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!(
                "[EXPERIENCES_ETUDIANTS] Erreur list by etablissement: {}",
                e
            );
            AppError::Internal(format!("Erreur liste expériences: {}", e))
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM experiences_anciens_etudiants WHERE etablissement_id = $1 AND is_approved = true"
        )
        .bind(etablissement_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[EXPERIENCES_ETUDIANTS] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count expériences: {}", e))
        })?;

        Ok((experiences, total))
    }

    /// Lister les expériences par filière
    pub async fn list_experiences_by_filiere(
        &self,
        filiere: String,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ExperienceAncienEtudiant>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let filiere_clone = filiere.clone();
        let experiences = sqlx::query_as::<_, ExperienceAncienEtudiant>(
            r#"
            SELECT * FROM experiences_anciens_etudiants
            WHERE filiere = $1 AND is_approved = true
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(&filiere_clone)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[EXPERIENCES_ETUDIANTS] Erreur list by filiere: {}", e);
            AppError::Internal(format!("Erreur liste expériences par filière: {}", e))
        })?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM experiences_anciens_etudiants WHERE filiere = $1 AND is_approved = true"
        )
        .bind(&filiere_clone)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[EXPERIENCES_ETUDIANTS] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count expériences: {}", e))
        })?;

        Ok((experiences, total))
    }

    /// Rechercher des expériences
    pub async fn search_experiences(
        &self,
        request: SearchExperiencesRequest,
    ) -> AppResult<(Vec<ExperienceAncienEtudiant>, i64)> {
        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut query = sqlx::QueryBuilder::new(
            "SELECT * FROM experiences_anciens_etudiants WHERE is_approved = true",
        );

        if let Some(etablissement_id) = request.etablissement_id {
            query.push(" AND etablissement_id = ");
            query.push_bind(etablissement_id);
        }

        if let Some(filiere) = &request.filiere {
            query.push(" AND filiere = ");
            query.push_bind(filiere);
        }

        query.push(" ORDER BY created_at DESC");
        query.push(" LIMIT ");
        query.push_bind(limit);
        query.push(" OFFSET ");
        query.push_bind(offset);

        let experiences = query
            .build_query_as::<ExperienceAncienEtudiant>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                error!("[EXPERIENCES_ETUDIANTS] Erreur search: {}", e);
                AppError::Internal(format!("Erreur recherche expériences: {}", e))
            })?;

        // Count query
        let mut count_query = sqlx::QueryBuilder::new(
            "SELECT COUNT(*)::bigint FROM experiences_anciens_etudiants WHERE is_approved = true",
        );

        if let Some(etablissement_id) = request.etablissement_id {
            count_query.push(" AND etablissement_id = ");
            count_query.push_bind(etablissement_id);
        }

        if let Some(filiere) = &request.filiere {
            count_query.push(" AND filiere = ");
            count_query.push_bind(filiere);
        }

        let total: i64 =
            count_query.build_query_scalar().fetch_one(&*self.pool).await.map_err(|e| {
                error!("[EXPERIENCES_ETUDIANTS] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count expériences: {}", e))
            })?;

        Ok((experiences, total))
    }

    /// Modérer une expérience (admin uniquement)
    pub async fn moderate_experience(
        &self,
        experience_id: i32,
        is_approved: bool,
        is_verified: Option<bool>,
    ) -> AppResult<ExperienceAncienEtudiant> {
        info!(
            "[EXPERIENCES_ETUDIANTS] Modération: experience_id={}, is_approved={}",
            experience_id, is_approved
        );

        let mut query =
            sqlx::QueryBuilder::new("UPDATE experiences_anciens_etudiants SET is_approved = ");
        query.push_bind(is_approved);

        if let Some(verified) = is_verified {
            query.push(", is_verified = ");
            query.push_bind(verified);
        }

        query.push(", updated_at = CURRENT_TIMESTAMP WHERE id = ");
        query.push_bind(experience_id);
        query.push(" RETURNING *");

        let experience = query
            .build_query_as::<ExperienceAncienEtudiant>()
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                error!("[EXPERIENCES_ETUDIANTS] Erreur modération: {}", e);
                AppError::Internal(format!("Erreur modération expérience: {}", e))
            })?;

        Ok(experience)
    }
}
