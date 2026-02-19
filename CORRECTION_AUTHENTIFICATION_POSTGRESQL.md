# 🔧 Correction : Authentification PostgreSQL

**Date**: 2026-02-18  
**Problème**: `password authentication failed for user "yukpo_user"`  
**Solution**: Réinitialiser le mot de passe et mettre à jour DATABASE_URL

---

## 🔴 Problème Identifié

L'erreur `password authentication failed for user "yukpo_user"` indique que :
1. Le mot de passe dans `DATABASE_URL` (Secret Manager) ne correspond pas au mot de passe réel dans Cloud SQL
2. OU le mot de passe n'est pas correctement URL-encodé dans DATABASE_URL

---

## ✅ Solution Étape par Étape

### Étape 1: Réinitialiser le Mot de Passe dans Cloud SQL

```powershell
# Générer un nouveau mot de passe sécurisé
$NEW_PASSWORD = -join ((48..57) + (65..90) + (97..122) + (35, 36, 37, 61, 64, 95) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Réinitialiser dans Cloud SQL
gcloud sql users set-password yukpo_user `
  --instance=yukpo-postgres `
  --password=$NEW_PASSWORD `
  --project=yukpo-project

# Afficher le mot de passe (à sauvegarder)
Write-Host "Nouveau mot de passe: $NEW_PASSWORD"
```

**⚠️ IMPORTANT**: Sauvegarder le mot de passe généré, vous en aurez besoin pour l'étape suivante.

---

### Étape 2: URL-Encoder le Mot de Passe

Le mot de passe doit être URL-encodé dans DATABASE_URL. Caractères spéciaux à encoder :
- `#` → `%23`
- `%` → `%25`
- `=` → `%3D`
- `@` → `%40`
- `&` → `%26`
- etc.

**Script PowerShell pour encoder** :

```powershell
Add-Type -AssemblyName System.Web

# Remplacer par le mot de passe généré à l'étape 1
$PASSWORD = "VOTRE_MOT_DE_PASSE_ICI"
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($PASSWORD)

Write-Host "Mot de passe original: $PASSWORD"
Write-Host "Mot de passe encodé: $PASSWORD_ENCODED"
```

---

### Étape 3: Construire DATABASE_URL

**Format requis pour Unix socket Cloud SQL** :

```
postgresql://yukpo_user:PASSWORD_ENCODED@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Script PowerShell** :

```powershell
$DB_USER = "yukpo_user"
$DB_PASSWORD_ENCODED = "MOT_DE_PASSE_URL_ENCODE_ICI"  # Remplacer par le résultat de l'étape 2
$DB_NAME = "yukpo_postgres"  # Base principale
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"

$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"

Write-Host "DATABASE_URL:"
Write-Host $DATABASE_URL
```

---

### Étape 4: Mettre à Jour le Secret dans Secret Manager

**Option A: Via Console GCP (Recommandé)**

1. Aller sur [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=yukpo-project)
2. Cliquer sur le secret `database-url`
3. Cliquer sur **"Ajouter une nouvelle version"**
4. Coller la `DATABASE_URL` complète (étape 3)
5. Cliquer sur **"Ajouter une version"**

**Option B: Via gcloud CLI**

```powershell
# Créer un fichier temporaire avec DATABASE_URL
$DATABASE_URL | Out-File -FilePath "temp-db-url.txt" -Encoding UTF8 -NoNewline

# Mettre à jour le secret
gcloud secrets versions add database-url `
  --data-file=temp-db-url.txt `
  --project=yukpo-project

# Supprimer le fichier temporaire
Remove-Item temp-db-url.txt
```

---

### Étape 5: Redéployer le Service Cloud Run

Le service Cloud Run doit être redéployé pour charger la nouvelle version du secret.

**Option A: Redéploiement automatique (si GitHub Actions)**

Pousser un commit ou déclencher manuellement le workflow de déploiement.

**Option B: Redéploiement manuel**

```powershell
# Forcer un redéploiement (même image, mais recharge les secrets)
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project
```

---

### Étape 6: Vérifier les Logs

Attendre 1-2 minutes après le redéploiement, puis vérifier les logs :

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" `
  --limit=50 `
  --project=yukpo-project `
  --format="value(timestamp,severity,textPayload)" `
  | Select-String -Pattern "socket|connexion|ERROR|password|authentication" -CaseSensitive:$false
```

**Rechercher** :
- ✅ `Socket Unix existe: /cloudsql/yukpo-project:europe-west1:yukpo-postgres`
- ✅ `Connexion PostgreSQL établie`
- ❌ Aucune erreur `password authentication failed`

---

## 🔍 Vérification Alternative: Test de Connexion Directe

Si vous voulez tester la connexion avant de mettre à jour le secret :

```powershell
# Se connecter directement à Cloud SQL avec le nouveau mot de passe
gcloud sql connect yukpo-postgres `
  --user=yukpo_user `
  --database=yukpo_postgres `
  --project=yukpo-project
```

Si la connexion réussit, le problème est bien dans DATABASE_URL (format ou encodage).

---

## 📋 Checklist Complète

- [ ] Mot de passe réinitialisé dans Cloud SQL
- [ ] Mot de passe sauvegardé en sécurité
- [ ] Mot de passe URL-encodé correctement
- [ ] DATABASE_URL construite avec le bon format (Unix socket)
- [ ] Base de données = `yukpo_postgres` (pas `yukpo_db`)
- [ ] Secret `database-url` mis à jour dans Secret Manager
- [ ] Service Cloud Run redéployé
- [ ] Logs vérifiés (connexion réussie)
- [ ] Application testée

---

## 🎯 Format DATABASE_URL Final

**Format correct** :
```
postgresql://yukpo_user:PASSWORD_URL_ENCODED@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Exemple** (si le mot de passe est `MyP@ss#123`) :
```
postgresql://yukpo_user:MyP%40ss%23123@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

---

## ⚠️ Notes Importantes

1. **URL Encoding**: Les caractères spéciaux dans le mot de passe DOIVENT être URL-encodés
2. **Base de données**: Utiliser `yukpo_postgres` (principale), pas `yukpo_db` (ancienne)
3. **Format Unix socket**: Le format `@/database?host=/cloudsql/...` est requis pour Cloud SQL
4. **Redéploiement**: Le service doit être redéployé pour charger la nouvelle version du secret

---

**Date**: 2026-02-18  
**Statut**: 🔴 **EN ATTENTE DE CORRECTION**


