pub mod admin_user_controller;
pub mod app_update_controller;
pub mod assistance_controller;
pub mod assurance_controller; // ✅ NOUVEAU: Contrôleur assurance dédié (recherche, devis IA, comparaison)
pub mod async_upload_controller; // ✅ NOUVEAU 2025-01-27: Contrôleur pour upload asynchrone
pub mod audio_library_controller;
pub mod auth_controller;
pub mod drive_import_controller; // ✅ Import permanent via lien Drive/cloud pour partenaires
pub mod echange_controller;
pub mod ecommerce_platform_controller; // ✅ 2026-04-01: Contrôleur e-commerce universel (toutes plateformes, intégrations partenaires)
pub mod ia_controller;
pub mod ia_status_controller;
pub mod interaction_controller;
pub mod media_controller;
pub mod plugin_controller; // ✅ NOUVEAU Phase 2: Controller pour gestion des plugins
pub mod prestataire_controller;
pub mod service_controller;
pub mod stock_media_controller; // ✅ NOUVEAU Phase 2: Controller pour Stock Media Integration
pub mod supermarket_controller; // ✅ NOUVEAU: Contrôleur supermarché dédié (produits, comparaison, promotions)
pub mod token_pack_controller;
pub mod universal_search_controller; // ✅ 2026-04-01: Recherche universelle cross-services (produits, menus, services spécialisés)
pub mod upload_controller; // ✅ NOUVEAU: Contrôleur pour upload préalable de fichiers
pub mod user_controller;
// pub mod fournitures_controller;
pub mod advanced_timeline_controller; // ✅ NOUVEAU Phase 2: Contrôleur pour timelines multi-pistes avancées
pub mod agency_schedule_controller; // ✅ 2025-11-27: Contrôleur pour gestion horaires de départ par agence/ville
pub mod appliance_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles d'appareils électroménagers (autocomplete)
pub mod ar_preview_controller; // ✅ NOUVEAU Phase 3.2: Contrôleur pour preview AR/VR
pub mod autocomplete_controller; // ✅ NOUVEAU: Contrôleur pour autocomplete characteristics
pub mod blood_bank_controller; // ✅ 2025-11-27: Contrôleur pour banques de sang (service spécialisé isolé)
pub mod blood_donation_matching_controller; // ✅ 2025-11-27: Contrôleur pour système intelligent matching banque de sang
pub mod bourse_livre_v2_controller; // ✅ V2 2026-03-15: Sessions upload, recto-verso, paquets, dons
pub mod bus_return_trip_controller; // ✅ 2025-01-28: Contrôleur pour demandes de retour (aller-retour)
pub mod bus_seat_management_controller; // ✅ 2025-11-27: Contrôleur pour gestion manuelle places non disponibles
pub mod bus_ticket_controller; // ✅ 2025-11-27: Contrôleur pour tickets bus avec agences de voyage
pub mod bus_ticket_credit_controller; // ✅ 2026-03-16: Contrôleur pour crédits et report de tickets bus
pub mod bus_ticket_payment_controller; // ✅ 2025-11-27: Contrôleur pour paiement tickets bus avec commission
pub mod bus_ticket_rating_controller; // ✅ NOUVEAU: Contrôleur pour ratings tickets bus
pub mod bus_ticket_validation_controller; // ✅ 2025-11-27: Contrôleur pour validation tickets bus avec QR code
pub mod chat_support_controller; // ✅ NOUVEAU: Contrôleur pour support chat
pub mod combination_progress_controller; // ✅ NOUVEAU 2025-11-03: Contrôleur pour progression génération combinaisons
pub mod content_engagement_controller;
pub mod conversation_controller; // ✅ NOUVEAU: Contrôleur pour @mentions et multi-participants
pub mod creator_analytics_controller; // ✅ NOUVEAU: Contrôleur pour analytics créateurs
pub mod debug_controller;
pub mod duet_remix_controller; // ✅ NOUVEAU: Contrôleur pour duet/remix
pub mod embedding_controller;
pub mod export_controller; // ✅ NOUVEAU Phase 2.3: Contrôleur pour jobs d'export vidéo
pub mod extended_audio_controller; // ✅ NOUVEAU Phase 2.2: Contrôleur pour bibliothèque audio étendue
pub mod flash_promo_controller; // ✅ NOUVEAU: Contrôleur pour flash promotionnels de produits (gratuit)
pub mod followers_controller; // ✅ NOUVEAU 2026-03-05: Contrôleur pour système de suivi vendeurs
pub mod generative_video_controller; // ✅ NOUVEAU Phase 3.1: Contrôleur pour génération vidéo IA complète
pub mod global_promo_controller;
pub mod gpu_controller; // ✅ NOUVEAU 2026-02-14: Contrôleur pour gestion GPU GCP
pub mod hashtag_controller; // ✅ NOUVEAU: Contrôleur pour gestion hashtags
pub mod health_structure_controller; // ✅ NOUVEAU: Contrôleur pour structures de santé (autocomplete)
pub mod history_controller;
pub mod hotel_financial_controller; // ✅ 2026-03-17: Contrôleur financier pour partenaires hôtel/meublé
pub mod hotel_group_controller; // ✅ 2026-04-01: Contrôleur groupes multi-biens, form config, profils clients
pub mod hotel_room_management_controller; // ✅ NOUVEAU 2026-01-27: Contrôleur gestion chambres/unités hôtels et meublés
pub mod image_search_controller; // ✅ NOUVEAU: Contrôleur pour recherche par image
pub mod intelligent_service_controller;
pub mod inventory_controller;
pub mod kyc_admin_controller; // ✅ NOUVEAU: Contrôleur admin KYC
pub mod librairie_admin_controller; // ✅ NOUVEAU 2026-03-16: Contrôleur admin réseau de librairies
pub mod librairie_network_controller; // ✅ NOUVEAU 2026-03-16: Contrôleur réseau de librairies et QR codes
pub mod live_ai_controller;
pub mod live_controller;
pub mod livres_scolaires_controller; // ✅ NOUVEAU 2025-01-28: Contrôleur livres scolaires
pub mod loyalty_controller; // ✅ NOUVEAU: Contrôleur pour programme de fidélité
pub mod media_analytics_controller;
pub mod media_product_controller; // ✅ NOUVEAU: Contrôleur pour médias par produit spécifique
pub mod menu_planning_controller; // ✅ NOUVEAU 2025-01-27: Contrôleur planification menus
pub mod metrics_controller;
pub mod mixed_content_controller; // ✅ NOUVEAU: Contrôleur pour contenu mixte (publicités + organiques)
pub mod mobile_logs_controller; // ✅ NOUVEAU : Contrôleur pour logs mobile
pub mod notification_controller; // ✅ Contrôleur de notifications
pub mod offres_emploi_controller; // ✅ NOUVEAU 2025-01-28: Contrôleur offres d'emploi
pub mod orientation_scolaire_controller; // ✅ NOUVEAU 2025-01-28: Contrôleur orientation scolaire et établissements
pub mod paiement_admin_controller; // ✅ NOUVEAU 2026-03-16: Contrôleur admin paiements (fournisseurs, remboursements)
pub mod paiement_agrege_controller; // ✅ NOUVEAU 2026-03-16: Contrôleur paiements agrégés
pub mod partner_validation_controller;
pub mod payment_controller;
pub mod performance_controller; // ✅ NOUVEAU 2025-11-28: Contrôleur pour métriques de performance
pub mod pharmacy_controller; // ✅ 2025-11-26: Contrôleur pour pharmacies
pub mod pharmacy_product_controller; // ✅ NOUVEAU: Contrôleur produits de pharmacie
pub mod phone_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles de smartphones (autocomplete)
pub mod phone_verification_controller;
pub mod places_controller; // ✅ NOUVEAU 2025-11-02: Contrôleur pour enrichissement géographique GeoNames
pub mod popular_products_controller; // ✅ NOUVEAU 2025-11-04: Contrôleur pour produits populaires (analyse concurrence)
pub mod product_addition_controller; // ✅ NOUVEAU 2025-11-01: Contrôleur pour ajout incrémental de produits
pub mod product_comments_controller; // ✅ NOUVEAU 2025-11-08: Contrôleur pour fil de commentaires produits
pub mod product_distribution_controller; // ✅ 2026-04-03: Distribution produits multi-canaux (Facebook OAuth, catalogue, feeds)
pub mod product_lifecycle_controller;
pub mod product_reactions_controller; // ✅ NOUVEAU 2025-11-04: Contrôleur pour réactions/émotions sur les produits
pub mod product_stats_controller; // ✅ NOUVEAU 2026-03-03: Contrôleur statistiques produit (dashboard prestataire)
pub mod product_video_controller; // ✅ Contrôleur génération vidéo produit instantanée
pub mod products_controller; // ✅ PHASE 3: Controller pour gestion produits via table service_products // ✅ Contrôleur de gestion du cycle de vie des produits
pub mod prometheus_metrics_controller; // ✅ Phase 3: Endpoint Prometheus centralisé
pub mod publicite_controller; // ✅ NOUVEAU: Contrôleur pour système de publicité payante
pub mod push_controller; // ✅ Contrôleur de push notifications
pub mod recommendation_controller; // ✅ NOUVEAU: Contrôleur pour recommandations et tracking visibilité
pub mod restaurant_controller; // ✅ 2026-03-31: Gestion restaurant (salle, plan, codes partenaires)
pub mod scheduling_search_controller; // ✅ NOUVEAU: Contrôleur pour recherche avec planifications
pub mod scoring_controller; // ✅ Contrôleur pour scoring de services
pub mod search_history_controller; // ✅ NOUVEAU: Contrôleur pour historique de recherche
pub mod service_team_controller; // ✅ NOUVEAU: Contrôleur pour gestion d'équipe des services
pub mod signalement_controller; // ✅ NOUVEAU: Contrôleur pour signalements de produits/services
pub mod social_ai_addons; // ✅ 2026-04-04: CRM, Email IA, Vision, WhatsApp payments, Marketplace
pub mod social_ai_controller;
pub mod social_ai_growth; // ✅ 2026-04-04: Email sending, WA Broadcast, Abandoned cart, CSV export
pub mod social_connector_controller;
pub mod social_features_controller; // ✅ NOUVEAU: Contrôleur fonctionnalités sociales avancées
pub mod specialized_chat_controller; // ✅ NOUVEAU: Contrôleur chat intégré
pub mod specialized_payment_controller; // ✅ NOUVEAU: Contrôleur paiement intégré // ✅ NOUVEAU 2025-01-XX: Contrôleur unifié pour services spécialisés (remplace 6 appels par 1)
pub mod specialized_rating_controller; // ✅ NOUVEAU: Contrôleur avis et ratings
pub mod specialized_reservation_controller; // ✅ NOUVEAU: Contrôleur réservations
pub mod specialized_services_controller; // ✅ 2025-11-26: Contrôleur pour services spécialisés (hôpitaux, laboratoires, agences, covoiturage, taxi)
pub mod specialized_services_unified_controller;
pub mod studio_controller;
pub mod system_health_controller;
pub mod taxi_analytics_controller; // ✅ NOUVEAU 2025-01-29: Contrôleur analytics dashboard (Leadership Global 100%)
pub mod taxi_dynamic_pricing_controller;
pub mod taxi_leadership_controller; // ✅ NOUVEAU 2025-01-29: Contrôleur leadership (prédiction demande)
pub mod taxi_recommendations_controller; // ✅ NOUVEAU 2025-01-29: Contrôleur recommandations personnalisées
pub mod taxi_ride_controller; // ✅ 2026-04-01: Estimation tarif GPS + flow accept/refuse + commission 15%
pub mod taxi_route_optimization_controller; // ✅ NOUVEAU 2025-01-29: Contrôleur optimisation itinéraires IA
pub mod trend_controller; // ✅ 2026-04-03: TrendPulse + contexte utilisateur (/api/trends/*, /api/user/context)
pub mod troc_livres_controller; // ✅ NOUVEAU 2025-01-28: Contrôleur troc livres scolaires
pub mod vehicle_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles de véhicules (autocomplete)
pub mod video_ml_controller;
pub mod video_upload_controller; // ✅ NOUVEAU: Contrôleur ML pour recommandations vidéo personnalisées
pub mod webhook_controller;
pub mod webrtc_controller; // ✅ NOUVEAU: Contrôleur WebRTC pour appels // ✅ NOUVEAU 2025-11-06: Contrôleur pour debug et vérification des tables // ✅ NOUVEAU 2025-01-29: Contrôleur prix dynamique IA (Leadership 100%) // ✅ NOUVEAU 2026-03-17: Contrôleur validation téléphone et partage WhatsApp/SMS // ✅ 2026-04-03: Social AI Engine (content gen, chatbot, ads, inbox, webhooks)

pub mod brand_voice_controller; // ✅ 2026-04-03: Entraînement brand voice IA par partenaire
pub mod content_approval_controller; // ✅ 2026-04-03: Workflow approbation contenu
pub mod longform_controller; // ✅ 2026-04-03: Génération contenu long format
pub mod reputation_controller;
pub mod social_analytics_controller; // ✅ 2026-04-03: Dashboard analytics cross-plateformes + A/B test
pub mod trendpulse_b2b_controller; // ✅ 2026-04-03: API TrendPulse B2B monétisée (clé API, quota) // ✅ 2026-04-03: Monitoring mentions + crise

// pub use service_controller::update_token_debit;
