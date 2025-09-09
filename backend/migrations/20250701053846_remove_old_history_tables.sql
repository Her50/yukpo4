-- Migration pour supprimer les anciennes tables d'historisation PostgreSQL
-- Date: 2025-01-07
-- Raison: Migration complète vers MongoDB pour l'historisation

-- Supprimer les tables d'historisation obsolètes
DROP TABLE IF EXISTS interaction_history CASCADE;
DROP TABLE IF EXISTS ia_feedback CASCADE;
DROP TABLE IF EXISTS service_reviews CASCADE;
DROP TABLE IF EXISTS service_scores CASCADE;

-- Supprimer les index associés
DROP INDEX IF EXISTS idx_interaction_history_user_id;
DROP INDEX IF EXISTS idx_interaction_history_service_id;
DROP INDEX IF EXISTS idx_ia_feedback_user_id;
DROP INDEX IF EXISTS idx_ia_feedback_interaction_id;
DROP INDEX IF EXISTS idx_ia_feedback_created_at;
DROP INDEX IF EXISTS idx_ia_feedback_model_used;
DROP INDEX IF EXISTS idx_ia_feedback_rating;
DROP INDEX IF EXISTS idx_service_reviews_user_id;
DROP INDEX IF EXISTS idx_service_reviews_service_id;
DROP INDEX IF EXISTS idx_service_scores_service_id;

-- Supprimer les triggers associés
DROP TRIGGER IF EXISTS trigger_update_ia_feedback_updated_at ON ia_feedback;
DROP TRIGGER IF EXISTS update_service_scores_updated_at ON service_scores;
DROP TRIGGER IF EXISTS update_service_reviews_updated_at ON service_reviews;
DROP TRIGGER IF EXISTS update_ia_feedback_updated_at ON ia_feedback;

-- Supprimer les fonctions de trigger
DROP FUNCTION IF EXISTS update_ia_feedback_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_service_scores_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_service_reviews_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_ia_feedback_updated_at() CASCADE;

-- Note: Les données d'historisation sont maintenant gérées par MongoDB
-- via le service MongoHistoryService pour une meilleure performance et flexibilité 