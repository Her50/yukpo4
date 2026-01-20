# 🌐 Sites pour vérifier votre compte Redis

## 📋 **Principaux fournisseurs Redis et leurs interfaces web**

### 1. **Upstash Redis** (Recommandé - Gratuit)
- **Site console** : https://console.upstash.com
- **Fonctionnalités** :
  - Dashboard avec statistiques en temps réel
  - Visualisation des clés et valeurs
  - Console Redis intégrée (commandes CLI)
  - Logs et monitoring
  - Configuration TLS/SSL
- **Accès** : Connexion avec GitHub, Google ou email
- **Note** : D'après vos configs, vous utilisez probablement Upstash

### 2. **Redis Cloud (Redis Labs)**
- **Site console** : https://redis.com/cloud/console/
- **Fonctionnalités** :
  - Interface de gestion complète
  - Monitoring des performances
  - Backups automatiques
  - Scaling automatique

### 3. **AWS ElastiCache for Redis**
- **Site console** : https://console.aws.amazon.com/elasticache/
- **Fonctionnalités** :
  - Gestion via AWS Console
  - Monitoring CloudWatch
  - Sécurité IAM

### 4. **Azure Cache for Redis**
- **Site console** : https://portal.azure.com
- **Navigation** : Azure Portal > Redis Caches
- **Fonctionnalités** :
  - Dashboard Azure
  - Métriques détaillées
  - Diagnostic intégré

### 5. **Google Cloud Memorystore for Redis**
- **Site console** : https://console.cloud.google.com/memorystore
- **Fonctionnalités** :
  - Interface GCP
  - Monitoring Stackdriver

### 6. **Render Redis** (si vous utilisez Render)
- **Site console** : https://dashboard.render.com
- **Navigation** : Dashboard > Your Redis Service
- **Fonctionnalités** :
  - Statistiques basiques
  - Variables d'environnement

---

## 🔍 **Comment identifier votre fournisseur Redis**

Vérifiez votre URL Redis dans `.env` ou variables d'environnement :

```bash
# Upstash (format typique)
REDIS_URL=rediss://default:password@hostname.upstash.io:6380

# Redis Cloud
REDIS_URL=redis://username:password@hostname.redis.cloud:6379

# Render
REDIS_URL=redis://hostname.onrender.com:6379

# AWS ElastiCache
REDIS_URL=redis://your-cache.xxxxx.cache.amazonaws.com:6379
```

---

## 🛠️ **Outils universels pour tester Redis (quel que soit le fournisseur)**

### 1. **RedisInsight** (Desktop - Recommandé)
- **Téléchargement** : https://redis.io/insight/
- **Fonctionnalités** :
  - Interface graphique complète
  - Visualisation des données
  - Execution de commandes
  - Analyse des performances
  - Support TLS/SSL

### 2. **Redis Commander** (Web)
- **Site** : https://github.com/joeferner/redis-commander
- **Installation locale** :
  ```bash
  npm install -g redis-commander
  redis-commander --redis-host=your-redis-host --redis-port=6379
  ```

### 3. **Medis** (Desktop - Mac/Windows/Linux)
- **Site** : https://getmedis.com/
- Interface graphique moderne pour Redis

### 4. **Another Redis Desktop Manager**
- **Site** : https://github.com/qishibo/AnotherRedisDesktopManager
- Interface gratuite et open-source

---

## ✅ **Vérification rapide via ligne de commande**

Si vous avez `redis-cli` installé :

```bash
# Test de connexion
redis-cli -h your-host -p 6379 -a your-password ping

# Devrait retourner : PONG
```

---

## 🔐 **Accès sécurisé**

Pour les connexions sécurisées (TLS/SSL) :
- Utilisez `rediss://` au lieu de `redis://` dans l'URL
- Configurez le certificat TLS si nécessaire
- Upstash utilise TLS par défaut

---

## 📝 **Pour Upstash spécifiquement** (probablement votre cas)

1. **Connectez-vous** : https://console.upstash.com
2. **Sélectionnez** votre base Redis
3. **Onglet "Console"** : Interface web pour exécuter des commandes
4. **Onglet "Data Browser"** : Visualiser les clés/valeurs
5. **Onglet "Metrics"** : Statistiques et performances
6. **Onglet "Settings"** : URL de connexion, credentials

---

## 🚨 **Test de santé Redis depuis votre backend**

Une fois le serveur démarré, vous pouvez tester via :

```bash
# Via curl
curl http://localhost:8080/health/redis

# Via PowerShell
Invoke-WebRequest -Uri http://localhost:8080/health/redis -Method GET
```

Cette route retourne un diagnostic complet de l'état Redis :
- PING test
- Write/Read tests
- Pool status
- Connection time
- Error messages si problème




