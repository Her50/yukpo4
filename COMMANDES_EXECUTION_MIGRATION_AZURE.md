# 🚀 Commandes : Migration Automatique Complète Azure

**Date** : 2026-02-14  
**Usage** : Exécuter une seule commande pour tout configurer

---

## ✅ SCRIPT PRINCIPAL (Tout en Une)

**Exécuter cette commande** :
```powershell
.\scripts\migrate-and-setup-azure-complete.ps1
```

**Ce script fait automatiquement** :
1. ✅ Connexion Azure (simplifiée avec GitHub)
2. ✅ Création Resource Group
3. ✅ Création Azure Container Registry (ACR)
4. ✅ Création App Registration pour GitHub Actions
5. ✅ Configuration permissions Azure
6. ✅ Configuration secrets GitHub (automatique si GitHub CLI disponible)
7. ✅ Récupération variables d'environnement depuis AWS
8. ✅ Création base de données PostgreSQL
9. ✅ Création App Service Plan
10. ✅ Création App Service
11. ✅ Configuration toutes les variables d'environnement
12. ✅ Configuration health check

---

## 🔄 ALTERNATIVE : Configuration Azure Seulement

**Si vous voulez seulement configurer Azure (sans migration)** :
```powershell
.\scripts\setup-azure-complete-auto.ps1
```

**Ce script fait** :
- ✅ Configuration Azure (ACR, App Registration, etc.)
- ✅ Configuration secrets GitHub
- ⚠️ Pas de migration du backend

---

## 📋 PRÉREQUIS

### 1. Azure CLI

**Vérifier** :
```powershell
az version
```

**Si non installé** (le script l'installera automatiquement) :
```powershell
winget install Microsoft.AzureCLI
```

---

### 2. GitHub CLI (Optionnel mais Recommandé)

**Vérifier** :
```powershell
gh version
```

**Si non installé** (le script l'installera automatiquement) :
```powershell
winget install GitHub.cli
```

**Si GitHub CLI n'est pas disponible** :
- ⚠️ Les secrets GitHub devront être configurés manuellement
- Le script affichera les valeurs à copier

---

### 3. Connexion Azure

**Le script vous connectera automatiquement** :
- Si vous avez créé Azure avec GitHub, utilisez l'authentification GitHub
- Sinon, un navigateur s'ouvrira pour la connexion

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
   - Target: `[App Service URL]` (affiché à la fin du script)
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

