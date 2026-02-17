# 🔍 Analyse des Logs - Erreur Cloud SQL

**Date** : 2026-02-17  
**Fichier analysé** : `downloaded-logs-20260217-102217.json`

---

## 🔴 Problèmes Identifiés

### 1. Erreur Principale : Cloud SQL Non Accessible

```
Cloud SQL instance "yukpo-project:europe-west1:yukpo-postgres\r\n" is not reachable
```

**Problème** : Le nom de l'instance contient des caractères de fin de ligne (`\r\n`) à la fin, ce qui empêche la connexion.

### 2. Erreur de Configuration : "empty host"

```
❌ Erreur: error with configuration: empty host
```

**Cause** : Format incorrect de `DATABASE_URL` ou problème de parsing.

### 3. Statistiques des Logs

- **Total d'entrées** : 314
- **Erreurs** : 2 (toutes liées à Cloud SQL)
- **Codes HTTP 403** : 10 (scans de sécurité, normal)
- **Warnings** : 13

---

## 🔍 Analyse Détaillée

### Erreurs Trouvées

1. **09:12:17** - Cloud SQL instance non accessible (avec `\r\n`)
2. **09:12:31** - `error with configuration: empty host`
3. **09:12:41** - Cloud SQL instance non accessible (avec `\r\n`)

### Format DATABASE_URL Détecté

Les logs montrent :
```
DATABASE_URL: postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!...
```

Le mot de passe est encodé en URL (`%23`, `%25`, `%3D`), ce qui est normal.

---

## ✅ Solutions

### Solution 1 : Vérifier le Secret GitHub `GCP_DATABASE_URL`

Le secret `GCP_DATABASE_URL` doit être au format :

```
postgresql://yukpo_user:VTWc#%vKZt=qewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Important** :
- ✅ Pas de retours à la ligne (`\r\n`) à la fin
- ✅ Pas d'espaces en début/fin
- ✅ Format Unix socket pour Cloud SQL
- ✅ Le mot de passe doit être encodé en URL si nécessaire

### Solution 2 : Vérifier le Nom de l'Instance Cloud SQL

Dans le workflow `.github/workflows/gcp-deploy.yml`, vérifier que :

```yaml
--add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres
```

Le nom `yukpo-postgres` ne doit pas contenir de retours à la ligne.

### Solution 3 : Nettoyer le Secret GitHub

1. Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Trouver `GCP_DATABASE_URL`
3. Vérifier qu'il n'y a pas de retours à la ligne à la fin
4. Le format doit être exactement :
   ```
   postgresql://yukpo_user:MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```

### Solution 4 : Vérifier l'Instance Cloud SQL

```bash
# Vérifier que l'instance existe
gcloud sql instances describe yukpo-postgres \
  --project yukpo-project \
  --format="value(name,connectionName)"

# Le résultat doit être :
# yukpo-postgres
# yukpo-project:europe-west1:yukpo-postgres
```

---

## 🔧 Actions Immédiates

### 1. Vérifier le Secret GitHub

```bash
# Via GitHub CLI (si installé)
gh secret get GCP_DATABASE_URL --repo Her50/yukpo4 | od -c
```

Chercher `\r` ou `\n` à la fin.

### 2. Mettre à Jour le Secret (si nécessaire)

Si le secret contient des retours à la ligne, le mettre à jour sans :

```
postgresql://yukpo_user:VTWc#%vKZt=qewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Note** : Encoder le mot de passe en URL si nécessaire :
- `#` → `%23`
- `%` → `%25`
- `=` → `%3D`

### 3. Redéployer

Après correction du secret, redéclencher le workflow GitHub Actions.

---

## 📋 Checklist de Vérification

- [ ] Secret `GCP_DATABASE_URL` ne contient pas de `\r\n` à la fin
- [ ] Format DATABASE_URL correct (Unix socket)
- [ ] Instance Cloud SQL `yukpo-postgres` existe et est accessible
- [ ] Workflow utilise le bon nom d'instance (sans retours à la ligne)
- [ ] Service Cloud Run a les permissions pour accéder à Cloud SQL

---

## 🎯 Format DATABASE_URL Correct

Pour Cloud SQL avec Unix socket :

```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE
```

Exemple :
```
postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Points critiques** :
- ✅ Pas de `host:port` après `@`
- ✅ Format : `@/database?host=/cloudsql/...`
- ✅ Pas de retours à la ligne
- ✅ Mot de passe encodé en URL si nécessaire

---

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Nettoyage du Nom d'Instance Cloud SQL dans le Workflow

**Fichier** : `.github/workflows/gcp-deploy.yml`

**Modification** : Ajout d'un nettoyage des retours à la ligne avant utilisation :

```bash
# Construire et nettoyer le nom de l'instance Cloud SQL
CLOUD_SQL_INSTANCE="${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres"
# Nettoyer les retours à la ligne (Windows \r\n et Unix \n)
CLOUD_SQL_INSTANCE=$(echo "$CLOUD_SQL_INSTANCE" | tr -d '\r\n' | tr -d '\n')
```

**Utilisation** : Toutes les références à `--add-cloudsql-instances` utilisent maintenant `"$CLOUD_SQL_INSTANCE"` (nettoyée).

---

**Date d'analyse** : 2026-02-17  
**Date de correction** : 2026-02-17

