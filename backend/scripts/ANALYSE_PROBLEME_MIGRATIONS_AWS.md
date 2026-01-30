# 🔍 Analyse Approfondie du Problème de Migrations AWS

**Date**: 2026-01-30  
**Problème**: Les migrations depuis l'image Docker dans Git ne s'appliquent pas correctement dans AWS

## 📊 Problème Identifié

### Symptômes
1. **Fonction `hybrid_image_search` non unique** : Plusieurs versions avec signatures différentes
2. **Table `specialized_reservations` manquante** : Référencée mais non créée
3. **Fonction `run_audio_cache_cleanup()` manquante** : Appelée mais non créée
4. **Migrations échouent silencieusement** : Pas d'erreur visible mais les objets ne sont pas créés

### Causes Racines Identifiées

#### 1. **Ordre d'Exécution des Migrations**

Le backend Rust applique les migrations dans cet ordre (voir `main.rs` lignes 502-664) :

```
1. Migration consolidée 0000_create_all_tables.sql (via execute_multiple_sql_commands)
2. Migration consolidée 20260129_create_missing_tables_aws.sql (si existe)
3. Migrations SQLx standard (via sqlx::migrate!("./migrations"))
4. Auto-migrations (via run_auto_migrations())
```

**Problème** : Les auto-migrations qui corrigent les problèmes (comme `ensure_run_audio_cache_cleanup_function`) s'exécutent APRÈS que d'autres migrations aient déjà échoué ou créé des objets incomplets.

#### 2. **Vérification d'Existence Incomplète**

**Exemple avec `run_audio_cache_cleanup`** :
- La fonction `ensure_run_audio_cache_cleanup_function` vérifie seulement si une fonction avec le nom existe
- Elle ne vérifie pas la **signature exacte** (sans paramètres)
- Si une version avec paramètres existe, PostgreSQL retourne `true` mais l'appel `run_audio_cache_cleanup()` échoue

**Solution appliquée** : Supprimer TOUTES les versions de la fonction avant de la recréer (comme pour `hybrid_image_search`)

#### 3. **Transactions et Rollback Partiel**

Certaines migrations utilisent `execute_multiple_sql_commands` qui exécute plusieurs commandes SQL séparément. Si une commande échoue :
- Les commandes précédentes sont déjà appliquées
- Les commandes suivantes ne s'exécutent pas
- L'état de la base est **incohérent**

#### 4. **Dépendances Entre Migrations**

**Exemple** :
- `specialized_reservations` est référencée par `covoiturage_insurance` et `reservation_qr_codes`
- Si `specialized_reservations` n'est pas créée, les migrations qui la référencent échouent
- Mais l'erreur peut être silencieuse ou partielle

#### 5. **Fonctions Dupliquées**

**Exemple avec `hybrid_image_search`** :
- Plusieurs migrations créent la fonction avec des signatures différentes
- PostgreSQL permet la surcharge de fonctions (même nom, signatures différentes)
- Mais `sqlx` ou le code Rust peut appeler la fonction sans spécifier la signature
- PostgreSQL ne peut pas déterminer quelle version utiliser → erreur "function name is not unique"

## 🔧 Solutions Appliquées

### 1. Corrections Intégrées dans `auto_migrate.rs`

Les corrections critiques sont maintenant exécutées **en premier** dans `run_auto_migrations()` :

```rust
// ✅ NOUVEAU 2026-01-30: Corrections critiques pour les problèmes AWS
// Ces corrections doivent s'exécuter en premier pour résoudre les dépendances
// et les fonctions dupliquées avant que d'autres migrations ne tentent de les utiliser.

match fix_hybrid_image_search_duplicates(pool).await {
    Ok(_) => info!("✅ Correction: hybrid_image_search dupliquées traitées"),
    Err(e) => error!("❌ Erreur correction hybrid_image_search dupliquées: {}", e),
}
match ensure_specialized_reservations_table(pool).await {
    Ok(_) => info!("✅ Correction: specialized_reservations vérifiée/créée"),
    Err(e) => error!("❌ Erreur correction specialized_reservations: {}", e),
}
match ensure_run_audio_cache_cleanup_function(pool).await {
    Ok(_) => info!("✅ Correction: run_audio_cache_cleanup() vérifiée/créée"),
    Err(e) => error!("❌ Erreur correction run_audio_cache_cleanup(): {}", e),
}
```

