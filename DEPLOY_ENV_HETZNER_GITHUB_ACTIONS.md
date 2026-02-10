# 🚀 Déploiement .env sur Hetzner via GitHub Actions

## ✅ Solution Automatique

J'ai créé un workflow GitHub Actions qui utilise **Ubuntu** (comme les autres déploiements) pour copier automatiquement le fichier `.env` sur Hetzner.

## 🎯 Utilisation

### Option 1 : Via GitHub Actions (Recommandé)

1. **Aller sur GitHub** : https://github.com/Her50/yukpo4/actions
2. **Sélectionner le workflow** : "Deploy .env to Hetzner"
3. **Cliquer sur "Run workflow"**
4. **Laisser les options par défaut** et cliquer sur "Run workflow"

Le workflow va :
- ✅ Se connecter à AWS pour récupérer toutes les variables
- ✅ Les adapter pour Hetzner (PostgreSQL, Redis, Wasabi, URLs)
- ✅ Copier le fichier `.env` sur Hetzner via SSH (Ubuntu)
- ✅ Vérifier que le fichier est bien créé

### Option 2 : Déclencher depuis le code

Le workflow se déclenche aussi automatiquement si vous modifiez le fichier `create-env-hetzner.sh` et poussez sur `main`.

## 📋 Prérequis

Le workflow nécessite ces secrets GitHub (déjà configurés) :
- ✅ `HETZNER_SSH_PRIVATE_KEY` - Clé SSH pour Hetzner
- ✅ `AWS_ACCESS_KEY_ID` - Clé d'accès AWS
- ✅ `AWS_SECRET_ACCESS_KEY` - Clé secrète AWS

## 🔍 Vérification

Après exécution, le workflow affiche :
- ✅ Nombre de lignes dans le fichier `.env`
- ✅ Premières lignes (valeurs masquées pour sécurité)
- ✅ Statut de déploiement

## 🎯 Avantages

- ✅ **Pas de blocage SSH** : Utilise Ubuntu (comme les autres workflows)
- ✅ **Automatique** : Récupère directement depuis AWS
- ✅ **Sécurisé** : Utilise les secrets GitHub
- ✅ **Vérifié** : Vérifie que le fichier est bien créé

## 📝 Note

Si le workflow échoue, il essaiera d'utiliser le fichier `create-env-hetzner.sh` local comme solution de secours.

---

**Temps estimé : 2-3 minutes** ⏱️

