# 📋 Distinction Écrans Partenaires vs Utilisateurs

## 🎯 Vue d'ensemble

Cette documentation clarifie la distinction entre les écrans accessibles aux **PARTENAIRES** (créateurs de services) et ceux accessibles aux **UTILISATEURS FINAUX** (via HomeScreen).

---

## 👥 ÉCRANS UTILISATEURS (Accessibles depuis HomeScreen)

Ces écrans sont accessibles depuis le `HomeScreen` via `YukpoServicesQuickAccess` et sont destinés aux utilisateurs finaux pour **rechercher, consulter et utiliser** les services.

### 🏠 Écrans Home (Recherche moderne)
- ✅ `ImmobilierHomeScreen.tsx` → Route: `ImmobilierSearch`
- ✅ `TicketVoyageHomeScreen.tsx` → Route: `BusTicketSearch`
- ✅ `PharmacieHomeScreen.tsx` → Route: `PharmacieSearch`
- ✅ `LaboratoireHomeScreen.tsx` → Route: `LaboratoireSearch`
- ✅ `HopitalHomeScreen.tsx` → Route: `HopitalSearch`
- ✅ `LivreScolaireHomeScreen.tsx` → Route: `LivreScolaireSearch`
- ✅ `OffresEmploiHomeScreen.tsx` → Route: `OffresEmploiHub`
- ✅ `OrientationScolaireHomeScreen.tsx` → Route: `OrientationScolaireHub`
- ✅ `CovoiturageHomeScreen.tsx` → Route: `CovoiturageSearch`
- ✅ `TaxiHomeScreen.tsx` → Route: `TaxiSearch`
- ✅ `SupermarketHomeScreen.tsx` → Route: `BayamSelamSearch`

### 📋 Écrans List (Résultats de recherche)
- ✅ `ImmobilierListScreen.tsx` → Route: `ImmobilierList`
- ✅ `PharmacieListScreen.tsx` → Route: `PharmacieList`
- ✅ `LaboratoireListScreen.tsx` → Route: `LaboratoireList`
- ✅ `HopitalListScreen.tsx` → Route: `HopitalList`
- ✅ `CovoiturageListScreen.tsx` → Route: `CovoiturageList`
- ✅ `TaxiListScreen.tsx` → Route: `TaxiList`
- ✅ `AgenceVoyageListScreen.tsx` → Route: `AgenceVoyageList`
- ✅ `LivreScolaireListScreen.tsx` → Route: `LivreScolaireList`
- ✅ `BanqueSangListScreen.tsx` → Route: `BanqueSangList`

### 🔍 Écrans Details (Détails d'un service)
- ✅ `ImmobilierDetailsScreen.tsx` → Route: `ImmobilierDetails`
- ✅ `PharmacieDetailsScreen.tsx` → Route: `PharmacieDetails`
- ✅ `LaboratoireDetailsScreen.tsx` → Route: `LaboratoireDetails`
- ✅ `HopitalDetailsScreen.tsx` → Route: `HopitalDetails`
- ✅ `CovoiturageDetailsScreen.tsx` → Route: `CovoiturageDetails`
- ✅ `TaxiDetailsScreen.tsx` → Route: `TaxiDetails`
- ✅ `AgenceVoyageDetailsScreen.tsx` → Route: `AgenceVoyageDetails`
- ✅ `LivreScolaireDetailsScreen.tsx` → Route: `LivreScolaireDetails`
- ✅ `BanqueSangDetailsScreen.tsx` → Route: `BanqueSangDetails`

### 📱 Écrans Booking/Réservation (Actions utilisateurs)
- ✅ `ImmobilierBookingScreen.tsx` → Route: `ImmobilierBooking`
- ✅ `BusTicketBookingScreen.tsx` → Route: `BusTicketBooking`
- ✅ `CovoiturageBookingScreen.tsx` → Route: `CovoiturageBooking`
- ✅ `TaxiBookingScreen.tsx` → Route: `TaxiBooking`

