# ✅ Guide pour activer Redis Cache

## Configuration Redis

Redis est actuellement **désactivé** dans `AppIA` (ligne 498 de `app_ia.rs`). Pour l'activer :

### 1. Variables d'environnement

Ajoutez dans votre fichier `.env` ou sur Render :

```bash
REDIS_URL=redis://127.0.0.1:6379/0
# Ou pour Upstash (avec TLS)
REDIS_URL=redis://your-upstash-url.upstash.io:6379
```

**Note**: Le code convertit automatiquement `redis://` en `rediss://` pour Upstash avec TLS.

### 2. Activer le cache dans le code

Modifier `backend/src/services/app_ia.rs` ligne 497-498 :

```rust
// AVANT (désactivé)
log::info!("[AppIA] Redis désactivé - continuation sans cache");

// APRÈS (activé)
if let Ok(mut conn) = self.redis_client.get_async_connection().await {
    let cache_key = format!("ai:prompt:{}", md5::compute(prompt));
    if let Ok(cached) = redis::cmd("GET").arg(&cache_key).query_async::<_, Option<String>>(&mut conn).await {
        if let Some(cached_response) = cached {
            log::info!("[AppIA] ✅ Cache hit Redis");
            return Ok(("cached".to_string(), cached_response, 0));
        }
    }
}
```

### 3. Sauvegarder dans le cache après prédiction

Ajouter après une prédiction réussie (ligne ~536) :

```rust
// Sauvegarder dans le cache (TTL: 1 heure)
if let Ok(mut conn) = self.redis_client.get_async_connection().await {
    let cache_key = format!("ai:prompt:{}", md5::compute(prompt));
    let _ = redis::cmd("SETEX")
        .arg(&cache_key)
        .arg(3600) // 1 heure
        .arg(&response)
        .query_async::<_, ()>(&mut conn)
        .await;
    log::debug!("[AppIA] ✅ Réponse mise en cache");
}
```

### 4. Services IA avec cache

Les services suivants bénéficieront automatiquement du cache Redis une fois activé :
- `BookExchangeAIService`
- `OrientationScolaireAIService`
- `EmploiAIService`

### 5. Vérification

Pour vérifier que Redis fonctionne, regardez les logs au démarrage :

```
[AppIA] Redis activé - cache disponible
```

Au lieu de :

```
[AppIA] Redis désactivé - continuation sans cache
```

## Options de déploiement Redis

### Option 1: Upstash (Recommandé pour production)
- Service Redis managé avec TLS
- Gratuit jusqu'à 10K commandes/jour
- URL automatiquement convertie en `rediss://`

### Option 2: Redis local (Développement)
- Installer Redis localement
- URL: `redis://127.0.0.1:6379/0`

### Option 3: Render Redis (Si disponible)
- Service Redis managé par Render
- URL fournie dans les variables d'environnement

