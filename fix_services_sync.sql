-- Script pour synchroniser les services entre Pinecone et PostgreSQL
-- Exécutez ce script dans votre base de données PostgreSQL

-- 1. Vérifier les services existants
SELECT 'Services existants dans PostgreSQL:' as info;
SELECT COUNT(*) as total_services FROM services;

-- 2. Insérer les services manquants (IDs trouvés dans Pinecone)
INSERT INTO services (id, user_id, data, category, gps, is_active, created_at, updated_at)
VALUES 
(27437, 1, '{"titre": {"type_donnee": "string", "valeur": "Pressing Express", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de pressing rapide", "origine_champs": "ia"}}', 'Services de nettoyage', 'Douala, Cameroun', true, NOW(), NOW()),
(228231, 1, '{"titre": {"type_donnee": "string", "valeur": "Pressing Premium", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de pressing haut de gamme", "origine_champs": "ia"}}', 'Services de nettoyage', 'Douala, Cameroun', true, NOW(), NOW()),
(280093, 1, '{"titre": {"type_donnee": "string", "valeur": "Pressing à Douala", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de pressing local", "origine_champs": "ia"}}', 'Services de nettoyage', 'Douala, Cameroun', true, NOW(), NOW()),
(697714, 1, '{"titre": {"type_donnee": "string", "valeur": "Plomberie Express", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de plomberie", "origine_champs": "ia"}}', 'Plomberie', 'Douala, Cameroun', true, NOW(), NOW()),
(681447, 1, '{"titre": {"type_donnee": "string", "valeur": "Plomberie Pro", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de plomberie professionnel", "origine_champs": "ia"}}', 'Plomberie', 'Douala, Cameroun', true, NOW(), NOW()),
(531974, 1, '{"titre": {"type_donnee": "string", "valeur": "Plomberie Rapide", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de plomberie rapide", "origine_champs": "ia"}}', 'Plomberie', 'Douala, Cameroun', true, NOW(), NOW()),
(235094, 1, '{"titre": {"type_donnee": "string", "valeur": "Restaurant Le Gourmet", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Restaurant gastronomique", "origine_champs": "ia"}}', 'Restauration', 'Douala, Cameroun', true, NOW(), NOW()),
(773325, 1, '{"titre": {"type_donnee": "string", "valeur": "Peinture Pro", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de peinture", "origine_champs": "ia"}}', 'Peinture et décoration', 'Douala, Cameroun', true, NOW(), NOW()),
(859203, 1, '{"titre": {"type_donnee": "string", "valeur": "Décoration d''Intérieur", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de décoration", "origine_champs": "ia"}}', 'Décoration d''intérieur', 'Douala, Cameroun', true, NOW(), NOW()),
(559614, 1, '{"titre": {"type_donnee": "string", "valeur": "Librairie Centrale", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Librairie avec large sélection", "origine_champs": "ia"}}', 'Commerce de détail', 'Douala, Cameroun', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Vérifier que les services ont été créés
SELECT 'Services après synchronisation:' as info;
SELECT COUNT(*) as total_services FROM services;

-- 4. Vérifier les services spécifiques
SELECT id, category, is_active FROM services WHERE id IN (27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614) ORDER BY id; 