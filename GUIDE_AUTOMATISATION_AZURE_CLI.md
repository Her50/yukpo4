# 🚀 Guide : Automatisation Migration Azure avec Azure CLI

**Date** : 2026-02-14  
**Objectif** : Automatiser toute la migration avec des scripts PowerShell

---

## ✅ AZURE CLI

**Azure CLI** (`az`) permet d'automatiser toutes les opérations Azure depuis la ligne de commande.

---

## 📋 INSTALLATION AZURE CLI

### Windows (PowerShell)

**Option 1 : Via winget (Recommandé)**
```powershell
winget install Microsoft.AzureCLI
```

**Option 2 : Via MSI**
1. Télécharger depuis : https://aka.ms/installazurecliwindows
2. Installer le fichier MSI

**Option 3 : Via Chocolatey**
```powershell
choco install azure-cli
```

### Vérification

```powershell
az version
```

---

## 🔐 CONNEXION À AZURE

### Première Connexion

```powershell
az login
```

**Résultat** : Ouvre un navigateur pour vous connecter à Azure.

### Vérifier la Connexion

```powershell
az account show
```

---

## 🚀 SCRIPTS AUTOMATISÉS CRÉÉS

### 1. Script Principal : Migration Complète

**Fichier** : `scripts/migrate-backend-to-azure.ps1`

**Usage** :
```powershell
.\scripts\migrate-backend-to-azure.ps1
```

**Ce que fait le script** :
1. ✅ Vérifie Azure CLI
2. ✅ Vérifie la connexion Azure
3. ✅ Crée le Resource Group
4. ✅ Crée la base de données PostgreSQL
5. ✅ Crée l'App Service Plan
6. ✅ Crée l'App Service (backend)
7. ✅ Configure les variables d'environnement
8. ✅ Configure le health check
9. ✅ Affiche toutes les informations importantes

**Paramètres optionnels** :
```powershell
.\scripts\migrate-backend-to-azure.ps1 `
    -ResourceGroupName "yukpomnang-rg" `
    -Location "westeurope" `
    -DbName "yukpomnang-db" `
    -AppServiceName "yukpo-backend" `
    -PricingTier "F1"  # F1 = Free, B1 = Basic
```

---

### 2. Script : Configuration Budget

**Fichier** : `scripts/setup-azure-budget.ps1`

**Usage** :
```powershell
.\scripts\setup-azure-budget.ps1 -BudgetAmount 50 -Email "votre@email.com"
```

**Ce que fait le script** :
1. ✅ Crée un budget mensuel
2. ✅ Configure des alertes à 50%, 90%, 100%
3. ✅ Envoie des emails d'alerte

---

## 📋 PLAN DE MIGRATION AUTOMATISÉE

### Étape 1 : Installer Azure CLI (5 min)

```powershell
winget install Microsoft.AzureCLI
```

---

### Étape 2 : Se Connecter à Azure (1 min)

```powershell
az login
```

---

### Étape 3 : Exécuter le Script de Migration (10-15 min)

```powershell
.\scripts\migrate-backend-to-azure.ps1
```

**Le script va** :
- Demander le mot de passe de la base de données
- Créer toutes les ressources Azure
- Configurer les variables d'environnement
- Afficher les informations importantes

**Temps d'exécution** : ~10-15 minutes (principalement l'attente de création de la base de données)

---

### Étape 4 : Configurer le Budget (2 min)

```powershell
.\scripts\setup-azure-budget.ps1 -BudgetAmount 50 -Email "votre@email.com"
```

---

### Étape 5 : Mettre à Jour DNS Cloudflare (2 min)

**Manuellement dans Cloudflare Dashboard** :
1. DNS → Enregistrements
2. Modifier `api` :
   - **Type** : `CNAME`
   - **Target** : `[votre-app].azurewebsites.net` (fourni par le script)
   - **Proxy** : Activé

---

### Étape 6 : Tester (2 min)

```powershell
curl https://api.yukpomnang.com/healthz
```

---

## ✅ CHECKLIST AUTOMATISÉE

### Avant la Migration
- [ ] Installer Azure CLI
- [ ] Se connecter à Azure (`az login`)

### Migration Automatique
- [ ] Exécuter `migrate-backend-to-azure.ps1`
- [ ] Configurer le budget (`setup-azure-budget.ps1`)

### Après la Migration
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

## 🔧 COMMANDES AZURE CLI UTILES

### Vérifier les Ressources Créées

```powershell
# Lister les resource groups
az group list

# Lister les app services
az webapp list --resource-group yukpomnang-rg

# Lister les bases de données
az postgres flexible-server list --resource-group yukpomnang-rg
```

### Voir les Logs du Backend

```powershell
az webapp log tail --name yukpo-backend --resource-group yukpomnang-rg
```

### Redémarrer le Backend

```powershell
az webapp restart --name yukpo-backend --resource-group yukpomnang-rg
```

### Mettre à Jour les Variables d'Environnement

```powershell
az webapp config appsettings set `
    --name yukpo-backend `
    --resource-group yukpomnang-rg `
    --settings JWT_SECRET="nouveau_secret"
```

### Voir les Coûts

```powershell
az consumption usage list --start-date (Get-Date).AddDays(-30).ToString("yyyy-MM-dd") --end-date (Get-Date).ToString("yyyy-MM-dd")
```

---

## 🎯 RÉSUMÉ

**Migration Automatique** : ✅ **Oui, possible avec Azure CLI**

**Scripts créés** :
1. ✅ `scripts/migrate-backend-to-azure.ps1` - Migration complète
2. ✅ `scripts/setup-azure-budget.ps1` - Configuration budget

**Temps total** : ~20-25 minutes (dont 10-15 min d'attente pour la création de la base de données)

**Avantages** :
- ✅ **100% automatisé** : Pas besoin d'utiliser le portail Azure
- ✅ **Reproductible** : Le script peut être réexécuté
- ✅ **Rapide** : Plus rapide que le portail
- ✅ **Documenté** : Toutes les commandes sont visibles

---

**Date** : 2026-02-14  
**Statut** : Scripts d'automatisation créés - Prêt pour migration automatique


