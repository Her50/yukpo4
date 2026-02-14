# ✅ Solution - Application Directe des Migrations

**Date**: 2026-02-13  
**Problème**: Migration 0 échoue car `merchant_storage_locations` n'existe pas  
**Base de données**: yukpo-db (nouveau compte AWS)

---

## 🔍 **ANALYSE COMPLÈTE**

### Problème Identifié

1. **Migration 0** (`0000_create_all_tables.sql`) référence `merchant_storage_locations` à la ligne 2881
2. **Mais** cette table n'est **JAMAIS créée** dans aucune migration
3. **PostgreSQL refuse** la création de `product_delivery_config` avec FK vers table inexistante
4. **Résultat**: Migration 0 échoue → Aucune table créée → Application s'arrête

### Pourquoi auto_migrate et 0000_create_all_tables n'appliquent pas automatiquement

1. **SQLx exécute les migrations dans l'ordre** (0000, 0001, etc.)
2. **Migration 0 échoue** → Aucune table n'est créée
3. **auto_migrate vérifie** si `users` et `services` existent avant de s'exécuter
4. **Comme ces tables n'existent pas** (migration 0 échouée), auto_migrate ne s'exécute pas
5. **Résultat**: Rien ne fonctionne

### Confirmation: Nouvelle Base du Nouveau Compte

**D'après le CSV**:
- `DATABASE_URL: postgresql://yukpo_admin:PYvHB...`
- Host: `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`
- ✅ **C'est bien la nouvelle base du nouveau compte AWS**

---

## ✅ **SOLUTION - CRÉER MERCHANT_STORAGE_LOCATIONS AVANT LA MIGRATION 0**

### Fichiers Créés

1. **`scripts/fix_merchant_storage_locations.sql`** - Script SQL pour créer la table
2. **`scripts/apply-migrations-complete.sh`** - Script bash pour appliquer toutes les migrations
3. **`ANALYSE_PROBLEME_MIGRATIONS.md`** - Analyse détaillée

---

## 🚀 **APPLICATION DIRECTE - 3 OPTIONS**

### Option 1: Via Script Bash (Recommandé)

```bash
# Sur Linux/Mac ou WSL
bash scripts/apply-migrations-complete.sh
```

**Ce script fait**:
1. ✅ Récupère DATABASE_URL depuis Secrets Manager
2. ✅ Vérifie que c'est la bonne base (yukpo-db)
3. ✅ Crée `merchant_storage_locations` en premier
4. ✅ Applique toutes les migrations SQLx
5. ✅ Ajoute la FK `merchant_id -> users(id)` après création de users
6. ✅ Vérifie que toutes les tables sont créées

### Option 2: Manuellement via psql

```bash
# 1. Récupérer DATABASE_URL
DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' --output text | jq -r '.DATABASE_URL')

# 2. Créer merchant_storage_locations
psql "$DATABASE_URL" -f scripts/fix_merchant_storage_locations.sql

# 3. Appliquer les migrations SQLx
cd backend
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run
```

### Option 3: Via ECS Exec (Depuis le Container)

```bash
# Exécuter dans le container ECS
TASK_ARN=$(aws ecs list-tasks \
  --cluster yukpo-cluster \
  --service-name yukpo-backend-service \
  --desired-status RUNNING \
  --region eu-west-1 \
  --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster yukpo-cluster \
  --task "$TASK_ARN" \
  --container backend \
  --command "bash -c 'cd /app && psql \"\$DATABASE_URL\" -f /app/scripts/fix_merchant_storage_locations.sql && sqlx migrate run'" \
  --interactive \
  --region eu-west-1
```

---

## 📊 **VÉRIFICATION**

### Après Application

```bash
# Vérifier les tables créées
psql "$DATABASE_URL" -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  ORDER BY table_name;
"

# Vérifier les migrations appliquées
psql "$DATABASE_URL" -c "
  SELECT version, description, installed_on 
  FROM _sqlx_migrations 
  ORDER BY installed_on DESC 
  LIMIT 10;
"

# Vérifier merchant_storage_locations
psql "$DATABASE_URL" -c "
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'merchant_storage_locations'
  );
"
```

---

## ✅ **RÉSUMÉ**

### Problème
- ❌ `merchant_storage_locations` n'existe pas mais est référencée dans migration 0
- ❌ Migration 0 échoue → Aucune table créée
- ❌ auto_migrate ne s'exécute pas car users/services n'existent pas

### Solution
- ✅ Créer `merchant_storage_locations` AVANT la migration 0
- ✅ Appliquer ensuite toutes les migrations SQLx normalement
- ✅ Ajouter la FK après création de users

### Fichiers Créés
- ✅ `scripts/fix_merchant_storage_locations.sql`
- ✅ `scripts/apply-migrations-complete.sh`
- ✅ `ANALYSE_PROBLEME_MIGRATIONS.md`
- ✅ `SOLUTION_APPLICATION_MIGRATIONS.md` (ce document)

---

**Action immédiate**: Exécuter `bash scripts/apply-migrations-complete.sh`

