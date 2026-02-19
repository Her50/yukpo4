-- Script de vérification des colonnes pour :
-- 1. Tables de configuration des livraisons (product_delivery_config)
-- 2. Tables de coursiers (courier_applications, couriers, courier_assets)
-- 3. Toutes les tables media (media, media_engagement, media_distribution, delivery_media, delivery_proof_media)

-- ============================================
-- 1. VÉRIFICATION : product_delivery_config
-- ============================================
SELECT 
    'product_delivery_config' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'product_delivery_config'
ORDER BY ordinal_position;

-- Colonnes attendues pour product_delivery_config :
-- id, service_id, product_index, pickup_address, pickup_latitude, pickup_longitude,
-- required_vehicle_type_id, weight_kg, volume_cm3, requires_isothermal, requires_fragile_handling,
-- pickup_availability_schedule, pickup_instructions, billing_mode, billing_partner_label,
-- is_configured, configured_at, configured_by, created_at, updated_at, storage_location_id

-- ============================================
-- 2. VÉRIFICATION : Tables de coursiers
-- ============================================

-- 2.1 courier_applications
SELECT 
    'courier_applications' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'courier_applications'
ORDER BY ordinal_position;

-- Colonnes attendues pour courier_applications :
-- id, user_id, status, submitted_at, reviewed_at, reviewer_id, rejection_reason,
-- profile_data, documents, notes, created_at, updated_at, partner_id

-- 2.2 couriers
SELECT 
    'couriers' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'couriers'
ORDER BY ordinal_position;

-- Colonnes attendues pour couriers :
-- id, user_id, application_id, status, rating_average, rating_count, bio,
-- hired_at, suspended_at, created_at, updated_at

-- 2.3 courier_assets
SELECT 
    'courier_assets' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'courier_assets'
ORDER BY ordinal_position;

-- Colonnes attendues pour courier_assets :
-- id, courier_id, engine_type, is_primary, max_weight_kg, max_volume_cm3,
-- equipments, available, availability_schedule, documents, created_at, updated_at, vehicle_image_url

-- ============================================
-- 3. VÉRIFICATION : Tables media
-- ============================================

-- 3.1 media (table principale)
SELECT 
    'media' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'media'
ORDER BY ordinal_position;

-- Colonnes attendues pour media :
-- id, service_id, product_id, product_index, type, path, uploaded_at,
-- media_type, file_size, file_format, is_main_image, display_order,
-- ai_description, ai_tags, ai_category, ai_metadata, ai_analyzed_at,
-- ai_model_used, ai_confidence, normalized_ai_tags, normalized_ai_description

-- 3.2 media_engagement
SELECT 
    'media_engagement' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'media_engagement'
ORDER BY ordinal_position;

-- Colonnes attendues pour media_engagement :
-- id, media_id, service_id, event_type, channel, user_id, session_id, metadata, occurred_at

-- 3.3 media_distribution
SELECT 
    'media_distribution' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'media_distribution'
ORDER BY ordinal_position;

-- Colonnes attendues pour media_distribution :
-- id, media_id, service_id, target, status, created_at, updated_at, metadata

-- 3.4 delivery_media
SELECT 
    'delivery_media' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'delivery_media'
ORDER BY ordinal_position;

-- Colonnes attendues pour delivery_media :
-- id, delivery_id, parcel_id, type, path, media_type, file_size, file_format,
-- is_parcel_photo, is_proof_media, proof_type, display_order,
-- ai_description, ai_tags, ai_metadata, ai_analyzed_at, ai_model_used, ai_confidence,
-- uploaded_at, updated_at, metadata

-- 3.5 delivery_proof_media
SELECT 
    'delivery_proof_media' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'delivery_proof_media'
ORDER BY ordinal_position;

-- Colonnes attendues pour delivery_proof_media :
-- id, delivery_id, media_type, media_url, proof_type, uploaded_by, uploaded_at, metadata, created_at

-- ============================================
-- RÉSUMÉ : Colonnes manquantes
-- ============================================
SELECT 
    'RÉSUMÉ' as info,
    table_name,
    COUNT(*) as nombre_colonnes
FROM information_schema.columns
WHERE table_name IN (
    'product_delivery_config',
    'courier_applications',
    'couriers',
    'courier_assets',
    'media',
    'media_engagement',
    'media_distribution',
    'delivery_media',
    'delivery_proof_media'
)
GROUP BY table_name
ORDER BY table_name;



