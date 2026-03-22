-- Vérification simple des tables pour @mention
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'chat_messages', 'conversation_participants', 'conversation_tag_history', 'users') 
ORDER BY table_name;
