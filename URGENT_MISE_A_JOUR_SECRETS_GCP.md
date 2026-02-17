# 🔴 URGENT : Mettre à Jour les Secrets GCP

**Date**: 2026-02-17  
**Problème**: Les secrets contiennent des placeholders, l'application ne peut pas se connecter

---

## ❌ Problème Identifié

**Erreur dans les logs** :
```
[MAIN] ✅ DATABASE_URL récupérée (longueur: 41)
[MAIN] ❌ ERREUR: Impossible de créer le pool PostgreSQL (connect_lazy): error with configuration: relative URL without a base
Error: Configuration(RelativeUrlWithoutBase)
```

**Cause** : Le secret `database-url` contient encore `PLACEHOLDER_REMPLACER_AVEC_VRAIE_VALEUR` (41 caractères)

**Impact** :
- ❌ L'application ne peut pas se connecter à la base de données
- ❌ Les requêtes `/api/auth/login` échouent
- ❌ L'application ne démarre pas correctement

---

## ✅ Solution : Mettre à Jour les Secrets GCP

### Informations Cloud SQL

- **Instance** : `yukpo-postgres`
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Base de données** : `yukpo_postgres` (principale)
- **Utilisateur** : `yukpo_user`
- **IP** : `34.79.199.41`

---

## 📋 Actions Requises

### 1. Mettre à Jour DATABASE_URL

**Format Unix Socket (Recommandé pour Cloud Run)** :
```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Format IP Publique (Alternative)** :
```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@34.79.199.41:5432/yukpo_postgres?sslmode=require
```

**Commande** :
```bash
echo -n "postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" | gcloud secrets versions add database-url --data-file=- --project=yukpo-project
```

**⚠️ IMPORTANT** : Remplacez `VOTRE_MOT_DE_PASSE` par le vrai mot de passe de `yukpo_user`

---

### 2. Si vous ne connaissez pas le mot de passe

**Réinitialiser le mot de passe** :
```bash
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=NOUVEAU_MOT_DE_PASSE_SECURISE \
  --project=yukpo-project
```

Puis mettre à jour le secret avec le nouveau mot de passe.

---

### 3. Mettre à Jour les Autres Secrets

**REDIS_URL** (Cloud Memorystore ou Redis GCP) :
```bash
echo -n "redis://VOTRE_REDIS_ENDPOINT:6379" | gcloud secrets versions add redis-url --data-file=- --project=yukpo-project
```

**MONGODB_URL** :
```bash
echo -n "mongodb://VOTRE_MONGODB_URL" | gcloud secrets versions add mongodb-url --data-file=- --project=yukpo-project
```

**JWT_SECRET** (Générer une nouvelle clé) :
```bash
# Générer une clé aléatoire
openssl rand -hex 32

# Mettre à jour le secret
echo -n "VOTRE_JWT_SECRET_GENERE" | gcloud secrets versions add jwt-secret --data-file=- --project=yukpo-project
```

---

## 🚀 Script Automatique

Un script PowerShell est disponible : `scripts/update-gcp-secrets-from-cloud-sql.ps1`

**Usage** :
```powershell
.\scripts\update-gcp-secrets-from-cloud-sql.ps1
```

Le script vous guidera pour :
1. Récupérer les informations Cloud SQL
2. Demander le mot de passe
3. Générer la DATABASE_URL au bon format
4. Mettre à jour le secret dans GCP

---

## ✅ Vérification

Après mise à jour, vérifier :

```bash
# Vérifier la longueur du secret (doit être > 50 caractères)
gcloud secrets versions access latest --secret=database-url --project=yukpo-project | Measure-Object -Character
```

**Résultat attendu** : Plus de 50 caractères (pas 41)

---

## 🎯 Résultat Attendu

Après mise à jour :
- ✅ `DATABASE_URL` contient une vraie URL Cloud SQL
- ✅ L'application peut se connecter à la base de données
- ✅ Les requêtes `/api/auth/login` fonctionnent
- ✅ La connexion mobile fonctionne

---

**⚠️ CRITIQUE** : Sans cette mise à jour, l'application ne pourra jamais se connecter à la base de données.

