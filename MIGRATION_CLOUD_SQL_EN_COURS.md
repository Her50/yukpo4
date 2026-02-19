# 🚀 Migration vers Cloud SQL - En Cours

**Date**: 2026-02-15  
**Statut**: ✅ Instance Cloud SQL créée, configuration en cours

---

## ✅ État Actuel

### Instance Cloud SQL Créée

- **Nom** : `yukpo-postgres`
- **Version** : PostgreSQL 15
- **Tier** : `db-f1-micro`
- **Région** : `europe-west1-d`
- **IP Publique** : `34.79.199.41`
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Statut** : ✅ RUNNABLE

### Base de Données et Utilisateur

- **Base de données** : `yukpo_db` ✅ Créée
- **Utilisateur** : `yukpo_user` ✅ Créé
- **Mot de passe** : Défini lors de la création

---

## 🔧 Actions Effectuées

1. ✅ Instance Cloud SQL créée
2. ✅ Base de données `yukpo_db` créée
3. ✅ Utilisateur `yukpo_user` créé
4. ✅ Cloud SQL instance ajoutée à Cloud Run
5. ⏳ DATABASE_URL mise à jour (en cours)
6. ⏳ VPC Connector supprimé (en cours)

---

## 📋 Prochaines Étapes

### 1. Mettre à Jour le Mot de Passe Cloud SQL

Le mot de passe actuel est temporaire. Définir un mot de passe sécurisé :

```bash
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=VOTRE_MOT_DE_PASSE_SECURISE \
  --project=yukpo-project
```

### 2. Migrer les Données depuis AWS RDS

**Option A: Depuis une machine avec accès AWS RDS**

```bash
# Exporter depuis AWS RDS
pg_dump -h 34.79.29.219 \
  -U yukpo_admin \
  -d yukpo_db \
  -F c \
  -f backup.dump

# Importer vers Cloud SQL
pg_restore -h 34.79.199.41 \
  -U yukpo_user \
  -d yukpo_db \
  backup.dump
```

**Option B: Via Cloud SQL Import (si backup disponible)**

```bash
# Si vous avez un backup SQL
gcloud sql import sql yukpo-postgres gs://bucket/backup.sql \
  --database=yukpo_db \
  --project=yukpo-project
```

### 3. Mettre à Jour DATABASE_URL dans le Workflow

**Fichier** : `.github/workflows/docker-build-optimized.yml`

Mettre à jour le secret GitHub `GCP_DATABASE_URL` :

```bash
# Format Cloud SQL avec Unix socket
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Ou via IP publique** (moins sécurisé) :
```bash
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@34.79.199.41:5432/yukpo_db?sslmode=require
```

### 4. Vérifier les Permissions Cloud Run

Le service account Cloud Run doit avoir les permissions Cloud SQL Client :

```bash
# Vérifier le service account
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)" \
  --project=yukpo-project

# Ajouter la permission si nécessaire
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudsql.client" \
  --project=yukpo-project
```

---

## 🔍 Vérification

### Vérifier la Configuration Cloud Run

```bash
# Vérifier Cloud SQL instances
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].cloudSqlInstances)" \
  --project=yukpo-project

# Vérifier DATABASE_URL
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env[?(@.name=='DATABASE_URL')].value)" \
  --project=yukpo-project

# Vérifier que VPC Connector est supprimé
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.vpcAccess)" \
  --project=yukpo-project
```

### Tester la Connexion

```bash
# Tester depuis Cloud Run (via logs)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'PostgreSQL\|database\|DB'" --limit=20 --project=yukpo-project

# Tester le service
curl https://yukpo-backend-376093909298.europe-west1.run.app/health
```

---

## ⚠️ Problèmes Rencontrés

### 1. Migration des Données Échouée

**Erreur** : `Connection timed out` lors de l'export depuis AWS RDS

**Cause** : AWS RDS n'est pas accessible depuis votre machine locale (firewall)

**Solution** :
- Exporter depuis une machine avec accès AWS RDS
- Ou utiliser AWS RDS Snapshot et restaurer vers Cloud SQL
- Ou migrer via un serveur intermédiaire

### 2. Déploiement Échoué avec Nouvelle DATABASE_URL

**Erreur** : Timeout de démarrage

**Cause** : Le service essaie de se connecter à Cloud SQL mais échoue

**Solutions** :
1. Vérifier les permissions Cloud SQL Client
2. Vérifier que Cloud SQL instance est bien ajoutée à Cloud Run
3. Vérifier le format de DATABASE_URL (Unix socket vs IP)

---

## 📝 Format DATABASE_URL pour Cloud SQL

### Option 1: Unix Socket (Recommandé - Plus Sécurisé)

```
postgresql://yukpo_user:password@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Avantages** :
- ✅ Plus sécurisé (pas d'exposition IP publique)
- ✅ Performance optimale
- ✅ Pas besoin d'autoriser IPs

**Prérequis** :
- Cloud SQL instance doit être ajoutée à Cloud Run (`--add-cloudsql-instances`)
- Service account doit avoir `roles/cloudsql.client`

### Option 2: IP Publique (Alternative)

```
postgresql://yukpo_user:password@34.79.199.41:5432/yukpo_db?sslmode=require
```

**Avantages** :
- ✅ Fonctionne depuis n'importe où
- ✅ Plus simple à tester

**Inconvénients** :
- ⚠️ Moins sécurisé
- ⚠️ Nécessite d'autoriser les IPs Cloud Run

---

## 🚀 Commandes Complètes

### Mettre à Jour DATABASE_URL avec Unix Socket

```bash
CONNECTION_NAME="yukpo-project:europe-west1:yukpo-postgres"
DB_PASSWORD="VOTRE_MOT_DE_PASSE"
NEW_DB_URL="postgresql://yukpo_user:${DB_PASSWORD}@/yukpo_db?host=/cloudsql/${CONNECTION_NAME}"

gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DATABASE_URL=${NEW_DB_URL}" \
  --project=yukpo-project
```

### Vérifier les Permissions

```bash
# Récupérer le service account
SERVICE_ACCOUNT=$(gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)" \
  --project=yukpo-project)

# Ajouter la permission Cloud SQL Client
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client" \
  --project=yukpo-project
```

---

## ✅ Checklist

- [x] Instance Cloud SQL créée
- [x] Base de données créée
- [x] Utilisateur créé
- [x] Cloud SQL instance ajoutée à Cloud Run
- [ ] **Mot de passe Cloud SQL mis à jour** (ACTION REQUISE)
- [ ] **DATABASE_URL mise à jour** (en cours)
- [ ] **VPC Connector supprimé** (en cours)
- [ ] **Permissions Cloud SQL vérifiées**
- [ ] **Données migrées depuis AWS RDS**
- [ ] **Service testé et validé**

---

**✅ Instance Cloud SQL créée avec succès !**

**🔴 PROCHAINES ACTIONS** :
1. Mettre à jour le mot de passe Cloud SQL
2. Mettre à jour DATABASE_URL dans le workflow GitHub
3. Migrer les données depuis AWS RDS
4. Tester le service



