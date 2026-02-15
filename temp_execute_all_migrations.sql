-- Script temporaire pour executer toutes les migrations SQLx
-- Date: 2026-02-15 11:25:11
-- ATTENTION: Ce fichier sera supprime apres execution

-- Creer la table _sqlx_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);

-- Executer les migrations dans l'ordre
-- Migration: 0000_create_all_tables.sql
\i backend/migrations/0000_create_all_tables.sql

-- Migration: 00000001_create_extensions.sql
\i backend/migrations/00000001_create_extensions.sql

-- Migration: 00000002_create_base_tables.sql
\i backend/migrations/00000002_create_base_tables.sql

-- Migration: 00000003_create_utility_tables.sql
\i backend/migrations/00000003_create_utility_tables.sql

-- Migration: 00000004_create_payment_tables.sql
\i backend/migrations/00000004_create_payment_tables.sql

-- Migration: 00000005_create_autocomplete_tables.sql
\i backend/migrations/00000005_create_autocomplete_tables.sql

-- Migration: 00000006_create_product_tables.sql
\i backend/migrations/00000006_create_product_tables.sql

-- Migration: 00000007_create_review_tables.sql
\i backend/migrations/00000007_create_review_tables.sql

-- Migration: 00000008_create_delivery_tables.sql
\i backend/migrations/00000008_create_delivery_tables.sql

-- Migration: 00000009_create_specialized_services_tables.sql
\i backend/migrations/00000009_create_specialized_services_tables.sql

-- Migration: 00000010_create_functions.sql
\i backend/migrations/00000010_create_functions.sql

-- Migration: 00000011_create_indexes_and_optimizations.sql
\i backend/migrations/00000011_create_indexes_and_optimizations.sql

-- Migration: 00000012_create_communication_tables.sql
\i backend/migrations/00000012_create_communication_tables.sql

-- Migration: 00000013_create_advertising_tables.sql
\i backend/migrations/00000013_create_advertising_tables.sql

-- Migration: 00000014_create_live_streaming_tables.sql
\i backend/migrations/00000014_create_live_streaming_tables.sql

-- Migration: 00000015_create_flash_sales_tables.sql
\i backend/migrations/00000015_create_flash_sales_tables.sql

-- Migration: 00000016_create_promotion_tables.sql
\i backend/migrations/00000016_create_promotion_tables.sql

-- Migration: 00000017_create_social_media_tables.sql
\i backend/migrations/00000017_create_social_media_tables.sql

-- Migration: 00000018_create_media_engagement_tables.sql
\i backend/migrations/00000018_create_media_engagement_tables.sql

-- Migration: 00000019_create_video_audio_tables.sql
\i backend/migrations/00000019_create_video_audio_tables.sql

-- Migration: 00000020_create_studio_tables.sql
\i backend/migrations/00000020_create_studio_tables.sql

-- Migration: 00000021_create_additional_functions.sql
\i backend/migrations/00000021_create_additional_functions.sql

-- Migration: 00000022_create_remaining_tables_and_functions.sql
\i backend/migrations/00000022_create_remaining_tables_and_functions.sql

-- Migration: 00000023_create_videos_tables.sql
\i backend/migrations/00000023_create_videos_tables.sql

-- Migration: 00000024_create_message_reactions_and_delivery_chat_tables.sql
\i backend/migrations/00000024_create_message_reactions_and_delivery_chat_tables.sql

-- Migration: 00000025_create_effects_and_templates_tables.sql
\i backend/migrations/00000025_create_effects_and_templates_tables.sql

-- Migration: 00000026_create_plugin_marketplace_tables.sql
\i backend/migrations/00000026_create_plugin_marketplace_tables.sql

-- Migration: 00000027_create_menu_planning_tables.sql
\i backend/migrations/00000027_create_menu_planning_tables.sql

-- Migration: 00000028_create_optimized_functions_and_cache.sql
\i backend/migrations/00000028_create_optimized_functions_and_cache.sql

-- Migration: 00000029_create_blood_donation_and_specialized_tables.sql
\i backend/migrations/00000029_create_blood_donation_and_specialized_tables.sql

-- Migration: 00000030_add_delivery_round_trip.sql
\i backend/migrations/00000030_add_delivery_round_trip.sql

-- Migration: 00000030_create_final_optimizations_and_views.sql
\i backend/migrations/00000030_create_final_optimizations_and_views.sql

-- Migration: 00000031_add_delivery_media_table.sql
\i backend/migrations/00000031_add_delivery_media_table.sql

-- Migration: 00000031_create_bus_tables.sql
\i backend/migrations/00000031_create_bus_tables.sql

-- Migration: 00000032_create_bus_functions_and_agency_tables.sql
\i backend/migrations/00000032_create_bus_functions_and_agency_tables.sql

-- Migration: 00000033_create_missing_delivery_tables.sql
\i backend/migrations/00000033_create_missing_delivery_tables.sql

-- Migration: 00000034_create_immobilier_tables.sql
\i backend/migrations/00000034_create_immobilier_tables.sql

-- Migration: 00000035_create_pharmacy_advanced_tables.sql
\i backend/migrations/00000035_create_pharmacy_advanced_tables.sql

-- Migration: 00000036_create_hospital_advanced_tables.sql
\i backend/migrations/00000036_create_hospital_advanced_tables.sql

-- Migration: 00000037_create_lab_advanced_tables.sql
\i backend/migrations/00000037_create_lab_advanced_tables.sql

-- Migration: 00000038_create_offres_emploi_advanced_tables.sql
\i backend/migrations/00000038_create_offres_emploi_advanced_tables.sql

-- Migration: 00000039_create_orientation_scolaire_advanced_tables.sql
\i backend/migrations/00000039_create_orientation_scolaire_advanced_tables.sql

-- Migration: 00000040_create_bourse_livre_advanced_tables.sql
\i backend/migrations/00000040_create_bourse_livre_advanced_tables.sql

-- Migration: 00000041_create_bus_ratings_return_trips_and_additional_tables.sql
\i backend/migrations/00000041_create_bus_ratings_return_trips_and_additional_tables.sql

-- Migration: 20241201_create_payment_tables.sql
\i backend/migrations/20241201_create_payment_tables.sql

