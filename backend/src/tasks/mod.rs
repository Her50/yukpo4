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
pub mod disbursement_processor; // ✅ 2026-04-03: Virements automatiques partenaires (AfricaPay/CinetPay/NotchPay)
pub mod drive_sync_scheduler; // ✅ Sync automatique liens Drive partenaires (hourly/daily/weekly)
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
pub mod qr_expiry_refund_worker; // ✅ 2026-04-03: Remboursement wallet si QR non validé dans les 48h
pub mod reactivate_service;
pub mod recurring_trips_cron;
pub mod reels_auto_generator; // ✅ 2026-04-03: Worker génération Reels auto depuis produits trending (4h)
pub mod reputation_monitor_worker; // ✅ 2026-04-03: Worker monitoring mentions/réputation (toutes les 30min)
pub mod search_cache_refresh; // ✅ NOUVEAU 2025-12-02: Rafraîchissement automatique vue matérialisée
pub mod service_deactivation;
pub mod service_status_checker; // ✅ Tâche de désactivation des publicités expirées
pub mod social_ads_worker;
pub mod social_chatbot_worker; // ✅ 2026-04-03: Worker Community Manager IA (traitement messages entrants)
pub mod stats_recalculation; // ✅ NOUVEAU : Recalcul périodique des statistiques
pub mod super_librairie_timeout_worker;
pub mod trend_forecast_worker; // ✅ 2026-04-03: Worker forecasting ML tendances (quotidien)
pub mod trend_snapshot_worker; // ✅ 2026-04-03: Snapshots horaires TrendPulse + alertes push haute opportunité
pub mod trend_to_post_worker; // ✅ 2026-04-03: Worker tendance → brouillon post IA auto (toutes les 2h)
pub mod troc_expiration_monitor; // Expiration automatique des trocs en attente (72h TTL)
pub mod video_weekly_report; // ✅ NOUVEAU 2025-01-29: Tâche cron pour trajets récurrents
pub mod yukpo_ia_queue_worker; // ✅ YukpoIA — worker file Redis chat async // ✅ Timeout YukpoLibrairie → fallback broadcast proches // ✅ 2026-04-03: Worker Meta Ads (sync métriques, optimisation budget auto)
