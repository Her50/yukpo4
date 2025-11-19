# 📋 Récapitulatif - 3 Questions et Métriques Additionnelles

## 1️⃣ Où le GPU va le PLUS IMPACTER ?

**Réponse** : Voir `IMPACT_GPU_APPLICATION.md` pour les détails complets.

### Top 3 des Impacts GPU

1. **🖼️ Conversion Multimodale** (PDF/Excel/Images) - ⭐⭐⭐⭐⭐
   - Gain : **-75%** (15-25s → 3-5s)
   - Fichier : `gpu_optimizer.rs::convert_all_modals_to_images_gpu_parallel()`

2. **🎨 Optimisation d'Images** (Compression/Redimensionnement) - ⭐⭐⭐⭐⭐
   - Gain : **-80%** (5-10s → 1-2s)
   - Fichier : `gpu_optimizer.rs::optimize_single_image()`

3. **🔍 Analyse d'Images Intelligente** (OCR, Détection) - ⭐⭐⭐⭐
   - Gain : **-75%** (5-10s → 1-2s)
   - Fichier : `intelligent_image_analysis_service.rs`

**Conclusion** : Le GPU accélérera **toutes les opérations de traitement d'images** de **-75% à -80%**.

---

## 2️⃣ Changement de Mot de Passe Grafana

**Réponse** : ✅ **Oui, le script existe** mais **n'a pas été exécuté automatiquement**.

### Script Disponible

**Fichier** : `changer-password-grafana.sh`

**Usage** :
```bash
GRAFANA_NEW_PASSWORD='votre_mot_de_passe' bash changer-password-grafana.sh
```

**Localisation** : Sur votre machine locale (pas encore sur Hetzner)

### Pour l'Exécuter

**Option 1 : Depuis votre machine (via SSH)**
```bash
# Copier le script sur Hetzner
scp changer-password-grafana.sh root@46.224.14.85:/tmp/

# Se connecter et exécuter
ssh root@46.224.14.85
cd /tmp
GRAFANA_NEW_PASSWORD='VotreMotDePasseSecurise123!' bash changer-password-grafana.sh
```

**Option 2 : Exécuter directement sur Hetzner**
```bash
ssh root@46.224.14.85
cd /opt/yukpo
# Créer le script si nécessaire
nano changer-password-grafana.sh
# Coller le contenu du script
# Puis exécuter
GRAFANA_NEW_PASSWORD='VotreMotDePasseSecurise123!' bash changer-password-grafana.sh
```

**Note** : Le script existe mais nécessite une exécution manuelle. Je peux l'automatiser si vous voulez.

---

## 3️⃣ Métriques Additionnelles - Plan d'Implémentation

### ✅ État Actuel

**Services existants** :
- ✅ `global_promo_service.rs` - Promotions globales
- ✅ `delivery_service.rs` - Livraisons
- ✅ `video_generation_service.rs` - Vidéos
- ✅ Métriques Prometheus déjà implémentées pour vidéo/delivery

### 📊 Métriques à Implémenter

#### 1. Métriques Black Friday / Promotions Globales

**Service** : `backend/src/services/global_promo_service.rs`

**Métriques à ajouter** :
```rust
// Dans backend/src/metrics/mod.rs (à créer)
global_promo_events_active{event_slug="black-friday-2025"}
global_promo_entries_total{event_slug="...",status="published"}
global_promo_entries_views_total{entry_id="..."}
global_promo_entries_clicks_total{entry_id="..."}
global_promo_catalog_page_views_total{event_slug="..."}
global_promo_catalog_searches_total{event_slug="..."}
global_promo_revenue_cents_total{event_slug="..."}
```

**Points d'injection** :
- `create_event()` - Incrémenter `global_promo_events_active`
- `upsert_entry()` - Incrémenter `global_promo_entries_total`
- `get_catalog_page()` - Incrémenter `global_promo_catalog_page_views_total`
- Tracking vues/clics (à ajouter dans les routes)

---

#### 2. Métriques Scroll Automatique Produits

**Composants** : `frontend/src/components/PublicitesCarousel.tsx`

**Métriques à ajouter** :
```rust
product_carousel_scrolls_total{carousel_id="..."}
product_carousel_auto_scroll_events_total{carousel_id="..."}
product_carousel_items_viewed_total{carousel_id="...",product_id="..."}
product_carousel_dwell_time_seconds_avg{carousel_id="..."}
product_carousel_interactions_total{carousel_id="...",action="click|view|pause"}
product_carousel_pause_events_total{carousel_id="..."}
product_carousel_resume_events_total{carousel_id="..."}
```

**Points d'injection** :
- Frontend : Envoyer événements au backend via API
- Backend : Route `/api/metrics/carousel` pour recevoir les événements
- Backend : Incrémenter métriques Prometheus

