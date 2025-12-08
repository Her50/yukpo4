//! ✅ Phase 3 - Service de partage d'état Redis pour scaling horizontal
//! Permet la coordination entre plusieurs instances backend

use crate::core::types::AppResult;
use redis::AsyncCommands;
use uuid::Uuid;

/// Service de partage d'état via Redis pour scaling horizontal
pub struct DeliveryStateSharing {
    redis_client: redis::Client,
    instance_id: String,
}

impl DeliveryStateSharing {
    pub fn new(redis_client: redis::Client, instance_id: String) -> Self {
        Self {
            redis_client,
            instance_id,
        }
    }

    /// Obtient l'ID de l'instance
    pub fn instance_id(&self) -> &str {
        &self.instance_id
    }

    /// ✅ Verrouille une livraison pour une instance spécifique
    /// Retourne true si le lock a été acquis, false si déjà verrouillé
    pub async fn lock_delivery(
        &self,
        delivery_id: Uuid,
        instance_id: &str,
        ttl_seconds: u64,
    ) -> AppResult<bool> {
        let key = format!("delivery:lock:{}", delivery_id);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        // SET avec NX (only if not exists) et EX (expiration)
        let result: Option<String> = redis::cmd("SET")
            .arg(&key)
            .arg(instance_id)
            .arg("EX")
            .arg(ttl_seconds)
            .arg("NX") // Only if not exists
            .query_async(&mut conn)
            .await?;

        Ok(result.is_some())
    }

    /// ✅ Libère le lock d'une livraison
    pub async fn unlock_delivery(&self, delivery_id: Uuid, instance_id: &str) -> AppResult<bool> {
        let key = format!("delivery:lock:{}", delivery_id);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        // Script Lua pour vérifier que c'est bien notre instance qui détient le lock
        let script = r#"
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        "#;

        let result: i32 = redis::Script::new(script)
            .key(&key)
            .arg(instance_id)
            .invoke_async(&mut conn)
            .await?;

        Ok(result > 0)
    }

    /// ✅ Vérifie si une livraison est verrouillée
    pub async fn is_locked(&self, delivery_id: Uuid) -> AppResult<Option<String>> {
        let key = format!("delivery:lock:{}", delivery_id);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        let instance_id: Option<String> = conn.get(&key).await?;
        Ok(instance_id)
    }

    /// ✅ Verrouille une opération de matching pour éviter double matching
    pub async fn lock_matching_attempt(&self, delivery_id: Uuid) -> AppResult<bool> {
        self.lock_delivery(delivery_id, &self.instance_id, 60).await // 60s TTL pour matching
    }

    /// ✅ Verrouille une mise à jour de statut
    pub async fn lock_status_update(&self, delivery_id: Uuid) -> AppResult<bool> {
        self.lock_delivery(delivery_id, &self.instance_id, 30).await // 30s TTL pour status update
    }

    /// ✅ Libère le lock d'une livraison (utilise l'instance_id du service)
    pub async fn unlock_delivery_auto(&self, delivery_id: Uuid) -> AppResult<bool> {
        self.unlock_delivery(delivery_id, &self.instance_id).await
    }

    /// ✅ Partage un état de livraison entre instances
    pub async fn set_delivery_state(
        &self,
        delivery_id: Uuid,
        state: &str,
        ttl_seconds: u64,
    ) -> AppResult<()> {
        let key = format!("delivery:state:{}", delivery_id);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        conn.set_ex::<_, _, ()>(&key, state, ttl_seconds as u64).await?;
        Ok(())
    }

    /// ✅ Récupère l'état partagé d'une livraison
    pub async fn get_delivery_state(&self, delivery_id: Uuid) -> AppResult<Option<String>> {
        let key = format!("delivery:state:{}", delivery_id);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        let state: Option<String> = conn.get(&key).await?;
        Ok(state)
    }

    /// ✅ Incrémente un compteur distribué (pour métriques multi-instances)
    pub async fn increment_counter(&self, counter_name: &str, value: i64) -> AppResult<i64> {
        let key = format!("counter:{}", counter_name);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        let result: i64 = conn.incr(&key, value).await?;
        Ok(result)
    }

    /// ✅ Obtient la valeur d'un compteur distribué
    pub async fn get_counter(&self, counter_name: &str) -> AppResult<i64> {
        let key = format!("counter:{}", counter_name);
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        let value: i64 = conn.get(&key).await.unwrap_or(0);
        Ok(value)
    }
}
