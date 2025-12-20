# 🚕 PROMPT 4 : MISE À JOUR SERVICE TAXI DE VILLE

Je souhaite une expérience UX unique et rivalisant avec les plus grandes plateformes occidentales pour améliorer le service spécialisé TAXI DE VILLE dans Yukpomnang. Je veux m'inspirer de tout le travail fait pour améliorer les fonctionnalités des tickets bus et du covoiturage.

⚠️ ATTENTION CRITIQUE : Ne commence PAS par créer ou améliorer. Analyse complètement l'existant (beaucoup de choses existent déjà pour taxi).

## 🔍 PHASE 1 : ANALYSE COMPLÈTE DE L'EXISTANT

### A. Analyse Service Taxi Actuel
1. **Services Rust existants** :
   - `backend/src/services/taxi_matching_service.rs`
   - Tous services liés au taxi dans `backend/src/services/`

2. **Contrôleurs et Routes** :
   - Vérifier `backend/src/controllers/` pour contrôleurs taxi
   - Vérifier `backend/src/routes/` pour routes taxi

3. **Migrations SQL** :
   - Chercher migrations dans `backend/migrations/` avec "taxi"
   - Vérifier tables existantes

4. **Écrans Mobile** :
   - `mobile/src/screens/specialized/TaxiSearchScreen.tsx`
   - `mobile/src/screens/specialized/TaxiDetailsScreen.tsx`
   - `mobile/src/screens/specialized/TaxiBookingScreen.tsx`
   - `mobile/src/screens/specialized/TaxiIntelligentSearchScreen.tsx`
   - `mobile/src/screens/specialized/TaxiListScreen.tsx`
   - `mobile/src/screens/specialized/TaxiAvailabilityScreen.tsx`
   - `mobile/src/screens/specialized/TaxiFormScreen.tsx`
   - `mobile/src/screens/specialized/MesTaxisScreen.tsx`

5. **Composants** :
   - `mobile/src/components/specialized/TaxiResultCard.tsx`
   - Autres composants taxi

6. **Documentation** :
   - `RESUME_FINAL_TAXI_COVOITURAGE_100.md`
   - `STATUT_FINAL_MOBILE_TAXI_COVOITURAGE_100.md`
   - `ETAT_ACTUEL_TAXI_COVOITURAGE.md`
   - Tous fichiers mentionnant "taxi"

### B. Inspiration Tickets Bus
Analyser le travail fait sur tickets bus :
1. **Composants** :
   - `mobile/src/components/BusSeatSelector.tsx` - Sélection places
   - Configuration dans `categoryConfig.ts` pour `ticket_voyage`
   - Workflow réservation bus

2. **Fonctionnalités** :
   - Sélection places numérotées
   - Configuration bus (rangées, allées)
   - Réservation avec paiement
   - Gestion disponibilités

### C. Inspiration Covoiturage
Analyser le travail complet sur covoiturage :
1. **Architecture complète** dans :
   - `CE_QUI_MANQUE_LEADER_MONDIAL_COVOITURAGE.md`
   - `RESUME_FINAL_MOBILE_TAXI_COVOITURAGE_100.md`
   - Fichiers covoiturage dans `mobile/src/screens/specialized/`

2. **Fonctionnalités avancées** :
   - Recherche intelligente avec autocomplete GPS
   - Matching intelligent
   - Réservation places
   - Paiement intégré
   - Chat temps réel
   - Suivi GPS
   - Profil conducteur enrichi
   - Reviews/ratings

3. **Services IA** :
   - Vérifier si service IA covoiturage existe
   - S'inspirer pour service IA taxi

## 🎯 PHASE 2 : COMPARAISON AVEC LES LEADERS

Comparer avec :
- **Uber** : Interface, réservation, suivi GPS, paiement, ratings
- **Bolt** : Expérience utilisateur, fonctionnalités
- **Yango** : Spécificités marché africain

**Analyse** :
- Design visuel
- Navigation et fluidité
- Fonctionnalités uniques
- Performance et scalabilité

## 🚀 PHASE 3 : PLAN D'AMÉLIORATION TAXI DE VILLE

### 3.1 Améliorations UX/UI

**Design Moderne** :
- Interface inspirée Uber/Bolt (moderne, épurée, intuitive)
- Animations fluides
- Feedback visuel immédiat
- Dark mode support