-- Migration: 20241220_add_prorated_reactivation_cost.sql
\i backend/migrations/20241220_add_prorated_reactivation_cost.sql

-- Migration: 20241220000001_create_custom_modalities.sql
\i backend/migrations/20241220000001_create_custom_modalities.sql

-- Migration: 20241225_legacy_render_checkpoint.sql
\i backend/migrations/20241225_legacy_render_checkpoint.sql

-- Migration: 20241225001_001_create_payment_attempts_table.sql
\i backend/migrations/20241225001_001_create_payment_attempts_table.sql

-- Migration: 20241225002_002_create_service_interactions_tracking.sql
\i backend/migrations/20241225002_002_create_service_interactions_tracking.sql

-- Migration: 20241226001_001_add_payment_indexes.sql
\i backend/migrations/20241226001_001_add_payment_indexes.sql

-- Migration: 20241226002_001_fix_service_interactions_tracking.sql
\i backend/migrations/20241226002_001_fix_service_interactions_tracking.sql

-- Migration: 20250101_001_create_advanced_features_tables.sql
\i backend/migrations/20250101_001_create_advanced_features_tables.sql

-- Migration: 20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql
\i backend/migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql

-- Migration: 20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql
\i backend/migrations/20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql

-- Migration: 20250101_scalability_improvements.sql
\i backend/migrations/20250101_scalability_improvements.sql

-- Migration: 20250101001_add_advanced_ad_features.sql
\i backend/migrations/20250101001_add_advanced_ad_features.sql

-- Migration: 20250101002_add_publicite_versioning.sql
\i backend/migrations/20250101002_add_publicite_versioning.sql

-- Migration: 20250107_000001_optimize_saved_addresses_index.sql
\i backend/migrations/20250107_000001_optimize_saved_addresses_index.sql

-- Migration: 20250107_fix_bus_tickets_scheduled_only.sql
\i backend/migrations/20250107_fix_bus_tickets_scheduled_only.sql

-- Migration: 20250110000000_extend_media_for_image_search.sql
\i backend/migrations/20250110000000_extend_media_for_image_search.sql

-- Migration: 20250114_optimize_autocomplete_performance.sql
\i backend/migrations/20250114_optimize_autocomplete_performance.sql

-- Migration: 20250119001_002_product_lifecycle_management.sql
\i backend/migrations/20250119001_002_product_lifecycle_management.sql

-- Migration: 20250119002_003_filter_active_products_in_search.sql
\i backend/migrations/20250119002_003_filter_active_products_in_search.sql

-- Migration: 20250119003_enhance_product_search_gps.sql
\i backend/migrations/20250119003_enhance_product_search_gps.sql

-- Migration: 20250120_001_add_order_preparation_system.sql
\i backend/migrations/20250120_001_add_order_preparation_system.sql

-- Migration: 20250120_002_add_product_stock_management.sql
\i backend/migrations/20250120_002_add_product_stock_management.sql

-- Migration: 20250122_fix_notifications_column_name.sql
\i backend/migrations/20250122_fix_notifications_column_name.sql

-- Migration: 20250124_create_products_table.sql
\i backend/migrations/20250124_create_products_table.sql

-- Migration: 20250124001_create_products_table.sql
\i backend/migrations/20250124001_create_products_table.sql

-- Migration: 20250125_create_bus_reservations.sql
\i backend/migrations/20250125_create_bus_reservations.sql

-- Migration: 20250126001_bus_return_trips_system.sql
\i backend/migrations/20250126001_bus_return_trips_system.sql

-- Migration: 20250126002_user_push_tokens.sql
\i backend/migrations/20250126002_user_push_tokens.sql

-- Migration: 20250127_000001_create_user_saved_addresses.sql
\i backend/migrations/20250127_000001_create_user_saved_addresses.sql

-- Migration: 20250127_001_create_effects_library.sql
\i backend/migrations/20250127_001_create_effects_library.sql

-- Migration: 20250127_001_optimize_product_creation.sql
\i backend/migrations/20250127_001_optimize_product_creation.sql

-- Migration: 20250127_002_create_templates_library.sql
\i backend/migrations/20250127_002_create_templates_library.sql

-- Migration: 20250127_002_enrich_effects_to_100.sql
\i backend/migrations/20250127_002_enrich_effects_to_100.sql

-- Migration: 20250127_002_search_scalability_improvements.sql
\i backend/migrations/20250127_002_search_scalability_improvements.sql

-- Migration: 20250127_003_create_advanced_timelines.sql
\i backend/migrations/20250127_003_create_advanced_timelines.sql

-- Migration: 20250127_003_create_async_uploads_table.sql
\i backend/migrations/20250127_003_create_async_uploads_table.sql

-- Migration: 20250127_003_enrich_templates_to_1000.sql
\i backend/migrations/20250127_003_enrich_templates_to_1000.sql

-- Migration: 20250127_004_enrich_templates_1000_complete.sql
\i backend/migrations/20250127_004_enrich_templates_1000_complete.sql

-- Migration: 20250127_005_enrich_templates_ecommerce_200.sql
\i backend/migrations/20250127_005_enrich_templates_ecommerce_200.sql

-- Migration: 20250127_006_enrich_templates_ecommerce_150.sql
\i backend/migrations/20250127_006_enrich_templates_ecommerce_150.sql

-- Migration: 20250127_007_enrich_templates_services_200.sql
\i backend/migrations/20250127_007_enrich_templates_services_200.sql

-- Migration: 20250127_008_enrich_templates_creators_200.sql
\i backend/migrations/20250127_008_enrich_templates_creators_200.sql

-- Migration: 20250127_009_enrich_templates_business_200.sql
\i backend/migrations/20250127_009_enrich_templates_business_200.sql

-- Migration: 20250127_010_enrich_templates_social_media_200.sql
\i backend/migrations/20250127_010_enrich_templates_social_media_200.sql

-- Migration: 20250127_011_enrich_templates_restaurant_110.sql
\i backend/migrations/20250127_011_enrich_templates_restaurant_110.sql

-- Migration: 20250127_012_create_plugin_marketplace.sql
\i backend/migrations/20250127_012_create_plugin_marketplace.sql

-- Migration: 20250127_013_create_version_control_tables.sql
\i backend/migrations/20250127_013_create_version_control_tables.sql

