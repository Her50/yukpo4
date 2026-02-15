# 🔴 ACTION REQUISE : Mettre à Jour le Secret GitHub GCP_DATABASE_URL

**Date**: 2026-02-15  
**URGENT** : Le service Cloud Run ne démarre pas car DATABASE_URL pointe vers AWS RDS au lieu de Cloud SQL

---

## 🔴 Problème Actuel

Le service Cloud Run essaie de se connecter à **AWS RDS** (`34.79.29.219:5432`) au lieu de **Cloud SQL**.

**Erreur dans les logs** :
```
⏳ En attente de la base de données AWS RDS (34.79.29.219:5432)... (tentative 30/30)
❌ ERREUR: Impossible de se connecter à la base de données après 30 tentatives
```

**Cause** : Le secret GitHub `GCP_DATABASE_URL` n'a pas été mis à jour avec le format Cloud SQL.

---

## ✅ Solution : Mettre à Jour le Secret GitHub

### Étape 1: Aller sur GitHub

1. Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Trouver le secret : `GCP_DATABASE_URL`
3. Cliquer sur "Update" ou "Edit"

### Étape 2: Mettre à Jour avec le Format Cloud SQL

**Format Cloud SQL Unix Socket** (Recommandé) :
```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Remplacez** :
- `VOTRE_MOT_DE_PASSE` : Le mot de passe de l'utilisateur `yukpo_user` (défini lors de la création de l'instance Cloud SQL)

**Format IP Publique** (Alternative si Unix socket ne fonctionne pas) :
```
postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@34.79.199.41:5432/yukpo_db?sslmode=require
```

### Étape 3: Récupérer le Mot de Passe Cloud SQL

Si vous ne connaissez pas le mot de passe :

```bash
# Option 1: Réinitialiser le mot de passe
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=NOUVEAU_MOT_DE_PASSE_SECURISE \
  --project=yukpo-project

# Option 2: Vérifier le mot de passe actuel (si vous l'avez noté)
# Le mot de passe défini lors de la création était : TempPassword123!
```

---

## 📋 Informations Cloud SQL

- **Instance** : `yukpo-postgres`
- **Base de données** : `yukpo_db`
- **Utilisateur** : `yukpo_user`
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **IP Publique** : `34.79.199.41`

---

## ✅ Après la Mise à Jour

Une fois le secret `GCP_DATABASE_URL` mis à jour :

1. **Le workflow GitHub Actions** redéploiera automatiquement au prochain push
2. **OU** déclencher manuellement le workflow :
   - Aller sur : https://github.com/Her50/yukpo4/actions
   - Sélectionner "Docker Build Optimized"
   - Cliquer sur "Run workflow"
   - Cocher "Push to GCP Cloud Run"
   - Cliquer sur "Run workflow"

---

## 🔍 Vérification

Après le déploiement, vérifier les logs :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --format="table(timestamp,severity,textPayload)" --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

---

## ⚠️ Important

- **Ne pas** utiliser l'ancienne DATABASE_URL AWS RDS
- **Utiliser** le format Cloud SQL Unix socket (plus sécurisé)
- **Vérifier** que le mot de passe est correct

---

**🔴 ACTION URGENTE** : Mettre à jour le secret GitHub `GCP_DATABASE_URL` maintenant !