**Navigation Fluide** :
- Recherche intuitive avec autocomplete GPS
- Carte interactive pour sélection départ/arrivée
- Réservation en quelques clics
- Accès naturel aux fonctionnalités

**Expérience Client** :
- Recherche taxi disponible en temps réel
- Estimation prix avant réservation
- Estimation temps d'attente
- Suivi GPS taxi en direct
- Historique trajets
- Favoris adresses

**Expérience Conducteur** :
- Dashboard conducteur clair
- Gestion demandes en temps réel
- Navigation intégrée
- Analytics performance
- Gestion revenus

### 3.2 Fonctionnalités Backend

#### Service IA Taxi (`taxi_ai_service.rs`)
- **Estimation prix intelligent** : Prix selon distance, trafic, demande
- **Optimisation trajet** : Meilleur itinéraire, évitement embouteillages
- **Prédiction demande** : Zones à forte demande, suggestions conducteur
- **Matching intelligent** : Meilleur taxi pour client selon distance, note, type véhicule

#### Endpoints Backend (~15 endpoints)

**Recherche et Disponibilité** :
- `GET /api/taxi/available` - Taxis disponibles (GPS, filtres)
- `GET /api/taxi/estimate-price` - Estimation prix trajet
- `GET /api/taxi/estimate-time` - Estimation temps attente
- `POST /api/taxi/ai/optimize-route` - Optimisation itinéraire IA

**Réservation** :
- `POST /api/taxi/book` - Réserver taxi (JWT)
- `GET /api/taxi/booking/:id` - Détails réservation
- `POST /api/taxi/booking/:id/cancel` - Annuler réservation (JWT)
- `GET /api/taxi/my-rides` - Mes trajets (JWT)

**Suivi** :
- `GET /api/taxi/booking/:id/tracking` - Suivi GPS temps réel
- `POST /api/taxi/booking/:id/update-location` - Mise à jour position (conducteur)

**Conducteur** :
- `GET /api/taxi/driver/requests` - Demandes disponibles (JWT)
- `POST /api/taxi/driver/accept` - Accepter course (JWT)
- `GET /api/taxi/driver/analytics` - Analytics conducteur (JWT)
- `POST /api/taxi/driver/availability` - Changer disponibilité (JWT)

**IA** :
- `POST /api/taxi/ai/price-estimate` - Estimation prix IA
- `POST /api/taxi/ai/demand-prediction` - Prédiction demande IA

#### Migrations SQL

