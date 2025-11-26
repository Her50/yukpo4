-- ============================================
-- Script d'Investigation des Échecs Pipeline
-- ============================================
-- Ce script analyse les 4 jobs échoués dans les dernières 24h
-- Exécuter sur la base de données de production

-- 1. Liste des 4 Jobs Échoués (Dernières 24h)
-- ============================================
SELECT 
    job_id,
    user_id,
    service_id,
    product_index,
    status,
    error_message,
    progress_steps,
    created_at,
    updated_at,
    ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60, 2) AS duration_minutes
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 10;

-- 2. Analyse Détaillée des Erreurs avec Catégorisation
-- ============================================
SELECT 
    job_id,
    error_message,
    CASE 
        WHEN error_message ILIKE '%timeout%' THEN 'TIMEOUT'
        WHEN error_message ILIKE '%api%' OR error_message ILIKE '%quota%' OR error_message ILIKE '%rate limit%' THEN 'API_ERROR'
        WHEN error_message ILIKE '%storage%' OR error_message ILIKE '%s3%' OR error_message ILIKE '%wasabi%' OR error_message ILIKE '%upload%' OR error_message ILIKE '%bucket%' THEN 'STORAGE_ERROR'
        WHEN error_message ILIKE '%memory%' OR error_message ILIKE '%oom%' OR error_message ILIKE '%out of memory%' THEN 'MEMORY_ERROR'
        WHEN error_message ILIKE '%network%' OR error_message ILIKE '%connection%' OR error_message ILIKE '%refused%' OR error_message ILIKE '%unreachable%' THEN 'NETWORK_ERROR'
        WHEN error_message ILIKE '%ia%' OR error_message ILIKE '%ai%' OR error_message ILIKE '%openai%' OR error_message ILIKE '%anthropic%' OR error_message ILIKE '%gemini%' OR error_message ILIKE '%mistral%' THEN 'AI_ERROR'
        WHEN error_message ILIKE '%database%' OR error_message ILIKE '%postgresql%' OR error_message ILIKE '%sql%' THEN 'DATABASE_ERROR'
        ELSE 'OTHER'
    END AS error_category,
    updated_at,
    ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60, 2) AS duration_minutes
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- 3. Statistiques par Catégorie d'Erreur
-- ============================================
SELECT 
    CASE 
        WHEN error_message ILIKE '%timeout%' THEN 'TIMEOUT'
        WHEN error_message ILIKE '%api%' OR error_message ILIKE '%quota%' OR error_message ILIKE '%rate limit%' THEN 'API_ERROR'
        WHEN error_message ILIKE '%storage%' OR error_message ILIKE '%s3%' OR error_message ILIKE '%wasabi%' OR error_message ILIKE '%upload%' OR error_message ILIKE '%bucket%' THEN 'STORAGE_ERROR'
        WHEN error_message ILIKE '%memory%' OR error_message ILIKE '%oom%' OR error_message ILIKE '%out of memory%' THEN 'MEMORY_ERROR'
        WHEN error_message ILIKE '%network%' OR error_message ILIKE '%connection%' OR error_message ILIKE '%refused%' OR error_message ILIKE '%unreachable%' THEN 'NETWORK_ERROR'
        WHEN error_message ILIKE '%ia%' OR error_message ILIKE '%ai%' OR error_message ILIKE '%openai%' OR error_message ILIKE '%anthropic%' OR error_message ILIKE '%gemini%' OR error_message ILIKE '%mistral%' THEN 'AI_ERROR'
        WHEN error_message ILIKE '%database%' OR error_message ILIKE '%postgresql%' OR error_message ILIKE '%sql%' THEN 'DATABASE_ERROR'
        ELSE 'OTHER'
    END AS error_category,
    COUNT(*) AS count,
    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) AS avg_duration_minutes,
    MIN(updated_at) AS first_failure,
    MAX(updated_at) AS last_failure,
    STRING_AGG(DISTINCT LEFT(error_message, 100), ' | ') AS sample_errors
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_category
ORDER BY count DESC;

-- 4. Jobs Échoués avec Détails du Service et Utilisateur
-- ============================================
SELECT 
    vgj.job_id,
    vgj.user_id,
    vgj.service_id,
    vgj.product_index,
    vgj.error_message,
    vgj.created_at,
    vgj.updated_at,
    ROUND(EXTRACT(EPOCH FROM (vgj.updated_at - vgj.created_at)) / 60, 2) AS duration_minutes,
    s.category AS service_category,
    s.is_active AS service_active,
    u.email AS user_email,
    CASE 
        WHEN vgj.error_message ILIKE '%timeout%' THEN 'TIMEOUT'
        WHEN vgj.error_message ILIKE '%api%' OR vgj.error_message ILIKE '%quota%' OR vgj.error_message ILIKE '%rate limit%' THEN 'API_ERROR'
        WHEN vgj.error_message ILIKE '%storage%' OR vgj.error_message ILIKE '%s3%' OR vgj.error_message ILIKE '%wasabi%' THEN 'STORAGE_ERROR'
        WHEN vgj.error_message ILIKE '%memory%' OR vgj.error_message ILIKE '%oom%' THEN 'MEMORY_ERROR'
        WHEN vgj.error_message ILIKE '%network%' OR vgj.error_message ILIKE '%connection%' THEN 'NETWORK_ERROR'
        WHEN vgj.error_message ILIKE '%ia%' OR vgj.error_message ILIKE '%ai%' OR vgj.error_message ILIKE '%openai%' OR vgj.error_message ILIKE '%anthropic%' THEN 'AI_ERROR'
        WHEN vgj.error_message ILIKE '%database%' OR vgj.error_message ILIKE '%postgresql%' THEN 'DATABASE_ERROR'
        ELSE 'OTHER'
    END AS error_category
FROM video_generation_jobs vgj
LEFT JOIN services s ON vgj.service_id = s.id
LEFT JOIN users u ON vgj.user_id = u.id
WHERE vgj.status = 'failed'
  AND vgj.updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY vgj.updated_at DESC;

-- 5. Progression des Jobs Échoués (Analyse des Steps)
-- ============================================
SELECT 
    job_id,
    error_message,
    progress_steps::jsonb->-1 AS last_step,
    jsonb_array_length(progress_steps::jsonb) AS total_steps,
    progress_steps::jsonb AS all_steps,
    updated_at,
    ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60, 2) AS duration_minutes
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
  AND progress_steps IS NOT NULL
ORDER BY updated_at DESC;

-- 6. Vue d'Ensemble : Tous les Statuts (Dernières 24h)
-- ============================================
SELECT 
    status,
    COUNT(*) AS count,
    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) AS avg_duration_minutes,
    MIN(created_at) AS first_job,
    MAX(updated_at) AS last_update
FROM video_generation_jobs
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 7. Jobs en Cours (Potentiellement Bloqués)
-- ============================================
SELECT 
    job_id,
    user_id,
    service_id,
    product_index,
    status,
    created_at,
    updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60, 2) AS minutes_since_update,
    ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60, 2) AS total_duration_minutes
FROM video_generation_jobs
WHERE status IN ('queued', 'running')
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC
LIMIT 20;