-- Migration: 20250127_add_duration_minutes_bus_tickets.sql
\i backend/migrations/20250127_add_duration_minutes_bus_tickets.sql

-- Migration: 20250127_add_message_reactions.sql
\i backend/migrations/20250127_add_message_reactions.sql

-- Migration: 20250127_add_performance_indexes_specialized_services.sql
\i backend/migrations/20250127_add_performance_indexes_specialized_services.sql

-- Migration: 20250127_create_bourse_livre_advanced_tables.sql
\i backend/migrations/20250127_create_bourse_livre_advanced_tables.sql

-- Migration: 20250127_create_hospital_advanced_tables.sql
\i backend/migrations/20250127_create_hospital_advanced_tables.sql

-- Migration: 20250127_create_immobilier_complete_tables.sql
\i backend/migrations/20250127_create_immobilier_complete_tables.sql

-- Migration: 20250127_create_lab_advanced_tables.sql
\i backend/migrations/20250127_create_lab_advanced_tables.sql

-- Migration: 20250127_create_menu_planning_tables.sql
\i backend/migrations/20250127_create_menu_planning_tables.sql

-- Migration: 20250127_create_offres_emploi_advanced_tables.sql
\i backend/migrations/20250127_create_offres_emploi_advanced_tables.sql

-- Migration: 20250127_create_orientation_scolaire_advanced_tables.sql
\i backend/migrations/20250127_create_orientation_scolaire_advanced_tables.sql

-- Migration: 20250127_create_pharmacy_advanced_tables.sql
\i backend/migrations/20250127_create_pharmacy_advanced_tables.sql

-- Migration: 20250127_loyalty_chat_rating_tables.sql
\i backend/migrations/20250127_loyalty_chat_rating_tables.sql

-- Migration: 20250127_phase1_delivery_optimizations.sql
\i backend/migrations/20250127_phase1_delivery_optimizations.sql

-- Migration: 20250127_phase2_delivery_partitioning.sql
\i backend/migrations/20250127_phase2_delivery_partitioning.sql

-- Migration: 20250127000001_create_product_delivery_config.sql
\i backend/migrations/20250127000001_create_product_delivery_config.sql

-- Migration: 20250127000002_create_client_delivery_preferences.sql
\i backend/migrations/20250127000002_create_client_delivery_preferences.sql

-- Migration: 20250127000003_create_external_delivery_providers.sql
\i backend/migrations/20250127000003_create_external_delivery_providers.sql

-- Migration: 20250127000004_create_public_tracking_tokens.sql
\i backend/migrations/20250127000004_create_public_tracking_tokens.sql

-- Migration: 20250127000005_create_delivery_payment_reservations.sql
\i backend/migrations/20250127000005_create_delivery_payment_reservations.sql

-- Migration: 20250127000006_add_payment_methods_matching.sql
\i backend/migrations/20250127000006_add_payment_methods_matching.sql

-- Migration: 20250128_001_add_media_urls_to_comments.sql
\i backend/migrations/20250128_001_add_media_urls_to_comments.sql

-- Migration: 20250128_001_add_specialized_reservations_and_ratings.sql
\i backend/migrations/20250128_001_add_specialized_reservations_and_ratings.sql

-- Migration: 20250128_002_add_pharmacy_products.sql
\i backend/migrations/20250128_002_add_pharmacy_products.sql

-- Migration: 20250128_999_create_automated_reports.sql
\i backend/migrations/20250128_999_create_automated_reports.sql

-- Migration: 20250128_999_create_pixel_tracking.sql
\i backend/migrations/20250128_999_create_pixel_tracking.sql

-- Migration: 20250128_999_create_publicite_audiences_and_assets.sql
\i backend/migrations/20250128_999_create_publicite_audiences_and_assets.sql

-- Migration: 20250128_999_create_publicite_impressions.sql
\i backend/migrations/20250128_999_create_publicite_impressions.sql

-- Migration: 20250128_add_hospital_lab_scalability_indexes.sql
\i backend/migrations/20250128_add_hospital_lab_scalability_indexes.sql

-- Migration: 20250128_add_specialized_services_constraints.sql
\i backend/migrations/20250128_add_specialized_services_constraints.sql

-- Migration: 20250128_add_specialized_type_triggers.sql
\i backend/migrations/20250128_add_specialized_type_triggers.sql

-- Migration: 20250128_add_taxi_covoit_scalability_indexes.sql
\i backend/migrations/20250128_add_taxi_covoit_scalability_indexes.sql

-- Migration: 20250128_create_delivery_chat_tables.sql
\i backend/migrations/20250128_create_delivery_chat_tables.sql

-- Migration: 20250128_create_livres_scolaires_troc.sql
\i backend/migrations/20250128_create_livres_scolaires_troc.sql

-- Migration: 20250128_create_offres_emploi.sql
\i backend/migrations/20250128_create_offres_emploi.sql

-- Migration: 20250128_create_orientation_scolaire.sql
\i backend/migrations/20250128_create_orientation_scolaire.sql

-- Migration: 20250128_create_search_history_and_saved_searches.sql
\i backend/migrations/20250128_create_search_history_and_saved_searches.sql

-- Migration: 20250128_create_specialized_services_drafts.sql
\i backend/migrations/20250128_create_specialized_services_drafts.sql

-- Migration: 20250128_improve_return_trip_matching.sql
\i backend/migrations/20250128_improve_return_trip_matching.sql

-- Migration: 20250128_improve_stock_management.sql
\i backend/migrations/20250128_improve_stock_management.sql

-- Migration: 20250128_optimize_flash_blackfriday_scalability.sql
\i backend/migrations/20250128_optimize_flash_blackfriday_scalability.sql

-- Migration: 20250129_add_insurance_qr_covoiturage.sql
\i backend/migrations/20250129_add_insurance_qr_covoiturage.sql

-- Migration: 20250129_add_recurring_trips_covoiturage.sql
\i backend/migrations/20250129_add_recurring_trips_covoiturage.sql

-- Migration: 20250129_create_user_documents.sql
\i backend/migrations/20250129_create_user_documents.sql

-- Migration: 20250529_add_gps_and_timestamp.sql
\i backend/migrations/20250529_add_gps_and_timestamp.sql

-- Migration: 20250601_create_alerts.sql
\i backend/migrations/20250601_create_alerts.sql

