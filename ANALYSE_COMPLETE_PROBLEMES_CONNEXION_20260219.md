# 🔍 Analyse Complète des Problèmes de Connexion Backend GCP

**Date** : 2026-02-19  
**Service** : yukpo-backend  
**URL** : https://yukpo-backend-mkzqhoqhaq-ew.a.run.app

---

## ❌ PROBLÈMES IDENTIFIÉS DANS LES LOGS

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

**Cause probable** : 
Le secret `database-url` dans GCP Secret Manager contient un mot de passe qui ne correspond pas au mot de passe réel de l'utilisateur `yukpo_user` dans Cloud SQL.

**Solution** : Réinitialiser le mot de passe PostgreSQL et mettre à jour le secret.

---

### 2. **ERREUR : Connexion Redis Échouée**

**Erreur** :
```
Redis connection failed: Connexion Redis échouée: failed to lookup address information: Name or service not known
```

**Fréquence** : Erreur répétée toutes les 2-3 secondes

**Services affectés** :
- ✅ NotificationQueueWorker
- ✅ RedisScalingService

**Cause probable** : 
Le secret `redis-url` contient une URL Redis invalide, un placeholder, ou le service Redis n'existe pas/est inaccessible.

**Solution** : 
- Si Redis n'est pas nécessaire : Laisser le secret vide ou désactiver les services Redis
- Si Redis est nécessaire : Configurer un service Redis valide (Memorystore ou Upstash)

---

### 3. **ERREUR : GPU Workers Inaccessibles**

**Erreur** :
```
failed to lookup address information: Name or service not known
http://yukpo-gpu-workers:8080/api/v1/metrics
```

**Cause** : Les workers GPU ne sont pas accessibles depuis Cloud Run (probablement dans un autre réseau/VPC).

**Impact** : Non critique si les fonctionnalités GPU ne sont pas utilisées.

**Solution** : 
- Si GPU n'est pas nécessaire : Désactiver `GPU_ENABLED=false`
- Si GPU est nécessaire : Configurer un VPC connector ou utiliser une IP publique

---

## 🔍 ANALYSE DE LA CONFIGURATION

### Instance Cloud SQL

- **Nom** : `yukpo-postgres`
- **Version** : PostgreSQL 15
- **Région** : `europe-west1`
- **Statut** : ✅ RUNNABLE
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`

### Bases de Données

D'après la documentation, deux bases existent :
- `yukpo_db` : Base principale avec toutes les migrations (362 migrations, 263 tables)
- `yukpo_postgres` : Base vide (0 migrations)

**Base utilisée actuellement** : `yukpo_db` (selon le script `update-database-secret-and-test.ps1`)

### Utilisateur PostgreSQL

- **Nom** : `yukpo_user`
- **Type** : BUILT_IN
- **Statut** : ✅ Existe dans Cloud SQL

### Variables d'Environnement Cloud Run

- **DATABASE_URL** : Récupéré depuis le secret GCP `database-url`
- **REDIS_URL** : Récupéré depuis le secret GCP `redis-url`
- **GPU_ENDPOINT** : `http://yukpo-gpu-workers:8080` (hardcodé)

---

## ✅ SOLUTIONS DÉTAILLÉES

### Solution 1 : Corriger DATABASE_URL (PRIORITÉ CRITIQUE)

**Problème** : Le mot de passe dans le secret `database-url` ne correspond pas au mot de passe réel de `yukpo_user` dans Cloud SQL.

**Action** : Exécuter le script de correction :

```powershell
.\scripts\update-database-secret-and-test.ps1
```

**Ce que fait le script** :
1. Génère un nouveau mot de passe sécurisé (32 caractères)
2. Réinitialise le mot de passe dans Cloud SQL pour `yukpo_user`
3. URL-encode le mot de passe
4. Construit DATABASE_URL avec le format Unix socket :
   ```
   postgresql://yukpo_user:PASSWORD_ENCODED@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```
5. Met à jour le secret `database-url` dans GCP Secret Manager

**Format attendu** :
```
postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Important** :
- ✅ Utiliser le format Unix socket (`host=/cloudsql/...`) pour Cloud Run
- ✅ URL-encoder le mot de passe (caractères spéciaux comme `#`, `%`, `=`, `@`)
- ✅ Utiliser la base `yukpo_db` (base principale avec toutes les migrations)

---

### Solution 2 : Corriger REDIS_URL

**Option A : Si Redis n'est pas nécessaire**

Désactiver les services Redis ou laisser le secret vide. Le backend fonctionnera en mode dégradé (sans cache Redis, sans rate limiting Redis, etc.).

**Option B : Si Redis est nécessaire**

