# 📋 Instructions : Mettre à Jour le Secret GitHub GCP_DATABASE_URL

**Date**: 2026-02-15  
**URGENT** : Mettre à jour le secret pour que Cloud Run se connecte à Cloud SQL

---

## 🔴 Valeur à Mettre à Jour

### Secret GitHub
- **Nom** : `GCP_DATABASE_URL`
- **Repository** : `Her50/yukpo4`

### Nouvelle Valeur (Format Cloud SQL Unix Socket)

```
postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

---

## 📝 Étapes pour Mettre à Jour

### Option 1: Via l'Interface GitHub (Recommandé)

1. **Aller sur GitHub** :
   - URL : https://github.com/Her50/yukpo4/settings/secrets/actions

2. **Trouver le secret** :
   - Chercher `GCP_DATABASE_URL` dans la liste
   - Cliquer sur le bouton **"Update"** (icône crayon)

3. **Coller la nouvelle valeur** :
   ```
   postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```

4. **Sauvegarder** :
   - Cliquer sur **"Update secret"**

### Option 2: Via GitHub CLI (si installé)

```bash
echo 'postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres' | gh secret set GCP_DATABASE_URL --repo Her50/yukpo4
```

---

## ✅ Après la Mise à Jour

### 1. Déclencher le Déploiement

**Option A: Push automatique** (si vous avez fait un commit)
```bash
git push
```

**Option B: Déclencher manuellement le workflow**
1. Aller sur : https://github.com/Her50/yukpo4/actions
2. Sélectionner "Docker Build Optimized"
3. Cliquer sur "Run workflow"
4. Cocher "Push to GCP Cloud Run"
5. Cliquer sur "Run workflow"

### 2. Vérifier les Logs

Après le déploiement (5-10 minutes), vérifier les logs :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --format="table(timestamp,severity,textPayload)" --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

### 3. Tester le Service

```bash
curl https://yukpo-backend-376093909298.europe-west1.run.app/health
```

---

## 🔍 Informations Cloud SQL

- **Instance** : `yukpo-postgres`
- **Base de données** : `yukpo_db`
- **Utilisateur** : `yukpo_user`
- **Mot de passe** : `TempPassword123!` (défini lors de la création)
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Format** : Unix socket Cloud SQL (`/cloudsql/`)

---

## ⚠️ Important

- **Ne pas** utiliser l'ancienne DATABASE_URL AWS RDS (`34.79.29.219`)
- **Utiliser** le format Cloud SQL Unix socket (plus sécurisé)
- **Vérifier** que le mot de passe est correct (`TempPassword123!`)

---

## 🔧 Si le Mot de Passe Est Différent

Si vous avez changé le mot de passe Cloud SQL, utilisez le nouveau mot de passe :

```bash
# Format avec nouveau mot de passe
postgresql://yukpo_user:NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

---

**🔴 ACTION URGENTE** : Mettre à jour le secret GitHub maintenant pour que Cloud Run fonctionne !



