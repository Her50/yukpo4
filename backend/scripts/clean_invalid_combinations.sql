-- 🧹 Script de nettoyage des combinaisons invalides dans autocomplete_combinations
-- Auteur: Yukpomnang Backend Team
-- Date: 2025-11-06
-- Description: Supprime les combinaisons illogiques générées sans dépendances strictes

-- =============================================================================
-- ANALYSE AVANT SUPPRESSION
-- =============================================================================

-- 1. Compter les combinaisons actuelles
SELECT 
    'AVANT NETTOYAGE' as etape,
    COUNT(*) as total_combinaisons,
    COUNT(DISTINCT session_id) as nombre_sessions,
    COUNT(DISTINCT service_id) as nombre_services,
    MIN(created_at) as premiere_date,
    MAX(created_at) as derniere_date
FROM autocomplete_combinations;

-- 2. Identifier les sessions avec trop de combinaisons (probablement sans dépendances)
SELECT 
    session_id,
    COUNT(*) as nb_combinaisons,
    MAX(created_at) as date_creation,
    array_agg(DISTINCT service_id) as services_associes
FROM autocomplete_combinations
WHERE session_id IS NOT NULL
GROUP BY session_id
HAVING COUNT(*) > 50  -- Plus de 50 combinaisons = probablement illogique
ORDER BY nb_combinaisons DESC;

-- =============================================================================
-- STRATÉGIE DE NETTOYAGE
-- =============================================================================

-- Option 1: SUPPRIMER TOUTES les combinaisons sans service_id
-- (Ce sont les seeds de préparation jamais utilisés)
-- DELETE FROM autocomplete_combinations 
-- WHERE service_id IS NULL;

-- Option 2: GARDER SEULEMENT les combinaisons préférées IA pour chaque session
-- (Supprime toutes les variantes sauf le seed principal)
DELETE FROM autocomplete_combinations
WHERE id NOT IN (
    SELECT MIN(id)  -- Garde seulement la première combinaison de chaque session
    FROM autocomplete_combinations
    WHERE session_id IS NOT NULL
    GROUP BY session_id
)
AND session_id IS NOT NULL
AND service_id IS NULL;  -- Seulement les non rattachées à un service réel

-- Option 3: SUPPRESSION COMPLÈTE (⚠️ ATTENTION - Supprime tout et repart de zéro)
-- TRUNCATE TABLE autocomplete_combinations RESTART IDENTITY CASCADE;

-- =============================================================================
-- ANALYSE APRÈS NETTOYAGE
-- =============================================================================

-- Compter ce qui reste
SELECT 
    'APRÈS NETTOYAGE' as etape,
    COUNT(*) as total_combinaisons,
    COUNT(DISTINCT session_id) as nombre_sessions,
    COUNT(DISTINCT service_id) as nombre_services,
    AVG(usage_count) as usage_moyen
FROM autocomplete_combinations;

-- Vérifier les combinaisons restantes
SELECT 
    session_id,
    COUNT(*) as nb_combinaisons,
    is_ai_preferred,
    MAX(created_at) as date_creation
FROM autocomplete_combinations
WHERE session_id IS NOT NULL
GROUP BY session_id, is_ai_preferred
ORDER BY nb_combinaisons DESC
LIMIT 20;

-- =============================================================================
-- OPTIMISATION APRÈS NETTOYAGE
-- =============================================================================

-- Réindexer pour performance
REINDEX TABLE autocomplete_combinations;

-- Mettre à jour les statistiques
ANALYZE autocomplete_combinations;

-- Vaccumer pour récupérer l'espace disque
VACUUM FULL autocomplete_combinations;

-- =============================================================================
-- RÉSUMÉ
-- =============================================================================

SELECT 
    'STATISTIQUES FINALES' as titre,
    pg_size_pretty(pg_total_relation_size('autocomplete_combinations')) as taille_table,
    (SELECT COUNT(*) FROM autocomplete_combinations) as total_lignes,
    (SELECT COUNT(*) FROM autocomplete_combinations WHERE is_ai_preferred = TRUE) as combinaisons_preferees,
    (SELECT COUNT(*) FROM autocomplete_combinations WHERE service_id IS NOT NULL) as combinaisons_rattachees_service;

