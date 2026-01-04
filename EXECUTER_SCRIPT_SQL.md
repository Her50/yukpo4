# 🔧 Instructions pour exécuter le script SQL

Le script SQL doit être exécuté sur la base de données PostgreSQL Render.

## Option 1: Utiliser psql (recommandé)

```bash
# Sur Linux/Mac/WSL
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db?sslmode=require" -f SCRIPT_SUPPRESSION_JSONB.sql

# Ou en une ligne
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db?sslmode=require" -c "UPDATE services SET data = data - 'produits', updated_at = NOW() WHERE data ? 'produits';"
```

## Option 2: Via le dashboard Render

1. Aller sur https://dashboard.render.com
2. Sélectionner la base de données PostgreSQL
3. Ouvrir l'onglet "Connect" ou "SQL Editor"
4. Copier-coller le contenu de `SCRIPT_SUPPRESSION_JSONB.sql`
5. Exécuter

## Option 3: Via un client PostgreSQL (pgAdmin, DBeaver, etc.)

1. Se connecter avec les identifiants Render
2. Exécuter le script SQL

## Commandes SQL à exécuter

```sql
-- Supprimer le champ 'produits' de services.data
UPDATE services
SET data = data - 'produits',
    updated_at = NOW()
WHERE data ? 'produits';

-- Vérifier le résultat
SELECT 
    COUNT(*) as total_services,
    COUNT(*) FILTER (WHERE data ? 'produits') as services_avec_produits_jsonb,
    (SELECT COUNT(DISTINCT service_id) FROM service_products) as services_avec_produits_table
FROM services;
```

## Vérification

Après exécution, la requête de vérification devrait montrer:
- `services_avec_produits_jsonb` = 0 (plus aucun service avec produits en JSONB)
- `services_avec_produits_table` = nombre de services ayant des produits dans la table