### 📊 Écrans Utilisateur (Mes réservations, favoris, etc.)
- ✅ `MyFavoritesScreen.tsx` → Route: `MyFavorites`
- ✅ `MesReservationsScreen.tsx` → Route: `MesReservations`
- ✅ `MesReservationsCovoiturageScreen.tsx` → Route: `MesReservationsCovoiturage`
- ✅ `MyTripsScreen.tsx` → Route: `MyTrips`
- ✅ `MesTaxisScreen.tsx` → Route: `MesTaxis`
- ✅ `MyBloodDonationsScreen.tsx` → Route: `MyBloodDonations`
- ✅ `MyPharmacyOrdersScreen.tsx` → Route: `MyPharmacyOrders`
- ✅ `MyLabExaminationsScreen.tsx` → Route: `MyLabExaminations`
- ✅ `MyConsultationsScreen.tsx` → Route: `MyConsultations`

---

## 🏢 ÉCRANS PARTENAIRES (Accessibles depuis MesServices/Dashboard)

Ces écrans sont accessibles uniquement depuis le dashboard partenaire (`MesServicesScreen` ou `ServicesScreen`) et sont destinés aux **partenaires pour créer et gérer** leurs services.

### 📝 Écrans Form (Création/Modification de services)
- 🔒 `PharmacieFormScreen.tsx` → Route: `PharmacieForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `HopitalFormScreen.tsx` → Route: `HopitalForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `LaboratoireFormScreen.tsx` → Route: `LaboratoireForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `BanqueSangFormScreen.tsx` → Route: `BanqueSangForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `AgenceVoyageFormScreen.tsx` → Route: `AgenceVoyageForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `CovoiturageFormScreen.tsx` → Route: `CovoiturageForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `TaxiFormScreen.tsx` → Route: `TaxiForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `ImmobilierFormScreen.tsx` → Route: `ImmobilierForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `LivreScolaireFormScreen.tsx` → Route: `LivreScolaireForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `OffresEmploiFormScreen.tsx` → Route: `OffresEmploiForm` (PARTENAIRE UNIQUEMENT)
- 🔒 `CreateServiceScreen.tsx` → Route: `CreateService` (PARTENAIRE UNIQUEMENT)

### 📊 Écrans Dashboard/Gestion (Gestion des services)
- 🔒 `MesServicesScreen.tsx` → Route: `MesServices` (PARTENAIRE UNIQUEMENT)
- 🔒 `ServicesScreen.tsx` → Route: `Services` (PARTENAIRE UNIQUEMENT)
- 🔒 `ServicesDashboard.tsx` → Route: `ServicesDashboard` (PARTENAIRE UNIQUEMENT)
- 🔒 `GestionServicesSpecialisesScreen.tsx` → Route: `GestionServicesSpecialises` (PARTENAIRE UNIQUEMENT)

### 📈 Écrans Analytics (Statistiques partenaires)
- 🔒 `PharmacyAnalyticsScreen.tsx` → Route: `PharmacyAnalytics` (PARTENAIRE UNIQUEMENT)
- 🔒 `LabAnalyticsScreen.tsx` → Route: `LabAnalytics` (PARTENAIRE UNIQUEMENT)
- 🔒 `HospitalAnalyticsScreen.tsx` → Route: `HospitalAnalytics` (PARTENAIRE UNIQUEMENT)
- 🔒 `ImmobilierPriceAlertsScreen.tsx` → Route: `ImmobilierPriceAlerts` (PARTENAIRE UNIQUEMENT)

### 📋 Écrans Gestion Réservations (Gestion des réservations reçues)
- 🔒 `PrestataireReservationsScreen.tsx` → Route: `PrestataireReservations` (PARTENAIRE UNIQUEMENT)
- 🔒 `BusReturnRequestsScreen.tsx` → Route: `BusReturnRequests` (PARTENAIRE UNIQUEMENT)
- 🔒 `BusReturnRequestFormScreen.tsx` → Route: `BusReturnRequestForm` (PARTENAIRE UNIQUEMENT)

---

## 🚫 RÈGLES DE NAVIGATION

### ✅ HomeScreen → Uniquement écrans UTILISATEURS
Le `HomeScreen.tsx` via `YukpoServicesQuickAccess` doit **UNIQUEMENT** rediriger vers :
- Les écrans `*HomeScreen` (recherche moderne)
- Les écrans `*SearchScreen` (recherche avancée - legacy)
- **JAMAIS** vers les écrans `*FormScreen` ou `*Dashboard`

### ✅ MesServices → Uniquement écrans PARTENAIRES
Le `MesServicesScreen.tsx` doit **UNIQUEMENT** rediriger vers :
- Les écrans `*FormScreen` (création/modification)
- Les écrans `*Dashboard` (gestion)
- Les écrans `*Analytics` (statistiques)
- **JAMAIS** vers les écrans `*HomeScreen` ou `*SearchScreen` utilisateurs

---

## 📝 MAPPING ACTUEL HomeScreen → Routes

```typescript
// ✅ CORRECT - Uniquement écrans utilisateurs
const searchRoutes: Record<string, string> = {
    // Services Santé
    'pharmacie': 'PharmacieSearch',        // ✅ Utilisateur
    'hopital': 'HopitalSearch',            // ✅ Utilisateur
    'laboratoire': 'LaboratoireSearch',    // ✅ Utilisateur
    'banque_sang': 'BanqueSangSearch',     // ✅ Utilisateur
    
    // Services Transport
    'agence_voyage': 'BusTicketSearch',    // ✅ Utilisateur
    'covoiturage': 'CovoiturageSearch',    // ✅ Utilisateur
    'taxi': 'TaxiSearch',                  // ✅ Utilisateur
    
    // Services Éducation
    'orientation_scolaire': 'EtablissementSearch', // ✅ Utilisateur
    'bourse_livre': 'EtablissementSearch',        // ✅ Utilisateur (à vérifier)
    
    // Services Emploi
    'offres_emploi': 'OffresEmploiHub',    // ✅ Utilisateur
    
    // Services Vie quotidienne
    'menu_planning': 'MenuPlanningHub',    // ✅ Utilisateur
    'bayamselam': 'BayamSelamSearch',      // ✅ Utilisateur
    
    // Services Immobilier
    'immo': 'ImmobilierSearch',           // ✅ Utilisateur
};
```

---

## ⚠️ À VÉRIFIER

1. ✅ `bourse_livre` redirige vers `LivreScolaireSearch` → **CORRIGÉ**
2. ✅ `orientation_scolaire` redirige vers `OrientationScolaireHub` → **CORRIGÉ**
3. ✅ Tous les écrans `*FormScreen` sont bien protégés et non accessibles depuis HomeScreen
4. ✅ Les écrans `*HomeScreen` sont bien les écrans modernes de recherche utilisateur
5. ✅ Les écrans `*SearchScreen` (legacy) sont conservés pour compatibilité mais redirigent vers `*HomeScreen`

---

## 🔐 SÉCURITÉ

- Les écrans partenaires doivent vérifier que l'utilisateur est authentifié
- Les écrans partenaires doivent vérifier que l'utilisateur a les permissions nécessaires
- Les écrans partenaires ne doivent pas être accessibles depuis la navigation publique
- Le `HomeScreen.tsx` ne doit **JAMAIS** rediriger vers des routes contenant `Form`, `Create`, `Manage`, `Dashboard`, `Analytics`

---

## 📝 CONVENTIONS DE NOMMAGE

### Écrans Utilisateurs
- `*HomeScreen.tsx` → Écran de recherche moderne (route: `*Search`)
- `*ListScreen.tsx` → Liste de résultats (route: `*List`)
- `*DetailsScreen.tsx` → Détails d'un service (route: `*Details`)
- `*BookingScreen.tsx` → Réservation (route: `*Booking`)

### Écrans Partenaires
- `*FormScreen.tsx` → Création/Modification (route: `*Form`)
- `*Dashboard.tsx` → Dashboard partenaire (route: `*Dashboard`)
- `*AnalyticsScreen.tsx` → Statistiques (route: `*Analytics`)
- `Gestion*Screen.tsx` → Gestion (route: `Gestion*`)

---

## 📅 Dernière mise à jour

2025-01-XX - Création du document de clarification et correction des routes HomeScreen

