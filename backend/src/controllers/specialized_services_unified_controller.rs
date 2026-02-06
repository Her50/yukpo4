// ✅ NOUVEAU : Contrôleur unifié pour services spécialisés
// Remplace les 6 appels API séparés par un seul endpoint optimisé

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::conflict_resolution::{ConflictResolution, ConflictResolutionService};
use crate::services::specialized_services_cache::SpecializedServicesCache;
use crate::services::specialized_services_metrics;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Deserialize)]
pub struct ListServicesQuery {
    pub type_filter: Option<String>, // "pharmacie", "hopital", etc.
    pub status: Option<String>,      // "active", "inactive", "all"
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<String>, // ✅ Phase 5.3: "name", "created_at", "updated_at", "status"
    pub sort_direction: Option<String>, // ✅ Phase 5.3: "asc" or "desc"
    // ✅ Phase 7.2: Pagination avec curseurs (plus efficace)
    pub cursor: Option<String>, // Curseur pour pagination basée sur ID
    pub cursor_direction: Option<String>, // "next" or "prev"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedSpecializedService {
    pub id: i32,
    pub service_id: i32,
    #[serde(rename = "type")]
    pub type_: String,
    pub nom: String,
    pub is_active: bool,
    pub is_available_now: Option<bool>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub metadata: serde_json::Value, // Données spécifiques au type
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnifiedServicesResponse {
    pub services: Vec<UnifiedSpecializedService>,
    pub statistics: ServicesStatistics,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServicesStatistics {
    pub total: i64,
    pub active: i64,
    pub inactive: i64,
    pub by_type: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginationInfo {
    pub page: i64,
    pub limit: i64,
    pub total: i64,
    pub total_pages: i64,
    // ✅ Phase 7.2: Pagination avec curseurs
    pub next_cursor: Option<String>,
    pub prev_cursor: Option<String>,
    pub has_more: bool,
}

/// ✅ NOUVEAU : Endpoint unifié pour lister tous les services spécialisés d'un utilisateur
/// Remplace les 6 appels API séparés par un seul appel optimisé
/// Utilise le cache Redis pour optimiser les performances
pub async fn list_user_specialized_services(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<ListServicesQuery>,
) -> AppResult<impl IntoResponse> {
    // ✅ Phase 7.4: Métriques Prometheus
    let start_time = Instant::now();
    specialized_services_metrics::increment_request_counter(query.type_filter.as_deref());

    info!(
        "[list_user_specialized_services] Appelé pour user_id={}, type_filter={:?}, status={:?}",
        user_id, query.type_filter, query.status
    );

    // ✅ Phase 7.2: Support pagination avec curseurs (plus efficace) ou classique
    let use_cursor = query.cursor.is_some();
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1); // Max 100 par page
    let offset = if use_cursor { 0 } else { (page - 1) * limit };

    // Décoder le curseur si fourni (format: "id:timestamp" ou juste "id")
    let cursor_id: Option<i32> = query
        .cursor
        .as_ref()
        .and_then(|c| c.split(':').next().and_then(|id_str| id_str.parse().ok()));

    // ✅ Phase 7.5: Utiliser le ScalabilityService pour cache multi-niveaux et scalabilité
    let cache_key = state.scalability.generate_search_cache_key(
        &format!(
            "specialized_services:user_{}:type_{:?}:status_{:?}:page_{}:limit_{}:cursor_{:?}",
            user_id, query.type_filter, query.status, page, limit, query.cursor
        ),
        &json!({
            "type_filter": query.type_filter,
            "status": query.status,
            "page": page,
            "limit": limit,
            "cursor": query.cursor,
        }),
    );

    // Vérifier le cache via ScalabilityService (cache multi-niveaux)
    if let Ok(Some(cached_result)) = state.scalability.get_cached_search_results(&cache_key).await {
        specialized_services_metrics::record_cache_hit();
        let duration = start_time.elapsed().as_secs_f64();
        specialized_services_metrics::record_latency(duration);

        // Désérialiser le résultat depuis le cache
        if let Ok(response) = serde_json::from_value::<UnifiedServicesResponse>(cached_result) {
            info!("[list_user_specialized_services] ✅ Cache hit via ScalabilityService");
            return Ok((StatusCode::OK, Json(response)));
        }
    }
    specialized_services_metrics::record_cache_miss();

    // ✅ NOUVEAU: Vérifier le cache Redis (fallback)
    let cache = SpecializedServicesCache::new(state.clone());

    // Essayer de récupérer depuis le cache
    if let Ok(Some(cached)) = cache
        .get_services_list(
            user_id,
            query.type_filter.as_deref(),
            query.status.as_deref(),
            page,
            limit,
        )
        .await
    {
        // ✅ Phase 7.4: Métriques cache hit
        specialized_services_metrics::record_cache_hit();
        info!("[list_user_specialized_services] ✅ Cache hit, retour des données en cache");

        // Convertir les services JSON en UnifiedSpecializedService
        let services: Vec<UnifiedSpecializedService> = cached
            .services
            .into_iter()
            .filter_map(|v| serde_json::from_value(v).ok())
            .collect();

        // Récupérer les statistiques depuis le cache séparé
        let stats = if let Ok(Some(cached_stats)) =
            cache.get_statistics(user_id, query.status.as_deref()).await
        {
            serde_json::from_value(cached_stats.statistics).unwrap_or_else(|_| ServicesStatistics {
                total: 0,
                active: 0,
                inactive: 0,
                by_type: json!({}),
            })
        } else {
            // Si pas de cache pour stats, calculer rapidement
            calculate_statistics(&state.pg, user_id, query.status.as_deref())
                .await
                .unwrap_or_else(|_| ServicesStatistics {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    by_type: json!({}),
                })
        };

        let pagination: PaginationInfo =
            serde_json::from_value(cached.pagination).unwrap_or_else(|_| PaginationInfo {
                page,
                limit,
                total: stats.total,
                total_pages: 0,
                next_cursor: None,
                prev_cursor: None,
                has_more: false,
            });

        // ✅ Phase 7.4: Métriques latence et taille réponse
        let duration = start_time.elapsed().as_secs_f64();
        specialized_services_metrics::record_latency(duration);
        let response_size = serde_json::to_string(&UnifiedServicesResponse {
            services: services.clone(),
            statistics: stats.clone(),
            pagination: pagination.clone(),
        })
        .map(|s| s.len() as f64)
        .unwrap_or(0.0);
        specialized_services_metrics::record_response_size(response_size);

        return Ok((
            StatusCode::OK,
            Json(UnifiedServicesResponse {
                services,
                statistics: stats,
                pagination,
            }),
        ));
    }

    // ✅ Phase 7.4: Métriques cache miss
    specialized_services_metrics::record_cache_miss();

    // Cache miss: récupérer depuis la base de données
    let mut services: Vec<UnifiedSpecializedService> = Vec::new();

    // Construire la condition WHERE pour le statut
    let status_condition = match query.status.as_deref() {
        Some("active") => "AND s.is_active = true",
        Some("inactive") => "AND s.is_active = false",
        _ => "", // "all" ou None = tous
    };

    // ✅ Phase 5.3: Fonction helper pour construire ORDER BY selon le type de service
    // ✅ Phase 7.2: Support curseurs avec WHERE condition
    let build_order_by = |table_prefix: &str| -> String {
        let direction = match query.sort_direction.as_deref() {
            Some("asc") => "ASC",
            Some("desc") => "DESC",
            _ => "DESC",
        };

        match query.sort_by.as_deref() {
            Some("name") => format!("ORDER BY {}.nom {}", table_prefix, direction),
            Some("created_at") => format!("ORDER BY {}.created_at {}", table_prefix, direction),
            Some("updated_at") => format!("ORDER BY {}.updated_at {}", table_prefix, direction),
            Some("status") => format!("ORDER BY s.is_active {}", direction),
            _ => format!("ORDER BY {}.updated_at DESC", table_prefix), // Par défaut
        }
    };

    // ✅ Phase 7.2: Construire condition WHERE pour curseur
    let build_cursor_where = |table_prefix: &str, cursor_id: Option<i32>| -> String {
        if let Some(cid) = cursor_id {
            let direction = match query.sort_direction.as_deref() {
                Some("asc") => ">",
                Some("desc") => "<",
                _ => "<",
            };
            let cursor_direction = query.cursor_direction.as_deref().unwrap_or("next");

            // Pour "next", on prend les IDs > cursor_id, pour "prev" on prend < cursor_id
            let op = if cursor_direction == "prev" {
                if direction == ">" {
                    "<"
                } else {
                    ">"
                }
            } else {
                direction
            };

            format!("AND {}.id {} {}", table_prefix, op, cid)
        } else {
            String::new()
        }
    };

    // 1. Pharmacies
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("pharmacie") {
        let sql = format!(
            r#"
            SELECT 
                p.id,
                p.service_id,
                'pharmacie' as type_,
                p.nom,
                s.is_active,
                p.is_on_duty_now as is_available_now,
                p.created_at,
                p.updated_at,
                jsonb_build_object(
                    'adresse', p.adresse,
                    'quartier', p.quartier,
                    'ville', p.ville,
                    'telephone', p.telephone,
                    'whatsapp', p.whatsapp,
                    'email', p.email,
                    'is_on_duty_now', p.is_on_duty_now,
                    'permanent_24h', p.permanent_24h,
                    'services', p.services
                ) as metadata
            FROM pharmacies p
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("p", cursor_id),
            build_order_by("p"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!("[list_user_specialized_services] Erreur pharmacies: {}", e);
            AppError::Internal(format!("Erreur chargement pharmacies: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // 2. Hôpitaux
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("hopital") {
        let sql = format!(
            r#"
            SELECT 
                h.id,
                h.service_id,
                'hopital' as type_,
                h.nom,
                s.is_active,
                h.is_available_now,
                h.created_at,
                h.updated_at,
                jsonb_build_object(
                    'type_etablissement', h.type_etablissement,
                    'adresse', h.adresse,
                    'quartier', h.quartier,
                    'ville', h.ville,
                    'urgences_disponible', h.urgences_disponible,
                    'rdv_en_ligne', h.rdv_en_ligne,
                    'telephone', h.telephone,
                    'whatsapp', h.whatsapp,
                    'email', h.email
                ) as metadata
            FROM hopitaux_cliniques h
            INNER JOIN services s ON s.id = h.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("h", cursor_id),
            build_order_by("h"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!("[list_user_specialized_services] Erreur hôpitaux: {}", e);
            AppError::Internal(format!("Erreur chargement hôpitaux: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // 3. Laboratoires
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("laboratoire") {
        let sql = format!(
            r#"
            SELECT 
                l.id,
                l.service_id,
                'laboratoire' as type_,
                l.nom,
                s.is_active,
                l.is_available_now,
                l.created_at,
                l.updated_at,
                jsonb_build_object(
                    'type_laboratoire', l.type_laboratoire,
                    'adresse', l.adresse,
                    'quartier', l.quartier,
                    'ville', l.ville,
                    'analyses_disponibles', l.analyses_disponibles,
                    'imagerie_disponible', l.imagerie_disponible,
                    'rdv_requis', l.rdv_requis,
                    'resultats_en_ligne', l.resultats_en_ligne,
                    'telephone', l.telephone,
                    'whatsapp', l.whatsapp,
                    'email', l.email
                ) as metadata
            FROM laboratoires_imagerie l
            INNER JOIN services s ON s.id = l.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("l", cursor_id),
            build_order_by("l"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!(
                "[list_user_specialized_services] Erreur laboratoires: {}",
                e
            );
            AppError::Internal(format!("Erreur chargement laboratoires: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // 4. Agences de voyage
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("agence_voyage") {
        let sql = format!(
            r#"
            SELECT 
                a.id,
                a.service_id,
                'agence_voyage' as type_,
                a.nom_agence as nom,
                s.is_active,
                NULL as is_available_now,
                a.created_at,
                a.updated_at,
                jsonb_build_object(
                    'adresse', a.adresse,
                    'quartier', a.quartier,
                    'ville', a.ville,
                    'peut_emettre_tickets_bus', a.peut_emettre_tickets_bus,
                    'telephone', a.telephone,
                    'whatsapp', a.whatsapp,
                    'email', a.email
                ) as metadata
            FROM agences_voyage a
            INNER JOIN services s ON s.id = a.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("a", cursor_id),
            build_order_by("a"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!("[list_user_specialized_services] Erreur agences: {}", e);
            AppError::Internal(format!("Erreur chargement agences: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // 5. Covoiturages
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("covoiturage") {
        let sql = format!(
            r#"
            SELECT 
                c.id,
                c.service_id,
                'covoiturage' as type_,
                CONCAT(c.depart, ' → ', c.destination) as nom,
                s.is_active,
                (c.places_disponibles > 0 AND c.date_depart > NOW()) as is_available_now,
                c.created_at,
                c.updated_at,
                jsonb_build_object(
                    'depart', c.depart,
                    'destination', c.destination,
                    'date_depart', c.date_depart,
                    'heure_depart', c.heure_depart,
                    'nombre_places', c.nombre_places,
                    'places_disponibles', c.places_disponibles,
                    'prix_par_place', c.prix_par_place,
                    'devise', c.devise
                ) as metadata
            FROM covoiturages c
            INNER JOIN services s ON s.id = c.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("c", cursor_id),
            build_order_by("c"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!(
                "[list_user_specialized_services] Erreur covoiturages: {}",
                e
            );
            AppError::Internal(format!("Erreur chargement covoiturages: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // 6. Taxis
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("taxi") {
        let sql = format!(
            r#"
            SELECT 
                t.id,
                t.service_id,
                'taxi' as type_,
                COALESCE(t.nom_chauffeur, CONCAT('Taxi ', t.telephone)) as nom,
                s.is_active,
                t.is_available_now,
                t.created_at,
                t.updated_at,
                jsonb_build_object(
                    'nom_chauffeur', t.nom_chauffeur,
                    'telephone', t.telephone,
                    'whatsapp', t.whatsapp,
                    'zone_intervention', t.zone_intervention,
                    'gps_actuel', t.gps_actuel,
                    'is_on_duty', t.is_on_duty
                ) as metadata
            FROM taxis_ville t
            INNER JOIN services s ON s.id = t.service_id
            WHERE s.user_id = $1 {} {}
            {}
            LIMIT $2 {}
            "#,
            status_condition,
            build_cursor_where("t", cursor_id),
            build_order_by("t"),
            if use_cursor { "" } else { "OFFSET $3" }
        );

        let mut query_builder = sqlx::query(&sql).bind(user_id).bind(limit);

        if !use_cursor {
            query_builder = query_builder.bind(offset);
        }

        let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!("[list_user_specialized_services] Erreur taxis: {}", e);
            AppError::Internal(format!("Erreur chargement taxis: {}", e))
        })?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                type_: row.get::<String, _>("type_"),
                nom: row.get::<String, _>("nom"),
                is_active: row.get::<bool, _>("is_active"),
                is_available_now: row.get::<Option<bool>, _>("is_available_now"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                metadata: row.get::<serde_json::Value, _>("metadata"),
            });
        }
    }

    // Calculer les statistiques (vérifier cache d'abord)
    let stats = if let Ok(Some(cached_stats)) =
        cache.get_statistics(user_id, query.status.as_deref()).await
    {
        info!("[list_user_specialized_services] ✅ Cache hit pour statistiques");
        serde_json::from_value(cached_stats.statistics).unwrap_or_else(|_| ServicesStatistics {
            total: 0,
            active: 0,
            inactive: 0,
            by_type: json!({}),
        })
    } else {
        // Cache miss: calculer depuis la base de données
        let calculated_stats = calculate_statistics(&state.pg, user_id, query.status.as_deref())
            .await
            .map_err(|e| {
                error!(
                    "[list_user_specialized_services] Erreur statistiques: {}",
                    e
                );
                AppError::Internal(format!("Erreur calcul statistiques: {}", e))
            })?;

        // Mettre en cache les statistiques
        let stats_json = serde_json::to_value(&calculated_stats).unwrap_or(json!({}));
        let _ = cache.set_statistics(user_id, query.status.as_deref(), &stats_json).await;

        calculated_stats
    };

    // Calculer pagination
    let total = stats.total;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    // ✅ Phase 7.2: Générer les curseurs next/prev
    let (next_cursor, prev_cursor, has_more) = if use_cursor && !services.is_empty() {
        let last_id = services.last().map(|s| s.id).unwrap_or(0);
        let first_id = services.first().map(|s| s.id).unwrap_or(0);

        // Vérifier s'il y a plus d'éléments après
        let has_more_check = services.len() as i64 >= limit;

        (
            if has_more_check {
                Some(format!("{}", last_id))
            } else {
                None
            },
            if cursor_id.is_some() {
                Some(format!("{}", first_id))
            } else {
                None
            },
            has_more_check,
        )
    } else {
        (None, None, page < total_pages)
    };

    let pagination = PaginationInfo {
        page,
        limit,
        total,
        total_pages,
        next_cursor,
        prev_cursor,
        has_more,
    };

    // ✅ NOUVEAU: Mettre en cache les résultats
    let services_json: Vec<serde_json::Value> =
        services.iter().map(|s| serde_json::to_value(s).unwrap_or(json!({}))).collect();
    let pagination_json = serde_json::to_value(&pagination).unwrap_or(json!({}));
    let _ = cache
        .set_services_list(
            user_id,
            query.type_filter.as_deref(),
            query.status.as_deref(),
            page,
            limit,
            &services_json,
            &pagination_json,
        )
        .await;

    info!(
        "[list_user_specialized_services] ✅ {} services trouvés pour user_id={}",
        services.len(),
        user_id
    );

    // Construire la réponse
    let response = UnifiedServicesResponse {
        services: services.clone(),
        statistics: stats.clone(),
        pagination: pagination.clone(),
    };

    // ✅ Phase 7.5: Mettre en cache via ScalabilityService (cache multi-niveaux)
    let response_json = serde_json::to_value(&response).unwrap_or(json!({}));
    let _ = state
        .scalability
        .cache_search_results(
            &cache_key,
            &response_json,
            std::time::Duration::from_secs(300), // TTL 5 minutes
        )
        .await;

    // ✅ Phase 7.4: Métriques latence et taille réponse
    let duration = start_time.elapsed().as_secs_f64();
    specialized_services_metrics::record_latency(duration);
    let response_size = serde_json::to_string(&response).map(|s| s.len() as f64).unwrap_or(0.0);
    specialized_services_metrics::record_response_size(response_size);

    Ok((StatusCode::OK, Json(response)))
}

async fn calculate_statistics(
    pool: &sqlx::PgPool,
    user_id: i32,
    status_filter: Option<&str>,
) -> Result<ServicesStatistics, sqlx::Error> {
    let status_condition = match status_filter {
        Some("active") => "AND s.is_active = true",
        Some("inactive") => "AND s.is_active = false",
        _ => "",
    };

    // ✅ CORRIGÉ: Requête simplifiée pour statistiques avec gestion du cas vide
    let sql = format!(
        r#"
        WITH all_services AS (
            SELECT s.id, s.is_active, s.specialized_type
            FROM services s
            WHERE s.user_id = $1 AND s.specialized_type IS NOT NULL {status_condition}
        ),
        type_counts AS (
            SELECT 
                specialized_type,
                COUNT(*)::bigint as count_by_type
            FROM all_services
            GROUP BY specialized_type
        ),
        stats_base AS (
            SELECT 
                (SELECT COUNT(*)::bigint FROM all_services) as total,
                (SELECT COUNT(*)::bigint FROM all_services WHERE is_active = true) as active,
                (SELECT COUNT(*)::bigint FROM all_services WHERE is_active = false) as inactive
        )
        SELECT 
            COALESCE((SELECT total FROM stats_base), 0::bigint) as total,
            COALESCE((SELECT active FROM stats_base), 0::bigint) as active,
            COALESCE((SELECT inactive FROM stats_base), 0::bigint) as inactive,
            CASE 
                WHEN EXISTS(SELECT 1 FROM type_counts) THEN
                    COALESCE(
                        (
                            SELECT jsonb_object_agg(
                                COALESCE(specialized_type, 'unknown'),
                                count_by_type
                            )
                            FROM type_counts
                        ),
                        '{{}}'::jsonb
                    )
                ELSE '{{}}'::jsonb
            END as by_type
        FROM stats_base
        LIMIT 1
        "#
    );

    let row = sqlx::query(&sql).bind(user_id).fetch_one(pool).await?;

    // ✅ CORRIGÉ: Gestion robuste du JSON avec fallback
    let by_type: serde_json::Value =
        row.try_get::<serde_json::Value, _>("by_type").unwrap_or_else(|_| json!({}));

    Ok(ServicesStatistics {
        total: row.get::<i64, _>("total"),
        active: row.get::<i64, _>("active"),
        inactive: row.get::<i64, _>("inactive"),
        by_type,
    })
}

// ✅ NOUVEAU Phase 3.2: Sauvegarde automatique de brouillons
#[derive(Debug, Deserialize)]
pub struct SaveDraftRequest {
    pub type_: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct DraftResponse {
    pub draft_id: i32,
    pub saved_at: chrono::DateTime<chrono::Utc>,
    pub message: String,
}

/// POST /api/specialized-services/drafts
/// Sauvegarde un brouillon de service spécialisé
pub async fn save_draft(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<SaveDraftRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[save_draft] Sauvegarde brouillon pour user_id={}, type={}",
        user_id, payload.type_
    );

    let pool = &state.pg;

    // Créer ou mettre à jour le brouillon
    let draft_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO specialized_services_drafts (user_id, type, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, type) 
        DO UPDATE SET 
            data = EXCLUDED.data,
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.type_)
    .bind(&payload.data)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[save_draft] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur sauvegarde brouillon: {}", e))
    })?;

    info!(
        "[save_draft] ✅ Brouillon sauvegardé: draft_id={}",
        draft_id
    );

    Ok((
        StatusCode::OK,
        Json(DraftResponse {
            draft_id,
            saved_at: chrono::Utc::now(),
            message: "Brouillon sauvegardé avec succès".to_string(),
        }),
    ))
}

/// GET /api/specialized-services/drafts
/// Récupère les brouillons de l'utilisateur
pub async fn get_drafts(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_drafts] Récupération brouillons pour user_id={}",
        user_id
    );

    let pool = &state.pg;

    #[derive(sqlx::FromRow, Serialize)]
    struct DraftRow {
        id: i32,
        #[serde(rename = "type")]
        type_: String,
        data: serde_json::Value,
        updated_at: chrono::DateTime<chrono::Utc>,
    }

    let drafts: Vec<DraftRow> = sqlx::query_as(
        r#"
        SELECT id, type, data, updated_at
        FROM specialized_services_drafts
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("[get_drafts] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur récupération brouillons: {}", e))
    })?;

    info!("[get_drafts] ✅ {} brouillons trouvés", drafts.len());

    Ok((StatusCode::OK, Json(json!({ "drafts": drafts }))))
}

// ✅ NOUVEAU Phase 3.4: Templates par type
#[derive(Debug, Serialize)]
pub struct ServiceTemplate {
    pub id: String,
    pub type_: String,
    pub name: String,
    pub description: String,
    pub data: serde_json::Value,
}

/// GET /api/specialized-services/templates
/// Retourne les templates disponibles par type
pub async fn get_templates(
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let type_filter = params.get("type");

    info!(
        "[get_templates] Récupération templates, type_filter={:?}",
        type_filter
    );

    // Templates prédéfinis (pourrait être stocké en DB plus tard)
    let mut templates = vec![
        ServiceTemplate {
            id: "pharmacie_standard".to_string(),
            type_: "pharmacie".to_string(),
            name: "Pharmacie Standard".to_string(),
            description: "Template de base pour une pharmacie".to_string(),
            data: json!({
                "nom": "Ma Pharmacie",
                "adresse": "",
                "telephone": "",
                "permanent_24h": false,
                "heures_ouverture": "08:00",
                "heures_fermeture": "20:00",
            }),
        },
        ServiceTemplate {
            id: "hopital_standard".to_string(),
            type_: "hopital".to_string(),
            name: "Hôpital Standard".to_string(),
            description: "Template de base pour un hôpital".to_string(),
            data: json!({
                "nom": "Mon Hôpital",
                "type_etablissement": "hopital",
                "urgences_disponible": true,
                "rdv_en_ligne": false,
            }),
        },
        ServiceTemplate {
            id: "covoiturage_standard".to_string(),
            type_: "covoiturage".to_string(),
            name: "Covoiturage Standard".to_string(),
            description: "Template de base pour un covoiturage".to_string(),
            data: json!({
                "depart": "",
                "destination": "",
                "nombre_places": 4,
                "prix_par_place": 0,
            }),
        },
    ];

    // Filtrer par type si demandé
    if let Some(type_filter) = type_filter {
        templates.retain(|t| t.type_ == *type_filter);
    }

    info!("[get_templates] ✅ {} templates retournés", templates.len());

    Ok((StatusCode::OK, Json(json!({ "templates": templates }))))
}

// ✅ NOUVEAU Phase 4.4: Historique de recherches
/// POST /api/specialized-services/search-history
/// Sauvegarde une recherche dans l'historique
pub async fn save_search_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let query = payload.get("query").and_then(|v| v.as_str()).unwrap_or("");
    let specialized_type = payload.get("specialized_type").and_then(|v| v.as_str());
    let filters = payload.get("filters");
    let results_count = payload.get("results_count").and_then(|v| v.as_i64()).unwrap_or(0);

    info!(
        "[save_search_history] Sauvegarde recherche pour user_id={}, query={}",
        user_id, query
    );

    let pool = &state.pg;

    sqlx::query(
        r#"
        INSERT INTO search_history (user_id, query, specialized_type, filters, results_count, searched_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, query, searched_at) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(query)
    .bind(specialized_type)
    .bind(filters)
    .bind(results_count)
    .execute(pool)
    .await
    .map_err(|e| {
        error!("[save_search_history] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur sauvegarde historique: {}", e))
    })?;

    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

/// GET /api/specialized-services/search-history
/// Récupère l'historique de recherches de l'utilisateur
pub async fn get_search_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(20);

    info!(
        "[get_search_history] Récupération historique pour user_id={}, limit={}",
        user_id, limit
    );

    let pool = &state.pg;

    #[derive(sqlx::FromRow, Serialize)]
    struct HistoryRow {
        id: i32,
        query: String,
        specialized_type: Option<String>,
        filters: Option<serde_json::Value>,
        results_count: i32,
        searched_at: chrono::DateTime<chrono::Utc>,
    }

    let history: Vec<HistoryRow> = sqlx::query_as(
        r#"
        SELECT id, query, specialized_type, filters, results_count, searched_at
        FROM search_history
        WHERE user_id = $1
        ORDER BY searched_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("[get_search_history] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur récupération historique: {}", e))
    })?;

    Ok((StatusCode::OK, Json(json!({ "history": history }))))
}

// ✅ NOUVEAU Phase 4.5: Recherches sauvegardées
#[derive(Debug, Deserialize)]
pub struct SaveSearchRequest {
    pub name: String,
    pub query: String,
    pub specialized_type: Option<String>,
    pub filters: Option<serde_json::Value>,
}

/// POST /api/specialized-services/saved-searches
/// Sauvegarde une recherche favorite
pub async fn save_search(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<SaveSearchRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[save_search] Sauvegarde recherche favorite pour user_id={}, name={}",
        user_id, payload.name
    );

    let pool = &state.pg;

    let saved_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO saved_searches (user_id, name, query, specialized_type, filters, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, name) 
        DO UPDATE SET 
            query = EXCLUDED.query,
            specialized_type = EXCLUDED.specialized_type,
            filters = EXCLUDED.filters,
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.name)
    .bind(&payload.query)
    .bind(&payload.specialized_type)
    .bind(&payload.filters)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[save_search] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur sauvegarde recherche: {}", e))
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "saved_search_id": saved_id
        })),
    ))
}

/// GET /api/specialized-services/saved-searches
/// Récupère les recherches sauvegardées de l'utilisateur
pub async fn get_saved_searches(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_saved_searches] Récupération recherches sauvegardées pour user_id={}",
        user_id
    );

    let pool = &state.pg;

    #[derive(sqlx::FromRow, Serialize)]
    struct SavedSearchRow {
        id: i32,
        name: String,
        query: String,
        specialized_type: Option<String>,
        filters: Option<serde_json::Value>,
        created_at: chrono::DateTime<chrono::Utc>,
        updated_at: chrono::DateTime<chrono::Utc>,
    }

    let saved: Vec<SavedSearchRow> = sqlx::query_as(
        r#"
        SELECT id, name, query, specialized_type, filters, created_at, updated_at
        FROM saved_searches
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("[get_saved_searches] Erreur DB: {}", e);
        AppError::Internal(format!(
            "Erreur récupération recherches sauvegardées: {}",
            e
        ))
    })?;

    Ok((StatusCode::OK, Json(json!({ "saved_searches": saved }))))
}

/// DELETE /api/specialized-services/saved-searches/{id}
/// Supprime une recherche sauvegardée
pub async fn delete_saved_search(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(search_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_saved_search] Suppression recherche sauvegardée id={} pour user_id={}",
        search_id, user_id
    );

    let pool = &state.pg;

    let deleted = sqlx::query(
        r#"
        DELETE FROM saved_searches
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(search_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| {
        error!("[delete_saved_search] Erreur DB: {}", e);
        AppError::Internal(format!("Erreur suppression recherche: {}", e))
    })?;

    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Recherche sauvegardée non trouvée".to_string(),
        ));
    }

    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

/// ✅ Phase 5.4: Endpoint pour statistiques détaillées avec métriques par type
/// Retourne des statistiques enrichies pour le dashboard
#[derive(Debug, Serialize)]
pub struct DetailedStatistics {
    pub total: i64,
    pub active: i64,
    pub inactive: i64,
    pub by_type: serde_json::Value, // { "pharmacie": { total: 5, active: 3, inactive: 2 }, ... }
    pub evolution: Vec<EvolutionPoint>, // Évolution sur les 30 derniers jours
    pub recent_activity: RecentActivity,
}

#[derive(Debug, Serialize)]
pub struct EvolutionPoint {
    pub date: String, // Format YYYY-MM-DD
    pub created: i64,
    pub activated: i64,
    pub deactivated: i64,
}

#[derive(Debug, Serialize)]
pub struct RecentActivity {
    pub last_7_days: i64,
    pub last_30_days: i64,
    pub this_month: i64,
}

pub async fn get_detailed_statistics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_detailed_statistics] Appelé pour user_id={}", user_id);

    let pool = &state.pg;

    // 1. Statistiques de base par type
    let mut by_type_stats: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();

    let service_types = vec![
        "pharmacie",
        "hopital",
        "laboratoire",
        "banque_sang",
        "agence_voyage",
        "covoiturage",
        "taxi",
    ];

    for service_type in service_types {
        let (total, active, inactive) = match service_type {
            "pharmacie" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM pharmacies p
                    INNER JOIN services s ON s.id = p.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "hopital" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM hopitaux_cliniques h
                    INNER JOIN services s ON s.id = h.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "laboratoire" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM laboratoires_imagerie l
                    INNER JOIN services s ON s.id = l.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "banque_sang" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM banques_sang b
                    INNER JOIN services s ON s.id = b.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "agence_voyage" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM agences_voyage a
                    INNER JOIN services s ON s.id = a.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "covoiturage" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM covoiturages c
                    INNER JOIN services s ON s.id = c.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            "taxi" => {
                let row = sqlx::query(
                    r#"
                    SELECT 
                        COUNT(*)::bigint as total,
                        COUNT(*) FILTER (WHERE s.is_active = true)::bigint as active,
                        COUNT(*) FILTER (WHERE s.is_active = false)::bigint as inactive
                    FROM taxis_ville t
                    INNER JOIN services s ON s.id = t.service_id
                    WHERE s.user_id = $1
                    "#,
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .ok();
                match row {
                    Some(r) => (
                        r.get::<i64, _>("total"),
                        r.get::<i64, _>("active"),
                        r.get::<i64, _>("inactive"),
                    ),
                    None => (0, 0, 0),
                }
            }
            _ => (0, 0, 0),
        };

        if total > 0 {
            by_type_stats.insert(
                service_type.to_string(),
                json!({
                    "total": total,
                    "active": active,
                    "inactive": inactive,
                }),
            );
        }
    }

    // 2. Évolution sur les 30 derniers jours
    let mut evolution = Vec::new();
    for i in 0..30 {
        let date = chrono::Utc::now() - chrono::Duration::days(i);
        let date_str = date.format("%Y-%m-%d").to_string();

        // Compter créations ce jour
        let created: i64 = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)::bigint
            FROM (
                SELECT p.created_at::date FROM pharmacies p INNER JOIN services s ON s.id = p.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT h.created_at::date FROM hopitaux_cliniques h INNER JOIN services s ON s.id = h.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT l.created_at::date FROM laboratoires_imagerie l INNER JOIN services s ON s.id = l.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT b.created_at::date FROM banques_sang b INNER JOIN services s ON s.id = b.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT a.created_at::date FROM agences_voyage a INNER JOIN services s ON s.id = a.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT c.created_at::date FROM covoiturages c INNER JOIN services s ON s.id = c.service_id WHERE s.user_id = $1
                UNION ALL
                SELECT t.created_at::date FROM taxis_ville t INNER JOIN services s ON s.id = t.service_id WHERE s.user_id = $1
            ) all_services
            WHERE created_at::date = $2::date
            "#
        )
        .bind(user_id)
        .bind(&date_str)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        // Pour simplifier, on met activated et deactivated à 0 (peut être amélioré avec une table d'historique)
        evolution.push(EvolutionPoint {
            date: date_str,
            created,
            activated: 0,
            deactivated: 0,
        });
    }
    evolution.reverse(); // Plus ancien au plus récent

    // 3. Activité récente
    let last_7_days: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM (
            SELECT p.created_at FROM pharmacies p INNER JOIN services s ON s.id = p.service_id WHERE s.user_id = $1 AND p.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT h.created_at FROM hopitaux_cliniques h INNER JOIN services s ON s.id = h.service_id WHERE s.user_id = $1 AND h.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT l.created_at FROM laboratoires_imagerie l INNER JOIN services s ON s.id = l.service_id WHERE s.user_id = $1 AND l.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT b.created_at FROM banques_sang b INNER JOIN services s ON s.id = b.service_id WHERE s.user_id = $1 AND b.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT a.created_at FROM agences_voyage a INNER JOIN services s ON s.id = a.service_id WHERE s.user_id = $1 AND a.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT c.created_at FROM covoiturages c INNER JOIN services s ON s.id = c.service_id WHERE s.user_id = $1 AND c.created_at >= NOW() - INTERVAL '7 days'
            UNION ALL
            SELECT t.created_at FROM taxis_ville t INNER JOIN services s ON s.id = t.service_id WHERE s.user_id = $1 AND t.created_at >= NOW() - INTERVAL '7 days'
        ) all_services
        "#
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let last_30_days: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM (
            SELECT p.created_at FROM pharmacies p INNER JOIN services s ON s.id = p.service_id WHERE s.user_id = $1 AND p.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT h.created_at FROM hopitaux_cliniques h INNER JOIN services s ON s.id = h.service_id WHERE s.user_id = $1 AND h.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT l.created_at FROM laboratoires_imagerie l INNER JOIN services s ON s.id = l.service_id WHERE s.user_id = $1 AND l.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT b.created_at FROM banques_sang b INNER JOIN services s ON s.id = b.service_id WHERE s.user_id = $1 AND b.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT a.created_at FROM agences_voyage a INNER JOIN services s ON s.id = a.service_id WHERE s.user_id = $1 AND a.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT c.created_at FROM covoiturages c INNER JOIN services s ON s.id = c.service_id WHERE s.user_id = $1 AND c.created_at >= NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT t.created_at FROM taxis_ville t INNER JOIN services s ON s.id = t.service_id WHERE s.user_id = $1 AND t.created_at >= NOW() - INTERVAL '30 days'
        ) all_services
        "#
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let this_month: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM (
            SELECT p.created_at FROM pharmacies p INNER JOIN services s ON s.id = p.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT h.created_at FROM hopitaux_cliniques h INNER JOIN services s ON s.id = h.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', h.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT l.created_at FROM laboratoires_imagerie l INNER JOIN services s ON s.id = l.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', l.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT b.created_at FROM banques_sang b INNER JOIN services s ON s.id = b.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', b.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT a.created_at FROM agences_voyage a INNER JOIN services s ON s.id = a.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT c.created_at FROM covoiturages c INNER JOIN services s ON s.id = c.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', NOW())
            UNION ALL
            SELECT t.created_at FROM taxis_ville t INNER JOIN services s ON s.id = t.service_id WHERE s.user_id = $1 AND DATE_TRUNC('month', t.created_at) = DATE_TRUNC('month', NOW())
        ) all_services
        "#
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // 4. Calculer total, active, inactive
    let total: i64 = by_type_stats
        .values()
        .map(|v| v.get("total").and_then(|t| t.as_i64()).unwrap_or(0))
        .sum();

    let active: i64 = by_type_stats
        .values()
        .map(|v| v.get("active").and_then(|a| a.as_i64()).unwrap_or(0))
        .sum();

    let inactive: i64 = by_type_stats
        .values()
        .map(|v| v.get("inactive").and_then(|i| i.as_i64()).unwrap_or(0))
        .sum();

    let detailed_stats = DetailedStatistics {
        total,
        active,
        inactive,
        by_type: json!(by_type_stats),
        evolution,
        recent_activity: RecentActivity {
            last_7_days,
            last_30_days,
            this_month,
        },
    };

    info!(
        "[get_detailed_statistics] ✅ Statistiques calculées: total={}, active={}, inactive={}",
        total, active, inactive
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": detailed_stats
        })),
    ))
}

