# 🚀 Instructions : Migration Azure (Simple)

**Date** : 2026-02-14  
**Statut** : Azure CLI installé - Prêt pour migration

---

## ✅ CE QUI EST DÉJÀ FAIT

- ✅ Azure CLI installé (version 2.83.0)
- ✅ Script de migration créé (`scripts/migrate-backend-to-azure.ps1`)
- ✅ Script génère automatiquement les mots de passe

---

## 📋 ÉTAPES À SUIVRE

### Étape 1 : Se Connecter à Azure (2 min)

**Ouvrir PowerShell** et exécuter :

```powershell
# Ajouter Azure CLI au PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Se connecter à Azure (ouvrira un navigateur)
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
```

**Ce qui va se passer** :
1. Un navigateur va s'ouvrir
2. Connectez-vous avec votre compte Azure
3. Autorisez l'accès
4. Retournez dans PowerShell

**Vérifier la connexion** :
```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show
```

---

### Étape 2 : Exécuter la Migration Automatique (10-15 min)

**Une fois connecté**, exécutez le script :

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\migrate-backend-to-azure.ps1
```

**Ce que fait le script automatiquement** :
1. ✅ Crée le Resource Group
2. ✅ Crée la base de données PostgreSQL (vide)
3. ✅ Crée l'App Service Plan
4. ✅ Crée l'App Service (backend)
5. ✅ Configure les variables d'environnement
6. ✅ Génère automatiquement les mots de passe
7. ✅ Affiche toutes les informations importantes

**Temps d'exécution** : ~10-15 minutes (principalement l'attente de création de la base de données)

---

### Étape 3 : Configurer le Budget (2 min)

**Après la migration**, configurez les alertes de budget :

```powershell
.\scripts\setup-azure-budget.ps1 -BudgetAmount 50 -Email "votre@email.com"
```

---

### Étape 4 : Mettre à Jour DNS Cloudflare (2 min)

**Le script affichera l'URL de l'App Service** (ex: `yukpo-backend.azurewebsites.net`)

**Dans Cloudflare Dashboard** :
1. Aller sur https://dash.cloudflare.com
2. Sélectionner `yukpomnang.com`
3. **DNS** → **Enregistrements**
4. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Target** : `[URL fournie par le script]`
   - **Proxy** : Activé (nuage orange) ✅

---

### Étape 5 : Tester (2 min)

**Attendre 2-3 minutes** pour que le backend démarre, puis :

```powershell
curl https://api.yukpomnang.com/healthz
```

**Résultat attendu** : Status 200 OK

---

## 🔐 INFORMATIONS IMPORTANTES

**Le script génère automatiquement** :
- ✅ Mot de passe de la base de données (32 caractères)
- ✅ JWT_SECRET (64 caractères)

**⚠️ IMPORTANT** : Le script affichera ces secrets à la fin. **SAUVEGARDEZ-LES** dans un endroit sûr !

---

## 📊 RÉSUMÉ

| Étape | Temps | Description |
|-------|------|-------------|
| **1. Connexion Azure** | 2 min | `az login` |
| **2. Migration** | 10-15 min | `.\scripts\migrate-backend-to-azure.ps1` |
| **3. Budget** | 2 min | `.\scripts\setup-azure-budget.ps1` |
| **4. DNS** | 2 min | Cloudflare Dashboard |
| **5. Test** | 2 min | `curl https://api.yukpomnang.com/healthz` |
| **TOTAL** | **~20-25 min** | Migration complète |

---

## 🎯 COMMANDES COMPLÈTES (Copier-Coller)

```powershell
# 1. Ajouter Azure CLI au PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2. Se connecter à Azure
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login

# 3. Vérifier la connexion
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show

# 4. Aller dans le dossier du projet
cd C:\Users\23767\yukpomnang2

# 5. Exécuter la migration
.\scripts\migrate-backend-to-azure.ps1

# 6. Configurer le budget (remplacer votre@email.com)
.\scripts\setup-azure-budget.ps1 -BudgetAmount 50 -Email "votre@email.com"
```

---

## ✅ CHECKLIST

- [ ] Se connecter à Azure (`az login`)
- [ ] Exécuter le script de migration
- [ ] Sauvegarder les secrets affichés
- [ ] Configurer le budget
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

**Date** : 2026-02-14  
**Statut** : Instructions créées - Prêt pour migration

