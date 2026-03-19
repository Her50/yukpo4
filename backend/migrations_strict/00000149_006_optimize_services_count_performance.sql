-- Migration: Optimiser COUNT(*) pour services par user_id
-- Date: 2025-11-28
-- Problème: COUNT(*) prend 72ms pour services WHERE user_id = $1
-- Solution: Créer index partiel pour accélérer le comptage

-- ✅ Index pour COUNT(*) optimisé (si user_id est souvent utilisé pour compter)
CREATE INDEX IF NOT EXISTS idx_services_user_id_count 
ON services(user_id) 
WHERE user_id IS NOT NULL;

-- ✅ Index composite pour la requête principale (déjà optimisé mais vérifier)
-- Cet index est utilisé pour ORDER BY created_at DESC avec WHERE user_id = $1
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc_count
ON services(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Commentaire: Ces index accélèrent:
-- 1. SELECT COUNT(*) FROM services WHERE user_id = $1
-- 2. SELECT ... FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3

