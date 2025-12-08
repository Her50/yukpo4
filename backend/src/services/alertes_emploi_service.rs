use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::{AlerteEmploi, CreateAlerteEmploiRequest, OffreEmploi};
use bigdecimal::BigDecimal;
use chrono::{Duration, Utc};
use log::{error, info, warn};
use sqlx::PgPool;
use std::str::FromStr;

/// Service pour la gestion des alertes emploi
pub struct AlertesEmploiService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl AlertesEmploiService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Crée une alerte de recherche
    pub async fn create_alerte(
        &self,
        candidat_id: i32,
        request: CreateAlerteEmploiRequest,
    ) -> AppResult<AlerteEmploi> {
        info!(
            "[create_alerte] Création alerte pour candidat_id={}",
            candidat_id
        );

        let frequence = request
            .frequence
            .unwrap_or_else(|| "quotidienne".to_string());

        let alerte = sqlx::query_as::<_, AlerteEmploi>(
            r#"
            INSERT INTO alertes_emploi (
                candidat_id, titre_poste, secteur, type_contrat,
                salaire_min, lieu_travail, remote, competences, frequence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(candidat_id)
        .bind(&request.titre_poste)
        .bind(&request.secteur)
        .bind(request.type_contrat.as_deref())
        .bind(
            request
                .salaire_min
                .map(|s| BigDecimal::from_str(&s.to_string()).unwrap_or_default()),
        )
        .bind(&request.lieu_travail)
        .bind(request.remote)
        .bind(request.competences.as_deref())
        .bind(&frequence)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[create_alerte] Erreur: {}", e);
            AppError::Internal(format!("Erreur création alerte: {}", e))
        })?;

        info!("[create_alerte] ✅ Alerte créée avec id={}", alerte.id);
        Ok(alerte)
    }

    /// Vérifie et envoie les alertes (tâche cron)
    pub async fn check_alertes(&self) -> AppResult<Vec<i32>> {
        info!("[check_alertes] Vérification des alertes actives");

        let maintenant = Utc::now();
        let alertes_a_verifier = sqlx::query_as::<_, AlerteEmploi>(
            r#"
            SELECT * FROM alertes_emploi
            WHERE is_active = true
            AND (
                dernier_envoi IS NULL
                OR (frequence = 'instantanee')
                OR (frequence = 'quotidienne' AND dernier_envoi < $1)
                OR (frequence = 'hebdomadaire' AND dernier_envoi < $2)
            )
            "#,
        )
        .bind(maintenant - Duration::days(1))
        .bind(maintenant - Duration::days(7))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[check_alertes] Erreur: {}", e);
            AppError::Internal(format!("Erreur vérification alertes: {}", e))
        })?;

        let mut alertes_envoyees = Vec::new();

        for alerte in alertes_a_verifier {
            match self.send_alerte(&alerte).await {
                Ok(_) => {
                    // Mettre à jour dernier_envoi
                    let _ = sqlx::query!(
                        "UPDATE alertes_emploi SET dernier_envoi = CURRENT_TIMESTAMP WHERE id = $1",
                        alerte.id
                    )
                    .execute(&self.pool)
                    .await;

                    alertes_envoyees.push(alerte.id);
                }
                Err(e) => {
                    warn!("[check_alertes] Erreur envoi alerte {}: {}", alerte.id, e);
                }
            }
        }

        info!(
            "[check_alertes] ✅ {} alertes envoyées",
            alertes_envoyees.len()
        );
        Ok(alertes_envoyees)
    }

    /// Envoie une notification pour nouvelles offres correspondantes
    async fn send_alerte(&self, alerte: &AlerteEmploi) -> AppResult<()> {
        info!("[send_alerte] Envoi alerte id={}", alerte.id);

        // Rechercher les offres correspondantes
        let mut query = String::from(
            "SELECT * FROM offres_emploi WHERE statut = 'active' AND is_active = true",
        );

        if let Some(secteur) = &alerte.secteur {
            query.push_str(&format!(" AND secteur = '{}'", secteur.replace("'", "''")));
        }

        if let Some(ref types) = alerte.type_contrat {
            if !types.is_empty() {
                query.push_str(&format!(
                    " AND type_contrat = ANY(ARRAY[{}])",
                    types
                        .iter()
                        .map(|t| format!("'{}'", t.replace("'", "''")))
                        .collect::<Vec<_>>()
                        .join(",")
                ));
            }
        }

        if let Some(remote) = alerte.remote {
            query.push_str(&format!(" AND remote = {}", remote));
        }

        if let Some(salaire_min) = &alerte.salaire_min {
            if let Ok(salaire_f64) = salaire_min.to_string().parse::<f64>() {
                query.push_str(&format!(
                    " AND (salaire_max IS NULL OR salaire_max >= {})",
                    salaire_f64
                ));
            }
        }

        query.push_str(" AND date_publication > COALESCE((SELECT dernier_envoi FROM alertes_emploi WHERE id = $1), '1970-01-01'::timestamp)");
        query.push_str(" ORDER BY date_publication DESC LIMIT 20");

        let offres = sqlx::query_as::<_, OffreEmploi>(&query)
            .bind(alerte.id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                error!("[send_alerte] Erreur recherche offres: {}", e);
                AppError::Internal(format!("Erreur recherche offres: {}", e))
            })?;

        if offres.is_empty() {
            info!(
                "[send_alerte] Aucune nouvelle offre pour alerte {}",
                alerte.id
            );
            return Ok(());
        }

        // TODO: Envoyer notification push/email au candidat
        // Pour l'instant, on log juste
        info!(
            "[send_alerte] ✅ {} nouvelles offres trouvées pour alerte {} (candidat_id={})",
            offres.len(),
            alerte.id,
            alerte.candidat_id
        );

        // Ici, on pourrait appeler un service de notification
        // push_notification_service::send_notification(...)

        Ok(())
    }

    /// Liste les alertes d'un candidat
    pub async fn list_alertes_candidat(&self, candidat_id: i32) -> AppResult<Vec<AlerteEmploi>> {
        let alertes = sqlx::query_as::<_, AlerteEmploi>(
            "SELECT * FROM alertes_emploi WHERE candidat_id = $1 ORDER BY created_at DESC",
        )
        .bind(candidat_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[list_alertes_candidat] Erreur: {}", e);
            AppError::Internal(format!("Erreur liste alertes: {}", e))
        })?;

        Ok(alertes)
    }

    /// Désactive une alerte
    pub async fn deactivate_alerte(&self, alerte_id: i32) -> AppResult<()> {
        sqlx::query!(
            "UPDATE alertes_emploi SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            alerte_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[deactivate_alerte] Erreur: {}", e);
            AppError::Internal(format!("Erreur désactivation alerte: {}", e))
        })?;

        Ok(())
    }
}
