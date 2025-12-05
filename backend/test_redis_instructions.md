# 🧪 Instructions pour tester la connexion Redis

## Méthode 1: Script PowerShell (Recommandé - Pas de compilation)

### Exécuter le script
```powershell
cd backend
.\test_redis_direct_connection.ps1
```

Ce script teste:
- ✅ Résolution DNS
- ✅ Connectivité TCP (port 6379)
- ✅ Test-NetConnection
- ✅ redis-cli (si disponible)

**Avantages**: Pas besoin de compiler, tests réseau de base

---

## Méthode 2: redis-cli (Si installé)

### Installer redis-cli (Windows)
```powershell
# Avec Chocolatey
choco install redis-64

# Ou télécharger depuis:
# https://github.com/microsoftarchive/redis/releases
```

### Tester la connexion
```powershell
$env:REDIS_URL="rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"
redis-cli -u $env:REDIS_URL ping
```

**Résultat attendu**: `PONG`

---

## Méthode 3: Test Rust minimal (Après correction compilation)

### Créer un projet minimal
```powershell
cd ..
mkdir test_redis_minimal
cd test_redis_minimal
cargo init --bin
```

### Modifier Cargo.toml
```toml
[dependencies]
redis = { version = "0.26", features = ["tokio-native-tls-comp", "aio"] }
tokio = { version = "1", features = ["full"] }
```

### Créer src/main.rs
```rust
use redis::AsyncCommands;
use redis::Client as RedisClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379".to_string());
    
    println!("🔍 Test Redis...");
    
    let client = RedisClient::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;
    
    let result: String = conn.ping().await?;
    println!("✅ PING réussi: {}", result);
    
    Ok(())
}
```

### Exécuter
```powershell
$env:REDIS_URL="rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"
cargo run
```

---

## Méthode 4: Test avec curl (API REST Upstash)

Upstash fournit aussi une API REST, mais nécessite l'endpoint REST spécifique (différent de l'URL Redis).

Pour obtenir l'endpoint REST:
1. Aller sur https://console.upstash.com
2. Sélectionner votre instance Redis
3. Copier l'endpoint REST (format: `https://xxx.upstash.io`)

### Tester avec curl
```powershell
# Remplacer par votre endpoint REST Upstash
$REST_ENDPOINT = "https://superb-sole-7762.upstash.io"
$TOKEN = "AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg"

curl -X POST "$REST_ENDPOINT/ping" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json"
```

---

## Méthode 5: Test dans le navigateur (Upstash Console)

1. Aller sur https://console.upstash.com
2. Se connecter
3. Sélectionner votre instance Redis `superb-sole-7762`
4. Cliquer sur "Data Browser"
5. Essayer une commande: `PING`

Si ça fonctionne dans la console, le problème est dans le code Rust.

---

## 🔍 Diagnostic des erreurs courantes

### Erreur: "Connection refused"
- ✅ Vérifier que le serveur Redis est actif
- ✅ Vérifier les paramètres de firewall
- ✅ Vérifier la résolution DNS

### Erreur: "TLS error" ou "certificate error"
- ✅ Vérifier que l'URL utilise `rediss://` (avec double 's')
- ✅ Vérifier que la feature `tokio-native-tls-comp` est activée

### Erreur: "Authentication failed"
- ✅ Vérifier le username (doit être `default` pour Upstash)
- ✅ Vérifier le password dans le dashboard Upstash
- ✅ Vérifier que les credentials n'ont pas expiré

### Erreur: "Timeout"
- ✅ Vérifier la latence réseau
- ✅ Vérifier que le serveur n'est pas surchargé
- ✅ Augmenter le timeout dans le code

---

## 📝 Résultat attendu

Si tous les tests passent:
```
✅ DNS résolu
✅ TCP connecté
✅ PING réussi: PONG
```

Si un test échoue, cela indique où se trouve le problème:
- DNS échoue → Problème réseau/connexion internet
- TCP échoue → Firewall ou serveur inaccessible
- PING échoue → Problème de credentials ou configuration Redis

