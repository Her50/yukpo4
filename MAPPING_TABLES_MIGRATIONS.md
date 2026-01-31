# 📋 Mapping Tables → Migrations

**Date** : 2026-01-31

Ce document liste toutes les tables de l'application et leur fichier de migration correspondant pour une maintenance optimale.

## 📊 Tables de Base

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `users` | `00000002_create_base_tables.sql` | 37-60 |
| `user_documents` | `00000002_create_base_tables.sql` | 63-108 |
| `services` | `00000002_create_base_tables.sql` | 112-130 |
| `media` | `00000002_create_base_tables.sql` | 131-198 |
| `google_places_data` | `00000002_create_base_tables.sql` | 199-253 |

## 💰 Tables de Paiement

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `payment_transactions` | `00000004_create_payment_tables.sql` | 283-297 |
| `token_transactions` | `00000004_create_payment_tables.sql` | 298-319 |

## 🔍 Tables Autocomplete

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `autocomplete_characteristics` | `00000005_create_autocomplete_tables.sql` | 320-403 |
| `autocomplete_combinations` | `00000005_create_autocomplete_tables.sql` | 404-476 |

## 📦 Tables Produits

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `service_products` | `00000006_create_product_tables.sql` | 477-550 |
| `products_lifecycle` | `00000006_create_product_tables.sql` | 551-590 |
| `product_creation_queue` | `00000028_create_optimized_functions_and_cache.sql` | 5404-5449 |

## ⭐ Tables Avis

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `service_reviews` | `00000007_create_review_tables.sql` | 591-621 |
| `product_reactions` | `00000007_create_review_tables.sql` | 622-664 |
| `product_comments` | `00000007_create_review_tables.sql` | 665-697 |
| `product_comment_reactions` | `00000007_create_review_tables.sql` | 698-719 |

## 🚚 Tables Livraison

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `parcel_types` | `00000008_create_delivery_tables.sql` | 2359-2376 |
| `courier_applications` | `00000008_create_delivery_tables.sql` | 2377-2393 |
| `couriers` | `00000008_create_delivery_tables.sql` | 2394-2407 |
| `courier_assets` | `00000008_create_delivery_tables.sql` | 2408-2426 |
| `delivery_parcels` | `00000008_create_delivery_tables.sql` | 2427-2438 |
| `deliveries` | `00000008_create_delivery_tables.sql` | 2439-2485 |
| `delivery_status_events` | `00000008_create_delivery_tables.sql` | 2486-2497 |
| `delivery_pricing` | `00000008_create_delivery_tables.sql` | 2498-2528 |
| `delivery_tracking_points` | `00000008_create_delivery_tables.sql` | 2529-2544 |
| `delivery_recipient_updates` | `00000008_create_delivery_tables.sql` | 2545-2556 |
| `courier_ratings` | `00000008_create_delivery_tables.sql` | 2557-2569 |
| `client_ratings` | `00000008_create_delivery_tables.sql` | 2570-2582 |
| `traffic_snapshots` | `00000033_create_missing_delivery_tables.sql` | - |
| `terrain_segments` | `00000033_create_missing_delivery_tables.sql` | - |
| `shopping_orders` | `00000008_create_delivery_tables.sql` | 2606-2623 |
| `shopping_order_items` | `00000008_create_delivery_tables.sql` | 2624-2642 |
| `delivery_wallet_events` | `00000008_create_delivery_tables.sql` | 2643-2678 |
| `delivery_zones` | `00000008_create_delivery_tables.sql` | 2679-2694 |
| `courier_zone_assignments` | `00000008_create_delivery_tables.sql` | 2695-2710 |
| `courier_availability_snapshots` | `00000008_create_delivery_tables.sql` | 2711-2753 |
| `delivery_matching_queue` | `00000008_create_delivery_tables.sql` | 2754-2777 |
| `delivery_matching_events` | `00000008_create_delivery_tables.sql` | 2778-2797 |
| `product_delivery_config` | `00000033_create_missing_delivery_tables.sql` | - |
| `client_delivery_preferences` | `00000033_create_missing_delivery_tables.sql` | - |
| `external_delivery_providers` | `00000033_create_missing_delivery_tables.sql` | - |
| `public_tracking_tokens` | `00000033_create_missing_delivery_tables.sql` | - |
| `delivery_payment_reservations` | `00000033_create_missing_delivery_tables.sql` | - |
| `delivery_chat_messages` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | - |
| `delivery_gamification_stats` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | - |
| `delivery_badges` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | - |
| `delivery_points_history` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | - |
| `delivery_product_suggestions` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | - |

## 🏥 Tables Services Spécialisés

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `pharmacies` | `00000009_create_specialized_services_tables.sql` | 3024-3057 |
| `hopitaux_cliniques` | `00000009_create_specialized_services_tables.sql` | 3058-3092 |
| `laboratoires_imagerie` | `00000009_create_specialized_services_tables.sql` | 3093-3127 |
| `agences_voyage` | `00000009_create_specialized_services_tables.sql` | 3128-3162 |
| `covoiturages` | `00000009_create_specialized_services_tables.sql` | 3163-3198 |
| `taxis_ville` | `00000009_create_specialized_services_tables.sql` | 3199-3266 |
| `banques_sang` | `00000009_create_specialized_services_tables.sql` | 3267-3340 |

## 🩸 Tables Banques de Sang

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `user_blood_groups` | `00000029_create_blood_donation_and_specialized_tables.sql` | 4242-4257 |
| `blood_donation_requests` | `00000029_create_blood_donation_and_specialized_tables.sql` | 4260-4289 |
| `blood_donation_matches` | `00000029_create_blood_donation_and_specialized_tables.sql` | 4292-4317 |

## 📢 Tables Communication

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `private_conversations` | `00000012_create_communication_tables.sql` | 757-795 |
| `user_push_tokens` | `00000012_create_communication_tables.sql` | 1052-1071 |
| `notifications` | `00000012_create_communication_tables.sql` | 1084-1141 |

## 📺 Tables Publicité

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `publicites` | `00000013_create_advertising_tables.sql` | 820-868 |
| `publicite_versions` | `00000013_create_advertising_tables.sql` | 869-892 |
| `publicite_impressions` | `00000013_create_advertising_tables.sql` | 1339-1398 |
| `pixel_events` | `00000013_create_advertising_tables.sql` | 1399-1422 |
| `publicite_audiences` | `00000013_create_advertising_tables.sql` | 1423-1457 |
| `automated_reports` | `00000022_create_remaining_tables_and_functions.sql` | 1458-1497 |

## 🎥 Tables Live Streaming

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `live_sessions` | `00000014_create_live_streaming_tables.sql` | 1748-1781 |
| `live_replays` | `00000014_create_live_streaming_tables.sql` | 1782-1795 |
| `live_session_analytics` | `00000014_create_live_streaming_tables.sql` | 1796-1809 |

## ⚡ Tables Flash Sales

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `live_flash_sales` | `00000015_create_flash_sales_tables.sql` | 1810-1846 |
| `live_flash_sale_reservations` | `00000015_create_flash_sales_tables.sql` | 1847-1860 |
| `live_flash_sale_commentaries` | `00000015_create_flash_sales_tables.sql` | 1861-1872 |

## 🎁 Tables Promotions

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `global_promo_events` | `00000016_create_promotion_tables.sql` | 1873-1900 |
| `global_promo_entries` | `00000016_create_promotion_tables.sql` | 1901-1935 |
| `global_promo_products` | `00000016_create_promotion_tables.sql` | 1936-1951 |

## 📱 Tables Social Media

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `social_accounts` | `00000017_create_social_media_tables.sql` | 1959-1973 |
| `social_publications` | `00000017_create_social_media_tables.sql` | 1974-1986 |
| `social_publication_jobs` | `00000017_create_social_media_tables.sql` | 1987-2005 |

## 📊 Tables Engagement Média

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `media_engagement` | `00000018_create_media_engagement_tables.sql` | 2006-2021 |
| `media_distribution` | `00000018_create_media_engagement_tables.sql` | 2022-2035 |
| `content_engagement` | `00000018_create_media_engagement_tables.sql` | 2036-2048 |

