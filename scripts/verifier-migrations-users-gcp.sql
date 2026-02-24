-- Vérification des colonnes de la table users requises pour le login et la phase de lancement
-- À exécuter sur la base GCP (Cloud SQL) pour diagnostiquer "impossible de se connecter"
-- Usage: psql "$DATABASE_URL" -f scripts/verifier-migrations-users-gcp.sql

\echo '=== Vérification table users et colonnes requises ==='

-- 1. Table users existe
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
) AS "table_users_existe";

-- 2. Colonnes requises pour le LOGIN (auth_controller)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name IN (
    'id', 'email', 'password_hash', 'role', 'tokens_balance', 
    'nom_complet', 'partner_status', 'partner_type'
  )
ORDER BY ordinal_position;

-- 3. Colonne requise pour phase de lancement / product-add-cost
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'free_product_created'
) AS "colonne_free_product_created_existe";

-- 4. Résumé : colonnes manquantes éventuelles
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'partner_status') 
         THEN 'OK' ELSE 'MANQUANTE' END AS partner_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'partner_type') 
         THEN 'OK' ELSE 'MANQUANTE' END AS partner_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'free_product_created') 
         THEN 'OK' ELSE 'MANQUANTE' END AS free_product_created;

\echo '=== Si une colonne est MANQUANTE, appliquer les migrations (voir VERIFICATION_MIGRATIONS_GCP.md) ==='