-- Migration: 20250610_create_service_embeddings.sql
\i backend/migrations/20250610_create_service_embeddings.sql

-- Migration: 20250612_add_gps_to_service_embeddings.sql
\i backend/migrations/20250612_add_gps_to_service_embeddings.sql

-- Migration: 20250614_create_programmes_scolaires.sql
\i backend/migrations/20250614_create_programmes_scolaires.sql

-- Migration: 20250701053842_create_missing_tables.sql
\i backend/migrations/20250701053842_create_missing_tables.sql

-- Migration: 20250701053846_remove_old_history_tables.sql
\i backend/migrations/20250701053846_remove_old_history_tables.sql

-- Migration: 20250701053847_add_missing_columns_and_tables.sql
\i backend/migrations/20250701053847_add_missing_columns_and_tables.sql

-- Migration: 20250701094746_create_echanges_table.sql
\i backend/migrations/20250701094746_create_echanges_table.sql

-- Migration: 20250701103000_add_don_and_programmes_scolaires.sql
\i backend/migrations/20250701103000_add_don_and_programmes_scolaires.sql

-- Migration: 20250712001_001_add_embedding_status.sql
\i backend/migrations/20250712001_001_add_embedding_status.sql

-- Migration: 20250712002_001_add_embedding_status_to_services.sql
\i backend/migrations/20250712002_001_add_embedding_status_to_services.sql

-- Migration: 20250712003_add_embedding_status.sql
\i backend/migrations/20250712003_add_embedding_status.sql

-- Migration: 20250712174557_add_embedding_status_to_services.sql
\i backend/migrations/20250712174557_add_embedding_status_to_services.sql

-- Migration: 20250828_001_add_interaction_columns.sql
\i backend/migrations/20250828_001_add_interaction_columns.sql

-- Migration: 20250830001_001_add_native_search_indexes.sql
\i backend/migrations/20250830001_001_add_native_search_indexes.sql

-- Migration: 20250830002_002_add_postgis_geospatial.sql
\i backend/migrations/20250830002_002_add_postgis_geospatial.sql

-- Migration: 20250830003_003_add_promotion_field.sql
\i backend/migrations/20250830003_003_add_promotion_field.sql

-- Migration: 20250830004_003_optimize_indexes.sql
\i backend/migrations/20250830004_003_optimize_indexes.sql

-- Migration: 20250830005_add_media_fields_to_services.sql
\i backend/migrations/20250830005_add_media_fields_to_services.sql

-- Migration: 20250830006_add_user_names.sql
\i backend/migrations/20250830006_add_user_names.sql

-- Migration: 20250901_add_unaccent_extension.sql
\i backend/migrations/20250901_add_unaccent_extension.sql

-- Migration: 20250926001_001_create_payment_tables_final.sql
\i backend/migrations/20250926001_001_create_payment_tables_final.sql

-- Migration: 20250926002_002_create_payment_tables_production.sql
\i backend/migrations/20250926002_002_create_payment_tables_production.sql

-- Migration: 20250926100000_create_payment_tables_sqlx.sql
\i backend/migrations/20250926100000_create_payment_tables_sqlx.sql

-- Migration: 20251017001_create_notifications_table.sql
\i backend/migrations/20251017001_create_notifications_table.sql

-- Migration: 20251017002_create_push_tokens_table.sql
\i backend/migrations/20251017002_create_push_tokens_table.sql

-- Migration: 20251018_create_chat_tables.sql
\i backend/migrations/20251018_create_chat_tables.sql

-- Migration: 20251020001_add_conversation_participants.sql
\i backend/migrations/20251020001_add_conversation_participants.sql

-- Migration: 20251020002_add_deactivate_expired_products_function.sql
\i backend/migrations/20251020002_add_deactivate_expired_products_function.sql

-- Migration: 20251020003_add_pharmacy_hospital_scheduling_search.sql
\i backend/migrations/20251020003_add_pharmacy_hospital_scheduling_search.sql

-- Migration: 20251020004_add_signalement_system.sql
\i backend/migrations/20251020004_add_signalement_system.sql

-- Migration: 20251020005_create_service_team_management.sql
\i backend/migrations/20251020005_create_service_team_management.sql

-- Migration: 20251020006_improve_product_search_all_fields.sql
\i backend/migrations/20251020006_improve_product_search_all_fields.sql

-- Migration: 20251021001_add_ai_image_analysis.sql
\i backend/migrations/20251021001_add_ai_image_analysis.sql

-- Migration: 20251021002_add_message_replies.sql
\i backend/migrations/20251021002_add_message_replies.sql

-- Migration: 20251021003_add_promotion_to_products.sql
\i backend/migrations/20251021003_add_promotion_to_products.sql

-- Migration: 20251021004_create_publicites_table.sql
\i backend/migrations/20251021004_create_publicites_table.sql

-- Migration: 20251022001_001_add_publicite_boost_levels.sql
\i backend/migrations/20251022001_001_add_publicite_boost_levels.sql

-- Migration: 20251022002_002_create_visibility_tracking.sql
\i backend/migrations/20251022002_002_create_visibility_tracking.sql

-- Migration: 20251025001_create_appliance_models.sql
\i backend/migrations/20251025001_create_appliance_models.sql

-- Migration: 20251025002_create_health_structures.sql
\i backend/migrations/20251025002_create_health_structures.sql

-- Migration: 20251025003_create_phone_models.sql
\i backend/migrations/20251025003_create_phone_models.sql

-- Migration: 20251025004_create_vehicle_models.sql
\i backend/migrations/20251025004_create_vehicle_models.sql

-- Migration: 20251026_create_image_analyses_table.sql
\i backend/migrations/20251026_create_image_analyses_table.sql

-- Migration: 20251027001_002_insert_assurance_modalities.sql
\i backend/migrations/20251027001_002_insert_assurance_modalities.sql

-- Migration: 20251027002_003_create_vehicle_models_table.sql
\i backend/migrations/20251027002_003_create_vehicle_models_table.sql

-- Migration: 20251027003_create_hybrid_image_search_function.sql
\i backend/migrations/20251027003_create_hybrid_image_search_function.sql

-- Migration: 20251027004_create_product_modalities_table.sql
\i backend/migrations/20251027004_create_product_modalities_table.sql

