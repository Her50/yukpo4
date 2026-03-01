// ✅ NOUVEAU: Service de gestion des chambres/unités hôtels et meublés
// Date: 2026-01-27
// Description: Service avec vérification des droits (propriétaire ou membre d'équipe)

use crate::core::types::AppError;
use crate::models::hotel_room_management::{
    CreateBlockageRequest, CreateManualReservationRequest, HotelUnitBlockage, QRCodeScanResponse,
};
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Service de gestion des chambres/unités hôtels et meublés
pub struct HotelRoomManagementService;

impl HotelRoomManagementService {
    /// Vérifie qu'un utilisateur peut gérer une propriété (propriétaire ou membre d'équipe)
    ///
    /// ⚠️ DEPRECATED: Utiliser RealEstatePermissionsService::ensure_user_can_manage_property à la place
    /// Cette fonction est conservée pour compatibilité mais délègue au service générique.
    pub async fn ensure_user_can_manage_property(
        pool: &PgPool,
        acting_user_id: i32,
        property_id: i32,
    ) -> Result<(), AppError> {
        use crate::services::real_estate_permissions_service::RealEstatePermissionsService;
        RealEstatePermissionsService::ensure_user_can_manage_property(
            pool,
            acting_user_id,
            property_id,
        )
        .await
    }

