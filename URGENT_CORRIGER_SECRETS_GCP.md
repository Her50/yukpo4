# ⚠️ URGENT : Corriger les Secrets GCP

**Date**: 2026-02-17  
**Problème Critique** : Les secrets GCP contiennent encore des valeurs placeholder

---

## 🔴 Problème Identifié

D'après les logs, l'erreur est :
```
[MAIN] ❌ ERREUR: Impossible de créer le pool PostgreSQL (connect_lazy): error with configuration: relative URL without a base
Error: Configuration(RelativeUrlWithoutBase)
```

**Cause** : Le secret `database-url` contient encore la valeur placeholder :
```
PLACEHOLDER_REMPLACER_AVEC_VRAIE_VALEUR
```

**Impact** :
- ❌ L'application ne peut pas se connecter à la base de données
- ❌ Les requêtes `/api/auth/login` retournent 501 (Not Implemented)
- ❌ L'application ne démarre pas correctement

---

## ✅ Solution : Mettre à Jour les Secrets

### 1. Vérifier les Valeurs Actuelles

```bash
# Vérifier database-url
gcloud secrets versions access latest --secret=database-url --project=yukpo-project

# Vérifier redis-url
gcloud secrets versions access latest --secret=redis-url --project=yukpo-project

# Vérifier mongodb-url
gcloud secrets versions access latest --secret=mongodb-url --project=yukpo-project

# Vérifier jwt-secret
gcloud secrets versions access latest --secret=jwt-secret --project=yukpo-project
```

---

### 2. Mettre à Jour database-url

**Format requis pour Cloud SQL** :
```
postgresql://USER:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**Exemple** :
```bash
echo -n "postgresql://yukpo_admin:VOTRE_MOT_DE_PASSE@/yukpomnang?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" | \
  gcloud secrets versions add database-url \
    --data-file=- \
    --project=yukpo-project
```

**OU via Console GCP** :
1. Aller dans **Secret Manager** : https://console.cloud.google.com/security/secret-manager?project=yukpo-project
2. Cliquer sur `database-url`
3. Cliquer sur **"Ajouter une nouvelle version"**
4. Coller la vraie URL PostgreSQL
5. Cliquer sur **"Ajouter une version"**

---

### 3. Mettre à Jour redis-url

**Format requis pour Cloud Memorystore** :
```
redis://IP_ADDRESS:6379
```

**Exemple** :
```bash
echo -n "redis://10.0.0.3:6379" | \
  gcloud secrets versions add redis-url \
    --data-file=- \
    --project=yukpo-project
```

**Note** : Si vous n'avez pas encore créé Cloud Memorystore, vous pouvez utiliser une URL Redis temporaire ou laisser vide (l'application fonctionnera sans Redis, mais certaines fonctionnalités seront limitées).

---

### 4. Mettre à Jour mongodb-url

**Format** :
```
mongodb://USER:PASSWORD@HOST:PORT/DATABASE_NAME
```

**Exemple** :
```bash
echo -n "mongodb://yukpo_user:VOTRE_MOT_DE_PASSE@mongodb-host:27017/yukpomnang" | \
  gcloud secrets versions add mongodb-url \
    --data-file=- \
    --project=yukpo-project
```

---

### 5. Mettre à Jour jwt-secret

**Format** : Une chaîne aléatoire longue (minimum 64 caractères)

**Générer un nouveau secret** :
```bash
# Générer un secret aléatoire
openssl rand -hex 32

# Mettre à jour le secret
echo -n "VOTRE_SECRET_GENERE" | \
  gcloud secrets versions add jwt-secret \
    --data-file=- \
    --project=yukpo-project
```

---

## 📋 Récupération des Valeurs depuis AWS

Si vous avez accès à AWS, récupérez les valeurs avec :

```bash
# DATABASE_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.DATABASE_URL'

# REDIS_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.REDIS_URL'

# MONGODB_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.MONGODB_URL'

# JWT_SECRET depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.JWT_SECRET'
```

**Note** : Remplacez `ACCOUNT_ID` et `XXXXX` par les vraies valeurs.

---

## ⚠️ Adaptation Requise pour GCP

### DATABASE_URL

**AWS Format** :
```
postgresql://user:pass@rds-endpoint.eu-west-1.rds.amazonaws.com:5432/dbname
```

**GCP Format (Cloud SQL)** :
```
postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
```

**Exemple** :
```
postgresql://yukpo_admin:password@/yukpomnang?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

---

### REDIS_URL

**AWS Format** :
```
redis://elasticache-endpoint.cache.amazonaws.com:6379
```

**GCP Format (Cloud Memorystore)** :
```
redis://10.0.0.3:6379
```

**Note** : Vous devez créer Cloud Memorystore et récupérer l'adresse IP.

---

## ✅ Vérification

Après mise à jour, vérifier :

```bash
# Vérifier que les secrets ont les bonnes valeurs
gcloud secrets versions access latest --secret=database-url --project=yukpo-project | head -c 50
gcloud secrets versions access latest --secret=redis-url --project=yukpo-project | head -c 50
gcloud secrets versions access latest --secret=mongodb-url --project=yukpo-project | head -c 50
gcloud secrets versions access latest --secret=jwt-secret --project=yukpo-project | head -c 50
```

**Important** : Les valeurs ne doivent PAS être "PLACEHOLDER_REMPLACER_AVEC_VRAIE_VALEUR"

---

## 🎯 Résultat Attendu

Après mise à jour :
- ✅ L'application peut se connecter à la base de données
- ✅ Les requêtes `/api/auth/login` fonctionnent
- ✅ L'application démarre correctement
- ✅ La connexion mobile fonctionne

---

**⚠️ CRITIQUE** : Sans ces corrections, l'application ne fonctionnera jamais. Les secrets doivent être mis à jour avec les vraies valeurs.

