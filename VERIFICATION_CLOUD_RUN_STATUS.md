# 🔍 Vérification du Statut Cloud Run et Connexion PostgreSQL

**Date** : 2026-02-14  
**Service** : `yukpo-backend`  
**Région** : `europe-west1`  
**Projet** : `yukpo-project`

---

## 📋 Commandes de Vérification

### 1. Vérifier le Statut du Service Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --project yukpo-project \
  --format="table(
    metadata.name,
    status.url,
    status.conditions[0].type,
    status.conditions[0].status,
    status.latestReadyRevisionName
  )"
```

**Résultat attendu** :
- ✅ `status.conditions[0].status: True` → Service actif
- ✅ `status.url` → URL du service (ex: `https://yukpo-backend-xxx.run.app`)
- ✅ `status.latestReadyRevisionName` → Nom de la révision active

---

### 2. Vérifier les Logs Récents

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit 50 \
  --project yukpo-project \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h
```

**Messages à rechercher** :

#### ✅ **Connexion PostgreSQL réussie** :
```
✅ Connexion PostgreSQL établie (tentative 1/1)
✅ Serveur lance sur http://0.0.0.0:8080
```

#### ✅ **Migrations en arrière-plan (Cloud Run)** :
```
🚀 Cloud Run: Démarrage des migrations SQLx en arrière-plan...
✅ Cloud Run: Migrations SQLx lancées en arrière-plan, serveur démarre immédiatement
```

#### ❌ **Erreurs de connexion PostgreSQL** :
```
❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL
❌ error communicating with database
```

---

### 3. Tester l'Endpoint HTTP

```bash
# Récupérer l'URL du service
SERVICE_URL=$(gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --project yukpo-project \
  --format="value(status.url)")

# Test health check
curl -v "$SERVICE_URL/health"

# Test endpoint racine
curl -v "$SERVICE_URL/"
```

**Résultat attendu** :
- ✅ HTTP 200 OK → Service répond
- ✅ Réponse JSON ou texte → Service fonctionnel

---

### 4. Vérifier la Connexion Cloud SQL

```bash
# Vérifier que Cloud SQL est connecté
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --project yukpo-project \
  --format="get(spec.template.spec.containers[0].env)" | grep DATABASE_URL
```

**Vérifier** :
- ✅ `DATABASE_URL` est défini
- ✅ Format: `postgresql://user:password@/dbname?host=/cloudsql/project:region:instance`

---

### 5. Vérifier les Révisions

```bash
gcloud run revisions list \
  --service yukpo-backend \
  --region europe-west1 \
  --project yukpo-project \
  --format="table(
    metadata.name,
    status.conditions[0].status,
    spec.containers[0].image,
    metadata.creationTimestamp
  )"
```

**Résultat attendu** :
- ✅ Au moins une révision avec `status.conditions[0].status: True`
- ✅ Image récente (dernière version)

---

## 🔍 Vérifications Spécifiques PostgreSQL

### Dans les Logs Cloud Run, rechercher :

1. **Connexion initiale** :
   ```
   ✅ Connexion PostgreSQL établie
   ```

2. **Migrations SQLx** (si non Cloud Run) :
   ```
   🚀 Application des migrations SQLx standard...
   ✅ Migrations SQLx standard appliquées avec succès
   ```

3. **Migrations en arrière-plan** (Cloud Run) :
   ```
   🚀 Cloud Run: Démarrage des migrations SQLx en arrière-plan...
   ✅ [MIGRATIONS SQLX Cloud Run] Migrations SQLx standard appliquées avec succès
   ```

4. **Erreurs de connexion** :
   ```
   ❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL
   error communicating with database
   ```

---

## 🚨 Problèmes Courants

### Problème 1 : Service non accessible
**Symptôme** : `status.conditions[0].status: False`

**Solutions** :
- Vérifier les logs pour les erreurs de démarrage
- Vérifier que le port 8080 est bien écouté
- Vérifier les variables d'environnement

### Problème 2 : Connexion PostgreSQL échoue
**Symptôme** : Logs montrent `❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL`

**Solutions** :
- Vérifier `DATABASE_URL` dans les variables d'environnement
- Vérifier que Cloud SQL Proxy est configuré (`--add-cloudsql-instances`)
- Vérifier les permissions du Service Account

### Problème 3 : Timeout au démarrage
**Symptôme** : Service démarre mais timeout avant d'être prêt

**Solutions** :
- Vérifier que les migrations sont bien en arrière-plan (Cloud Run)
- Augmenter `--startup-timeout` si nécessaire
- Vérifier que le serveur HTTP démarre immédiatement

---

## 📊 Script Automatique

Un script de vérification est disponible : `scripts/verify-cloud-run-status.sh`

**Usage** :
```bash
chmod +x scripts/verify-cloud-run-status.sh
./scripts/verify-cloud-run-status.sh
```

---

## ✅ Checklist de Vérification

- [ ] Service Cloud Run est actif (`status: True`)
- [ ] URL du service est accessible
- [ ] Health check répond (HTTP 200)
- [ ] Logs montrent "Connexion PostgreSQL établie"
- [ ] Logs montrent "Serveur lance sur http://0.0.0.0:8080"
- [ ] Migrations SQLx sont lancées (en arrière-plan pour Cloud Run)
- [ ] Aucune erreur critique dans les logs
- [ ] Révision active est récente

---

**Note** : Si `gcloud` n'est pas installé localement, utilisez la console Google Cloud :
- [Cloud Run Console](https://console.cloud.google.com/run?project=yukpo-project)
- [Cloud Logging](https://console.cloud.google.com/logs?project=yukpo-project)


