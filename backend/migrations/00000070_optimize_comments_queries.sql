-- Migration pour optimiser les requêtes de commentaires
-- Date: 2025-12-10
-- Description: Ajout d'index pour améliorer les performances des requêtes product_comments

-- 1. Index composite pour la requête principale (service_id + parent_comment_id + created_at)
-- Cette requête est utilisée dans load_comments() avec WHERE service_id = X AND parent_comment_id IS NULL ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_product_comments_service_parent_created 
ON product_comments(service_id, parent_comment_id, created_at DESC)
WHERE parent_comment_id IS NULL;

-- 2. Index pour les réponses (parent_comment_id + created_at)
CREATE INDEX IF NOT EXISTS idx_product_comments_parent_created 
ON product_comments(parent_comment_id, created_at DESC)
WHERE parent_comment_id IS NOT NULL;

-- 3. Index pour les stats (service_id + is_deleted)
CREATE INDEX IF NOT EXISTS idx_product_comments_service_deleted 
ON product_comments(service_id, is_deleted)
WHERE is_deleted = FALSE;

-- 4. Index pour les réactions (comment_id + user_id + reaction_type)
-- Utilisé dans product_comment_reactions
CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_comment_user 
ON product_comment_reactions(comment_id, user_id, reaction_type);

-- 5. Index pour les requêtes récentes (services/recent)
-- Utilisé dans la requête SELECT services WHERE is_active = TRUE AND created_at >= NOW() - INTERVAL '30 days'
CREATE INDEX IF NOT EXISTS idx_services_active_created 
ON services(is_active, created_at DESC)
WHERE is_active = TRUE;

-- 6. Index pour product_delivery_config (service_id + product_index + is_configured)
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_service_product 
ON product_delivery_config(service_id, product_index, is_configured)
WHERE is_configured = TRUE;

-- 7. Index pour delivery_matching_queue (status + next_attempt_at)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_next 
ON delivery_matching_queue(status, next_attempt_at)
WHERE status IN ('queued', 'searching');

-- 8. Index pour video_generation_jobs (status)
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status 
ON video_generation_jobs(status);

-- 9. Index pour media (media_type + uploaded_at)
CREATE INDEX IF NOT EXISTS idx_media_type_uploaded 
ON media(media_type, uploaded_at DESC)
WHERE media_type = 'video';

-- 10. ANALYZE pour mettre à jour les statistiques (VACUUM ne peut pas être exécuté dans une transaction SQLx)
ANALYZE product_comments;
ANALYZE product_comment_reactions;
ANALYZE services;
ANALYZE product_delivery_config;
ANALYZE delivery_matching_queue;
ANALYZE video_generation_jobs;
ANALYZE media;

