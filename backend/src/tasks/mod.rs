// ?? src/tasks/mod.rs

//! Regroupe tous les jobs planifi?s ou r?currents de votre application.

pub mod archived_service_cleaner;
pub mod delivery_matching_worker;
pub mod delivery_sla_monitor;
pub mod delivery_timeout_monitor; // ✅ NOUVEAU : Monitor des timeouts de validation d'étapes
pub mod order_timeout_monitor; // ✅ NOUVEAU : Monitor des timeouts de validation de commandes
pub mod stats_recalculation; // ✅ NOUVEAU : Recalcul périodique des statistiques
pub mod global_promo_scheduler;
pub mod intelligent_service_task;
pub mod live_analytics;
pub mod live_flash_sale_scheduler;
pub mod livekit_cleanup;
pub mod matching_echange;
pub mod pipeline_health_worker;
pub mod product_deactivation; // ✅ Tâche de désactivation automatique des produits
pub mod publicite_expiration;
pub mod reactivate_service;
pub mod service_deactivation;
pub mod service_status_checker; // ✅ Tâche de désactivation des publicités expirées
pub mod video_weekly_report;

// ajoute ici d’autres modules de tâches, par ex.
// pub mod notification_scheduler;
// pub mod clean_old_logs;
