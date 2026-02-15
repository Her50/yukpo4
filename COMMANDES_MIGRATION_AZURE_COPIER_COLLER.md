# 📋 Commandes Migration Azure (Copier-Coller)

**Date** : 2026-02-14  
**Usage** : Copier-coller ces commandes dans PowerShell

---

## 🚀 ÉTAPE 1 : Se Connecter à Azure

```powershell
# Ajouter Azure CLI au PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Se connecter à Azure (ouvrira un navigateur)
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
```

**Attendre** : Un navigateur va s'ouvrir, connectez-vous avec votre compte Azure.

---

## ✅ ÉTAPE 2 : Vérifier la Connexion

```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show
```

**Résultat attendu** : Affiche les informations de votre abonnement Azure.

---

## 🚀 ÉTAPE 3 : Exécuter la Migration

```powershell
# Aller dans le dossier du projet
cd C:\Users\23767\yukpomnang2

# Exécuter la migration automatique
.\scripts\migrate-backend-to-azure.ps1
```

**Temps d'exécution** : ~10-15 minutes

**Le script va** :
- ✅ Créer toutes les ressources Azure
- ✅ Générer automatiquement les mots de passe
- ✅ Configurer les variables d'environnement
- ✅ Afficher toutes les informations importantes

---

## 💰 ÉTAPE 4 : Configurer le Budget

```powershell
# Remplacer "votre@email.com" par votre email
.\scripts\setup-azure-budget.ps1 -BudgetAmount 50 -Email "votre@email.com"
```

---

## 🌐 ÉTAPE 5 : Mettre à Jour DNS Cloudflare

**Le script affichera l'URL de l'App Service** (ex: `yukpo-backend.azurewebsites.net`)

**Dans Cloudflare Dashboard** :
1. https://dash.cloudflare.com → `yukpomnang.com` → **DNS**
2. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Target** : `[URL fournie par le script]`
   - **Proxy** : Activé ✅

---

## ✅ ÉTAPE 6 : Tester

```powershell
# Attendre 2-3 minutes, puis tester
curl https://api.yukpomnang.com/healthz
```

**Résultat attendu** : Status 200 OK

---

## 🔐 SAUVEGARDER LES SECRETS

**Le script affichera à la fin** :
- Database Password : `[mot de passe généré]`
- JWT_SECRET : `[secret généré]`

**⚠️ IMPORTANT** : Sauvegardez ces secrets dans un endroit sûr !

---

**Date** : 2026-02-14  
**Statut** : Commandes prêtes - Copier-coller dans PowerShell


