//! File Redis pour jobs YukpoIA **asynchrones** (chat) — persistance sous pic, traitement par worker.

use log::info;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
/// Liste Redis : `LPUSH` côté API, `BRPOP` côté worker (FIFO).
pub const QUEUE_KEY: &str = "yukpo_ia:chat:queue";

fn job_key(job_id: &str) -> String {
    format!("yukpo_ia:job:{}", job_id)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum YukpoIaJobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YukpoIaJobRecord {
    pub job_id: String,
    pub user_id: i32,
    pub status: YukpoIaJobStatus,
    /// Corps de requête identique à `POST /ai/chat` (JSON).
    pub request: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub http_status: Option<u16>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub struct YukpoIaJobQueue {
    redis: redis::Client,
    ttl_secs: u64,
}

impl YukpoIaJobQueue {
    pub fn new(redis: redis::Client) -> Self {
        let ttl_secs = std::env::var("YUKPO_IA_JOB_TTL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(86_400);
        Self { redis, ttl_secs }
    }

    pub fn ttl_secs(&self) -> u64 {
        self.ttl_secs
    }

    /// Enfile un job et persiste l’état initial. Retourne `job_id`.
    pub async fn enqueue(
        &self,
        user_id: i32,
        request: serde_json::Value,
    ) -> Result<String, String> {
        let job_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let record = YukpoIaJobRecord {
            job_id: job_id.clone(),
            user_id,
            status: YukpoIaJobStatus::Pending,
            request,
            result: None,
            error: None,
            http_status: None,
            created_at_ms: now,
            updated_at_ms: now,
        };
        let json = serde_json::to_string(&record).map_err(|e| e.to_string())?;

        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("redis: {}", e))?;

        let k = job_key(&job_id);
        conn.set_ex::<_, _, ()>(&k, &json, self.ttl_secs)
            .await
            .map_err(|e| format!("redis SET: {}", e))?;
        conn.lpush::<_, _, ()>(QUEUE_KEY, &job_id)
            .await
            .map_err(|e| format!("redis LPUSH: {}", e))?;

        info!(
            "[YukpoIA queue] job enqueued job_id={} user_id={}",
            job_id, user_id
        );
        Ok(job_id)
    }

    pub async fn get_job(&self, job_id: &str) -> Result<Option<YukpoIaJobRecord>, String> {
        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("redis: {}", e))?;
        let k = job_key(job_id);
        let raw: Option<String> = conn.get(&k).await.map_err(|e| format!("redis GET: {}", e))?;
        let Some(s) = raw else {
            return Ok(None);
        };
        serde_json::from_str(&s).map(Some).map_err(|e| e.to_string())
    }

    pub async fn update_job(&self, record: &YukpoIaJobRecord) -> Result<(), String> {
        let mut rec = record.clone();
        rec.updated_at_ms = chrono::Utc::now().timestamp_millis();
        let json = serde_json::to_string(&rec).map_err(|e| e.to_string())?;
        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("redis: {}", e))?;
        let k = job_key(&rec.job_id);
        conn.set_ex::<_, _, ()>(&k, &json, self.ttl_secs)
            .await
            .map_err(|e| format!("redis SET: {}", e))?;
        Ok(())
    }

    /// Bloque jusqu’à `timeout_secs` (secondes entières pour Redis BRPOP).
    pub async fn blocking_pop_job_id(&self, timeout_secs: f64) -> Result<Option<String>, String> {
        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("redis: {}", e))?;
        let t = timeout_secs.clamp(1.0, 86400.0).floor() as usize;
        let v: redis::Value = redis::cmd("BRPOP")
            .arg(QUEUE_KEY)
            .arg(t)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("redis BRPOP: {}", e))?;
        match v {
            redis::Value::Nil => Ok(None),
            redis::Value::Bulk(parts) if parts.len() >= 2 => {
                let id = match &parts[1] {
                    redis::Value::Data(b) => String::from_utf8_lossy(b).to_string(),
                    _ => return Ok(None),
                };
                Ok(Some(id))
            }
            _ => Ok(None),
        }
    }

    pub async fn queue_len(&self) -> Result<Option<u64>, String> {
        let mut conn = self
            .redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("redis: {}", e))?;
        let n: Option<u64> =
            conn.llen(QUEUE_KEY).await.map_err(|e| format!("redis LLEN: {}", e))?;
        Ok(Some(n))
    }
}
