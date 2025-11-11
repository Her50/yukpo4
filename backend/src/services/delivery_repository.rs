use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        ClientRating, Courier, CourierApplication, CourierAsset, CourierRating,
        DeliveryApplicationStatus, DeliveryCancelReason, DeliveryCourierStatus, DeliveryParcel,
        DeliveryPricing, DeliveryRecipient, DeliveryRecipientUpdate, DeliveryStatus,
        DeliveryStatusEvent, DeliverySummary, DeliveryTrackingPoint, GeoPoint, ParcelType,
        ShoppingItemStatus, ShoppingOrder, ShoppingOrderItem, ShoppingStatus,
    },
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgQueryResult, PgPool};
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
        let events = sqlx::query_as!(
            DeliveryStatusEvent,
            r#"
            SELECT
                id,
                delivery_id,
                status AS "status: DeliveryStatus",
                occurred_at,
                payload,
                recorded_by
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

        Ok(events)
    }

    /// Historique des positions partagées par le destinataire
    pub async fn list_recipient_updates(
        &self,
        delivery_id: Uuid,
        limit: i64,
    ) -> AppResult<Vec<DeliveryRecipientUpdate>> {
        let updates = sqlx::query_as!(
            DeliveryRecipientUpdate,
            r#"
            SELECT
                id,
                delivery_id,
                submitted_by,
                latitude,
                longitude,
                address,
                created_at
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

        Ok(updates)
    }

    /// Retourne la liste des typologies de colis
    pub async fn list_parcel_types(&self) -> AppResult<Vec<ParcelType>> {
        let rows = sqlx::query_as!(
            ParcelType,
            r#"
            SELECT
                id,
                slug,
                display_name,
                description,
                max_weight_kg,
                max_volume_cm3,
                requires_isothermal,
                requires_fragile_handling,
                requires_secure_box,
                requires_document_protection,
                metadata,
                created_at
            FROM parcel_types
            ORDER BY display_name ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Crée une candidature de coursier
    pub async fn create_courier_application(
        &self,
        payload: NewCourierApplication,
    ) -> AppResult<CourierApplication> {
        let record = sqlx::query_as!(
            CourierApplication,
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
                status AS "status: DeliveryApplicationStatus",
                submitted_at,
                reviewed_at,
                reviewer_id,
                rejection_reason,
                profile_data,
                documents,
                notes,
                created_at,
                updated_at
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

        Ok(record)
    }

    /// Met à jour le statut d'une candidature
    pub async fn update_courier_application_status(
        &self,
        application_id: Uuid,
        status: DeliveryApplicationStatus,
        reviewer_id: Option<i32>,
        rejection_reason: Option<String>,
    ) -> AppResult<CourierApplication> {
        let record = sqlx::query_as!(
            CourierApplication,
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
                status AS "status: DeliveryApplicationStatus",
                submitted_at,
                reviewed_at,
                reviewer_id,
                rejection_reason,
                profile_data,
                documents,
                notes,
                created_at,
                updated_at
            "#,
            application_id,
            status as DeliveryApplicationStatus,
            reviewer_id,
            rejection_reason
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Retourne la candidature active d'un utilisateur si elle existe
    pub async fn find_courier_application_by_user(
        &self,
        user_id: i32,
    ) -> AppResult<Option<CourierApplication>> {
        let record = sqlx::query_as!(
            CourierApplication,
            r#"
            SELECT
                id,
                user_id,
                status AS "status: DeliveryApplicationStatus",
                submitted_at,
                reviewed_at,
                reviewer_id,
                rejection_reason,
                profile_data,
                documents,
                notes,
                created_at,
                updated_at
            FROM courier_applications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    /// Récupère le profil coursier associé à un utilisateur
    pub async fn find_courier_by_user(&self, user_id: i32) -> AppResult<Option<Courier>> {
        let record = sqlx::query_as!(
            Courier,
            r#"
            SELECT
                id,
                user_id,
                application_id,
                status AS "status: DeliveryCourierStatus",
                rating_average,
                rating_count,
                bio,
                hired_at,
                suspended_at,
                created_at,
                updated_at
            FROM couriers
            WHERE user_id = $1
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    pub async fn find_courier_by_id(&self, courier_id: Uuid) -> AppResult<Option<Courier>> {
        let record = sqlx::query_as!(
            Courier,
            r#"
            SELECT
                id,
                user_id,
                application_id,
                status AS "status: DeliveryCourierStatus",
                rating_average,
                rating_count,
                bio,
                hired_at,
                suspended_at,
                created_at,
                updated_at
            FROM couriers
            WHERE id = $1
            "#,
            courier_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    /// Finalise l'activation d'un coursier
    pub async fn create_courier_profile(&self, payload: NewCourierProfile) -> AppResult<Courier> {
        let record = sqlx::query_as!(
            Courier,
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
                application_id,
                status AS "status: DeliveryCourierStatus",
                rating_average,
                rating_count,
                bio,
                hired_at,
                suspended_at,
                created_at,
                updated_at
            "#,
            payload.user_id,
            payload.application_id,
            DeliveryCourierStatus::Approved as DeliveryCourierStatus,
            payload.bio
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Ajoute un engin au profil coursier
    pub async fn upsert_courier_asset(&self, payload: NewCourierAsset) -> AppResult<CourierAsset> {
        let record = sqlx::query_as!(
            CourierAsset,
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
                engine_type AS "engine_type: DeliveryEngineType",
                is_primary,
                max_weight_kg,
                max_volume_cm3,
                equipments,
                available,
                availability_schedule,
                documents,
                created_at,
                updated_at
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

        Ok(record)
    }

    /// Crée une nouvelle course (parcel + delivery + statut initial)
    pub async fn create_delivery_request(
        &self,
        payload: NewDeliveryRequest,
    ) -> AppResult<DeliverySummary> {
        let mut tx = self.pool.begin().await?;

        let parcel = sqlx::query_as!(
            DeliveryParcel,
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
                weight_kg,
                volume_cm3,
                declared_value,
                notes,
                photos,
                constraints,
                created_at
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
                ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                CASE
                    WHEN $16 IS NOT NULL AND $17 IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint($17, $16), 4326)::geography
                    ELSE NULL
                END,
                $18,
                $19,
                $20,
                $21
            )
            RETURNING
                id,
                status AS "status: DeliveryStatus",
                creator_id,
                courier_id,
                ST_Y(pickup_location::geometry) AS "pickup_lat!",
                ST_X(pickup_location::geometry) AS "pickup_lng!",
                ST_Y(dropoff_location::geometry) AS "dropoff_lat!",
                ST_X(dropoff_location::geometry) AS "dropoff_lng!",
                dropoff_address,
                tracking_token,
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_tracking_token,
                recipient_dropoff_override,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                distance_meters,
                estimated_duration_seconds,
                actual_duration_seconds,
                requested_at,
                delivered_at
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
            pickup: GeoPoint {
                latitude: delivery_row.pickup_lat,
                longitude: delivery_row.pickup_lng,
            },
            dropoff: GeoPoint {
                latitude: delivery_row.dropoff_lat,
                longitude: delivery_row.dropoff_lng,
            },
            dropoff_address: delivery_row.dropoff_address,
            distance_meters: delivery_row.distance_meters,
            estimated_duration_seconds: delivery_row.estimated_duration_seconds,
            actual_duration_seconds: delivery_row.actual_duration_seconds,
            requested_at: delivery_row.requested_at,
            delivered_at: delivery_row.delivered_at,
            tracking_token: delivery_row.tracking_token,
            recipient: Some(DeliveryRecipient {
                user_id: delivery_row.recipient_user_id,
                contact_name: delivery_row.recipient_contact_name,
                contact_phone: delivery_row.recipient_contact_phone,
                notes: delivery_row.recipient_notes,
                tracking_token: delivery_row.recipient_tracking_token,
                dropoff_override: delivery_row.recipient_dropoff_override.map(|geo| GeoPoint {
                    latitude: geo.y(),
                    longitude: geo.x(),
                }),
                dropoff_address: delivery_row.recipient_dropoff_address,
                dropoff_updated_at: delivery_row.recipient_dropoff_updated_at,
                chat_thread_id: delivery_row.recipient_chat_thread_id,
            })
            .filter(|recipient| {
                recipient.user_id.is_some()
                    || recipient.contact_name.is_some()
                    || recipient.contact_phone.is_some()
                    || recipient.dropoff_override.is_some()
            }),
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
                    WHEN $7 IS NOT NULL AND $8 IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography
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
                            'country_code', $10,
                            'allow_tracking', $11,
                            'allow_contact', $12,
                            'consent_granted', $13,
                            'preferred_language', $14
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
                recipient_dropoff_override,
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
            dropoff_override: recipient.recipient_dropoff_override.map(|geo| GeoPoint {
                latitude: geo.y(),
                longitude: geo.x(),
            }),
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
                recipient_dropoff_override,
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
            dropoff_override: recipient.recipient_dropoff_override.map(|geo| GeoPoint {
                latitude: geo.y(),
                longitude: geo.x(),
            }),
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

    /// Affecte un tarif à une livraison
    pub async fn upsert_pricing(&self, payload: NewDeliveryPricing) -> AppResult<DeliveryPricing> {
        let record = sqlx::query_as!(
            DeliveryPricing,
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
                base_price_cents,
                distance_price_cents,
                surcharge_cents,
                discount_cents,
                currency,
                calculated_at,
                details,
                shopping_cost_cents,
                shopping_discount_cents
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

        Ok(record)
    }

    pub async fn get_pricing_by_delivery(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<Option<DeliveryPricing>> {
        let pricing = sqlx::query_as!(
            DeliveryPricing,
            r#"
            SELECT
                id,
                delivery_id,
                base_price_cents,
                distance_price_cents,
                surcharge_cents,
                discount_cents,
                currency,
                calculated_at,
                details,
                shopping_cost_cents,
                shopping_discount_cents
            FROM delivery_pricing
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(pricing)
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
                ST_Y(pickup_location::geometry) AS "pickup_lat!",
                ST_X(pickup_location::geometry) AS "pickup_lng!",
                ST_Y(dropoff_location::geometry) AS "dropoff_lat!",
                ST_X(dropoff_location::geometry) AS "dropoff_lng!",
                dropoff_address,
                distance_meters,
                estimated_duration_seconds,
                actual_duration_seconds,
                requested_at,
                delivered_at,
                tracking_token,
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_tracking_token,
                recipient_dropoff_override,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                store_name,
                ST_Y(store_location::geometry) AS "store_lat?",
                ST_X(store_location::geometry) AS "store_lng?",
                shopping_required,
                metadata
            FROM deliveries
            WHERE id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let extras = row
                .metadata
                .as_ref()
                .and_then(|meta| meta.get("recipient_extras"))
                .cloned()
                .unwrap_or_else(|| Value::Object(Default::default()));

            let recipient = Some(DeliveryRecipient {
                user_id: row.recipient_user_id,
                contact_name: row.recipient_contact_name,
                contact_phone: row.recipient_contact_phone,
                notes: row.recipient_notes,
                tracking_token: row.recipient_tracking_token.unwrap_or(row.tracking_token),
                dropoff_override: row.recipient_dropoff_override.map(|geo| GeoPoint {
                    latitude: geo.y(),
                    longitude: geo.x(),
                }),
                dropoff_address: row.recipient_dropoff_address,
                dropoff_updated_at: row.recipient_dropoff_updated_at,
                chat_thread_id: row.recipient_chat_thread_id,
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
                pickup: GeoPoint {
                    latitude: row.pickup_lat,
                    longitude: row.pickup_lng,
                },
                dropoff: GeoPoint {
                    latitude: row.dropoff_lat,
                    longitude: row.dropoff_lng,
                },
                dropoff_address: row.dropoff_address,
                distance_meters: row.distance_meters,
                estimated_duration_seconds: row.estimated_duration_seconds,
                actual_duration_seconds: row.actual_duration_seconds,
                requested_at: row.requested_at,
                delivered_at: row.delivered_at,
                tracking_token: row.tracking_token,
                recipient,
                store_name: row.store_name,
                store_location: match (row.store_lat, row.store_lng) {
                    (Some(lat), Some(lng)) => Some(GeoPoint {
                        latitude: lat,
                        longitude: lng,
                    }),
                    _ => None,
                },
                shopping_required: row.shopping_required.unwrap_or(false),
                metadata: row
                    .metadata
                    .unwrap_or_else(|| Value::Object(Default::default())),
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
                actual_total_cents,
                currency,
                store_name,
                store_location,
                notes,
                requires_balance_top_up,
                payload,
                created_at,
                updated_at
            FROM shopping_orders
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(order.map(|row| ShoppingOrder {
            id: row.id,
            delivery_id: row.delivery_id,
            status: row.status,
            estimated_total_cents: row.estimated_total_cents,
            actual_total_cents: row.actual_total_cents,
            currency: row.currency,
            store_name: row.store_name,
            store_location: row.store_location.map(|loc| GeoPoint {
                latitude: loc.y(),
                longitude: loc.x(),
            }),
            notes: row.notes,
            requires_balance_top_up: row.requires_balance_top_up,
            payload: row.payload,
            created_at: row.created_at,
            updated_at: row.updated_at,
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
                actual_total_cents,
                currency,
                store_name,
                store_location,
                notes,
                requires_balance_top_up,
                payload,
                created_at,
                updated_at
            FROM shopping_orders
            WHERE id = $1
            "#,
            order_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(order.map(|row| ShoppingOrder {
            id: row.id,
            delivery_id: row.delivery_id,
            status: row.status,
            estimated_total_cents: row.estimated_total_cents,
            actual_total_cents: row.actual_total_cents,
            currency: row.currency,
            store_name: row.store_name,
            store_location: row.store_location.map(|loc| GeoPoint {
                latitude: loc.y(),
                longitude: loc.x(),
            }),
            notes: row.notes,
            requires_balance_top_up: row.requires_balance_top_up,
            payload: row.payload,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    pub async fn list_shopping_items(
        &self,
        shopping_order_id: Uuid,
    ) -> AppResult<Vec<ShoppingOrderItem>> {
        let rows = sqlx::query_as!(
            ShoppingOrderItem,
            r#"
            SELECT
                id,
                shopping_order_id,
                product_id,
                product_name,
                characteristics,
                quantity,
                unit,
                estimated_price_cents,
                actual_price_cents,
                status AS "status: ShoppingItemStatus",
                metadata,
                created_at,
                updated_at
            FROM shopping_order_items
            WHERE shopping_order_id = $1
            ORDER BY created_at
            "#,
            shopping_order_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn insert_shopping_order(
        &self,
        payload: NewShoppingOrder<'_>,
    ) -> AppResult<(ShoppingOrder, Vec<ShoppingOrderItem>)> {
        let mut tx = self.pool.begin().await?;

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
                CASE WHEN $6 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography END,
                $8, $9, $10
            )
            RETURNING
                id,
                delivery_id,
                status AS "status: ShoppingStatus",
                estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                store_location,
                notes,
                requires_balance_top_up,
                payload,
                created_at,
                updated_at
            "#,
            payload.delivery_id,
            payload.status as ShoppingStatus,
            payload.estimated_total_cents,
            payload.currency,
            payload.store_name,
            payload.store_location.as_ref().map(|p| p.latitude),
            payload.store_location.as_ref().map(|p| p.longitude),
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
                    product_id,
                    product_name,
                    characteristics,
                    quantity,
                    unit,
                    estimated_price_cents,
                    actual_price_cents,
                    status AS "status: ShoppingItemStatus",
                    metadata,
                    created_at,
                    updated_at
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

            items_out.push(ShoppingOrderItem {
                id: inserted.id,
                shopping_order_id: inserted.shopping_order_id,
                product_id: inserted.product_id,
                product_name: inserted.product_name,
                characteristics: inserted.characteristics,
                quantity: inserted.quantity,
                unit: inserted.unit,
                estimated_price_cents: inserted.estimated_price_cents,
                actual_price_cents: inserted.actual_price_cents,
                status: inserted.status,
                metadata: inserted.metadata,
                created_at: inserted.created_at,
                updated_at: inserted.updated_at,
            });
        }

        tx.commit().await?;

        let order_model = ShoppingOrder {
            id: order.id,
            delivery_id: order.delivery_id,
            status: order.status,
            estimated_total_cents: order.estimated_total_cents,
            actual_total_cents: order.actual_total_cents,
            currency: order.currency,
            store_name: order.store_name,
            store_location: order.store_location.map(|loc| GeoPoint {
                latitude: loc.y(),
                longitude: loc.x(),
            }),
            notes: order.notes,
            requires_balance_top_up: order.requires_balance_top_up,
            payload: order.payload,
            created_at: order.created_at,
            updated_at: order.updated_at,
        };

        Ok((order_model, items_out))
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
        metadata: Option<Value>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE shopping_order_items
            SET status = $2,
                actual_price_cents = COALESCE($3, actual_price_cents),
                metadata = COALESCE($4, metadata),
                updated_at = NOW()
            WHERE id = $1
            "#,
            item_id,
            status as ShoppingItemStatus,
            actual_price_cents,
            metadata
        )
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
        sqlx::query!(
            r#"
            UPDATE deliveries
            SET shopping_required = TRUE,
                store_name = $2,
                store_location = CASE
                    WHEN $3 IS NULL THEN store_location
                    ELSE ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
                END
            WHERE id = $1
            "#,
            delivery_id,
            store_name,
            store.as_ref().map(|p| p.latitude),
            store.as_ref().map(|p| p.longitude)
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
                captured_at,
                ST_Y(location::geometry) AS "lat!",
                ST_X(location::geometry) AS "lng!",
                speed_kmh,
                bearing,
                accuracy_meters
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

    /// Ajoute ou met à jour une note client -> coursier
    pub async fn upsert_courier_rating(
        &self,
        payload: NewCourierRating,
    ) -> AppResult<CourierRating> {
        let record = sqlx::query_as!(
            CourierRating,
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
                tags,
                comment,
                created_at
            "#,
            payload.delivery_id,
            payload.courier_id,
            payload.rater_id,
            payload.score_small,
            payload.tags,
            payload.comment
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    /// Ajoute ou met à jour une note coursier -> client
    pub async fn upsert_client_rating(&self, payload: NewClientRating) -> AppResult<ClientRating> {
        let record = sqlx::query_as!(
            ClientRating,
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
                tags,
                comment,
                created_at
            "#,
            payload.delivery_id,
            payload.client_id,
            payload.courier_id,
            payload.score_small,
            payload.tags,
            payload.comment
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
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
    pub engine_type: crate::models::delivery_model::DeliveryEngineType,
    pub is_primary: bool,
    pub max_weight_kg: Option<Decimal>,
    pub max_volume_cm3: Option<Decimal>,
    pub equipments: Value,
    pub available: bool,
    pub availability_schedule: Option<Value>,
    pub documents: Option<Value>,
}

/// Informations colis à insérer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryParcel {
    pub type_id: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub volume_cm3: Option<Decimal>,
    pub declared_value: Option<Decimal>,
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
    pub speed_kmh: Option<Decimal>,
    pub bearing: Option<Decimal>,
    pub accuracy_meters: Option<Decimal>,
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
    pub quantity: Decimal,
    pub unit: String,
    pub estimated_price_cents: i32,
    pub status: ShoppingItemStatus,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingEstimateItem {
    pub product_name: String,
    pub quantity: Decimal,
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
