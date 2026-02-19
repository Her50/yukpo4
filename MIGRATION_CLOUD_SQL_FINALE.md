# 🚀 Migration vers Cloud SQL - Finalisation

**Date**: 2026-02-15  
**Statut**: ✅ Instance Cloud SQL créée, configuration en cours

---

## ✅ État Actuel

### Instance Cloud SQL

- **Nom** : `yukpo-postgres`
- **Version** : PostgreSQL 15
- **Tier** : `db-f1-micro`
- **Région** : `europe-west1-d`
- **IP Publique** : `34.79.199.41`
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Statut** : ✅ RUNNABLE

### Base de Données et Utilisateur

- **Base de données** : `yukpo_db` ✅
- **Utilisateur** : `yukpo_user` ✅
- **Mot de passe** : Défini lors de la création

---

## 🔴 Problème Actuel

**Erreur** : `error with configuration: empty host`

**Cause** : La DATABASE_URL n'est pas au bon format pour Cloud SQL avec Unix socket.

**Solution** : Mettre à jour DATABASE_URL avec le format Unix socket Cloud SQL.

---

## 🔧 Format DATABASE_URL pour Cloud SQL

### Format Unix Socket (Recommandé)

```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Important** :
- Pas de `host:port` après `@`
- Format : `@/database?host=/cloudsql/connection-name`
- Connection name : `yukpo-project:europe-west1:yukpo-postgres`

### Format IP Publique (Alternative)

```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@34.79.199.41:5432/yukpo_db?sslmode=require
```

---

## 📋 Actions Requises

### 1. Mettre à Jour le Secret GitHub `GCP_DATABASE_URL`

**Format Unix Socket** :
```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Instructions** :
1. Aller sur GitHub → Settings → Secrets and variables → Actions
2. Trouver `GCP_DATABASE_URL`
3. Mettre à jour avec le format Unix socket ci-dessus
4. Remplacer `VOTRE_MOT_DE_PASSE` par le mot de passe réel

### 2. Vérifier les Permissions Cloud SQL

Le service account Cloud Run doit avoir `roles/cloudsql.client` :

```bash
# Vérifier le service account
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)" \
  --project=yukpo-project

# Ajouter la permission si nécessaire
gcloud projects add-iam-policy-binding yukpo-project \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client" \
  --project=yukpo-project
```

### 3. Vérifier que Cloud SQL Instance est Ajoutée

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].cloudSqlInstances)" \
  --project=yukpo-project
```

**Doit afficher** : `yukpo-project:europe-west1:yukpo-postgres`

### 4. Redéployer le Service

Après avoir mis à jour `GCP_DATABASE_URL`, redéployer :

```bash
# Via workflow GitHub Actions (push sur main/master)
# OU manuellement :
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DATABASE_URL=postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" \
  --project=yukpo-project
```

---

## ✅ Checklist

- [x] Instance Cloud SQL créée (`yukpo-postgres`)
- [x] Base de données créée (`yukpo_db`)
- [x] Utilisateur créé (`yukpo_user`)
- [x] Cloud SQL instance ajoutée à Cloud Run
- [x] Permissions Cloud SQL Client ajoutées
- [x] VPC Connector supprimé
- [ ] **DATABASE_URL mise à jour** (ACTION REQUISE - Secret GitHub)
- [ ] **Service redéployé** (après mise à jour DATABASE_URL)
- [ ] **Service testé** (curl /health)

---

## 🔍 Vérification

### Tester le Service

```bash
# Test health endpoint
curl https://yukpo-backend-376093909298.europe-west1.run.app/health
```

### Vérifier les Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'PostgreSQL\|database\|DB'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

---

## 📝 Scripts Désactivés

Les scripts suivants ont été désactivés car l'application a migré vers GCP :

- ✅ `scripts/mettre-a-jour-dns-cloudflare-auto.ps1` - Désactivé
- ✅ `scripts/detecter-et-configurer-load-balancer-auto.ps1` - Désactivé

**Raison** : L'application est maintenant sur GCP Cloud Run avec une URL stable, plus besoin de scripts DNS/Load Balancer AWS.

---

## 🚀 Prochaines Étapes

1. **Mettre à jour le secret GitHub `GCP_DATABASE_URL`** avec le format Unix socket
2. **Redéployer le service** (push sur main/master ou workflow dispatch)
3. **Tester le service** : `curl https://yukpo-backend-376093909298.europe-west1.run.app/health`
4. **Vérifier les logs** pour confirmer la connexion Cloud SQL

---

**✅ Migration Cloud SQL presque terminée !**

**🔴 ACTION REQUISE** : Mettre à jour le secret GitHub `GCP_DATABASE_URL` avec le format Unix socket.



