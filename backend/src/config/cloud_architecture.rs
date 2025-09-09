use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// ?? Configuration pour l'architecture cloud massive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudArchitecture {
    /// Configuration du load balancer
    pub load_balancer: LoadBalancerConfig,
    /// Configuration de l'auto-scaling
    pub auto_scaling: AutoScalingConfig,
    /// Configuration du monitoring
    pub monitoring: MonitoringConfig,
    /// Configuration du cache distribu?
    pub distributed_cache: CacheConfig,
    /// Configuration des microservices
    pub microservices: MicroservicesConfig,
    /// Configuration de la base de donn?es
    pub database: DatabaseConfig,
    /// Configuration de la s?curit?
    pub security: SecurityConfig,
}

/// ?? Configuration du load balancer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancerConfig {
    /// Algorithme de r?partition de charge
    pub algorithm: LoadBalancingAlgorithm,
    /// Nombre maximum de connexions par instance
    pub max_connections_per_instance: u32,
    /// Timeout de sant? des instances
    pub health_check_timeout: Duration,
    /// Intervalle de v?rification de sant?
    pub health_check_interval: Duration,
    /// Configuration SSL/TLS
    pub ssl_config: SSLConfig,
}

/// ?? Algorithme de r?partition de charge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadBalancingAlgorithm {
    RoundRobin,
    LeastConnections,
    WeightedRoundRobin,
    IPHash,
    LeastResponseTime,
}

/// ?? Configuration SSL/TLS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSLConfig {
    pub enabled: bool,
    pub certificate_path: String,
    pub private_key_path: String,
    pub min_tls_version: String,
}

/// ?? Configuration de l'auto-scaling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoScalingConfig {
    /// Nombre minimum d'instances
    pub min_instances: u32,
    /// Nombre maximum d'instances
    pub max_instances: u32,
    /// Seuil CPU pour scale-up (pourcentage)
    pub cpu_threshold_up: f64,
    /// Seuil CPU pour scale-down (pourcentage)
    pub cpu_threshold_down: f64,
    /// Seuil m?moire pour scale-up (pourcentage)
    pub memory_threshold_up: f64,
    /// Seuil m?moire pour scale-down (pourcentage)
    pub memory_threshold_down: f64,
    /// Cooldown entre les actions de scaling (secondes)
    pub scaling_cooldown: Duration,
    /// M?triques personnalis?es pour le scaling
    pub custom_metrics: Vec<String>,
}

/// ?? Configuration du monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    /// Endpoint pour les m?triques Prometheus
    pub metrics_endpoint: String,
    /// Intervalle d'export des m?triques
    pub metrics_interval: Duration,
    /// Configuration des alertes
    pub alerts: AlertConfig,
    /// Configuration des logs
    pub logging: LoggingConfig,
    /// M?triques ? surveiller
    pub tracked_metrics: Vec<MetricType>,
}

/// ?? Configuration des alertes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    /// Seuil d'erreur pour d?clencher une alerte
    pub error_threshold: f64,
    /// Seuil de latence pour d?clencher une alerte (ms)
    pub latency_threshold: Duration,
    /// Seuil d'utilisation CPU pour d?clencher une alerte
    pub cpu_threshold: f64,
    /// Seuil d'utilisation m?moire pour d?clencher une alerte
    pub memory_threshold: f64,
    /// Canaux de notification
    pub notification_channels: Vec<NotificationChannel>,
}

/// ?? Canal de notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationChannel {
    Email(String),
    Slack(String),
    Webhook(String),
    SMS(String),
}

/// ?? Configuration des logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Niveau de log
    pub level: String,
    /// Format des logs
    pub format: LogFormat,
    /// Destination des logs
    pub destination: LogDestination,
    /// R?tention des logs (jours)
    pub retention_days: u32,
}

/// ?? Format des logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogFormat {
    JSON,
    Text,
    Structured,
}

/// ?? Destination des logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogDestination {
    File(String),
    Console,
    Syslog,
    CloudWatch,
    Elasticsearch(String),
}

/// ?? Type de m?trique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MetricType {
    RequestRate,
    ResponseTime,
    ErrorRate,
    CPUUsage,
    MemoryUsage,
    DiskUsage,
    NetworkIO,
    Custom(String),
}

