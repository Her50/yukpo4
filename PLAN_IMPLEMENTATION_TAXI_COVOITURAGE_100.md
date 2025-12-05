# 📋 PLAN D'IMPLÉMENTATION - TAXI & COVOITURAGE 100%

**Date**: 2025-01-28  
**Objectif**: Atteindre 100% de complétude pour Taxi et Covoiturage

---

## 🎯 ÉTAT ACTUEL

### ✅ Disponible (40%)
- ✅ Formulaire création Taxi (Mobile + Frontend)
- ✅ Formulaire création Covoiturage (Mobile + Frontend)
- ✅ Backend: Endpoints création/liste basiques

### ❌ Manquant (60%)
- ❌ Recherche et filtres
- ❌ Réservation/Appel
- ❌ Détails service
- ❌ Gestion (prestataires)

---

## 📋 PLAN D'IMPLÉMENTATION

### Phase 1: Backend - Endpoints Recherche et Réservation

#### Taxi
1. **GET /api/taxis/search** - Recherche taxis disponibles
   - Filtres: zone, disponibilité, prix, type véhicule
   - Tri: distance, prix, disponibilité
   
2. **GET /api/taxis/{id}** - Détails d'un taxi
   - Informations complètes
   - Avis/ratings
   
3. **POST /api/taxis/{id}/book** - Réservation/Appel taxi
   - Point départ/arrivée
   - Calcul prix estimé
   - Contact chauffeur

4. **POST /api/taxis/{id}/update-availability** - Mise à jour disponibilité (prestataire)

#### Covoiturage
1. **GET /api/covoiturages/search** - Recherche trajets
   - Filtres: départ, arrivée, date, prix, places
   
2. **GET /api/covoiturages/{id}** - Détails d'un trajet
   - Informations complètes
   - Passagers
   
3. **POST /api/covoiturages/{id}/book** - Réservation place
   - Nombre de places
   - Paiement
   
4. **GET /api/covoiturages/my-trips** - Mes trajets (conducteur)

### Phase 2: Mobile - Écrans Recherche et Réservation

#### Taxi (5 écrans)
1. `TaxiSearchScreen.tsx` - Recherche avec carte
2. `TaxiListScreen.tsx` - Liste résultats
3. `TaxiDetailsScreen.tsx` - Détails taxi
4. `TaxiBookingScreen.tsx` - Réservation/Appel
5. `MesTaxisScreen.tsx` - Gestion (prestataire)

#### Covoiturage (5 écrans)
1. `CovoiturageSearchScreen.tsx` - Recherche trajets
2. `CovoiturageListScreen.tsx` - Liste résultats
3. `CovoiturageDetailsScreen.tsx` - Détails trajet
4. `CovoiturageBookingScreen.tsx` - Réservation place
5. `MesTrajetsCovoiturageScreen.tsx` - Gestion (conducteur)

### Phase 3: Frontend - Pages Recherche et Réservation

#### Taxi (5 pages)
1. `TaxiSearchPage.tsx`
2. `TaxiListPage.tsx`
3. `TaxiDetailsPage.tsx`
4. `TaxiBookingPage.tsx`
5. `MesTaxisPage.tsx`

#### Covoiturage (5 pages)
1. `CovoiturageSearchPage.tsx`
2. `CovoiturageListPage.tsx`
3. `CovoiturageDetailsPage.tsx`
4. `CovoiturageBookingPage.tsx`
5. `MesTrajetsCovoituragePage.tsx`

### Phase 4: Routes et Navigation

#### Mobile
- Ajouter 10 routes dans `AppNavigator.tsx`

#### Frontend
- Ajouter 10 routes dans `AppRoutesRegistry.ts` et `App.tsx`

---

## 🔄 MIGRATIONS

### Vérification
1. ✅ Tables `taxis_ville` et `covoiturages` existent dans `0000_create_all_tables.sql`
2. ✅ Vérifier `auto_migrate.rs` pour migrations automatiques
3. ⚠️ Appliquer toutes les migrations à la base Render

---

## 📊 ESTIMATION

- **Backend**: ~6 endpoints (~800 lignes)
- **Mobile**: ~10 écrans (~2500 lignes)
- **Frontend**: ~10 pages (~2000 lignes)
- **Routes**: ~20 routes à configurer

**Total**: ~5300 lignes de code

---

## ✅ CHECKLIST

### Backend
- [ ] Endpoint recherche taxi
- [ ] Endpoint recherche covoiturage
- [ ] Endpoint détails taxi
- [ ] Endpoint détails covoiturage
- [ ] Endpoint réservation taxi
- [ ] Endpoint réservation covoiturage

### Mobile
- [ ] 5 écrans Taxi
- [ ] 5 écrans Covoiturage
- [ ] Routes navigation

### Frontend
- [ ] 5 pages Taxi
- [ ] 5 pages Covoiturage
- [ ] Routes navigation

### Migrations
- [ ] Vérifier toutes les migrations
- [ ] Appliquer à la base Render

---

**Commençons l'implémentation !** 🚀

