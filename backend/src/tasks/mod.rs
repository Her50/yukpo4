// ?? src/tasks/mod.rs

//! Regroupe tous les jobs planifi?s ou r?currents de votre application.

pub mod archived_service_cleaner;
pub mod audio_cache_cleanup; // ✅ NOUVEAU 2025-12-30: Nettoyage automatique du cache audio
pub mod book_reversement_worker; // ✅ Reversements automatiques vendeurs bourse du livre
pub mod bus_schedule_product_generator; // Génération auto produits ticket_voyage depuis horaires agences (cron 6h)
pub mod delivery_archive_worker; // ✅ Phase 2 : Archivage automatique des livraisons
pub mod delivery_matching_worker;
pub mod delivery_notification_repeat; // ✅ NOUVEAU : Répétition des notifications de livraison
pub mod delivery_sla_monitor;
pub mod delivery_timeout_monitor; // ✅ NOUVEAU : Monitor des timeouts de validation d'étapes
pub mod flash_sale_queue_worker; // ✅ NOUVEAU: Worker de traitement des réservations Flash Sales
pub mod global_promo_scheduler;
pub mod intelligent_service_task;
pub mod live_analytics;
pub mod live_flash_sale_scheduler;
pub mod livekit_cleanup;
pub mod matching_echange;
pub mod matching_emploi_notifications; // ✅ NOUVEAU 2025-01-28: Notifications automatiques pour nouveaux matchings emploi
pub mod notification_queue_worker; // ✅ NOUVEAU: Worker de traitement des notifications par batch
pub mod order_timeout_monitor; // ✅ NOUVEAU : Monitor des timeouts de validation de commandes
pub mod pipeline_health_worker;
pub mod product_deactivation; // ✅ Tâche de désactivation automatique des produits
pub mod publicite_expiration;
pub mod reactivate_service;
pub mod recurring_trips_cron;
pub mod search_cache_refresh; // ✅ NOUVEAU 2025-12-02: Rafraîchissement automatique vue matérialisée
pub mod service_deactivation;
pub mod service_status_checker; // ✅ Tâche de désactivation des publicités expirées
pub mod stats_recalculation; // ✅ NOUVEAU : Recalcul périodique des statistiques
pub mod super_librairie_timeout_worker;
pub mod troc_expiration_monitor; // Expiration automatique des trocs en attente (72h TTL)
pub mod video_weekly_report; // ✅ NOUVEAU 2025-01-29: Tâche cron pour trajets récurrents
pub mod yukpo_ia_queue_worker; // ✅ YukpoIA — worker file Redis chat async // ✅ Timeout YukpoLibrairie → fallback broadcast proches
