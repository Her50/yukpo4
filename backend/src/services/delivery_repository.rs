use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        ClientRating, Courier, CourierApplication, CourierAsset, CourierMatchingCandidate,
        CourierRating, DeliveryApplicationStatus, DeliveryCancelReason, DeliveryCourierStatus,
        DeliveryEngineType, DeliveryMatchingEvent, DeliveryMatchingQueueItem,
        DeliveryMatchingStatus, DeliveryParcel, DeliveryPricing, DeliveryRecipient,
        DeliveryRecipientUpdate, DeliveryStatus, DeliveryStatusEvent, DeliverySummary,
        DeliveryTrackingPoint, GeoPoint, ParcelRejectionReason, ParcelType, ShoppingItemStatus,
        ShoppingOrder, ShoppingOrderItem, ShoppingStatus, UserSavedAddress, UserSavedAddressInput,
    },
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::types::BigDecimal;
use sqlx::{postgres::PgQueryResult, FromRow, PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

// Structs pour les requêtes migrées
#[derive(FromRow)]
struct UserPreviewRow {
    id: i32,
    nom: Option<String>,
    prenom: Option<String>,
    nom_complet: Option<String>,
    avatar_url: Option<String>,
}

#[derive(FromRow)]
struct DeliveryIdRow {
    id: Uuid,
}

#[derive(FromRow)]
struct DeliveryStatusEventRow {
    id: i64,
    delivery_id: Uuid,
    #[sqlx(rename = "status")]
    status: DeliveryStatus,
    occurred_at: DateTime<Utc>,
    #[sqlx(rename = "payload")]
    payload: Value,
    recorded_by: Option<i32>,
}

#[derive(FromRow)]
struct DeliveryRecipientUpdateRow {
    id: i64,
    delivery_id: Uuid,
    submitted_by: Option<i32>,
    latitude: f64,
    longitude: f64,
    address: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct ParcelTypeRow {
    id: i32,
    slug: String,
    display_name: String,
    description: Option<String>,
    max_weight_kg: Option<BigDecimal>,
    max_volume_cm3: Option<BigDecimal>,
    requires_isothermal: bool,
    requires_fragile_handling: bool,
    requires_secure_box: bool,
    requires_document_protection: bool,
    metadata: Value,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CourierApplicationRow {
    id: Uuid,
    user_id: i32,
    #[sqlx(rename = "status")]
    status: DeliveryApplicationStatus,
    submitted_at: Option<DateTime<Utc>>,
    reviewed_at: Option<DateTime<Utc>>,
    reviewer_id: Option<i32>,
    rejection_reason: Option<String>,
    profile_data: Value,
    documents: Value,
    notes: Value,
    partner_id: Option<i32>, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CourierRow {
    id: Uuid,
    user_id: i32,
    application_id: Option<Uuid>,
    #[sqlx(rename = "status")]
    status: DeliveryCourierStatus,
    rating_average: Option<BigDecimal>,
    rating_count: Option<i32>,
    bio: Option<String>,
    hired_at: Option<DateTime<Utc>>,
    suspended_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CourierAssetRow {
    id: Uuid,
    courier_id: Uuid,
    #[sqlx(rename = "engine_type")]
    engine_type: DeliveryEngineType,
    is_primary: bool,
    max_weight_kg: Option<BigDecimal>,
    max_volume_cm3: Option<BigDecimal>,
    equipments: Value,
    available: bool,
    availability_schedule: Option<Value>,
    documents: Value,
    vehicle_image_url: Option<String>, // ✅ NOUVEAU 2026-01-04: URL de l'image du moyen de transport
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct DeliveryParcelRow {
    id: Uuid,
    type_id: Option<i32>,
    weight_kg: Option<BigDecimal>,
    volume_cm3: Option<BigDecimal>,
    declared_value: Option<BigDecimal>,
    notes: Option<String>,
    photos: Value,
    constraints: Value,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct DeliveryInsertRow {
    id: Uuid,
    #[sqlx(rename = "status")]
    status: DeliveryStatus,
    creator_id: i32,
    courier_id: Option<Uuid>,
    #[sqlx(rename = "pickup_lat")]
    pickup_lat: f64,
    #[sqlx(rename = "pickup_lng")]
    pickup_lng: f64,
    #[sqlx(rename = "dropoff_lat")]
    dropoff_lat: f64,
    #[sqlx(rename = "dropoff_lng")]
    dropoff_lng: f64,
    dropoff_address: Option<String>,
    #[sqlx(rename = "tracking_token")]
    tracking_token: Uuid,
    recipient_user_id: Option<i32>,
    recipient_contact_name: Option<String>,
    recipient_contact_phone: Option<String>,
    recipient_notes: Option<String>,
    recipient_tracking_token: Option<Uuid>,
    recipient_dropoff_lat: Option<f64>,
    recipient_dropoff_lng: Option<f64>,
    recipient_dropoff_address: Option<String>,
    recipient_dropoff_updated_at: Option<DateTime<Utc>>,
    recipient_chat_thread_id: Option<Uuid>,
    distance_meters: Option<i32>,
    estimated_duration_seconds: Option<i32>,
    actual_duration_seconds: Option<i32>,
    #[sqlx(rename = "requested_at")]
    requested_at: DateTime<Utc>,
    delivered_at: Option<DateTime<Utc>>,
    #[sqlx(rename = "shopping_required")]
    shopping_required: bool,
    store_location_lat: Option<f64>,
    store_location_lng: Option<f64>,
    store_name: Option<String>,
    metadata: Value,
}

#[derive(FromRow)]
struct DeliveryRecipientUpdateReturnRow {
    recipient_user_id: Option<i32>,
    recipient_contact_name: Option<String>,
    recipient_contact_phone: Option<String>,
    recipient_notes: Option<String>,
    recipient_tracking_token: Option<Uuid>,
    recipient_dropoff_lat: Option<f64>,
    recipient_dropoff_lng: Option<f64>,
    recipient_dropoff_address: Option<String>,
    recipient_dropoff_updated_at: Option<DateTime<Utc>>,
    recipient_chat_thread_id: Option<Uuid>,
    metadata: Value,
}

#[derive(FromRow)]
struct DeliveryPricingRow {
    id: Uuid,
    delivery_id: Uuid,
    base_price_cents: i32,
    distance_price_cents: i32,
    surcharge_cents: i32,
    discount_cents: i32,
    currency: String,
    calculated_at: Option<DateTime<Utc>>,
    details: Value,
    shopping_cost_cents: i32,
    shopping_discount_cents: i32,
}

#[derive(FromRow)]
struct DeliverySummaryRow {
    id: Uuid,
    #[sqlx(rename = "status")]
    status: DeliveryStatus,
    creator_id: i32,
    courier_id: Option<Uuid>,
    pickup_lat: f64,
    pickup_lng: f64,
    dropoff_lat: f64,
    dropoff_lng: f64,
    dropoff_address: Option<String>,
    distance_meters: Option<i32>,
    estimated_duration_seconds: Option<i32>,
    actual_duration_seconds: Option<i32>,
    requested_at: DateTime<Utc>,
    delivered_at: Option<DateTime<Utc>>,
    tracking_token: Uuid,
    recipient_user_id: Option<i32>,
    recipient_contact_name: Option<String>,
    recipient_contact_phone: Option<String>,
    recipient_notes: Option<String>,
    recipient_tracking_token: Option<Uuid>,
    recipient_dropoff_lat: Option<f64>,
    recipient_dropoff_lng: Option<f64>,
    recipient_dropoff_address: Option<String>,
    recipient_dropoff_updated_at: Option<DateTime<Utc>>,
    recipient_chat_thread_id: Option<Uuid>,
    store_name: Option<String>,
    store_lat: Option<f64>,
    store_lng: Option<f64>,
    shopping_required: bool,
    metadata: Value,
    // ✅ Aller-retour
    is_round_trip: Option<bool>,
    return_delivery_id: Option<Uuid>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_pickup_lat: Option<f64>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_pickup_lng: Option<f64>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_dropoff_lat: Option<f64>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_dropoff_lng: Option<f64>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_pickup_address: Option<String>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_dropoff_address: Option<String>,
    #[allow(dead_code)] // Réservé pour usage futur (données retour)
    return_distance_meters: Option<i32>,
    round_trip_discount_percent: Option<i32>,
}

#[derive(FromRow)]
struct ShoppingOrderRow {
    id: Uuid,
    delivery_id: Uuid,
    #[sqlx(rename = "status")]
    status: ShoppingStatus,
    estimated_total_cents: i32,
    actual_total_cents: Option<i32>,
    currency: String,
    store_name: Option<String>,
    store_lat: Option<f64>,
    store_lng: Option<f64>,
    notes: Option<String>,
    requires_balance_top_up: bool,
    payload: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct ShoppingOrderItemRow {
    id: Uuid,
    shopping_order_id: Uuid,
    product_id: Option<Uuid>,
    product_name: String,
    characteristics: Value,
    quantity: BigDecimal,
    unit: String,
    estimated_price_cents: i32,
    actual_price_cents: Option<i32>,
    #[sqlx(rename = "status")]
    status: ShoppingItemStatus,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct DeliveryTrackingPointRow {
    id: i64,
    delivery_id: Uuid,
    courier_id: Uuid,
    captured_at: DateTime<Utc>,
    lat: f64,
    lng: f64,
    speed_kmh: Option<BigDecimal>,
    bearing: Option<BigDecimal>,
    accuracy_meters: Option<BigDecimal>,
}

#[derive(FromRow)]
struct DeliveryMatchingQueueItemRow {
    id: i64,
    delivery_id: Uuid,
    zone_id: Option<Uuid>,
    #[sqlx(rename = "status")]
    status: DeliveryMatchingStatus,
    priority: i16,
    attempt_count: i32,
    payload: Value,
    next_attempt_at: DateTime<Utc>,
    enqueued_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct DeliveryMatchingEventRow {
    id: i64,
    delivery_id: Uuid,
    courier_id: Option<Uuid>,
    #[sqlx(rename = "status")]
    status: DeliveryMatchingStatus,
    score: Option<BigDecimal>,
    reason: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CourierRatingRow {
    id: i64,
    delivery_id: Uuid,
    courier_id: Uuid,
    rater_id: i32,
    score_small: i32,
    tags: Option<Vec<Option<String>>>,
    comment: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct ClientRatingRow {
    id: i64,
    delivery_id: Uuid,
    client_id: i32,
    courier_id: Uuid,
    score_small: i32,
    tags: Option<Vec<Option<String>>>,
    comment: Option<String>,
    created_at: DateTime<Utc>,
}

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
        let record: Option<UserPreviewRow> = sqlx::query_as(
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
        )
        .bind(user_id)
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
        let rows: Vec<DeliveryIdRow> = sqlx::query_as(
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
        )
        .bind(user_id)
        .bind(limit)
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
        let rows: Vec<DeliveryStatusEventRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                delivery_id,
                status,
                occurred_at,
                COALESCE(payload, '{}'::jsonb) AS payload,
                recorded_by
            FROM delivery_status_events
            WHERE delivery_id = $1
            ORDER BY occurred_at ASC
            LIMIT $2
            "#,
        )
        .bind(delivery_id)
        .bind(limit)
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
        let rows: Vec<DeliveryRecipientUpdateRow> = sqlx::query_as(
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
        )
        .bind(delivery_id)
        .bind(limit)
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

    /// Trouve un type de colis par slug
    pub async fn find_parcel_type_by_slug(&self, slug: &str) -> AppResult<Option<i32>> {
        let type_id: Option<i32> = sqlx::query_scalar(
            "SELECT id FROM parcel_types WHERE slug = $1"
        )
        .bind(slug)
        .fetch_optional(&self.pool)
        .await?;

        Ok(type_id)
    }

    /// Trouve un type de colis par défaut (motorcycle - moto)
    pub async fn find_default_parcel_type_id(&self) -> AppResult<i32> {
        // Essayer d'abord "motorcycle" qui est le type par défaut
        if let Some(motorcycle_id) = self.find_parcel_type_by_slug("motorcycle").await? {
            return Ok(motorcycle_id);
        }

        // Sinon, prendre le premier type disponible
        let type_id: Option<i32> = sqlx::query_scalar(
            "SELECT id FROM parcel_types ORDER BY id LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        type_id.ok_or_else(|| {
            crate::core::types::AppError::BadRequest(
                "Aucun type de colis disponible. Veuillez exécuter les migrations.".to_string(),
            )
        })
    }

    /// Vérifie si un type de colis existe
    pub async fn validate_parcel_type_exists(&self, type_id: i32) -> AppResult<()> {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM parcel_types WHERE id = $1)"
        )
        .bind(type_id)
        .fetch_one(&self.pool)
        .await?;

        if !exists {
            // Récupérer la liste des types disponibles pour un message d'erreur plus utile
            #[derive(sqlx::FromRow)]
            struct ParcelTypeInfo {
                id: i32,
                display_name: String,
            }

            let available_types: Vec<ParcelTypeInfo> = sqlx::query_as(
                "SELECT id, display_name FROM parcel_types ORDER BY id"
            )
            .fetch_all(&self.pool)
            .await
            .unwrap_or_default();

            let types_list = if available_types.is_empty() {
                "Aucun type de colis disponible. Veuillez exécuter les migrations.".to_string()
            } else {
                format!(
                    "Types disponibles: {}",
                    available_types
                        .iter()
                        .map(|t| format!("ID {} ({})", t.id, t.display_name))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            };

            return Err(crate::core::types::AppError::BadRequest(
                format!(
                    "Le type de colis avec l'ID {} n'existe pas. {}",
                    type_id, types_list
                )
            ));
        }

        Ok(())
    }

    /// Retourne la liste des typologies de colis
    pub async fn list_parcel_types(&self) -> AppResult<Vec<ParcelType>> {
        let rows: Vec<ParcelTypeRow> = sqlx::query_as(
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
                COALESCE(metadata, '{}'::jsonb) AS metadata,
                created_at
            FROM parcel_types
            ORDER BY display_name ASC
            "#,
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
        let row: CourierApplicationRow = sqlx::query_as(
            r#"
            INSERT INTO courier_applications (
                user_id,
                status,
                submitted_at,
                profile_data,
                documents,
                notes,
                partner_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                user_id,
                status,
                submitted_at,
                reviewed_at,
                reviewer_id,
                rejection_reason,
                profile_data,
                documents,
                notes,
                partner_id,
                created_at,
                updated_at
            "#,
        )
        .bind(payload.user_id)
        .bind(payload.status as DeliveryApplicationStatus)
        .bind(payload.submitted_at)
        .bind(payload.profile_data)
        .bind(payload.documents)
        .bind(payload.notes.unwrap_or_else(|| Value::Array(Vec::new())))
        .bind(payload.partner_id)
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
            partner_id: row.partner_id, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
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
        let row: CourierApplicationRow = sqlx::query_as(
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
                status,
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
        )
        .bind(application_id)
        .bind(status as DeliveryApplicationStatus)
        .bind(reviewer_id)
        .bind(rejection_reason)
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
            partner_id: row.partner_id, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Retourne la candidature active d'un utilisateur si elle existe
    pub async fn find_courier_application_by_user(
        &self,
        user_id: i32,
    ) -> AppResult<Option<CourierApplication>> {
        let row: Option<CourierApplicationRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                user_id,
                status,
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
        )
        .bind(user_id)
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
            partner_id: row.partner_id, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    /// ✅ NOUVEAU : Récupère une candidature par son ID
    pub async fn find_courier_application_by_id(
        &self,
        application_id: Uuid,
    ) -> AppResult<Option<CourierApplication>> {
        let row: Option<CourierApplicationRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                user_id,
                status,
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
            WHERE id = $1
            "#,
        )
        .bind(application_id)
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
            partner_id: row.partner_id, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    /// ✅ NOUVEAU : Liste toutes les candidatures de coursiers avec filtres optionnels
    pub async fn list_courier_applications(
        &self,
        status_filter: Option<DeliveryApplicationStatus>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> AppResult<Vec<CourierApplication>> {
        let limit_val = limit.unwrap_or(100);
        let offset_val = offset.unwrap_or(0);

        let rows: Vec<CourierApplicationRow> = if let Some(status) = status_filter {
            sqlx::query_as(
                r#"
                SELECT
                    id,
                    user_id,
                    status,
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
                WHERE status = $1
                ORDER BY created_at DESC
                LIMIT $2
                OFFSET $3
                "#,
            )
            .bind(status)
            .bind(limit_val)
            .bind(offset_val)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT
                    id,
                    user_id,
                    status,
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
                ORDER BY created_at DESC
                LIMIT $1
                OFFSET $2
                "#,
            )
            .bind(limit_val)
            .bind(offset_val)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(rows
            .into_iter()
            .map(|row| CourierApplication {
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
                partner_id: row.partner_id, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
            .collect())
    }

    /// Récupère le profil coursier associé à un utilisateur
    pub async fn find_courier_by_user(&self, user_id: i32) -> AppResult<Option<Courier>> {
        let row: Option<CourierRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                user_id,
                application_id,
                status,
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
        )
        .bind(user_id)
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
        let row: Option<CourierRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                user_id,
                application_id,
                status,
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
        )
        .bind(courier_id)
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
        let row: CourierRow = sqlx::query_as(
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
                status,
                rating_average,
                rating_count,
                bio,
                hired_at,
                suspended_at,
                created_at,
                updated_at
            "#,
        )
        .bind(payload.user_id)
        .bind(payload.application_id)
        .bind(DeliveryCourierStatus::Approved as DeliveryCourierStatus)
        .bind(payload.bio.as_ref())
        .fetch_one(&self.pool)
        .await?;

        Ok(Courier {
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
        })
    }

    /// Ajoute un engin au profil coursier
    pub async fn upsert_courier_asset(&self, payload: NewCourierAsset) -> AppResult<CourierAsset> {
        let row: CourierAssetRow = sqlx::query_as(
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
                documents,
                vehicle_image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (courier_id) WHERE is_primary = TRUE
            DO UPDATE SET
                engine_type = EXCLUDED.engine_type,
                max_weight_kg = EXCLUDED.max_weight_kg,
                max_volume_cm3 = EXCLUDED.max_volume_cm3,
                equipments = EXCLUDED.equipments,
                available = EXCLUDED.available,
                availability_schedule = EXCLUDED.availability_schedule,
                documents = EXCLUDED.documents,
                vehicle_image_url = EXCLUDED.vehicle_image_url,
                updated_at = NOW()
            RETURNING
                id,
                courier_id,
                engine_type,
                is_primary,
                max_weight_kg,
                max_volume_cm3,
                equipments,
                available,
                availability_schedule,
                documents,
                vehicle_image_url,
                created_at,
                updated_at
            "#,
        )
        .bind(payload.courier_id)
        .bind(payload.engine_type as DeliveryEngineType)
        .bind(payload.is_primary)
        .bind(payload.max_weight_kg)
        .bind(payload.max_volume_cm3)
        .bind(payload.equipments)
        .bind(payload.available)
        .bind(payload.availability_schedule)
        .bind(payload.documents)
        .bind(payload.vehicle_image_url)
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
            documents: Some(row.documents),
            vehicle_image_url: row.vehicle_image_url, // ✅ NOUVEAU 2026-01-04: URL de l'image du moyen de transport
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    /// Crée une nouvelle course (parcel + delivery + statut initial)
    pub async fn create_delivery_request(
        &self,
        payload: NewDeliveryRequest,
    ) -> AppResult<DeliverySummary> {
        let mut tx = self.pool.begin().await
            .map_err(|e| {
                log::error!("[DeliveryRepository] Erreur début transaction: {:?}", e);
                crate::core::types::AppError::Internal(
                    "Erreur de connexion à la base de données".into(),
                )
            })?;

        let parcel_row: DeliveryParcelRow = sqlx::query_as(
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
        )
        .bind(payload.parcel.type_id)
        .bind(payload.parcel.weight_kg)
        .bind(payload.parcel.volume_cm3)
        .bind(payload.parcel.declared_value)
        .bind(payload.parcel.notes.as_ref())
        .bind(payload.parcel.photos)
        .bind(payload.parcel.constraints)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[DeliveryRepository] Erreur insertion parcel: {:?}", e);
            // Vérifier si c'est une erreur de contrainte de clé étrangère
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.code().as_deref() == Some("23503") {
                    return crate::core::types::AppError::BadRequest(
                        "Le type de colis spécifié n'existe pas".into(),
                    );
                }
            }
            crate::core::types::AppError::Internal(
                "Erreur lors de la création du colis".into(),
            )
        })?;

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

        let delivery_row: DeliveryInsertRow = sqlx::query_as(
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
                status,
                creator_id,
                courier_id,
                ST_Y(pickup_location::geometry) AS pickup_lat,
                ST_X(pickup_location::geometry) AS pickup_lng,
                ST_Y(dropoff_location::geometry) AS dropoff_lat,
                ST_X(dropoff_location::geometry) AS dropoff_lng,
                dropoff_address,
                tracking_token,
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_tracking_token,
                ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
                ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                distance_meters,
                estimated_duration_seconds,
                actual_duration_seconds,
                requested_at,
                delivered_at,
                shopping_required,
                ST_Y(store_location::geometry) AS store_location_lat,
                ST_X(store_location::geometry) AS store_location_lng,
                store_name,
                metadata
            "#
        )
        .bind(payload.creator_id)
        .bind(payload.courier_id)
        .bind(parcel.id)
        .bind(payload.initial_status as DeliveryStatus)
        .bind(payload.pickup.longitude)
        .bind(payload.pickup.latitude)
        .bind(payload.dropoff.longitude)
        .bind(payload.dropoff.latitude)
        .bind(payload.pickup_address.as_ref())
        .bind(payload.dropoff_address.as_ref())
        .bind(recipient_user_id)
        .bind(recipient_contact_name.as_ref())
        .bind(recipient_contact_phone.as_ref())
        .bind(recipient_notes.as_ref())
        .bind(recipient_chat_thread_id)
        .bind(recipient_dropoff_lat)
        .bind(recipient_dropoff_lng)
        .bind(recipient_dropoff_address.as_ref())
        .bind(recipient_dropoff_updated_at)
        .bind(payload.distance_meters)
        .bind(payload.estimated_duration_seconds)
        .bind(payload.metadata)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[DeliveryRepository] Erreur insertion delivery: {:?}", e);
            // Vérifier si c'est une erreur liée aux coordonnées GPS
            if let sqlx::Error::Database(db_err) = &e {
                let err_msg = db_err.message().to_lowercase();
                if err_msg.contains("geometry") || err_msg.contains("point") || err_msg.contains("coordinate") {
                    return crate::core::types::AppError::BadRequest(
                        "Les coordonnées GPS fournies sont invalides".into(),
                    );
                }
                if db_err.code().as_deref() == Some("23503") {
                    return crate::core::types::AppError::BadRequest(
                        "Référence invalide (utilisateur ou coursier introuvable)".into(),
                    );
                }
            }
            crate::core::types::AppError::Internal(
                "Erreur lors de la création de la livraison".into(),
            )
        })?;

        sqlx::query(
            r#"
            INSERT INTO delivery_status_events (
                delivery_id,
                status,
                payload,
                recorded_by
            )
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(delivery_row.id)
        .bind(payload.initial_status as DeliveryStatus)
        .bind(payload.initial_event_payload)
        .bind(payload.initial_status_author)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[DeliveryRepository] Erreur insertion status event: {:?}", e);
            crate::core::types::AppError::Internal(
                "Erreur lors de l'enregistrement de l'événement de statut".into(),
            )
        })?;

        tx.commit().await
        .map_err(|e| {
            log::error!("[DeliveryRepository] Erreur commit transaction: {:?}", e);
            crate::core::types::AppError::Internal(
                "Erreur lors de la finalisation de la création de la livraison".into(),
            )
        })?;

        let summary = DeliverySummary {
            id: delivery_row.id,
            status: delivery_row.status,
            creator_id: delivery_row.creator_id,
            courier_id: delivery_row.courier_id,
            preferred_courier_id: None, // Note: preferred_courier_id n'existe pas dans deliveries
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
            // ✅ Aller-retour
            is_round_trip: None, // Pas de données aller-retour dans cette fonction
            return_delivery_id: None, // Pas de données aller-retour dans cette fonction
            return_delivery: None, // Pas de données aller-retour dans cette fonction
            round_trip_discount_percent: None, // Pas de données aller-retour dans cette fonction
        };

        Ok(summary)
    }

    /// Ajoute un evenement de statut
    pub async fn add_status_event(
        &self,
        payload: NewStatusEvent,
    ) -> AppResult<DeliveryStatusEvent> {
        let record: DeliveryStatusEventRow = sqlx::query_as(
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
                status,
                occurred_at,
                payload,
                recorded_by
            "#,
        )
        .bind(payload.delivery_id)
        .bind(payload.status as DeliveryStatus)
        .bind(
            payload
                .payload
                .unwrap_or_else(|| Value::Object(Default::default())),
        )
        .bind(payload.recorded_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(DeliveryStatusEvent {
            id: record.id,
            delivery_id: record.delivery_id,
            status: record.status,
            occurred_at: record.occurred_at,
            payload: record.payload,
            recorded_by: record.recorded_by,
        })
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

        let recipient: DeliveryRecipientUpdateReturnRow = sqlx::query_as(
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
                ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
                ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                metadata
            "#
        )
        .bind(delivery_id)
        .bind(payload.user_id)
        .bind(payload.contact_name.as_ref())
        .bind(payload.contact_phone.as_ref())
        .bind(payload.notes.as_ref())
        .bind(payload.chat_thread_id)
        .bind(override_lat)
        .bind(override_lng)
        .bind(payload.dropoff_address.as_ref())
        .bind(payload.country_code.as_ref())
        .bind(payload.allow_tracking)
        .bind(payload.allow_contact)
        .bind(payload.consent_granted)
        .bind(payload.preferred_language.as_ref())
        .fetch_one(&self.pool)
        .await?;

        let extras = recipient
            .metadata
            .get("recipient_extras")
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

        let recipient: DeliveryRecipientUpdateReturnRow = sqlx::query_as(
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
                ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
                ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                metadata
            "#,
        )
        .bind(delivery_id)
        .bind(point.longitude)
        .bind(point.latitude)
        .bind(address.as_ref())
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
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
        )
        .bind(delivery_id)
        .bind(submitted_by)
        .bind(point.latitude)
        .bind(point.longitude)
        .bind(address.as_ref())
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let extras = recipient
            .metadata
            .get("recipient_extras")
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
        sqlx::query(
            r#"
            UPDATE deliveries
            SET
                pickup_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                pickup_address = $4,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(delivery_id)
        .bind(point.longitude)
        .bind(point.latitude)
        .bind(address.as_ref())
        .execute(&self.pool)
        .await?;

        // Enregistrer l'historique de modification si nécessaire
        if let Some(user_id) = updated_by {
            sqlx::query(
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
            )
            .bind(delivery_id)
            .bind(user_id)
            .bind(point.latitude)
            .bind(point.longitude)
            .bind(address.as_ref())
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Affecte un tarif à une livraison
    pub async fn upsert_pricing(&self, payload: NewDeliveryPricing) -> AppResult<DeliveryPricing> {
        let row: DeliveryPricingRow = sqlx::query_as(
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
                 COALESCE(details, '{}'::jsonb) AS details,
                 shopping_cost_cents,
                 shopping_discount_cents
             "#,
        )
        .bind(payload.delivery_id)
        .bind(payload.base_price_cents)
        .bind(payload.distance_price_cents)
        .bind(payload.surcharge_cents)
        .bind(payload.discount_cents)
        .bind(&payload.currency)
        .bind(payload.details)
        .bind(payload.shopping_cost_cents)
        .bind(payload.shopping_discount_cents)
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
        let pricing: Option<DeliveryPricingRow> = sqlx::query_as(
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
                 COALESCE(details, '{}'::jsonb) AS details,
                 shopping_cost_cents,
                 shopping_discount_cents
             FROM delivery_pricing
             WHERE delivery_id = $1
             "#,
        )
        .bind(delivery_id)
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
        let row: Option<DeliverySummaryRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                status,
                creator_id,
                courier_id,
                ST_Y(pickup_location::geometry) AS pickup_lat,
                ST_X(pickup_location::geometry) AS pickup_lng,
                ST_Y(dropoff_location::geometry) AS dropoff_lat,
                ST_X(dropoff_location::geometry) AS dropoff_lng,
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
                ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
                ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                recipient_chat_thread_id,
                store_name,
                ST_Y(store_location::geometry) AS store_lat,
                ST_X(store_location::geometry) AS store_lng,
                COALESCE(shopping_required, FALSE) AS shopping_required,
                COALESCE(metadata, '{}'::jsonb) AS metadata,
                -- ✅ Aller-retour
                COALESCE(is_round_trip, FALSE) AS is_round_trip,
                return_delivery_id,
                CASE WHEN return_pickup_location IS NOT NULL THEN ST_Y(return_pickup_location::geometry) ELSE NULL END AS return_pickup_lat,
                CASE WHEN return_pickup_location IS NOT NULL THEN ST_X(return_pickup_location::geometry) ELSE NULL END AS return_pickup_lng,
                CASE WHEN return_dropoff_location IS NOT NULL THEN ST_Y(return_dropoff_location::geometry) ELSE NULL END AS return_dropoff_lat,
                CASE WHEN return_dropoff_location IS NOT NULL THEN ST_X(return_dropoff_location::geometry) ELSE NULL END AS return_dropoff_lng,
                return_pickup_address,
                return_dropoff_address,
                return_distance_meters,
                COALESCE(round_trip_discount_percent, 0) AS round_trip_discount_percent
            FROM deliveries
            WHERE id = $1
            "#,
        )
        .bind(delivery_id)
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

            // ✅ Récupérer la livraison retour si elle existe
            // Note: Utilisation de Box::pin pour éviter la récursion infinie dans async fn
            let return_delivery: Option<Box<DeliverySummary>> = if let Some(return_delivery_id) = row.return_delivery_id {
                // Utiliser Box::pin pour l'appel récursif
                let future = Box::pin(self.get_delivery_summary(return_delivery_id));
                if let Ok(Some(ret)) = future.await {
                    Some(Box::new(ret))
                } else {
                    None
                }
            } else {
                None
            };

            return Ok(Some(DeliverySummary {
                id: row.id,
                status: row.status,
                creator_id: row.creator_id,
                courier_id: row.courier_id,
                preferred_courier_id: None, // Note: preferred_courier_id n'existe pas dans deliveries
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
                // ✅ Aller-retour
                is_round_trip: Some(row.is_round_trip.unwrap_or(false)),
                return_delivery_id: row.return_delivery_id,
                return_delivery,
                round_trip_discount_percent: row.round_trip_discount_percent,
            }));
        }

        Ok(None)
    }

    pub async fn get_shopping_order(&self, delivery_id: Uuid) -> AppResult<Option<ShoppingOrder>> {
        let order: Option<ShoppingOrderRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                delivery_id,
                status,
                estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                ST_Y(store_location::geometry) AS store_lat,
                ST_X(store_location::geometry) AS store_lng,
                notes,
                COALESCE(requires_balance_top_up, FALSE) AS requires_balance_top_up,
                COALESCE(payload, '{}'::jsonb) AS payload,
                created_at,
                updated_at
            FROM shopping_orders
            WHERE delivery_id = $1
            "#,
        )
        .bind(delivery_id)
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
        let order: Option<ShoppingOrderRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                delivery_id,
                status,
                estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                ST_Y(store_location::geometry) AS store_lat,
                ST_X(store_location::geometry) AS store_lng,
                notes,
                COALESCE(requires_balance_top_up, FALSE) AS requires_balance_top_up,
                COALESCE(payload, '{}'::jsonb) AS payload,
                created_at,
                updated_at
            FROM shopping_orders
            WHERE id = $1
            "#,
        )
        .bind(order_id)
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
        let rows: Vec<ShoppingOrderItemRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                shopping_order_id,
                product_id,
                product_name,
                COALESCE(characteristics, '{}'::jsonb) AS characteristics,
                quantity,
                unit,
                estimated_price_cents,
                actual_price_cents,
                status,
                COALESCE(metadata, '{}'::jsonb) AS metadata,
                created_at,
                updated_at
            FROM shopping_order_items
            WHERE shopping_order_id = $1
            ORDER BY created_at
            "#,
        )
        .bind(shopping_order_id)
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
                rejection_reason: None, // Note: rejection_reason n'existe pas dans shopping_order_items
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

        let order: ShoppingOrderRow = sqlx::query_as(
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
                status,
                estimated_total_cents,
                actual_total_cents,
                currency,
                store_name,
                ST_Y(store_location::geometry) AS store_lat,
                ST_X(store_location::geometry) AS store_lng,
                notes,
                requires_balance_top_up,
                payload,
                created_at,
                updated_at
            "#
        )
        .bind(payload.delivery_id)
        .bind(payload.status as ShoppingStatus)
        .bind(payload.estimated_total_cents)
        .bind(&payload.currency)
        .bind(payload.store_name.as_ref())
        .bind(store_lat)
        .bind(store_lng)
        .bind(payload.notes.as_ref())
        .bind(payload.requires_balance_top_up)
        .bind(payload.payload)
        .fetch_one(&mut *tx)
        .await?;

        // ✅ NOUVEAU 2025-01-28: Vérifier le stock pour chaque produit (uniquement pour les produits)
        for item in payload.items {
            // Vérifier si le produit est tarissable (is_tarissable = TRUE)
            if let Some(service_id) = item.metadata.get("service_id").and_then(|v| v.as_i64()) {
                let is_tarissable: Option<bool> = sqlx::query_scalar(
                    r#"
                    SELECT is_tarissable
                    FROM services
                    WHERE id = $1
                    "#,
                )
                .bind(service_id as i32)
                .fetch_optional(&self.pool)
                .await?;

                if let Some(true) = is_tarissable {
                    // ✅ NOUVEAU 2025-01-28: Vérifier le stock depuis autocomplete_combinations
                    let available_stock: Option<i32> = sqlx::query_scalar(
                        r#"
                        SELECT MIN(stock)
                        FROM autocomplete_combinations
                        WHERE service_id = $1
                            AND stock IS NOT NULL
                        "#,
                    )
                    .bind(service_id as i32)
                    .fetch_optional(&self.pool)
                    .await?;

                    if let Some(stock) = available_stock {
                        let quantity = item.quantity.to_string().parse::<i64>().unwrap_or(1);
                        if stock < quantity as i32 {
                            return Err(AppError::BadRequest(format!(
                                "Stock insuffisant pour le produit '{}'. Stock disponible: {}, Quantité demandée: {}",
                                item.product_name, stock, quantity
                            )));
                        }
                    }
                }
            }
        }

        let mut items_out = Vec::new();
        for item in payload.items {
            let inserted: ShoppingOrderItemRow = sqlx::query_as(
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
                    status,
                    metadata,
                    created_at,
                    updated_at
                "#,
            )
            .bind(order.id)
            .bind(item.product_id)
            .bind(&item.product_name)
            .bind(item.characteristics.clone())
            .bind(item.quantity.clone())
            .bind(&item.unit)
            .bind(item.estimated_price_cents)
            .bind(item.status as ShoppingItemStatus)
            .bind(item.metadata.clone())
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
                rejection_reason: None, // Note: rejection_reason n'existe pas dans shopping_order_items
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
        sqlx::query(
            r#"
            UPDATE shopping_orders
            SET status = $2,
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
        )
        .bind(delivery_id)
        .bind(status as ShoppingStatus)
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
        sqlx::query(
            r#"
            UPDATE shopping_orders
            SET actual_total_cents = $2,
                status = 'checkout_submitted',
                payload = COALESCE($3, payload),
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
        )
        .bind(delivery_id)
        .bind(actual_total_cents)
        .bind(payload)
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

        sqlx::query(
            r#"
            UPDATE deliveries
            SET shopping_required = TRUE,
                store_name = $2,
                store_location = CASE
                    WHEN $3::double precision IS NULL OR $4::double precision IS NULL THEN store_location
                    ELSE ST_SetSRID(ST_MakePoint($4::double precision, $3::double precision), 4326)::geography
                END
            WHERE id = $1
            "#
        )
        .bind(delivery_id)
        .bind(store_name.as_ref())
        .bind(store_lat)
        .bind(store_lng)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_user_balance(&self, user_id: i32) -> AppResult<i64> {
        #[derive(FromRow)]
        struct UserBalanceRow {
            tokens_balance: i64,
        }

        let balance: Option<UserBalanceRow> =
            sqlx::query_as(r#"SELECT tokens_balance FROM users WHERE id = $1"#)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(balance.map(|r| r.tokens_balance).unwrap_or(0))
    }

    pub async fn update_user_balance(&self, user_id: i32, new_balance: i64) -> AppResult<()> {
        sqlx::query(r#"UPDATE users SET tokens_balance = $2 WHERE id = $1"#)
            .bind(user_id)
            .bind(new_balance)
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

        #[derive(FromRow)]
        struct UserBalanceLockRow {
            tokens_balance: i64,
        }

        let current_balance: Option<UserBalanceLockRow> = sqlx::query_as(
            r#"
            SELECT tokens_balance
            FROM users
            WHERE id = $1
            FOR UPDATE
            "#,
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        let current_balance = current_balance
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Utilisateur {} introuvable pour la mutation wallet",
                    user_id
                ))
            })?
            .tokens_balance;

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

        sqlx::query(r#"UPDATE users SET tokens_balance = $2 WHERE id = $1"#)
            .bind(user_id)
            .bind(new_balance)
            .execute(&mut *tx)
            .await?;

        let metadata_value = metadata.unwrap_or_else(|| Value::Object(Default::default()));

        sqlx::query(
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
        )
        .bind(user_id)
        .bind(delivery_id)
        .bind(direction.as_str())
        .bind(amount_cents)
        .bind(reason.as_ref())
        .bind(new_balance)
        .bind(metadata_value)
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
        let record: DeliveryTrackingPointRow = sqlx::query_as(
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
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                speed_kmh,
                bearing,
                accuracy_meters
            "#,
        )
        .bind(payload.delivery_id)
        .bind(payload.courier_id)
        .bind(payload.captured_at)
        .bind(payload.position.longitude)
        .bind(payload.position.latitude)
        .bind(payload.speed_kmh)
        .bind(payload.bearing)
        .bind(payload.accuracy_meters)
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
        let record: DeliveryMatchingQueueItemRow = sqlx::query_as(
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
                status,
                priority,
                attempt_count,
                payload,
                next_attempt_at,
                enqueued_at,
                updated_at
            "#,
        )
        .bind(payload.delivery_id)
        .bind(payload.zone_id)
        .bind(payload.priority)
        .bind(payload.payload)
        .bind(payload.next_attempt_at)
        .fetch_one(&self.pool)
        .await?;

        Ok(DeliveryMatchingQueueItem {
            id: record.id,
            delivery_id: record.delivery_id,
            zone_id: record.zone_id,
            status: record.status,
            priority: record.priority,
            attempt_count: record.attempt_count,
            payload: record.payload,
            next_attempt_at: record.next_attempt_at,
            enqueued_at: record.enqueued_at,
            updated_at: record.updated_at,
        })
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
        sqlx::query(
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
        )
        .bind(delivery_id)
        .bind(status as DeliveryMatchingStatus)
        .bind(next_attempt_at)
        .bind(payload)
        .bind(increment_attempt)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Insère un événement d'audit dans l'historique de matching
    pub async fn insert_matching_event(
        &self,
        payload: NewDeliveryMatchingEvent,
    ) -> AppResult<DeliveryMatchingEvent> {
        let record: DeliveryMatchingEventRow = sqlx::query_as(
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
                status,
                score,
                reason,
                metadata,
                created_at
            "#,
        )
        .bind(payload.delivery_id)
        .bind(payload.courier_id)
        .bind(payload.status as DeliveryMatchingStatus)
        .bind(payload.score)
        .bind(payload.reason.as_ref())
        .bind(payload.metadata)
        .fetch_one(&self.pool)
        .await?;

        Ok(DeliveryMatchingEvent {
            id: record.id,
            delivery_id: record.delivery_id,
            courier_id: record.courier_id,
            status: record.status,
            score: record.score,
            reason: record.reason,
            metadata: record.metadata,
            created_at: record.created_at,
        })
    }

    /// Liste les coursiers disponibles proches d'un point cible
    /// ✅ Phase 1: Utilise la fonction SQL optimisée find_nearby_couriers si disponible
    /// Sinon, utilise l'ancienne méthode avec QueryBuilder
    pub async fn list_matching_candidates(
        &self,
        pickup: GeoPoint,
        zone_id: Option<Uuid>,
        limit: i64,
        max_distance_meters: Option<f64>,
        passenger_mode: bool,
    ) -> AppResult<Vec<CourierMatchingCandidate>> {
        // ✅ Phase 1: Essayer d'utiliser la fonction SQL optimisée d'abord
        let use_optimized_function = std::env::var("DELIVERY_USE_OPTIMIZED_MATCHING")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true);

        // Cloner pickup pour pouvoir l'utiliser après le passage à find_nearby_couriers_optimized
        let pickup_clone = GeoPoint {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
        };

        if use_optimized_function {
            if let Ok(candidates) = self
                .find_nearby_couriers_optimized(pickup, zone_id, limit, max_distance_meters)
                .await
            {
                return Ok(candidates);
            }
            // Si la fonction optimisée échoue, fallback sur l'ancienne méthode
            log::debug!("[DeliveryRepository] Fonction optimisée non disponible, fallback sur méthode classique");
        }

        // Ancienne méthode (fallback)
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
        builder.push_bind(pickup_clone.longitude);
        builder.push(", ");
        builder.push_bind(pickup_clone.latitude);
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
            builder.push_bind(pickup_clone.longitude);
            builder.push(", ");
            builder.push_bind(pickup_clone.latitude);
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

    /// ✅ Phase 1: Fonction optimisée utilisant find_nearby_couriers SQL
    pub async fn find_nearby_couriers_optimized(
        &self,
        pickup: GeoPoint,
        zone_id: Option<Uuid>,
        limit: i64,
        max_distance_meters: Option<f64>,
    ) -> AppResult<Vec<CourierMatchingCandidate>> {
        let radius_meters = max_distance_meters.unwrap_or(5000.0) as i32;
        let max_results = limit.max(1).min(50) as i32; // Limiter à 50 max

        #[derive(FromRow)]
        struct NearbyCourierRow {
            courier_id: Uuid,
            user_id: i32,
            distance_meters: Option<f64>,
            load_factor: BigDecimal,
            active_deliveries: i16,
            max_capacity: i16,
            engine_type: Option<DeliveryEngineType>,
            is_primary: Option<bool>,
        }

        let rows: Vec<NearbyCourierRow> = sqlx::query_as(
            r#"
            SELECT 
                courier_id,
                user_id,
                distance_meters,
                load_factor,
                active_deliveries,
                max_capacity,
                engine_type,
                is_primary
            FROM find_nearby_couriers($1, $2, $3, $4, $5)
            "#,
        )
        .bind(pickup.latitude as f32)
        .bind(pickup.longitude as f32)
        .bind(radius_meters)
        .bind(max_results)
        .bind(zone_id)
        .fetch_all(&self.pool)
        .await?;

        // Convertir en CourierMatchingCandidate
        let candidates: Vec<CourierMatchingCandidate> = rows
            .into_iter()
            .map(|row| {
                // Récupérer les données depuis courier_availability_snapshots pour les champs manquants
                CourierMatchingCandidate {
                    courier_id: row.courier_id,
                    zone_id,
                    active_deliveries: row.active_deliveries,
                    max_capacity: row.max_capacity,
                    load_factor: row.load_factor,
                    latitude: None, // Sera rempli si nécessaire
                    longitude: None,
                    captured_at: Utc::now(), // Approximation
                    capacity_weight: row.is_primary.map(|p| if p { 10 } else { 5 }).unwrap_or(5),
                    is_primary: row.is_primary.unwrap_or(false),
                    distance_meters: row.distance_meters,
                    metadata: serde_json::json!({
                        "engine_type": row.engine_type.map(|e| format!("{:?}", e)),
                        "user_id": row.user_id,
                    }),
                }
            })
            .collect();

        Ok(candidates)
    }

    /// Associe définitivement un coursier à la livraison
    pub async fn assign_delivery_courier(
        &self,
        delivery_id: Uuid,
        courier_id: Uuid,
    ) -> AppResult<()> {
        sqlx::query("UPDATE deliveries SET courier_id = $2, updated_at = NOW() WHERE id = $1")
            .bind(delivery_id)
            .bind(courier_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn ensure_recipient_tracking_token(&self, delivery_id: Uuid) -> AppResult<Uuid> {
        #[derive(FromRow)]
        struct RecipientTrackingTokenRow {
            recipient_tracking_token: Option<Uuid>,
        }

        let row: RecipientTrackingTokenRow = sqlx::query_as(
            r#"
            UPDATE deliveries
            SET recipient_tracking_token = COALESCE(recipient_tracking_token, gen_random_uuid()),
                updated_at = NOW()
            WHERE id = $1
            RETURNING recipient_tracking_token
            "#,
        )
        .bind(delivery_id)
        .fetch_one(&self.pool)
        .await?;

        row.recipient_tracking_token
            .ok_or_else(|| AppError::Internal("recipient_tracking_token missing".into()))
    }

    pub async fn merge_delivery_metadata(&self, delivery_id: Uuid, patch: &Value) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE deliveries
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $2,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(delivery_id)
        .bind(patch)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn find_delivery_id_by_recipient_token(
        &self,
        token: Uuid,
    ) -> AppResult<Option<Uuid>> {
        #[derive(FromRow)]
        struct DeliveryIdRow {
            id: Uuid,
        }

        let row: Option<DeliveryIdRow> = sqlx::query_as(
            r#"
            SELECT id
            FROM deliveries
            WHERE recipient_tracking_token = $1
               OR tracking_token = $1
            LIMIT 1
            "#,
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|record| record.id))
    }

    /// Récupère un lot d'éléments de file dont l'heure de retry est échue
    pub async fn fetch_matching_queue_batch(
        &self,
        limit: i64,
    ) -> AppResult<Vec<DeliveryMatchingQueueItem>> {
        // ✅ CORRIGÉ 2025-12-11: Utiliser retry_query pour gérer les erreurs de connexion TLS
        let pool = self.pool.clone();
        let rows: Vec<DeliveryMatchingQueueItemRow> = crate::utils::db_retry::retry_query(
            &pool,
            || {
                let pool = pool.clone();
                let limit = limit.max(1);
                Box::pin(async move {
                    sqlx::query_as(
                        r#"
                        SELECT
                            id,
                            delivery_id,
                            zone_id,
                            status,
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
                    )
                    .bind(limit)
                    .fetch_all(&pool)
                    .await
                })
            },
            3, // 3 tentatives avec backoff exponentiel
        )
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| DeliveryMatchingQueueItem {
                id: row.id,
                delivery_id: row.delivery_id,
                zone_id: row.zone_id,
                status: row.status,
                priority: row.priority,
                attempt_count: row.attempt_count,
                payload: row.payload,
                next_attempt_at: row.next_attempt_at,
                enqueued_at: row.enqueued_at,
                updated_at: row.updated_at,
            })
            .collect())
    }

    /// Ajoute ou met à jour une note client -> coursier
    pub async fn upsert_courier_rating(
        &self,
        payload: NewCourierRating,
    ) -> AppResult<CourierRating> {
        let row: CourierRatingRow = sqlx::query_as(
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
        )
        .bind(payload.delivery_id)
        .bind(payload.courier_id)
        .bind(payload.rater_id)
        .bind(payload.score_small)
        .bind(payload.tags.as_deref())
        .bind(payload.comment.as_ref())
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
        let row: ClientRatingRow = sqlx::query_as(
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
        )
        .bind(payload.delivery_id)
        .bind(payload.client_id)
        .bind(payload.courier_id)
        .bind(payload.score_small)
        .bind(payload.tags.as_deref())
        .bind(payload.comment.as_ref())
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
    pub partner_id: Option<i32>, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
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
    pub vehicle_image_url: Option<String>, // ✅ NOUVEAU 2026-01-04: URL de l'image du moyen de transport
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

// ✅ NOUVEAU : Fonctions pour gérer les adresses sauvegardées
impl DeliveryRepository {
    /// Lister les adresses sauvegardées d'un utilisateur
    pub async fn list_saved_addresses(
        &self,
        user_id: i32,
        address_type: Option<&str>, // 'pickup', 'dropoff', 'both', ou None pour tous
    ) -> AppResult<Vec<UserSavedAddress>> {
        let addresses = if let Some(addr_type) = address_type {
            sqlx::query_as::<_, UserSavedAddress>(
                r#"
                SELECT id, user_id, label, address_type, address, latitude, longitude,
                       location_data, contact_name, contact_phone, instructions,
                       building_number, floor, apartment, is_default_pickup,
                       is_default_dropoff, usage_count, last_used_at, is_active,
                       created_at, updated_at
                FROM user_saved_addresses
                WHERE user_id = $1 
                  AND is_active = TRUE
                  AND (address_type = $2 OR address_type = 'both')
                ORDER BY 
                    CASE WHEN address_type = $2 AND (is_default_pickup = TRUE OR is_default_dropoff = TRUE) THEN 0 ELSE 1 END,
                    last_used_at DESC NULLS LAST,
                    label ASC
                "#,
            )
            .bind(user_id)
            .bind(addr_type)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, UserSavedAddress>(
                r#"
                SELECT id, user_id, label, address_type, address, latitude, longitude,
                       location_data, contact_name, contact_phone, instructions,
                       building_number, floor, apartment, is_default_pickup,
                       is_default_dropoff, usage_count, last_used_at, is_active,
                       created_at, updated_at
                FROM user_saved_addresses
                WHERE user_id = $1 
                  AND is_active = TRUE
                ORDER BY 
                    CASE WHEN is_default_pickup = TRUE OR is_default_dropoff = TRUE THEN 0 ELSE 1 END,
                    last_used_at DESC NULLS LAST,
                    label ASC
                "#,
            )
            .bind(user_id)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(addresses)
    }

    /// Créer une nouvelle adresse sauvegardée
    pub async fn create_saved_address(
        &self,
        user_id: i32,
        input: UserSavedAddressInput,
    ) -> AppResult<UserSavedAddress> {
        // Si on définit cette adresse comme défaut, désactiver les autres adresses par défaut du même type
        if input.is_default_pickup.unwrap_or(false) || input.is_default_dropoff.unwrap_or(false) {
            if input.is_default_pickup.unwrap_or(false) {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_pickup = FALSE WHERE user_id = $1 AND is_default_pickup = TRUE"
                )
                .bind(user_id)
                .execute(&self.pool)
                .await?;
            }
            if input.is_default_dropoff.unwrap_or(false) {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_dropoff = FALSE WHERE user_id = $1 AND is_default_dropoff = TRUE"
                )
                .bind(user_id)
                .execute(&self.pool)
                .await?;
            }
        }

        let address = sqlx::query_as::<_, UserSavedAddress>(
            r#"
            INSERT INTO user_saved_addresses 
            (user_id, label, address_type, address, latitude, longitude, location_data,
             contact_name, contact_phone, instructions, building_number, floor, apartment,
             is_default_pickup, is_default_dropoff, usage_count, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, TRUE, NOW(), NOW())
            RETURNING id, user_id, label, address_type, address, latitude, longitude,
                      location_data, contact_name, contact_phone, instructions,
                      building_number, floor, apartment, is_default_pickup,
                      is_default_dropoff, usage_count, last_used_at, is_active,
                      created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(&input.label)
        .bind(&input.address_type)
        .bind(&input.address)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.location_data.as_ref().unwrap_or(&Value::Null))
        .bind(input.contact_name.as_ref())
        .bind(input.contact_phone.as_ref())
        .bind(input.instructions.as_ref())
        .bind(input.building_number.as_ref())
        .bind(input.floor.as_ref())
        .bind(input.apartment.as_ref())
        .bind(input.is_default_pickup.unwrap_or(false))
        .bind(input.is_default_dropoff.unwrap_or(false))
        .fetch_one(&self.pool)
        .await?;

        Ok(address)
    }

    /// Mettre à jour une adresse sauvegardée
    pub async fn update_saved_address(
        &self,
        user_id: i32,
        address_id: i32,
        input: UserSavedAddressInput,
    ) -> AppResult<UserSavedAddress> {
        // Vérifier que l'adresse appartient à l'utilisateur
        let existing = sqlx::query_as::<_, UserSavedAddress>(
            "SELECT id, user_id, label, address_type, address, latitude, longitude, location_data, contact_name, contact_phone, instructions, building_number, floor, apartment, is_default_pickup, is_default_dropoff, usage_count, last_used_at, is_active, created_at, updated_at FROM user_saved_addresses WHERE id = $1 AND user_id = $2"
        )
        .bind(address_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_none() {
            return Err(AppError::NotFound("Adresse non trouvée".to_string()));
        }

        // Si on définit cette adresse comme défaut, désactiver les autres adresses par défaut du même type
        if input.is_default_pickup.unwrap_or(false) || input.is_default_dropoff.unwrap_or(false) {
            if input.is_default_pickup.unwrap_or(false) {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_pickup = FALSE WHERE user_id = $1 AND id != $2 AND is_default_pickup = TRUE"
                )
                .bind(user_id)
                .bind(address_id)
                .execute(&self.pool)
                .await?;
            }
            if input.is_default_dropoff.unwrap_or(false) {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_dropoff = FALSE WHERE user_id = $1 AND id != $2 AND is_default_dropoff = TRUE"
                )
                .bind(user_id)
                .bind(address_id)
                .execute(&self.pool)
                .await?;
            }
        }

        let address = sqlx::query_as::<_, UserSavedAddress>(
            r#"
            UPDATE user_saved_addresses
            SET label = $3, address_type = $4, address = $5, latitude = $6, longitude = $7,
                location_data = $8, contact_name = $9, contact_phone = $10, instructions = $11,
                building_number = $12, floor = $13, apartment = $14,
                is_default_pickup = $15, is_default_dropoff = $16, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING id, user_id, label, address_type, address, latitude, longitude,
                      location_data, contact_name, contact_phone, instructions,
                      building_number, floor, apartment, is_default_pickup,
                      is_default_dropoff, usage_count, last_used_at, is_active,
                      created_at, updated_at
            "#,
        )
        .bind(address_id)
        .bind(user_id)
        .bind(&input.label)
        .bind(&input.address_type)
        .bind(&input.address)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.location_data.as_ref().unwrap_or(&Value::Null))
        .bind(input.contact_name.as_ref())
        .bind(input.contact_phone.as_ref())
        .bind(input.instructions.as_ref())
        .bind(input.building_number.as_ref())
        .bind(input.floor.as_ref())
        .bind(input.apartment.as_ref())
        .bind(input.is_default_pickup.unwrap_or(false))
        .bind(input.is_default_dropoff.unwrap_or(false))
        .fetch_one(&self.pool)
        .await?;

        Ok(address)
    }

    /// Supprimer (soft delete) une adresse sauvegardée
    pub async fn delete_saved_address(
        &self,
        user_id: i32,
        address_id: i32,
    ) -> AppResult<()> {
        let result = sqlx::query(
            "UPDATE user_saved_addresses SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2"
        )
        .bind(address_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Adresse non trouvée".to_string()));
        }

        Ok(())
    }

    /// Définir une adresse comme adresse par défaut
    pub async fn set_default_saved_address(
        &self,
        user_id: i32,
        address_id: i32,
        address_type: &str, // 'pickup' ou 'dropoff'
    ) -> AppResult<UserSavedAddress> {
        // Vérifier que l'adresse appartient à l'utilisateur
        let existing = sqlx::query_as::<_, UserSavedAddress>(
            "SELECT id, user_id, label, address_type, address, latitude, longitude, location_data, contact_name, contact_phone, instructions, building_number, floor, apartment, is_default_pickup, is_default_dropoff, usage_count, last_used_at, is_active, created_at, updated_at FROM user_saved_addresses WHERE id = $1 AND user_id = $2"
        )
        .bind(address_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_none() {
            return Err(AppError::NotFound("Adresse non trouvée".to_string()));
        }

        // Désactiver les autres adresses par défaut du même type
        match address_type {
            "pickup" => {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_pickup = FALSE, updated_at = NOW() WHERE user_id = $1 AND id != $2 AND is_default_pickup = TRUE"
                )
                .bind(user_id)
                .bind(address_id)
                .execute(&self.pool)
                .await?;
                
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_pickup = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2"
                )
                .bind(address_id)
                .bind(user_id)
                .execute(&self.pool)
                .await?;
            }
            "dropoff" => {
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_dropoff = FALSE, updated_at = NOW() WHERE user_id = $1 AND id != $2 AND is_default_dropoff = TRUE"
                )
                .bind(user_id)
                .bind(address_id)
                .execute(&self.pool)
                .await?;
                
                sqlx::query(
                    "UPDATE user_saved_addresses SET is_default_dropoff = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2"
                )
                .bind(address_id)
                .bind(user_id)
                .execute(&self.pool)
                .await?;
            }
            _ => {
                return Err(AppError::BadRequest("address_type doit être 'pickup' ou 'dropoff'".to_string()));
            }
        }

        // Retourner l'adresse mise à jour
        let address = sqlx::query_as::<_, UserSavedAddress>(
            "SELECT id, user_id, label, address_type, address, latitude, longitude, location_data, contact_name, contact_phone, instructions, building_number, floor, apartment, is_default_pickup, is_default_dropoff, usage_count, last_used_at, is_active, created_at, updated_at FROM user_saved_addresses WHERE id = $1 AND user_id = $2"
        )
        .bind(address_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(address)
    }

    /// Incrémenter le compteur d'utilisation et mettre à jour last_used_at
    pub async fn increment_saved_address_usage(
        &self,
        _user_id: i32,
        address_id: i32,
    ) -> AppResult<()> {
        sqlx::query(
            "SELECT increment_user_saved_address_usage($1)"
        )
        .bind(address_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Trouver une adresse sauvegardée par ID
    pub async fn get_saved_address_by_id(
        &self,
        user_id: i32,
        address_id: i32,
    ) -> AppResult<Option<UserSavedAddress>> {
        let address = sqlx::query_as::<_, UserSavedAddress>(
            r#"
            SELECT id, user_id, label, address_type, address, latitude, longitude,
                   location_data, contact_name, contact_phone, instructions,
                   building_number, floor, apartment, is_default_pickup,
                   is_default_dropoff, usage_count, last_used_at, is_active,
                   created_at, updated_at
            FROM user_saved_addresses
            WHERE id = $1 AND user_id = $2 AND is_active = TRUE
            "#,
        )
        .bind(address_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(address)
    }
}
