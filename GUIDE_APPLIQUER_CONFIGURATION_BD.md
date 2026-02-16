# 🚀 Guide : Appliquer la Configuration Base de Données

**Date**: 2026-02-16  
**Objectif**: Guide pratique pour configurer `yukpo_postgres` dans Cloud SQL

---

## 📚 Scripts Disponibles

### 1. `scripts\configurer-base-yukpo-postgres.ps1`

**Fonction** : Crée/vérifie la base de données `yukpo_postgres` dans Cloud SQL

**Usage** :
```powershell
.\scripts\configurer-base-yukpo-postgres.ps1 -UserPassword 'VOTRE_MOT_DE_PASSE'
```

**Options** :
- `-UserPassword` : Mot de passe pour l'utilisateur `yukpo_user` (requis si l'utilisateur n'existe pas)
- `-RenameOldDatabase` : Renommer `yukpo_db` en `yukpo_db_old_backup` (optionnel)
- `-SkipMigrations` : Ne pas proposer d'appliquer les migrations

**Ce que fait le script** :
1. ✅ Vérifie que l'instance Cloud SQL existe
2. ✅ Liste les bases de données existantes
3. ✅ Crée `yukpo_postgres` si elle n'existe pas
4. ✅ Gère l'ancienne base `yukpo_db`
5. ✅ Vérifie/crée l'utilisateur `yukpo_user`
6. ✅ Génère la DATABASE_URL à utiliser

---

### 2. `scripts\appliquer-migrations-yukpo-postgres.ps1`

**Fonction** : Applique les migrations SQLx sur la base `yukpo_postgres`

**Usage** :
```powershell
# Avec DATABASE_URL automatique (récupère depuis gcloud)
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'VOTRE_MOT_DE_PASSE'

# Avec DATABASE_URL manuelle
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -DatabaseUrl 'postgresql://user:pass@host:port/yukpo_postgres?sslmode=require'
```

**Options** :
- `-DatabaseUrl` : URL de connexion complète (si non fournie, construit automatiquement)
- `-UserPassword` : Mot de passe pour construire la DATABASE_URL
- `-GenerateCache` : Génère aussi le cache SQLx (`.sqlx/`)

**Ce que fait le script** :
1. ✅ Construit la DATABASE_URL (si non fournie)
2. ✅ Teste la connexion à la base
3. ✅ Génère le cache SQLx (si `-GenerateCache`)
4. ✅ Applique les migrations SQLx

---

### 3. `scripts\verifier-bases-donnees-gcp.ps1`

**Fonction** : Vérifie et liste les bases de données dans Cloud SQL

**Usage** :
```powershell
.\scripts\verifier-bases-donnees-gcp.ps1

# Avec DATABASE_URL pour vérifier
$env:DATABASE_URL = "postgresql://..."
.\scripts\verifier-bases-donnees-gcp.ps1 -DatabaseUrl $env:DATABASE_URL
```

---

## 🎯 Workflow Complet

### Étape 1: Vérifier les Bases Existantes

```powershell
.\scripts\verifier-bases-donnees-gcp.ps1
```

**Résultat attendu** :
- Liste des bases existantes
- Identification de `yukpo_postgres` (base principale)
- Identification de `yukpo_db` (base ancienne)

---

### Étape 2: Configurer la Base yukpo_postgres

```powershell
.\scripts\configurer-base-yukpo-postgres.ps1 -UserPassword 'VOTRE_MOT_DE_PASSE'
```

**Résultat attendu** :
- ✅ Base `yukpo_postgres` créée ou vérifiée
- ✅ Utilisateur `yukpo_user` créé ou vérifié
- ✅ DATABASE_URL générée (format IP et Unix socket)

**Copiez la DATABASE_URL** affichée pour l'étape suivante.

---

### Étape 3: Appliquer les Migrations

```powershell
# Option A: Avec génération du cache SQLx
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'VOTRE_MOT_DE_PASSE' -GenerateCache

# Option B: Sans génération du cache (si déjà fait)
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'VOTRE_MOT_DE_PASSE'
```

**Résultat attendu** :
- ✅ Migrations SQLx appliquées
- ✅ Cache SQLx généré (si `-GenerateCache`)
- ✅ Toutes les tables créées

---

### Étape 4: Vérifier le Cache SQLx

```powershell
cd backend
(Get-ChildItem -Path .sqlx -Recurse -File).Count
```

**Résultat attendu** : > 200 fichiers

**Si le cache est généré** :
```powershell
git add backend/.sqlx/
git commit -m "chore: regenerate SQLx cache for yukpo_postgres"
```

---

## 🔧 Exemples d'Utilisation

### Exemple 1: Configuration Complète (Première Fois)

```powershell
# 1. Vérifier
.\scripts\verifier-bases-donnees-gcp.ps1

# 2. Configurer
.\scripts\configurer-base-yukpo-postgres.ps1 -UserPassword 'MonMotDePasse123!'

# 3. Appliquer migrations + générer cache
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'MonMotDePasse123!' -GenerateCache

# 4. Commiter le cache
cd backend
git add .sqlx/
git commit -m "chore: setup yukpo_postgres database and SQLx cache"
```

---

### Exemple 2: Mise à Jour des Migrations (Base Existe Déjà)

```powershell
# Appliquer uniquement les nouvelles migrations
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'MonMotDePasse123!'
```

---

### Exemple 3: Régénérer le Cache SQLx

```powershell
cd backend
$env:SQLX_OFFLINE = "false"
$env:DATABASE_URL = "postgresql://yukpo_user:MonMotDePasse123!@34.79.199.41:5432/yukpo_postgres?sslmode=require"
cargo sqlx prepare --workspace -- --lib
```

---

## ⚠️ Dépannage

### Erreur: "Instance Cloud SQL non trouvée"

**Solution** :
```powershell
# Vérifier que l'instance existe
gcloud sql instances list --project=yukpo-project

# Si elle n'existe pas, la créer
gcloud sql instances create yukpo-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --project=yukpo-project
```

---

### Erreur: "password authentication failed"

**Solution** :
- Vérifiez le mot de passe avec `-UserPassword`
- Ou réinitialisez le mot de passe :
```powershell
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password='NOUVEAU_MOT_DE_PASSE' \
  --project=yukpo-project
```

---

### Erreur: "database already exists"

**C'est normal** ! Le script détecte automatiquement si la base existe et continue.

---

### Erreur: "SQLX_OFFLINE but there is no cached data"

**Solution** :
```powershell
# Générer le cache SQLx
.\scripts\appliquer-migrations-yukpo-postgres.ps1 -UserPassword 'VOTRE_PASSWORD' -GenerateCache
```

---

## 📋 Checklist Finale

- [ ] Base `yukpo_postgres` créée/vérifiée
- [ ] Utilisateur `yukpo_user` créé/vérifié
- [ ] Migrations SQLx appliquées
- [ ] Cache SQLx généré (> 200 fichiers)
- [ ] Cache SQLx committé dans Git
- [ ] DATABASE_URL mise à jour dans les secrets GitHub
- [ ] Test de connexion réussi

---

## 🔗 Documentation Associée

- `CLARIFICATION_BASES_DONNEES_GCP.md` : Explication des bases de données
- `GUIDE_EVITER_CONFUSION_BD.md` : Guide pour éviter la confusion
- `CORRECTION_BUILD_SQLX.md` : Correction des erreurs de build SQLx

---

**Date de mise à jour** : 2026-02-16

