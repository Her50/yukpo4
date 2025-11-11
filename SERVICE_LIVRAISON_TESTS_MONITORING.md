PLAN TESTS & MONITORING – SERVICE LIVRAISON YUKPO
================================================

## 1. Objectifs
- Couvrir l’ensemble du workflow Livraison (client, coursier, backoffice) par des tests automatisés.
- Garantir la non-régression sur matching, suivi temps réel, pricing.
- Mettre en place un monitoring post-déploiement pour détecter retards, échecs IA, incidents UX.

## 2. Stratégie de tests

### 2.1 Tests unitaires (Rust backend)
- Cibler `DeliveryService`, `MatchingService`, `PricingService`, `StateMachine`.
- Cas critiques :
  - Transitions état validées/invalides.
  - Calcul estimation prix (scénarios trafic, surcharges).
  - Matching : priorisation coursier le plus proche, fallback.
  - Annulation raisons différentes.
  - ✅ Nouveau : tests unitaires `delivery_service` couvrant assignation destinataire (formatage téléphone, consentement) et diffusion WebSocket (`recipient_dropoff`, wallet debit/refund) avec métriques associées.
- Framework : `cargo test`, usage `sqlx::test` (mock DB) ou `sea-orm` style.

### 2.2 Tests unitaires frontend
- Hooks : `useDeliveryRequest`, `useDeliveryTracking`.  
- ✅ Couverture ajoutée : tests Vitest pour `useDeliveryTracking` (web & mobile) simulant listeners WebSocket, timeline, rafraîchissement manuel.
- Composants : `DeliveryAvatar`, `DeliveryRequestStepper`, `DeliveryTimeline`.  
- Outils : React Testing Library, Jest, MSW pour mock API/WebSocket.

### 2.3 Tests d’intégration backend
- Utiliser environnement Postgres test + migrations offline.  
- `cargo test -- --ignored` pour scénarios lourds :
  - Création livraison → matching → acceptation.  
  - Rejet coursier → rematching.  
  - Annulation client après acceptation.  
  - Enregistrement tracking → stockage points.
- Mock API trafic via wiremock/HTTP stub.

### 2.4 Tests end-to-end (mobile & web)
- Outils :
  - Mobile : Detox / Maestro (simulateur).  
  - Web : Playwright ou Cypress.
- Scénarios :
  1. Client demande livraison simple, coursier accepte, suivi complet, notation.  
  2. Colis spécifique (fragile) → matching engin adapté.  
  3. Aucun coursier disponible → message alternatif.  
  4. Coursier annule → rematching.  
  5. Inscription coursier (formulaire complet).  
  6. Suivi temps réel : vérifier updates carte + timeline.  
  7. Erreur réseau WebSocket → fallback polling.  
  8. Test accessibilité (VoiceOver/ TalkBack sur avatar).

### 2.5 Tests manuels / UAT
- Checklist QA :
  - Vérifier animations avatar.  
  - Qualité UI (taille carte, responsive).  
  - Proof livraison (signature/foto) lisible.  
  - Multi plateformes (Android, iOS, Web).  
  - L10n (FR/EN).

## 3. Données de test & fixtures
- Seeds tests :
  - Coursiers avec différents engins/équipements.  
  - Types colis.  
  - Points d’intérêt (adresses fréquentes).  
  - Scénarios trafic synthétiques (faible, dense).  
- Utiliser factories (Rust `fake` crate, JS `@faker-js/faker`).  
- Nettoyage DB entre tests (transactions rollback).

## 4. Intégration CI/CD
- Pipeline :
  1. Lint (ESLint `npm run lint:check`, Rust fmt/clippy).  
  2. Tests unitaires backend + frontend (`cargo test`, `npm run test`).  
  3. Build `sqlx` offline check (`cargo sqlx prepare --check`).  
  4. Tests intégration (optionnel nightly).  
  5. E2E sur environnement staging (nightly/ pre-release).  
- Rapports centralisés (JUnit) pour visibilité.

- ✅ GitHub Actions `ci.yml` : job backend (`cargo fmt -- --check`, `cargo test`), job frontend (`npm run lint:check`, `npm run test`).

## 5. Monitoring post-déploiement

