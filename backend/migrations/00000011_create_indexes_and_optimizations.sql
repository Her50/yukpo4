-- Index et optimisations supplémentaires

-- =====================================================
-- ✅ NOTE 2026-01-31: Les index d'optimisation ont été déplacés vers les fichiers suivants
-- pour éviter les redondances et améliorer la maintenabilité :
-- =====================================================

-- Index pour livraison (déplacés vers 00000030_create_final_optimizations_and_views.sql) :
-- - idx_deliveries_return_pickup_location_gist
-- - idx_deliveries_return_dropoff_location_gist
-- - idx_deliveries_round_trip
-- - idx_courier_availability_snapshots_recent
-- - idx_delivery_matching_queue_delivery_id_status
-- - idx_delivery_matching_queue_next_attempt
-- - idx_deliveries_creator_id
-- - idx_deliveries_courier_id
-- - idx_deliveries_recipient_user_id
-- - idx_deliveries_tracking_token
-- - idx_deliveries_recipient_tracking_token

-- Index pour services (déplacés vers 00000028_create_optimized_functions_and_cache.sql) :
-- - idx_services_id_for_updates
-- - idx_services_produits_valeur_gin
-- - idx_services_data_produits_partial

-- ✅ NOTE 2026-01-31: L'index idx_courier_availability_snapshots_user_courier
-- a été déplacé vers 00000030_create_final_optimizations_and_views.sql
-- pour éviter la duplication.