/// ✅ Phase 5.5: Endpoint pour actions batch (activer/désactiver/supprimer plusieurs services)
#[derive(Debug, Deserialize)]
pub struct BatchActionRequest {
    pub service_ids: Vec<i32>, // Liste des service_id (pas les id spécialisés)
    pub action: String,        // "activate", "deactivate", "delete"
}

#[derive(Debug, Serialize)]
pub struct BatchActionResponse {
    pub success: bool,
    pub processed: i64,
    pub failed: i64,
    pub errors: Vec<String>,
}

pub async fn batch_action(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<BatchActionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[batch_action] Action={}, {} services pour user_id={}",
        payload.action,
        payload.service_ids.len(),
        user_id
    );

    if payload.service_ids.is_empty() {
        return Err(AppError::BadRequest(
            "Aucun service sélectionné".to_string(),
        ));
    }

    let pool = &state.pg;
    #[allow(unused_assignments)]
    let mut processed = 0;
    #[allow(unused_assignments)]
    let mut failed = 0;
    let errors = Vec::new();

    match payload.action.as_str() {
        "activate" => {
            // Activer tous les services sélectionnés
            let result = sqlx::query(
                r#"
                UPDATE services
                SET is_active = true, updated_at = NOW()
                WHERE id = ANY($1::int[])
                  AND user_id = $2
                  AND specialized_type IS NOT NULL
                "#,
            )
            .bind(&payload.service_ids)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!("[batch_action] Erreur activation: {}", e);
                AppError::Internal(format!("Erreur activation batch: {}", e))
            })?;

            processed = result.rows_affected() as i64;
            failed = payload.service_ids.len() as i64 - processed;
        }
        "deactivate" => {
            // Désactiver tous les services sélectionnés
            let result = sqlx::query(
                r#"
                UPDATE services
                SET is_active = false, updated_at = NOW()
                WHERE id = ANY($1::int[])
                  AND user_id = $2
                  AND specialized_type IS NOT NULL
                "#,
            )
            .bind(&payload.service_ids)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!("[batch_action] Erreur désactivation: {}", e);
                AppError::Internal(format!("Erreur désactivation batch: {}", e))
            })?;

            processed = result.rows_affected() as i64;
            failed = payload.service_ids.len() as i64 - processed;
        }
        "delete" => {
            // Supprimer tous les services sélectionnés (cascade supprimera les entrées spécialisées)
            let result = sqlx::query(
                r#"
                DELETE FROM services
                WHERE id = ANY($1::int[])
                  AND user_id = $2
                  AND specialized_type IS NOT NULL
                "#,
            )
            .bind(&payload.service_ids)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!("[batch_action] Erreur suppression: {}", e);
                AppError::Internal(format!("Erreur suppression batch: {}", e))
            })?;

            processed = result.rows_affected() as i64;
            failed = payload.service_ids.len() as i64 - processed;
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Action invalide: {}. Actions valides: activate, deactivate, delete",
                payload.action
            )));
        }
    }

    // Invalider le cache pour cet utilisateur
    let cache = SpecializedServicesCache::new(state.clone());
    let _ = cache.invalidate_user_cache(user_id).await;

    info!(
        "[batch_action] ✅ Action={} terminée: {} traités, {} échoués",
        payload.action, processed, failed
    );

    Ok((
        StatusCode::OK,
        Json(BatchActionResponse {
            success: true,
            processed,
            failed,
            errors,
        }),
    ))
}

