# 🔍 Analyse Complète - Problème des Migrations

**Date**: 2026-02-13  
**Fichier analysé**: `log-events-viewer-result (35).csv`  
**Base de données**: yukpo-db (nouveau compte AWS)

---

## ✅ **SUCCÈS MAJEUR - L'APPLICATION DÉMARRE !**

### 🎉 Les Logs [MAIN] Apparaissent Maintenant !

**Lignes 56-75 du CSV**: L'application Rust démarre correctement !

```
[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint
[MAIN] 🔍 Vérification des variables d'environnement critiques...
[MAIN] DATABASE_URL: ✅ Présente
[MAIN] MONGODB_URL: ✅ Présente  ← ÇA FONCTIONNE MAINTENANT!
[MAIN] REDIS_URL: ✅ Présente
[MAIN] JWT_SECRET: ✅ Présente
[MAIN] ✅ Connexion PostgreSQL établie (tentative 1/3)
[MAIN] ✅ Pool PostgreSQL créé avec succès
```

**Conclusion**: ✅ **MONGODB_URL est maintenant injectée correctement !**  
✅ **L'application démarre et atteint main() !**  
✅ **Les corrections du Dockerfile ont fonctionné !**

---

## ❌ **PROBLÈME IDENTIFIÉ - MIGRATIONS SQLX**

### Cause Racine du Problème

**Ligne 5858-5869 du CSV**: Erreur critique lors des migrations

```
❌ ERREUR: relation "merchant_storage_locations" does not exist
   Message: while executing migration 0: 
     relation "merchant_storage_locations" does not exist
```

**Analyse détaillée**:

1. **Migration 0** (`0000_create_all_tables.sql`) référence `merchant_storage_locations` à la **ligne 2881**:
   ```sql
   storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL,
   ```

2. **Mais** `merchant_storage_locations` n'est **JAMAIS créée** dans la migration 0

3. **Recherche dans toutes les migrations**:
   - ❌ Pas de `CREATE TABLE merchant_storage_locations` dans `0000_create_all_tables.sql`
   - ❌ Pas de `CREATE TABLE merchant_storage_locations` dans aucune autre migration
   - ✅ Référencée dans `20250120_002_add_product_stock_management.sql` (ligne 8)
   - ✅ Référencée dans `20260130_add_storage_location_id_to_product_delivery_config.sql` (ligne 10)

4. **Conclusion**: La table `merchant_storage_locations` devrait être créée **AVANT** la migration 0, mais elle n'existe dans aucune migration

---

## 🔍 **POURQUOI AUTO_MIGRATE ET 0000_CREATE_ALL_TABLES N'APPLIQUENT PAS AUTOMATIQUEMENT**

### Ordre d'Exécution

1. **SQLx exécute les migrations dans l'ordre numérique**:
   - `0000_create_all_tables.sql` (première migration)
   - `0001_...`, `0002_...`, etc.

2. **La migration 0 essaie de créer `product_delivery_config`** avec:
   ```sql
   storage_location_id INTEGER REFERENCES merchant_storage_locations(id)
   ```

3. **PostgreSQL refuse** car:
   - La table `merchant_storage_locations` n'existe pas
   - On ne peut pas créer une FK vers une table inexistante

4. **Résultat**:
   - ❌ La migration 0 échoue
   - ❌ Aucune table n'est créée (même pas `users` ou `services`)
   - ❌ `auto_migrate` ne s'exécute pas car il vérifie d'abord si `users` et `services` existent
   - ❌ L'application s'arrête avec Exit Code 1

### Code Source (main.rs)

```rust
// Ligne 1574-1620: auto_migrate ne s'exécute que si users et services existent
if enable_auto_migrations {
    let users_exists: bool = sqlx::query_scalar("SELECT EXISTS ... WHERE table_name = 'users'")
        .fetch_one(&pg_pool)
        .await
        .unwrap_or(false);
    
    let services_exists: bool = sqlx::query_scalar("SELECT EXISTS ... WHERE table_name = 'services'")
        .fetch_one(&pg_pool)
        .await
        .unwrap_or(false);
    
    if !users_exists || !services_exists {
        log::error!("❌ ERREUR CRITIQUE: Impossible d'exécuter les migrations automatiques");
        log::error!("❌ Tables de base manquantes: users={}, services={}", users_exists, services_exists);
        // ❌ auto_migrate est ANNULÉ
    }
}
```

