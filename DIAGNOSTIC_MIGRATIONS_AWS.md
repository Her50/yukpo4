# 🔍 Diagnostic des Erreurs de Migrations dans AWS

## 📋 Problème Identifié

Les logs AWS montrent de nombreuses erreurs indiquant que des tables et fonctions critiques n'existent pas :

### Tables Manquantes
- `product_creation_queue`
- `deliveries`
- `publicites`
- `pharmacies`
- `services` (table de base !)
- `matching_offres_candidats`
- `live_flash_sales`
- `global_promo_events`
- `delivery_matching_queue`
- `video_generation_jobs`
- `delivery_proximity_suggestions`
- `product_orders`
- `social_publication_jobs`

### Fonctions Manquantes
- `run_audio_cache_cleanup()`

## 🎯 Causes Probables

### 1. Migrations SQLx Standard Non Exécutées

Les migrations SQLx standard (`sqlx::migrate!("./migrations").run()`) sont censées créer toutes les tables de base, mais elles peuvent échouer silencieusement :

**Symptômes** :
- Les logs montrent `❌ ERREUR CRITIQUE lors de l'application des migrations SQLx standard`
- L'application continue quand même
- Les tables ne sont pas créées

**Causes possibles** :
1. **Chemin des migrations incorrect** : Le chemin `./migrations` peut ne pas être résolu correctement dans AWS
2. **Permissions insuffisantes** : L'utilisateur PostgreSQL peut ne pas avoir les permissions CREATE TABLE
3. **Erreurs SQL dans les migrations** : Certaines migrations peuvent contenir des erreurs SQL
4. **Checksum mismatch** : La migration 0 peut avoir été modifiée après application

### 2. Migrations Automatiques Non Exécutées

Les migrations automatiques (`run_auto_migrations()`) ne s'exécutent que si :
- `ENABLE_AUTO_MIGRATIONS=true` est défini
- Les tables de base (`users`, `services`) existent

**Problème** : Si les migrations SQLx échouent, les tables de base n'existent pas, donc les migrations automatiques ne s'exécutent pas.

## 🔧 Solutions Appliquées

### 1. Amélioration du Logging (✅ Fait)

**Fichier** : `backend/src/main.rs`

**Améliorations** :
- Logs détaillés de l'état des migrations avant exécution
- Vérification de l'existence des tables critiques après migrations
- Logs d'erreur plus détaillés avec diagnostic
- Comptage des migrations appliquées

**Exemple de logs** :
```
📊 Migrations déjà appliquées: 45
✅ Migrations SQLx standard appliquées avec succès
📊 Migrations appliquées: 3
📊 État des tables critiques: deliveries=false, product_creation_queue=false, publicites=false
```

### 2. Script de Diagnostic (✅ Fait)

**Fichier** : `backend/scripts/diagnose_migrations.rs`

**Usage** :
```bash
cargo run --bin diagnose_migrations
```

**Fonctionnalités** :
- Vérifie l'état de la table `_sqlx_migrations`
- Liste toutes les migrations appliquées/échouées
- Vérifie l'existence des tables critiques
- Vérifie l'existence des fonctions critiques
- Liste les extensions PostgreSQL

### 3. Vérification de la Fonction `run_audio_cache_cleanup`

La fonction `run_audio_cache_cleanup()` est créée dans les migrations automatiques (`auto_migrate.rs` ligne 3234-3291), mais elle ne sera créée que si :
- `ENABLE_AUTO_MIGRATIONS=true`
- Les tables de base existent

## 🚀 Actions Recommandées

### Action Immédiate : Exécuter le Diagnostic

1. **Sur AWS** :
   ```bash
   # Se connecter au conteneur ECS
   # Exécuter le diagnostic
   cargo run --bin diagnose_migrations
   ```

2. **Analyser les résultats** :
   - Si `_sqlx_migrations` n'existe pas → Aucune migration n'a été appliquée
   - Si des migrations sont marquées `success=false` → Voir les erreurs
   - Si des tables critiques manquent → Les migrations SQLx ont échoué

### Action 1 : Vérifier les Logs de Migration

Dans CloudWatch, chercher :
- `🚀 Application des migrations SQLx standard...`
- `✅ Migrations SQLx standard appliquées avec succès` OU `❌ ERREUR CRITIQUE`
- `📊 Migrations appliquées: X`
- `📊 État des tables critiques: ...`

### Action 2 : Vérifier ENABLE_AUTO_MIGRATIONS

Dans AWS ECS Task Definition, vérifier que :
- `ENABLE_AUTO_MIGRATIONS=true` est défini
- La valeur est correctement récupérée depuis Secrets Manager ou SSM

### Action 3 : Exécuter les Migrations Manuellement (Si Nécessaire)

Si les migrations SQLx ne s'exécutent pas automatiquement :

1. **Se connecter à la base de données AWS** :
   ```bash
   psql $DATABASE_URL
   ```

2. **Vérifier l'état** :
   ```sql
   SELECT * FROM _sqlx_migrations ORDER BY version;
   ```

3. **Exécuter les migrations manuellement** :
   ```bash
   cd backend
   sqlx migrate run
   ```

### Action 4 : Créer les Tables Manquantes (Solution Temporaire)

Si certaines tables critiques manquent, créer un script SQL pour les créer :

```sql
-- Exemple pour product_creation_queue
CREATE TABLE IF NOT EXISTS product_creation_queue (
    -- Structure de la table depuis 0000_create_all_tables.sql
);
```

**⚠️ ATTENTION** : Cette solution est temporaire. Il faut identifier pourquoi les migrations ne s'exécutent pas.

## 📊 Vérification Post-Correction

Après avoir appliqué les corrections, vérifier :

1. **Tables créées** :
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
       'users', 'services', 'deliveries', 
       'product_creation_queue', 'publicites'
   );
   ```

2. **Fonctions créées** :
   ```sql
   SELECT proname 
   FROM pg_proc 
   WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND proname = 'run_audio_cache_cleanup';
   ```

3. **Migrations appliquées** :
   ```sql
   SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true;
   ```

## 🔍 Prochaines Étapes

1. ✅ Améliorer le logging (fait)
2. ✅ Créer le script de diagnostic (fait)
3. ⏳ Exécuter le diagnostic sur AWS
4. ⏳ Analyser les résultats
5. ⏳ Corriger les problèmes identifiés
6. ⏳ Vérifier que toutes les tables sont créées
7. ⏳ Vérifier que toutes les fonctions sont créées

## 📝 Notes

- Les migrations SQLx standard sont **OBLIGATOIRES** pour créer les tables de base
- Les migrations automatiques sont **OPTIONNELLES** mais nécessaires pour certaines fonctionnalités
- Si les migrations SQLx échouent, l'application peut démarrer mais de nombreuses fonctionnalités seront indisponibles
- Le nouveau logging aidera à identifier rapidement les problèmes futurs

