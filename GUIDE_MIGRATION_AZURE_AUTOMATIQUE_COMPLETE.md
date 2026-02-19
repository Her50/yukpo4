# 🚀 Guide : Migration Automatique Complète AWS → Azure

**Date** : 2026-02-14  
**Objectif** : Migration automatique complète du backend AWS vers Azure + Configuration GitHub

---

## ✅ SCRIPT AUTOMATIQUE CRÉÉ

**Fichier** : `scripts/migrate-and-setup-azure-complete.ps1`

**Ce script fait automatiquement** :
1. ✅ Connexion Azure (simplifiée avec GitHub)
2. ✅ Création du Resource Group
3. ✅ Création d'Azure Container Registry (ACR)
4. ✅ Création de l'App Registration pour GitHub Actions
5. ✅ Configuration des permissions Azure
6. ✅ Configuration automatique des secrets GitHub (via GitHub CLI)
7. ✅ Récupération des variables d'environnement depuis AWS
8. ✅ Création de la base de données PostgreSQL
9. ✅ Création de l'App Service Plan
10. ✅ Création de l'App Service
11. ✅ Configuration de toutes les variables d'environnement
12. ✅ Configuration du health check

---

## 🚀 UTILISATION

### Option 1 : Migration Complète (Recommandé)

**Exécuter** :
```powershell
.\scripts\migrate-and-setup-azure-complete.ps1
```

**Ce script fait tout** :
- ✅ Configuration Azure complète
- ✅ Migration du backend
- ✅ Configuration GitHub automatique

---

### Option 2 : Configuration Azure Seulement

**Si vous voulez seulement configurer Azure (sans migration)** :
```powershell
.\scripts\setup-azure-complete-auto.ps1
```

**Ce script fait** :
- ✅ Configuration Azure (ACR, App Registration, etc.)
- ✅ Configuration des secrets GitHub
- ⚠️ Pas de migration du backend

---

## 📋 PRÉREQUIS

### 1. Azure CLI Installé

**Vérifier** :
```powershell
az version
```

**Si non installé** :
```powershell
winget install Microsoft.AzureCLI
```

---

### 2. GitHub CLI Installé (Optionnel mais Recommandé)

**Vérifier** :
```powershell
gh version
```

**Si non installé** :
```powershell
winget install GitHub.cli
```

**Si GitHub CLI n'est pas installé** :
- ⚠️ Les secrets GitHub devront être configurés manuellement
- Le script affichera les valeurs à copier

---

### 3. Connexion Azure

**Le script vous connectera automatiquement** :
- Si vous avez créé Azure avec GitHub, utilisez l'authentification GitHub
- Sinon, un navigateur s'ouvrira pour la connexion

---

## 🔄 PROCESSUS AUTOMATIQUE

### Étape 1 : Connexion Azure
```
✅ Vérification Azure CLI
✅ Connexion automatique (avec GitHub si disponible)
✅ Récupération des IDs (Subscription, Tenant)
```

### Étape 2 : Configuration Azure
```
✅ Création Resource Group
✅ Création ACR (Azure Container Registry)
✅ Création App Registration
✅ Assignation permissions Contributor
```

### Étape 3 : Configuration GitHub
```
✅ Configuration secrets GitHub (automatique si GitHub CLI disponible)
   - AZURE_CLIENT_ID
   - AZURE_TENANT_ID
   - AZURE_SUBSCRIPTION_ID
```

### Étape 4 : Migration Backend
```
✅ Récupération variables d'environnement depuis AWS
✅ Génération secrets (Database Password, JWT_SECRET)
✅ Création base de données PostgreSQL
✅ Création App Service Plan
✅ Création App Service
✅ Configuration variables d'environnement
✅ Configuration health check
```

---

## ✅ RÉSULTAT

**Après exécution** :
- ✅ Backend migré vers Azure
- ✅ Base de données PostgreSQL créée
- ✅ App Service configuré
- ✅ Secrets GitHub configurés
- ✅ Workflow GitHub Actions prêt

**À chaque push sur `main`** :
- ✅ Build automatique Docker
- ✅ Push vers GitHub Container Registry
- ✅ Push vers AWS ECR (en parallèle)
- ✅ Push vers Azure ACR (en parallèle)
- ✅ Déploiement AWS ECS
- ✅ Déploiement Azure App Service

---

## 🔐 SECRETS GÉNÉRÉS

**Le script génère automatiquement** :
- ✅ Database Password (32 caractères)
- ✅ JWT_SECRET (64 caractères)

**⚠️ IMPORTANT** : Sauvegardez ces secrets dans un endroit sûr !

---

## 🌐 PROCHAINES ÉTAPES

**Après migration** :

1. **Mettre à jour DNS Cloudflare** :
   - Type: CNAME
   - Name: api
   - Target: `[App Service URL]`
   - Proxy: Activé (nuage orange)

2. **Tester le backend** :
   ```bash
   curl https://api.yukpomnang.com/healthz
   ```

3. **Tester le workflow GitHub Actions** :
   ```bash
   git push origin main
   ```

4. **Configurer le budget Azure** :
   - Azure Portal → Cost Management → Budgets → Add

---

## 📊 RÉSUMÉ

| Action | Automatique | Manuel |
|--------|-------------|--------|
| **Connexion Azure** | ✅ | ❌ |
| **Création ACR** | ✅ | ❌ |
| **App Registration** | ✅ | ❌ |
| **Secrets GitHub** | ✅ (si GitHub CLI) | ⚠️ Sinon |
| **Migration Backend** | ✅ | ❌ |
| **Configuration DB** | ✅ | ❌ |
| **Configuration App Service** | ✅ | ❌ |

---

**Date** : 2026-02-14  
**Statut** : Scripts créés - Prêt à exécuter



