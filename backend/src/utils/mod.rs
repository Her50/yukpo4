pub mod currency;
pub mod db_monitor;
pub mod db_retry;
pub mod detect_intention;
pub mod embedding_client;
pub mod jwt_manager;
pub mod lang;
pub mod livekit;
pub mod log;
pub mod normalize_name;
pub mod prompt_sanitizer; // ✅ NOUVEAU 2025-01-27: Sanitisation des prompts pour sécurité
pub mod redis_helper;
pub mod redis_tcp_direct;
pub mod retry; // ✅ NOUVEAU 2025-01-27 : Utilitaire de retry pour opérations réseau/DB
pub mod role_helpers; // ✅ NOUVEAU 2026-02-06: Helpers pour vérifier les rôles admin/super_admin
pub mod sanitize_logs;
pub mod validation;
pub mod version; // ✅ NOUVEAU 2026-01-28: Gestion de la version de l'application // ✅ NOUVEAU 2026-02-16: Normalisation des noms pour éviter les duplications
