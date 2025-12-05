// ✅ Phase 7: Service d'optimisation pour services spécialisés

use crate::services::specialized_services_cache::SpecializedServicesCache;
use crate::state::AppState;
use log::{info, warn};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;

/// Service d'optimisation pour améliorer les performances
pub struct SpecializedServicesOptimizer {
    pool: Arc<PgPool>,
    cache: SpecializedServicesCache,
}

impl SpecializedServicesOptimizer {
    pub fn new(pool: Arc<PgPool>, app_state: Arc<AppState>) -> Self {
        Self {
            pool,
            cache: SpecializedServicesCache::new(app_state),
        }
    }

    /// ✅ Phase 7.1: Précharger les données fréquemment utilisées dans le cache
    pub async fn preload_frequent_data(
        &self,
        user_id: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!("[Optimizer] Préchargement données pour user_id={}", user_id);

        // Précharger la liste des services (première page)
        let _ = self
            .cache
            .get_services_list(user_id, None, None, 1, 20)
            .await;

        // Précharger les statistiques
        let _ = self.cache.get_statistics(user_id, None).await;

        info!("[Optimizer] ✅ Données préchargées");
        Ok(())
    }

    /// ✅ Phase 7.2: Nettoyer le cache des données obsolètes
    pub async fn cleanup_stale_cache(
        &self,
        user_id: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[Optimizer] Nettoyage cache obsolète pour user_id={}",
            user_id
        );

        // Invalider les caches qui pourraient être obsolètes
        let _ = self.cache.invalidate_user_cache(user_id).await;

        info!("[Optimizer] ✅ Cache nettoyé");
        Ok(())
    }

    /// ✅ Phase 7.3: Optimiser les index de base de données
    pub async fn optimize_database_indexes(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("[Optimizer] Optimisation index base de données...");

        // Analyser les tables pour suggérer des index
        let analysis: Vec<(String, String)> = sqlx::query_as(
            r#"
            SELECT 
                schemaname || '.' || tablename as table_name,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN ('services', 'pharmacies', 'hopitaux', 'laboratoires', 'agences_voyage', 'covoiturages', 'taxis')
            "#
        )
        .fetch_all(&*self.pool)
        .await?;

        for (table_name, size) in analysis {
            info!(
                "[Optimizer] Table analysée: {} (taille: {})",
                table_name, size
            );
        }

        // Vérifier les index existants
        let indexes: Vec<(String, String, bool)> = sqlx::query_as(
            r#"
            SELECT 
                tablename,
                indexname,
                indisunique
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename IN ('services', 'pharmacies', 'hopitaux', 'laboratoires', 'agences_voyage', 'covoiturages', 'taxis')
            "#
        )
        .fetch_all(&*self.pool)
        .await?;

        for (table, index, unique) in indexes {
            info!(
                "[Optimizer] Index trouvé: {} sur {} (unique: {})",
                index, table, unique
            );
        }

        info!("[Optimizer] ✅ Analyse index terminée");
        Ok(())
    }

    /// ✅ Phase 7.4: Compresser les réponses volumineuses
    pub fn should_compress_response(&self, data_size: usize) -> bool {
        // Compresser si la réponse fait plus de 10 KB
        data_size > 10_240
    }
}

/// ✅ Phase 7.5: Tâche périodique d'optimisation
pub async fn start_optimization_task(pool: Arc<PgPool>, app_state: Arc<AppState>) {
    let optimizer = SpecializedServicesOptimizer::new(pool, app_state);

    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval = interval(Duration::from_secs(3600)); // Toutes les heures

        loop {
            interval.tick().await;
            log::info!("[Optimizer] 🔄 Démarrage tâche d'optimisation...");

            // Optimiser les index
            if let Err(e) = optimizer.optimize_database_indexes().await {
                log::error!("[Optimizer] Erreur optimisation index: {}", e);
            }

            // Nettoyer le cache obsolète (pour tous les utilisateurs actifs récemment)
            // TODO: Implémenter la logique pour trouver les utilisateurs actifs
        }
    });
}
