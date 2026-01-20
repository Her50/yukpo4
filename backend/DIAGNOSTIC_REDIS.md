# 🔍 Diagnostic Redis - Pourquoi Redis n'est pas accessible

## 📋 **Résumé du problème**

Redis est configuré pour fonctionner en mode dégradé : si la connexion échoue, l'application continue de fonctionner mais certaines fonctionnalités sont désactivées (WebSocket, cache avancé, etc.).

## ✅ **Ce qui fonctionne correctement dans le code**

1. **Initialisation Redis** (`backend/src/main.rs:410-598`)
   - ✅ Détection automatique d'Upstash et conversion `redis://` → `rediss://`
   - ✅ Normalisation de l'URL (ajout de `/0` si absent)
   - ✅ Retry automatique avec timeout de 3s par tentative (max 3 tentatives)
   - ✅ Healthcheck périodique toutes les 5 minutes
   - ✅ Mode dégradé activé si Redis non disponible

2. **Helper Redis** (`backend/src/utils/redis_helper.rs`)
   - ✅ Retry automatique pour toutes les opérations
   - ✅ Timeout par tentative (3s)
   - ✅ Gestion d'erreur robuste
   - ✅ Logs intelligents (seulement les changements d'état)

3. **Services utilisant Redis**
   - ✅ WebSocket chat (pub/sub Redis)
   - ✅ Flash Sales cache
   - ✅ Global Promo cache
   - ✅ Notification queue
   - ✅ Delivery state sharing
   - ✅ Search cache (multi-niveaux)
   - ✅ Semantic cache (IA optimisations)

## 🔍 **Problèmes potentiels à vérifier**

### 1. **Variable d'environnement REDIS_URL non définie**

**Vérification :**
```bash
# Sur Render.com, vérifiez dans Environment Variables
echo $REDIS_URL
```

**Solution :**
- Si non définie : Définir `REDIS_URL` avec votre URL Redis
- Format local : `redis://127.0.0.1:6379/0`
- Format Upstash : `rediss://default:[password]@[endpoint].upstash.io:6379/0`

### 2. **URL Redis incorrecte (Upstash sans TLS)**

**Symptôme :**
```
⚠️ Redis: Upstash détecté mais URL utilise 'redis://' au lieu de 'rediss://'
```

**Solution :**
- Le code convertit automatiquement `redis://` en `rediss://` pour Upstash
- Si ça ne fonctionne pas, vérifiez que `REDIS_URL` contient bien `upstash.io`

### 3. **Serveur Redis non accessible**

**Causes possibles :**
- Firewall bloque les connexions
- Serveur Redis arrêté
- Mauvais host/port dans l'URL
- Credentials incorrects

**Diagnostic :**
```rust
// Le code teste la connexion avec PING
// Si échec : "Connection failed: ..." ou "PING failed: ..."
```

**Solution :**
- Vérifier que le serveur Redis est démarré (local) ou actif (cloud)
- Vérifier les credentials (username/password) dans `REDIS_URL`
- Tester la connexion manuellement :
  ```bash
  redis-cli -u "rediss://default:password@endpoint.upstash.io:6379/0" PING
  ```

### 4. **Problème TLS (feature native-tls non activée)**

**Symptôme :**
```
❌ Redis: Impossible de créer le client - Erreur: ... TLS ... feature is not enabled
```

**Solution :**
- ✅ La feature `native-tls-comp` est déjà activée dans `Cargo.toml`
- Si problème persiste, vérifier la compilation avec les features TLS

### 5. **Timeout de connexion**

**Symptôme :**
```
⚠️ Redis: Timeout de connexion (10s) - Redis non accessible
```

**Causes :**
- Serveur Redis lent ou surchargé
- Problème réseau (latence élevée)
- Firewall bloque partiellement les connexions

**Solution :**
- Vérifier la latence réseau vers Redis
- Augmenter les timeouts si nécessaire (actuellement 3s par tentative)

## 📊 **Logs à vérifier**

### Au démarrage (succès) :
```
✅ Connexion Redis établie avec succès
✅ Pool Redis créé (max: 16, min: 4)
✅ [Redis] Health check réussi - Redis disponible
```

### Au démarrage (échec) :
```
⚠️ Redis: Échec de connexion après retry - URL: rediss://...
   🔍 Détails de l'erreur: Connection failed: ...
ℹ️ Redis non disponible au démarrage (service optionnel). Les services réessayeront automatiquement.
```

### Healthcheck périodique (toutes les 5 minutes) :
```
⚠️ [Redis] Health check échoué - Redis non disponible - ...
(ou)
✅ [Redis] Health check réussi - Redis disponible
```

## 🛠️ **Actions de diagnostic**

### 1. Vérifier la variable d'environnement
```bash
# Sur Render.com : Dashboard → Environment → REDIS_URL
# Doit être au format : rediss://default:password@endpoint.upstash.io:6379/0
```

### 2. Tester la connexion manuellement
```bash
# Avec redis-cli
redis-cli -u "$REDIS_URL" PING
# Devrait répondre : PONG
```

### 3. Vérifier les logs de démarrage
Chercher dans les logs Render :
- `🔍 Tentative de connexion Redis: ...`
- `✅ Connexion Redis établie` (succès)
- `⚠️ Redis: Échec de connexion` (échec)

### 4. Vérifier le healthcheck périodique
Chercher dans les logs toutes les 5 minutes :
- `✅ [Redis] Health check réussi`
- `⚠️ [Redis] Health check échoué`

## 🔧 **Solutions selon le problème**

### Problème : REDIS_URL non définie
**Solution :** Ajouter `REDIS_URL` dans les variables d'environnement Render

### Problème : URL Upstash sans TLS
**Solution :** Le code corrige automatiquement, mais vérifiez que `upstash.io` est dans l'URL

### Problème : Credentials incorrects
**Solution :** Vérifier username/password dans `REDIS_URL` (format: `rediss://username:password@host:port/db`)

### Problème : Serveur Redis inaccessible
**Solution :** 
- Upstash : Vérifier que l'instance est active dans le dashboard Upstash
- Local : Vérifier que Redis est démarré (`redis-server`)

### Problème : Firewall/Network
**Solution :** 
- Upstash : Vérifier que l'endpoint est accessible publiquement
- Render : Vérifier les restrictions réseau si présentes

## 📝 **Format URL Redis attendu**

### Upstash (TLS requis) :
```
rediss://default:password@endpoint.upstash.io:6379/0
```

### Local (sans TLS) :
```
redis://127.0.0.1:6379/0
```

### Redis Cloud (avec TLS) :
```
rediss://username:password@host.redis.cloud:6379/0
```

## ⚠️ **Important : Mode dégradé**

Si Redis n'est pas accessible, l'application continue de fonctionner mais :
- ❌ WebSocket pub/sub désactivé (chat en temps réel)
- ❌ Cache Flash Sales désactivé
- ❌ Cache Global Promo désactivé
- ❌ Delivery state sharing désactivé
- ⚠️ Retry automatique activé (les services réessayeront lors des opérations)

## 🎯 **Commandes utiles**

```bash
# Vérifier les variables d'environnement sur Render
# Dashboard → Environment → Vérifier REDIS_URL

# Tester Redis localement
redis-cli PING

# Tester Redis Upstash
redis-cli -u "rediss://default:password@endpoint.upstash.io:6379/0" PING

# Vérifier les logs Render pour Redis
# Dashboard → Logs → Chercher "Redis"
```

## 📚 **Références**

- `backend/src/main.rs:410-598` : Initialisation Redis
- `backend/src/utils/redis_helper.rs` : Helper avec retry
- `backend/src/state.rs:175-233` : Pool Redis dans AppState



