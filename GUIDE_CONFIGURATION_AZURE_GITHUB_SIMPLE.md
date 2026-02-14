# 🔐 Guide : Configuration Azure avec GitHub (Simple)

**Date** : 2026-02-14  
**Objectif** : Configurer l'authentification Azure via GitHub pour les workflows

---

## ✅ AVANTAGE

**Si vous avez créé Azure avec GitHub** :
- ✅ **Authentification automatique** : GitHub Actions peut s'authentifier avec Azure
- ✅ **Pas de secrets sensibles** : Utilise OIDC (OpenID Connect)
- ✅ **Sécurisé** : Pas de credentials stockés

---

## 📋 CONFIGURATION SIMPLE (5 minutes)

### Étape 1 : Créer Azure Container Registry (ACR)

**Option A : Via Azure Portal** (Recommandé)
1. Azure Portal → **Create a resource** → **Container Registry**
2. **Configuration** :
   - **Name** : `yukpomnangregistry` (doit être unique globalement)
   - **Resource group** : `yukpomnang-rg` (créer si nécessaire)
   - **Location** : `West Europe`
   - **SKU** : `Basic` (gratuit avec crédit $200)
   - **Admin user** : `Enabled` (pour GitHub Actions)
   - **Create**

**Option B : Via Script PowerShell** (Automatique)
```powershell
# Le script migrate-aws-to-azure-auto.ps1 créera l'ACR automatiquement
# Ou créer manuellement :
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr create `
  --resource-group yukpomnang-rg `
  --name yukpomnangregistry `
  --sku Basic `
  --admin-enabled true
```

---

### Étape 2 : Obtenir les IDs Azure

**Dans Azure Portal** :
1. **Subscriptions** → Sélectionner votre abonnement
2. **Notez** :
   - **Subscription ID** : `[AZURE_SUBSCRIPTION_ID]`
   - **Tenant ID** : Visible dans "Overview" → `[AZURE_TENANT_ID]`

**Pour Client ID** :
1. **Azure Active Directory** → **App registrations**
2. Si vous avez créé Azure avec GitHub, chercher une app avec votre nom GitHub
3. **Notez** : **Application (client) ID** → `[AZURE_CLIENT_ID]`

**Si pas d'App Registration** :
1. **Azure Active Directory** → **App registrations** → **New registration**
2. **Name** : `github-actions-yukpomnang`
3. **Register**
4. **Notez** : Client ID et Tenant ID

---

### Étape 3 : Assigner les Permissions

**Dans Azure Portal** :
1. **Subscriptions** → [votre-abonnement] → **Access control (IAM)**
2. **Add** → **Add role assignment**
3. **Role** : `Contributor`
4. **Assign access to** : `User, group, or service principal`
5. **Select** : Chercher votre App Registration ou votre compte GitHub
6. **Save**

---

### Étape 4 : Configurer les Secrets GitHub

**Dans GitHub** :
1. Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** → Ajouter :

**Secret 1** :
- **Name** : `AZURE_CLIENT_ID`
- **Value** : `[votre-client-id]`

**Secret 2** :
- **Name** : `AZURE_TENANT_ID`
- **Value** : `[votre-tenant-id]`

**Secret 3** :
- **Name** : `AZURE_SUBSCRIPTION_ID`
- **Value** : `[votre-subscription-id]`

---

## ✅ VÉRIFICATION

**Après configuration** :
- ✅ Le workflow GitHub Actions peut se connecter à Azure
- ✅ Push automatique vers Azure Container Registry (ACR)
- ✅ Déploiement automatique sur Azure App Service
- ✅ En parallèle avec AWS ECR

---

## 🚀 WORKFLOW CRÉÉ

**Fichier** : `.github/workflows/docker-build-optimized.yml`

**Jobs en parallèle** :
1. ✅ **build-and-push** : Build Docker image
2. ✅ **push-to-aws** : Push vers AWS ECR
3. ✅ **push-to-azure** : Push vers Azure ACR + Déploiement App Service
4. ✅ **deploy-to-ecs** : Déploiement AWS ECS

**Résultat** : À chaque push sur `main` :
- ✅ Build automatique
- ✅ Push vers GitHub Container Registry
- ✅ Push vers AWS ECR (en parallèle)
- ✅ Push vers Azure ACR (en parallèle)
- ✅ Déploiement AWS ECS
- ✅ Déploiement Azure App Service

---

## 📊 RÉSUMÉ

| Action | AWS | Azure |
|--------|-----|-------|
| **Build** | ✅ Automatique | ✅ Automatique |
| **Push Registry** | ✅ ECR | ✅ ACR |
| **Déploiement** | ✅ ECS | ✅ App Service |
| **Parallèle** | ✅ Oui | ✅ Oui |

---

**Date** : 2026-02-14  
**Statut** : Workflow créé - Configuration Azure requise

