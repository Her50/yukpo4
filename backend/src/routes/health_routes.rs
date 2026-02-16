// ✅ Phase 10 - Routes de santé et vérification des services
// Vérifie automatiquement le support Google Maps Distance Matrix API

use axum::extract::Extension;
use axum::{extract::State, response::IntoResponse, Json, Router};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

pub fn health_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/health/google-maps",
            axum::routing::get(check_google_maps_support),
        )
        .route("/health/cache", axum::routing::get(check_cache_status))
        .route("/health/redis", axum::routing::get(check_redis_direct))
        .route(
            "/health/geographic-matching",
            axum::routing::get(check_geographic_matching),
        )
        .route("/health/version", axum::routing::get(check_version))
        .route(
            "/health/diagnostic",
            axum::routing::get(check_diagnostic)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .with_state(state)
}

/// ✅ Phase 10 - Vérifie automatiquement le support Google Maps Distance Matrix API
async fn check_google_maps_support(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY").ok();

    let has_api_key = api_key.is_some() && !api_key.as_ref().unwrap().is_empty();

    // Test avec des coordonnées de test (Yaoundé, Cameroun)
    let test_origin = (3.8480, 11.5021); // Yaoundé
    let test_destination = (4.0511, 9.7679); // Douala

    let mut test_result: Option<Value> = None;
    let mut test_error: Option<String> = None;

    if has_api_key {
        // Tester une requête réelle
        match test_google_maps_distance_matrix(test_origin, test_destination).await {
            Ok(result) => {
                test_result = Some(json!({
                    "distance_meters": result.distance_meters,
                    "duration_seconds": result.duration_seconds,
                    "source": "GoogleMaps"
                }));
            }
            Err(e) => {
                test_error = Some(format!("Erreur test: {}", e));
            }
        }
    }

    Json(json!({
        "google_maps_api_key_configured": has_api_key,
        "api_key_present": has_api_key,
        "test_result": test_result,
        "test_error": test_error,
        "status": if has_api_key && test_result.is_some() {
            "available"
        } else if has_api_key {
            "configured_but_test_failed"
        } else {
            "not_configured"
        },
        "fallback": "Haversine distance calculation",
        "message": if has_api_key && test_result.is_some() {
            "✅ Google Maps Distance Matrix API est disponible et fonctionne"
        } else if has_api_key {
            "⚠️ Google Maps API Key configurée mais le test a échoué. Utilisation de Haversine en fallback."
        } else {
            "ℹ️ Google Maps API Key non configurée. Utilisation de Haversine pour les calculs de distance."
        }
    }))
}

/// Teste une requête Google Maps Distance Matrix
async fn test_google_maps_distance_matrix(
    origin: (f64, f64),
    destination: (f64, f64),
) -> Result<DistanceTestResult, String> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| "GOOGLE_MAPS_API_KEY non configurée".to_string())?;

    let url = format!(
        "https://maps.googleapis.com/maps/api/distancematrix/json?origins={},{}&destinations={},{}&key={}&units=metric&language=fr",
        origin.0, origin.1, destination.0, destination.1, api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Erreur requête: {}", e))?;

    let data: Value = response.json().await.map_err(|e| format!("Erreur parsing: {}", e))?;

    // Parser la réponse
    if let Some(rows) = data.get("rows").and_then(|r| r.as_array()) {
        if let Some(row) = rows.first() {
            if let Some(elements) = row.get("elements").and_then(|e| e.as_array()) {
                if let Some(element) = elements.first() {
                    if let Some(status) = element.get("status").and_then(|s| s.as_str()) {
                        if status == "OK" {
                            let distance_meters = element
                                .get("distance")
                                .and_then(|d| d.get("value"))
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0);

                            let duration_seconds = element
                                .get("duration")
                                .and_then(|d| d.get("value"))
                                .and_then(|v| v.as_f64());

                            return Ok(DistanceTestResult {
                                distance_meters,
                                duration_seconds,
                            });
                        } else {
                            return Err(format!("Status Google Maps: {}", status));
                        }
                    }
                }
            }
        }
    }

    Err("Réponse Google Maps invalide".to_string())
}

struct DistanceTestResult {
    distance_meters: f64,
    duration_seconds: Option<f64>,
}

