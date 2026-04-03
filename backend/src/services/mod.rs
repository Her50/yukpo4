pub mod advanced_analytics_service; // ✅ NOUVEAU: Service analytics avancés (heatmaps, A/B testing, cohort)
pub mod african_locations_service; // ✅ NOUVEAU 2025-11-06: Base locale africaine pour enfants géographiques
pub mod ai_image_generation_service; // ✅ NOUVEAU 2025-11-25: Génération d'images par IA (DALL-E)
pub mod alert_service;
pub mod analytics_service; // ✅ Phase 10 - Service d'analytics pour prestataires
pub mod app_ia;
pub mod assistance;
pub mod assurance_ai_service; // ✅ NOUVEAU: Service IA assurance (devis, comparaison, recommandations)
pub mod async_upload_service; // ✅ NOUVEAU 2025-01-27 : Service d'upload asynchrone
pub mod audio_analysis_service;
pub mod audio_extraction_service;
pub mod audio_library_service;
pub mod audio_mastering_service;
pub mod audio_pipeline;
pub mod audio_suggestion_service; // ✅ NOUVEAU: Service de suggestions audio contextuelles
pub mod audio_sync_service; // ✅ NOUVEAU Phase 10: Service de synchronisation audio-vidéo avec IA
pub mod audio_transcription_service;
pub mod autocomplete_client_service; // ✅ NOUVEAU 2025-11-04: Suggestions CLIENT (autocomplete_characteristics)
pub mod autocomplete_combinations_service;
pub mod autocomplete_history_service;
pub mod autocomplete_search_service; // ✅ NOUVEAU 2025-11-04: Recherche par vecteur autocomplete
pub mod background_combination_generator;
pub mod besoin_service;
pub mod blood_bank_ai_service; // ✅ 2025-01-27: Service IA banques de sang (prédictions, optimisation)
pub mod blood_compatibility_service; // ✅ NOUVEAU: Service compatibilité groupes sanguins
pub mod blood_stock_monitor; // ✅ NOUVEAU: Service monitoring automatique stocks banque de sang
pub mod book_exchange_ai_service; // ✅ NOUVEAU: Service IA bourse du livre
pub mod broll_service;
pub mod cache_service; // ✅ Phase 10 - Service de cache générique centralisé
pub mod captions_service; // ✅ NOUVEAU: Service de génération automatique de sous-titres
pub mod chat_support_ai;
pub mod color_grading_service; // ✅ NOUVEAU: Service de color grading automatique
pub mod commerce_connector_service;
pub mod conflict_resolution;
pub mod content_engagement_service;
pub mod context_enricher;
pub mod cost_service;
pub mod courier_verification_service; // ✅ NOUVEAU : Vérification identité coursier
pub mod creer_service;
pub mod db_optimizer;
pub mod delivery_ai_eta_service; // ✅ NOUVEAU: AI ETA Prediction avec AppIA
pub mod delivery_ai_forecasting_service; // ✅ NOUVEAU: AI Demand Forecasting avec AppIA
pub mod delivery_ai_prompts; // ✅ NOUVEAU: Prompts spécialisés pour IA livraison
pub mod delivery_ai_recommendations; // ✅ NOUVEAU: AI Product Recommendations
pub mod delivery_demand_forecasting; // ✅ NOUVEAU: Demand Forecasting ML
pub mod delivery_engine_pricing_service; // ✅ NOUVEAU: Service de calcul coût selon type d'engin
pub mod delivery_fraud_detection; // ✅ NOUVEAU: Fraud Detection System
pub mod delivery_insurance_service; // ✅ NOUVEAU: Service calcul frais d'assurance
pub mod delivery_ml_eta; // ✅ NOUVEAU: ML pour prédiction ETA précise
pub mod delivery_ml_models; // ✅ NOUVEAU: Infrastructure ML TensorFlow/PyTorch
pub mod delivery_notification_service; // ✅ RECOMMANDATION 3: Notifications SMS/Email pour clients sans app
pub mod delivery_payment_service; // ✅ Phase 5 - Améliorations 10-15: Gestion financière avancée
pub mod delivery_pricing_metrics; // ✅ NOUVEAU: Métriques pour calcul des coûts de livraison
pub mod delivery_prometheus_metrics; // ✅ Phase 3: Métriques Prometheus pour optimisations
pub mod delivery_repository;
pub mod delivery_schedule_service; // ✅ Phase 3 - Amélioration 7: Gestion contraintes horaires
pub mod delivery_service;
pub mod delivery_state_sharing; // ✅ Phase 3: Partage d'état Redis pour scaling horizontal
pub mod delivery_traffic_service; // ✅ NOUVEAU: Service trafic avec API réelle
pub mod delivery_vrp_solver; // ✅ NOUVEAU: VRP Solver pour optimisation routes multi-livraisons
pub mod delivery_weather_service; // ✅ NOUVEAU: Service météo avec API réelle
pub mod distribution_automation_service;
pub mod dynamic_preparation_time_service; // ✅ NOUVEAU : Calcul dynamique durée préparation par catégorie
pub mod effect_preview_service; // ✅ NOUVEAU: Service de génération de previews d'effets
pub mod email_service; // ✅ Phase 10 - Service Email avec SendGrid
pub mod embedding_client;
pub mod embedding_service;
pub mod embedding_tracker;
pub mod emploi_ai_service; // ✅ NOUVEAU: Service IA emploi
pub mod enrich_google_places; // ✅ NOUVEAU: Enrichissement services avec données Google Places complètes
pub mod exchange_rate_service; // ✅ 2026-03-18: Taux de change live via ExchangeRate-API (gratuit, cache 24h)
pub mod exhaustive_combination_generator;
pub mod facebook_publisher_service; // ✅ 2026-04-03: Publication réelle sur Facebook Page + sync catalogue Commerce Manager
pub mod file_extractor;
pub mod flash_sale_cache; // ✅ NOUVEAU: Cache Redis pour Flash Sales
pub mod flash_sale_queue; // ✅ NOUVEAU: Queue de réservations avec Redis Streams
pub mod flutterwave_service; // ✅ 2026-03-17: Flutterwave (pan-africain 30+ pays, M-Pesa, Airtel, Vodafone...)
pub mod fournitures_service;
pub mod geocoding_service;
pub mod geographic_matching_service; // ✅ Phase 10 - Service de matching géographique optimisé
pub mod geonames_service; // ✅ NOUVEAU: Service GeoNames pour hiérarchie géographique
pub mod global_cache_service; // ✅ NOUVEAU 2025-12-01: Cache global pour toutes les fonctionnalités
pub mod global_metrics_service; // ✅ NOUVEAU 2025-12-01: Métriques globales pour toutes les fonctionnalités
pub mod global_promo_cache; // ✅ NOUVEAU: Cache Redis pour Black Friday / Global Promo
pub mod global_promo_service;
pub mod google_places_service; // ✅ NOUVEAU 2025-11-06: Service Google Places pour hiérarchie bidirectionnelle
pub mod gps_matching;
pub mod gpu_detector;
pub mod gpu_optimizer;
pub mod gpu_render_service; // ✅ NOUVEAU Phase 7: Service de rendu GPU optimisé
pub mod gpu_service; // ✅ NOUVEAU: Service de gestion GPU automatisé GCP avec scaling
pub mod hls_dash_service; // ✅ NOUVEAU: Service HLS/DASH pour qualité adaptative serveur
pub mod hospital_ai_service; // ✅ 2025-01-27: Service IA hôpitaux (recommandations, triage)
pub mod hotel_financial_service; // ✅ 2026-03-17: Service financier pour partenaires hôtel/meublé
pub mod hotel_room_management_service; // ✅ 2026-01-27: Service gestion chambres/unités hôtels et meublés
pub mod hybrid_image_search_service; // ✅ NOUVEAU: Recherche hybride intelligente
pub mod ia;
pub mod ia_feedback_service;
pub mod ia_history_service;
pub mod image_compression_service; // ✅ NOUVEAU 2025-01-27 : Service de compression d'images
pub mod image_search_service;
pub mod immersive_orchestrator;
pub mod immersive_timeline;
pub mod instagram_publisher_service; // ✅ 2026-04-03: Publication réelle sur Instagram Business (3-step API)
pub mod instructions;
pub mod intelligent_image_analysis_service;
pub mod intelligent_service_manager;
pub mod intelligent_translation_service;
pub mod interaction_service;
pub mod interior_design_ai_service; // ✅ Service IA décoration (suggestions, visualisation 3D)
pub mod inventory_service;
pub mod kyc_service; // ✅ NOUVEAU: Service KYC pour vérification identité
pub mod lab_ai_service; // ✅ 2025-01-27: Service IA laboratoires (interprétation, anomalies)
pub mod land_analysis_ai_service; // ✅ Service IA terrains (analyse viabilité, estimation prix)
pub mod launch_phase_service; // ✅ NOUVEAU 2026-02-06: Service gestion phase de lancement (3 mois gratuits)
pub mod librairie_prix_bornes_service; // ✅ 2026-03-28: Bornes prix lignes neufs commande mixte
pub mod live_ai_service;
pub mod live_audience_service;
pub mod live_flash_sale_service;
pub mod live_stream_service;
pub mod livekit_vm_service; // ✅ Gestion automatique VM LiveKit selon sessions actives
pub mod livres_scolaires_service; // ✅ NOUVEAU 2025-01-28: Service livres scolaires
pub mod llm_service;
pub mod local_ai_ultra_fast;
pub mod massive_load_handler;
pub mod matching_pipeline;
pub mod media_storage_service;
pub mod menu_planning_ai_prompts; // ✅ NOUVEAU: Prompts spécialisés pour IA planification menus
pub mod menu_planning_ai_service; // ✅ 2025-01-27: Service IA planification menus
pub mod meta_token_service; // ✅ 2026-04-03: Validation + refresh automatique tokens Meta (FB/IG)
pub mod mobile_money_service; // ✅ Phase 10 - Service Mobile Money (MTN/Orange Money)
pub mod mongo_history_service;
pub mod moving_ai_service; // ✅ Service IA déménagement (calcul volume, estimation coût, optimisation)
pub mod multimodal_enricher;
pub mod multimodal_optimizer;
pub mod multimodal_processor;
pub mod native_search_service;
pub mod negotiated_price_service; // ✅ NOUVEAU : Service pour gérer les prix négociés entre prestataire et client
pub mod notification_queue; // ✅ Service de queue de notifications
pub mod notification_service; // ✅ Service de notifications en base de données
pub mod ocr_engine;
pub mod optimistic_update_service; // ✅ NOUVEAU Phase 10: Service pour mises à jour optimistes avec mécanisme d'annulation
pub mod optimized_media_processor; // ✅ NOUVEAU 2025-01-27: Service optimisé de traitement batch des médias
pub mod orchestration_ia;
pub mod orchestration_ia_optimized;
pub mod order_preparation_service; // ✅ NOUVEAU : Workflow de préparation des commandes
pub mod payment_aggregator; // ✅ Agrégateur de paiement (CinetPay/NotchPay/Flutterwave) pour Mobile Money + Cartes
pub mod payment_matching_service; // ✅ Phase 5 - Matching intelligent modes de paiement (MTN/Orange Money)
pub mod payment_service;
pub mod paypal_payment_service; // ✅ 2026-03-17: Service PayPal Orders API v2 (paiements internationaux)
pub mod pharmacy_ai_service; // ✅ 2025-01-27: Service IA pharmacies (interactions, conseils)
pub mod pharmacy_product_service; // ✅ NOUVEAU: Service produits de pharmacie
pub mod phone_validation_service;
pub mod pipeline_health_service;
pub mod plugin_service; // ✅ NOUVEAU Phase 2: Service de gestion des plugins
pub mod popular_products_service;
pub mod prestataire_service;
pub mod preview_cache_service; // ✅ NOUVEAU 2026-01-04: Cache pour previews // ✅ NOUVEAU: Service de génération de preview rapide
pub mod preview_generation_service;
pub mod preview_monitoring;
pub mod product_availability_service; // ✅ NOUVEAU : Vérification disponibilité produits
pub mod product_creation_queue; // ✅ NOUVEAU 2026-01-02: Queue asynchrone pour création de produits
pub mod product_distribution_worker; // ✅ 2026-04-03: Worker traitement jobs distribution (FB, IG, WA)
pub mod product_enrichment_service; // ✅ NOUVEAU : Enrichissement produits avec disponibilité
pub mod product_feed_service; // ✅ 2026-04-03: Flux Google Shopping XML + CSV export pour partenaires
pub mod product_price_service; // ✅ NOUVEAU : Service pour calculer les prix réels avec promotions
pub mod product_stock_service; // ✅ NOUVEAU : Gestion stock en temps réel
pub mod product_validation_service;
pub mod products_service; // ✅ NOUVEAU 2026-01-03: Service pour table products séparée
pub mod programme_service;
pub mod prompt_optimizer_pro;
pub mod provider_analytics_service; // ✅ NOUVEAU : Analytics prestataire
pub mod publicite_filtering_service;
pub mod publicite_frequency_service;
pub mod publicite_geographic_service;
pub mod publicite_notification_service;
pub mod publicite_optimization_service;
pub mod publicite_pixel_service;
pub mod publicite_reporting_service;
pub mod publicite_scheduler_service;
pub mod publicite_search_service;
pub mod publicite_versioning_service;
pub mod push_notification_service; // ✅ Service de push notifications Expo
pub mod query_monitor; // ✅ NOUVEAU 2025-11-28: Monitoring avancé des requêtes SQL
pub mod real_estate_ai_service; // ✅ Service IA immobilier (estimation prix, recommandations, simulation prêt)
pub mod real_estate_permissions_service; // ✅ 2026-01-27: Service permissions immobilier (propriétaire/équipe)
pub mod rechercher_besoin;
pub mod redis_scaling_service; // ✅ NOUVEAU: Service de gestion Redis Memorystore automatisé GCP avec scaling
pub mod remotion_renderer_service;
pub mod scalability_service; // ✅ NOUVEAU 2025-12-XX: Service centralisé de scalabilité pour millions d'interactions
pub mod scheduling_search_service;
pub mod scoring_service;
pub mod search_cache_service; // ✅ NOUVEAU 2025-12-01: Cache multi-niveaux pour recherches
pub mod search_history_service;
pub mod search_metrics; // ✅ NOUVEAU 2025-12-01: Métriques de recherche pour monitoring
pub mod security_service;
pub mod semantic_cache;
pub mod semantic_cache_pro;
pub mod semantic_exclusion;
pub mod service_data_cache; // ✅ NOUVEAU 2026-01-02: Cache pour données de service volumineuses
pub mod service_history_service;
pub mod service_lifecycle_manager;
pub mod sharing_service;
pub mod similar_products_service; // ✅ NOUVEAU : Recherche produits similaires
pub mod smart_notification_service; // ✅ NOUVEAU : Notifications intelligentes avec redirection
pub mod sms_service; // ✅ Phase 10 - Service SMS avec Twilio
pub mod social_connector_service;
pub mod social_distribution_service;
pub mod specialized_chat_service; // ✅ NOUVEAU: Service chat intégré
pub mod specialized_notifications;
pub mod specialized_payment_service; // ✅ NOUVEAU: Service paiement intégré
pub mod specialized_rating_service; // ✅ NOUVEAU: Service avis et ratings
pub mod specialized_reservation_service; // ✅ NOUVEAU: Service réservations
pub mod specialized_services_cache;
pub mod specialized_services_metrics; // ✅ NOUVEAU: Cache Redis pour services spécialisés
pub mod specialized_services_optimizer;
pub mod specialized_services_validation; // ✅ NOUVEAU: Validation stricte pour services spécialisés
pub mod stock_media_service; // ✅ NOUVEAU Phase 2: Service d'intégration Stock Media (Unsplash, Pexels, Pixabay)
pub mod story_template_service;
pub mod stripe_payment_service; // ✅ 2026-03-17: Service Stripe (Visa/Mastercard/Amex/Apple Pay/Google Pay)
pub mod studio_service;
pub mod timeline_converter; // ✅ NOUVEAU: Conversion timeline JSON -> ImmersiveTimeline
pub mod timeline_variant_service; // ✅ NOUVEAU: Service de génération de variantes de timeline
pub mod traiter_echange;
pub mod translation_optimizer;
pub mod troc_intelligent_service; // ✅ NOUVEAU 2025-01-28: Service troc intelligent
pub mod upload_service; // ✅ NOUVEAU: Service pour upload préalable de fichiers
pub mod valider_echange;
pub mod valider_programme_scolaire;
pub mod version_control_service; // ✅ NOUVEAU Phase 4: Service de version control
pub mod video_analysis_service; // ✅ NOUVEAU: Service d'analyse vidéo (auto-cut)
pub mod video_analytics_service;
pub mod video_generation_service;
pub mod video_job_service;
pub mod video_quality_service;
pub mod video_renderer;
pub mod voice_profile_service;
// ✅ NOUVEAU 2025-01-XX: Services de scalabilité pour millions de créations vidéo simultanées
pub mod covoiturage_insurance_service; // ✅ NOUVEAU 2025-01-29: Service assurance passagers
pub mod covoiturage_matching_service; // ✅ NOUVEAU 2025-01-29: Service matching intelligent
pub mod covoiturage_proactive_notifications; // ✅ NOUVEAU 2025-01-29: Service notifications proactives
pub mod distributed_queue_service; // ✅ NOUVEAU 2025-01-27: Queue distribuée Redis Streams
pub mod document_ai_service; // ✅ NOUVEAU 2026-04-01: Google Cloud Vision API — OCR CNI + détection visage
pub mod driver_verification_service; // ✅ NOUVEAU 2026-04-01: KYC conducteur (CNI + selfie + IA)
pub mod loyalty_service; // ✅ NOUVEAU 2026-04-01: Programme fidélité (points + récompenses)
                         // mobile_money_service déjà déclaré plus haut (ligne 127)
