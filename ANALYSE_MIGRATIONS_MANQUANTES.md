# 📊 Analyse des Migrations Manquantes dans auto_migrate

**Date**: 2025-11-27  
**Objectif**: Identifier toutes les migrations SQL qui ne sont pas incluses dans `auto_migrate.rs`

---

## 🔍 Méthodologie

1. Lister toutes les migrations SQL dans `backend/migrations/`
2. Vérifier si chaque migration est référencée dans `auto_migrate.rs`
3. Identifier les tables créées par ces migrations
4. Proposer des solutions

---

## ✅ Migrations Déjà dans auto_migrate

Les migrations suivantes sont **déjà incluses** dans `auto_migrate.rs` :

### Migrations Récentes (2025-11-27)
- ✅ `20251127_create_token_consumption_and_purchase_history.sql` → `ensure_token_consumption_and_purchase_history_tables`
- ✅ `20251127_create_banques_sang_table.sql` → `ensure_banques_sang_table`
- ✅ `20251127_integrate_bus_tickets_with_agences_voyage.sql` → `ensure_bus_tickets_integration`
- ✅ `20251127_add_commission_to_bus_payments.sql` → `ensure_bus_ticket_commission_system`
- ✅ `20251127_bus_ticket_validation_system.sql` → `ensure_bus_ticket_validation_system`
- ✅ `20251127_bus_manual_seat_blocks.sql` → `ensure_bus_seat_blocks_system`

### Autres Migrations Incluses
- ✅ `20251126_create_specialized_services_tables.sql` → `ensure_specialized_services_tables`
- ✅ `20251125090540_create_google_places_data_table.sql` → `ensure_google_places_data_table`
- ✅ `20251110010_create_media_analytics.sql` → `ensure_media_analytics_tables`
- ✅ `20251109001_001_create_content_engagement.sql` → `ensure_content_engagement_table`
- ✅ `20251109002_002_create_live_streaming.sql` → `ensure_live_streaming_tables`
- ✅ `20251111001_002_create_live_flash_sales.sql` → `ensure_live_flash_sales_tables`
- ✅ `20251111002_create_social_connectors.sql` → `ensure_social_connectors_tables`
- ✅ `20251111003_create_delivery_wallet_events.sql` → `ensure_delivery_wallet_events_table`
- ✅ `20251111004_create_video_weekly_reports.sql` → `ensure_video_weekly_reports_table`
- ✅ `20251113_001_create_premium_audio_jobs.sql` → `ensure_premium_audio_tables`
- ✅ `20251114001_create_voice_profiles.sql` → `ensure_voice_profiles_table`
- ✅ `20251114002_create_studio_sessions.sql` → `ensure_studio_tables`
- ✅ `20251115001_create_delivery_matching_tables.sql` → (dans `ensure_delivery_tables`)
- ✅ `20251115002_create_global_promo_platform.sql` → `ensure_global_promo_tables`
- ✅ `20251116001_create_studio_preview_events.sql` → (dans `ensure_studio_tables`)
- ✅ `20251116002_create_service_inventory_overrides.sql` → `ensure_inventory_overrides_table`
- ✅ `20250127000001_create_product_delivery_config.sql` → `ensure_product_delivery_config_table`
- ✅ `20250127000002_create_client_delivery_preferences.sql` → `ensure_client_delivery_preferences_table`
- ✅ `20250127000003_create_external_delivery_providers.sql` → `ensure_external_delivery_providers_table`
- ✅ `20250127000005_create_delivery_payment_reservations.sql` → `ensure_delivery_payment_reservations_table`
- ✅ `20250120_001_add_order_preparation_system.sql` → `ensure_order_preparation_system`
- ✅ `20250120_002_add_product_stock_management.sql` → `ensure_product_stock_management`
- ✅ `20251102000000_create_autocomplete_combinations.sql` → `ensure_autocomplete_combinations_table`
- ✅ `20251101004_create_autocomplete_characteristics.sql` → `ensure_autocomplete_characteristics_table`
- ✅ `20251101002_002_create_token_usage_logs.sql` → `ensure_token_usage_logs_table`
- ✅ `20251108_001_create_product_comments.sql` → `ensure_product_comments_tables`
- ✅ `20251104003_004_add_product_reactions.sql` → `ensure_product_reactions_table`
- ✅ `20251021004_create_publicites_table.sql` → `ensure_publicites_table`
- ✅ `20251017001_create_notifications_table.sql` → `ensure_notifications_table`
- ✅ `20251031001_002_create_search_history.sql` → `ensure_search_history_table`
- ✅ `20250601_create_alerts.sql` → `ensure_alerts_table`
- ✅ `20251020004_add_signalement_system.sql` → `ensure_signalements_tables`
- ✅ `20251104004_005_add_private_conversations.sql` → `ensure_private_conversations_table`
- ✅ `20250125_create_bus_reservations.sql` → `ensure_bus_reservations_table`