**Conclusion**: `auto_migrate` ne peut pas s'exécuter car `users` et `services` n'existent pas (la migration 0 a échoué).

---

## ✅ **SOLUTION - CRÉER MERCHANT_STORAGE_LOCATIONS AVANT LA MIGRATION 0**

### Script de Correction Créé

**Fichier**: `scripts/fix_merchant_storage_locations.sql`

**Contenu**:
- Crée `merchant_storage_locations` **AVANT** la migration 0
- Gère le cas où `users` n'existe pas encore (crée sans FK, ajoute FK après)
- Crée les index nécessaires

### Script d'Application Créé

**Fichier**: `scripts/apply-migrations-complete.sh`

**Étapes**:
1. ✅ Créer `merchant_storage_locations` en premier
2. ✅ Appliquer la migration 0 (qui devrait maintenant fonctionner)
3. ✅ Ajouter la FK `merchant_id -> users(id)` après création de `users`
4. ✅ Vérifier que toutes les tables sont créées

---

## 🚀 **APPLICATION DIRECTE**

### Option 1: Via Script Bash (Recommandé)

```bash
# Sur Linux/Mac ou WSL
bash scripts/apply-migrations-complete.sh
```

### Option 2: Manuellement

```bash
# 1. Récupérer DATABASE_URL depuis Secrets Manager
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

### Option 3: Via ECS Exec

```bash
# Exécuter dans le container ECS
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task <task-arn> \
  --container backend \
  --command "bash -c 'cd /app && psql \"\$DATABASE_URL\" -f /app/scripts/fix_merchant_storage_locations.sql && sqlx migrate run'" \
  --interactive \
  --region eu-west-1
```

---

## 📊 **VÉRIFICATION DE LA BASE DE DONNÉES**

### Confirmation: Nouvelle Base du Nouveau Compte

**D'après le CSV**:
- `DATABASE_URL: postgresql://yukpo_admin:PYvHB...`
- Host devrait être: `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`

**Vérification**:
```bash
aws rds describe-db-instances \
  --db-instance-identifier yukpo-db \
  --region eu-west-1 \
  --query 'DBInstances[0].Endpoint.Address'
```

**Résultat attendu**: `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`

---

## ✅ **RÉSUMÉ**

### Problèmes Résolus

1. ✅ **MONGODB_URL injectée** - L'application reçoit maintenant MONGODB_URL
2. ✅ **Application démarre** - Les logs [MAIN] apparaissent
3. ✅ **Connexion PostgreSQL** - Fonctionne correctement
4. ✅ **Variables d'environnement** - Toutes présentes

### Problème Actuel

1. ❌ **Migrations SQLx échouent** - Table `merchant_storage_locations` n'existe pas
2. ❌ **14 tables critiques manquantes** - L'application ne peut pas fonctionner sans ces tables
3. ⚠️ **Redis non accessible** - Non-bloquant mais à corriger

### Solution

1. ✅ **Script de correction créé** - `scripts/fix_merchant_storage_locations.sql`
2. ✅ **Script d'application créé** - `scripts/apply-migrations-complete.sh`
3. ✅ **Documentation complète** - Ce document

---

## 🎯 **PROCHAINES ÉTAPES**

1. **Appliquer la correction**:
   ```bash
   bash scripts/apply-migrations-complete.sh
   ```

2. **Vérifier que les tables sont créées**:
   ```bash
   psql "$DATABASE_URL" -c "
     SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name;
   "
   ```

3. **Redémarrer l'application**:
   ```bash
   aws ecs update-service \
     --cluster yukpo-cluster \
     --service yukpo-backend-service \
     --force-new-deployment \
     --region eu-west-1
   ```

4. **Vérifier les logs**:
   ```bash
   aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
   ```

---

**Date de l'analyse**: 2026-02-13  
**Fichiers créés**:
- `scripts/fix_merchant_storage_locations.sql`
- `scripts/apply-migrations-complete.sh`
- `scripts/corriger_et_appliquer_migrations.ps1`
- `ANALYSE_PROBLEME_MIGRATIONS.md`