/// Vérifie le statut du cache Redis
async fn check_cache_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let test_key = "health:cache:test";
    let test_value = json!({"test": true, "timestamp": chrono::Utc::now()});

    // Tester l'écriture
    let write_ok = state.cache_service.set(test_key, &test_value).await.is_ok();

    // Tester la lecture
    let read_result = state.cache_service.get::<Value>(test_key).await;
    let read_ok = read_result.is_ok() && read_result.unwrap().is_some();

    // Nettoyer
    let _ = state.cache_service.delete(test_key).await;

    Json(json!({
        "redis_configured": true,
        "write_test": write_ok,
        "read_test": read_ok,
        "status": if write_ok && read_ok {
            "operational"
        } else {
            "degraded"
        },
        "message": if write_ok && read_ok {
            "✅ Cache Redis opérationnel"
        } else {
            "⚠️ Cache Redis en mode dégradé"
        }
    }))
}

/// ✅ NOUVEAU: Vérifie directement Redis avec PING et opérations de base
/// ✅ CORRIGÉ 2026-01-15: Gestion d'erreur robuste pour éviter les 404 sur AWS/Render
async fn check_redis_direct(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    use crate::utils::redis_helper;
    use std::time::Instant;

    // ✅ CORRIGÉ: Gestion d'erreur robuste à chaque étape pour éviter les panics
    // Les panics peuvent causer des 404 dans certains environnements (AWS/Render)
    let start_time = Instant::now();

    // Test 1: PING Redis avec gestion d'erreur robuste
    let (ping_ok, ping_error) =
        redis_helper::check_redis_health_with_error(&state.redis_client).await;
    let connection_time_ms = start_time.elapsed().as_millis() as u64;

    // Test 2: Test d'écriture/lecture avec gestion d'erreur gracieuse
    let test_key = "health:redis:direct:test";
    let test_value = format!("test_{}", chrono::Utc::now().timestamp());

    let write_ok = redis_helper::set_with_retry(
        &state.redis_client,
        test_key,
        &test_value,
        Some(10), // TTL 10 secondes
    )
    .await
    .is_ok();

    let read_ok = if write_ok {
        match redis_helper::get_with_retry(&state.redis_client, test_key).await {
            Ok(Some(value)) => value == test_value,
            _ => false,
        }
    } else {
        false
    };

    // Test 3: Nettoyage (ignore les erreurs)
    let _ = redis_helper::delete_with_retry(&state.redis_client, test_key).await;

    // Test 4: Test du pool Redis si disponible avec gestion d'erreur
    let pool_ok = if let Some(ref pool) = state.redis_pool {
        match pool.get().await {
            Ok(mut conn) => {
                // Utiliser AsyncCommands pour PING
                use deadpool_redis::redis::AsyncCommands;
                match conn.get::<_, Option<String>>("__health_check_pool__").await {
                    Ok(_) => true,
                    Err(_) => {
                        // Si get échoue, essayer de set/get pour vérifier la connexion
                        match conn.set::<_, _, String>("__health_check_pool__", "ok").await {
                            Ok(_) => {
                                let _ = conn.del::<_, i32>("__health_check_pool__").await;
                                true
                            }
                            Err(_) => false,
                        }
                    }
                }
            }
            Err(_) => false,
        }
    } else {
        false
    };

    let status = if ping_ok && write_ok && read_ok {
        "operational"
    } else if ping_ok {
        "degraded"
    } else {
        "unavailable"
    };

    let message = if ping_ok && write_ok && read_ok {
        format!("✅ Redis opérationnel ({} ms)", connection_time_ms)
    } else if ping_ok {
        "⚠️ Redis répond au PING mais opérations en échec".to_string()
    } else {
        format!(
            "❌ Redis non accessible: {}",
            ping_error.clone().unwrap_or_else(|| "Erreur inconnue".to_string())
        )
    };

    // ✅ CORRIGÉ: Toujours retourner une réponse valide (pas de 404)
    Json(json!({
        "status": status,
        "message": message,
        "ping_test": ping_ok,
        "write_test": write_ok,
        "read_test": read_ok,
        "pool_test": pool_ok,
        "connection_time_ms": connection_time_ms,
        "error": if !ping_ok { ping_error } else { None },
        "redis_url_configured": std::env::var("REDIS_URL").is_ok(),
        "pool_available": state.redis_pool.is_some(),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Vérifie le service de matching géographique
async fn check_geographic_matching(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    // Le service est initialisé dans AppState
    Json(json!({
        "geographic_matching_service": "initialized",
        "features": {
            "cache_enabled": true,
            "google_maps_support": std::env::var("GOOGLE_MAPS_API_KEY").ok().is_some(),
            "haversine_fallback": true
        },
        "message": "✅ Service de matching géographique initialisé"
    }))
}

/// ✅ NOUVEAU: Retourne les informations de version de l'application
async fn check_version(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    use crate::utils::version::VersionInfo;
    Json(serde_json::to_value(VersionInfo::new()).unwrap_or(json!({
        "version": "unknown",
        "app_name": "yukpomnang_backend",
        "error": "Impossible de récupérer les informations de version"
    })))
}

/// Middleware JWT optionnel pour la route de diagnostic
/// Si le JWT est fourni et valide, l'utilisateur sera disponible dans Extension
/// Sinon, la route continuera sans utilisateur authentifié
async fn optional_jwt_auth(
    mut req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    use crate::utils::jwt_manager::decode_jwt;
    use std::env;

    // Essayer d'extraire le JWT
    let auth_header = req.headers().get("Authorization").and_then(|v| v.to_str().ok());

    if let Some(auth_header) = auth_header {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            // Essayer de décoder le JWT
            if let Ok(secret) = env::var("JWT_SECRET") {
                if let Ok(token_data) = decode_jwt(token, &secret) {
                    let authenticated_user = AuthenticatedUser {
                        id: token_data.claims.sub,
                        role: token_data.claims.role,
                    };
                    // Ajouter l'utilisateur aux extensions si JWT valide
                    req.extensions_mut().insert(Some(authenticated_user));
                    return next.run(req).await;
                }
            }
        }
    }

    // Si pas de JWT ou JWT invalide, continuer sans utilisateur
    req.extensions_mut().insert(None::<AuthenticatedUser>);
    next.run(req).await
}

/// ✅ NOUVEAU: Diagnostic complet - Vérifie Redis et statut du compte utilisateur
async fn check_diagnostic(
    State(state): State<Arc<AppState>>,
    Extension(user_opt): Extension<Option<AuthenticatedUser>>,
) -> impl IntoResponse {
    use crate::utils::redis_helper;
    use std::time::Instant;

    let start_time = Instant::now();

    // ========== PARTIE 0: Vérification PostgreSQL ==========
    let (pg_ok, pg_error, pg_query_time_ms) = {
        let pg_start = Instant::now();
        match sqlx::query("SELECT 1 as test").fetch_one(&state.pg).await {
            Ok(_) => {
                let query_time = pg_start.elapsed().as_millis() as u64;
                (true, None, query_time)
            }
            Err(e) => {
                let query_time = pg_start.elapsed().as_millis() as u64;
                (false, Some(format!("{}", e)), query_time)
            }
        }
    };

    let pg_status = if pg_ok { "operational" } else { "unavailable" };

    // ========== PARTIE 1: Vérification Redis ==========
    let (redis_ping_ok, redis_error) =
        redis_helper::check_redis_health_with_error(&state.redis_client).await;

    // Test d'écriture/lecture Redis
    let test_key = "health:diagnostic:test";
    let test_value = format!("diagnostic_{}", chrono::Utc::now().timestamp());

    let redis_write_ok =
        redis_helper::set_with_retry(&state.redis_client, test_key, &test_value, Some(10))
            .await
            .is_ok();

    let redis_read_ok = if redis_write_ok {
        match redis_helper::get_with_retry(&state.redis_client, test_key).await {
            Ok(Some(value)) => value == test_value,
            _ => false,
        }
    } else {
        false
    };

    let _ = redis_helper::delete_with_retry(&state.redis_client, test_key).await;

    let redis_status = if redis_ping_ok && redis_write_ok && redis_read_ok {
        "operational"
    } else if redis_ping_ok {
        "degraded"
    } else {
        "unavailable"
    };

    // ========== PARTIE 2: Vérification compte utilisateur ==========
    let mut account_status: Value = json!({
        "authenticated": false,
        "message": "Token JWT non fourni ou invalide (fournissez un header Authorization: Bearer <token> pour vérifier votre compte)"
    });

    if let Some(authenticated_user) = user_opt {
        match check_user_account_status(&state, authenticated_user.id).await {
            Ok(status) => {
                account_status = json!({
                    "authenticated": true,
                    "user_id": authenticated_user.id,
                    "user_exists": status.user_exists,
                    "account_active": status.account_active,
                    "tokens_balance": status.tokens_balance,
                    "services_total": status.services_total,
                    "services_active": status.services_active,
                    "services_inactive": status.services_inactive,
                    "message": if status.account_active {
                        format!("✅ Compte actif ({} services actifs)", status.services_active)
                    } else {
                        format!("⚠️ Compte existe mais {} services inactifs", status.services_inactive)
                    }
                });
            }
            Err(e) => {
                account_status = json!({
                    "authenticated": true,
                    "user_id": authenticated_user.id,
                    "error": format!("Erreur lors de la vérification: {}", e),
                    "message": "❌ Erreur lors de la vérification du compte"
                });
            }
        }
    }

    let total_time_ms = start_time.elapsed().as_millis() as u64;

    Json(json!({
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "diagnostic_time_ms": total_time_ms,
        "database": {
            "status": pg_status,
            "connection_test": pg_ok,
            "query_time_ms": pg_query_time_ms,
            "error": pg_error,
            "database_url_configured": std::env::var("DATABASE_URL").is_ok(),
            "message": if pg_ok {
                format!("✅ PostgreSQL opérationnel ({} ms)", pg_query_time_ms)
            } else {
                format!("❌ PostgreSQL non accessible: {}", pg_error.as_ref().map(|e| e.as_str()).unwrap_or("Erreur inconnue"))
            }
        },
        "redis": {
            "status": redis_status,
            "ping_test": redis_ping_ok,
            "write_test": redis_write_ok,
            "read_test": redis_read_ok,
            "error": if !redis_ping_ok { redis_error.clone() } else { None },
            "redis_url_configured": std::env::var("REDIS_URL").is_ok(),
            "message": if redis_ping_ok && redis_write_ok && redis_read_ok {
                "✅ Redis opérationnel".to_string()
            } else if redis_ping_ok {
                "⚠️ Redis répond mais opérations en échec".to_string()
            } else {
                format!("❌ Redis non accessible: {}", redis_error.as_ref().map(|e| e.as_str()).unwrap_or("Erreur inconnue"))
            }
        },
        "account": account_status,
        "summary": {
            "database_ok": pg_status == "operational",
            "redis_ok": redis_status == "operational",
            "account_ok": account_status.get("account_active").and_then(|v| v.as_bool()).unwrap_or(false),
            "overall_status": if pg_status == "operational" && redis_status == "operational" && account_status.get("account_active").and_then(|v| v.as_bool()).unwrap_or(false) {
                "✅ Tout fonctionne correctement"
            } else if pg_status == "operational" && redis_status == "operational" {
                "⚠️ Base de données et Redis OK mais compte à vérifier"
            } else if pg_status == "operational" {
                "⚠️ PostgreSQL OK mais Redis non accessible"
            } else {
                "❌ Problème détecté (voir détails ci-dessus)"
            }
        }
    }))
}

/// Structure pour le statut du compte utilisateur
struct UserAccountStatus {
    user_exists: bool,
    account_active: bool,
    tokens_balance: i64,
    services_total: i32,
    services_active: i32,
    services_inactive: i32,
}

/// Vérifie le statut d'un compte utilisateur dans la base de données
async fn check_user_account_status(
    state: &AppState,
    user_id: i32,
) -> Result<UserAccountStatus, sqlx::Error> {
    // Vérifier si l'utilisateur existe
    #[derive(sqlx::FromRow)]
    struct UserRow {
        tokens_balance: i64,
    }

    let user = sqlx::query_as::<_, UserRow>("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await?;

    let (user_exists, tokens_balance) = if let Some(u) = user {
        (true, u.tokens_balance)
    } else {
        (false, 0)
    };

    // Compter les services
    #[derive(sqlx::FromRow)]
    struct ServiceCountRow {
        total: i64,
        active: i64,
        inactive: i64,
    }

    let counts = sqlx::query_as::<_, ServiceCountRow>(
        r#"
        SELECT 
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE is_active = TRUE)::bigint as active,
            COUNT(*) FILTER (WHERE is_active = FALSE)::bigint as inactive
        FROM services
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await?;

    Ok(UserAccountStatus {
        user_exists,
        account_active: user_exists && counts.active > 0, // Compte actif si au moins un service actif
        tokens_balance,
        services_total: counts.total as i32,
        services_active: counts.active as i32,
        services_inactive: counts.inactive as i32,
    })
}