**Créer/Augmenter** fichier migration :
- Format : `backend/migrations/YYYYMMDD_improve_taxi_service.sql`
- Tables à créer/améliorer :
  - `taxi_bookings` - Réservations taxi (si n'existe pas)
  - `taxi_locations` - Positions GPS taxis en temps réel
  - `taxi_analytics` - Analytics trajets
  - `taxi_ratings` - Avis clients/conducteurs
  - Index géospatial pour recherche rapide
  - Index pour performances

**Intégrer dans** `backend/src/migrations/auto_migrate.rs`

**Appliquer sur Render** :
- Database URL : `postgresql://user:password@host:port/database`
- Vérifier application via logs Render

### 3.3 Fonctionnalités Mobile

#### Améliorations Écrans Existants

**TaxiSearchScreen** :
- Autocomplete GPS intelligent (comme covoiturage)
- Carte interactive pour sélection adresses
- Filtres visuels (type véhicule, prix, note)
- Affichage taxis disponibles sur carte

**TaxiBookingScreen** :
- Confirmation réservation claire
- Estimation prix/temps visible
- Bouton annulation facile
- Suivi taxi en direct

**Nouveaux Écrans** :
- `TaxiTrackingScreen.tsx` - Suivi GPS en direct
- `TaxiRideHistoryScreen.tsx` - Historique trajets
- `TaxiDriverDashboardScreen.tsx` - Dashboard conducteur

#### Composants Améliorés

**TaxiResultCard** :
- Affichage note/avis
- Prix estimé
- Temps d'attente
- Type véhicule
- Distance du taxi

**Nouveaux Composants** :
- `TaxiMapView.tsx` - Carte avec taxis disponibles
- `TaxiTrackingMap.tsx` - Suivi GPS en direct
- `TaxiPriceEstimator.tsx` - Estimation prix interactif
- `TaxiDriverCard.tsx` - Card conducteur enrichie

#### Service TypeScript

Améliorer/créer `mobile/src/services/taxiService.ts` avec :
- `searchAvailableTaxis()` - Recherche taxis
- `estimatePrice()` - Estimation prix
- `bookTaxi()` - Réserver
- `trackRide()` - Suivi GPS
- `cancelBooking()` - Annuler
- `rateDriver()` - Noter conducteur

### 3.4 Fonctionnalités Avancées

**Gestion Lieux Autocomplete Intelligent** :
- Autocomplete GPS avancé (comme covoiturage)
- Suggestions adresses fréquentes
- Favoris adresses
- Historique recherches

**Intégrations** :
- Google Maps API (itinéraires, trafic)
- Waze API (trafic temps réel)
- Notifications push temps réel
- SMS fallback (sans internet)

**Paiement** :
- Intégration paiement mobile (MTN Money, Orange Money)
- Paiement carte
- Partage coût trajet

## 🔧 CONTRAINTES TECHNIQUES

### Migrations SQL
1. **Créer/Augmenter fichier** dans `backend/migrations/`
2. **Format** : `YYYYMMDD_improve_taxi_service.sql`
3. **Intégrer dans** `backend/src/migrations/auto_migrate.rs`
4. **Numéroter** : Suivre séquence migrations existantes (0000, etc.)
5. **Appliquer sur Render** :
   - URL complète fournie ci-dessus
   - Vérifier logs Render après application

### Services IA
1. **Utiliser système IA existant** :
   - Utiliser `AppIA` comme dans `hospital_ai_service.rs`
   - Créer prompts spécifiques dans `backend/src/services/ia/prompts/`

2. **Créer service IA** :
   - `backend/src/services/taxi_ai_service.rs`
   - Méthodes : estimation prix, optimisation trajet, prédiction demande, matching

3. **Intégration** :
   - Ajouter dans `backend/src/services/mod.rs`

### Scalabilité

**Millions de transactions/seconde** :
- Cache Redis pour positions GPS taxis
- Index géospatial optimisés (PostGIS)
- WebSocket pour mises à jour temps réel
- Queue système pour demandes
- Scaling horizontal (multi-instances)
- Load balancing

**Optimisations** :
- Cache résultats recherche
- Pagination efficace
- Requêtes optimisées (EXPLAIN)
- Connection pooling

## 🎨 EXPÉRIENCE UTILISATEUR EXCEPTIONNELLE

### Design
- Inspirer Uber/Bolt (moderne, professionnel, intuitif)
- Animations fluides
- Responsive (mobile, tablette)
- Cohérence avec Yukpomnang

### Navigation
- Navigation fluide et intuitive
- Accès naturel aux fonctionnalités
- Retours logiques
- Transitions douces

### Fonctionnalités
- Autocomplete GPS intelligent
- Carte interactive
- Feedback immédiat
- Gestion erreurs gracieuse

### Expérience Client/Prestataire
- Client : Recherche → Réservation → Suivi → Paiement → Avis (fluide)
- Conducteur : Demandes → Acceptation → Navigation → Fin course → Revenus (clair)

## 📊 COMPARAISON AVEC LES GÉANTS

| Aspect | Uber/Bolt | Notre Niveau Actuel | Améliorations Nécessaires |
|--------|-----------|---------------------|---------------------------|
| Design | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Design moderne, animations |
| Navigation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Fluidité, intuitivité |
| Recherche | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Autocomplete GPS avancé |
| Suivi GPS | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Temps réel, carte interactive |
| Paiement | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Intégration mobile money |
| Scalabilité | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Optimisations supplémentaires |

## ✅ VÉRIFICATIONS FINALES

- [ ] Analyse complète existant taxi effectuée
- [ ] Comparaison avec Uber/Bolt effectuée
- [ ] Inspiration tickets bus/covoiturage intégrée
- [ ] Service IA taxi créé avec prompts
- [ ] ~15 endpoints backend créés/améliorés
- [ ] Migrations SQL créées et intégrées
- [ ] Écrans mobile améliorés/créés
- [ ] Composants améliorés/créés
- [ ] Autocomplete GPS intelligent implémenté
- [ ] Navigation intégrée
- [ ] Tests linting passés
- [ ] Scalabilité vérifiée (millions tx/s)
- [ ] Documentation mise à jour

---

**Commence par l'analyse complète de l'existant taxi, puis améliore selon le plan.**