---

## ❌ Migrations MANQUANTES dans auto_migrate

### 1. Tables de Base (Créées dans 0000_create_all_tables.sql)

**Note**: Ces tables sont créées dans la migration initiale `0000_create_all_tables.sql` qui est probablement appliquée manuellement ou via SQLx. Elles ne nécessitent pas forcément d'être dans `auto_migrate` car elles sont dans la migration de base.

**Tables**:
- `users`
- `services`
- `media`
- `consultation_historique`
- `token_packs`
- `service_logs`
- `alerts` (déjà dans auto_migrate via `ensure_alerts_table`)

**Recommandation**: ✅ OK - Ces tables sont dans la migration de base

---

### 2. Table `products` (20250124_create_products_table.sql)

**Fichier**: `backend/migrations/20250124_create_products_table.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `products`

**Impact**: Table importante pour la gestion des produits

**Solution**: Ajouter `ensure_products_table` dans `auto_migrate.rs`

---

### 3. Table `programmes_scolaires` (20250614_create_programmes_scolaires.sql)

**Fichier**: `backend/migrations/20250614_create_programmes_scolaires.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `programmes_scolaires`

**Impact**: Table pour les programmes scolaires (fonctionnalité éducation)

**Solution**: Ajouter `ensure_programmes_scolaires_table` dans `auto_migrate.rs`

---

### 4. Table `echanges` (20250701094746_create_echanges_table.sql)

**Fichier**: `backend/migrations/20250701094746_create_echanges_table.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `echanges`

**Impact**: Table importante pour le système d'échanges

**Solution**: Ajouter `ensure_echanges_table` dans `auto_migrate.rs`

---

### 5. Table `image_analyses` (20251026_create_image_analyses_table.sql)

**Fichier**: `backend/migrations/20251026_create_image_analyses_table.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `image_analyses`

**Impact**: Table pour l'analyse IA des images

**Solution**: Ajouter `ensure_image_analyses_table` dans `auto_migrate.rs`

---

### 6. Tables de Modèles (20251025_*.sql)

**Fichiers**:
- `20251025001_create_appliance_models.sql` → Table `appliance_models`
- `20251025002_create_health_structures.sql` → Table `health_structures`
- `20251025003_create_phone_models.sql` → Table `phone_models`
- `20251025004_create_vehicle_models.sql` → Table `vehicle_models`

**Statut**: ❌ **MANQUANTES** dans `auto_migrate.rs`

**Impact**: Tables de référence pour les modèles de produits

**Solution**: Ajouter des fonctions `ensure_*_models_table` dans `auto_migrate.rs`

---

### 7. Table `chat` et `messages` (20251018_create_chat_tables.sql)

**Fichier**: `backend/migrations/20251018_create_chat_tables.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Tables créées**: `conversations`, `messages`

**Impact**: Tables importantes pour le système de chat

**Note**: Il y a `ensure_chat_mentions_and_participants` mais pas pour les tables de base du chat

**Solution**: Ajouter `ensure_chat_tables` dans `auto_migrate.rs`

---

### 8. Table `push_tokens` (20250126002_user_push_tokens.sql)

**Fichier**: `backend/migrations/20250126002_user_push_tokens.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `push_tokens`

**Impact**: Table pour les tokens de notifications push

**Note**: Il y a `ensure_notifications_table` mais pas `ensure_push_tokens_table`

**Solution**: Ajouter `ensure_push_tokens_table` dans `auto_migrate.rs`

---

### 9. Table `visibility_tracking` (20251022002_002_create_visibility_tracking.sql)

**Fichier**: `backend/migrations/20251022002_002_create_visibility_tracking.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `visibility_tracking`

**Impact**: Table pour le suivi de visibilité des services

**Solution**: Ajouter `ensure_visibility_tracking_table` dans `auto_migrate.rs`

---

### 10. Table `service_team_management` (20251020005_create_service_team_management.sql)

**Fichier**: `backend/migrations/20251020005_create_service_team_management.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `service_team_management`

**Impact**: Table pour la gestion d'équipe de service

**Solution**: Ajouter `ensure_service_team_management_table` dans `auto_migrate.rs`

---

### 11. Tables de Livraison (20251110_*.sql)

**Fichiers**:
- `20251110002_101_create_parcel_types.sql` → Table `parcel_types`
- `20251110003_102_create_courier_applications.sql` → Table `courier_applications`
- `20251110004_103_create_couriers_and_assets.sql` → Tables `couriers`, `courier_assets`
- `20251110005_104_create_delivery_core.sql` → Tables `delivery_requests`, `delivery_offers`, etc.
- `20251110006_105_create_pricing_tracking_ratings.sql` → Tables de pricing
- `20251110007_106_create_support_tables.sql` → Tables de support
- `20251110008_107_create_shopping_orders.sql` → Table `shopping_orders`
- `20251110009_108_add_delivery_recipient_fields.sql` → Modifications de colonnes

