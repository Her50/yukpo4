use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        ClientRating, Courier, CourierApplication, CourierAsset, CourierMatchingCandidate,
        CourierRating, DeliveryApplicationStatus, DeliveryCancelReason, DeliveryCourierStatus,
        DeliveryEngineType, DeliveryMatchingEvent, DeliveryMatchingQueueItem,
        DeliveryMatchingStatus, DeliveryParcel, DeliveryPricing, DeliveryRecipient,
        DeliveryRecipientUpdate, DeliveryStatus, DeliveryStatusEvent, DeliverySummary,
        DeliveryTrackingPoint, GeoPoint, ParcelRejectionReason, ParcelType, ShoppingItemStatus, ShoppingOrder,
        ShoppingOrderItem, ShoppingStatus,
    },
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::types::BigDecimal;
use sqlx::{postgres::PgQueryResult, PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

/// Repository centralisant les accès base de données pour le service de livraison
#[derive(Clone)]
pub struct DeliveryRepository {
    pool: PgPool,
}

#[derive(Debug, Clone)]
pub struct UserPreview {
    pub id: i32,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub nom_complet: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum WalletEventDirection {
    Debit,
    Refund,
}

impl WalletEventDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            WalletEventDirection::Debit => "debit",
            WalletEventDirection::Refund => "refund",
        }
    }
}

