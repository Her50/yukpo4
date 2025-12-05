# 📋 PLAN D'EXÉCUTION PAR PHASES - TAXI & COVOITURAGE 100%

**Date**: 2025-01-28  
**Objectif**: Atteindre 100% de complétude pour Taxi et Covoiturage

---

## 🎯 PHASE 1: BACKEND - RECHERCHE PUBLIQUE (CRITIQUE)

**Objectif**: Permettre aux utilisateurs de rechercher des taxis et covoiturages

### Endpoints à créer

#### Taxi
1. ✅ `GET /api/taxis/search` - Recherche publique
   - Filtres: zone, disponibilité, prix, type véhicule
   - Tri: distance, prix, disponibilité
   - Pagination

2. ✅ `GET /api/taxis/{id}` - Détails publics
   - Informations complètes
   - Avis/ratings (si disponible)

#### Covoiturage
3. ✅ `GET /api/covoiturages/search` - Recherche publique
   - Filtres: départ, arrivée, date, prix, places
   - Tri: date, prix, distance
   - Pagination

4. ✅ `GET /api/covoiturages/{id}` - Détails publics
   - Informations complètes
   - Passagers (si disponible)

**Fichiers à modifier**:
- `backend/src/controllers/specialized_services_controller.rs` - Ajouter 4 fonctions
- `backend/src/routes/specialized_services_routes.rs` - Ajouter 4 routes

**Estimation**: ~600 lignes, 1-2h

---

## 🎯 PHASE 2: BACKEND - RÉSERVATION

**Objectif**: Permettre la réservation/appel de taxis et places de covoiturage

### Endpoints à créer

#### Taxi
5. ✅ `POST /api/taxis/{id}/book` - Réservation/Appel
   - Point départ/arrivée
   - Calcul prix estimé
   - Contact chauffeur
   - Création réservation

6. ✅ `POST /api/taxis/{id}/update-availability` - Mise à jour disponibilité (prestataire)

#### Covoiturage
7. ✅ `POST /api/covoiturages/{id}/book` - Réservation place
   - Nombre de places
   - Paiement
   - Création réservation
   - Mise à jour places disponibles

8. ✅ `GET /api/covoiturages/my-trips` - Mes trajets (conducteur)

**Fichiers à modifier**:
- `backend/src/controllers/specialized_services_controller.rs` - Ajouter 4 fonctions
- `backend/src/routes/specialized_services_routes.rs` - Ajouter 4 routes

**Estimation**: ~600 lignes, 1-2h

---

## 🎯 PHASE 3: MOBILE - RECHERCHE ET LISTE

**Objectif**: Écrans de recherche et liste pour mobile

### Écrans à créer

#### Taxi
1. ✅ `TaxiSearchScreen.tsx` - Recherche avec carte
   - Champs: zone, disponibilité
   - Filtres: prix, type véhicule
   - Carte avec taxis proches

2. ✅ `TaxiListScreen.tsx` - Liste résultats
   - Affichage liste/grid
   - Informations détaillées
   - Appel direct

3. ✅ `TaxiDetailsScreen.tsx` - Détails d'un taxi
   - Informations complètes
   - Avis/ratings
   - Bouton appel/réservation

#### Covoiturage
4. ✅ `CovoiturageSearchScreen.tsx` - Recherche trajets
   - Champs: départ, arrivée, date
   - Filtres: prix, places

5. ✅ `CovoiturageListScreen.tsx` - Liste résultats
   - Affichage liste/grid
   - Informations détaillées

6. ✅ `CovoiturageDetailsScreen.tsx` - Détails d'un trajet
   - Informations complètes
   - Passagers
   - Bouton réservation

**Fichiers à modifier**:
- `mobile/src/navigation/AppNavigator.tsx` - Ajouter 6 routes

**Estimation**: ~1800 lignes, 2-3h

---

## 🎯 PHASE 4: MOBILE - RÉSERVATION ET GESTION

**Objectif**: Écrans de réservation et gestion pour mobile

### Écrans à créer

#### Taxi
7. ✅ `TaxiBookingScreen.tsx` - Réservation/Appel taxi
   - Sélection point départ/arrivée
   - Calcul prix
   - Appel/Contact chauffeur
   - Suivi trajet

8. ✅ `MesTaxisScreen.tsx` - Gestion (prestataire)
   - Liste des taxis enregistrés
   - Gestion disponibilité
   - Statistiques

