-- Vérification des tables de conversation et @mention dans PostgreSQL GCP
-- Exécuter cette requête pour diagnostiquer les problèmes d'autocomplete

-- 1. Vérifier si les tables de conversation existent
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'conversations', 
    'chat_messages', 
    'conversation_participants', 
    'conversation_tag_history'
)
ORDER BY table_name;

-- 2. Vérifier les colonnes importantes pour les @mentions
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN (
    'conversations', 
    'chat_messages', 
    'conversation_participants', 
    'conversation_tag_history'
)
AND column_name IN (
    'id', 
    'conversation_id', 
    'user_id', 
    'tagged_user_id', 
    'mentioned_users',
    'nom_complet',
    'email',
    'avatar_url'
)
ORDER BY table_name, column_name;

-- 3. Vérifier s'il y a des utilisateurs dans la table users
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN nom_complet IS NOT NULL AND nom_complet != '' THEN 1 END) as users_with_names,
    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as users_with_email
FROM users;

-- 4. Vérifier quelques exemples d'utilisateurs
SELECT 
    id,
    nom_complet,
    email,
    avatar_url,
    is_provider,
    role
FROM users 
WHERE nom_complet IS NOT NULL 
AND nom_complet != ''
ORDER BY id
LIMIT 10;

-- 5. Vérifier les indexes sur les tables de conversation
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
    'conversations', 
    'chat_messages', 
    'conversation_participants', 
    'conversation_tag_history',
    'users'
)
ORDER BY tablename, indexname;

-- 6. Vérifier s'il y a des données dans conversation_tag_history
SELECT 
    COUNT(*) as total_tag_history
FROM conversation_tag_history;

-- 7. Vérifier s'il y a des participants actifs
SELECT 
    COUNT(*) as total_participants,
    COUNT(DISTINCT conversation_id) as conversations_with_participants,
    COUNT(DISTINCT user_id) as unique_users_in_conversations
FROM conversation_participants 
WHERE is_active = TRUE;

-- 8. Test de la requête de recherche utilisée par le backend
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, nom_complet, email, avatar_url, is_provider, role
FROM users
WHERE (nom_complet ILIKE '%test%' OR email ILIKE '%test%')
  AND id != 1
ORDER BY is_provider DESC, nom_complet ASC
LIMIT 20;
