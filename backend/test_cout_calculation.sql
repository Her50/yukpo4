-- Test du calcul des coûts pour vérifier la cohérence
-- Base de données: yukpo_db

-- 1. Vérifier la fonction de calcul des coûts
SELECT 
    'Test de calcul des coûts' as test_type,
    '1999 tokens pour création de service' as description;

-- 2. Calcul manuel pour vérification
WITH token_costs AS (
    SELECT 
        1999 as tokens_consommes,
        0.004 as cout_token_openai_fcfa,
        100 as multiplicateur_creation_service,
        10 as multiplicateur_autres
)
SELECT 
    tokens_consommes,
    cout_token_openai_fcfa,
    (tokens_consommes * cout_token_openai_fcfa) as cout_base_fcfa,
    (tokens_consommes * cout_token_openai_fcfa * multiplicateur_creation_service) as cout_creation_service_fcfa,
    (tokens_consommes * cout_token_openai_fcfa * multiplicateur_autres) as cout_autres_intentions_fcfa,
    ROUND((tokens_consommes * cout_token_openai_fcfa * multiplicateur_creation_service)) as cout_creation_service_arrondi
FROM token_costs;

-- 3. Vérifier la structure de la table users
SELECT 
    'Structure de la table users' as test_type,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('id', 'tokens_balance', 'token_price_user', 'token_price_provider')
ORDER BY ordinal_position;

-- 4. Vérifier les prix des tokens configurés
SELECT 
    'Prix des tokens configurés' as test_type,
    id,
    email,
    tokens_balance,
    token_price_user,
    token_price_provider
FROM users 
LIMIT 5; 