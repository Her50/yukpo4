// ✅ NOUVEAU: Service de gestion des réservations pour services spécialisés

use crate::core::types::{AppError, AppResult};
use crate::models::specialized_reservation::SpecializedReservation;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct SpecializedReservationService {
    pool: Arc<PgPool>,
}

impl SpecializedReservationService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Créer une réservation
    pub async fn create_reservation(
        &self,
        service_id: i32,
        service_type: &str,
        user_id: i32,
        prestataire_id: i32,
        reservation_type: &str,
        requested_date: Option<DateTime<Utc>>,
        details: serde_json::Value,
        amount: Option<Decimal>,
        currency: Option<String>,
    ) -> AppResult<SpecializedReservation> {
        // Vérifier disponibilité selon le type
        match service_type {
            "covoiturage" => {
                // Vérifier places disponibles
                let places_result = sqlx::query_scalar::<_, i32>(
                    r#"
                    SELECT places_disponibles
                    FROM covoiturages
                    WHERE service_id = $1
                    "#,
                )
                .bind(service_id)
                .fetch_optional(&*self.pool)
                .await?;

                if let Some(places) = places_result {
                    let requested_places = details["nombre_places"].as_i64().unwrap_or(1) as i32;
                    if places < requested_places {
                        return Err(AppError::BadRequest(format!(
                            "Pas assez de places disponibles. Disponible: {}, Demandé: {}",
                            places, requested_places
                        )));
                    }
                }
            }
            "hopital" | "laboratoire" => {
                // Vérifier si le service accepte les RDV en ligne
                let rdv_enabled = if service_type == "hopital" {
                    sqlx::query_scalar::<_, bool>(
                        r#"
                        SELECT rdv_en_ligne
                        FROM hopitaux_cliniques
                        WHERE service_id = $1
                        "#,
                    )
                    .bind(service_id)
                    .fetch_optional(&*self.pool)
                    .await?
                } else {
                    sqlx::query_scalar::<_, bool>(
                        r#"
                        SELECT rdv_requis
                        FROM laboratoires_imagerie
                        WHERE service_id = $1
                        "#,
                    )
                    .bind(service_id)
                    .fetch_optional(&*self.pool)
                    .await?
                };

                if !rdv_enabled.unwrap_or(false) {
                    return Err(AppError::BadRequest(
                        "Ce service n'accepte pas les réservations en ligne".to_string(),
                    ));
                }
            }
            _ => {}
        }

        // Créer la réservation
        // Note: On utilise sqlx::query avec FromRow car la table n'existe pas encore en compile-time
        // En production, utiliser sqlx::query_as après migration
        let reservation_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO specialized_reservations (
                service_id, service_type, user_id, prestataire_id,
                reservation_type, status, requested_date, details,
                amount, currency, payment_status,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, 'pending', NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(service_type)
        .bind(user_id)
        .bind(prestataire_id)
        .bind(reservation_type)
        .bind(requested_date)
        .bind(&details)
        .bind(amount)
        .bind(currency)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création réservation: {}", e)))?;

        // Récupérer la réservation complète
        let reservation = self.get_reservation_by_id(reservation_id).await?;

        // Si covoiturage, décrémenter places disponibles
        if service_type == "covoiturage" {
            let requested_places = details["nombre_places"].as_i64().unwrap_or(1) as i32;
            sqlx::query(
                r#"
                UPDATE covoiturages
                SET places_disponibles = places_disponibles - $1,
                    updated_at = NOW()
                WHERE service_id = $2
                "#,
            )
            .bind(requested_places)
            .bind(service_id)
            .execute(&*self.pool)
            .await?;
        }

        Ok(reservation)
    }

    /// Confirmer une réservation
    pub async fn confirm_reservation(
        &self,
        reservation_id: i32,
        prestataire_id: i32,
        confirmed_date: Option<DateTime<Utc>>,
    ) -> AppResult<SpecializedReservation> {
        let reservation = sqlx::query_as::<_, SpecializedReservation>(
            r#"
            UPDATE specialized_reservations
            SET status = 'confirmed',
                confirmed_date = COALESCE($1, requested_date),
                updated_at = NOW()
            WHERE id = $2 AND prestataire_id = $3 AND status = 'pending'
            RETURNING *
            "#,
        )
        .bind(confirmed_date)
        .bind(reservation_id)
        .bind(prestataire_id)
        .fetch_optional(&*self.pool)
        .await?;

        reservation.ok_or_else(|| {
            AppError::NotFound("Réservation non trouvée ou déjà traitée".to_string())
        })
    }

    /// Annuler une réservation
    pub async fn cancel_reservation(
        &self,
        reservation_id: i32,
        user_id: i32,
        reason: Option<String>,
    ) -> AppResult<SpecializedReservation> {
        // Récupérer la réservation pour connaître le type
        let reservation = self.get_reservation_by_id(reservation_id).await?;

        if reservation.user_id != user_id {
            return Err(AppError::NotFound("Réservation non trouvée".to_string()));
        }

        // Si covoiturage, réincrémenter places disponibles
        if reservation.service_type == "covoiturage" && reservation.status == "confirmed" {
            let nombre_places = reservation.details["nombre_places"].as_i64().unwrap_or(1) as i32;
            sqlx::query(
                r#"
                UPDATE covoiturages
                SET places_disponibles = places_disponibles + $1,
                    updated_at = NOW()
                WHERE service_id = $2
                "#,
            )
            .bind(nombre_places)
            .bind(reservation.service_id)
            .execute(&*self.pool)
            .await?;
        }

        // Annuler la réservation
        sqlx::query(
            r#"
            UPDATE specialized_reservations
            SET status = 'cancelled',
                cancelled_at = NOW(),
                notes = COALESCE(notes || ' | ', '') || COALESCE($1, 'Annulé par le client'),
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(&reason)
        .bind(reservation_id)
        .execute(&*self.pool)
        .await?;

        let cancelled = self.get_reservation_by_id(reservation_id).await?;
        Ok(cancelled)
    }

    /// Lister les réservations d'un client
    pub async fn list_user_reservations(
        &self,
        user_id: i32,
        status_filter: Option<&str>,
    ) -> AppResult<Vec<SpecializedReservation>> {
        let query = match status_filter {
            Some(status) => sqlx::query_as::<_, SpecializedReservation>(
                r#"
                    SELECT * FROM specialized_reservations
                    WHERE user_id = $1 AND status = $2
                    ORDER BY created_at DESC
                    "#,
            )
            .bind(user_id)
            .bind(status),
            None => sqlx::query_as::<_, SpecializedReservation>(
                r#"
                    SELECT * FROM specialized_reservations
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    "#,
            )
            .bind(user_id),
        };

        let reservations = query.fetch_all(&*self.pool).await?;
        Ok(reservations)
    }

    /// Lister les réservations d'un prestataire
    pub async fn list_prestataire_reservations(
        &self,
        prestataire_id: i32,
        status_filter: Option<&str>,
    ) -> AppResult<Vec<SpecializedReservation>> {
        let query = match status_filter {
            Some(status) => sqlx::query_as::<_, SpecializedReservation>(
                r#"
                    SELECT * FROM specialized_reservations
                    WHERE prestataire_id = $1 AND status = $2
                    ORDER BY created_at DESC
                    "#,
            )
            .bind(prestataire_id)
            .bind(status),
            None => sqlx::query_as::<_, SpecializedReservation>(
                r#"
                    SELECT * FROM specialized_reservations
                    WHERE prestataire_id = $1
                    ORDER BY created_at DESC
                    "#,
            )
            .bind(prestataire_id),
        };

        let reservations = query.fetch_all(&*self.pool).await?;
        Ok(reservations)
    }

    /// Récupérer une réservation par ID
    async fn get_reservation_by_id(
        &self,
        reservation_id: i32,
    ) -> AppResult<SpecializedReservation> {
        let row = sqlx::query(
            r#"
            SELECT id, service_id, service_type, user_id, prestataire_id,
                   reservation_type, status, requested_date, confirmed_date,
                   completed_at, cancelled_at, details, amount, currency,
                   payment_status, payment_method, notes, prestataire_notes,
                   created_at, updated_at
            FROM specialized_reservations
            WHERE id = $1
            "#,
        )
        .bind(reservation_id)
        .fetch_one(&*self.pool)
        .await?;

        Ok(SpecializedReservation {
            id: row.get::<i32, _>(0),
            service_id: row.get::<i32, _>(1),
            service_type: row.get::<String, _>(2),
            user_id: row.get::<i32, _>(3),
            prestataire_id: row.get::<i32, _>(4),
            reservation_type: row.get::<String, _>(5),
            status: row.get::<String, _>(6),
            requested_date: row.get::<Option<DateTime<Utc>>, _>(7),
            confirmed_date: row.get::<Option<DateTime<Utc>>, _>(8),
            completed_at: row.get::<Option<DateTime<Utc>>, _>(9),
            cancelled_at: row.get::<Option<DateTime<Utc>>, _>(10),
            details: row.get::<serde_json::Value, _>(11),
            amount: row.get::<Option<Decimal>, _>(12),
            currency: row.get::<Option<String>, _>(13),
            payment_status: row.get::<Option<String>, _>(14),
            payment_method: row.get::<Option<String>, _>(15),
            notes: row.get::<Option<String>, _>(16),
            prestataire_notes: row.get::<Option<String>, _>(17),
            created_at: row.get::<DateTime<Utc>, _>(18),
            updated_at: row.get::<DateTime<Utc>, _>(19),
        })
    }
}