-- Migration: 20251031001_002_create_search_history.sql
\i backend/migrations/20251031001_002_create_search_history.sql

-- Migration: 20251031002_add_product_id_to_media.sql
\i backend/migrations/20251031002_add_product_id_to_media.sql

-- Migration: 20251031003_fix_index_size_limit.sql
\i backend/migrations/20251031003_fix_index_size_limit.sql

-- Migration: 20251101_002_create_token_usage_logs.sql
\i backend/migrations/20251101_002_create_token_usage_logs.sql

-- Migration: 20251101_004_improve_search_with_autocomplete.sql
\i backend/migrations/20251101_004_improve_search_with_autocomplete.sql

-- Migration: 20251101_create_autocomplete_characteristics.sql
\i backend/migrations/20251101_create_autocomplete_characteristics.sql

-- Migration: 20251101001_001_fix_visibility_functions.sql
\i backend/migrations/20251101001_001_fix_visibility_functions.sql

-- Migration: 20251101002_002_create_token_usage_logs.sql
\i backend/migrations/20251101002_002_create_token_usage_logs.sql

-- Migration: 20251101003_004_improve_search_with_autocomplete.sql
\i backend/migrations/20251101003_004_improve_search_with_autocomplete.sql

-- Migration: 20251101004_create_autocomplete_characteristics.sql
\i backend/migrations/20251101004_create_autocomplete_characteristics.sql

-- Migration: 20251102000000_create_autocomplete_combinations.sql
\i backend/migrations/20251102000000_create_autocomplete_combinations.sql

-- Migration: 20251104001_002_fix_autocomplete_combinations.sql
\i backend/migrations/20251104001_002_fix_autocomplete_combinations.sql

-- Migration: 20251104002_003_add_review_replies_system.sql
\i backend/migrations/20251104002_003_add_review_replies_system.sql

-- Migration: 20251104003_004_add_product_reactions.sql
\i backend/migrations/20251104003_004_add_product_reactions.sql

-- Migration: 20251104004_005_add_private_conversations.sql
\i backend/migrations/20251104004_005_add_private_conversations.sql

-- Migration: 20251104005_006_fix_missing_columns.sql
\i backend/migrations/20251104005_006_fix_missing_columns.sql

-- Migration: 20251104006_009_fix_missing_columns.sql
\i backend/migrations/20251104006_009_fix_missing_columns.sql

-- Migration: 20251104007_010_fix_autocomplete_constraint.sql
\i backend/migrations/20251104007_010_fix_autocomplete_constraint.sql

-- Migration: 20251104008_vectorize_autocomplete_characteristics.sql
\i backend/migrations/20251104008_vectorize_autocomplete_characteristics.sql

-- Migration: 20251105_add_labels_to_autocomplete.sql
\i backend/migrations/20251105_add_labels_to_autocomplete.sql

-- Migration: 20251108_001_create_product_comments.sql
\i backend/migrations/20251108_001_create_product_comments.sql

-- Migration: 20251109001_001_create_content_engagement.sql
\i backend/migrations/20251109001_001_create_content_engagement.sql

-- Migration: 20251109002_002_create_live_streaming.sql
\i backend/migrations/20251109002_002_create_live_streaming.sql

-- Migration: 20251110001_100_create_delivery_enums.sql
\i backend/migrations/20251110001_100_create_delivery_enums.sql

-- Migration: 20251110002_101_create_parcel_types.sql
\i backend/migrations/20251110002_101_create_parcel_types.sql

-- Migration: 20251110003_102_create_courier_applications.sql
\i backend/migrations/20251110003_102_create_courier_applications.sql

-- Migration: 20251110004_103_create_couriers_and_assets.sql
\i backend/migrations/20251110004_103_create_couriers_and_assets.sql

-- Migration: 20251110005_104_create_delivery_core.sql
\i backend/migrations/20251110005_104_create_delivery_core.sql

-- Migration: 20251110006_105_create_pricing_tracking_ratings.sql
\i backend/migrations/20251110006_105_create_pricing_tracking_ratings.sql

-- Migration: 20251110007_106_create_support_tables.sql
\i backend/migrations/20251110007_106_create_support_tables.sql

-- Migration: 20251110008_107_create_shopping_orders.sql
\i backend/migrations/20251110008_107_create_shopping_orders.sql

-- Migration: 20251110009_108_add_delivery_recipient_fields.sql
\i backend/migrations/20251110009_108_add_delivery_recipient_fields.sql

-- Migration: 20251110010_create_media_analytics.sql
\i backend/migrations/20251110010_create_media_analytics.sql

-- Migration: 20251111001_002_create_live_flash_sales.sql
\i backend/migrations/20251111001_002_create_live_flash_sales.sql

-- Migration: 20251111002_create_social_connectors.sql
\i backend/migrations/20251111002_create_social_connectors.sql

-- Migration: 20251111003_create_delivery_wallet_events.sql
\i backend/migrations/20251111003_create_delivery_wallet_events.sql

-- Migration: 20251111004_create_video_weekly_reports.sql
\i backend/migrations/20251111004_create_video_weekly_reports.sql

-- Migration: 20251113_001_create_premium_audio_jobs.sql
\i backend/migrations/20251113_001_create_premium_audio_jobs.sql

-- Migration: 20251114001_create_voice_profiles.sql
\i backend/migrations/20251114001_create_voice_profiles.sql

-- Migration: 20251114002_create_studio_sessions.sql
\i backend/migrations/20251114002_create_studio_sessions.sql

-- Migration: 20251115001_create_delivery_matching_tables.sql
\i backend/migrations/20251115001_create_delivery_matching_tables.sql

-- Migration: 20251115002_create_global_promo_platform.sql
\i backend/migrations/20251115002_create_global_promo_platform.sql

-- Migration: 20251116001_create_studio_preview_events.sql
\i backend/migrations/20251116001_create_studio_preview_events.sql

-- Migration: 20251116002_create_service_inventory_overrides.sql
\i backend/migrations/20251116002_create_service_inventory_overrides.sql

-- Migration: 20251123_filter_active_products_in_search_gps_final.sql
\i backend/migrations/20251123_filter_active_products_in_search_gps_final.sql

-- Migration: 20251124001_migrate_products_to_json.sql
\i backend/migrations/20251124001_migrate_products_to_json.sql

