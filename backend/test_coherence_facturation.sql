-- Test de cohérence de la facturation
-- Base de données: yukpo_db

-- 1. Vérifier la structure actuelle
SELECT 
    'Structure de la table users' as test_type,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('id', 'tokens_balance', 'token_price_user', 'token_price_provider')
ORDER BY ordinal_position;

-- 2. Vérifier les balances actuelles
SELECT 
    'Balances actuelles des utilisateurs' as test_type,
    id,
    email,
    tokens_balance,
    token_price_user,
    token_price_provider
FROM users 
ORDER BY id
LIMIT 10;

-- 3. Test de cohérence pour 1999 tokens
WITH test_calculation AS (
    SELECT 
        1999 as tokens_consommes,
        0.004 as cout_token_openai_fcfa,
        100 as multiplicateur_creation_service
)
SELECT 
    'Test de cohérence pour 1999 tokens' as test_type,
    tokens_consommes,
    cout_token_openai_fcfa,
    (tokens_consommes * cout_token_openai_fcfa) as cout_base_fcfa,
    (tokens_consommes * cout_token_openai_fcfa * multiplicateur_creation_service) as cout_creation_service_fcfa,
    ROUND((tokens_consommes * cout_token_openai_fcfa * multiplicateur_creation_service)) as cout_creation_service_arrondi,
    'Équivalence 1:1 XAF = tokens' as conversion_note,
    ROUND((tokens_consommes * cout_token_openai_fcfa * multiplicateur_creation_service)) as tokens_a_deduire
FROM test_calculation;

-- 4. Vérifier les transactions récentes (si table existe)
SELECT 
    'Transactions récentes (si table existe)' as test_type,
    'Vérifier la cohérence des déductions' as note;

-- 5. Recommandations de cohérence
SELECT 
    'Recommandations pour la cohérence' as test_type,
    '1. Frontend affiche le coût en XAF' as recommandation_1,
    '2. Backend déduit le même montant en tokens (équivalence 1:1)' as recommandation_2,
    '3. Balance utilisateur stockée en tokens' as recommandation_3,
    '4. Conversion XAF → Tokens transparente pour l''utilisateur' as recommandation_4; 