# 🔍 Diagnostic : Erreur d'Authentification PostgreSQL

**Date**: 2026-02-18  
**Problème**: `password authentication failed for user "yukpo_user"`  
**Statut**: 🔴 En cours de diagnostic

---

## 🔴 Erreur Identifiée

### Erreur dans les Logs

```
ERROR: password authentication failed for user "yukpo_user"
ERROR: error returned from database: password authentication failed for user "yukpo_user"
```

### Contexte

- ✅ Socket Unix Cloud SQL configuré : `/cloudsql/yukpo-project:europe-west1:yukpo-postgres`
- ✅ Utilisateur `yukpo_user` existe dans Cloud SQL
- ✅ Bases de données disponibles : `yukpo_postgres`, `yukpo_db`
- ❌ **Authentification échoue** : Le mot de passe est incorrect ou la base de données spécifiée n'est pas accessible

---

## 🔍 Causes Possibles

### 1. Mot de Passe Incorrect dans DATABASE_URL

**Problème** : Le mot de passe dans le secret `database-url` ne correspond pas au mot de passe réel de l'utilisateur `yukpo_user` dans Cloud SQL.

**Solution** : Vérifier et mettre à jour le mot de passe dans Secret Manager.

### 2. Base de Données Incorrecte dans DATABASE_URL

**Problème** : DATABASE_URL pointe vers une base de données qui n'existe pas ou à laquelle l'utilisateur n'a pas accès.

**Bases disponibles** :
- `yukpo_postgres` (recommandée - principale)
- `yukpo_db` (ancienne)

**Solution** : Vérifier que DATABASE_URL utilise `yukpo_postgres`.

### 3. Format DATABASE_URL Incorrect

**Format attendu pour Unix socket** :
```
postgresql://yukpo_user:PASSWORD@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Points critiques** :
- Le mot de passe doit être **URL-encodé** si il contient des caractères spéciaux (`#`, `%`, `=`, etc.)
- La base de données doit être `yukpo_postgres` (pas `yukpo_db`)
- Le format doit être exactement : `@/database?host=/cloudsql/...`

---

## ✅ Solutions

### Solution 1: Vérifier et Corriger DATABASE_URL dans Secret Manager

#### Étape 1: Vérifier le Secret Actuel

```powershell
# Vérifier le secret (peut avoir des problèmes d'encodage)
gcloud secrets versions access latest --secret="database-url" --project="yukpo-project"
```

#### Étape 2: Obtenir le Mot de Passe Réel

**Option A: Réinitialiser le Mot de Passe**

```powershell
# Générer un nouveau mot de passe
$NEW_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Réinitialiser le mot de passe dans Cloud SQL
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=$NEW_PASSWORD \
  --project=yukpo-project
```

**Option B: Utiliser le Mot de Passe Existant (si connu)**

Si vous connaissez le mot de passe actuel, passez à l'étape 3.

#### Étape 3: URL-Encoder le Mot de Passe

Le mot de passe doit être URL-encodé dans DATABASE_URL. Caractères spéciaux :
- `#` → `%23`
- `%` → `%25`
- `=` → `%3D`
- `@` → `%40`
- `&` → `%26`
- etc.

**Script PowerShell pour encoder** :
```powershell
function Encode-Url {
    param([string]$text)
    [System.Web.HttpUtility]::UrlEncode($text)
}

$PASSWORD = "VOTRE_MOT_DE_PASSE"
$PASSWORD_ENCODED = Encode-Url $PASSWORD
Write-Host "Mot de passe encodé: $PASSWORD_ENCODED"
```

#### Étape 4: Construire DATABASE_URL

```powershell
$DB_USER = "yukpo_user"
$DB_PASSWORD_ENCODED = "MOT_DE_PASSE_URL_ENCODE"
$DB_NAME = "yukpo_postgres"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"

$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"

Write-Host "DATABASE_URL: $DATABASE_URL"
```

#### Étape 5: Mettre à Jour le Secret

```powershell
# Mettre à jour le secret
echo $DATABASE_URL | gcloud secrets versions add database-url \
  --data-file=- \
  --project=yukpo-project
```

### Solution 2: Vérifier les Permissions de l'Utilisateur

Vérifier que `yukpo_user` a accès à la base `yukpo_postgres` :

```powershell
# Se connecter à Cloud SQL et vérifier
gcloud sql connect yukpo-postgres \
  --user=yukpo_user \
  --database=yukpo_postgres \
  --project=yukpo-project
```

Si la connexion échoue, vérifier les permissions :

```sql
-- Dans psql
\du yukpo_user
\l yukpo_postgres
GRANT ALL PRIVILEGES ON DATABASE yukpo_postgres TO yukpo_user;
```

---

## 🔧 Script de Correction Automatique

```powershell
# Script PowerShell pour corriger DATABASE_URL

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_postgres"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"

# 1. Générer un nouveau mot de passe
$NEW_PASSWORD = -join ((48..57) + (65..90) + (97..122) + (35, 36, 37, 61, 64) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Nouveau mot de passe généré: $NEW_PASSWORD"

# 2. Réinitialiser le mot de passe dans Cloud SQL
Write-Host "Réinitialisation du mot de passe dans Cloud SQL..."
gcloud sql users set-password $DB_USER `
  --instance=$INSTANCE `
  --password=$NEW_PASSWORD `
  --project=$PROJECT

# 3. URL-encoder le mot de passe
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "Mot de passe encodé: $PASSWORD_ENCODED"

# 4. Construire DATABASE_URL
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "DATABASE_URL: $DATABASE_URL"

# 5. Mettre à jour le secret
Write-Host "Mise à jour du secret database-url..."
echo $DATABASE_URL | gcloud secrets versions add database-url `
  --data-file=- `
  --project=$PROJECT

Write-Host "✅ Secret mis à jour. Redéployer le service Cloud Run pour appliquer les changements."
```

---

## 📋 Checklist de Vérification

- [ ] Secret `database-url` vérifié dans Secret Manager
- [ ] Format DATABASE_URL correct (Unix socket)
- [ ] Base de données = `yukpo_postgres` (pas `yukpo_db`)
- [ ] Mot de passe URL-encodé correctement
- [ ] Mot de passe correspond à celui dans Cloud SQL
- [ ] Utilisateur `yukpo_user` a les permissions sur `yukpo_postgres`
- [ ] Service Cloud Run redéployé après mise à jour du secret
- [ ] Logs vérifiés après redéploiement

---

## 🎯 Prochaines Étapes

1. **Exécuter le script de correction** ci-dessus
2. **Redéployer le service Cloud Run** pour charger le nouveau secret
3. **Vérifier les logs** pour confirmer la connexion réussie
4. **Tester l'application** pour confirmer que tout fonctionne

---

**Date**: 2026-02-18  
**Statut**: 🔴 **EN ATTENTE DE CORRECTION**