pub mod multi_level_cache_service; // ✅ NOUVEAU 2025-01-27: Cache multi-niveaux (L1, L2, L4)
pub mod prometheus_metrics;
pub mod qr_code_service; // ✅ NOUVEAU 2025-01-29: Service QR code réservations
pub mod recurring_trips_service; // ✅ NOUVEAU 2025-01-29: Service trajets récurrents
pub mod redis_service;
pub mod taxi_analytics_service; // ✅ NOUVEAU 2025-01-29: Service analytics dashboard (Leadership Global 100%)
pub mod taxi_demand_prediction_service; // ✅ NOUVEAU 2025-01-29: Service prédiction demande taxi/covoiturage (Leadership Global)
pub mod taxi_dynamic_pricing_service; // ✅ NOUVEAU 2025-01-29: Service prix dynamique IA (Leadership 100%)
pub mod taxi_matching_service; // ✅ NOUVEAU 2025-01-29: Service matching intelligent taxi (proximité) // ✅ Phase 1: Service Redis pour queue, cache et rate limiting
pub mod taxi_personalized_recommendations_service; // ✅ NOUVEAU 2025-01-29: Service recommandations personnalisées (Leadership Global 100%)
pub mod taxi_realtime_metrics_service; // ✅ NOUVEAU 2025-01-29: Service métriques temps réel WebSocket (Leadership 100%)
pub mod taxi_route_optimization_service; // ✅ NOUVEAU 2025-01-29: Service optimisation itinéraires IA (Leadership Global 100%)
pub mod trip_rating_service; // ✅ NOUVEAU 2026-04-01: Notations post-trajet taxi/covoiturage
pub mod trip_share_service; // ✅ NOUVEAU 2026-04-01: Partage trajet temps réel (lien public)
pub mod vehicle_category_service; // Catégorisation automatique véhicule taxi (Économique/Standard/Confort/Premium)
pub mod video_batch_processor; // ✅ Traitement par batch pour millions de jobs
pub mod video_cache_service; // ✅ Cache distribué pour optimiser les performances
pub mod video_queue_service; // ✅ Queue distribué avec priorités et retry
pub mod video_rate_limiter; // ✅ Rate limiting pour protéger contre les abus
pub mod video_scalability_service; // ✅ Service centralisé de scalabilité // ✅ Phase 4: Métriques Prometheus pour monitoring
                                   // pub mod payment_service_temporary;
                                   // pub mod push_notifications;
                                   // pub mod typing_status;
                                   // pub mod voice_messages;
                                   // pub mod file_sharing;
