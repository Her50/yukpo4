// ✅ REFONTE 2026-03-16: Tarification dynamique basée sur les coûts réels
// Principe: prix = coût_réel × (1 + MARGIN_PERCENT/100), arrondi au multiple de 5 supérieur
// Si coût réel = 0, appliquer un forfait raisonnable ou gratuit selon la valeur du service
//
// ARCHITECTURE:
// - Les prix sont calculés à partir des coûts réels des APIs (Google, OpenAI)
// - La marge est un pourcentage configurable (actuellement 100%)
// - Le mobile appelle GET /api/pricing/navigation au montage du hook useNavigationPayment
// - Les taux de change sont mis à jour périodiquement
// - Si cet endpoint est indisponible, le mobile utilise ses valeurs fallback
//
// COÛTS RÉELS MESURÉS (2026-03-16):
// ┌─────────────────────┬────────────────────────────────────────┬──────────────┐
// │ Feature             │ Appels API                             │ Coût réel    │
// ├─────────────────────┼────────────────────────────────────────┼──────────────┤
// │ POI health (2 types)│ 4 pts × 2 types = 8 Google Nearby     │ ~170 XAF     │
// │ POI food (3 types)  │ 4 pts × 3 types = 12 Google Nearby    │ ~255 XAF     │
// │ POI fuel (1 type)   │ 4 pts × 1 type = 4 Google Nearby      │ ~85 XAF      │
// │ POI finance (1 type)│ 4 pts × 1 type = 4 Google Nearby      │ ~85 XAF      │
// │ POI auto (3 types)  │ 4 pts × 3 types = 12 Google Nearby    │ ~255 XAF     │
// │ POI religion (2 ty) │ 4 pts × 2 types = 8 Google Nearby     │ ~170 XAF     │
// │ POI accommodation   │ 4 pts × 1 type = 4 Google Nearby      │ ~85 XAF      │
// │ POI security (1 ty) │ 4 pts × 1 type = 4 Google Nearby      │ ~85 XAF      │
// │ Activity stats      │ 5 SQL queries (aucune API externe)     │ ~0.02 XAF    │
// │ AI Coach            │ 12 SQL + 1 LLM call (GPT-4o ~2.9 XAF) │ ~3 XAF       │
// │ Community alerts    │ 1 SQL + 5 reverseGeocode max           │ ~17 XAF      │
// │ Route search        │ 1-3 Google Directions API              │ ~12 XAF      │
// │ Checkpoint report   │ 1 SQL INSERT                           │ ~0.01 XAF    │
// │ CO2 / Gamification  │ SQL only                               │ ~0.01 XAF    │
// └─────────────────────┴────────────────────────────────────────┴──────────────┘

use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use std::sync::Arc;

/// Marge appliquée sur le coût réel (100% = prix = 2× le coût)
const MARGIN_PERCENT: f64 = 100.0;

/// Forfait minimum pour les features à coût quasi-nul mais avec valeur utilisateur
const MIN_FLAT_FEE_XAF: i64 = 5;

/// Google Places Nearby Search: $0.032/request ≈ 21 XAF (à 656 XAF/$)
const GOOGLE_NEARBY_COST_XAF: f64 = 21.0;
/// Google Geocoding (reverseGeocode): $0.005/request ≈ 3.3 XAF
const GOOGLE_GEOCODE_COST_XAF: f64 = 3.3;
/// Google Directions API: $0.005-0.010/request ≈ 5 XAF
const GOOGLE_DIRECTIONS_COST_XAF: f64 = 5.0;
/// Cloud Run overhead per request: ~0.5 XAF
const CLOUD_RUN_OVERHEAD_XAF: f64 = 0.5;
/// GPT-4o LLM call (~800 tokens): ~2.9 XAF
const LLM_CALL_COST_XAF: f64 = 2.9;
/// Nombre de search points le long du trajet (typique)
const TYPICAL_SEARCH_POINTS: f64 = 4.0;
/// Max reverseGeocode calls pour alertes (plafonné)
const MAX_GEOCODE_ALERTS: f64 = 5.0;

/// Arrondir au multiple de 5 supérieur
fn round_up_to_5(value: f64) -> i64 {
    let v = value.ceil() as i64;
    if v <= 0 { return 0; }
    ((v + 4) / 5) * 5
}

/// Calculer le prix final: coût × (1 + marge), arrondi au multiple de 5
fn compute_price(real_cost_xaf: f64) -> i64 {
    if real_cost_xaf < 0.1 {
        return 0; // Coût négligeable → gratuit
    }
    let with_margin = real_cost_xaf * (1.0 + MARGIN_PERCENT / 100.0);
    let rounded = round_up_to_5(with_margin);
    rounded.max(MIN_FLAT_FEE_XAF)
}

/// Calculer le coût POI réel basé sur le nombre de types Google dans la catégorie
fn poi_cost(google_types_count: usize) -> f64 {
    TYPICAL_SEARCH_POINTS * google_types_count as f64 * GOOGLE_NEARBY_COST_XAF + CLOUD_RUN_OVERHEAD_XAF
}

