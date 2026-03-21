-- Test direct de l'API search-users pour vérifier si le problème est dans le backend
-- Simule exactement la requête que InlineMentionSuggestions envoie

-- Test 1: Recherche avec 'a' (comme dans le frontend)
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

-- Test 2: Simulation de la réponse JSON exacte comme le backend la génère
SELECT 
    json_agg(
        json_build_object(
            'id', id,
            'nom_complet', nom_complet,
            'email', email,
            'avatar_url', avatar_url,
            'is_provider', is_provider,
            'role', role
        )
    ) as users_array,
    COUNT(*) as user_count
FROM users
WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
  AND id != 1
ORDER BY is_provider DESC, nom_complet ASC
LIMIT 12;

-- Test 3: Vérifier le format exact que le backend Rust devrait retourner
SELECT 
    json_build_object(
        'success', true,
        'data', json_build_object(
            'data', (
                SELECT json_agg(
                    json_build_object(
                        'id', u.id,
                        'nom_complet', u.nom_complet,
                        'email', u.email,
                        'avatar_url', u.avatar_url,
                        'is_provider', u.is_provider,
                        'role', u.role
                    )
                )
                FROM (
                    SELECT id, nom_complet, email, avatar_url, is_provider, role
                    FROM users
                    WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
                      AND id != 1
                    ORDER BY is_provider DESC, nom_complet ASC
                    LIMIT 12
                ) u
            ),
            'count', (
                SELECT COUNT(*)
                FROM users
                WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
                  AND id != 1
            )
        )
    ) as backend_response_format;

-- Test 4: Vérifier les utilisateurs avec des noms valides pour le @mention
SELECT 
    id,
    nom_complet,
    email,
    avatar_url,
    is_provider,
    role,
    -- Vérifier si le nom peut être utilisé pour @mention
    CASE 
        WHEN nom_complet IS NULL OR nom_complet = '' THEN 'INUTILISABLE'
        WHEN nom_complet ~ '[^a-zA-Z0-9\s]' THEN 'CONTIENT_CARACTERES_SPECIAUX'
        ELSE 'UTILISABLE'
    END as mention_status,
    -- Suggestion de @mention format
    CASE 
        WHEN nom_complet IS NOT NULL AND nom_complet != '' 
        THEN '@' || regexp_replace(nom_complet, '[^a-zA-Z0-9\s]', '', 'g')
        ELSE NULL
    END as suggested_mention
FROM users
WHERE id != 1
  AND nom_complet IS NOT NULL 
  AND nom_complet != ''
ORDER BY nom_complet ASC
LIMIT 10;
