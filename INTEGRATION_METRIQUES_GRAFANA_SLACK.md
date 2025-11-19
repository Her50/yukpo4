# 📊 Intégration Métriques Grafana/Prometheus + Slack - État d'Avancement

## ✅ CE QUI A ÉTÉ FAIT

### 1. Configuration Backend (Rust)

#### Métriques Prometheus ✅
- **Module métriques** (`backend/src/metrics/mod.rs`) :
  - ✅ `ChatMetrics` : Conversations actives, messages envoyés/livrés/lus, appels WebRTC
  - ✅ `ProductCarouselMetrics` : Scrolls, auto-scroll, items vus, interactions, pause/resume
  - ✅ `VideoCarouselMetrics` : Scrolls, auto-scroll, vidéos vues, play/pause, engagement
  - ✅ `NavigationMetrics` : Vues écran, recherches, résultats affichés, filtres, clics, recherches géolocalisées
  - ✅ `GlobalPromoMetrics` : Événements actifs, entrées, vues, clics, revenus

- **Routes de tracking** (`backend/src/routes/metrics_tracking_routes.rs`) :
  - ✅ `POST /api/metrics/track/product-carousel` : Tracking carrousels produits
  - ✅ `POST /api/metrics/track/video-carousel` : Tracking carrousels vidéos
  - ✅ `POST /api/metrics/track/navigation` : Tracking navigation ResultatBesoinScreen
  - ✅ `POST /api/metrics/track/global-promo-entry` : Tracking promotions globales

- **Endpoint métriques** (`backend/src/controllers/metrics_controller.rs`) :
  - ✅ `GET /metrics` : Expose toutes les métriques au format Prometheus
  - ✅ Intègre métriques pipeline vidéo, delivery, preview studio, et métriques UX

- **Intégration chat** (`backend/src/routes/chat_routes.rs`) :
  - ✅ Métriques chat trackées automatiquement lors de l'envoi de messages
  - ✅ Incrémentation de `messages_sent_total` et `notifications_sent_total`

### 2. Configuration Prometheus ✅

- **Fichier** : `prometheus.yml`
  - ✅ Scrape du backend Render (`yukpomnang.onrender.com/metrics`)
  - ✅ Configuration AlertManager
  - ✅ Labels d'environnement (production, cluster)

- **Règles d'alertes** : `backend/monitoring/prometheus_alerts.yml`
  - ✅ Alertes pipeline vidéo (critique, dégradé, queue haute, taux échec)
  - ✅ Alertes delivery (matching dégradé)
  - ✅ Alertes métriques chat (volume messages, conversations actives)
  - ✅ Alertes métriques UX (scroll produits/vidéos, navigation, recherches sans résultats)

### 3. Configuration AlertManager + Slack ✅

- **Fichier** : `backend/monitoring/alertmanager.yml`
  - ✅ Configuration Slack avec webhooks
  - ✅ Routes d'alertes par sévérité (critical, warning, info)
  - ✅ Canaux Slack séparés :
    - `#yukpo-alerts-critical` : Alertes critiques
    - `#yukpo-alerts` : Alertes warning
    - `#yukpo-ux-metrics` : Métriques UX (chat, scroll, navigation)
  - ✅ Templates de messages Slack avec couleurs et champs structurés
  - ✅ Inhibition rules pour éviter alertes redondantes

### 4. Services Frontend/Mobile ✅

- **Frontend** : `frontend/src/services/metricsTracking.ts`
  - ✅ `trackProductCarousel()` : Tracking carrousels produits
  - ✅ `trackVideoCarousel()` : Tracking carrousels vidéos
  - ✅ `trackNavigation()` : Tracking navigation ResultatBesoinScreen
  - ✅ `trackChatEvent()` : Tracking événements chat (stub)
  - ✅ Hook `useScrollTracking()` pour throttling

- **Mobile** : `mobile/src/services/metricsTracking.ts`
  - ✅ Même API que frontend, adaptée pour React Native
  - ✅ Utilise `API_BASE_URL` depuis config