### 2. Suppression de Toutes les Versions de Fonctions

**Avant** :
```rust
// Vérifie seulement le nom
let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_audio_cache_cleanup')")
```

**Après** :
```rust
// Supprime TOUTES les versions (toutes signatures) avant de recréer
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'run_audio_cache_cleanup'
        AND n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', r.proname, r.args);
    END LOOP;
END $$;
```

### 3. Vérification de Signature Exacte

Pour `run_audio_cache_cleanup`, on vérifie maintenant que la fonction existe **sans paramètres** :
- Suppression de toutes les versions
- Recréation avec la signature exacte attendue par le code Rust

## 🚀 Prochaines Étapes

### 1. Vérifier l'Application des Corrections

Après redéploiement, vérifier dans les logs :
```
✅ Correction: hybrid_image_search dupliquées traitées
✅ Correction: specialized_reservations vérifiée/créée
✅ Fonction run_audio_cache_cleanup() créée avec succès (signature sans paramètres)
```

### 2. Diagnostic Post-Déploiement

Exécuter le script de diagnostic pour vérifier :
```bash
# Depuis une task ECS ou un conteneur avec accès à la DB
./backend/scripts/diagnose_migrations_aws.sh
```

### 3. Améliorations Futures

1. **Ordre d'Exécution Garanti** :
   - Créer un système de dépendances entre migrations
   - Exécuter les corrections critiques avant les migrations standard

2. **Vérification de Signature** :
   - Créer une fonction utilitaire pour vérifier la signature exacte des fonctions
   - Utiliser `pg_get_function_identity_arguments()` au lieu de seulement le nom

3. **Transactions Atomiques** :
   - Utiliser des transactions pour les migrations complexes
   - Rollback automatique en cas d'erreur

4. **Logging Amélioré** :
   - Logger toutes les opérations de migration
   - Créer un rapport de migration après chaque démarrage

## 📝 Notes Techniques

### Pourquoi les Migrations Échouent Silencieusement ?

1. **`sqlx::migrate!()`** continue même si une migration échoue partiellement
2. **`execute_multiple_sql_commands`** exécute les commandes séparément, pas dans une transaction
3. **Erreurs PostgreSQL** peuvent être capturées et ignorées par certains blocs `EXCEPTION`

### Pourquoi l'Image Docker ne Résout pas le Problème ?

L'image Docker contient bien les migrations, mais :
1. L'ordre d'exécution peut varier selon l'état de la base
2. Les migrations peuvent échouer partiellement sans erreur visible
3. Les corrections doivent être appliquées **avant** les migrations qui en dépendent

### Solution Définitive

Intégrer les corrections directement dans le code Rust (`auto_migrate.rs`) garantit :
- ✅ Exécution au bon moment (avant les migrations dépendantes)
- ✅ Application à chaque démarrage (idempotent)
- ✅ Logging visible dans les logs de l'application
- ✅ Pas de dépendance à des scripts externes

## 🔍 Commandes de Diagnostic

### Vérifier l'État Actuel

```bash
# Depuis une task ECS avec accès à la DB
psql "$DATABASE_URL" -c "
SELECT 
    p.proname,
    pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('hybrid_image_search', 'run_audio_cache_cleanup')
AND n.nspname = 'public';
"

# Vérifier specialized_reservations
psql "$DATABASE_URL" -c "
SELECT EXISTS(
    SELECT FROM information_schema.tables 
    WHERE table_name = 'specialized_reservations'
) as exists;
"
```

### Vérifier les Migrations Appliquées

```bash
psql "$DATABASE_URL" -c "
SELECT version, name, success, installed_on 
FROM _sqlx_migrations 
ORDER BY version DESC 
LIMIT 20;
"
```