impl DeliveryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Informations minimales sur un utilisateur (affichage front)
    pub async fn get_user_preview(&self, user_id: i32) -> AppResult<Option<UserPreview>> {
        let record = sqlx::query!(
            r#"
            SELECT
                id,
                nom,
                prenom,
                nom_complet,
                avatar_url
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record.map(|row| UserPreview {
            id: row.id,
            nom: row.nom,
            prenom: row.prenom,
            nom_complet: row.nom_complet,
            avatar_url: row.avatar_url,
        }))
    }

    /// Identifiants des livraisons liées à un utilisateur (client, destinataire ou coursier)
    pub async fn list_delivery_ids_for_user(
        &self,
        user_id: i32,
        limit: i64,
    ) -> AppResult<Vec<Uuid>> {
        let rows = sqlx::query!(
            r#"
            SELECT d.id
            FROM deliveries d
            LEFT JOIN couriers c ON d.courier_id = c.id
            WHERE
                (
                    d.creator_id = $1
                    OR d.recipient_user_id = $1
                    OR c.user_id = $1
                )
                AND d.status <> 'completed'::delivery_status
            ORDER BY d.requested_at DESC
            LIMIT $2
            "#,
            user_id,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|row| row.id).collect())
    }

    /// Timeline des statuts pour une livraison
    pub async fn list_status_events(
        &self,
        delivery_id: Uuid,
        limit: i64,
    ) -> AppResult<Vec<DeliveryStatusEvent>> {
        let rows = sqlx::query!(
            r#"
            SELECT
                id,
                delivery_id,
                status AS "status: DeliveryStatus",
                occurred_at,
                COALESCE(payload, '{}'::jsonb) AS "payload!: serde_json::Value",
                recorded_by AS "recorded_by?: i32"
            FROM delivery_status_events
            WHERE delivery_id = $1
            ORDER BY occurred_at ASC
            LIMIT $2
            "#,
            delivery_id,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| DeliveryStatusEvent {
                id: row.id,
                delivery_id: row.delivery_id,
                status: row.status,
                occurred_at: row.occurred_at,
                payload: row.payload,
                recorded_by: row.recorded_by,
            })
            .collect())
    }

    /// Historique des positions partagées par le destinataire
    pub async fn list_recipient_updates(
        &self,
        delivery_id: Uuid,
        limit: i64,
    ) -> AppResult<Vec<DeliveryRecipientUpdate>> {
        let rows = sqlx::query!(
            r#"
            SELECT
                id,
                delivery_id,
                submitted_by AS "submitted_by?: i32",
                latitude,
                longitude,
                address      AS "address?: String",
                created_at   AS "created_at!: chrono::DateTime<Utc>"
            FROM delivery_recipient_updates
            WHERE delivery_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
            delivery_id,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| DeliveryRecipientUpdate {
                id: row.id,
                delivery_id: row.delivery_id,
                submitted_by: row.submitted_by,
                latitude: row.latitude,
                longitude: row.longitude,
                address: row.address,
                created_at: row.created_at,
            })
            .collect())
    }

    /// Retourne la liste des typologies de colis
    pub async fn list_parcel_types(&self) -> AppResult<Vec<ParcelType>> {
        let rows = sqlx::query!(
            r#"
            SELECT
                id,
                slug,
                display_name,
                description,
                max_weight_kg      AS "max_weight_kg?: BigDecimal",
                max_volume_cm3     AS "max_volume_cm3?: BigDecimal",
                requires_isothermal    AS "requires_isothermal!: bool",
                requires_fragile_handling AS "requires_fragile_handling!: bool",
                requires_secure_box    AS "requires_secure_box!: bool",
                requires_document_protection AS "requires_document_protection!: bool",
                COALESCE(metadata, '{}'::jsonb) AS "metadata!: serde_json::Value",
                created_at         AS "created_at!: chrono::DateTime<Utc>"
            FROM parcel_types
            ORDER BY display_name ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| ParcelType {
                id: row.id,
                slug: row.slug,
                display_name: row.display_name,
                description: row.description,
                max_weight_kg: row.max_weight_kg,
                max_volume_cm3: row.max_volume_cm3,
                requires_isothermal: row.requires_isothermal,
                requires_fragile_handling: row.requires_fragile_handling,
                requires_secure_box: row.requires_secure_box,
                requires_document_protection: row.requires_document_protection,
                metadata: row.metadata,
                created_at: row.created_at,
            })
            .collect())
    }

    /// Crée une candidature de coursier
    pub async fn create_courier_application(
        &self,
        payload: NewCourierApplication,
    ) -> AppResult<CourierApplication> {
        let row = sqlx::query!(
            r#"
            INSERT INTO courier_applications (
                user_id,
                status,
                submitted_at,
                profile_data,
                documents,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                user_id,
                status          AS "status: DeliveryApplicationStatus",
                submitted_at    AS "submitted_at?: chrono::DateTime<Utc>",
                reviewed_at     AS "reviewed_at?: chrono::DateTime<Utc>",
                reviewer_id,
                rejection_reason,
                profile_data    AS "profile_data!: serde_json::Value",
                documents       AS "documents!: serde_json::Value",
                notes           AS "notes!: serde_json::Value",
                created_at      AS "created_at!: chrono::DateTime<Utc>",
                updated_at      AS "updated_at!: chrono::DateTime<Utc>"
            "#,
            payload.user_id,
            payload.status as DeliveryApplicationStatus,
            payload.submitted_at,
            payload.profile_data,
            payload.documents,
            payload.notes.unwrap_or_else(|| Value::Array(Vec::new()))
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(CourierApplication {
            id: row.id,
            user_id: row.user_id,
            status: row.status,
            submitted_at: row.submitted_at,
            reviewed_at: row.reviewed_at,
            reviewer_id: row.reviewer_id,
            rejection_reason: row.rejection_reason,
            profile_data: row.profile_data,
            documents: row.documents,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Met à jour le statut d'une candidature
    pub async fn update_courier_application_status(
        &self,
        application_id: Uuid,
        status: DeliveryApplicationStatus,
        reviewer_id: Option<i32>,
        rejection_reason: Option<String>,
    ) -> AppResult<CourierApplication> {
        let row = sqlx::query!(
            r#"
            UPDATE courier_applications
            SET status = $2,
                reviewed_at = NOW(),
                reviewer_id = $3,
                rejection_reason = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                user_id,
                status          AS "status: DeliveryApplicationStatus",
                submitted_at    AS "submitted_at?: chrono::DateTime<Utc>",
                reviewed_at     AS "reviewed_at?: chrono::DateTime<Utc>",
                reviewer_id,
                rejection_reason,
                profile_data    AS "profile_data!: serde_json::Value",
                documents       AS "documents!: serde_json::Value",
                notes           AS "notes!: serde_json::Value",
                created_at      AS "created_at!: chrono::DateTime<Utc>",
                updated_at      AS "updated_at!: chrono::DateTime<Utc>"
            "#,
            application_id,
            status as DeliveryApplicationStatus,
            reviewer_id,
            rejection_reason
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(CourierApplication {
            id: row.id,
            user_id: row.user_id,
            status: row.status,
            submitted_at: row.submitted_at,
            reviewed_at: row.reviewed_at,
            reviewer_id: row.reviewer_id,
            rejection_reason: row.rejection_reason,
            profile_data: row.profile_data,
            documents: row.documents,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Retourne la candidature active d'un utilisateur si elle existe
    pub async fn find_courier_application_by_user(
        &self,
        user_id: i32,
    ) -> AppResult<Option<CourierApplication>> {
        let row = sqlx::query!(
            r#"
            SELECT
                id,
                user_id,
                status          AS "status: DeliveryApplicationStatus",
                submitted_at    AS "submitted_at?: chrono::DateTime<Utc>",
                reviewed_at     AS "reviewed_at?: chrono::DateTime<Utc>",
                reviewer_id,
                rejection_reason,
                profile_data    AS "profile_data!: serde_json::Value",
                documents       AS "documents!: serde_json::Value",
                notes           AS "notes!: serde_json::Value",
                created_at      AS "created_at!: chrono::DateTime<Utc>",
                updated_at      AS "updated_at!: chrono::DateTime<Utc>"
            FROM courier_applications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| CourierApplication {
            id: row.id,
            user_id: row.user_id,
            status: row.status,
            submitted_at: row.submitted_at,
            reviewed_at: row.reviewed_at,
            reviewer_id: row.reviewer_id,
            rejection_reason: row.rejection_reason,
            profile_data: row.profile_data,
            documents: row.documents,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    /// Récupère le profil coursier associé à un utilisateur
    pub async fn find_courier_by_user(&self, user_id: i32) -> AppResult<Option<Courier>> {
        let row = sqlx::query!(
            r#"
            SELECT
                id,
                user_id,
                application_id    AS "application_id?: Uuid",
                status          AS "status: DeliveryCourierStatus",
                rating_average  AS "rating_average?: BigDecimal",
                rating_count     AS "rating_count?: i32",
                bio              AS "bio?: String",
                hired_at       AS "hired_at?: chrono::DateTime<Utc>",
                suspended_at   AS "suspended_at?: chrono::DateTime<Utc>",
                created_at     AS "created_at!: chrono::DateTime<Utc>",
                updated_at     AS "updated_at!: chrono::DateTime<Utc>"
            FROM couriers
            WHERE user_id = $1
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| Courier {
            id: row.id,
            user_id: row.user_id,
            application_id: row.application_id,
            status: row.status,
            rating_average: row.rating_average.unwrap_or_else(|| BigDecimal::from(0)),
            rating_count: row.rating_count.unwrap_or(0),
            bio: row.bio,
            hired_at: row.hired_at,
            suspended_at: row.suspended_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    pub async fn find_courier_by_id(&self, courier_id: Uuid) -> AppResult<Option<Courier>> {
        let row = sqlx::query!(
            r#"
            SELECT
                id,
                user_id,
                application_id    AS "application_id?: Uuid",
                status          AS "status: DeliveryCourierStatus",
                rating_average  AS "rating_average?: BigDecimal",
                rating_count     AS "rating_count?: i32",
                bio              AS "bio?: String",
                hired_at       AS "hired_at?: chrono::DateTime<Utc>",
                suspended_at   AS "suspended_at?: chrono::DateTime<Utc>",
                created_at     AS "created_at!: chrono::DateTime<Utc>",
                updated_at     AS "updated_at!: chrono::DateTime<Utc>"
            FROM couriers
            WHERE id = $1
            "#,
            courier_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| Courier {
            id: row.id,
            user_id: row.user_id,
            application_id: row.application_id,
            status: row.status,
            rating_average: row.rating_average.unwrap_or_else(|| BigDecimal::from(0)),
            rating_count: row.rating_count.unwrap_or(0),
            bio: row.bio,
            hired_at: row.hired_at,
            suspended_at: row.suspended_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    /// Finalise l'activation d'un coursier
    pub async fn create_courier_profile(&self, payload: NewCourierProfile) -> AppResult<Courier> {
        let row = sqlx::query!(
            r#"
            INSERT INTO couriers (
                user_id,
                application_id,
                status,
                rating_average,
                rating_count,
                bio,
                hired_at
            )
            VALUES ($1, $2, $3, 0, 0, $4, NOW())
            RETURNING
                id,
                user_id,
                application_id    AS "application_id?: Uuid",
                status            AS "status: DeliveryCourierStatus",
                rating_average    AS "rating_average!: BigDecimal",
                rating_count       AS "rating_count!: i32",
                bio                AS "bio?: String",
                hired_at           AS "hired_at?: chrono::DateTime<Utc>",
                suspended_at       AS "suspended_at?: chrono::DateTime<Utc>",
                created_at         AS "created_at!: chrono::DateTime<Utc>",
                updated_at         AS "updated_at!: chrono::DateTime<Utc>"
            "#,
            payload.user_id,
            payload.application_id,
            DeliveryCourierStatus::Approved as DeliveryCourierStatus,
            payload.bio
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(Courier {
            id: row.id,
            user_id: row.user_id,
            application_id: row.application_id,
            status: row.status,
            rating_average: row.rating_average,
            rating_count: row.rating_count,
            bio: row.bio,
            hired_at: row.hired_at,
            suspended_at: row.suspended_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Ajoute un engin au profil coursier
    pub async fn upsert_courier_asset(&self, payload: NewCourierAsset) -> AppResult<CourierAsset> {
        let row = sqlx::query!(
            r#"
            INSERT INTO courier_assets (
                courier_id,
                engine_type,
                is_primary,
                max_weight_kg,
                max_volume_cm3,
                equipments,
                available,
                availability_schedule,
                documents
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (courier_id) WHERE is_primary = TRUE
            DO UPDATE SET
                engine_type = EXCLUDED.engine_type,
                max_weight_kg = EXCLUDED.max_weight_kg,
                max_volume_cm3 = EXCLUDED.max_volume_cm3,
                equipments = EXCLUDED.equipments,
                available = EXCLUDED.available,
                availability_schedule = EXCLUDED.availability_schedule,
                documents = EXCLUDED.documents,
                updated_at = NOW()
            RETURNING
                id,
                courier_id,
                engine_type             AS "engine_type: DeliveryEngineType",
                is_primary              AS "is_primary!: bool",
                max_weight_kg           AS "max_weight_kg?: BigDecimal",
                max_volume_cm3          AS "max_volume_cm3?: BigDecimal",
                equipments              AS "equipments!: serde_json::Value",
                available               AS "available!: bool",
                availability_schedule   AS "availability_schedule?: serde_json::Value",
                documents               AS "documents?: serde_json::Value",
                created_at              AS "created_at!: chrono::DateTime<Utc>",
                updated_at              AS "updated_at!: chrono::DateTime<Utc>"
            "#,
            payload.courier_id,
            payload.engine_type as DeliveryEngineType,
            payload.is_primary,
            payload.max_weight_kg,
            payload.max_volume_cm3,
            payload.equipments,
            payload.available,
            payload.availability_schedule,
            payload.documents
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(CourierAsset {
            id: row.id,
            courier_id: row.courier_id,
            engine_type: row.engine_type,
            is_primary: row.is_primary,
            max_weight_kg: row.max_weight_kg,
            max_volume_cm3: row.max_volume_cm3,
            equipments: row.equipments,
            available: row.available,
            availability_schedule: row.availability_schedule,
            documents: row.documents,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Crée une nouvelle course (parcel + delivery + statut initial)
    pub async fn create_delivery_request(
        &self,
        payload: NewDeliveryRequest,
    ) -> AppResult<DeliverySummary> {
        let mut tx = self.pool.begin().await?;

        let parcel_row = sqlx::query!(
            r#"
             INSERT INTO delivery_parcels (
                 type_id,
                 weight_kg,
                 volume_cm3,
                 declared_value,
                 notes,
                 photos,
                 constraints
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING
                 id,
                 type_id,
                 weight_kg       AS "weight_kg?: BigDecimal",
                 volume_cm3      AS "volume_cm3?: BigDecimal",
                 declared_value  AS "declared_value?: BigDecimal",
                notes,
                photos         AS "photos!: serde_json::Value",
                constraints    AS "constraints!: serde_json::Value",
               created_at      AS "created_at!: chrono::DateTime<Utc>"
             "#,
            payload.parcel.type_id,
            payload.parcel.weight_kg,
            payload.parcel.volume_cm3,
            payload.parcel.declared_value,
            payload.parcel.notes,
            payload.parcel.photos,
            payload.parcel.constraints
        )
        .fetch_one(&mut *tx)
        .await?;

        let parcel = DeliveryParcel {
            id: parcel_row.id,
            type_id: parcel_row.type_id,
            weight_kg: parcel_row.weight_kg,
            volume_cm3: parcel_row.volume_cm3,
            declared_value: parcel_row.declared_value,
            notes: parcel_row.notes,
            photos: parcel_row.photos,
            constraints: parcel_row.constraints,
            created_at: parcel_row.created_at,
        };

        let recipient = payload.recipient.as_ref();
        let recipient_user_id = recipient.and_then(|r| r.user_id);
        let recipient_contact_name = recipient.and_then(|r| r.contact_name.clone());
        let recipient_contact_phone = recipient.and_then(|r| r.contact_phone.clone());
        let recipient_notes = recipient.and_then(|r| r.notes.clone());
        let recipient_chat_thread_id = recipient.and_then(|r| r.chat_thread_id);
        let (recipient_dropoff_lat, recipient_dropoff_lng) = recipient
            .and_then(|r| r.dropoff_override.as_ref())
            .map(|point| (Some(point.latitude), Some(point.longitude)))
            .unwrap_or((None, None));
        let recipient_dropoff_address = recipient.and_then(|r| r.dropoff_address.clone());
        let recipient_dropoff_updated_at =
            if recipient_dropoff_lat.is_some() && recipient_dropoff_lng.is_some() {
                Some(Utc::now())
            } else {
                None
            };

        let delivery_row = sqlx::query!(
            r#"
            INSERT INTO deliveries (
                creator_id,
                courier_id,
                parcel_id,
                status,
                pickup_location,
                dropoff_location,
                pickup_address,
                dropoff_address,
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_chat_thread_id,
                recipient_dropoff_override,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                distance_meters,
                estimated_duration_seconds,
                metadata
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                ST_SetSRID(ST_MakePoint($5::double precision, $6::double precision), 4326)::geography,
                ST_SetSRID(ST_MakePoint($7::double precision, $8::double precision), 4326)::geography,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                CASE
                    WHEN $16::double precision IS NOT NULL AND $17::double precision IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint($17::double precision, $16::double precision), 4326)::geography
                    ELSE NULL
                END,
                $18,
                $19,
                $20,
                $21,
                $22
            )
            RETURNING
                id,
                status                     AS "status: DeliveryStatus",
                creator_id,
                courier_id,
                ST_Y(pickup_location::geometry)  AS "pickup_lat!: f64",
                ST_X(pickup_location::geometry)  AS "pickup_lng!: f64",
                ST_Y(dropoff_location::geometry) AS "dropoff_lat!: f64",
                ST_X(dropoff_location::geometry) AS "dropoff_lng!: f64",
                dropoff_address          AS "dropoff_address?: String",
                tracking_token            AS "tracking_token!: Uuid",
                recipient_user_id        AS "recipient_user_id?: i32",
                recipient_contact_name   AS "recipient_contact_name?: String",
                recipient_contact_phone  AS "recipient_contact_phone?: String",
                recipient_notes          AS "recipient_notes?: String",
                recipient_tracking_token  AS "recipient_tracking_token?: Uuid",
                ST_Y(recipient_dropoff_override::geometry) AS "recipient_dropoff_lat?: f64",
                ST_X(recipient_dropoff_override::geometry) AS "recipient_dropoff_lng?: f64",
                recipient_dropoff_address AS "recipient_dropoff_address?: String",
                recipient_dropoff_updated_at AS "recipient_dropoff_updated_at?: chrono::DateTime<Utc>",
                recipient_chat_thread_id AS "recipient_chat_thread_id?: Uuid",
                distance_meters            AS "distance_meters?: i32",
                estimated_duration_seconds AS "estimated_duration_seconds?: i32",
                actual_duration_seconds    AS "actual_duration_seconds?: i32",
                requested_at              AS "requested_at!: chrono::DateTime<Utc>",
                delivered_at              AS "delivered_at?: chrono::DateTime<Utc>",
                shopping_required         AS "shopping_required!: bool",
                ST_Y(store_location::geometry) AS "store_location_lat?: f64",
                ST_X(store_location::geometry) AS "store_location_lng?: f64",
                store_name                AS "store_name?: String",
                metadata                  AS "metadata!: serde_json::Value"
            "#,
            payload.creator_id,
            payload.courier_id,
            parcel.id,
            payload.initial_status as DeliveryStatus,
            payload.pickup.longitude,
            payload.pickup.latitude,
            payload.dropoff.longitude,
            payload.dropoff.latitude,
            payload.pickup_address,
            payload.dropoff_address,
            recipient_user_id,
            recipient_contact_name,
            recipient_contact_phone,
            recipient_notes,
            recipient_chat_thread_id,
            recipient_dropoff_lat,
            recipient_dropoff_lng,
            recipient_dropoff_address,
            recipient_dropoff_updated_at,
            payload.distance_meters,
            payload.estimated_duration_seconds,
            payload.metadata
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO delivery_status_events (
                delivery_id,
                status,
                payload,
                recorded_by
            )
            VALUES ($1, $2, $3, $4)
            "#,
            delivery_row.id,
            payload.initial_status as DeliveryStatus,
            payload.initial_event_payload,
            payload.initial_status_author
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let summary = DeliverySummary {
            id: delivery_row.id,
            status: delivery_row.status,
            creator_id: delivery_row.creator_id,
            courier_id: delivery_row.courier_id,
            preferred_courier_id: delivery_row.preferred_courier_id,
            pickup: GeoPoint {
                latitude: delivery_row.pickup_lat,
                longitude: delivery_row.pickup_lng,
            },
            dropoff: GeoPoint {
                latitude: delivery_row.dropoff_lat,
                longitude: delivery_row.dropoff_lng,
            },
            dropoff_address: delivery_row.dropoff_address.clone(),
            distance_meters: delivery_row.distance_meters,
            estimated_duration_seconds: delivery_row.estimated_duration_seconds,
            actual_duration_seconds: delivery_row.actual_duration_seconds,
            requested_at: delivery_row.requested_at,
            delivered_at: delivery_row.delivered_at,
            tracking_token: delivery_row.tracking_token,
            recipient: Some(DeliveryRecipient {
                user_id: delivery_row.recipient_user_id,
                contact_name: delivery_row.recipient_contact_name.clone(),
                contact_phone: delivery_row.recipient_contact_phone.clone(),
                notes: delivery_row.recipient_notes.clone(),
                tracking_token: delivery_row
                    .recipient_tracking_token
                    .unwrap_or(delivery_row.tracking_token),
                dropoff_override: match (
                    delivery_row.recipient_dropoff_lat,
                    delivery_row.recipient_dropoff_lng,
                ) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                dropoff_address: delivery_row.recipient_dropoff_address.clone(),
                dropoff_updated_at: delivery_row.recipient_dropoff_updated_at.clone(),
                chat_thread_id: delivery_row.recipient_chat_thread_id,
                country_code: None,
                allow_tracking: None,
                allow_contact: None,
                consent_granted: None,
                preferred_language: None,
            })
            .filter(|recipient| {
                recipient.user_id.is_some()
                    || recipient.contact_name.is_some()
                    || recipient.contact_phone.is_some()
                    || recipient.dropoff_override.is_some()
            }),
            store_name: delivery_row.store_name.clone(),
            store_location: match (
                delivery_row.store_location_lat,
                delivery_row.store_location_lng,
            ) {
                (Some(lat), Some(lng)) => Some(GeoPoint {
                    latitude: lat,
                    longitude: lng,
                }),
                _ => None,
            },
            shopping_required: delivery_row.shopping_required,
            metadata: delivery_row.metadata.clone(),
        };

        Ok(summary)
    }

    /// Ajoute un evenement de statut
    pub async fn add_status_event(
        &self,
        payload: NewStatusEvent,
    ) -> AppResult<DeliveryStatusEvent> {
        let record = sqlx::query_as!(
            DeliveryStatusEvent,
            r#"
            INSERT INTO delivery_status_events (
                delivery_id,
                status,
                payload,
                recorded_by
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                delivery_id,
                status AS "status: DeliveryStatus",
                occurred_at,
                payload,
                recorded_by
            "#,
            payload.delivery_id,
            payload.status as DeliveryStatus,
            payload
                .payload
                .unwrap_or_else(|| Value::Object(Default::default())),
            payload.recorded_by
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Met à jour les informations du destinataire
    pub async fn update_delivery_recipient(
        &self,
        delivery_id: Uuid,
        payload: NewDeliveryRecipient,
    ) -> AppResult<DeliveryRecipient> {
        let (override_lat, override_lng) = payload
            .dropoff_override
            .as_ref()
            .map(|point| (Some(point.latitude), Some(point.longitude)))
            .unwrap_or((None, None));

        let recipient = sqlx::query!(
            r#"
            UPDATE deliveries
            SET
                recipient_user_id = $2,
                recipient_contact_name = $3,
                recipient_contact_phone = $4,
                recipient_notes = $5,
                recipient_chat_thread_id = $6,
                recipient_dropoff_override = CASE
                    WHEN $7::double precision IS NOT NULL AND $8::double precision IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)::geography
                    ELSE NULL
                END,
                recipient_dropoff_address = $9,
                recipient_dropoff_updated_at = CASE
                    WHEN $7 IS NOT NULL AND $8 IS NOT NULL
                    THEN NOW()
                    ELSE NULL
                END,
                recipient_tracking_token = COALESCE(recipient_tracking_token, gen_random_uuid()),
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'recipient_extras',
                    jsonb_strip_nulls(
                        jsonb_build_object(
                            'country_code', to_jsonb($10::text),
                            'allow_tracking', to_jsonb($11::bool),
                            'allow_contact', to_jsonb($12::bool),
                            'consent_granted', to_jsonb($13::bool),
                            'preferred_language', to_jsonb($14::text)
                        )
                    )
                ),
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_tracking_token,
                ST_Y(recipient_dropoff_override::geometry) AS "recipient_dropoff_lat?: f64",
                ST_X(recipient_dropoff_override::geometry) AS "recipient_dropoff_lng?: f64",
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                metadata
            "#,
            delivery_id,
            payload.user_id,
            payload.contact_name,
            payload.contact_phone,
            payload.notes,
            payload.chat_thread_id,
            override_lat,
            override_lng,
            payload.dropoff_address,
            payload.country_code,
            payload.allow_tracking,
            payload.allow_contact,
            payload.consent_granted,
            payload.preferred_language
        )
        .fetch_one(&self.pool)
        .await?;

        let extras = recipient
            .metadata
            .as_ref()
            .and_then(|meta| meta.get("recipient_extras"))
            .cloned()
            .unwrap_or_else(|| Value::Object(Default::default()));

        Ok(DeliveryRecipient {
            user_id: recipient.recipient_user_id,
            contact_name: recipient.recipient_contact_name,
            contact_phone: recipient.recipient_contact_phone,
            notes: recipient.recipient_notes,
            tracking_token: recipient
                .recipient_tracking_token
                .expect("recipient_tracking_token must be generated"),
            dropoff_override: match (
                recipient.recipient_dropoff_lat,
                recipient.recipient_dropoff_lng,
            ) {
                (Some(lat), Some(lng)) => Some(GeoPoint {
                    latitude: lat,
                    longitude: lng,
                }),
                _ => None,
            },
            dropoff_address: recipient.recipient_dropoff_address,
            dropoff_updated_at: recipient.recipient_dropoff_updated_at,
            chat_thread_id: recipient.recipient_chat_thread_id,
            country_code: extras
                .get("country_code")
                .and_then(|v| v.as_str())
                .map(ToString::to_string)
                .or_else(|| payload.country_code.clone()),
            allow_tracking: extras
                .get("allow_tracking")
                .and_then(|v| v.as_bool())
                .or(payload.allow_tracking),
            allow_contact: extras
                .get("allow_contact")
                .and_then(|v| v.as_bool())
                .or(payload.allow_contact),
            consent_granted: extras
                .get("consent_granted")
                .and_then(|v| v.as_bool())
                .or(payload.consent_granted),
            preferred_language: extras
                .get("preferred_language")
                .and_then(|v| v.as_str())
                .map(ToString::to_string)
                .or_else(|| payload.preferred_language.clone()),
        })
    }

    /// Met à jour la position fournie par le destinataire et consigne l'historique
    pub async fn update_recipient_dropoff(
        &self,
        delivery_id: Uuid,
        point: GeoPoint,
        address: Option<String>,
        submitted_by: Option<i32>,
    ) -> AppResult<DeliveryRecipient> {
        let mut tx = self.pool.begin().await?;

        let recipient = sqlx::query!(
            r#"
            UPDATE deliveries
            SET
                recipient_dropoff_override = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                recipient_dropoff_address = $4,
                recipient_dropoff_updated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_tracking_token,
                ST_Y(recipient_dropoff_override::geometry) AS "recipient_dropoff_lat?: f64",
                ST_X(recipient_dropoff_override::geometry) AS "recipient_dropoff_lng?: f64",
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                metadata
            "#,
            delivery_id,
            point.longitude,
            point.latitude,
            address.clone()
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO delivery_recipient_updates (
                delivery_id,
                submitted_by,
                latitude,
                longitude,
                address
            )
            VALUES ($1, $2, $3, $4, $5)
            "#,
            delivery_id,
            submitted_by,
            point.latitude,
            point.longitude,
            address
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let extras = recipient
            .metadata
            .as_ref()
            .and_then(|meta| meta.get("recipient_extras"))
            .cloned()
            .unwrap_or_else(|| Value::Object(Default::default()));

        Ok(DeliveryRecipient {
            user_id: recipient.recipient_user_id,
            contact_name: recipient.recipient_contact_name,
            contact_phone: recipient.recipient_contact_phone,
            notes: recipient.recipient_notes,
            tracking_token: recipient
                .recipient_tracking_token
                .expect("recipient_tracking_token must be present"),
            dropoff_override: match (
                recipient.recipient_dropoff_lat,
                recipient.recipient_dropoff_lng,
            ) {
                (Some(lat), Some(lng)) => Some(GeoPoint {
                    latitude: lat,
                    longitude: lng,
                }),
                _ => None,
            },
            dropoff_address: recipient.recipient_dropoff_address,
            dropoff_updated_at: recipient.recipient_dropoff_updated_at,
            chat_thread_id: recipient.recipient_chat_thread_id,
            country_code: extras
                .get("country_code")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            allow_tracking: extras.get("allow_tracking").and_then(|v| v.as_bool()),
            allow_contact: extras.get("allow_contact").and_then(|v| v.as_bool()),
            consent_granted: extras.get("consent_granted").and_then(|v| v.as_bool()),
            preferred_language: extras
                .get("preferred_language")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
        })
    }

    /// Met à jour l'adresse de pickup d'une livraison
    pub async fn update_pickup_location(
        &self,
        delivery_id: Uuid,
        point: GeoPoint,
        address: Option<String>,
        updated_by: Option<i32>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE deliveries
            SET
                pickup_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                pickup_address = $4,
                updated_at = NOW()
            WHERE id = $1
            "#,
            delivery_id,
            point.longitude,
            point.latitude,
            address
        )
        .execute(&self.pool)
        .await?;

        // Enregistrer l'historique de modification si nécessaire
        if let Some(user_id) = updated_by {
            sqlx::query!(
                r#"
                INSERT INTO delivery_recipient_updates (
                    delivery_id,
                    submitted_by,
                    latitude,
                    longitude,
                    address
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
                "#,
                delivery_id,
                user_id,
                point.latitude,
                point.longitude,
                address
            )
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Affecte un tarif à une livraison
    pub async fn upsert_pricing(&self, payload: NewDeliveryPricing) -> AppResult<DeliveryPricing> {
        let row = sqlx::query!(
            r#"
             INSERT INTO delivery_pricing (
                 delivery_id,
                 base_price_cents,
                 distance_price_cents,
                 surcharge_cents,
                 discount_cents,
                 currency,
                 details,
                 shopping_cost_cents,
                 shopping_discount_cents
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (delivery_id)
             DO UPDATE SET
                 base_price_cents = EXCLUDED.base_price_cents,
                 distance_price_cents = EXCLUDED.distance_price_cents,
                 surcharge_cents = EXCLUDED.surcharge_cents,
                 discount_cents = EXCLUDED.discount_cents,
                 currency = EXCLUDED.currency,
                 details = EXCLUDED.details,
                 shopping_cost_cents = EXCLUDED.shopping_cost_cents,
                 shopping_discount_cents = EXCLUDED.shopping_discount_cents,
                 calculated_at = NOW()
             RETURNING
                 id,
                 delivery_id,
                base_price_cents      AS "base_price_cents!: i32",
                distance_price_cents  AS "distance_price_cents!: i32",
                surcharge_cents       AS "surcharge_cents!: i32",
                discount_cents        AS "discount_cents!: i32",
                currency              AS "currency!: String",
                calculated_at         AS "calculated_at?: chrono::DateTime<Utc>",
                COALESCE(details, '{}'::jsonb) AS "details!: serde_json::Value",
                shopping_cost_cents   AS "shopping_cost_cents!: i32",
                shopping_discount_cents AS "shopping_discount_cents!: i32"
             "#,
            payload.delivery_id,
            payload.base_price_cents,
            payload.distance_price_cents,
            payload.surcharge_cents,
            payload.discount_cents,
            payload.currency,
            payload.details,
            payload.shopping_cost_cents,
            payload.shopping_discount_cents
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(DeliveryPricing {
            id: row.id,
            delivery_id: row.delivery_id,
            base_price_cents: row.base_price_cents,
            distance_price_cents: row.distance_price_cents,
            surcharge_cents: row.surcharge_cents,
            discount_cents: row.discount_cents,
            currency: row.currency,
            calculated_at: row.calculated_at.unwrap_or_else(|| chrono::Utc::now()),
            details: row.details,
            shopping_cost_cents: row.shopping_cost_cents,
            shopping_discount_cents: row.shopping_discount_cents,
        })
    }

    pub async fn get_pricing_by_delivery(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<Option<DeliveryPricing>> {
        let pricing = sqlx::query!(
            r#"
             SELECT
                 id,
                 delivery_id,
                 base_price_cents      AS "base_price_cents!: i32",
                 distance_price_cents  AS "distance_price_cents!: i32",
                 surcharge_cents       AS "surcharge_cents!: i32",
                 discount_cents        AS "discount_cents!: i32",
                 currency              AS "currency!: String",
                 calculated_at         AS "calculated_at?: chrono::DateTime<Utc>",
                 COALESCE(details, '{}'::jsonb) AS "details!: serde_json::Value",
                 shopping_cost_cents   AS "shopping_cost_cents!: i32",
                 shopping_discount_cents AS "shopping_discount_cents!: i32"
             FROM delivery_pricing
             WHERE delivery_id = $1
             "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(pricing.map(|row| DeliveryPricing {
            id: row.id,
            delivery_id: row.delivery_id,
            base_price_cents: row.base_price_cents,
            distance_price_cents: row.distance_price_cents,
            surcharge_cents: row.surcharge_cents,
            discount_cents: row.discount_cents,
            currency: row.currency,
            calculated_at: row.calculated_at.unwrap_or_else(|| chrono::Utc::now()),
            details: row.details,
            shopping_cost_cents: row.shopping_cost_cents,
            shopping_discount_cents: row.shopping_discount_cents,
        }))
    }

    /// Récupère le résumé d'une livraison
    pub async fn get_delivery_summary(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<Option<DeliverySummary>> {
        let row = sqlx::query!(
            r#"
            SELECT
                id,
                status AS "status: DeliveryStatus",
                creator_id,
                courier_id,
                ST_Y(pickup_location::geometry) AS "pickup_lat!: f64",
                ST_X(pickup_location::geometry) AS "pickup_lng!: f64",
                ST_Y(dropoff_location::geometry) AS "dropoff_lat!: f64",
                ST_X(dropoff_location::geometry) AS "dropoff_lng!: f64",
                dropoff_address AS "dropoff_address?: String",
                distance_meters AS "distance_meters?: i32",
                estimated_duration_seconds AS "estimated_duration_seconds?: i32",
                actual_duration_seconds AS "actual_duration_seconds?: i32",
                requested_at AS "requested_at!: chrono::DateTime<Utc>",
                delivered_at AS "delivered_at?: chrono::DateTime<Utc>",
                tracking_token AS "tracking_token!: Uuid",
                recipient_user_id AS "recipient_user_id?: i32",
                recipient_contact_name AS "recipient_contact_name?: String",
                recipient_contact_phone AS "recipient_contact_phone?: String",
                recipient_notes AS "recipient_notes?: String",
                recipient_tracking_token AS "recipient_tracking_token?: Uuid",
                ST_Y(recipient_dropoff_override::geometry) AS "recipient_dropoff_lat?: f64",
                ST_X(recipient_dropoff_override::geometry) AS "recipient_dropoff_lng?: f64",
                recipient_dropoff_address AS "recipient_dropoff_address?: String",
                recipient_dropoff_updated_at AS "recipient_dropoff_updated_at?: chrono::DateTime<Utc>",
                recipient_chat_thread_id AS "recipient_chat_thread_id?: Uuid",
                store_name AS "store_name?: String",
                ST_Y(store_location::geometry) AS "store_lat?: f64",
                ST_X(store_location::geometry) AS "store_lng?: f64",
                COALESCE(shopping_required, FALSE) AS "shopping_required!: bool",
                COALESCE(metadata, '{}'::jsonb) AS "metadata!: serde_json::Value"
            FROM deliveries
            WHERE id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let metadata = row.metadata;

            let extras = metadata
                .get("recipient_extras")
                .cloned()
                .unwrap_or_else(|| Value::Object(Default::default()));

            let dropoff_address = row.dropoff_address;
            let distance_meters = row.distance_meters;
            let estimated_duration_seconds = row.estimated_duration_seconds;
            let actual_duration_seconds = row.actual_duration_seconds;
            let recipient_dropoff_lat = row.recipient_dropoff_lat;
            let recipient_dropoff_lng = row.recipient_dropoff_lng;
            let recipient_dropoff_address = row.recipient_dropoff_address;
            let recipient_dropoff_updated_at = row.recipient_dropoff_updated_at;
            let recipient_chat_thread_id = row.recipient_chat_thread_id;
            let store_lat = row.store_lat;
            let store_lng = row.store_lng;
            let store_name = row.store_name;
            let shopping_required = row.shopping_required;
            let requested_at = row.requested_at;
            let delivered_at = row.delivered_at;
            let tracking_token = row.tracking_token;

            let recipient = Some(DeliveryRecipient {
                user_id: row.recipient_user_id,
                contact_name: row.recipient_contact_name,
                contact_phone: row.recipient_contact_phone,
                notes: row.recipient_notes,
                tracking_token: row.recipient_tracking_token.unwrap_or(tracking_token),
                dropoff_override: match (recipient_dropoff_lat, recipient_dropoff_lng) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                dropoff_address: recipient_dropoff_address,
                dropoff_updated_at: recipient_dropoff_updated_at,
                chat_thread_id: recipient_chat_thread_id,
                country_code: extras
                    .get("country_code")
                    .and_then(|v| v.as_str())
                    .map(ToString::to_string),
                allow_tracking: extras.get("allow_tracking").and_then(|v| v.as_bool()),
                allow_contact: extras.get("allow_contact").and_then(|v| v.as_bool()),
                consent_granted: extras.get("consent_granted").and_then(|v| v.as_bool()),
                preferred_language: extras
                    .get("preferred_language")
                    .and_then(|v| v.as_str())
                    .map(ToString::to_string),
            })
            .filter(|recipient| {
                recipient.user_id.is_some()
                    || recipient.contact_name.is_some()
                    || recipient.contact_phone.is_some()
                    || recipient.dropoff_override.is_some()
            });

            return Ok(Some(DeliverySummary {
                id: row.id,
                status: row.status,
                creator_id: row.creator_id,
                courier_id: row.courier_id,
                preferred_courier_id: row.preferred_courier_id, // ✅ Phase 9 - Amélioration 28
                pickup: GeoPoint {
                    latitude: row.pickup_lat,
                    longitude: row.pickup_lng,
                },
                dropoff: GeoPoint {
                    latitude: row.dropoff_lat,
                    longitude: row.dropoff_lng,
                },
                dropoff_address,
                distance_meters,
                estimated_duration_seconds,
                actual_duration_seconds,
                requested_at,
                delivered_at,
                tracking_token,
                recipient,
                store_name,
                store_location: match (store_lat, store_lng) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                shopping_required,
                metadata,
            }));
        }

        Ok(None)
    }

    pub async fn get_shopping_order(&self, delivery_id: Uuid) -> AppResult<Option<ShoppingOrder>> {
        let order = sqlx::query!(
            r#"
            SELECT
                id,
                delivery_id,
                status AS "status: ShoppingStatus",
                estimated_total_cents,
                actual_total_cents AS "actual_total_cents?: i32",
                currency AS "currency!: String",
                store_name AS "store_name?: String",
                ST_Y(store_location::geometry) AS "store_lat?: f64",
                ST_X(store_location::geometry) AS "store_lng?: f64",
                notes AS "notes?: String",
                COALESCE(requires_balance_top_up, FALSE) AS "requires_balance_top_up!: bool",
                COALESCE(payload, '{}'::jsonb) AS "payload!: serde_json::Value",
                created_at AS "created_at!: chrono::DateTime<Utc>",
                updated_at AS "updated_at!: chrono::DateTime<Utc>"
            FROM shopping_orders
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(order.map(|row| {
            let store_lat = row.store_lat;
            let store_lng = row.store_lng;
            let store_name = row.store_name;
            let notes = row.notes;
            let currency = row.currency;
            let actual_total_cents = row.actual_total_cents;
            let payload = row.payload;
            let created_at = row.created_at;
            let updated_at = row.updated_at;

            ShoppingOrder {
                id: row.id,
                delivery_id: row.delivery_id,
                status: row.status,
                estimated_total_cents: row.estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                store_location: match (store_lat, store_lng) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                notes,
                requires_balance_top_up: row.requires_balance_top_up,
                payload,
                created_at,
                updated_at,
            }
        }))
    }

    pub async fn get_shopping_order_by_id(
        &self,
        order_id: Uuid,
    ) -> AppResult<Option<ShoppingOrder>> {
        let order = sqlx::query!(
            r#"
            SELECT
                id,
                delivery_id,
                status AS "status: ShoppingStatus",
                estimated_total_cents,
                actual_total_cents AS "actual_total_cents?: i32",
                currency AS "currency!: String",
                store_name AS "store_name?: String",
                ST_Y(store_location::geometry) AS "store_lat?: f64",
                ST_X(store_location::geometry) AS "store_lng?: f64",
                notes AS "notes?: String",
                COALESCE(requires_balance_top_up, FALSE) AS "requires_balance_top_up!: bool",
                COALESCE(payload, '{}'::jsonb) AS "payload!: serde_json::Value",
                created_at AS "created_at!: chrono::DateTime<Utc>",
                updated_at AS "updated_at!: chrono::DateTime<Utc>"
            FROM shopping_orders
            WHERE id = $1
            "#,
            order_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(order.map(|row| {
            let store_lat = row.store_lat;
            let store_lng = row.store_lng;
            let store_name = row.store_name;
            let notes = row.notes;
            let currency = row.currency;
            let actual_total_cents = row.actual_total_cents;
            let payload = row.payload;
            let created_at = row.created_at;
            let updated_at = row.updated_at;

            ShoppingOrder {
                id: row.id,
                delivery_id: row.delivery_id,
                status: row.status,
                estimated_total_cents: row.estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                store_location: match (store_lat, store_lng) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                notes,
                requires_balance_top_up: row.requires_balance_top_up,
                payload,
                created_at,
                updated_at,
            }
        }))
    }

    pub async fn list_shopping_items(
        &self,
        shopping_order_id: Uuid,
    ) -> AppResult<Vec<ShoppingOrderItem>> {
        let rows = sqlx::query!(
            r#"
            SELECT
                id,
                shopping_order_id,
                product_id            AS "product_id?: Uuid",
                product_name          AS "product_name!: String",
                COALESCE(characteristics, '{}'::jsonb) AS "characteristics!: serde_json::Value",
                quantity               AS "quantity!: BigDecimal",
                unit                   AS "unit!: String",
                estimated_price_cents  AS "estimated_price_cents!: i32",
                 actual_price_cents     AS "actual_price_cents?: i32",
                status                 AS "status: ShoppingItemStatus",
                COALESCE(metadata, '{}'::jsonb) AS "metadata!: serde_json::Value",
                created_at             AS "created_at!: chrono::DateTime<Utc>",
                updated_at             AS "updated_at!: chrono::DateTime<Utc>"
            FROM shopping_order_items
            WHERE shopping_order_id = $1
            ORDER BY created_at
            "#,
            shopping_order_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| ShoppingOrderItem {
                id: row.id,
                shopping_order_id: row.shopping_order_id,
                product_id: row.product_id,
                product_name: row.product_name,
                characteristics: row.characteristics,
                quantity: row.quantity,
                unit: row.unit,
                estimated_price_cents: row.estimated_price_cents,
                actual_price_cents: row.actual_price_cents,
                status: row.status,
                rejection_reason: row.rejection_reason,
                metadata: row.metadata,
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
            .collect();

        Ok(items)
    }

    pub async fn insert_shopping_order(
        &self,
        payload: NewShoppingOrder<'_>,
    ) -> AppResult<(ShoppingOrder, Vec<ShoppingOrderItem>)> {
        let mut tx = self.pool.begin().await?;
        let (store_lat, store_lng) = payload
            .store_location
            .as_ref()
            .map(|p| (Some(p.latitude), Some(p.longitude)))
            .unwrap_or((None, None));

        let order = sqlx::query!(
            r#"
            INSERT INTO shopping_orders (
                delivery_id,
                status,
                estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                store_location,
                notes,
                requires_balance_top_up,
                payload
            )
            VALUES (
                $1, $2, $3, NULL, $4, $5,
                CASE
                    WHEN $6::double precision IS NULL OR $7::double precision IS NULL
                    THEN NULL
                    ELSE ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geography
                END,
                $8, $9, $10::jsonb
            )
            RETURNING
                id,
                delivery_id,
                status AS "status: ShoppingStatus",
                estimated_total_cents AS "estimated_total_cents!: i32",
                actual_total_cents AS "actual_total_cents?: i32",
                currency AS "currency!: String",
                store_name AS "store_name?: String",
                ST_Y(store_location::geometry) AS "store_lat?: f64",
                ST_X(store_location::geometry) AS "store_lng?: f64",
                notes AS "notes?: String",
                requires_balance_top_up AS "requires_balance_top_up!: bool",
                payload AS "payload!: serde_json::Value",
                created_at AS "created_at!: chrono::DateTime<Utc>",
                updated_at AS "updated_at!: chrono::DateTime<Utc>"
            "#,
            payload.delivery_id,
            payload.status as ShoppingStatus,
            payload.estimated_total_cents,
            payload.currency,
            payload.store_name,
            store_lat,
            store_lng,
            payload.notes,
            payload.requires_balance_top_up,
            payload.payload
        )
        .fetch_one(&mut *tx)
        .await?;

        let mut items_out = Vec::new();
        for item in payload.items {
            let inserted = sqlx::query!(
                r#"
                INSERT INTO shopping_order_items (
                    shopping_order_id,
                    product_id,
                    product_name,
                    characteristics,
                    quantity,
                    unit,
                    estimated_price_cents,
                    actual_price_cents,
                    status,
                    metadata
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,NULL,$8,$9
                )
                RETURNING
                    id,
                    shopping_order_id,
                    product_id             AS "product_id?: Uuid",
                    product_name,
                    characteristics AS "characteristics!: serde_json::Value",
                    quantity AS "quantity!: BigDecimal",
                    unit AS "unit!: String",
                    estimated_price_cents AS "estimated_price_cents!: i32",
                    actual_price_cents     AS "actual_price_cents?: i32",
                    status AS "status: ShoppingItemStatus",
                    metadata AS "metadata!: serde_json::Value",
                    created_at AS "created_at!: chrono::DateTime<Utc>",
                    updated_at AS "updated_at!: chrono::DateTime<Utc>"
                "#,
                order.id,
                item.product_id,
                item.product_name,
                item.characteristics,
                item.quantity,
                item.unit,
                item.estimated_price_cents,
                item.status as ShoppingItemStatus,
                item.metadata
            )
            .fetch_one(&mut *tx)
            .await?;

            let product_id = inserted.product_id;
            let characteristics = inserted.characteristics;
            let unit = inserted.unit;
            let estimated_price_cents = inserted.estimated_price_cents;
            let actual_price_cents = inserted.actual_price_cents;
            let metadata = inserted.metadata;
            let created_at = inserted.created_at;
            let updated_at = inserted.updated_at;

            items_out.push(ShoppingOrderItem {
                id: inserted.id,
                shopping_order_id: inserted.shopping_order_id,
                product_id,
                product_name: inserted.product_name,
                characteristics,
                quantity: inserted.quantity,
                unit,
                estimated_price_cents,
                actual_price_cents,
                status: inserted.status,
                rejection_reason: inserted.rejection_reason,
                metadata,
                created_at,
                updated_at,
            });
        }

        let store_lat = order.store_lat;
        let store_lng = order.store_lng;
        let store_name = order.store_name;
        let notes = order.notes;
        let payload_value = order.payload;

        let shopping_order = ShoppingOrder {
            id: order.id,
            delivery_id: order.delivery_id,
            status: order.status,
            estimated_total_cents: order.estimated_total_cents,
            actual_total_cents: order.actual_total_cents,
            currency: order.currency,
            store_name,
            store_location: match (store_lat, store_lng) {
                (Some(lat), Some(lng)) => Some(GeoPoint {
                    latitude: lat,
                    longitude: lng,
                }),
                _ => None,
            },
            notes,
            requires_balance_top_up: order.requires_balance_top_up,
            payload: payload_value,
            created_at: order.created_at,
            updated_at: order.updated_at,
        };

        tx.commit().await?;

        Ok((shopping_order, items_out))
    }

    pub async fn update_shopping_status(
        &self,
        delivery_id: Uuid,
        status: ShoppingStatus,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE shopping_orders
            SET status = $2,
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
            delivery_id,
            status as ShoppingStatus
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_shopping_item(
        &self,
        item_id: Uuid,
        status: ShoppingItemStatus,
        actual_price_cents: Option<i32>,
        // ✅ Phase 9 - Amélioration : Raison de refus du produit
        rejection_reason: Option<crate::models::delivery_model::ParcelRejectionReason>,
        metadata: Option<Value>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE shopping_order_items
            SET status = $2,
                actual_price_cents = COALESCE($3, actual_price_cents),
                rejection_reason = $4,
                metadata = COALESCE($5, metadata),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(item_id)
        .bind(status as ShoppingItemStatus)
        .bind(actual_price_cents)
        .bind(rejection_reason.map(|r| r as ParcelRejectionReason))
        .bind(metadata)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn update_shopping_checkout(
        &self,
        delivery_id: Uuid,
        actual_total_cents: i32,
        payload: Option<Value>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE shopping_orders
            SET actual_total_cents = $2,
                status = 'checkout_submitted',
                payload = COALESCE($3, payload),
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
            delivery_id,
            actual_total_cents,
            payload
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn set_delivery_shopping_flags(
        &self,
        delivery_id: Uuid,
        store: Option<GeoPoint>,
        store_name: Option<String>,
    ) -> AppResult<()> {
        let (store_lat, store_lng) = store
            .as_ref()
            .map(|p| (Some(p.latitude), Some(p.longitude)))
            .unwrap_or((None, None));

        sqlx::query!(
            r#"
            UPDATE deliveries
            SET shopping_required = TRUE,
                store_name = $2,
                store_location = CASE
                    WHEN $3::double precision IS NULL OR $4::double precision IS NULL THEN store_location
                    ELSE ST_SetSRID(ST_MakePoint($4::double precision, $3::double precision), 4326)::geography
                END
            WHERE id = $1
            "#,
            delivery_id,
            store_name,
            store_lat,
            store_lng
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_user_balance(&self, user_id: i32) -> AppResult<i64> {
        let balance =
            sqlx::query_scalar!(r#"SELECT tokens_balance FROM users WHERE id = $1"#, user_id)
                .fetch_optional(&self.pool)
                .await?
                .unwrap_or(0);
        Ok(balance)
    }

    pub async fn update_user_balance(&self, user_id: i32, new_balance: i64) -> AppResult<()> {
        sqlx::query!(
            r#"UPDATE users SET tokens_balance = $2 WHERE id = $1"#,
            user_id,
            new_balance
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Applique une mutation wallet (débit/remboursement) avec audit
    pub async fn apply_wallet_mutation(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        direction: WalletEventDirection,
        reason: Option<String>,
        metadata: Option<Value>,
    ) -> AppResult<i64> {
        if amount_cents <= 0 {
            return Err(AppError::BadRequest(
                "Le montant de la mutation doit être strictement positif.".into(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        let current_balance = sqlx::query_scalar!(
            r#"
            SELECT tokens_balance
            FROM users
            WHERE id = $1
            FOR UPDATE
            "#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let current_balance = current_balance.ok_or_else(|| {
            AppError::NotFound(format!(
                "Utilisateur {} introuvable pour la mutation wallet",
                user_id
            ))
        })?;

        let new_balance = match direction {
            WalletEventDirection::Debit => {
                if current_balance < amount_cents {
                    return Err(AppError::BadRequest(
                        "Solde insuffisant pour effectuer le débit.".into(),
                    ));
                }
                current_balance - amount_cents
            }
            WalletEventDirection::Refund => current_balance + amount_cents,
        };

        sqlx::query!(
            r#"UPDATE users SET tokens_balance = $2 WHERE id = $1"#,
            user_id,
            new_balance
        )
        .execute(&mut *tx)
        .await?;

        let metadata_value = metadata.unwrap_or_else(|| Value::Object(Default::default()));

        sqlx::query!(
            r#"
            INSERT INTO delivery_wallet_events (
                user_id,
                delivery_id,
                direction,
                amount_cents,
                reason,
                balance_after,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
            user_id,
            delivery_id,
            direction.as_str(),
            amount_cents,
            reason,
            new_balance,
            metadata_value
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        log::info!(
            "[DeliveryWallet][Audit] mutation={} user={} delivery={} amount={} balance={}",
            direction.as_str(),
            user_id,
            delivery_id,
            amount_cents,
            new_balance
        );

        Ok(new_balance)
    }

    /// Enregistre un point de tracking GPS
    pub async fn insert_tracking_point(
        &self,
        payload: NewTrackingPoint,
    ) -> AppResult<DeliveryTrackingPoint> {
        let record = sqlx::query!(
            r#"
            INSERT INTO delivery_tracking_points (
                delivery_id,
                courier_id,
                captured_at,
                location,
                speed_kmh,
                bearing,
                accuracy_meters
            )
            VALUES (
                $1,
                $2,
                $3,
                ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                $6,
                $7,
                $8
            )
            RETURNING
                id,
                delivery_id,
                courier_id,
                captured_at AS "captured_at!: chrono::DateTime<Utc>",
                ST_Y(location::geometry) AS "lat!: f64",
                ST_X(location::geometry) AS "lng!: f64",
                speed_kmh AS "speed_kmh?: BigDecimal",
                bearing AS "bearing?: BigDecimal",
                accuracy_meters AS "accuracy_meters?: BigDecimal"
            "#,
            payload.delivery_id,
            payload.courier_id,
            payload.captured_at,
            payload.position.longitude,
            payload.position.latitude,
            payload.speed_kmh,
            payload.bearing,
            payload.accuracy_meters
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(DeliveryTrackingPoint {
            id: record.id,
            delivery_id: record.delivery_id,
            courier_id: record.courier_id,
            captured_at: record.captured_at,
            speed_kmh: record.speed_kmh,
            bearing: record.bearing,
            accuracy_meters: record.accuracy_meters,
            latitude: record.lat,
            longitude: record.lng,
        })
    }

    /// Enfile une livraison dans la queue de matching temps réel
    pub async fn enqueue_delivery_matching(
        &self,
        payload: NewDeliveryMatchingQueueItem,
    ) -> AppResult<DeliveryMatchingQueueItem> {
        let record = sqlx::query_as!(
            DeliveryMatchingQueueItem,
            r#"
            INSERT INTO delivery_matching_queue (
                delivery_id,
                zone_id,
                status,
                priority,
                attempt_count,
                payload,
                next_attempt_at,
                enqueued_at,
                updated_at
            )
            VALUES ($1, $2, 'queued', $3, 0, $4, COALESCE($5, NOW()), NOW(), NOW())
            ON CONFLICT (delivery_id)
            DO UPDATE SET
                zone_id = EXCLUDED.zone_id,
                priority = EXCLUDED.priority,
                payload = EXCLUDED.payload,
                status = 'queued',
                attempt_count = 0,
                next_attempt_at = COALESCE($5, NOW()),
                updated_at = NOW()
            RETURNING
                id,
                delivery_id,
                zone_id,
                status as "status: DeliveryMatchingStatus",
                priority,
                attempt_count,
                payload,
                next_attempt_at,
                enqueued_at,
                updated_at
            "#,
            payload.delivery_id,
            payload.zone_id,
            payload.priority,
            payload.payload,
            payload.next_attempt_at
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Met à jour le statut de file (retry, planning, etc.)
    pub async fn update_matching_queue_status(
        &self,
        delivery_id: Uuid,
        status: DeliveryMatchingStatus,
        next_attempt_at: Option<DateTime<Utc>>,
        payload: Option<Value>,
        increment_attempt: bool,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE delivery_matching_queue
            SET
                status = $2,
                next_attempt_at = COALESCE($3, next_attempt_at),
                payload = COALESCE($4, payload),
                attempt_count = attempt_count + CASE WHEN $5 THEN 1 ELSE 0 END,
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
            delivery_id,
            status as DeliveryMatchingStatus,
            next_attempt_at,
            payload,
            increment_attempt
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Insère un événement d'audit dans l'historique de matching
    pub async fn insert_matching_event(
        &self,
        payload: NewDeliveryMatchingEvent,
    ) -> AppResult<DeliveryMatchingEvent> {
        let record = sqlx::query_as!(
            DeliveryMatchingEvent,
            r#"
            INSERT INTO delivery_matching_events (
                delivery_id,
                courier_id,
                status,
                score,
                reason,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                delivery_id,
                courier_id,
                status as "status: DeliveryMatchingStatus",
                score,
                reason,
                metadata,
                created_at
            "#,
            payload.delivery_id,
            payload.courier_id,
            payload.status as DeliveryMatchingStatus,
            payload.score,
            payload.reason,
            payload.metadata
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Liste les coursiers disponibles proches d'un point cible
    pub async fn list_matching_candidates(
        &self,
        pickup: GeoPoint,
        zone_id: Option<Uuid>,
        limit: i64,
        max_distance_meters: Option<f64>,
        passenger_mode: bool,
    ) -> AppResult<Vec<CourierMatchingCandidate>> {
        let mut builder = QueryBuilder::<Postgres>::new(
            "
            SELECT
                cas.courier_id,
                cas.zone_id,
                cas.active_deliveries,
                cas.max_capacity,
                cas.load_factor,
                cas.latitude,
                cas.longitude,
                cas.captured_at,
                COALESCE(cza.capacity_weight, 1) AS capacity_weight,
                COALESCE(cza.is_primary, FALSE) AS is_primary,
                COALESCE(cza.metadata, '{}'::jsonb) AS metadata,
                CASE
                    WHEN cas.location IS NOT NULL THEN ST_Distance(
                        cas.location,
                        ST_SetSRID(ST_MakePoint(",
        );
        builder.push_bind(pickup.longitude);
        builder.push(", ");
        builder.push_bind(pickup.latitude);
        builder.push(
            "), 4326)::geography
                    )
                    ELSE NULL
                END AS distance_meters
            FROM courier_availability_snapshots cas
            LEFT JOIN LATERAL (
                SELECT cza.*
                FROM courier_zone_assignments cza
                WHERE cza.courier_id = cas.courier_id
                  AND cza.is_active = TRUE
                ORDER BY cza.is_primary DESC, cza.updated_at DESC
                LIMIT 1
            ) cza ON TRUE
            WHERE cas.captured_at >= NOW() - INTERVAL '30 minutes'
              AND cas.is_online = TRUE
              AND cas.active_deliveries < cas.max_capacity
        ",
        );

        if passenger_mode {
            builder.push(" AND (cza.metadata ->> 'passenger_mode')::boolean IS TRUE");
        }

        if let Some(zone) = zone_id {
            builder.push(" AND (cas.zone_id = ");
            builder.push_bind(zone);
            builder.push(" OR cza.zone_id = ");
            builder.push_bind(zone);
            builder.push(")");
        }

        if let Some(max_distance) = max_distance_meters {
            builder.push(
                " AND (cas.location IS NULL OR ST_Distance(cas.location, ST_SetSRID(ST_MakePoint(",
            );
            builder.push_bind(pickup.longitude);
            builder.push(", ");
            builder.push_bind(pickup.latitude);
            builder.push("), 4326)::geography) <= ");
            builder.push_bind(max_distance);
            builder.push(")");
        }

        builder.push(" ORDER BY distance_meters ASC NULLS LAST, cas.load_factor ASC LIMIT ");
        builder.push_bind(limit.max(1));

        let rows = builder
            .build_query_as::<CourierMatchingCandidate>()
            .fetch_all(&self.pool)
            .await?;

        Ok(rows)
    }

    /// Associe définitivement un coursier à la livraison
    pub async fn assign_delivery_courier(
        &self,
        delivery_id: Uuid,
        courier_id: Uuid,
    ) -> AppResult<()> {
        sqlx::query!(
            "UPDATE deliveries SET courier_id = $2, updated_at = NOW() WHERE id = $1",
            delivery_id,
            courier_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn ensure_recipient_tracking_token(&self, delivery_id: Uuid) -> AppResult<Uuid> {
        let row = sqlx::query!(
            r#"
            UPDATE deliveries
            SET recipient_tracking_token = COALESCE(recipient_tracking_token, gen_random_uuid()),
                updated_at = NOW()
            WHERE id = $1
            RETURNING recipient_tracking_token
            "#,
            delivery_id
        )
        .fetch_one(&self.pool)
        .await?;

        row.recipient_tracking_token
            .ok_or_else(|| AppError::Internal("recipient_tracking_token missing".into()))
    }

    pub async fn merge_delivery_metadata(&self, delivery_id: Uuid, patch: &Value) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE deliveries
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $2,
                updated_at = NOW()
            WHERE id = $1
            "#,
            delivery_id,
            patch
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn find_delivery_id_by_recipient_token(
        &self,
        token: Uuid,
    ) -> AppResult<Option<Uuid>> {
        let row = sqlx::query!(
            r#"
            SELECT id
            FROM deliveries
            WHERE recipient_tracking_token = $1
               OR tracking_token = $1
            LIMIT 1
            "#,
            token
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|record| record.id))
    }

    /// Récupère un lot d'éléments de file dont l'heure de retry est échue
    pub async fn fetch_matching_queue_batch(
        &self,
        limit: i64,
    ) -> AppResult<Vec<DeliveryMatchingQueueItem>> {
        let rows = sqlx::query_as!(
            DeliveryMatchingQueueItem,
            r#"
            SELECT
                id,
                delivery_id,
                zone_id,
                status as "status: DeliveryMatchingStatus",
                priority,
                attempt_count,
                payload,
                next_attempt_at,
                enqueued_at,
                updated_at
            FROM delivery_matching_queue
            WHERE status IN ('queued', 'searching')
              AND next_attempt_at <= NOW()
            ORDER BY priority ASC, next_attempt_at ASC
            LIMIT $1
            "#,
            limit.max(1)
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Ajoute ou met à jour une note client -> coursier
    pub async fn upsert_courier_rating(
        &self,
        payload: NewCourierRating,
    ) -> AppResult<CourierRating> {
        let row = sqlx::query!(
            r#"
            INSERT INTO courier_ratings (
                delivery_id,
                courier_id,
                rater_id,
                score_small,
                tags,
                comment
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (delivery_id)
            DO UPDATE SET
                score_small = EXCLUDED.score_small,
                tags = EXCLUDED.tags,
                comment = EXCLUDED.comment,
                created_at = NOW()
            RETURNING
                id,
                delivery_id,
                courier_id,
                rater_id,
                score_small,
                tags             AS "tags?: Vec<Option<String>>",
                comment          AS "comment?: String",
                created_at       AS "created_at!: chrono::DateTime<Utc>"
            "#,
            payload.delivery_id,
            payload.courier_id,
            payload.rater_id,
            payload.score_small,
            payload.tags.as_deref(),
            payload.comment
        )
        .fetch_one(&self.pool)
        .await?;

        let tags = row
            .tags
            .map(|values| values.into_iter().flatten().collect::<Vec<String>>());

        Ok(CourierRating {
            id: row.id,
            delivery_id: row.delivery_id,
            courier_id: row.courier_id,
            rater_id: row.rater_id,
            score_small: row.score_small,
            tags,
            comment: row.comment,
            created_at: row.created_at,
        })
    }

    /// Ajoute ou met à jour une note coursier -> client
    pub async fn upsert_client_rating(&self, payload: NewClientRating) -> AppResult<ClientRating> {
        let row = sqlx::query!(
            r#"
            INSERT INTO client_ratings (
                delivery_id,
                client_id,
                courier_id,
                score_small,
                tags,
                comment
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (delivery_id)
            DO UPDATE SET
                score_small = EXCLUDED.score_small,
                tags = EXCLUDED.tags,
                comment = EXCLUDED.comment,
                created_at = NOW()
            RETURNING
                id,
                delivery_id,
                client_id,
                courier_id,
                score_small,
                tags        AS "tags?: Vec<Option<String>>",
                comment     AS "comment?: String",
                created_at AS "created_at!: chrono::DateTime<Utc>"
            "#,
            payload.delivery_id,
            payload.client_id,
            payload.courier_id,
            payload.score_small,
            payload.tags.as_deref(),
            payload.comment
        )
        .fetch_one(&self.pool)
        .await?;

        let tags = row
            .tags
            .map(|values| values.into_iter().flatten().collect::<Vec<String>>());

        Ok(ClientRating {
            id: row.id,
            delivery_id: row.delivery_id,
            client_id: row.client_id,
            courier_id: row.courier_id,
            score_small: row.score_small,
            tags,
            comment: row.comment,
            created_at: row.created_at,
        })
    }

    /// Met à jour le statut d'une livraison
    pub async fn update_delivery_status(
        &self,
        delivery_id: Uuid,
        status: DeliveryStatus,
        cancel_reason: Option<DeliveryCancelReason>,
        timestamp_field: Option<DeliveryTimestampField>,
    ) -> AppResult<PgQueryResult> {
        let mut query = String::from(
            "UPDATE deliveries SET status = $2, updated_at = NOW(), cancel_reason = $3",
        );

        if let Some(field) = timestamp_field {
            query.push_str(", ");
            query.push_str(field.as_assignment());
        }

        query.push_str(" WHERE id = $1");

        let result = sqlx::query(&query)
            .bind(delivery_id)
            .bind(status)
            .bind(cancel_reason)
            .execute(&self.pool)
            .await?;

        Ok(result)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use sqlx::postgres::PgPoolOptions;
    use std::sync::Once;

    static INIT: Once = Once::new();

    pub fn mock_pool() -> PgPool {
        INIT.call_once(|| {
            let _ = env_logger::builder().is_test(true).try_init();
        });
        futures::executor::block_on(async {
            PgPoolOptions::new()
                .max_connections(1)
                .connect("postgres://postgres:postgres@localhost/test_delivery")
                .await
                .expect("mock pool")
        })
    }
}

/// Payload candidature coursier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCourierApplication {
    pub user_id: i32,
    pub status: DeliveryApplicationStatus,
    pub submitted_at: Option<DateTime<Utc>>,
    pub profile_data: Value,
    pub documents: Value,
    pub notes: Option<Value>,
}

/// Payload pour créer le profil coursier validé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCourierProfile {
    pub user_id: i32,
    pub application_id: Option<Uuid>,
    pub bio: Option<String>,
}

/// Payload pour créer/mettre à jour l'engin principal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCourierAsset {
    pub courier_id: Uuid,
    pub engine_type: DeliveryEngineType,
    pub is_primary: bool,
    pub max_weight_kg: Option<BigDecimal>,
    pub max_volume_cm3: Option<BigDecimal>,
    pub equipments: Value,
    pub available: bool,
    pub availability_schedule: Option<Value>,
    pub documents: Option<Value>,
}

/// Informations colis à insérer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryParcel {
    pub type_id: Option<i32>,
    pub weight_kg: Option<BigDecimal>,
    pub volume_cm3: Option<BigDecimal>,
    pub declared_value: Option<BigDecimal>,
    pub notes: Option<String>,
    pub photos: Value,
    pub constraints: Value,
}

/// Informations destinataire associées à une livraison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryRecipient {
    pub user_id: Option<i32>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub notes: Option<String>,
    pub chat_thread_id: Option<Uuid>,
    pub dropoff_override: Option<GeoPoint>,
    pub dropoff_address: Option<String>,
    pub country_code: Option<String>,
    pub allow_tracking: Option<bool>,
    pub allow_contact: Option<bool>,
    pub consent_granted: Option<bool>,
    pub preferred_language: Option<String>,
}

/// Payload creation d'une course
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryRequest {
    pub creator_id: i32,
    pub courier_id: Option<Uuid>,
    pub parcel: NewDeliveryParcel,
    pub pickup: GeoPoint,
    pub pickup_address: Option<String>,
    pub dropoff: GeoPoint,
    pub dropoff_address: Option<String>,
    pub recipient: Option<NewDeliveryRecipient>,
    pub distance_meters: Option<i32>,
    pub estimated_duration_seconds: Option<i32>,
    pub metadata: Value,
    pub initial_status: DeliveryStatus,
    pub initial_event_payload: Value,
    pub initial_status_author: Option<i32>,
}

/// Evenement de statut à enregistrer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewStatusEvent {
    pub delivery_id: Uuid,
    pub status: DeliveryStatus,
    pub payload: Option<Value>,
    pub recorded_by: Option<i32>,
}

/// Pricing calculé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryPricing {
    pub delivery_id: Uuid,
    pub base_price_cents: i32,
    pub distance_price_cents: i32,
    pub surcharge_cents: i32,
    pub discount_cents: i32,
    pub currency: String,
    pub details: Value,
    pub shopping_cost_cents: i32,
    pub shopping_discount_cents: i32,
}

/// Position GPS / telemetrie
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTrackingPoint {
    pub delivery_id: Uuid,
    pub courier_id: Uuid,
    pub position: GeoPoint,
    pub captured_at: DateTime<Utc>,
    pub speed_kmh: Option<BigDecimal>,
    pub bearing: Option<BigDecimal>,
    pub accuracy_meters: Option<BigDecimal>,
}

/// Payload insertion file d'attente matching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryMatchingQueueItem {
    pub delivery_id: Uuid,
    pub zone_id: Option<Uuid>,
    pub priority: i16,
    pub payload: Value,
    pub next_attempt_at: Option<DateTime<Utc>>,
}

/// Payload audit matching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryMatchingEvent {
    pub delivery_id: Uuid,
    pub courier_id: Option<Uuid>,
    pub status: DeliveryMatchingStatus,
    pub score: Option<BigDecimal>,
    pub reason: Option<String>,
    pub metadata: Value,
}

/// Note client vers coursier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCourierRating {
    pub delivery_id: Uuid,
    pub courier_id: Uuid,
    pub rater_id: i32,
    pub score_small: i32,
    pub tags: Option<Vec<String>>,
    pub comment: Option<String>,
}

/// Note coursier vers client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewClientRating {
    pub delivery_id: Uuid,
    pub client_id: i32,
    pub courier_id: Uuid,
    pub score_small: i32,
    pub tags: Option<Vec<String>>,
    pub comment: Option<String>,
}

/// Champs timestamp transitions
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DeliveryTimestampField {
    ConfirmedAt,
    AcceptedAt,
    PickedUpAt,
    DeliveredAt,
    CompletedAt,
    CancelledAt,
}

impl DeliveryTimestampField {
    fn as_assignment(self) -> &'static str {
        match self {
            DeliveryTimestampField::ConfirmedAt => "confirmed_at = NOW()",
            DeliveryTimestampField::AcceptedAt => "accepted_at = NOW()",
            DeliveryTimestampField::PickedUpAt => "picked_up_at = NOW()",
            DeliveryTimestampField::DeliveredAt => "delivered_at = NOW()",
            DeliveryTimestampField::CompletedAt => "completed_at = NOW()",
            DeliveryTimestampField::CancelledAt => "cancelled_at = NOW()",
        }
    }
}

#[derive(Debug, Clone)]
pub struct NewShoppingOrder<'a> {
    pub delivery_id: Uuid,
    pub status: ShoppingStatus,
    pub estimated_total_cents: i32,
    pub currency: &'a str,
    pub store_name: Option<&'a str>,
    pub store_location: Option<GeoPoint>,
    pub notes: Option<&'a str>,
    pub requires_balance_top_up: bool,
    pub payload: Value,
    pub items: &'a [NewShoppingOrderItem],
}

#[derive(Debug, Clone)]
pub struct NewShoppingOrderItem {
    pub product_id: Option<Uuid>,
    pub product_name: String,
    pub characteristics: Value,
    pub quantity: BigDecimal,
    pub unit: String,
    pub estimated_price_cents: i32,
    pub status: ShoppingItemStatus,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingEstimateItem {
    pub product_name: String,
    pub quantity: BigDecimal,
    pub unit: String,
    pub estimated_price_cents: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingEstimateResult {
    pub items: Vec<ShoppingEstimateItem>,
    pub estimated_total_cents: i32,
    pub estimated_shopping_time_minutes: i32,
    pub currency: String,
}
