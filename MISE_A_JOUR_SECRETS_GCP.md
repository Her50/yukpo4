# Mise à Jour des Secrets GCP

**Date**: 2026-02-16  
**Statut**: Secrets créés avec valeurs placeholder - À mettre à jour

---

## ✅ Ce qui a été fait

1. **Secrets créés dans GCP Secret Manager** :
   - ✅ `jwt-secret`
   - ✅ `database-url`
   - ✅ `redis-url`
   - ✅ `mongodb-url`

2. **Secrets référencés dans Cloud Run** :
   - ✅ `JWT_SECRET=jwt-secret:latest`
   - ✅ `DATABASE_URL=database-url:latest`
   - ✅ `REDIS_URL=redis-url:latest`
   - ✅ `MONGODB_URL=mongodb-url:latest`

3. **Variables d'environnement supprimées** (remplacées par secrets) :
   - ✅ `DATABASE_URL` (était une variable, maintenant un secret)
   - ✅ `JWT_SECRET` (était une variable, maintenant un secret)

---

## ⚠️ Action Requise : Mettre à jour les valeurs

Les secrets ont été créés avec des valeurs placeholder. **Vous devez les mettre à jour avec les vraies valeurs**.

### Méthode 1 : Via gcloud CLI

```bash
# JWT_SECRET
echo -n "VOTRE_VRAIE_JWT_SECRET_ICI" | gcloud secrets versions add jwt-secret \
  --data-file=- \
  --project=yukpo-project

# DATABASE_URL (adapter pour Cloud SQL)
echo -n "postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance" | gcloud secrets versions add database-url \
  --data-file=- \
  --project=yukpo-project

# REDIS_URL (adapter pour Cloud Memorystore)
echo -n "redis://memorystore-endpoint:6379" | gcloud secrets versions add redis-url \
  --data-file=- \
  --project=yukpo-project

# MONGODB_URL
echo -n "mongodb://user:pass@host:27017/dbname" | gcloud secrets versions add mongodb-url \
  --data-file=- \
  --project=yukpo-project
```

### Méthode 2 : Via Console GCP

1. Aller dans **Secret Manager** : https://console.cloud.google.com/security/secret-manager?project=yukpo-project
2. Cliquer sur chaque secret
3. Cliquer sur **"Ajouter une nouvelle version"**
4. Coller la vraie valeur
5. Cliquer sur **"Ajouter une version"**

---

## 📋 Récupération des valeurs depuis AWS

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

## 🔄 Adaptation des valeurs pour GCP

### DATABASE_URL

**AWS Format** :
```
postgresql://user:pass@rds-endpoint.eu-west-1.rds.amazonaws.com:5432/dbname
```

**GCP Format** (Cloud SQL) :
```
postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
```

**Exemple** :
```
postgresql://yukpo_admin:password@/yukpomnang?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

### REDIS_URL

**AWS Format** :
```
redis://elasticache-endpoint.cache.amazonaws.com:6379
```

**GCP Format** (Cloud Memorystore) :
```
redis://memorystore-endpoint:6379
```

**Exemple** :
```
redis://10.0.0.3:6379
```

---

## ✅ Vérification

Après mise à jour, vérifier :

```bash
# Vérifier que les secrets sont référencés
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(spec.template.spec.containers[0].env[].valueFrom.secretKeyRef.name)"

# Vérifier les logs Cloud Run pour voir si les variables sont chargées
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit 50 \
  --project=yukpo-project \
  --format="table(timestamp,textPayload)"
```

---

## 🎯 Résultat Attendu

Après mise à jour :
- ✅ Tous les secrets ont les vraies valeurs
- ✅ Cloud Run peut accéder aux secrets
- ✅ L'application démarre correctement
- ✅ La connexion à la base de données fonctionne

---

**⚠️ IMPORTANT** : Les valeurs placeholder doivent être remplacées avant le prochain déploiement, sinon l'application ne fonctionnera pas correctement.

