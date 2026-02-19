# 🔧 Guide de Configuration des Variables d'Environnement dans GCP Cloud Run

**Date**: 2026-02-18  
**Service**: yukpo-backend  
**Région**: europe-west1

---

## 🚨 Variables Critiques Manquantes

D'après l'analyse des logs, les problèmes suivants ont été identifiés:

1. **Pool de connexions DB saturé** → Nécessite `DB_POOL_SIZE=10`
2. **Appels IA qui échouent** → Nécessite `OPENAI_API_KEY` et autres clés IA
3. **Erreurs 503** → Conséquence du problème de pool DB

---

## 📋 Variables à Configurer dans GCP Cloud Run

### 1. Variables d'Environnement (Non-Sensibles)

Ces variables peuvent être ajoutées directement comme variables d'environnement:

```bash
# Pool de connexions DB (CRITIQUE - Résout la saturation)
DB_POOL_SIZE=10
DB_POOL_MIN_SIZE=2
DB_ACQUIRE_TIMEOUT_SECS=30

# Configuration Cloud Run
CLOUD_RUN=true
ENVIRONMENT=production
APP_ENV=production
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
LOG_FORMAT=json

# Migrations
ENABLE_AUTO_MIGRATIONS=true
SQLX_OFFLINE=true

# CORS
ALLOWED_ORIGINS=https://api.yukpo.com,https://yukpo.com
APP_BASE_URL=https://api.yukpo.com
```

### 2. Secrets (Sensibles - Via Secret Manager)

Ces variables doivent être stockées dans **GCP Secret Manager** et référencées:

```bash
# Base de données
DATABASE_URL → Secret: database-url

# JWT
JWT_SECRET → Secret: jwt-secret

# Redis
REDIS_URL → Secret: redis-url

# MongoDB
MONGODB_URL → Secret: mongodb-url

# Clés API IA (CRITIQUE pour fonctionnalités IA)
OPENAI_API_KEY → Secret: openai-api-key
MISTRAL_API_KEY → Secret: mistral-api-key (optionnel)
GEMINI_API_KEY → Secret: gemini-api-key (optionnel)
ANTHROPIC_API_KEY → Secret: anthropic-api-key (optionnel)
```

---

## 🔧 Méthode 1: Configuration via Console GCP (Recommandé)

### Étape 1: Accéder à Cloud Run