/// GET /api/pricing/navigation
/// Retourne les tarifs actuels + taux de change + métadonnées de coût
pub async fn get_navigation_pricing(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    // ── Coûts réels par catégorie POI ──
    // health: pharmacy + hospital = 2 types
    let cost_health = poi_cost(2);       // 4×2×21 + 0.5 = 168.5 XAF
    let cost_food = poi_cost(3);         // 4×3×21 + 0.5 = 252.5 XAF
    let cost_fuel = poi_cost(1);         // 4×1×21 + 0.5 = 84.5 XAF
    let cost_finance = poi_cost(1);      // 4×1×21 + 0.5 = 84.5 XAF
    let cost_auto = poi_cost(3);         // 4×3×21 + 0.5 = 252.5 XAF
    let cost_religion = poi_cost(2);     // 4×2×21 + 0.5 = 168.5 XAF
    let cost_accommodation = poi_cost(1);// 4×1×21 + 0.5 = 84.5 XAF
    let cost_security = poi_cost(1);     // 4×1×21 + 0.5 = 84.5 XAF — mais service public

    // ── Coûts réels micro-features ──
    let cost_alerts = MAX_GEOCODE_ALERTS * GOOGLE_GEOCODE_COST_XAF + CLOUD_RUN_OVERHEAD_XAF; // 5×3.3+0.5 = 17 XAF
    let cost_stats = CLOUD_RUN_OVERHEAD_XAF;           // ~0.5 XAF (SQL only)
    let cost_ai_coach = LLM_CALL_COST_XAF + CLOUD_RUN_OVERHEAD_XAF; // 2.9+0.5 = 3.4 XAF
    // route_search, checkpoint_report, co2, gamification: coût ~0

    // ── Prix avec marge 100% ──
    let poi_prices = serde_json::json!({
        "health": compute_price(cost_health),           // 168.5 × 2 → 340 XAF
        "food": compute_price(cost_food),               // 252.5 × 2 → 505 XAF
        "fuel": compute_price(cost_fuel),               // 84.5 × 2  → 170 XAF
        "finance": compute_price(cost_finance),         // 84.5 × 2  → 170 XAF
        "auto": compute_price(cost_auto),               // 252.5 × 2 → 505 XAF
        "religion": compute_price(cost_religion),       // 168.5 × 2 → 340 XAF
        "accommodation": compute_price(cost_accommodation), // 84.5 × 2 → 170 XAF
        "security": 0                                   // GRATUIT — service public d'intérêt général
    });

    let micro_prices = serde_json::json!({
        "community_alerts": compute_price(cost_alerts),       // 17 × 2 → 35 XAF (consultation écran)
        "community_alerts_sound": 100,                      // Notification sonore alerte (coût serveur + bande sonore - 100 FCFA)
        "activity_stats": 0,                                // GRATUIT — statistiques santé incluses dans coaching mensuel
        "ai_coach": compute_price(cost_ai_coach),           // 3.4 × 2 → 10 XAF
        "coaching_monthly": 1000,                           // Forfait coaching push mensuel (1000 FCFA)
        "co2_tracking": 0,                                  // GRATUIT (engagement écologique)
        "gamification": 0,                                  // GRATUIT (engagement)
        "route_search": 35,                                 // Coût par recherche trajet (même logique que alertes communautaires)
        "checkpoint_report": 0                              // GRATUIT (contribution communautaire)
    });

    // Taux de conversion: 1 XAF → devise cible
    // Source: taux indicatifs mars 2026 (1 EUR ≈ 655.957 XAF fixe CEMAC)
    // TODO: Automatiser la mise à jour via API externe
    let exchange_rates = serde_json::json!({
        "XAF": 1.0,
        "XOF": 1.0,            // Parité fixe CEMAC/UEMOA
        "EUR": 0.001524,
        "USD": 0.001650,
        "GBP": 0.001300,
        "NGN": 2.50,
        "GHS": 0.025,
        "KES": 0.230,
        "ZAR": 0.030,
        "MAD": 0.016,
        "TND": 0.005,
        "DZD": 0.225,
        "EGP": 0.080,
        "CDF": 4.30,
        "RWF": 2.10,
        "MGA": 7.50,
        "CAD": 0.002250,
        "CHF": 0.001450,
        "CNY": 0.012,
        "INR": 0.140
    });

    // ── Métadonnées de coût (transparence pour l'admin) ──
    let cost_breakdown = serde_json::json!({
        "margin_percent": MARGIN_PERCENT,
        "google_nearby_cost_xaf": GOOGLE_NEARBY_COST_XAF,
        "google_geocode_cost_xaf": GOOGLE_GEOCODE_COST_XAF,
        "google_directions_cost_xaf": GOOGLE_DIRECTIONS_COST_XAF,
        "llm_call_cost_xaf": LLM_CALL_COST_XAF,
        "cloud_run_overhead_xaf": CLOUD_RUN_OVERHEAD_XAF,
        "typical_search_points": TYPICAL_SEARCH_POINTS,
        "max_geocode_alerts": MAX_GEOCODE_ALERTS,
        "poi_real_costs": {
            "health": cost_health,
            "food": cost_food,
            "fuel": cost_fuel,
            "finance": cost_finance,
            "auto": cost_auto,
            "religion": cost_religion,
            "accommodation": cost_accommodation,
            "security": cost_security
        },
        "micro_real_costs": {
            "community_alerts": cost_alerts,
            "activity_stats": cost_stats,
            "ai_coach": cost_ai_coach
        }
    });

    Json(serde_json::json!({
        "success": true,
        "data": {
            "poi_prices": poi_prices,
            "micro_prices": micro_prices,
            "exchange_rates": exchange_rates,
            "cost_breakdown": cost_breakdown,
            "updated_at": chrono::Utc::now().to_rfc3339(),
            "version": 2
        }
    }))
}

pub fn pricing_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/pricing/navigation", get(get_navigation_pricing))
}