/// ??? Configuration du cache distribu?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Type de cache
    pub cache_type: CacheType,
    /// TTL par d?faut (secondes)
    pub default_ttl: Duration,
    /// Taille maximale du cache (MB)
    pub max_size_mb: u64,
    /// Configuration Redis
    pub redis_config: Option<RedisConfig>,
    /// Configuration Memcached
    pub memcached_config: Option<MemcachedConfig>,
}

/// ??? Type de cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CacheType {
    InMemory,
    Redis,
    Memcached,
    Hybrid,
}

/// ?? Configuration Redis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    pub password: Option<String>,
    pub database: u8,
    pub pool_size: u32,
    pub connection_timeout: Duration,
}

/// ?? Configuration Memcached
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemcachedConfig {
    pub servers: Vec<String>,
    pub pool_size: u32,
    pub connection_timeout: Duration,
}

/// ?? Configuration des microservices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroservicesConfig {
    /// Services disponibles
    pub services: HashMap<String, ServiceConfig>,
    /// Configuration de communication inter-services
    pub inter_service_communication: InterServiceConfig,
    /// Configuration de d?couverte de services
    pub service_discovery: ServiceDiscoveryConfig,
}

/// ?? Configuration d'un service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    /// Nom du service
    pub name: String,
    /// Version du service
    pub version: String,
    /// Port du service
    pub port: u16,
    /// Endpoints du service
    pub endpoints: Vec<String>,
    /// Configuration de sant?
    pub health_check: HealthCheckConfig,
    /// Configuration de circuit breaker
    pub circuit_breaker: CircuitBreakerConfig,
}

/// ?? Configuration de v?rification de sant?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    /// Endpoint de sant?
    pub endpoint: String,
    /// Intervalle de v?rification
    pub interval: Duration,
    /// Timeout de la v?rification
    pub timeout: Duration,
    /// Nombre d'?checs avant marquage comme non sain
    pub failure_threshold: u32,
}

/// ? Configuration du circuit breaker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    /// Seuil d'erreur pour ouvrir le circuit
    pub error_threshold: f64,
    /// Nombre minimum de requ?tes avant activation
    pub minimum_requests: u32,
    /// Timeout pour fermer le circuit (secondes)
    pub timeout: Duration,
}

/// ?? Configuration de communication inter-services
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterServiceConfig {
    /// Protocole de communication
    pub protocol: CommunicationProtocol,
    /// Timeout par d?faut
    pub default_timeout: Duration,
    /// Configuration de retry
    pub retry_config: RetryConfig,
}

/// ?? Protocole de communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationProtocol {
    HTTP,
    GRpc,
    WebSocket,
    MessageQueue,
}

/// ?? Configuration de retry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Nombre maximum de tentatives
    pub max_retries: u32,
    /// D?lai initial entre les tentatives
    pub initial_delay: Duration,
    /// Facteur de backoff
    pub backoff_factor: f64,
    /// D?lai maximum entre les tentatives
    pub max_delay: Duration,
}

/// ?? Configuration de d?couverte de services
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDiscoveryConfig {
    /// Type de d?couverte
    pub discovery_type: DiscoveryType,
    /// Configuration Consul
    pub consul_config: Option<ConsulConfig>,
    /// Configuration Etcd
    pub etcd_config: Option<EtcdConfig>,
}

/// ?? Type de d?couverte
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiscoveryType {
    Static,
    Consul,
    Etcd,
    Kubernetes,
}

/// ?? Configuration Consul
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsulConfig {
    pub host: String,
    pub port: u16,
    pub token: Option<String>,
    pub datacenter: String,
}

/// ?? Configuration Etcd
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtcdConfig {
    pub endpoints: Vec<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// ??? Configuration de la base de donn?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// Configuration de la base principale
    pub primary: DatabaseInstanceConfig,
    /// Configuration des r?plicas de lecture
    pub read_replicas: Vec<DatabaseInstanceConfig>,
    /// Configuration du pool de connexions
    pub connection_pool: ConnectionPoolConfig,
    /// Configuration de la r?plication
    pub replication: ReplicationConfig,
}

/// ??? Configuration d'une instance de base de donn?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInstanceConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl_mode: SSLMode,
}

/// ?? Mode SSL pour la base de donn?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSLMode {
    Disabled,
    Prefer,
    Require,
    VerifyCA,
    VerifyFull,
}

