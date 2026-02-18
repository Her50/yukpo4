# 🔍 Audit Profond - Problème de Connexion GCP Cloud Run

**Date**: 2026-02-18  
**Problème**: Impossible de se connecter à l'application après migration vers GCP

---

## 📊 Résumé Exécutif

Après analyse approfondie du déploiement Git/Docker vers GCP Cloud Run, **7 problèmes critiques** ont été identifiés qui empêchent la connexion à l'application.

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. ❌ **STARTUP PROBE NON CONFIGURÉ**

**Problème**:
- Le workflow `.github/workflows/gcp-deploy.yml` ne configure **AUCUN startup probe**
- Cloud Run a un startup probe par défaut très strict (~60s)
- L'application Rust prend plus de temps à démarrer (initialisations DB, migrations, etc.)

**Impact**:
- Cloud Run considère le conteneur comme "non prêt" et échoue le déploiement
- Erreur: `The user-provided container failed the configured startup probe checks`

**Solution**:
```yaml
# Ajouter dans gcp-deploy.yml après --port 8080
--startup-probe=timeoutSeconds=10,periodSeconds=15,initialDelaySeconds=60,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Fichier**: `.github/workflows/gcp-deploy.yml` (lignes 286-302, 306-321, 331-347)

---

### 2. ❌ **CONFIGURATION CLOUD SQL INCOMPLÈTE**

**Problème**:
- Le workflow ajoute `--add-cloudsql-instances` mais plusieurs vérifications manquent:
  1. L'instance Cloud SQL `yukpo-postgres` existe-t-elle ?
  2. Le service account a-t-il les permissions `cloudsql.client` ?
  3. Le format DATABASE_URL est-il correct pour Unix socket ?

**Format DATABASE_URL attendu pour Cloud SQL Unix socket**:
```
postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**Vérifications nécessaires**:
```bash
# 1. Vérifier que l'instance existe
gcloud sql instances describe yukpo-postgres --project=yukpo-project

# 2. Vérifier les permissions du service account
gcloud projects get-iam-policy yukpo-project \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*@yukpo-project.iam.gserviceaccount.com"

# 3. Vérifier que le socket est monté dans Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances')"
```

**Fichier**: `.github/workflows/gcp-deploy.yml` (lignes 177-180, 294, 313, 339)

---

### 3. ❌ **ENTRYPOINT DOCKER COMPLEXE ET FRAGILE**

**Problème**:
- Le Dockerfile utilise un ENTRYPOINT conditionnel avec bash:
```dockerfile
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/startup-wrapper.sh; else /app/start-cloud.sh; fi"]
```

**Risques**:
1. Si `CLOUD_RUN` n'est pas défini correctement, le mauvais script est exécuté
2. Le wrapper Python peut échouer silencieusement
3. Les erreurs bash ne sont pas toujours visibles dans les logs Cloud Run

**Solution recommandée**:
- Utiliser directement `startup-wrapper.sh` comme ENTRYPOINT pour Cloud Run
- Ou simplifier la logique dans un script unique

**Fichier**: `backend/Dockerfile.cloud.optimized` (ligne 135)

---

### 4. ❌ **WRAPPER PYTHON PEUT ÉCHOUER**

**Problème**:
- Le script `startup-wrapper.sh` démarre un serveur Python minimal, puis le tue avant de démarrer Rust
- Si Python échoue ou si le port n'est pas libéré correctement, Rust ne peut pas démarrer

**Séquence problématique**:
1. Python démarre sur port 8080
2. Cloud Run détecte le serveur (startup probe OK)
3. Python est tué
4. Rust tente de bind sur 8080
5. **Si le port n'est pas libéré à temps → ERREUR**

**Solution**:
- Augmenter le délai entre kill Python et démarrage Rust (actuellement 5s)
- Ou utiliser un serveur minimal Rust directement (déjà implémenté dans main.rs)

**Fichier**: `backend/scripts/startup-wrapper.sh` (lignes 24-47)

---

### 5. ❌ **VARIABLES D'ENVIRONNEMENT MANQUANTES**

**Problème**:
- Le workflow définit `CLOUD_RUN=true` mais d'autres variables critiques peuvent manquer:
  - `PORT` (Cloud Run le définit automatiquement, mais vérification nécessaire)
  - `HOST` (doit être `0.0.0.0`)
  - `DATABASE_URL` (doit être au format Cloud SQL Unix socket)

**Vérification**:
```bash
# Vérifier les variables d'environnement du service
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Fichier**: `.github/workflows/gcp-deploy.yml` (lignes 81-169)

---

### 6. ❌ **SECRETS GCP SECRET MANAGER**

**Problème**:
- Le workflow référence des secrets: `jwt-secret:latest`, `database-url:latest`, etc.
- **Ces secrets doivent exister dans GCP Secret Manager avec ces noms exacts**

**Vérification**:
```bash
# Lister tous les secrets
gcloud secrets list --project=yukpo-project

