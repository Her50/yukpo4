# 📊 Analyse - run_migrations_aws.py

**Date**: 2026-02-13  
**Fichier analysé**: `scripts/run_migrations_aws.py`

---

## 🔍 **ANALYSE DU SCRIPT EXISTANT**

### Fonctionnalités du Script Original

Le script `run_migrations_aws.py` fait:

1. ✅ **Récupère DATABASE_URL** depuis SSM Parameter Store (ligne 27-49)
   - **Problème**: Utilise SSM au lieu de Secrets Manager
   - **Notre config**: Utilise Secrets Manager (`yukpo/backend/secrets`)

2. ✅ **Vérifie/installe sqlx-cli** (lignes 52-90)

3. ✅ **Vérifie l'état des migrations** (lignes 110-194)

4. ✅ **Exécute les migrations de correction** AVANT sqlx migrate run (lignes 197-304)
   - `20260130_002_fix_critical_migration_errors.sql`
   - `20260130_003_fix_additional_migration_errors.sql`
   - `20260130_004_fix_all_migration_errors_final.sql`

5. ✅ **Exécute les migrations SQLx standard** (lignes 307-371)

### ❌ **PROBLÈME IDENTIFIÉ**

**Le script original NE CRÉE PAS `merchant_storage_locations` avant la migration 0 !**

**Conséquence**:
- Les migrations de correction s'exécutent
- Mais la migration 0 échoue toujours car `merchant_storage_locations` n'existe pas
- Aucune table n'est créée

---

## ✅ **SOLUTION - VERSION CORRIGÉE**

### Fichier Créé: `scripts/run_migrations_aws_fixed.py`

**Corrections apportées**:

1. ✅ **Récupère DATABASE_URL depuis Secrets Manager** (au lieu de SSM)
   ```python
   def get_database_url_from_secrets_manager() -> str:
       secrets_client = boto3.client('secretsmanager', region_name=AWS_REGION)
       response = secrets_client.get_secret_value(SecretId=SECRET_ID)
       # ...
   ```

2. ✅ **Crée `merchant_storage_locations` AVANT tout** (nouvelle fonction)
   ```python
   def create_merchant_storage_locations(database_url: str) -> bool:
       # Crée la table AVANT la migration 0
   ```

3. ✅ **Ajoute la FK après création de users** (nouvelle fonction)
   ```python
   def add_foreign_key_after_users_created(database_url: str) -> bool:
       # Ajoute merchant_id -> users(id) après création de users
   ```

4. ✅ **Ordre d'exécution corrigé**:
   - Étape 1: Créer `merchant_storage_locations`
   - Étape 2: Exécuter migrations de correction
   - Étape 3: Exécuter migrations SQLx standard
   - Étape 4: Ajouter FK `merchant_id -> users(id)`

---

## 🚀 **UTILISATION**

### Option 1: Utiliser le Script Corrigé

```bash
cd scripts
python run_migrations_aws_fixed.py
```

**Ce script**:
1. ✅ Récupère DATABASE_URL depuis Secrets Manager
2. ✅ Crée `merchant_storage_locations` en premier
3. ✅ Exécute les migrations de correction
4. ✅ Exécute toutes les migrations SQLx
5. ✅ Ajoute la FK après création de users

### Option 2: Modifier le Script Original

**Changements à apporter à `run_migrations_aws.py`**:

1. **Ligne 18**: Changer SSM vers Secrets Manager
   ```python
   # Avant
   SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpo/production/DATABASE_URL")
   
   # Après
   SECRET_ID = os.getenv("SECRET_ID", "yukpo/backend/secrets")
   ```

2. **Ligne 27-49**: Modifier `get_database_url_from_ssm()` pour utiliser Secrets Manager

3. **Ajouter avant ligne 441** (avant `run_correction_migrations`):
   ```python
   # ✅ CRITIQUE: Créer merchant_storage_locations AVANT tout
   create_merchant_storage_locations(database_url)
   ```

4. **Ajouter la fonction `create_merchant_storage_locations()`** (copier depuis `run_migrations_aws_fixed.py`)

---

## 📊 **COMPARAISON**

### Script Original (`run_migrations_aws.py`)

**Ordre d'exécution**:
1. Récupère DATABASE_URL (SSM)
2. Vérifie migrations
3. Exécute migrations de correction
4. Exécute migrations SQLx
5. ❌ **Échoue car `merchant_storage_locations` n'existe pas**

### Script Corrigé (`run_migrations_aws_fixed.py`)

**Ordre d'exécution**:
1. Récupère DATABASE_URL (Secrets Manager) ✅
2. ✅ **Crée `merchant_storage_locations` EN PREMIER**
3. Vérifie migrations
4. Exécute migrations de correction
5. Exécute migrations SQLx (devrait maintenant fonctionner) ✅
6. Ajoute FK `merchant_id -> users(id)` ✅

---

## ✅ **RECOMMANDATION**

**Utiliser le script corrigé**:
```bash
cd scripts
python run_migrations_aws_fixed.py
```

**Ou modifier le script original** pour ajouter la création de `merchant_storage_locations` avant la ligne 441.

---

## 🔍 **POURQUOI LE SCRIPT ORIGINAL N'APPLIQUE PAS AUTOMATIQUEMENT**

1. **Il essaie d'appliquer les migrations** via `sqlx migrate run`
2. **Mais** la migration 0 échoue car `merchant_storage_locations` n'existe pas
3. **SQLx s'arrête** dès la première erreur
4. **Aucune table n'est créée**
5. **auto_migrate ne s'exécute pas** car il vérifie d'abord si `users` existe

**Solution**: Créer `merchant_storage_locations` **AVANT** d'exécuter `sqlx migrate run`

---

**Date de l'analyse**: 2026-02-13  
**Fichier créé**: `scripts/run_migrations_aws_fixed.py`  
**Documentation**: `ANALYSE_RUN_MIGRATIONS_AWS_PY.md`