/// ?? Configuration du pool de connexions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionPoolConfig {
    /// Taille minimale du pool
    pub min_size: u32,
    /// Taille maximale du pool
    pub max_size: u32,
    /// Timeout d'acquisition de connexion
    pub acquire_timeout: Duration,
    /// Timeout d'idle
    pub idle_timeout: Duration,
    /// Timeout de vie maximale
    pub max_lifetime: Duration,
}

/// ?? Configuration de r?plication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationConfig {
    /// D?lai de r?plication maximum (secondes)
    pub max_replication_lag: Duration,
    /// Strat?gie de r?plication
    pub strategy: ReplicationStrategy,
}

/// ?? Strat?gie de r?plication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplicationStrategy {
    Synchronous,
    Asynchronous,
    SemiSynchronous,
}

/// ?? Configuration de s?curit?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Configuration JWT
    pub jwt: JWTConfig,
    /// Configuration CORS
    pub cors: CORSConfig,
    /// Configuration rate limiting
    pub rate_limiting: RateLimitingConfig,
    /// Configuration des headers de s?curit?
    pub security_headers: SecurityHeadersConfig,
}

/// ?? Configuration JWT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JWTConfig {
    pub secret: String,
    pub algorithm: String,
    pub expiration: Duration,
    pub refresh_expiration: Duration,
}

/// ?? Configuration CORS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CORSConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_methods: Vec<String>,
    pub allowed_headers: Vec<String>,
    pub allow_credentials: bool,
    pub max_age: Duration,
}

/// ?? Configuration du rate limiting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitingConfig {
    /// Requ?tes par minute par IP
    pub requests_per_minute: u32,
    /// Requ?tes par heure par IP
    pub requests_per_hour: u32,
    /// Requ?tes par jour par IP
    pub requests_per_day: u32,
    /// Strat?gie de rate limiting
    pub strategy: RateLimitingStrategy,
}

/// ?? Strat?gie de rate limiting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RateLimitingStrategy {
    TokenBucket,
    LeakyBucket,
    FixedWindow,
    SlidingWindow,
}

/// ??? Configuration des headers de s?curit?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityHeadersConfig {
    pub content_security_policy: String,
    pub x_frame_options: String,
    pub x_content_type_options: String,
    pub x_xss_protection: String,
    pub strict_transport_security: String,
    pub referrer_policy: String,
}