    /// Créer un blocage manuel d'unité (occupation hors système)
    pub async fn create_manual_blockage(
        pool: &PgPool,
        acting_user_id: i32,
        property_id: i32,
        request: CreateBlockageRequest,
    ) -> Result<HotelUnitBlockage, AppError> {
        // Vérifier les permissions
        Self::ensure_user_can_manage_property(pool, acting_user_id, property_id).await?;

        // Vérifier que l'unité appartient à la propriété
        let unit_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM hotel_meuble_units WHERE id = $1 AND property_id = $2)",
        )
        .bind(request.unit_id)
        .bind(property_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur vérification unité: {}",
                e
            );
            AppError::Internal("Erreur vérification unité".to_string())
        })?;

        if !unit_exists {
            return Err(AppError::BadRequest(
                "L'unité n'appartient pas à cette propriété".to_string(),
            ));
        }

        // Créer le blocage
        let blockage_id = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO hotel_unit_blockages (
                unit_id, property_id, date_debut, date_fin,
                heure_debut, heure_fin, raison, description,
                is_manual_occupation, client_name, client_phone, notes_occupation, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
            "#,
        )
        .bind(request.unit_id)
        .bind(property_id)
        .bind(request.date_debut)
        .bind(request.date_fin)
        .bind(request.heure_debut)
        .bind(request.heure_fin)
        .bind(&request.raison)
        .bind(request.description.as_deref())
        .bind(request.is_manual_occupation.unwrap_or(false))
        .bind(request.client_name.as_deref())
        .bind(request.client_phone.as_deref())
        .bind(request.notes_occupation.as_deref())
        .bind(acting_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur création blocage: {}",
                e
            );
            AppError::Internal("Erreur création blocage".to_string())
        })?;

        // Récupérer le blocage créé
        let blockage = sqlx::query_as::<_, HotelUnitBlockage>(
            "SELECT * FROM hotel_unit_blockages WHERE id = $1",
        )
        .bind(blockage_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération blocage: {}",
                e
            );
            AppError::Internal("Erreur récupération blocage".to_string())
        })?;

        Ok(blockage)
    }

    /// Créer une réservation manuelle (hors application)
    pub async fn create_manual_reservation(
        pool: &PgPool,
        acting_user_id: i32,
        request: CreateManualReservationRequest,
    ) -> Result<serde_json::Value, AppError> {
        // Vérifier les permissions
        Self::ensure_user_can_manage_property(pool, acting_user_id, request.property_id).await?;

        // Vérifier que l'unité appartient à la propriété (si unit_id fourni)
        if let Some(unit_id) = request.unit_id {
            let unit_exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM hotel_meuble_units WHERE id = $1 AND property_id = $2)",
            )
            .bind(unit_id)
            .bind(request.property_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                log::error!(
                    "[HotelRoomManagementService] Erreur vérification unité: {}",
                    e
                );
                AppError::Internal("Erreur vérification unité".to_string())
            })?;

            if !unit_exists {
                return Err(AppError::BadRequest(
                    "L'unité n'appartient pas à cette propriété".to_string(),
                ));
            }
        }

        // Générer un QR code unique pour la réservation
        let qr_code = format!("HOTEL_{}_{}", request.property_id, uuid::Uuid::new_v4());

        // Créer la réservation dans hotel_meuble_reservations
        let reservation_id = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO hotel_meuble_reservations (
                property_id, unit_id, unit_number,
                date_arrivee, date_depart, nombre_adultes, nombre_enfants, nombre_chambres,
                nom_client, telephone_client, email_client,
                prix_nuitee, prix_total, montant_total, montant_avance,
                payment_status, payment_method,
                is_manual_reservation, manual_reservation_source, manual_reservation_notes,
                qr_code, qr_code_expires_at, status, created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                TRUE, $18, $19, $20, NOW() + INTERVAL '30 days', 'confirmed', $21
            )
            RETURNING id
            "#,
        )
        .bind(request.property_id)
        .bind(request.unit_id)
        .bind(request.unit_number.as_deref())
        .bind(request.date_arrivee)
        .bind(request.date_depart)
        .bind(request.nombre_adultes)
        .bind(request.nombre_enfants)
        .bind(request.nombre_chambres)
        .bind(&request.nom_client)
        .bind(&request.telephone_client)
        .bind(request.email_client.as_deref())
        .bind(request.prix_nuitee)
        .bind(request.prix_total)
        .bind(request.montant_total)
        .bind(request.montant_avance)
        .bind(request.payment_status.as_deref().unwrap_or("pending"))
        .bind(request.payment_method.as_deref())
        .bind(&request.manual_reservation_source)
        .bind(request.notes.as_deref())
        .bind(&qr_code)
        .bind(acting_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur création réservation manuelle: {}",
                e
            );
            AppError::Internal("Erreur création réservation manuelle".to_string())
        })?;

        // Si unit_id n'était pas fourni, assigner automatiquement une unité disponible
        let assigned_unit_id = if request.unit_id.is_none() {
            // Utiliser la fonction SQL assign_available_unit si elle existe
            // Sinon, chercher manuellement une unité disponible
            let unit: Option<(i32, String)> = sqlx::query_as(
                r#"
                SELECT id, unit_number
                FROM hotel_meuble_units
                WHERE property_id = $1
                AND is_active = TRUE
                AND is_available = TRUE
                AND capacite_max_total >= $2
                AND NOT EXISTS (
                    SELECT 1 FROM hotel_unit_blockages
                    WHERE unit_id = hotel_meuble_units.id
                    AND date_debut <= $4
                    AND date_fin >= $3
                )
                AND NOT EXISTS (
                    SELECT 1 FROM hotel_meuble_reservations
                    WHERE unit_id = hotel_meuble_units.id
                    AND date_arrivee <= $4
                    AND date_depart >= $3
                    AND status IN ('pending', 'confirmed', 'checked_in')
                )
                ORDER BY capacite_max_total ASC
                LIMIT 1
                "#,
            )
            .bind(request.property_id)
            .bind(request.nombre_adultes + request.nombre_enfants.unwrap_or(0))
            .bind(request.date_arrivee)
            .bind(request.date_depart)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                log::error!(
                    "[HotelRoomManagementService] Erreur assignation automatique: {}",
                    e
                );
                AppError::Internal("Erreur assignation automatique".to_string())
            })?;

            if let Some((unit_id, unit_number)) = unit {
                // Mettre à jour la réservation avec l'unité assignée
                sqlx::query(
                    "UPDATE hotel_meuble_reservations SET unit_id = $1, unit_number = $2 WHERE id = $3",
                )
                .bind(unit_id)
                .bind(&unit_number)
                .bind(reservation_id)
                .execute(pool)
                .await
                .map_err(|e| {
                    log::error!(
                        "[HotelRoomManagementService] Erreur mise à jour unité: {}",
                        e
                    );
                    AppError::Internal("Erreur mise à jour unité".to_string())
                })?;

                Some(unit_id)
            } else {
                None
            }
        } else {
            request.unit_id
        };

        Ok(serde_json::json!({
            "id": reservation_id,
            "property_id": request.property_id,
            "unit_id": assigned_unit_id,
            "qr_code": qr_code,
            "status": "confirmed",
            "is_manual_reservation": true,
            "created_by": acting_user_id
        }))
    }

    /// Scanner un QR code de réservation hôtel/meublé
    pub async fn scan_reservation_qr_code(
        pool: &PgPool,
        acting_user_id: i32,
        qr_code: &str,
    ) -> Result<QRCodeScanResponse, AppError> {
        // 1) Vérifier si le QR correspond à un QR "invité" ou secondaire
        #[derive(sqlx::FromRow)]
        struct GuestQrRow {
            reservation_id: i32,
            qr_type: String,
            guest_label: Option<String>,
        }

        let guest_qr: Option<GuestQrRow> = sqlx::query_as::<_, GuestQrRow>(
            r#"
            SELECT reservation_id, qr_type, guest_label
            FROM hotel_reservation_qr_codes
            WHERE qr_code = $1
            "#,
        )
        .bind(qr_code)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération QR invité: {}",
                e
            );
            AppError::Internal("Erreur récupération QR invité".to_string())
        })?;

        // 2) Si QR invité trouvé, utiliser son reservation_id, sinon chercher directement par qr_code principal
        let (reservation_id, qr_type, guest_label) = if let Some(g) = guest_qr {
            (g.reservation_id, g.qr_type, g.guest_label)
        } else {
            // QR principal stocké directement dans hotel_meuble_reservations.qr_code
            let reservation_id_opt: Option<i32> = sqlx::query_scalar(
                "SELECT id FROM hotel_meuble_reservations WHERE qr_code = $1",
            )
            .bind(qr_code)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                log::error!(
                    "[HotelRoomManagementService] Erreur recherche réservation par QR principal: {}",
                    e
                );
                AppError::Internal("Erreur récupération réservation".to_string())
            })?;

            let reservation_id = reservation_id_opt.ok_or_else(|| {
                AppError::NotFound("Réservation introuvable pour ce QR code".to_string())
            })?;

            (reservation_id, "main".to_string(), None)
        };

        // 3) Récupérer la réservation complète
        let row = sqlx::query(
            r#"
            SELECT
                r.id as reservation_id,
                r.property_id,
                r.unit_number,
                r.nom_client,
                r.date_arrivee,
                r.date_depart,
                r.payment_status,
                COALESCE(r.montant_avance, 0) as montant_avance,
                r.montant_total,
                r.status,
                p.titre as property_name
            FROM hotel_meuble_reservations r
            LEFT JOIN real_estate_properties p ON p.id = r.property_id
            WHERE r.id = $1
            "#,
        )
        .bind(reservation_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération réservation par ID: {}",
                e
            );
            AppError::Internal("Erreur récupération réservation".to_string())
        })?;

        let row = match row {
            Some(r) => r,
            None => {
                return Err(AppError::NotFound(
                    "Réservation introuvable pour ce QR code".to_string(),
                ));
            }
        };

        // Extraire property_id pour vérifier les droits
        let property_id: i32 = row.try_get("property_id").map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération property_id (scan QR): {}",
                e
            );
            AppError::Internal("Erreur récupération propriété".to_string())
        })?;

        // Vérifier que le gérant peut gérer cette propriété
        Self::ensure_user_can_manage_property(pool, acting_user_id, property_id).await?;

        // Construire la réponse métier
        let property_name: String =
            row.try_get("property_name").unwrap_or_else(|_| "Bien".to_string());

        let unit_number: Option<String> = row.try_get("unit_number").ok();
        let client_name: String =
            row.try_get("nom_client").unwrap_or_else(|_| "Client".to_string());

        let date_arrivee: chrono::NaiveDate = row.try_get("date_arrivee").map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération date_arrivee: {}",
                e
            );
            AppError::Internal("Erreur récupération date_arrivee".to_string())
        })?;

        let date_depart: chrono::NaiveDate = row.try_get("date_depart").map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération date_depart: {}",
                e
            );
            AppError::Internal("Erreur récupération date_depart".to_string())
        })?;

        let payment_status: String =
            row.try_get("payment_status").unwrap_or_else(|_| "pending".to_string());

        let montant_avance: Decimal =
            row.try_get("montant_avance").unwrap_or_else(|_| Decimal::ZERO);

        let montant_total: Decimal = row.try_get("montant_total").map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération montant_total: {}",
                e
            );
            AppError::Internal("Erreur récupération montant_total".to_string())
        })?;

        let montant_restant =
            montant_total.checked_sub(montant_avance).unwrap_or_else(|| Decimal::ZERO);

        let status: String = row.try_get("status").unwrap_or_else(|_| "pending".to_string());

        // Logique simple pour check-in / check-out
        let today = chrono::Utc::now().date_naive();
        let can_check_in =
            matches!(status.as_str(), "pending" | "confirmed") && today >= date_arrivee;
        let can_check_out = matches!(status.as_str(), "checked_in") && today >= date_arrivee;

        Ok(QRCodeScanResponse {
            reservation_id,
            property_id,
            property_name,
            unit_number,
            client_name,
            date_arrivee,
            date_depart,
            payment_status,
            montant_avance,
            montant_total,
            montant_restant,
            status,
            can_check_in,
            can_check_out,
            qr_type,
            guest_label,
        })
    }

    /// Génère un QR "invité" pour une réservation existante
    pub async fn generate_guest_qr(
        pool: &PgPool,
        acting_user_id: i32,
        reservation_id: i32,
        guest_label: Option<String>,
    ) -> Result<serde_json::Value, AppError> {
        // Récupérer la propriété associée à la réservation
        let property_id: Option<i32> =
            sqlx::query_scalar("SELECT property_id FROM hotel_meuble_reservations WHERE id = $1")
                .bind(reservation_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| {
                    log::error!(
                "[HotelRoomManagementService] Erreur récupération réservation pour QR invité: {}",
                e
            );
                    AppError::Internal("Erreur récupération réservation".to_string())
                })?;

        let property_id = match property_id {
            Some(id) => id,
            None => {
                return Err(AppError::NotFound("Réservation introuvable".to_string()));
            }
        };

        // Vérifier les permissions du gérant
        Self::ensure_user_can_manage_property(pool, acting_user_id, property_id).await?;

        // Générer code unique
        let qr_code = format!(
            "HOTELGUEST-{}-{}-{}",
            reservation_id,
            chrono::Utc::now().timestamp(),
            Uuid::new_v4().to_string().chars().take(8).collect::<String>()
        );

        // Expiration par défaut: 30 jours
        let expires_at = chrono::Utc::now() + chrono::Duration::days(30);

        // Insérer dans table dédiée
        let qr_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO hotel_reservation_qr_codes (
                reservation_id, qr_code, qr_type, guest_label, expires_at
            )
            VALUES ($1, $2, 'guest', $3, $4)
            RETURNING id
            "#,
        )
        .bind(reservation_id)
        .bind(&qr_code)
        .bind(guest_label.as_deref())
        .bind(expires_at)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur création QR invité: {}",
                e
            );
            AppError::Internal("Erreur création QR invité".to_string())
        })?;

        Ok(serde_json::json!({
            "id": qr_id,
            "reservation_id": reservation_id,
            "qr_code": qr_code,
            "qr_type": "guest",
            "guest_label": guest_label.unwrap_or_else(|| "Invité / Co-chambrier".to_string()),
            "expires_at": expires_at.to_rfc3339(),
        }))
    }

    /// Obtenir toutes les propriétés que l'utilisateur peut gérer
    pub async fn get_user_managed_properties(
        pool: &PgPool,
        user_id: i32,
    ) -> Result<Vec<serde_json::Value>, AppError> {
        let properties = sqlx::query(
            r#"
            SELECT DISTINCT
                rep.id,
                rep.titre,
                rep.type_bien,
                rep.adresse,
                rep.ville,
                rep.pays,
                rep.photos,
                rep.prix_location,
                rep.service_id,
                s.user_id as owner_id,
                hpg.group_name,
                hpg.id as group_id
            FROM real_estate_properties rep
            LEFT JOIN services s ON rep.service_id = s.id
            LEFT JOIN hotel_property_group_members hpgm ON rep.id = hpgm.property_id
            LEFT JOIN hotel_property_groups hpg ON hpgm.group_id = hpg.id
            WHERE (
                -- Propriétés dont l'utilisateur est propriétaire
                s.user_id = $1
                OR
                -- Propriétés où l'utilisateur est membre d'équipe
                EXISTS (
                    SELECT 1 FROM service_team_members stm
                    WHERE stm.service_id = rep.service_id
                    AND stm.user_id = $1
                    AND stm.is_active = TRUE
                    AND stm.role_id IN ('admin', 'manager', 'editor')
                )
            )
            AND rep.type_bien IN ('hotel', 'meuble', 'residence', 'auberge')
            ORDER BY rep.titre ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération propriétés: {}",
                e
            );
            AppError::Internal("Erreur récupération propriétés".to_string())
        })?;

        let mut result = Vec::new();
        for row in properties {
            result.push(serde_json::json!({
                "id": row.try_get::<i32, _>("id").unwrap_or(0),
                "titre": row.try_get::<Option<String>, _>("titre").unwrap_or(None),
                "type_bien": row.try_get::<Option<String>, _>("type_bien").unwrap_or(None),
                "adresse": row.try_get::<Option<String>, _>("adresse").unwrap_or(None),
                "ville": row.try_get::<Option<String>, _>("ville").unwrap_or(None),
                "pays": row.try_get::<Option<String>, _>("pays").unwrap_or(None),
                "photos": row.try_get::<Option<Vec<String>>, _>("photos").unwrap_or(None),
                "prix_location": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location").unwrap_or(None),
                "service_id": row.try_get::<Option<i32>, _>("service_id").unwrap_or(None),
                "owner_id": row.try_get::<Option<i32>, _>("owner_id").unwrap_or(None),
                "group_name": row.try_get::<Option<String>, _>("group_name").unwrap_or(None),
                "group_id": row.try_get::<Option<i32>, _>("group_id").unwrap_or(None),
            }));
        }

        Ok(result)
    }

    /// Récupère tous les QR codes d'une réservation (principal + invités)
    pub async fn get_reservation_qr_codes(
        pool: &PgPool,
        reservation_id: i32,
    ) -> Result<serde_json::Value, AppError> {
        // Récupérer le QR principal depuis hotel_meuble_reservations
        let main_qr: Option<(String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
            r#"
            SELECT qr_code, qr_code_expires_at
            FROM hotel_meuble_reservations
            WHERE id = $1 AND qr_code IS NOT NULL
            "#,
        )
        .bind(reservation_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération QR principal: {}",
                e
            );
            AppError::Internal("Erreur récupération QR principal".to_string())
        })?;

        // Récupérer tous les QR invités depuis hotel_reservation_qr_codes
        #[derive(sqlx::FromRow)]
        struct GuestQRRow {
            id: i32,
            qr_code: String,
            qr_type: String,
            guest_label: Option<String>,
            expires_at: chrono::DateTime<chrono::Utc>,
            created_at: chrono::DateTime<chrono::Utc>,
        }

        let guest_qrs = sqlx::query_as::<_, GuestQRRow>(
            r#"
            SELECT id, qr_code, qr_type, guest_label, expires_at, created_at
            FROM hotel_reservation_qr_codes
            WHERE reservation_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(reservation_id)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération QR invités: {}",
                e
            );
            AppError::Internal("Erreur récupération QR invités".to_string())
        })?;

        // Construire la réponse
        let mut qr_codes = Vec::new();

        // QR principal
        if let Some((qr_code, expires_at)) = main_qr {
            qr_codes.push(json!({
                "id": null,
                "reservation_id": reservation_id,
                "qr_code": qr_code,
                "qr_code_url": format!("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}", urlencoding::encode(&qr_code)),
                "qr_type": "main",
                "guest_label": null,
                "expires_at": expires_at.to_rfc3339(),
                "created_at": null,
            }));
        }

        // QR invités
        for guest_qr in guest_qrs {
            qr_codes.push(json!({
                "id": guest_qr.id,
                "reservation_id": reservation_id,
                "qr_code": guest_qr.qr_code,
                "qr_code_url": format!("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}", urlencoding::encode(&guest_qr.qr_code)),
                "qr_type": guest_qr.qr_type,
                "guest_label": guest_qr.guest_label,
                "expires_at": guest_qr.expires_at.to_rfc3339(),
                "created_at": guest_qr.created_at.to_rfc3339(),
            }));
        }

        Ok(json!({
            "reservation_id": reservation_id,
            "qr_codes": qr_codes,
            "total": qr_codes.len(),
        }))
    }

    /// Récupère toutes les réservations pour les propriétés gérées par un utilisateur
    pub async fn get_user_reservations(
        pool: &PgPool,
        user_id: i32,
    ) -> Result<Vec<serde_json::Value>, AppError> {
        // Récupérer toutes les réservations des propriétés gérées par l'utilisateur
        let reservations = sqlx::query(
            r#"
            SELECT 
                r.id,
                r.property_id,
                r.unit_id,
                r.unit_number,
                r.nom_client,
                r.telephone_client,
                r.email_client,
                r.date_arrivee,
                r.date_depart,
                r.nombre_adultes,
                r.nombre_enfants,
                r.nombre_chambres,
                r.prix_nuitee,
                r.prix_total,
                r.montant_total,
                r.montant_avance,
                r.payment_status,
                r.payment_method,
                r.status,
                r.created_at,
                p.titre as property_name,
                p.ville as property_ville
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE (
                -- Propriétés dont l'utilisateur est propriétaire
                s.user_id = $1
                OR
                -- Propriétés où l'utilisateur est membre d'équipe
                EXISTS (
                    SELECT 1 FROM service_team_members stm
                    WHERE stm.service_id = s.id
                    AND stm.user_id = $1
                    AND stm.is_active = TRUE
                    AND stm.role_id IN ('admin', 'manager', 'editor')
                )
            )
            ORDER BY r.date_arrivee DESC, r.created_at DESC
            LIMIT 100
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération réservations: {}",
                e
            );
            AppError::Internal("Erreur récupération réservations".to_string())
        })?;

        let mut result = Vec::new();
        for row in reservations {
            let date_arrivee: chrono::NaiveDate =
                row.try_get("date_arrivee").unwrap_or_else(|_| chrono::Utc::now().date_naive());
            let date_depart: chrono::NaiveDate =
                row.try_get("date_depart").unwrap_or_else(|_| chrono::Utc::now().date_naive());
            let today = chrono::Utc::now().date_naive();
            let status: String = row.try_get("status").unwrap_or_else(|_| "pending".to_string());

            let can_check_in =
                matches!(status.as_str(), "pending" | "confirmed") && today >= date_arrivee;
            let can_check_out = matches!(status.as_str(), "checked_in") && today >= date_arrivee;

            result.push(json!({
                "id": row.try_get::<i32, _>("id").unwrap_or(0),
                "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
                "property_name": row.try_get::<Option<String>, _>("property_name").unwrap_or(None),
                "unit_id": row.try_get::<Option<i32>, _>("unit_id").unwrap_or(None),
                "unit_number": row.try_get::<Option<String>, _>("unit_number").unwrap_or(None),
                "nom_client": row.try_get::<Option<String>, _>("nom_client").unwrap_or(None),
                "telephone_client": row.try_get::<Option<String>, _>("telephone_client").unwrap_or(None),
                "email_client": row.try_get::<Option<String>, _>("email_client").unwrap_or(None),
                "date_arrivee": date_arrivee.to_string(),
                "date_depart": date_depart.to_string(),
                "nombre_adultes": row.try_get::<i32, _>("nombre_adultes").unwrap_or(1),
                "nombre_enfants": row.try_get::<Option<i32>, _>("nombre_enfants").unwrap_or(None),
                "nombre_chambres": row.try_get::<i32, _>("nombre_chambres").unwrap_or(1),
                "prix_nuitee": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_nuitee").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "prix_total": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_total").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "montant_total": row.try_get::<Option<rust_decimal::Decimal>, _>("montant_total").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()).unwrap_or(0.0),
                "montant_avance": row.try_get::<Option<rust_decimal::Decimal>, _>("montant_avance").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()).unwrap_or(0.0),
                "payment_status": row.try_get::<Option<String>, _>("payment_status").unwrap_or(Some("pending".to_string())),
                "payment_method": row.try_get::<Option<String>, _>("payment_method").unwrap_or(None),
                "status": status,
                "can_check_in": can_check_in,
                "can_check_out": can_check_out,
                "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
            }));
        }

        Ok(result)
    }

    /// Met à jour le statut d'une réservation (check-in ou check-out)
    pub async fn update_reservation_status(
        pool: &PgPool,
        acting_user_id: i32,
        reservation_id: i32,
        new_status: &str, // "checked_in" ou "checked_out"
    ) -> Result<(), AppError> {
        // Vérifier que la réservation existe et que l'utilisateur peut la gérer
        let reservation_info: Option<(i32, String)> = sqlx::query_as(
            r#"
            SELECT property_id, status
            FROM hotel_meuble_reservations
            WHERE id = $1
            "#,
        )
        .bind(reservation_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur récupération réservation: {}",
                e
            );
            AppError::Internal("Erreur récupération réservation".to_string())
        })?;

        let (property_id, current_status) = match reservation_info {
            Some((pid, status)) => (pid, status),
            None => {
                return Err(AppError::NotFound("Réservation introuvable".to_string()));
            }
        };

        // Vérifier les permissions
        Self::ensure_user_can_manage_property(pool, acting_user_id, property_id).await?;

        // Vérifier que la transition de statut est valide
        let valid_transition = match (current_status.as_str(), new_status) {
            ("pending" | "confirmed", "checked_in") => true,
            ("checked_in", "checked_out") => true,
            _ => false,
        };

        if !valid_transition {
            return Err(AppError::BadRequest(format!(
                "Transition de statut invalide: {} -> {}",
                current_status, new_status
            )));
        }

        // Mettre à jour le statut
        sqlx::query(
            r#"
            UPDATE hotel_meuble_reservations
            SET status = $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(new_status)
        .bind(reservation_id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[HotelRoomManagementService] Erreur mise à jour statut: {}",
                e
            );
            AppError::Internal("Erreur mise à jour statut".to_string())
        })?;

        Ok(())
    }
}