## 🎬 Tables Vidéo/Audio

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `video_generation_jobs` | `00000019_create_video_audio_tables.sql` | 2063-2083 |
| `premium_audio_jobs` | `00000019_create_video_audio_tables.sql` | 2084-2103 |
| `voice_profiles` | `00000019_create_video_audio_tables.sql` | 2144-2160 |
| `videos` | `00000023_create_videos_tables.sql` | 4655-4680 |

## 🎨 Tables Studio

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `studio_sessions` | `00000020_create_studio_tables.sql` | 2175-2195 |
| `studio_timeline_clips` | `00000020_create_studio_tables.sql` | 2196-2208 |
| `studio_dynamic_assets` | `00000020_create_studio_tables.sql` | 2209-2221 |
| `effects` | `00000025_create_effects_and_templates_tables.sql` | 4912-4946 |
| `video_templates` | `00000025_create_effects_and_templates_tables.sql` | 4948-4990 |

## 💬 Tables Réactions et Chat

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `message_reactions` | `00000024_create_message_reactions_and_delivery_chat_tables.sql` | 4779-4816 |

## 🔌 Tables Plugin Marketplace

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `plugin_marketplace` | `00000026_create_plugin_marketplace_tables.sql` | 5019-5042 |
| `plugin_dependencies` | `00000026_create_plugin_marketplace_tables.sql` | 5063-5070 |
| `plugin_permissions` | `00000026_create_plugin_marketplace_tables.sql` | 5075-5082 |
| `plugin_reviews` | `00000026_create_plugin_marketplace_tables.sql` | 5086-5099 |

## 🍽️ Tables Planification Menus

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `family_profiles` | `00000027_create_menu_planning_tables.sql` | 5131-5148 |
| `recipes` | `00000027_create_menu_planning_tables.sql` | 5151-5172 |
| `menu_plans` | `00000027_create_menu_planning_tables.sql` | 5175-5187 |
| `planned_meals` | `00000027_create_menu_planning_tables.sql` | 5190-5200 |
| `recipe_favorites` | `00000027_create_menu_planning_tables.sql` | 5203-5209 |
| `shopping_lists` | `00000027_create_menu_planning_tables.sql` | 5212-5223 |
| `shopping_list_items` | `00000027_create_menu_planning_tables.sql` | 5226-5241 |
| `nutrition_analytics` | `00000027_create_menu_planning_tables.sql` | 5244-5257 |

## 🚌 Tables Bus

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `bus_ticket_payments` | `00000031_create_bus_tables.sql` | 3634-3669 |
| `bus_reservations` | `00000031_create_bus_tables.sql` | 3795-3821 |
| `bus_boarding_status` | `00000031_create_bus_tables.sql` | 3828-3849 |
| `bus_seat_blocks` | `00000031_create_bus_tables.sql` | 4082-4094 |
| `agency_departure_schedules` | `00000029_create_blood_donation_and_specialized_tables.sql` | 4618-4635 |

## 🗄️ Tables Utilitaires

| Table | Fichier Migration | Lignes |
|-------|-------------------|--------|
| `consultation_historique` | `00000003_create_utility_tables.sql` | 255-262 |
| `token_packs` | `00000003_create_utility_tables.sql` | 263-271 |
| `service_logs` | `00000003_create_utility_tables.sql` | 272-282 |
| `cache_table` | `00000028_create_optimized_functions_and_cache.sql` | 5453-5461 |
| `video_weekly_reports` | `00000033_create_missing_delivery_tables.sql` | - |
| `service_inventory_overrides` | `00000033_create_missing_delivery_tables.sql` | - |

## 📝 Notes

- Les numéros de lignes référencent le fichier original `0000_create_all_tables.sql`
- Les tables marquées "-" sont nouvelles ou n'ont pas de correspondance exacte dans le fichier original
- Toutes les tables sont maintenant dans des fichiers isolés pour une maintenance optimale