-- Migration: 20251125_fix_idx_services_search_optimized.sql
\i backend/migrations/20251125_fix_idx_services_search_optimized.sql

-- Migration: 20251125090540_create_google_places_data_table.sql
\i backend/migrations/20251125090540_create_google_places_data_table.sql

-- Migration: 20251126_create_specialized_services_tables.sql
\i backend/migrations/20251126_create_specialized_services_tables.sql

-- Migration: 20251126_fix_search_services_gps_final_signature.sql
\i backend/migrations/20251126_fix_search_services_gps_final_signature.sql

-- Migration: 20251126_fix_services_user_id_created_at_index.sql
\i backend/migrations/20251126_fix_services_user_id_created_at_index.sql

-- Migration: 20251126_optimize_search_indexes.sql
\i backend/migrations/20251126_optimize_search_indexes.sql

-- Migration: 20251126_search_specialized_services_with_moment.sql
\i backend/migrations/20251126_search_specialized_services_with_moment.sql

-- Migration: 20251127_120000_create_get_product_reactions_count.sql
\i backend/migrations/20251127_120000_create_get_product_reactions_count.sql

-- Migration: 20251127_120001_fix_search_services_gps_final.sql
\i backend/migrations/20251127_120001_fix_search_services_gps_final.sql

-- Migration: 20251127_120002_optimize_slow_queries.sql
\i backend/migrations/20251127_120002_optimize_slow_queries.sql

-- Migration: 20251127_120003_fix_geo_hierarchy_unique_constraint.sql
\i backend/migrations/20251127_120003_fix_geo_hierarchy_unique_constraint.sql

-- Migration: 20251127_120004_optimize_services_queries_indexes.sql
\i backend/migrations/20251127_120004_optimize_services_queries_indexes.sql

-- Migration: 20251127_add_blood_group_to_users.sql
\i backend/migrations/20251127_add_blood_group_to_users.sql

-- Migration: 20251127_add_commission_to_bus_payments.sql
\i backend/migrations/20251127_add_commission_to_bus_payments.sql

-- Migration: 20251127_add_return_time_to_bus_payments.sql
\i backend/migrations/20251127_add_return_time_to_bus_payments.sql

-- Migration: 20251127_agency_departure_schedules.sql
\i backend/migrations/20251127_agency_departure_schedules.sql

-- Migration: 20251127_blood_donation_matching_system.sql
\i backend/migrations/20251127_blood_donation_matching_system.sql

-- Migration: 20251127_bus_manual_seat_blocks.sql
\i backend/migrations/20251127_bus_manual_seat_blocks.sql

-- Migration: 20251127_bus_ticket_validation_system.sql
\i backend/migrations/20251127_bus_ticket_validation_system.sql

-- Migration: 20251127_create_banques_sang_table.sql
\i backend/migrations/20251127_create_banques_sang_table.sql

-- Migration: 20251127_create_token_consumption_and_purchase_history.sql
\i backend/migrations/20251127_create_token_consumption_and_purchase_history.sql

-- Migration: 20251127_improve_return_trip_matching_with_time.sql
\i backend/migrations/20251127_improve_return_trip_matching_with_time.sql

-- Migration: 20251127_integrate_bus_tickets_with_agences_voyage.sql
\i backend/migrations/20251127_integrate_bus_tickets_with_agences_voyage.sql

-- Migration: 20251127_optimize_get_services_performance.sql
\i backend/migrations/20251127_optimize_get_services_performance.sql

-- Migration: 20251128_001_optimize_search_performance_indexes.sql
\i backend/migrations/20251128_001_optimize_search_performance_indexes.sql

-- Migration: 20251128_002_optimize_search_critical_performance.sql
\i backend/migrations/20251128_002_optimize_search_critical_performance.sql

-- Migration: 20251128_003_optimize_slow_queries_performance.sql
\i backend/migrations/20251128_003_optimize_slow_queries_performance.sql

-- Migration: 20251128_004_optimize_monitoring_queries.sql
\i backend/migrations/20251128_004_optimize_monitoring_queries.sql

-- Migration: 20251128_005_optimize_product_search_fallback.sql
\i backend/migrations/20251128_005_optimize_product_search_fallback.sql

-- Migration: 20251128_006_optimize_services_count_performance.sql
\i backend/migrations/20251128_006_optimize_services_count_performance.sql

-- Migration: 20251129_001_optimize_search_tsvector_performance.sql
\i backend/migrations/20251129_001_optimize_search_tsvector_performance.sql

-- Migration: 20251129_002_fix_recherche_produits_complete.sql
\i backend/migrations/20251129_002_fix_recherche_produits_complete.sql

-- Migration: 20251129_003_improve_search_services_gps_final.sql
\i backend/migrations/20251129_003_improve_search_services_gps_final.sql

-- Migration: 20251130_001_FIX_SEARCH_GPS_FINAL_SIGNATURE.sql
\i backend/migrations/20251130_001_FIX_SEARCH_GPS_FINAL_SIGNATURE.sql

-- Migration: 20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql
\i backend/migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql

-- Migration: 20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM_FIXED.sql
\i backend/migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM_FIXED.sql

-- Migration: 20251130_003_FIX_SEARCH_WORD_SIMILARITY.sql
\i backend/migrations/20251130_003_FIX_SEARCH_WORD_SIMILARITY.sql

-- Migration: 20251201_add_missing_product_descriptions.sql
\i backend/migrations/20251201_add_missing_product_descriptions.sql

-- Migration: 20251201_fix_product_lifecycle_sync_trigger.sql
\i backend/migrations/20251201_fix_product_lifecycle_sync_trigger.sql

-- Migration: 20251201_fix_user_push_tokens_schema.sql
\i backend/migrations/20251201_fix_user_push_tokens_schema.sql

-- Migration: 20251201_OPTIMIZE_SEARCH_GPS_FINAL_CRITICAL.sql
\i backend/migrations/20251201_OPTIMIZE_SEARCH_GPS_FINAL_CRITICAL.sql

-- Migration: 20251201_scalability_indexes.sql
\i backend/migrations/20251201_scalability_indexes.sql

-- Migration: 20251202_search_scalability_improvements.sql
\i backend/migrations/20251202_search_scalability_improvements.sql