# Vérifier qu'ils existent
gcloud secrets describe jwt-secret --project=yukpo-project
gcloud secrets describe database-url --project=yukpo-project
gcloud secrets describe redis-url --project=yukpo-project
gcloud secrets describe mongodb-url --project=yukpo-project
```

**Si les secrets n'existent pas**:
```bash
# Créer les secrets
echo -n "votre-jwt-secret" | gcloud secrets create jwt-secret --data-file=- --project=yukpo-project
echo -n "postgresql://user:pass@/db?host=/cloudsql/..." | gcloud secrets create database-url --data-file=- --project=yukpo-project
# etc.
```

**Fichier**: `.github/workflows/gcp-deploy.yml` (lignes 293, 312, 338)

---

### 7. ❌ **PERMISSIONS IAM SERVICE ACCOUNT**

**Problème**:
- Le service account Cloud Run doit avoir les permissions suivantes:
  1. `cloudsql.client` (pour se connecter à Cloud SQL)
  2. `secretmanager.secretAccessor` (pour lire les secrets)
  3. `storage.objects.*` (si utilisation de Cloud Storage)

**Vérification**:
```bash
# Vérifier le service account utilisé
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)"

# Vérifier les permissions
gcloud projects get-iam-policy yukpo-project \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:SERVICE_ACCOUNT_EMAIL"
```

**Si permissions manquantes**:
```bash
# Accorder les permissions
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 301, 320, 346)

---

## 🔍 CHECKLIST DE DIAGNOSTIC

### Étape 1: Vérifier les Logs Cloud Run
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=50 \
  --project=yukpo-project \
  --format=json
```

**Rechercher**:
- `[MAIN] 🚀 Application Rust démarre` → Le conteneur démarre-t-il ?
- `[MAIN] 🔍 CLOUD_RUN détecté: true` → La variable est-elle définie ?
- `[MAIN] ❌ ERREUR: Le socket Unix n'existe pas` → Cloud SQL non monté
- `error communicating with database` → Problème de connexion DB

### Étape 2: Vérifier l'État du Service
```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format=yaml
```

**Vérifier**:
- `status.conditions[].status` → Tous doivent être "True"
- `status.url` → L'URL du service
- `spec.template.spec.containers[0].env` → Variables d'environnement

### Étape 3: Tester la Connexion Manuelle
```bash
# Obtenir l'URL du service
SERVICE_URL=$(gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(status.url)" \
  --project=yukpo-project)

# Tester le health check
curl -v "$SERVICE_URL/health"
```

---

## ✅ PLAN D'ACTION PRIORITAIRE

### Priorité 1 (CRITIQUE - Bloque la connexion)
1. ✅ **Configurer le startup probe** dans le workflow
2. ✅ **Vérifier que l'instance Cloud SQL existe** et est accessible
3. ✅ **Vérifier que les secrets existent** dans Secret Manager
4. ✅ **Vérifier les permissions IAM** du service account

### Priorité 2 (IMPORTANT - Améliore la stabilité)
5. ✅ **Simplifier l'ENTRYPOINT Docker** (retirer la logique bash conditionnelle)
6. ✅ **Augmenter le délai** entre kill Python et démarrage Rust (10s au lieu de 5s)
7. ✅ **Ajouter des logs détaillés** dans startup-wrapper.sh pour diagnostic

### Priorité 3 (OPTIMISATION)
8. ✅ **Utiliser directement le serveur minimal Rust** (déjà dans main.rs) au lieu du wrapper Python
9. ✅ **Configurer un health check plus robuste** avec retry logic

---

## 📋 COMMANDES DE VÉRIFICATION RAPIDE

```bash
# 1. Vérifier l'état du service
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project

# 2. Vérifier les logs récents
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --project=yukpo-project

# 3. Vérifier les secrets
gcloud secrets list --project=yukpo-project

# 4. Vérifier l'instance Cloud SQL
gcloud sql instances describe yukpo-postgres --project=yukpo-project

# 5. Tester la connexion
curl -v $(gcloud run services describe yukpo-backend --region=europe-west1 --format="value(status.url)" --project=yukpo-project)/health
```

---

## 🎯 CONCLUSION

Le problème de connexion est **multi-factoriel**:
1. **Startup probe non configuré** → Cloud Run échoue le déploiement trop tôt
2. **Cloud SQL peut ne pas être accessible** → Vérifier instance, permissions, format DATABASE_URL
3. **Secrets peuvent manquer** → Vérifier Secret Manager
4. **Permissions IAM peuvent manquer** → Vérifier service account

**Action immédiate**: Exécuter la checklist de diagnostic ci-dessus pour identifier le problème exact.

---

**Date**: 2026-02-18  
**Statut**: 🔍 Audit complet - Prêt pour corrections