1. **Créer un service Redis Memorystore** :
   ```powershell
   gcloud redis instances create yukpo-redis `
     --size=1 `
     --region=europe-west1 `
     --network=projects/yukpo-project/global/networks/default `
     --project=yukpo-project
   ```

2. **Récupérer l'IP du service Redis** :
   ```powershell
   gcloud redis instances describe yukpo-redis --region=europe-west1 --project=yukpo-project --format="value(host)"
   ```

3. **Mettre à jour le secret `redis-url`** :
   ```powershell
   $REDIS_IP = "10.x.x.x"  # IP du service Redis
   $REDIS_URL = "redis://$REDIS_IP:6379/0"
   echo $REDIS_URL | gcloud secrets versions add redis-url --data-file=- --project=yukpo-project
   ```

**Format attendu** :
- Memorystore : `redis://10.x.x.x:6379/0`
- Upstash : `rediss://default:PASSWORD@ENDPOINT.upstash.io:6379/0` (avec TLS)

---

### Solution 3 : Corriger GPU_ENDPOINT (Optionnel)

**Si GPU n'est pas nécessaire** :

Désactiver dans les variables d'environnement Cloud Run :
```powershell
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-env-vars="GPU_ENABLED=false"
```

**Si GPU est nécessaire** :

Configurer un VPC connector pour accéder aux workers GPU depuis Cloud Run.

---

## 🚀 ACTIONS IMMÉDIATES

### Étape 1 : Diagnostic Complet

Exécuter le script de diagnostic :
```powershell
.\scripts\diagnose-and-fix-connection-issues.ps1
```

Ce script va :
- ✅ Vérifier l'instance Cloud SQL
- ✅ Lister les bases de données
- ✅ Vérifier l'utilisateur PostgreSQL
- ✅ Analyser le secret DATABASE_URL (contourne l'erreur Unicode)
- ✅ Analyser le secret REDIS_URL
- ✅ Analyser les logs récents
- ✅ Vérifier la configuration Cloud Run
- ✅ Fournir des recommandations

### Étape 2 : Corriger DATABASE_URL

Exécuter le script de correction :
```powershell
.\scripts\update-database-secret-and-test.ps1
```

### Étape 3 : Redéployer Cloud Run

Après avoir mis à jour les secrets, redéployer le service Cloud Run pour charger les nouveaux secrets :
```powershell
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project
```

**Note** : Cloud Run charge automatiquement la dernière version des secrets, mais un redéploiement peut être nécessaire pour forcer le rechargement.

### Étape 4 : Vérifier les Logs

Surveiller les logs pour confirmer que les erreurs ont disparu :
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" `
  --limit=50 `
  --project=yukpo-project `
  --freshness=10m `
  --format="table(timestamp,severity,textPayload)"
```

**Vérifier** :
- ✅ Plus d'erreurs `password authentication failed`
- ✅ Plus d'erreurs `Redis connection failed` (si Redis est configuré)
- ✅ Services démarrant correctement

---

## 📊 RÉSUMÉ DES PROBLÈMES

| Problème | Priorité | Impact | Solution |
|----------|----------|--------|----------|
| Authentification PostgreSQL échouée | 🔴 CRITIQUE | Application non fonctionnelle | Réinitialiser mot de passe + mettre à jour secret |
| Connexion Redis échouée | 🟡 MOYEN | Fonctionnalités dégradées (cache, rate limiting) | Configurer Redis ou désactiver |
| GPU Workers inaccessibles | 🟢 FAIBLE | Fonctionnalités GPU non disponibles | Configurer VPC ou désactiver |

---

## 🔗 RESSOURCES UTILES

- **Logs Cloud Run** : https://console.cloud.google.com/run/detail/europe-west1/yukpo-backend/logs?project=yukpo-project
- **Secret Manager** : https://console.cloud.google.com/security/secret-manager?project=yukpo-project
- **Cloud SQL** : https://console.cloud.google.com/sql/instances?project=yukpo-project
- **Cloud Run** : https://console.cloud.google.com/run/detail/europe-west1/yukpo-backend?project=yukpo-project

---

## 📝 NOTES IMPORTANTES

1. **Format DATABASE_URL** : Utiliser le format Unix socket pour Cloud Run (`host=/cloudsql/...`)
2. **URL Encoding** : Le mot de passe doit être URL-encodé (caractères spéciaux comme `#`, `%`, `=`, `@`)
3. **Base de données** : Utiliser `yukpo_db` (base principale avec toutes les migrations)
4. **Redéploiement** : Après mise à jour des secrets, redéployer Cloud Run pour charger les nouveaux secrets
5. **Erreur Unicode** : Le script `diagnose-and-fix-connection-issues.ps1` contourne l'erreur Unicode en utilisant `--format="value(payload.data)"` et décodage base64

---

**Date de création** : 2026-02-19  
**Dernière mise à jour** : 2026-02-19

