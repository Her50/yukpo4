// ?? src/tasks/mod.rs

//! Regroupe tous les jobs planifi?s ou r?currents de votre application.

pub mod archived_service_cleaner;
pub mod intelligent_service_task;
pub mod matching_echange;
pub mod product_deactivation; // ✅ Tâche de désactivation automatique des produits
pub mod publicite_expiration;
pub mod reactivate_service;
pub mod service_deactivation;
pub mod service_status_checker; // ✅ Tâche de désactivation des publicités expirées

// ajoute ici d?autres modules de t?ches, par ex.
// pub mod notification_scheduler;
// pub mod clean_old_logs;