### 5.1 Observabilité technique
- Traces : `OpenTelemetry` + exporter (Jaeger).  
- Metrics Prometheus :
  - `delivery_matching_duration_seconds`.  
  - `delivery_estimator_latency_ms`.  
  - `delivery_tracking_updates_per_minute`.  
  - `delivery_status_transition_total{status=...}`.  
  - `courier_acceptance_rate`.  
  - `delivery_cancellation_total{reason=...}`.
  - ✅ Implémenté : compteurs en Rust `recipient_dropoff_events_total`, `wallet_debit_events_total`, `wallet_refund_events_total` + cumul montants (cents) exposés via `DeliveryService::get_delivery_metrics_snapshot`.
  - ✅ Endpoint `/metrics/delivery` (Prometheus format) en production interne pour scrapers Grafana/Carbon.
- Audit SQL : table `delivery_wallet_events` (migrations auto) pour contrôler l’historique des débits/remboursements (user, delivery, montant, solde).
- Instrumentation planifiée : exporter snapshot en `otel` histogrammes (latences matching, débit WebSocket) + labels `tenant`, `city`.
- Logs structurés (JSON) → ingestion ELK / Loki.
- Dashboards Grafana (PromQL) :
  - Volume débits : `increase(delivery_wallet_debit_events_total[5m])`
  - Montants débités : `increase(delivery_wallet_debit_amount_cents_total[5m]) / 100`
  - Partage tracking destinataire : `increase(delivery_recipient_dropoff_events_total[15m])`
  - Solde net (`refunds - debits`) : `(increase(delivery_wallet_refund_amount_cents_total[5m]) - increase(delivery_wallet_debit_amount_cents_total[5m])) / 100`
- Export QA : script `scripts/export_delivery_wallet_events.sql` (CSV) pour audits ponctuels (inclut user/email, statut livraison, métadonnées).

### 5.2 Monitoring UX & business
- Dashboards :
  - Temps réel : livraisons actives, retards > ETA, coursiers disponibles.  
  - Quotidien : temps moyen matching, satisfaction coursiers/clients, volumes par type colis.  
  - Heatmap zones forte demande.
- Alertes :
  - Matching > 2 min → Slack + SMS ops.  
  - Taux annulation > 5% sur 1h → investigation.  
  - Erreurs WebSocket > seuil.  
  - API trafic indisponible → fallback + alerte.

### 5.3 Feedback utilisateurs
- In-app Survey post-livraison (champ libre).  
- Analyse notation (tags) → rapport hebdo.  
- Collecte incidents via support (formulaire).

## 6. Observabilité mobile/frontend
- Intégrer logging RN (Sentry/ Bugsnag).  
- Tracer actions avatar + retours WebSocket.  
- Collecter métriques performance (FPS, temps rendu map).  
- Crasher plus capture (source maps).

## 7. Procédures incident
- Runbook `RUNBOOK_DELIVERY_INCIDENT.md` (à créer) :  
  - Vérifications initiales (status APIs, BDD).  
  - Procédures contournement (désactiver matching intelligent, fallback manuel).  
  - Communication clients/coursiers.  
- Escalade : support → ops → dev (RACI).

## 8. Roadmap qualité
- Sprint 1-2 : Tests unitaires + intégration, pipeline CI.  
- Sprint 3 : E2E basiques + monitoring initial.  
- Sprint 4 : Observabilité avancée, runbook.  
- Sprint 5 : Automatisation tests coursier (simuler GPS).  
- Post-lancement : améliorer tests basés sur retours incidents.

## 9. Actions immédiates
- Lister dépendances tests (Detox, Playwright).  
- Mettre à jour pipeline CI pour `cargo sqlx prepare --check`.  
- Créer fixtures seeds (coursiers, colis).  
- Ébaucher runbook incident.  
- Préparer dashboards Prometheus/Grafana (structure initiale).
- Cartographier dashboards (matching temps réel, wallet cashflow) + alertes sur compteurs dérivés `delivery_wallet_debit_events_total`.  
- Brancher `/metrics/delivery` sur collecteur Prometheus (scrape interval 15s) + définir panel Grafana "Flux wallet vs remboursements".

