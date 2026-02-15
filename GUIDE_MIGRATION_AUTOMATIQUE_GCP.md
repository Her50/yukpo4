# 🚀 Guide : Migration Automatique Complète vers Google Cloud Platform (GCP)

**Date** : 2026-02-14  
**Objectif** : Automatiser la migration complète du backend vers GCP

---

## ✅ OUI, GCP A UN CLIENT CLI COMPLET !

**Google Cloud CLI (`gcloud`)** permet d'automatiser :
- ✅ Migration du backend
- ✅ Création de Cloud SQL (PostgreSQL)
- ✅ Création des tables, index et fonctions
- ✅ Automatisation du build avec Git (GitHub Actions)
- ✅ Déploiement automatique sur Cloud Run ou GKE

---

## 📦 INSTALLATION GOOGLE CLOUD CLI

### Windows (PowerShell)

**Via winget** :
```powershell
winget install Google.CloudSDK
```

**Ou téléchargement manuel** :
1. Aller sur https://cloud.google.com/sdk/docs/install
2. Télécharger le SDK pour Windows
3. Installer

**Vérifier l'installation** :
```powershell
gcloud version
```

---

## 🔐 CONFIGURATION INITIALE

### 1. Connexion à GCP

```powershell
gcloud auth login
```

**Ce qui se passe** :
- Un navigateur s'ouvre
- Connectez-vous avec votre compte Google
- Autorisez l'accès

### 2. Configurer le projet

```powershell
# Créer un projet (ou utiliser un existant)
gcloud projects create yukpo-project --name="Yukpo Project"

# Définir le projet actif
gcloud config set project yukpo-project
```

### 3. Activer les APIs nécessaires

```powershell
# Cloud SQL API
gcloud services enable sqladmin.googleapis.com

# Cloud Run API (pour déploiement)
gcloud services enable run.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com

# Cloud Build API (pour CI/CD)
gcloud services enable cloudbuild.googleapis.com
```

---

## 🗄️ CRÉATION AUTOMATIQUE DE CLOUD SQL (POSTGRESQL)

### Script PowerShell Complet

**Fichier** : `scripts/setup-gcp-postgres.ps1`

```powershell
# Créer une instance Cloud SQL PostgreSQL
gcloud sql instances create yukpo-db `
    --database-version=POSTGRES_15 `
    --tier=db-f1-micro `
    --region=europe-west1 `
    --root-password=[GENERATED_PASSWORD] `
    --storage-type=SSD `
    --storage-size=20GB `
    --backup-start-time=03:00 `
    --enable-bin-log

# Créer la base de données
gcloud sql databases create yukpo_db --instance=yukpo-db

# Créer l'utilisateur
gcloud sql users create yukpo_admin `
    --instance=yukpo-db `
    --password=[GENERATED_PASSWORD]
```

---

## 🔄 MIGRATION AUTOMATIQUE DES TABLES, INDEX ET FONCTIONS

### Option 1 : Via Cloud SQL Proxy (Recommandé)

**Étape 1 : Installer Cloud SQL Proxy**

```powershell
# Télécharger Cloud SQL Proxy
$proxyUrl = "https://dl.google.com/cloudsql/cloud_sql_proxy_x64.exe"
Invoke-WebRequest -Uri $proxyUrl -OutFile "cloud_sql_proxy.exe"
```

**Étape 2 : Exécuter les migrations**

```powershell
# Démarrer le proxy (dans un terminal séparé)
.\cloud_sql_proxy.exe -instances=yukpo-project:europe-west1:yukpo-db=tcp:5432

# Dans un autre terminal, exécuter les migrations
cd backend
sqlx migrate run
```

### Option 2 : Via Cloud Build (Automatique)

**Créer un fichier** : `cloudbuild.yaml`

```yaml
steps:
  # Build l'image Docker
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/yukpo-backend', '.']
  
  # Push vers Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/yukpo-backend']
  
  # Exécuter les migrations
  - name: 'gcr.io/$PROJECT_ID/yukpo-backend'
    env:
      - 'DATABASE_URL=postgresql://user:pass@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-db'
    args: ['sqlx', 'migrate', 'run']
```

---

## 🚀 AUTOMATISATION BUILD AVEC GIT (GITHUB ACTIONS)

### Workflow GitHub Actions pour GCP

**Fichier** : `.github/workflows/gcp-deploy.yml`

```yaml
name: Deploy to Google Cloud Platform

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'

env:
  PROJECT_ID: yukpo-project
  SERVICE_NAME: yukpo-backend
  REGION: europe-west1

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v2'
      
      - name: 'Configure Docker for GCR'
        run: gcloud auth configure-docker
      
      - name: 'Build and Push Docker image'
        run: |
          docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA ./backend
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA
      
      - name: 'Deploy to Cloud Run'
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --set-env-vars DATABASE_URL=${{ secrets.GCP_DATABASE_URL }}
      
      - name: 'Run Database Migrations'
        run: |
          gcloud run jobs create migrate-db \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
            --region $REGION \
            --set-env-vars DATABASE_URL=${{ secrets.GCP_DATABASE_URL }} \
            --command sqlx \
            --args migrate,run
```

---

## 📋 SCRIPT COMPLET D'AUTOMATISATION

**Je vais créer un script PowerShell complet** qui automatise :
1. ✅ Installation de gcloud CLI
2. ✅ Connexion à GCP
3. ✅ Création du projet
4. ✅ Activation des APIs
5. ✅ Création de Cloud SQL (PostgreSQL)
6. ✅ Configuration des variables d'environnement
7. ✅ Déploiement sur Cloud Run
8. ✅ Configuration GitHub Actions

---

## 🔐 CONFIGURATION DES SECRETS GITHUB

**Secrets nécessaires** :
- `GCP_SA_KEY` : Service Account Key (JSON)
- `GCP_DATABASE_URL` : URL de connexion Cloud SQL
- `GCP_PROJECT_ID` : ID du projet GCP

**Créer un Service Account** :
```powershell
# Créer le Service Account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions"

# Assigner les permissions
gcloud projects add-iam-policy-binding yukpo-project \
    --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding yukpo-project \
    --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Créer la clé JSON
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@yukpo-project.iam.gserviceaccount.com
```

**Copier le contenu de `key.json`** dans le secret GitHub `GCP_SA_KEY`.

---

## ✅ AVANTAGES GCP

**Par rapport à Azure/AWS** :
- ✅ **CLI très complet** : `gcloud` est excellent
- ✅ **Documentation** : Très bonne
- ✅ **Intégration GitHub** : Native
- ✅ **Cloud SQL** : PostgreSQL managé facile
- ✅ **Cloud Run** : Déploiement serverless simple
- ✅ **Cloud Build** : CI/CD intégré
- ✅ **Crédit gratuit** : $300 pour 90 jours

---

## 📊 COMPARAISON AVEC AZURE

| Fonctionnalité | Azure | GCP |
|----------------|-------|-----|
| **CLI** | `az` | `gcloud` |
| **PostgreSQL** | Azure Database | Cloud SQL |
| **Déploiement** | App Service | Cloud Run |
| **CI/CD** | GitHub Actions | Cloud Build + GitHub Actions |
| **Container Registry** | ACR | GCR / Artifact Registry |
| **Automatisation** | ✅ Oui | ✅ Oui |

---

**Date** : 2026-02-14  
**Statut** : Guide créé - Scripts à créer


