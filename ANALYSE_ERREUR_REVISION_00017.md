# 🔍 Analyse Erreur Révision yukpo-backend-00017-92f

**Date**: 2026-02-15  
**Révision**: yukpo-backend-00017-92f  
**Erreur**: Container failed to start - timeout sur PORT=8080

---

## 📋 Commandes de Diagnostic

### 1. Vérifier les Logs de la Révision

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND resource.labels.revision_name=yukpo-backend-00017-92f" --limit=100 --format="table(timestamp,severity,textPayload)" --project=yukpo-project
```

### 2. Vérifier les Variables d'Environnement

```bash
gcloud run services describe yukpo-backend --region=europe-west1 --format="get(spec.template.spec.containers[0].env)" --project=yukpo-project
```

**Vérifier spécifiquement** :
- `CLOUD_RUN=true` (CRITIQUE)
- Variables GPU présentes
- `DATABASE_URL` présente

### 3. Vérifier le Timeout

```bash
gcloud run services describe yukpo-backend --region=europe-west1 --format="get(spec.template.spec.timeoutSeconds)" --project=yukpo-project
```

**Doit être** : `900` (15 minutes)

---

## 🔍 Problèmes Potentiels

### Problème 1: CLOUD_RUN Non Défini

Si `CLOUD_RUN` n'est pas `true`, le code utilise la connexion bloquante.

**Vérification** :
```bash
gcloud run services describe yukpo-backend --region=europe-west1 --format="value(spec.template.spec.containers[0].env[?(@.name=='CLOUD_RUN')].value)" --project=yukpo-project
```

**Solution** : Le workflow devrait définir `CLOUD_RUN=true`, mais vérifier qu'il est bien présent.

### Problème 2: Timeout Insuffisant

Si le timeout est encore à 300s, il peut être dépassé.

**Vérification** : Voir commande ci-dessus

**Solution** : Le workflow devrait définir `--timeout=900`, mais vérifier.

### Problème 3: Base de Données Non Accessible

Même avec `connect_lazy` et `min_connections=0`, si le script `start-cloud.sh` fait des retries, cela peut bloquer.

**Vérification** : Chercher dans les logs "En attente de la base de données AWS RDS"

**Solution** : Le script devrait sauter la vérification si `CLOUD_RUN=true`.

### Problème 4: Image Docker Non à Jour

L'image Docker peut ne pas contenir les dernières corrections.

**Vérification** :
```bash
gcloud container images list-tags gcr.io/yukpo-project/yukpo-backend --limit=5 --project=yukpo-project
```

**Solution** : Forcer un rebuild complet de l'image.

---

## ✅ Solutions à Appliquer

### Solution 1: Vérifier et Forcer les Variables

```bash
# Vérifier toutes les variables
gcloud run services describe yukpo-backend --region=europe-west1 --format="get(spec.template.spec.containers[0].env)" --project=yukpo-project

# Forcer CLOUD_RUN=true si manquant
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="CLOUD_RUN=true" \
  --project=yukpo-project
```

### Solution 2: Forcer le Timeout

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --timeout=900 \
  --cpu-boost \
  --cpu-throttling \
  --project=yukpo-project
```

### Solution 3: Vérifier le Workflow GitHub Actions

Vérifier que le dernier workflow a bien :
1. Reconstruit l'image Docker
2. Défini toutes les variables (CLOUD_RUN, GPU, etc.)
3. Utilisé `--timeout=900`

### Solution 4: Forcer un Rebuild Complet

Si l'image n'est pas à jour, forcer un rebuild :

1. Aller sur GitHub Actions
2. Relancer le workflow "Docker Build Optimized"
3. Ou modifier un fichier pour déclencher un nouveau build

---

## 🔧 Script de Diagnostic Complet

Créer un script pour diagnostiquer tous les problèmes :

```powershell
# Vérifier CLOUD_RUN
$cloudRun = gcloud run services describe yukpo-backend --region=europe-west1 --format="value(spec.template.spec.containers[0].env[?(@.name=='CLOUD_RUN')].value)" --project=yukpo-project
Write-Host "CLOUD_RUN: $cloudRun"

# Vérifier timeout
$timeout = gcloud run services describe yukpo-backend --region=europe-west1 --format="value(spec.template.spec.timeoutSeconds)" --project=yukpo-project
Write-Host "Timeout: $timeout"

# Vérifier les logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND resource.labels.revision_name=yukpo-backend-00017-92f" --limit=50 --format="value(textPayload)" --project=yukpo-project | Select-String -Pattern "ERREUR|ERROR|database|PostgreSQL|CLOUD_RUN" | Select-Object -First 20
```

---

## 📝 Checklist de Vérification

- [ ] **CLOUD_RUN=true** défini dans Cloud Run
- [ ] **Timeout=900s** configuré
- [ ] **Image Docker** contient les dernières corrections
- [ ] **Script start-cloud.sh** saute vérification DB si CLOUD_RUN=true
- [ ] **Code Rust** utilise `min_connections=0` pour Cloud Run
- [ ] **Logs** ne montrent pas de retries DB bloquants

---

**⚠️ IMPORTANT** : Vérifier d'abord les logs pour identifier la cause exacte du timeout.