-- Migration: 20251202195420_add_delivery_engine_pricing.sql
\i backend/migrations/20251202195420_add_delivery_engine_pricing.sql

-- Migration: 20251203_create_videos_table_with_hashtags.sql
\i backend/migrations/20251203_create_videos_table_with_hashtags.sql

-- Migration: 20251203_enhance_recommendations_algorithm.sql
\i backend/migrations/20251203_enhance_recommendations_algorithm.sql

-- Migration: 20251203_optimize_hashtags_scalability.sql
\i backend/migrations/20251203_optimize_hashtags_scalability.sql

-- Migration: 20251207_create_social_video_tables.sql
\i backend/migrations/20251207_create_social_video_tables.sql

-- Migration: 20251209_fix_materialized_views_unique_indexes.sql
\i backend/migrations/20251209_fix_materialized_views_unique_indexes.sql

-- Migration: 20251209_optimize_slow_queries_indexes.sql
\i backend/migrations/20251209_optimize_slow_queries_indexes.sql

-- Migration: 20251210_fix_u_client_name_error.sql
\i backend/migrations/20251210_fix_u_client_name_error.sql

-- Migration: 20251210_optimize_comments_queries.sql
\i backend/migrations/20251210_optimize_comments_queries.sql

-- Migration: 20251211_fix_user_stats_errors.sql
\i backend/migrations/20251211_fix_user_stats_errors.sql

-- Migration: 20251212_optimize_delivery_matching_queue_index.sql
\i backend/migrations/20251212_optimize_delivery_matching_queue_index.sql

-- Migration: 20251216_optimize_product_creation_performance.sql
\i backend/migrations/20251216_optimize_product_creation_performance.sql

-- Migration: 20251217_optimize_search_performance.sql
\i backend/migrations/20251217_optimize_search_performance.sql

-- Migration: 20251220_reindex_existing_products.sql
\i backend/migrations/20251220_reindex_existing_products.sql

-- Migration: 20251221_add_fallback_to_hybrid_image_search.sql
\i backend/migrations/20251221_add_fallback_to_hybrid_image_search.sql

-- Migration: 20251221_align_parcel_types_with_vehicle_types.sql
\i backend/migrations/20251221_align_parcel_types_with_vehicle_types.sql

-- Migration: 20251221_optimize_delivery_indexes.sql
\i backend/migrations/20251221_optimize_delivery_indexes.sql

-- Migration: 20251221_optimize_services_update_performance.sql
\i backend/migrations/20251221_optimize_services_update_performance.sql

-- Migration: 20251221_optimize_slow_endpoints.sql
\i backend/migrations/20251221_optimize_slow_endpoints.sql

-- Migration: 20251222_optimize_slow_queries_indexes.sql
\i backend/migrations/20251222_optimize_slow_queries_indexes.sql

-- Migration: 20251223_improve_hybrid_image_search_relevance.sql
\i backend/migrations/20251223_improve_hybrid_image_search_relevance.sql

-- Migration: 20251224_fix_image_search_relevance_and_performance.sql
\i backend/migrations/20251224_fix_image_search_relevance_and_performance.sql

-- Migration: 20251224_improve_hybrid_image_search_language_and_relevance.sql
\i backend/migrations/20251224_improve_hybrid_image_search_language_and_relevance.sql

-- Migration: 20251224_optimize_slow_queries_critical.sql
\i backend/migrations/20251224_optimize_slow_queries_critical.sql

-- Migration: 20251227_ensure_search_indexes_exist.sql
\i backend/migrations/20251227_ensure_search_indexes_exist.sql

-- Migration: 20251227_fix_image_search_strict_matching.sql
\i backend/migrations/20251227_fix_image_search_strict_matching.sql

-- Migration: 20251227_optimize_add_product_performance.sql
\i backend/migrations/20251227_optimize_add_product_performance.sql

-- Migration: 20251227_simplify_product_search_query.sql
\i backend/migrations/20251227_simplify_product_search_query.sql

-- Migration: 20251230_fix_add_product_tls_error.sql
\i backend/migrations/20251230_fix_add_product_tls_error.sql

-- Migration: 20251230_fix_audio_cache_cleanup_function.sql
\i backend/migrations/20251230_fix_audio_cache_cleanup_function.sql

-- Migration: 20251230_optimize_audio_search_cache.sql
\i backend/migrations/20251230_optimize_audio_search_cache.sql

-- Migration: 20251230_optimize_image_search_vector_matching.sql
\i backend/migrations/20251230_optimize_image_search_vector_matching.sql

-- Migration: 20251230_optimize_search_performance_final.sql
\i backend/migrations/20251230_optimize_search_performance_final.sql

-- Migration: 20251230_optimize_vector_matching_with_similarity.sql
\i backend/migrations/20251230_optimize_vector_matching_with_similarity.sql

-- Migration: 20251231_fix_audio_cache_cleanup_null_handling.sql
\i backend/migrations/20251231_fix_audio_cache_cleanup_null_handling.sql

-- Migration: 20251231_fix_product_creation_deadlock.sql
\i backend/migrations/20251231_fix_product_creation_deadlock.sql

-- Migration: 20251231_fix_product_creation_issues.sql
\i backend/migrations/20251231_fix_product_creation_issues.sql

-- Migration: 20251231_fix_product_creation_performance_v2.sql
\i backend/migrations/20251231_fix_product_creation_performance_v2.sql

-- Migration: 20251231_fix_product_creation_timeout.sql
\i backend/migrations/20251231_fix_product_creation_timeout.sql

-- Migration: 20260102_create_cache_table.sql
\i backend/migrations/20260102_create_cache_table.sql

-- Migration: 20260102_create_product_creation_queue.sql
\i backend/migrations/20260102_create_product_creation_queue.sql

-- Migration: 20260102_fix_cache_table_warnings.sql
\i backend/migrations/20260102_fix_cache_table_warnings.sql

-- Migration: 20260102_optimize_add_product_no_lock.sql
\i backend/migrations/20260102_optimize_add_product_no_lock.sql

-- Migration: 20260103_create_products_table.sql
\i backend/migrations/20260103_create_products_table.sql

-- Migration: 20260103_phase2_correct_media_product_references.sql
\i backend/migrations/20260103_phase2_correct_media_product_references.sql

