-- Test de l'API search-users pour diagnostiquer le problème d'autocomplete
-- Simule la requête utilisée par conversation_controller.rs::search_users_for_invitation

-- Test 1: Recherche par nom (comme dans le frontend)
SELECT 
    id, 
    nom_complet, 
    email, 
    avatar_url, 
    is_provider, 
    role,
    -- Champs pour debug
    CASE 
        WHEN nom_complet IS NULL OR nom_complet = '' THEN 'MISSING_NAME'
        WHEN email IS NULL OR email = '' THEN 'MISSING_EMAIL'
        ELSE 'OK'
    END as status
FROM users
WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
  AND id != 1  -- Exclure l'utilisateur actuel (exemple avec ID 1)
ORDER BY is_provider DESC, nom_complet ASC
LIMIT 12;

-- Test 2: Recherche sans filtre (devrait retourner tous les utilisateurs sauf l'utilisateur actuel)
SELECT 
    COUNT(*) as total_users_excluding_current,
    COUNT(CASE WHEN nom_complet IS NOT NULL AND nom_complet != '' THEN 1 END) as users_with_names
FROM users
WHERE id != 1;

-- Test 3: Vérifier les utilisateurs avec des noms valides
SELECT 
    id,
    nom_complet,
    email,
    avatar_url,
    is_provider,
    role,
    LENGTH(nom_complet) as name_length
FROM users
WHERE id != 1
  AND nom_complet IS NOT NULL 
  AND nom_complet != ''
ORDER BY nom_complet ASC
LIMIT 10;

-- Test 4: Simulation de la réponse JSON attendue par le frontend
SELECT 
    json_build_object(
        'id', id,
        'nom_complet', nom_complet,
        'email', email,
        'avatar_url', avatar_url,
        'is_provider', is_provider,
        'role', role
    ) as user_json
FROM users
WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
  AND id != 1
ORDER BY is_provider DESC, nom_complet ASC
LIMIT 5;

-- Test 5: Vérifier les permissions et l'accès à la table
SELECT 
    has_table_privilege('public', 'users', 'SELECT') as can_select_users,
    has_table_privilege('public', 'users', 'INSERT') as can_insert_users,
    has_table_privilege('public', 'users', 'UPDATE') as can_update_users,
    has_table_privilege('public', 'conversation_participants', 'SELECT') as can_select_participants,
    has_table_privilege('public', 'conversation_tag_history', 'SELECT') as can_select_tag_history;

-- Test 6: Vérifier si les colonnes existent vraiment
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
AND column_name IN ('id', 'nom_complet', 'email', 'avatar_url', 'is_provider', 'role')
ORDER BY column_name;