### 5. Intégration Tracking dans ResultatBesoinScreen (Mobile) ✅

- **Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx`
  - ✅ Tracking vue écran au montage
  - ✅ Tracking recherches (avec/sans résultats)
  - ✅ Tracking filtres appliqués
  - ✅ Tracking clics sur produits
  - ✅ Tracking scroll (avec throttling)
  - ✅ Tracking recherches géolocalisées

## ⏳ CE QUI RESTE À FAIRE

### 1. Intégration Tracking Frontend ResultatBesoinScreen ⏳

- **Fichier** : `frontend/src/pages/ResultatBesoin.tsx`
  - ⏳ Ajouter import `trackNavigation` depuis `@/services/metricsTracking`
  - ⏳ Tracking vue écran au montage
  - ⏳ Tracking recherches
  - ⏳ Tracking filtres
  - ⏳ Tracking clics produits
  - ⏳ Tracking scroll

### 2. Intégration Tracking Carrousels Produits/Vidéos ⏳

- **Carrousels produits** :
  - ⏳ `frontend/src/components/PublicitesCarousel.tsx` : Ajouter tracking scroll/clics
  - ⏳ `mobile/src/components/ProductCard.tsx` : Ajouter tracking vues/clics

- **Carrousels vidéos** :
  - ⏳ Identifier composants vidéo carousel
  - ⏳ Ajouter tracking scroll/play/pause/engagement

### 3. Intégration Tracking Chat Frontend/Mobile ⏳

- **Frontend** : `frontend/src/components/chat/ChatModal.tsx` / `GlobalChat.tsx`
  - ⏳ Tracking ouverture/fermeture conversation
  - ⏳ Tracking messages envoyés (déjà fait backend, mais peut tracker côté frontend aussi)
  - ⏳ Tracking messages lus

- **Mobile** : `mobile/src/components/ChatModalMobile.tsx`
  - ⏳ Même tracking que frontend

### 4. Configuration Slack Webhooks ⏳

**Variables d'environnement à configurer sur Render** :
```bash
# Webhook Slack pour AlertManager
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhooks existants (déjà configurés dans le code)
PIPELINE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Comment créer un webhook Slack** :
1. Aller sur https://api.slack.com/apps
2. Créer une nouvelle app pour votre workspace
3. Activer "Incoming Webhooks"
4. Créer des webhooks pour les canaux :
   - `#yukpo-alerts-critical`
   - `#yukpo-alerts`
   - `#yukpo-ux-metrics`
5. Copier les URLs et les ajouter comme variables d'environnement

### 5. Déploiement AlertManager sur Hetzner ⏳

- **Docker Compose** : Vérifier que `alertmanager` est configuré dans `docker-compose.cloud.yml`
- **Volumes** : Monter `backend/monitoring/alertmanager.yml` dans le conteneur
- **Variables d'environnement** : Passer `SLACK_WEBHOOK_URL` au conteneur

### 6. Dashboards Grafana ⏳

- **Dashboard "Métriques UX"** :
  - Panels pour scroll produits/vidéos
  - Panels pour navigation ResultatBesoinScreen
  - Panels pour métriques chat
  - Graphiques temps réel et historiques

- **Dashboard "Pipeline Vidéo"** : (déjà mentionné dans ANALYSE_VALEUR_HETZNER_GRAFANA_PROMETHEUS.md)
  - Statut pipeline
  - Jobs en file d'attente
  - Durée génération
  - Taux de succès

- **Dashboard "Delivery"** : (déjà mentionné)
  - Taux de succès matching
  - Latence matching
  - Connexions WebSocket
  - Événements wallet

## 📋 CHECKLIST DÉPLOIEMENT

### Backend (Render)
- [ ] Vérifier que `/metrics` est accessible publiquement (ou via auth)
- [ ] Vérifier que les routes `/api/metrics/track/*` sont accessibles
- [ ] Configurer variables d'environnement Slack webhooks

