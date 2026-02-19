# 🔍 Problème DNS Redis Memorystore - 2026-02-19

## ❌ Problème Identifié

**Erreur** : `failed to lookup address information: Name or service not known`

**Cause** : Le client Redis Rust (`redis::Client::open()`) utilise `tokio::net::lookup_host()` qui fait une résolution DNS. Même avec un DNS privé GCP configuré, Cloud Run via le VPC Connector ne peut pas résoudre les DNS privés GCP.

**Pourquoi** : Le DNS privé GCP fonctionne uniquement pour les ressources directement dans le VPC (Compute Engine, GKE, etc.), mais pas pour Cloud Run via VPC Connector.

---

## ✅ Solution : Connexion TCP Directe

La solution est de modifier le code backend pour utiliser une connexion TCP directe avec l'IP Redis, sans passer par la résolution DNS.

### Modification du Code Backend

Modifier `backend/src/main.rs` pour créer une connexion Redis avec IP directe :

```rust
// Au lieu de :
let client = redis::Client::open(redis_url.as_str())?;

// Utiliser :
use tokio::net::TcpStream;
use redis::aio::Connection;

// Extraire l'IP et le port de l'URL
let redis_ip = "10.128.102.19";
let redis_port = 6379;
let addr = format!("{}:{}", redis_ip, redis_port);

// Créer une connexion TCP directe
let stream = TcpStream::connect(&addr).await?;
let conn = Connection::new(stream).await?;
```

**Problème** : Cette approche ne fonctionne pas directement avec `deadpool_redis` qui attend une URL.

---

## 🔧 Solution Alternative : Utiliser l'IP dans l'URL avec Workaround

### Option 1 : Modifier le client Redis pour ignorer la résolution DNS

Créer un wrapper qui utilise `TcpStream` directement :

```rust
use tokio::net::TcpStream;
use redis::aio::Connection;
use redis::Client;

// Fonction helper pour créer une connexion Redis avec IP directe
async fn create_redis_connection_direct(ip: &str, port: u16) -> Result<Connection, redis::RedisError> {
    let addr = format!("{}:{}", ip, port);
    let stream = TcpStream::connect(&addr).await
        .map_err(|e| redis::RedisError::from((redis::ErrorKind::IoError, "Connection failed", e.to_string())))?;
    Connection::new(stream).await
}
```

**Inconvénient** : Nécessite de modifier tous les endroits où Redis est utilisé.

---

### Option 2 : Utiliser une variable d'environnement pour forcer l'IP

Modifier le code pour détecter si `REDIS_URL` contient une IP et utiliser une connexion directe :

```rust
// Dans main.rs, après avoir récupéré redis_url
let redis_client = if redis_url.contains("10.128.102.19") || redis_url.contains("redis.internal") {
    // Utiliser une connexion directe avec IP
    let ip = "10.128.102.19";
    let port = 6379;
    // Créer un client avec IP directe (nécessite modification du code Redis)
    // ...
} else {
    // Utiliser l'URL normale
    RedisClient::open(redis_url.as_str())?
};
```

---

## 🚀 Solution Recommandée : Utiliser Upstash Redis

**Pourquoi** :
- ✅ Fonctionne immédiatement (pas de problème DNS)
- ✅ Gratuit jusqu'à 10K commandes/jour
- ✅ TLS natif
- ✅ Pas de modification de code nécessaire

**Étapes** :
1. Créer un compte Upstash : https://console.upstash.com
2. Créer une base Redis
3. Récupérer l'URL de connexion
4. Mettre à jour le secret `redis-url`
5. Redéployer Cloud Run

**Script disponible** : `scripts/setup-redis-upstash.ps1`

---

## 📝 Solution Temporaire : Mode Dégradé

Si Redis n'est pas critique, l'application fonctionne en mode dégradé sans Redis :
- ✅ Pas de cache Redis
- ✅ Pas de rate limiting Redis
- ⚠️ NotificationQueueWorker en erreur (mais avec retry automatique)

**Action** : Vider le secret `redis-url` pour désactiver Redis.

---

## 🔗 Ressources

- **Documentation DNS Privé GCP** : https://cloud.google.com/dns/docs/zones/managing-private-zones
- **Documentation VPC Connector** : https://cloud.google.com/vpc/docs/configure-serverless-vpc-access
- **Documentation Memorystore** : https://cloud.google.com/memorystore/docs/redis

---

**Date** : 2026-02-19  
**Statut** : Problème identifié, solutions proposées

