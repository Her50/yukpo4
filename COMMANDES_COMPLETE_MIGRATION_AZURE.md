# 📋 Commandes Complètes : Migration Azure (Copier-Coller)

**Date** : 2026-02-14  
**Usage** : Copier-coller ces commandes dans PowerShell

---

## 🔐 ÉTAPE 1 : Se Connecter à Azure

```powershell
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

## 🚀 ÉTAPE 3 : Exécuter la Migration Complète

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\migrate-aws-to-azure-auto.ps1
```

**Le script va automatiquement** :
- ✅ Récupérer toutes les variables d'environnement depuis AWS
- ✅ Créer le Resource Group
- ✅ Créer la base de données PostgreSQL (vide)
- ✅ Créer l'App Service Plan
- ✅ Créer l'App Service (backend)
- ✅ Configurer toutes les variables d'environnement
- ✅ Générer automatiquement les mots de passe
- ✅ Configurer le health check
- ✅ Afficher toutes les informations importantes

**Temps d'exécution** : ~10-15 minutes

---

## 💰 ÉTAPE 4 : Configurer le Budget (Optionnel)

```powershell
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

**Attendre 2-3 minutes** pour que le backend démarre et exécute les migrations automatiques, puis :

```powershell
curl https://api.yukpomnang.com/healthz
```

**Résultat attendu** : Status 200 OK

**Les migrations s'exécuteront automatiquement** :
- ✅ Tables créées automatiquement
- ✅ Indexes créés automatiquement
- ✅ Fonctions créées automatiquement

---

## 🔐 SAUVEGARDER LES SECRETS

**Le script affichera à la fin** :
- Database Password : `[mot de passe généré]`
- JWT_SECRET : `[secret généré]`

**⚠️ IMPORTANT** : Sauvegardez ces secrets dans un endroit sûr !

**Le script sauvegarde aussi** : `azure-secrets-[date].txt`

---

**Date** : 2026-02-14  
**Statut** : Commandes prêtes - Copier-coller dans PowerShell


