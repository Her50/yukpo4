-- Migration pour optimiser les requêtes sur services par user_id et created_at
-- Problème: Requête lente (>1s) sur SELECT ... FROM services WHERE user_id = $1 ORDER BY created_at DESC
-- Solution: Index composite sur (user_id, created_at DESC)

CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc 
ON services(user_id, created_at DESC) 
WHERE is_active = TRUE;

-- Index supplémentaire pour les requêtes avec filtre is_active
CREATE INDEX IF NOT EXISTS idx_services_user_id_is_active_created_at 
ON services(user_id, is_active, created_at DESC);

COMMENT ON INDEX idx_services_user_id_created_at_desc IS 'Optimise les requêtes de liste de services par utilisateur triées par date de création';
COMMENT ON INDEX idx_services_user_id_is_active_created_at IS 'Optimise les requêtes de liste de services actifs par utilisateur';