### Prometheus (Hetzner)
- [ ] Copier `prometheus.yml` dans `/etc/prometheus/`
- [ ] Copier `backend/monitoring/prometheus_alerts.yml` dans `/etc/prometheus/alerts.yml`
- [ ] Redémarrer Prometheus
- [ ] Vérifier que les targets sont "UP" dans Prometheus UI

### AlertManager (Hetzner)
- [ ] Copier `backend/monitoring/alertmanager.yml` dans `/etc/alertmanager/`
- [ ] Configurer `SLACK_WEBHOOK_URL` dans le conteneur
- [ ] Redémarrer AlertManager
- [ ] Tester une alerte (ex: déclencher manuellement)

### Grafana (Hetzner)
- [ ] Configurer datasource Prometheus
- [ ] Créer dashboards métriques UX
- [ ] Configurer alertes dans Grafana (optionnel, si on veut utiliser Grafana alerts au lieu de Prometheus)

### Frontend/Mobile
- [ ] Vérifier que `API_BASE_URL` pointe vers le bon backend
- [ ] Tester envoi de métriques depuis frontend/mobile
- [ ] Vérifier dans Prometheus que les métriques arrivent

## 🔍 VÉRIFICATIONS

### Vérifier que les métriques arrivent dans Prometheus

1. **Accéder à Prometheus** : `http://46.224.14.85:9090`
2. **Vérifier targets** : Status > Targets > `yukpo-backend` doit être "UP"
3. **Vérifier métriques** : Graph > Rechercher `chat_messages_sent_total`, `product_carousel_scrolls_total`, etc.
4. **Vérifier alertes** : Alerts > Voir les alertes actives

### Vérifier que les alertes arrivent dans Slack

1. **Déclencher une alerte de test** :
   - Modifier temporairement un seuil dans `prometheus_alerts.yml`
   - Ou utiliser l'API Prometheus pour injecter une métrique de test

2. **Vérifier dans Slack** :
   - Les messages doivent apparaître dans les canaux configurés
   - Formatage avec couleurs et champs structurés

### Vérifier le tracking frontend/mobile

1. **Ouvrir la console navigateur/app** (mode dev)
2. **Effectuer des actions** :
   - Ouvrir ResultatBesoinScreen → Vérifier tracking "view"
   - Faire une recherche → Vérifier tracking "search"
   - Appliquer un filtre → Vérifier tracking "filter"
   - Cliquer sur un produit → Vérifier tracking "click"
   - Scroller → Vérifier tracking scroll

3. **Vérifier dans Prometheus** :
   - Les compteurs doivent s'incrémenter
   - Exemple : `resulta_besoin_screen_searches_total` doit augmenter

## 📚 DOCUMENTATION RÉFÉRENCE

- **Analyse valeur Hetzner/Grafana** : `ANALYSE_VALEUR_HETZNER_GRAFANA_PROMETHEUS.md`
- **Guide déploiement Hetzner** : `PROMPT_CONTINUATION_DEPLOIEMENT_HETZNER.md`
- **Configuration Prometheus** : `prometheus.yml`
- **Configuration AlertManager** : `backend/monitoring/alertmanager.yml`
- **Règles d'alertes** : `backend/monitoring/prometheus_alerts.yml`

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

1. **Compléter l'intégration frontend** : Ajouter tracking dans `ResultatBesoin.tsx` et carrousels
2. **Compléter l'intégration chat** : Ajouter tracking dans composants chat frontend/mobile
3. **Configurer Slack** : Créer webhooks et configurer variables d'environnement
4. **Déployer AlertManager** : Vérifier configuration Docker et déployer
5. **Créer dashboards Grafana** : Visualiser les métriques UX en temps réel
6. **Tester end-to-end** : Vérifier que tout fonctionne de bout en bout

---

**Document créé le** : 2025-01-17  
**Dernière mise à jour** : 2025-01-17  
**Auteur** : Équipe Technique Yukpomnang