pub mod advanced_timeline_service; // ✅ NOUVEAU Phase 2: Service de gestion timelines multi-pistes avancées
pub mod ai_content_service; // ✅ 2026-04-03: Génération contenu IA (GPT-4o) pour posts sociaux
pub mod alertes_emploi_service; // ✅ NOUVEAU 2025-01-28: Service alertes emploi
pub mod ar_3d_render_service;
pub mod ar_preview_service; // ✅ NOUVEAU Phase 3.2: Service de rendu 3D pour preview AR
pub mod candidatures_service; // ✅ NOUVEAU 2025-01-28: Service candidatures
pub mod concours_entree_service; // ✅ NOUVEAU 2025-01-28: Service concours d'entrée
pub mod conferences_lives_service; // ✅ NOUVEAU 2025-01-28: Service conférences et lives scolaires
pub mod effect_library_service; // ✅ NOUVEAU 2025-01-27: Service de gestion bibliothèque d'effets (50+)
pub mod experiences_etudiants_service; // ✅ NOUVEAU 2025-01-28: Service expériences d'anciens étudiants
pub mod export_service; // ✅ NOUVEAU Phase 2.3: Service de gestion des jobs d'export vidéo
pub mod fournitures_scolaires_service; // ✅ NOUVEAU 2025-01-28: Service fournitures scolaires
pub mod generative_video_service; // ✅ NOUVEAU Phase 3.1: Service de génération vidéo IA complète
pub mod matching_emploi_service; // ✅ NOUVEAU 2025-01-28: Service matching intelligent
pub mod meta_ads_service; // ✅ 2026-04-03: Meta Marketing API — campagnes, DPA, budget auto
pub mod multilingue_service; // ✅ NOUVEAU 2026-03-16: Service multilingue pour notifications
pub mod notifications_matching_emploi; // ✅ NOUVEAU 2025-01-28: Notifications push pour nouveaux matchings
pub mod offres_emploi_service; // ✅ NOUVEAU 2025-01-28: Service offres d'emploi
pub mod orientation_scolaire_ai_service; // ✅ NOUVEAU: Service IA orientation scolaire
pub mod orientation_scolaire_service; // ✅ NOUVEAU 2025-01-28: Service orientation scolaire
pub mod paiement_agrege_service;
pub mod profils_candidats_service; // ✅ NOUVEAU 2025-01-28: Service profils candidats
pub mod programmes_scolaires_service; // ✅ NOUVEAU 2025-01-28: Service programmes scolaires
pub mod realtime_preview_service; // ✅ NOUVEAU 2025-01-27: Service de preview temps réel pour calcul local
pub mod render_fallback_service; // ✅ NOUVEAU 2025-01-27: Service de fallback pour rendu si device faible
pub mod social_chatbot_service; // ✅ 2026-04-03: Community Manager IA (Messenger/Instagram/WhatsApp)
pub mod social_inbox_service; // ✅ 2026-04-03: Inbox unifiée multi-plateformes
pub mod social_scheduler_service;
pub mod spotify_integration_service; // ✅ NOUVEAU Phase 2.2: Service d'intégration Spotify API
pub mod statistiques_emploi_service; // ✅ NOUVEAU 2025-01-28: Service statistiques emploi
pub mod template_service; // ✅ NOUVEAU 2025-01-27: Service de gestion templates vidéo par industrie (50+)
pub mod transcoding_service; // ✅ NOUVEAU Phase 2.3: Service de transcodage vidéo multi-formats
pub mod trending_music_service; // ✅ NOUVEAU 2026-03-05: Service de musique trending TikTok/Shorts
pub mod video_transcoding_service; // ✅ NOUVEAU 2026-03-05: Service de transcodage vidéo HLS/DASH (TikTok/Shorts)
pub mod watermark_service; // ✅ NOUVEAU 2025-01-27: Service de watermark Yukpo pour branding vidéo
pub mod whatsapp_service; // ✅ NOUVEAU 2026-03-06: Service WhatsApp Business avec routing automatique
pub mod youtube_audio_service;
pub mod yukpo_ia_billing; // YukpoIA — quota journalier + prélèvement jetons
pub mod yukpo_ia_chat_enrich; // YukpoIA — attachments / fichiers générés dans la réponse /ai/chat
pub mod yukpo_ia_job_queue; // YukpoIA — file Redis + jobs async chat
pub mod yukpo_ia_metrics_service; // YukpoIA — métriques par route / tenant
pub mod yukpo_ia_preprocess; // YukpoIA — Whisper + extraction PDF/office avant le prompt
pub mod yukpo_ia_session_store; // YukpoIA — sessions chat persistées (PostgreSQL)
pub mod yukpo_openai_outbound; // YukpoIA — client OpenAI partagé, concurrence, retries 429 // ✅ NOUVEAU Phase 2.2: Service YouTube Audio Library // ✅ NOUVEAU Phase 3.2 Améliorations: Service de rendu 3D complet // ✅ NOUVEAU 2026-03-16: Service de paiements agrégés // ✅ 2026-04-03: Scheduler intelligent + publication automatique