1. Aller sur [GCP Console](https://console.cloud.google.com)
2. Naviguer vers **Cloud Run** → **yukpo-backend**
3. Cliquer sur **"Modifier et déployer une nouvelle révision"**

### Étape 2: Ajouter les Variables d'Environnement

1. Aller dans l'onglet **"Variables et secrets"**
2. Cliquer sur **"Ajouter une variable"** pour chaque variable non-sensible
3. Ajouter les variables listées dans la section 1 ci-dessus

### Étape 3: Créer les Secrets dans Secret Manager

1. Aller dans **Secret Manager** dans GCP Console
2. Créer les secrets suivants:

#### Créer le secret `openai-api-key`:
```bash
# Via Console:
1. Secret Manager → Créer un secret
2. Nom: openai-api-key
3. Valeur: sk-proj-votre-cle-openai-ici
4. Créer
```

#### Créer les autres secrets IA (optionnels):
- `mistral-api-key`
- `gemini-api-key`
- `anthropic-api-key`

### Étape 4: Référencer les Secrets dans Cloud Run

1. Dans Cloud Run → Variables et secrets
2. Cliquer sur **"Référencer un secret"**
3. Sélectionner le secret (ex: `openai-api-key`)
4. Nom de la variable: `OPENAI_API_KEY`
5. Version: `latest`
6. Répéter pour tous les secrets

### Étape 5: Déployer

1. Cliquer sur **"Déployer"**
2. Attendre la fin du déploiement
3. Vérifier les logs pour confirmer que les variables sont chargées

---

## 🔧 Méthode 2: Configuration via gcloud CLI

### Étape 1: Créer les Secrets dans Secret Manager

```bash
# Définir les variables
export PROJECT_ID="yukpo-project"
export REGION="europe-west1"
export SERVICE_NAME="yukpo-backend"

# Créer le secret OPENAI_API_KEY
echo -n "sk-proj-votre-cle-openai-ici" | gcloud secrets create openai-api-key \
  --project=$PROJECT_ID \
  --data-file=-

# Créer les autres secrets IA (optionnels)
echo -n "votre-cle-mistral" | gcloud secrets create mistral-api-key \
  --project=$PROJECT_ID \
  --data-file=-

echo -n "votre-cle-gemini" | gcloud secrets create gemini-api-key \
  --project=$PROJECT_ID \
  --data-file=-

echo -n "votre-cle-anthropic" | gcloud secrets create anthropic-api-key \
  --project=$PROJECT_ID \
  --data-file=-
```

### Étape 2: Donner les Permissions au Service Account

```bash
# Récupérer le service account de Cloud Run
export SERVICE_ACCOUNT=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(spec.template.spec.serviceAccountName)")

# Donner l'accès aux secrets
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

# Répéter pour les autres secrets
gcloud secrets add-iam-policy-binding mistral-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

### Étape 3: Mettre à Jour Cloud Run avec les Variables et Secrets

```bash
# Mettre à jour les variables d'environnement
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-env-vars="DB_POOL_SIZE=10,DB_POOL_MIN_SIZE=2,DB_ACQUIRE_TIMEOUT_SECS=30,CLOUD_RUN=true,ENVIRONMENT=production,APP_ENV=production,HOST=0.0.0.0,PORT=8080,RUST_LOG=info,LOG_FORMAT=json,ENABLE_AUTO_MIGRATIONS=true,SQLX_OFFLINE=true" \
  --update-secrets="OPENAI_API_KEY=openai-api-key:latest,MISTRAL_API_KEY=mistral-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

---

## ✅ Vérification

### Vérifier que les Variables sont Configurées

```bash
# Lister les variables d'environnement
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(spec.template.spec.containers[0].env)"

# Vérifier les secrets référencés
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(spec.template.spec.containers[0].envFrom)"
```

### Vérifier dans les Logs

Après le déploiement, vérifier les logs pour confirmer:

```bash
# Voir les logs récents
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --limit=50 \
  --project=$PROJECT_ID \
  --format=json
```

**Rechercher dans les logs**:
- `✅ Présente` pour les variables critiques
- `OPENAI_API_KEY` dans les logs de démarrage
- Aucune erreur `non configurée` ou `missing`

---

## 🔍 Script de Vérification Automatique

Un script PowerShell est disponible: `scripts/verify-gcp-variables.ps1`

```powershell
.\scripts\verify-gcp-variables.ps1
```

Ce script vérifie:
- ✅ Présence des variables critiques
- ✅ Présence des secrets dans Secret Manager
- ✅ Permissions du service account
- ✅ Configuration dans Cloud Run

---

## 🚨 Problèmes Courants

### Problème 1: "Secret not found"

**Cause**: Le secret n'existe pas dans Secret Manager

**Solution**:
1. Vérifier que le secret existe: `gcloud secrets list`
2. Créer le secret si manquant (voir Méthode 2, Étape 1)

### Problème 2: "Permission denied"

**Cause**: Le service account n'a pas accès au secret

**Solution**:
1. Vérifier les permissions: `gcloud secrets get-iam-policy openai-api-key`
2. Donner l'accès (voir Méthode 2, Étape 2)

### Problème 3: "Variable not found at runtime"

**Cause**: La variable n'est pas référencée correctement dans Cloud Run

**Solution**:
1. Vérifier la configuration: `gcloud run services describe ...`
2. Vérifier que le nom de la variable correspond exactement (sensible à la casse)

---

## 📝 Checklist Complète

- [ ] Variables d'environnement non-sensibles ajoutées (DB_POOL_SIZE, etc.)
- [ ] Secret `openai-api-key` créé dans Secret Manager
- [ ] Secrets IA optionnels créés (mistral, gemini, anthropic)
- [ ] Permissions données au service account Cloud Run
- [ ] Secrets référencés dans Cloud Run avec les bons noms de variables
- [ ] Service redéployé avec les nouvelles configurations
- [ ] Logs vérifiés pour confirmer le chargement des variables
- [ ] Tests de connexion réussis
- [ ] Tests d'appels IA réussis

---

## 🔗 Ressources

- [Documentation Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Documentation Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Documentation gcloud run services update](https://cloud.google.com/sdk/gcloud/reference/run/services/update)


