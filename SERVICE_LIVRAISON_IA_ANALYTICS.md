STRATÉGIE IA & ANALYTICS – SERVICE LIVRAISON YUKPO
==================================================

## 1. Objectifs
- Estimer durée et coût de livraison de manière fiable (trafic, terrain, météo).
- Recommander le type d’engin adapté selon la nature du colis (vision + heuristiques).
- Optimiser le matching coursier ↔ colis ↔ parcours.
- Mesurer performance opérationnelle pour amélioration continue.
- Respecter contraintes repo : timeouts IA, validation réponses, gestion erreurs robuste.

## 2. Modules IA prévus

### 2.1 Estimation temps & coût (`DeliveryEstimator`)
- Entrées :
  - Distance pickup → dropoff (via service cartographie).
  - Profil route (segments terrain : goudronné, piste, dénivelé).
  - Données trafic temps réel (API tiers + historique interne).
  - Poids/volume colis, type engin (influe vitesse).
  - Météo (optionnel phase 2).
- Sorties :
  - `estimated_duration_seconds`
  - `suggested_engine` (si coursier pas encore choisi)
  - `surcharge_factors` (trafic, terrain, météo)
- Architecture :
  - Version 1 : heuristique pondérée (coefficients calibrés).
  - Version 2 : modèle ML supervisé (regression gradient boosting) entraîné sur historique.
  - Pipeline : service Rust appelle micro-service Python/ML (REST) ou crate interne si heuristique.
- Timeouts :
  - 1,5s max → fallback heuristique simple.
- Validation :
  - Vérifier que durée > temps minimum (distance / vitesse max).
  - Comparaison estimation heuristique vs ML (écart > 40% → fallback + log).

### 2.2 Reconnaissance colis (`ParcelRecognizer`)
- Entrées : photos colis (optionnelles), description textuelle.
- Étapes :
  - Pré-traitement image (redimension, anonymisation).
  - Appel modèle vision (ex : MobileNet, EfficientDet) pour détecter taille/fragilité.
  - NLP simple sur description pour extraire mots-clés (fragile, liquide, froid…).
- Sorties :
  - Suggestions : type colis, besoins équipements, poids/volume estimés.
- Timeouts :
  - 2s max → fallback heuristique (basé sur description + données utilisateur).
- Validation :
  - Score confiance < seuil → marquer suggestion comme “à confirmer”.
  - Jamais auto-valider sans confirmation utilisateur (afficher suggestions).
- Sécurité :
  - Filtrer métadonnées images, stockage chiffré, suppression après usage.

### 2.3 Matching scoring (`CourierScorer`)
- Entrées : distance pickup/courier, type engin, ratings, stats ponctualité, précédentes performances.
- Sortie : score global 0-100.
- Approche :
  - Version 1 : scoring heuristique (pondération configurable).
  - Version 2 : modèle ML ranking (Learning to Rank) basé sur historique.
- Validation : normaliser score (0-100), log top candidats.

## 3. Données & pipelines
- Collecte :
  - `delivery_tracking_points` alimente dataset pour vitesse moyenne par segment.
  - `delivery_status_events` fournit durées étapes.
  - `courier_ratings`, `client_ratings` alimentent scoring.
- Stockage analytics :
  - Warehouse (ex: BigQuery / Redshift) ou tables analytiques PostgreSQL.
  - Process ETL quotidien (Airflow ou jobs Rust/Node).
- Features store :
  - Table `delivery_features_cache` (optionnel) pour stocker features pré-calculées (surcoût terrain, densité trafic).

## 4. Fournisseurs externes
- Trafic : Google Maps Traffic, TomTom, HERE, OpenTraffic (choisir selon coûts/API).  
- Cartographie : Mapbox/OSM pour tiles + directions.  
- Météo : OpenWeather (phase 2).  
- IA Vision : service interne (PyTorch) ou API tier (Google Vision) mais attention latence/coût.

## 5. Analytics & KPI
- Temps moyen acceptation coursier.  
- Taux de réussite premier coursier (matching).  
- Delta estimation vs réel (durée, prix).  
- Taux annulation (par état, motif).  
- Satisfaction clients/coursiers (score moyen).  
- Temps moyen par étape (en route pickup, en route livraison).  
- Utilisation équipements spécifiques (isotherme, colis volumineux).

Dashboard (Metabase / Grafana) :
- Tableaux temps réel (livraisons actives, retards).  
- Visualisation heatmap zones forte demande.  
- Graphes tendances (trafic, saisons).

## 6. Monitoring & alertes
- Observabilité :
  - Traces (`tracing` + OpenTelemetry).  
  - Metrics Prometheus : `delivery_estimator_duration_ms`, `matching_timeout_count`, `ai_suggestion_confidence`.  
  - Logs JSON enrichis (corrélation ID).
- Alertes :
  - Estimation échec > seuil (pager).  
  - Temps matching > 3 min (alerte Slack).  
  - Variance estimation vs réel > 50% sur 10 courses (alerte).

## 7. Gouvernance données
- Consentement utilisateur pour partage géolocalisation.  
- Anonymisation tracking après X jours (suppression identifiants).  
- Conformité RGPD locale : droit à l’oubli (supprimer tracking points).  
- Politique rétention : 12 mois pour données brutes, 24 mois agrégées.

## 8. Roadmap IA
1. v1 (Sprints 1-4) : heuristiques + intégration trafic basique, reconnaissance colis assistée (sans vision).  
2. v2 (Sprints 5-7) : pipeline vision, scoring avancé, calibrations.  
3. v3 (Sprints 8+) : apprentissage continu, personnalisation par coursier, recommandation dynamique prix.

## 9. Implémentation technique
- Micro-service ML (Python FastAPI) ou crate Rust :
  - `/estimate` : calcule durée+prix.  
  - `/recognize` : renvoie suggestion colis.  
  - `/score` : returns scoring coursier.
- Communiquer via HTTP interne (auth service-to-service).  
- Configurable via `backend/config/delivery.toml` (coefficients heuristiques, timeouts).  
- Tests :
  - Unitaires sur heuristiques (jeux de données synthétiques).  
  - Tests d’intégration avec mocks API trafic.  
  - Validation qualité : dataset labeled (20-30 courses pilotes).

## 10. Collaboration équipes
- Data analyst : définir KPI, dashboards.  
- Dev backend : intégration services, gestion erreurs.  
- Dev frontend : afficher confiance estimations, recueillir feedback.  
- Ops : surveiller coûts API, latence.

## 11. Actions immédiates
- Identifier fournisseur trafic + coûts.  
- Rassembler historique livraisons existant (si dispo).  
- Définir dataset minimal pour calibrer heuristiques (ex 50 trajets tests).  
- Préparer script de backtesting (comparer estimation vs trajet réel).  
- Documenter procédures timeouts/fallbacks pour support.