/// ✅ Phase 6.3: Endpoint pour synchronisation batch
/// Permet de synchroniser plusieurs actions en une seule requête
#[derive(Debug, Deserialize)]
pub struct SyncRequest {
    pub actions: Vec<SyncAction>,
}

#[derive(Debug, Deserialize)]
pub struct SyncAction {
    pub action: String, // "create", "update", "delete", "toggle_status"
    pub service_id: Option<i32>,
    pub data: Option<serde_json::Value>,
    pub local_updated_at: Option<chrono::DateTime<chrono::Utc>>, // ✅ Phase 6.4: Timestamp local pour détection conflit
}

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub success: bool,
    pub processed: i64,
    pub failed: i64,
    pub results: Vec<SyncActionResult>,
}

#[derive(Debug, Serialize)]
pub struct SyncActionResult {
    pub action_id: String,
    pub success: bool,
    pub error: Option<String>,
}

pub async fn sync_services(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<SyncRequest>,
) -> AppResult<impl IntoResponse> {
    let conflict_service = ConflictResolutionService::new(Arc::new(state.pg.clone()));
    info!(
        "[sync_services] Synchronisation de {} actions pour user_id={}",
        payload.actions.len(),
        user_id
    );

    let pool = &state.pg;
    let mut processed = 0;
    let mut failed = 0;
    let mut results = Vec::new();

    for (index, action) in payload.actions.iter().enumerate() {
        let action_id = format!("action_{}", index);
        let mut success = false;
        let mut error_msg: Option<String> = None;

        match action.action.as_str() {
            "update" => {
                if let Some(service_id) = action.service_id {
                    if let Some(data) = &action.data {
                        // ✅ Phase 6.4: Détecter conflit si timestamp local fourni
                        if let Some(local_updated_at) = action.local_updated_at {
                            match conflict_service
                                .detect_conflict(service_id, local_updated_at)
                                .await
                            {
                                Ok(Some(conflict)) => {
                                    // Conflit détecté
                                    failed += 1;
                                    // Ajouter les infos de conflit dans la réponse
                                    results.push(SyncActionResult {
                                        action_id: format!("{}_conflict", action_id),
                                        success: false,
                                        error: Some(
                                            json!({
                                                "conflict": true,
                                                "conflict_type": "timestamp_mismatch",
                                                "server_updated_at": conflict.server_updated_at,
                                                "local_updated_at": conflict.local_updated_at,
                                            })
                                            .to_string(),
                                        ),
                                    });
                                    continue;
                                }
                                Ok(None) => {
                                    // Pas de conflit, continuer
                                }
                                Err(e) => {
                                    warn!("[sync_services] Erreur détection conflit: {}", e);
                                    // Continuer quand même
                                }
                            }
                        }

                        // Mettre à jour le service selon son type
                        // Pour simplifier, on utilise l'endpoint batch existant
                        let result = sqlx::query(
                            r#"
                            UPDATE services
                            SET is_active = COALESCE(($1->>'is_active')::boolean, is_active),
                                updated_at = NOW()
                            WHERE id = $2 AND user_id = $3
                            "#,
                        )
                        .bind(data)
                        .bind(service_id)
                        .bind(user_id)
                        .execute(pool)
                        .await;

                        match result {
                            Ok(r) => {
                                if r.rows_affected() > 0 {
                                    success = true;
                                    processed += 1;
                                } else {
                                    error_msg =
                                        Some("Service non trouvé ou non autorisé".to_string());
                                    failed += 1;
                                }
                            }
                            Err(e) => {
                                error_msg = Some(format!("Erreur DB: {}", e));
                                failed += 1;
                            }
                        }
                    } else {
                        error_msg = Some("Données manquantes pour update".to_string());
                        failed += 1;
                    }
                } else {
                    error_msg = Some("service_id manquant".to_string());
                    failed += 1;
                }
            }
            "delete" => {
                if let Some(service_id) = action.service_id {
                    let result = sqlx::query(
                        r#"
                        DELETE FROM services
                        WHERE id = $1 AND user_id = $2 AND specialized_type IS NOT NULL
                        "#,
                    )
                    .bind(service_id)
                    .bind(user_id)
                    .execute(pool)
                    .await;

                    match result {
                        Ok(r) => {
                            if r.rows_affected() > 0 {
                                success = true;
                                processed += 1;
                            } else {
                                error_msg = Some("Service non trouvé ou non autorisé".to_string());
                                failed += 1;
                            }
                        }
                        Err(e) => {
                            error_msg = Some(format!("Erreur DB: {}", e));
                            failed += 1;
                        }
                    }
                } else {
                    error_msg = Some("service_id manquant".to_string());
                    failed += 1;
                }
            }
            "toggle_status" => {
                if let Some(service_id) = action.service_id {
                    if let Some(data) = &action.data {
                        let is_active =
                            data.get("is_active").and_then(|v| v.as_bool()).unwrap_or(false);

                        let result = sqlx::query(
                            r#"
                            UPDATE services
                            SET is_active = $1, updated_at = NOW()
                            WHERE id = $2 AND user_id = $3
                            "#,
                        )
                        .bind(is_active)
                        .bind(service_id)
                        .bind(user_id)
                        .execute(pool)
                        .await;

                        match result {
                            Ok(r) => {
                                if r.rows_affected() > 0 {
                                    success = true;
                                    processed += 1;
                                } else {
                                    error_msg =
                                        Some("Service non trouvé ou non autorisé".to_string());
                                    failed += 1;
                                }
                            }
                            Err(e) => {
                                error_msg = Some(format!("Erreur DB: {}", e));
                                failed += 1;
                            }
                        }
                    } else {
                        error_msg = Some("Données manquantes pour toggle_status".to_string());
                        failed += 1;
                    }
                } else {
                    error_msg = Some("service_id manquant".to_string());
                    failed += 1;
                }
            }
            _ => {
                error_msg = Some(format!("Action non supportée: {}", action.action));
                failed += 1;
            }
        }

        results.push(SyncActionResult {
            action_id,
            success,
            error: error_msg,
        });
    }

    // Invalider le cache
    let cache = SpecializedServicesCache::new(state.clone());
    let _ = cache.invalidate_user_cache(user_id).await;

    info!(
        "[sync_services] ✅ Synchronisation terminée: {} traités, {} échoués",
        processed, failed
    );

    Ok((
        StatusCode::OK,
        Json(SyncResponse {
            success: failed == 0,
            processed,
            failed,
            results,
        }),
    ))
}