#### Covoiturage
9. ✅ `CovoiturageBookingScreen.tsx` - Réservation place
   - Sélection nombre de places
   - Paiement
   - Contact conducteur

10. ✅ `MesTrajetsCovoiturageScreen.tsx` - Gestion (conducteur)
    - Liste des trajets créés
    - Gestion passagers
    - Confirmations

**Fichiers à modifier**:
- `mobile/src/navigation/AppNavigator.tsx` - Ajouter 4 routes

**Estimation**: ~1200 lignes, 2h

---

## 🎯 PHASE 5: FRONTEND - RECHERCHE ET LISTE

**Objectif**: Pages de recherche et liste pour frontend web

### Pages à créer

#### Taxi
1. ✅ `TaxiSearchPage.tsx` - Recherche
2. ✅ `TaxiListPage.tsx` - Liste résultats
3. ✅ `TaxiDetailsPage.tsx` - Détails

#### Covoiturage
4. ✅ `CovoiturageSearchPage.tsx` - Recherche
5. ✅ `CovoiturageListPage.tsx` - Liste résultats
6. ✅ `CovoiturageDetailsPage.tsx` - Détails

**Fichiers à modifier**:
- `frontend/src/routes/AppRoutesRegistry.ts` - Ajouter 6 routes
- `frontend/src/App.tsx` - Ajouter 6 routes

**Estimation**: ~1500 lignes, 2h

---

## 🎯 PHASE 6: FRONTEND - RÉSERVATION ET GESTION

**Objectif**: Pages de réservation et gestion pour frontend web

### Pages à créer

#### Taxi
7. ✅ `TaxiBookingPage.tsx` - Réservation
8. ✅ `MesTaxisPage.tsx` - Gestion (prestataire)

#### Covoiturage
9. ✅ `CovoiturageBookingPage.tsx` - Réservation
10. ✅ `MesTrajetsCovoituragePage.tsx` - Gestion (conducteur)

**Fichiers à modifier**:
- `frontend/src/routes/AppRoutesRegistry.ts` - Ajouter 4 routes
- `frontend/src/App.tsx` - Ajouter 4 routes

**Estimation**: ~1000 lignes, 1-2h

---

## 🎯 PHASE 7: MIGRATIONS ET VÉRIFICATIONS

**Objectif**: S'assurer que toutes les migrations sont appliquées

### Actions

1. ✅ Vérifier toutes les migrations dans `backend/migrations/`
2. ✅ Vérifier que `auto_migrate.rs` inclut toutes les migrations
3. ✅ Appliquer les migrations à la base Render
4. ✅ Tests de compilation backend
5. ✅ Tests de compilation mobile
6. ✅ Tests de compilation frontend

**Estimation**: 1h

---

## 📊 RÉCAPITULATIF PAR PHASE

| Phase | Description | Lignes | Temps | Priorité |
|-------|-------------|--------|-------|----------|
| **Phase 1** | Backend - Recherche | ~600 | 1-2h | 🔴 CRITIQUE |
| **Phase 2** | Backend - Réservation | ~600 | 1-2h | 🔴 CRITIQUE |
| **Phase 3** | Mobile - Recherche/Liste | ~1800 | 2-3h | 🟡 HAUTE |
| **Phase 4** | Mobile - Réservation/Gestion | ~1200 | 2h | 🟡 HAUTE |
| **Phase 5** | Frontend - Recherche/Liste | ~1500 | 2h | 🟡 HAUTE |
| **Phase 6** | Frontend - Réservation/Gestion | ~1000 | 1-2h | 🟢 MOYENNE |
| **Phase 7** | Migrations & Vérifications | - | 1h | 🔴 CRITIQUE |
| **TOTAL** | **100% Complétude** | **~6700** | **10-13h** | ✅ |

---

## ✅ CHECKLIST FINALE

### Backend
- [ ] Phase 1: 4 endpoints recherche
- [ ] Phase 2: 4 endpoints réservation

### Mobile
- [ ] Phase 3: 6 écrans recherche/liste
- [ ] Phase 4: 4 écrans réservation/gestion
- [ ] Routes navigation (10 routes)

### Frontend
- [ ] Phase 5: 6 pages recherche/liste
- [ ] Phase 6: 4 pages réservation/gestion
- [ ] Routes navigation (10 routes)

### Migrations
- [ ] Phase 7: Vérifications et application

---

**Commençons par la Phase 1 (Backend - Recherche)** 🚀