---

#### 3. Métriques Scroll Automatique Vidéos

**Composants** : Composants vidéo mobile/web

**Métriques à ajouter** :
```rust
video_carousel_scrolls_total{carousel_id="..."}
video_carousel_auto_scroll_events_total{carousel_id="..."}
video_carousel_videos_viewed_total{carousel_id="...",video_id="..."}
video_carousel_dwell_time_seconds_avg{carousel_id="..."}
video_carousel_play_events_total{carousel_id="..."}
video_carousel_pause_events_total{carousel_id="..."}
video_carousel_completion_rate{carousel_id="..."}
video_carousel_engagement_total{carousel_id="...",action="like|share|comment"}
```

**Points d'injection** :
- Frontend/Mobile : Envoyer événements au backend
- Backend : Route `/api/metrics/video-carousel`
- Backend : Incrémenter métriques Prometheus

---

#### 4. Métriques Échanges Clients/Prestataires

**Services** : `backend/src/routes/chat_routes.rs`, `backend/src/controllers/interaction_controller.rs`

**Métriques à ajouter** :
```rust
chat_conversations_active_total{service_id="..."}
chat_messages_sent_total{service_id="...",sender_type="client|provider"}
chat_messages_delivered_total{service_id="..."}
chat_messages_read_total{service_id="..."}
chat_response_time_seconds_avg{service_id="...",responder_type="provider|client"}
chat_response_time_seconds_p95{service_id="..."}
chat_conversations_resolved_total{service_id="..."}
chat_conversations_unresolved_total{service_id="..."}
chat_audio_messages_total{service_id="..."}
chat_webrtc_calls_total{service_id="..."}
chat_webrtc_call_duration_seconds_avg{service_id="..."}
chat_notifications_sent_total{service_id="..."}
```

**Points d'injection** :
- `send_message()` - Incrémenter `chat_messages_sent_total`
- `mark_as_read()` - Incrémenter `chat_messages_read_total`
- WebRTC handlers - Incrémenter `chat_webrtc_calls_total`

---

#### 5. Métriques Navigation ResultaBesoinScreen

**Composants** : `mobile/src/screens/ResultaBesoinScreen.tsx`

**Métriques à ajouter** :
```rust
resulta_besoin_screen_views_total
resulta_besoin_screen_searches_total{query_type="keyword|category|location"}
resulta_besoin_screen_results_displayed_total{search_query="..."}
resulta_besoin_screen_filters_applied_total{filter_type="price|category|location|rating"}
resulta_besoin_screen_item_clicks_total{item_type="service|product",item_id="..."}
resulta_besoin_screen_time_on_screen_seconds_avg
resulta_besoin_screen_bounce_rate
resulta_besoin_screen_searches_without_results_total
resulta_besoin_screen_geolocation_searches_total
resulta_besoin_screen_map_interactions_total{action="zoom|pan|marker_click"}
```

**Points d'injection** :
- Frontend/Mobile : Envoyer événements au backend
- Backend : Route `/api/metrics/navigation`
- Backend : Incrémenter métriques Prometheus

---

## 🚀 Plan d'Implémentation

### Phase 1 : Infrastructure Métriques (30 min)

1. **Créer module métriques** : `backend/src/metrics/mod.rs`
2. **Définir toutes les métriques** Prometheus
3. **Exposer dans `/metrics`** (déjà fait, juste ajouter les nouvelles)

### Phase 2 : Métriques Backend (1-2h)

1. **Promotions Globales** : Ajouter dans `global_promo_service.rs`
2. **Chat** : Ajouter dans `chat_routes.rs` et `interaction_controller.rs`
3. **Routes de tracking** : Créer `/api/metrics/carousel`, `/api/metrics/video-carousel`, `/api/metrics/navigation`

### Phase 3 : Métriques Frontend (1-2h)

1. **Scroll Produits** : Modifier `PublicitesCarousel.tsx`
2. **Scroll Vidéos** : Modifier composants vidéo
3. **Navigation** : Modifier `ResultaBesoinScreen.tsx`

### Phase 4 : Dashboards Grafana (30 min)

1. **Dashboard "Promotions"**
2. **Dashboard "Engagement"** (Scroll, Navigation)
3. **Dashboard "Chat"**

---

## ✅ Prochaines Étapes

**Voulez-vous que je** :
1. ✅ Crée le module métriques (`backend/src/metrics/mod.rs`) ?
2. ✅ Ajoute les métriques dans `global_promo_service.rs` ?
3. ✅ Crée les routes de tracking pour frontend ?
4. ✅ Exécute le script de changement de mot de passe Grafana ?

**Dites-moi par où commencer !** 🚀