/// ✅ Phase 6.4: Endpoint pour résoudre un conflit
#[derive(Debug, Deserialize)]
pub struct ResolveConflictRequest {
    pub service_id: i32,
    pub resolution: String, // "use_local", "use_server", "merge", "cancel"
    pub local_data: Option<serde_json::Value>,
}

#[axum::debug_handler]
pub async fn resolve_conflict(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ResolveConflictRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[resolve_conflict] Résolution conflit service_id={}, résolution={} pour user_id={}",
        payload.service_id, payload.resolution, user_id
    );

    let conflict_service = ConflictResolutionService::new(Arc::new(state.pg.clone()));

    // Récupérer le timestamp local depuis les données
    let local_updated_at = payload
        .local_data
        .as_ref()
        .and_then(|d| d.get("updated_at"))
        .and_then(|v| {
            v.as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc))
        })
        .unwrap_or_else(|| chrono::Utc::now() - chrono::Duration::hours(1));

    // Détecter le conflit
    let conflict =
        match conflict_service.detect_conflict(payload.service_id, local_updated_at).await {
            Ok(Some(c)) => c,
            Ok(None) => {
                return Ok((
                    StatusCode::OK,
                    Json(json!({
                        "success": true,
                        "message": "Aucun conflit détecté"
                    })),
                ));
            }
            Err(e) => {
                error!("[resolve_conflict] Erreur détection: {}", e);
                return Err(AppError::Internal(format!(
                    "Erreur détection conflit: {}",
                    e
                )));
            }
        };

    // Résoudre selon la stratégie choisie
    let resolution = match payload.resolution.as_str() {
        "use_local" => ConflictResolution::UseLocal,
        "use_server" => ConflictResolution::UseServer,
        "merge" => ConflictResolution::Merge,
        "cancel" => ConflictResolution::Cancel,
        _ => {
            return Err(AppError::BadRequest(format!(
                "Résolution invalide: {}. Valeurs valides: use_local, use_server, merge, cancel",
                payload.resolution
            )));
        }
    };

    match conflict_service.resolve_conflict(conflict, resolution, user_id).await {
        Ok(success) => {
            if success {
                // Invalider le cache
                let cache = SpecializedServicesCache::new(Arc::clone(&state));
                let _ = cache.invalidate_user_cache(user_id).await;

                Ok((
                    StatusCode::OK,
                    Json(json!({
                        "success": true,
                        "message": "Conflit résolu avec succès"
                    })),
                ))
            } else {
                Ok((
                    StatusCode::OK,
                    Json(json!({
                        "success": true,
                        "message": "Modification annulée"
                    })),
                ))
            }
        }
        Err(e) => {
            error!("[resolve_conflict] Erreur résolution: {}", e);
            Err(AppError::Internal(format!(
                "Erreur résolution conflit: {}",
                e
            )))
        }
    }
}
