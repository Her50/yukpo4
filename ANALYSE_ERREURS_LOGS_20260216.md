# 🔍 Analyse des Erreurs Logs GCP - 2026-02-16

## 📋 Résumé Exécutif

**Problème Principal** : L'application Cloud Run ne peut pas démarrer à cause d'une erreur d'authentification PostgreSQL.

**Impact** : 
- ❌ L'application backend est inaccessible
- ❌ Les migrations ne peuvent pas être appliquées automatiquement
- ❌ Les utilisateurs ne peuvent pas se connecter

---

## 🔴 Erreurs Identifiées

### 1. Erreur d'Authentification PostgreSQL (CRITIQUE)

**Log** (lignes 101-143) :
```
FATAL: password authentication failed for user "yukpo_user"
```

**Cause** :
- L'application Cloud Run essaie de se connecter à Cloud SQL avec l'utilisateur `yukpo_user`
- Le mot de passe est incorrect ou l'utilisateur n'existe pas
- La `DATABASE_URL` dans Cloud Run est probablement mal configurée

**Impact** : 
- ❌ Aucune connexion à la base de données possible
- ❌ L'application ne peut pas démarrer

### 2. Échec de Démarrage Cloud Run (CONSÉQUENCE)

**Log** (lignes 145-309) :
```
The instance could not start successfully.
Default STARTUP TCP probe failed on port 8080
```

**Cause** :
- Conséquence directe de l'erreur d'authentification PostgreSQL
- Le healthcheck échoue car l'application ne peut pas se connecter à la DB

**Impact** :
- ❌ Toutes les requêtes HTTP retournent 503/500
- ❌ Le service est complètement inaccessible

---

## ✅ Solutions

### Solution 1: Vérifier et Corriger DATABASE_URL (RECOMMANDÉ)

#### Étape 1: Vérifier la Configuration Actuelle

```powershell
# Vérifier les variables d'environnement Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(spec.template.spec.containers[0].env)"
```

#### Étape 2: Vérifier l'Utilisateur Cloud SQL

```powershell
# Lister les utilisateurs Cloud SQL
gcloud sql users list \
  --instance=yukpo-postgres \
  --project=yukpo-project
```

#### Étape 3: Vérifier le Mot de Passe

Si l'utilisateur `yukpo_user` existe, réinitialiser son mot de passe :

```powershell
# Réinitialiser le mot de passe
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password="NOUVEAU_MOT_DE_PASSE_SECURISE" \
  --project=yukpo-project
```

#### Étape 4: Mettre à Jour DATABASE_URL dans Cloud Run

```powershell
# Mettre à jour la variable d'environnement
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DATABASE_URL=postgresql://yukpo_user:NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" \
  --project=yukpo-project
```

**OU** mettre à jour le secret GitHub `GCP_DATABASE_URL` et redéployer.

---

### Solution 2: Utiliser un Utilisateur Différent

Si `yukpo_user` n'existe pas, créer un nouvel utilisateur :

```powershell
# Créer un nouvel utilisateur
gcloud sql users create yukpo_user \
  --instance=yukpo-postgres \
  --password="MOT_DE_PASSE_SECURISE" \
  --project=yukpo-project
```

Puis mettre à jour `DATABASE_URL` comme dans la Solution 1.

---

### Solution 3: Appliquer la Migration Manuellement (TEMPORAIRE)

Pendant que le problème d'authentification est résolu, appliquer la migration directement :

```powershell
# Exécuter le script d'application de migration
.\scripts\apply_migration_fix_names_gcp.ps1
```

**OU** se connecter directement à Cloud SQL :

```powershell
# Se connecter à Cloud SQL
gcloud sql connect yukpo-postgres \
  --user=yukpo_user \
  --database=yukpo_db \
  --project=yukpo-project

# Dans psql, exécuter :
\i backend/migrations/20260216_fix_duplicate_full_names.sql
```

---

## 🔍 Vérifications Post-Correction

### 1. Vérifier que Cloud Run Démarre

```powershell
# Vérifier les logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=50 \
  --project=yukpo-project \
  --format=json
```

### 2. Vérifier la Connexion à la Base de Données

```powershell
# Tester la connexion
gcloud sql connect yukpo-postgres \
  --user=yukpo_user \
  --database=yukpo_db \
  --project=yukpo-project
```

### 3. Vérifier que la Migration est Appliquée

```sql
-- Dans psql, vérifier que les fonctions existent
SELECT proname FROM pg_proc WHERE proname LIKE '%normalize%';

-- Vérifier que le trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_normalize_users_nom_complet';

-- Vérifier un exemple de nom corrigé
SELECT id, nom, prenom, nom_complet FROM users WHERE nom_complet LIKE '% %' LIMIT 5;
```

---

## 📝 Checklist de Résolution

- [ ] Vérifier que l'utilisateur `yukpo_user` existe dans Cloud SQL
- [ ] Vérifier/corriger le mot de passe de `yukpo_user`
- [ ] Vérifier que `DATABASE_URL` dans Cloud Run est correcte
- [ ] Redémarrer le service Cloud Run
- [ ] Vérifier que l'application démarre correctement
- [ ] Appliquer la migration `20260216_fix_duplicate_full_names.sql`
- [ ] Vérifier que les fonctions SQL sont créées
- [ ] Vérifier que le trigger fonctionne
- [ ] Tester qu'un nouveau nom est normalisé automatiquement

---

## 🚨 Actions Immédiates

1. **URGENT** : Corriger l'authentification PostgreSQL
   - Vérifier l'utilisateur et le mot de passe
   - Mettre à jour `DATABASE_URL` dans Cloud Run

2. **IMPORTANT** : Appliquer la migration de correction des noms
   - Utiliser le script `apply_migration_fix_names_gcp.ps1`
   - OU se connecter manuellement à Cloud SQL

3. **VÉRIFICATION** : Tester que tout fonctionne
   - Vérifier les logs Cloud Run
   - Tester une connexion utilisateur
   - Vérifier qu'un nom est normalisé

---

## 📚 Références

- **Script de migration** : `scripts/apply_migration_fix_names_gcp.ps1`
- **Fichier de migration** : `backend/migrations/20260216_fix_duplicate_full_names.sql`
- **Documentation GCP Cloud SQL** : https://cloud.google.com/sql/docs/postgres
- **Documentation Cloud Run** : https://cloud.google.com/run/docs