**Statut**: ⚠️ **PARTIELLEMENT INCLUSES** dans `ensure_delivery_tables`

**Note**: Il y a `ensure_delivery_tables` qui pourrait inclure certaines de ces tables, mais il faut vérifier

**Solution**: Vérifier que toutes ces tables sont incluses dans `ensure_delivery_tables`

---

### 12. Table `bus_return_trips` (20250126001_bus_return_trips_system.sql)

**Fichier**: `backend/migrations/20250126001_bus_return_trips_system.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Table créée**: `bus_return_trips`

**Impact**: Table pour les trajets retour de bus

**Solution**: Ajouter `ensure_bus_return_trips_table` dans `auto_migrate.rs`

---

### 13. Tables de Paiement (20241201_*.sql, 20250926_*.sql)

**Fichiers**:
- `20241201_create_payment_tables.sql`
- `20250926001_001_create_payment_tables_final.sql`
- `20250926002_002_create_payment_tables_production.sql`
- `20250926100000_create_payment_tables_sqlx.sql`
- `20241225001_001_create_payment_attempts_table.sql`

**Statut**: ⚠️ **À VÉRIFIER** - Certaines tables de paiement pourraient être manquantes

**Solution**: Vérifier quelles tables de paiement sont créées et si elles sont dans `auto_migrate`

---

### 14. Tables Manquantes (20250701053842_create_missing_tables.sql)

**Fichier**: `backend/migrations/20250701053842_create_missing_tables.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Note**: Ce fichier crée probablement plusieurs tables manquantes

**Solution**: Analyser le fichier et ajouter les tables nécessaires

---

### 15. Tables Manquantes (20250701053847_add_missing_columns_and_tables.sql)

**Fichier**: `backend/migrations/20250701053847_add_missing_columns_and_tables.sql`

**Statut**: ❌ **MANQUANTE** dans `auto_migrate.rs`

**Note**: Ce fichier ajoute des colonnes et tables manquantes

**Solution**: Analyser le fichier et ajouter les modifications nécessaires

---

## 📋 Résumé des Tables Manquantes

### Priorité 1 (Critiques)
1. ❌ `products` - Table principale des produits
2. ❌ `echanges` - Table principale des échanges
3. ❌ `conversations`, `messages` - Tables de base du chat
4. ❌ `push_tokens` - Tokens de notifications push

### Priorité 2 (Importantes)
5. ❌ `programmes_scolaires` - Programmes scolaires
6. ❌ `image_analyses` - Analyses IA d'images
7. ❌ `appliance_models` - Modèles d'électroménager
8. ❌ `health_structures` - Structures de santé
9. ❌ `phone_models` - Modèles de téléphones
10. ❌ `vehicle_models` - Modèles de véhicules
11. ❌ `visibility_tracking` - Suivi de visibilité
12. ❌ `service_team_management` - Gestion d'équipe
13. ❌ `bus_return_trips` - Trajets retour bus

### Priorité 3 (À Vérifier)
14. ⚠️ Tables de livraison (vérifier dans `ensure_delivery_tables`)
15. ⚠️ Tables de paiement (vérifier quelles sont incluses)
16. ⚠️ Tables dans `20250701053842_create_missing_tables.sql`
17. ⚠️ Tables dans `20250701053847_add_missing_columns_and_tables.sql`

---

## 🔧 Plan d'Action

### Étape 1: Analyser les fichiers de migration manquants
- Lire chaque fichier de migration manquant
- Identifier les tables créées
- Vérifier si elles sont vraiment nécessaires

### Étape 2: Créer les fonctions `ensure_*` manquantes
- Créer une fonction pour chaque table manquante
- Utiliser `execute_multiple_sql_commands` pour exécuter les migrations SQL

### Étape 3: Ajouter les appels dans `run_auto_migrations`
- Ajouter les appels aux nouvelles fonctions dans l'ordre logique
- Grouper par fonctionnalité si possible

### Étape 4: Tester
- Vérifier que toutes les tables sont créées au démarrage
- Vérifier qu'il n'y a pas d'erreurs de migration

---

## 📝 Notes

1. **Migration 0000_create_all_tables.sql**: Cette migration est probablement appliquée manuellement ou via SQLx. Elle ne doit pas nécessairement être dans `auto_migrate`.

2. **Migrations de colonnes**: Certaines migrations ajoutent seulement des colonnes. Elles peuvent être incluses dans les fonctions `ensure_*` existantes.

3. **Migrations de fonctions**: Certaines migrations créent seulement des fonctions PostgreSQL. Elles peuvent être incluses dans les fonctions `ensure_*` existantes.

---

**Document généré le**: 2025-11-27  
**Dernière mise à jour**: 2025-11-27