impl CloudArchitecture {
    /// ?? Cr?e une configuration par d?faut pour le cloud
    pub fn new() -> Self {
        Self {
            load_balancer: LoadBalancerConfig {
                algorithm: LoadBalancingAlgorithm::LeastConnections,
                max_connections_per_instance: 10000,
                health_check_timeout: Duration::from_secs(5),
                health_check_interval: Duration::from_secs(30),
                ssl_config: SSLConfig {
                    enabled: true,
                    certificate_path: "/etc/ssl/certs/cert.pem".to_string(),
                    private_key_path: "/etc/ssl/private/key.pem".to_string(),
                    min_tls_version: "TLSv1.2".to_string(),
                },
            },
            auto_scaling: AutoScalingConfig {
                min_instances: 3,
                max_instances: 100,
                cpu_threshold_up: 70.0,
                cpu_threshold_down: 30.0,
                memory_threshold_up: 80.0,
                memory_threshold_down: 40.0,
                scaling_cooldown: Duration::from_secs(300),
                custom_metrics: vec!["request_rate".to_string(), "error_rate".to_string()],
            },
            monitoring: MonitoringConfig {
                metrics_endpoint: "/metrics".to_string(),
                metrics_interval: Duration::from_secs(15),
                alerts: AlertConfig {
                    error_threshold: 5.0,
                    latency_threshold: Duration::from_millis(1000),
                    cpu_threshold: 90.0,
                    memory_threshold: 95.0,
                    notification_channels: vec![
                        NotificationChannel::Email("alerts@yukpomnang.com".to_string()),
                        NotificationChannel::Slack("https://hooks.slack.com/services/...".to_string()),
                    ],
                },
                logging: LoggingConfig {
                    level: "info".to_string(),
                    format: LogFormat::JSON,
                    destination: LogDestination::CloudWatch,
                    retention_days: 30,
                },
                tracked_metrics: vec![
                    MetricType::RequestRate,
                    MetricType::ResponseTime,
                    MetricType::ErrorRate,
                    MetricType::CPUUsage,
                    MetricType::MemoryUsage,
                ],
            },
            distributed_cache: CacheConfig {
                cache_type: CacheType::Redis,
                default_ttl: Duration::from_secs(3600),
                max_size_mb: 1024,
                redis_config: Some(RedisConfig {
                    host: "redis-cluster.yukpomnang.com".to_string(),
                    port: 6379,
                    password: None,
                    database: 0,
                    pool_size: 20,
                    connection_timeout: Duration::from_secs(5),
                }),
                memcached_config: None,
            },
            microservices: MicroservicesConfig {
                services: HashMap::new(),
                inter_service_communication: InterServiceConfig {
                    protocol: CommunicationProtocol::GRpc,
                    default_timeout: Duration::from_secs(30),
                    retry_config: RetryConfig {
                        max_retries: 3,
                        initial_delay: Duration::from_millis(100),
                        backoff_factor: 2.0,
                        max_delay: Duration::from_secs(5),
                    },
                },
                service_discovery: ServiceDiscoveryConfig {
                    discovery_type: DiscoveryType::Kubernetes,
                    consul_config: None,
                    etcd_config: None,
                },
            },
            database: DatabaseConfig {
                primary: DatabaseInstanceConfig {
                    host: "primary-db.yukpomnang.com".to_string(),
                    port: 5432,
                    database: "yukpomnang".to_string(),
                    username: "app_user".to_string(),
                    password: "secure_password".to_string(),
                    ssl_mode: SSLMode::Require,
                },
                read_replicas: vec![
                    DatabaseInstanceConfig {
                        host: "replica-1.yukpomnang.com".to_string(),
                        port: 5432,
                        database: "yukpomnang".to_string(),
                        username: "read_user".to_string(),
                        password: "read_password".to_string(),
                        ssl_mode: SSLMode::Require,
                    },
                ],
                connection_pool: ConnectionPoolConfig {
                    min_size: 5,
                    max_size: 50,
                    acquire_timeout: Duration::from_secs(30),
                    idle_timeout: Duration::from_secs(600),
                    max_lifetime: Duration::from_secs(3600),
                },
                replication: ReplicationConfig {
                    max_replication_lag: Duration::from_secs(5),
                    strategy: ReplicationStrategy::Synchronous,
                },
            },
            security: SecurityConfig {
                jwt: JWTConfig {
                    secret: "your-super-secret-jwt-key-change-in-production".to_string(),
                    algorithm: "HS256".to_string(),
                    expiration: Duration::from_secs(3600),
                    refresh_expiration: Duration::from_secs(86400),
                },
                cors: CORSConfig {
                    allowed_origins: vec!["https://yukpomnang.com".to_string()],
                    allowed_methods: vec!["GET".to_string(), "POST".to_string(), "PUT".to_string(), "DELETE".to_string()],
                    allowed_headers: vec!["Content-Type".to_string(), "Authorization".to_string()],
                    allow_credentials: true,
                    max_age: Duration::from_secs(86400),
                },
                rate_limiting: RateLimitingConfig {
                    requests_per_minute: 100,
                    requests_per_hour: 1000,
                    requests_per_day: 10000,
                    strategy: RateLimitingStrategy::TokenBucket,
                },
                security_headers: SecurityHeadersConfig {
                    content_security_policy: "default-src 'self'; script-src 'self' 'unsafe-inline'".to_string(),
                    x_frame_options: "DENY".to_string(),
                    x_content_type_options: "nosniff".to_string(),
                    x_xss_protection: "1; mode=block".to_string(),
                    strict_transport_security: "max-age=31536000; includeSubDomains".to_string(),
                    referrer_policy: "strict-origin-when-cross-origin".to_string(),
                },
            },
        }
    }

    /// ?? Obtient les statistiques de l'architecture
    pub fn get_stats(&self) -> String {
        format!(
            "Cloud Architecture - Load Balancer: {:?}, Auto Scaling: {}-{} instances, Cache: {:?}, DB Replicas: {}",
            self.load_balancer.algorithm,
            self.auto_scaling.min_instances,
            self.auto_scaling.max_instances,
            self.distributed_cache.cache_type,
            self.database.read_replicas.len()
        )
    }
}

impl Default for CloudArchitecture {
    fn default() -> Self {
        Self::new()
    }
} 
