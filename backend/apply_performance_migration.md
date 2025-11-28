# Application de la Migration de Performance

## Migration à Appliquer

**Fichier**: `backend/migrations/20251128_001_optimize_search_performance_indexes.sql`

Cette migration ajoute des index critiques pour améliorer les performances de recherche de ~10s à <2s.

## Méthode 1 : Via SQLx (Recommandé)

### Sur Render (Production)

La migration sera appliquée automatiquement au prochain déploiement si vous avez configuré SQLx pour exécuter les migrations au démarrage.

**Vérifier que les migrations sont activées dans `main.rs`**:
```rust
// Dans backend/src/main.rs, ligne ~138
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
    }
    // ...
}
```

### Localement (si base accessible)

```bash
cd backend
sqlx migrate run
```

## Méthode 2 : Via psql (Manuel)

Si vous avez accès direct à la base de données PostgreSQL :

```bash
# Se connecter à la base
psql $DATABASE_URL

# Ou avec les credentials Render
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Appliquer la migration
\i migrations/20251128_001_optimize_search_performance_indexes.sql
```

## Méthode 3 : Via Render Dashboard

1. Aller sur https://dashboard.render.com
2. Sélectionner votre base de données PostgreSQL
3. Aller dans l'onglet "Shell" ou "Query"
4. Copier-coller le contenu de `20251128_001_optimize_search_performance_indexes.sql`
5. Exécuter

## Vérification

Après application, vérifier que les index ont été créés :

```sql
-- Vérifier les index sur publicites
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'publicites' 
AND indexname LIKE 'idx_publicites%';

-- Vérifier les index sur autocomplete_characteristics
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'autocomplete_characteristics' 
AND indexname LIKE 'idx_autocomplete%';

-- Vérifier les index sur services
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE 'idx_services%trgm';

-- Vérifier que l'extension pg_trgm est installée
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

## Impact Attendu

- **Temps de recherche**: ~10s → <2s (80% d'amélioration)
- **Requête publicités**: ~1.1s → <100ms (90% d'amélioration)
- **Jointures autocomplete_characteristics**: Significativement plus rapides

## Rollback (si nécessaire)

Si vous devez annuler la migration :

```sql
-- Supprimer les index créés
DROP INDEX IF EXISTS idx_publicites_status_date_fin;
DROP INDEX IF EXISTS idx_publicites_geo_publicitaire_gist;
DROP INDEX IF EXISTS idx_autocomplete_service_real_product;
DROP INDEX IF EXISTS idx_autocomplete_location_vector_partial;
DROP INDEX IF EXISTS idx_services_gps_trgm;
DROP INDEX IF EXISTS idx_services_titre_service_trgm;
DROP INDEX IF EXISTS idx_services_description_trgm;
DROP INDEX IF EXISTS idx_services_category_trgm;
DROP INDEX IF EXISTS idx_services_produits_characteristic_vector_gin;
```

## Notes

- Les index trigram nécessitent l'extension `pg_trgm` (incluse dans la migration)
- La création des index peut prendre quelques minutes sur une grande base de données
- Les index n'affectent pas les données existantes, seulement les performances

