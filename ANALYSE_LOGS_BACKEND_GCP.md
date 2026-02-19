# 🔍 Analyse Logs Backend GCP - Problèmes de Connexion

**Date** : 2026-02-19  
**Service** : yukpo-backend  
**URL** : https://yukpo-backend-mkzqhoqhaq-ew.a.run.app

---

## ❌ Problèmes Identifiés

### 1. **ERREUR CRITIQUE : Authentification PostgreSQL Échouée**

**Erreur** :
```
password authentication failed for user "yukpo_user"
```

**Fréquence** : Erreur répétée toutes les 2-3 secondes

**Services affectés** :
- ✅ ProductCreationQueue
- ✅ DeliveryMatchingWorker
- ✅ DeliveryNotificationRepeat
- ✅ GlobalPromoService
- ✅ LiveFlashSaleService
- ✅ SocialDistributionService
- ✅ PipelineHealthWorker
- ✅ OrderTimeoutMonitor
- ✅ DeliveryTimeoutMonitor
- ✅ DB Monitor (Pool unhealthy)

**Cause** : Le backend essaie de se connecter à PostgreSQL avec l'utilisateur `yukpo_user`, mais le mot de passe est incorrect ou l'utilisateur n'existe pas.

---

### 2. **ERREUR : Connexion Redis Échouée**

**Erreur** :
```
Redis connection failed: failed to lookup address information: Name or service not known
```

**Fréquence** : Erreur répétée toutes les 2-3 secondes

**Services affectés** :
- ✅ NotificationQueueWorker
- ✅ RedisScalingService

**Cause** : Redis n'est pas accessible. L'URL Redis est probablement incorrecte ou le service n'existe pas.

---

### 3. **ERREUR : GPU Workers Inaccessibles**

**Erreur** :
```
failed to lookup address information: Name or service not known
http://yukpo-gpu-workers:8080/api/v1/metrics
```

**Cause** : Les workers GPU ne sont pas accessibles depuis Cloud Run (probablement dans un autre réseau/VPC).

---

## 🔍 Analyse de la Configuration

### Variables d'Environnement Cloud Run

**DATABASE_URL** : Récupéré depuis le secret GCP `database-url`  
**REDIS_URL** : Récupéré depuis le secret GCP `redis-url`  
**GPU_ENDPOINT** : `http://yukpo-gpu-workers:8080` (hardcodé)

---

## ✅ Solutions

### Solution 1 : Corriger DATABASE_URL

**Problème** : Le secret `database-url` contient probablement :
- Un mauvais utilisateur (`yukpo_user` au lieu de `yukpo_admin`)
- Un mauvais mot de passe
- Une mauvaise base de données

**Action** : Vérifier et mettre à jour le secret `database-url` dans GCP Secret Manager.

**Format attendu** :
```
postgresql://yukpo_admin:PASSWORD@/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME/yukpo_db?sslmode=require
```

**OU** (si connexion Unix socket) :
```
postgresql://yukpo_admin:PASSWORD@/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME/yukpo_db
```

---

### Solution 2 : Corriger REDIS_URL

**Problème** : Le secret `redis-url` contient probablement une URL incorrecte ou un service inexistant.

**Action** : Vérifier et mettre à jour le secret `redis-url` dans GCP Secret Manager.

**Format attendu** :
- Si Redis est sur Cloud Memorystore : `redis://IP:PORT`
- Si Redis est externe : `redis://HOST:PORT`
- Si Redis n'est pas disponible : Désactiver les services Redis ou configurer un Redis valide

---

### Solution 3 : Corriger GPU_ENDPOINT (Optionnel)

**Problème** : Les workers GPU ne sont pas accessibles depuis Cloud Run.

**Action** : 
- Si GPU n'est pas nécessaire : Désactiver `GPU_ENABLED=false`
- Si GPU est nécessaire : Configurer un VPC connector ou utiliser une IP publique

---

## 🚀 Actions Immédiates

### 1. Vérifier le Secret DATABASE_URL

```powershell
gcloud secrets versions access latest --secret=database-url --project=yukpo-project
```

**Vérifier** :
- ✅ Utilisateur : `yukpo_admin` (pas `yukpo_user`)
- ✅ Base de données : `yukpo_db` (pas `yukpo_postgres`)
- ✅ Format : Unix socket si Cloud SQL, ou IP publique si externe

### 2. Vérifier le Secret REDIS_URL

```powershell
gcloud secrets versions access latest --secret=redis-url --project=yukpo-project
```

**Vérifier** :
- ✅ URL Redis valide
- ✅ Service Redis accessible depuis Cloud Run

### 3. Mettre à Jour les Secrets si Nécessaire

Utiliser le script `scripts/update-database-secret-and-test.ps1` pour mettre à jour `database-url`.

---

## 📊 Résumé

**Problème Principal** : ❌ **Authentification PostgreSQL échouée**  
**Utilisateur utilisé** : `yukpo_user` (probablement incorrect)  
**Utilisateur attendu** : `yukpo_admin` (selon les fichiers de configuration)

**Action Requise** : Mettre à jour le secret `database-url` avec le bon utilisateur et mot de passe.

---

## 🔗 URLs Utiles

- **Logs Cloud Run** : https://console.cloud.google.com/run/detail/europe-west1/yukpo-backend/logs?project=yukpo-project
- **Secret Manager** : https://console.cloud.google.com/security/secret-manager?project=yukpo-project
- **Cloud SQL** : https://console.cloud.google.com/sql/instances?project=yukpo-project