-- Migration: 20260103_phase2_migrate_existing_products.sql
\i backend/migrations/20260103_phase2_migrate_existing_products.sql

-- Migration: 20260104_001_create_delivery_partners.sql
\i backend/migrations/20260104_001_create_delivery_partners.sql

-- Migration: 20260104_apply_delivery_partners_migrations.sql
\i backend/migrations/20260104_apply_delivery_partners_migrations.sql

-- Migration: 20260111_optimize_delivery_queries_additional.sql
\i backend/migrations/20260111_optimize_delivery_queries_additional.sql

-- Migration: 20260112_optimize_slow_delivery_queries.sql
\i backend/migrations/20260112_optimize_slow_delivery_queries.sql

-- Migration: 20260113_optimize_vector_matching_vectorial.sql
\i backend/migrations/20260113_optimize_vector_matching_vectorial.sql

-- Migration: 20260114_create_negotiated_prices_table.sql
\i backend/migrations/20260114_create_negotiated_prices_table.sql

-- Migration: 20260114_fix_image_search_to_tsvector_error.sql
\i backend/migrations/20260114_fix_image_search_to_tsvector_error.sql

-- Migration: 20260114_optimize_delivery_queries_performance.sql
\i backend/migrations/20260114_optimize_delivery_queries_performance.sql

-- Migration: 20260114_optimize_search_performance.sql
\i backend/migrations/20260114_optimize_search_performance.sql

-- Migration: 20260115_fix_image_search_empty_results.sql
\i backend/migrations/20260115_fix_image_search_empty_results.sql

-- Migration: 20260115_fix_image_search_use_all_ia_keywords.sql
\i backend/migrations/20260115_fix_image_search_use_all_ia_keywords.sql

-- Migration: 20260115_fix_parcel_types_ids.sql
\i backend/migrations/20260115_fix_parcel_types_ids.sql

-- Migration: 20260115_fix_parcel_types_ids_final.sql
\i backend/migrations/20260115_fix_parcel_types_ids_final.sql

-- Migration: 20260115_fix_parcel_types_ids_simple.sql
\i backend/migrations/20260115_fix_parcel_types_ids_simple.sql

-- Migration: 20260115_fix_parcel_types_ids_v2.sql
\i backend/migrations/20260115_fix_parcel_types_ids_v2.sql

-- Migration: 20260115_fix_parcel_types_ids_v3.sql
\i backend/migrations/20260115_fix_parcel_types_ids_v3.sql

-- Migration: 20260124_install_pgvector_extension.sql
\i backend/migrations/20260124_install_pgvector_extension.sql

-- Migration: 20260127_add_courier_specializations.sql
\i backend/migrations/20260127_add_courier_specializations.sql

-- Migration: 20260127_allow_multiple_compatible_deliveries.sql
\i backend/migrations/20260127_allow_multiple_compatible_deliveries.sql

-- Migration: 20260127_create_hotel_reservation_qr_codes.sql
\i backend/migrations/20260127_create_hotel_reservation_qr_codes.sql

-- Migration: 20260129_create_missing_tables_aws.sql
\i backend/migrations/20260129_create_missing_tables_aws.sql

-- Migration: 20260129_fix_migration_0_checksum.sql
\i backend/migrations/20260129_fix_migration_0_checksum.sql

-- Migration: 20260130_001_fix_critical_migrations_aws.sql
\i backend/migrations/20260130_001_fix_critical_migrations_aws.sql

-- Migration: 20260130_002_fix_critical_migration_errors.sql
\i backend/migrations/20260130_002_fix_critical_migration_errors.sql

-- Migration: 20260130_003_fix_additional_migration_errors.sql
\i backend/migrations/20260130_003_fix_additional_migration_errors.sql

-- Migration: 20260130_004_fix_all_migration_errors_final.sql
\i backend/migrations/20260130_004_fix_all_migration_errors_final.sql

-- Migration: 20260130_005_fix_remaining_migration_errors.sql
\i backend/migrations/20260130_005_fix_remaining_migration_errors.sql

-- Migration: 20260130_006_add_partner_columns_to_users.sql
\i backend/migrations/20260130_006_add_partner_columns_to_users.sql

-- Migration: 20260130_007_ensure_users_table_exists.sql
\i backend/migrations/20260130_007_ensure_users_table_exists.sql

-- Migration: 20260130_008_ensure_services_and_media_tables.sql
\i backend/migrations/20260130_008_ensure_services_and_media_tables.sql

-- Migration: 20260130_add_storage_location_id_to_product_delivery_config.sql
\i backend/migrations/20260130_add_storage_location_id_to_product_delivery_config.sql

-- Migration: 20260201_fix_critical_errors.sql
\i backend/migrations/20260201_fix_critical_errors.sql

-- Migration: 20260201_fix_materialized_view_index.sql
\i backend/migrations/20260201_fix_materialized_view_index.sql

-- Migration: 20260202_fix_refresh_services_search_optimized_function.sql
\i backend/migrations/20260202_fix_refresh_services_search_optimized_function.sql

-- Migration: 20260206_fix_all_critical_errors_complete.sql
\i backend/migrations/20260206_fix_all_critical_errors_complete.sql

-- Migration: 20260206_launch_phase_free_products.sql
\i backend/migrations/20260206_launch_phase_free_products.sql

-- Migration: 20260207_create_delivery_requests_and_courier_profiles.sql
\i backend/migrations/20260207_create_delivery_requests_and_courier_profiles.sql

-- Migration: 20260207_create_missing_delivery_tables.sql
\i backend/migrations/20260207_create_missing_delivery_tables.sql

-- Migration: 20260207_fix_all_missing_tables_and_functions.sql
\i backend/migrations/20260207_fix_all_missing_tables_and_functions.sql

-- Migration: 20260208_create_navigation_saved_destinations.sql
\i backend/migrations/20260208_create_navigation_saved_destinations.sql

-- Migration: 20260208_create_navigation_trips_table.sql
\i backend/migrations/20260208_create_navigation_trips_table.sql

-- Migration: 20260210_fix_courier_applications_partner_id.sql
\i backend/migrations/20260210_fix_courier_applications_partner_id.sql

-- Migration: 20260214_create_gpu_scale_actions_table.sql
\i backend/migrations/20260214_create_gpu_scale_actions_table.sql

