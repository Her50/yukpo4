# 🚀 Appliquer la Migration de Correction des Noms sur Cloud SQL GCP

## 📋 Informations

- **Instance Cloud SQL** : `yukpo-postgres`
- **Projet GCP** : `yukpo-project`
- **Région** : `europe-west1`
- **Base de données** : `yukpo_db`
- **Utilisateur** : `yukpo_user`
- **Migration** : `20260216_fix_duplicate_full_names.sql`

---

## ✅ Méthode 1: Script Automatique (Recommandé)

### Prérequis

1. **gcloud CLI installé** : https://cloud.google.com/sdk/docs/install
2. **Authentifié sur GCP** : `gcloud auth login`
3. **Cloud SQL Proxy** (optionnel, pour méthode automatique) : https://cloud.google.com/sql/docs/postgres/sql-proxy

### Exécution

```powershell
.\scripts\apply_migration_gcp_direct.ps1
```

Le script va :
- Vérifier votre authentification GCP
- Lire le fichier de migration
- Vous demander le mot de passe de l'utilisateur `yukpo_user`
- Tenter d'appliquer la migration automatiquement (si Cloud SQL Proxy est installé)
- OU vous donner les instructions manuelles

---

## ✅ Méthode 2: Application Manuelle

### Étape 1: Se connecter à Cloud SQL

```powershell
# Définir le mot de passe (remplacez VOTRE_MOT_DE_PASSE)
$env:PGPASSWORD='VOTRE_MOT_DE_PASSE'

# Se connecter
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```

### Étape 2: Dans psql, exécuter la migration

```sql
-- Copier le chemin du fichier de migration
\i C:\Users\23767\yukpomnang2\backend\migrations\20260216_fix_duplicate_full_names.sql
```

**OU** copier-coller le contenu du fichier directement dans psql.

---

## ✅ Méthode 3: Via Cloud SQL Proxy

### Étape 1: Démarrer Cloud SQL Proxy

```powershell
cloud-sql-proxy yukpo-project:europe-west1:yukpo-postgres --port=5433
```

### Étape 2: Dans un autre terminal, appliquer la migration

```powershell
# Définir le mot de passe
$env:PGPASSWORD='VOTRE_MOT_DE_PASSE'

# Appliquer la migration
Get-Content backend\migrations\20260216_fix_duplicate_full_names.sql | psql postgresql://yukpo_user@localhost:5433/yukpo_db
```

---

## 🔍 Vérification Post-Migration

### Vérifier que les fonctions sont créées

```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%normalize%';
```

Vous devriez voir :
- `normalize_full_name_sql`
- `build_full_name_sql`
- `normalize_users_nom_complet`

### Vérifier que le trigger existe

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_normalize_users_nom_complet';
```

### Vérifier un exemple de nom corrigé

```sql
SELECT id, nom, prenom, nom_complet 
FROM users 
WHERE nom_complet LIKE '% %' 
LIMIT 5;
```

---

## 🚨 En cas d'erreur

### Erreur: "password authentication failed"

**Solution** : Vérifier/réinitialiser le mot de passe :

```powershell
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=NOUVEAU_MOT_DE_PASSE \
  --project=yukpo-project
```

### Erreur: "instance not found"

**Solution** : Vérifier que l'instance existe :

```powershell
gcloud sql instances list --project=yukpo-project
```

### Erreur: "permission denied"

**Solution** : Vérifier vos permissions GCP :

```powershell
gcloud projects get-iam-policy yukpo-project
```

Vous devez avoir au moins `roles/cloudsql.client` ou `roles/cloudsql.admin`.

---

## 📝 Contenu de la Migration

La migration :
1. ✅ Crée des fonctions SQL pour normaliser les noms
2. ✅ Corrige les noms dupliqués existants dans la table `users`
3. ✅ Crée un trigger pour normaliser automatiquement les futurs noms
4. ✅ Crée un index pour améliorer les performances

---

## ✅ Après la Migration

Une fois la migration appliquée :
- ✅ Les noms existants avec duplications seront corrigés
- ✅ Les nouveaux noms seront automatiquement normalisés
- ✅ Le problème de duplication ne se reproduira plus


