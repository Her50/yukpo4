# AUDIT COMPLET — Services Spécialisés Yukpo

**Date**: 5 mars 2026  
**Portée**: Backend (routes, controllers, services, IA) + Mobile (écrans prestataires, écrans utilisateurs, navigation, UX)

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble & Architecture](#1-vue-densemble)
2. [Problèmes transversaux critiques](#2-problemes-transversaux)
3. [Audit par service spécialisé (20 services)](#3-audit-par-service)
4. [Audit IA — Pourquoi les résultats ne s'affichent pas](#4-audit-ia)
5. [Audit navigation prestataire après connexion](#5-navigation-prestataire)
6. [Audit "Mon compte" — Accès à supprimer](#6-mon-compte)
7. [Audit UX côté utilisateur (HomeScreen)](#7-ux-utilisateur)
8. [Plan d'action prioritaire](#8-plan-action)

---

## 1. VUE D'ENSEMBLE

### 1.1 Types de partenaires (enum `delivery_partner_type`)

| # | Type enum | Écran partenaire après login | Écran utilisateur (HomeScreen) | Backend routes |
|---|-----------|------------------------------|-------------------------------|----------------|
| 1 | `pharmacie` | `PharmacieForm` → via GestionServicesSpecialises | `PharmacieSearch` → PharmacieHomeScreen | ✅ ~15 endpoints |
| 2 | `hopital` | `HopitalForm` → via GestionServicesSpecialises | `HopitalSearch` → HopitalHomeScreen | ✅ ~18 endpoints |
| 3 | `laboratoire` | `LaboratoireForm` → via GestionServicesSpecialises | `LaboratoireSearch` → LaboratoireHomeScreen | ✅ ~14 endpoints |
| 4 | `agence de voyage` | `AgenceVoyageForm` → via GestionServicesSpecialises | `BusTicketSearch` → TicketVoyageHomeScreen | ✅ ~20 endpoints |
| 5 | `banquesang` | `BanqueSangForm` → via GestionServicesSpecialises | `BanqueSangSearch` | ✅ ~10 endpoints |
| 6 | `chauffeur` (taxi) | `TaxiForm` → via useDeepLinkRedirect | `TaxiSearch` → TaxiHomeScreen | ✅ ~15 endpoints |
| 7 | `hotel` | `ImmobilierForm` ❌ MAUVAIS | `HotelSearch` → ImmobilierHomeScreen | ✅ 16 endpoints (hotel_room_management) |
| 8 | `meuble` | `ImmobilierForm` ❌ MAUVAIS | `MeubleSearch` → ImmobilierHomeScreen | ✅ Partagé avec immobilier |
| 9 | `supermarche` | `SupermarketHome` | `BayamSelamSearch` | ❌ Pas de backend spécifique |
| 10 | `livraison` | `MesServicesSpecialises` (générique) | N/A | Via delivery_routes |
| 11 | `livraison_courses_marche` | `MesServicesSpecialises` (générique) | N/A | Via delivery_routes |
| 12 | `demenagement` | `MesServicesSpecialises` (générique) | N/A | ✅ 3 endpoints |
| 13 | `transport` | `MesServicesSpecialises` (générique) | N/A | Minimal |
| 14 | `assureur` | `MesServicesSpecialises` (générique) | `InsuranceServicesSearch` | ❌ Pas de backend spécifique |
| 15 | `telecom` | `MesServicesSpecialises` (générique) | N/A | ❌ Aucun backend |
| 16 | `etablissementscolaire` | `MesServicesSpecialises` (générique) | `OrientationScolaireHub` | ✅ orientation_scolaire_controller |
| 17 | `immobilier` (enum DB) | N/A | `ImmobilierSearch` | ✅ ~20 endpoints |
| 18 | `restaurant` (enum DB) | N/A | N/A | ❌ Aucun backend |
| 19 | `taxi` (enum DB) | Via chauffeur | Via `TaxiSearch` | ✅ ~15 endpoints |
| 20 | `covoiturage` (enum DB) | Via GestionServicesSpecialises | `CovoiturageSearch` | ✅ ~10 endpoints |

### 1.2 Écrans spécialisés existants (48 fichiers dans `mobile/src/screens/specialized/`)

**Écrans prestataires (formulaires/gestion)** : PharmacieForm, HopitalForm, LaboratoireForm, AgenceVoyageForm, BanqueSangForm, CovoiturageForm, TaxiForm, ImmobilierForm, LivreScolaireForm, OffresEmploiForm, SupermarketHome, GestionServicesSpecialises, ServicesDashboard, MesReservations, PrestataireReservations, SlotManagement, etc.

**Écrans utilisateurs (recherche/détails)** : PharmacieHome/Search/List/Details, HopitalHome/Search/List/Details, LaboratoireHome/Search/List/Details, ImmobilierHome/Search/List/Details, CovoiturageHome/Search/List/Details, TaxiHome/Search/List/Details, AgenceVoyageSearch/List/Details, BanqueSangSearch/List/Details, BusTicket*, LivreScolaire*, SupermarketHome, etc.

**Écrans IA** : HospitalAIRecommendations, PharmacyAIInteractions, LabAIAnalysis, HospitalAnalytics, PharmacyAnalytics, LabAnalytics

---

## 2. PROBLÈMES TRANSVERSAUX CRITIQUES

### 🔴 CRITIQUE 1 : GestionServicesSpecialisesScreen ne gère que 6 types

**Fichier**: `mobile/src/screens/specialized/GestionServicesSpecialisesScreen.tsx`

Le type `SpecializedService` est limité à :
```typescript
type: 'pharmacie' | 'hopital' | 'laboratoire' | 'agence_voyage' | 'covoiturage' | 'taxi'
```

**Types MANQUANTS** : hotel, meuble, supermarche, banquesang, livraison, demenagement, assureur, telecom, etablissementscolaire, livraison_courses_marche, transport, immobilier, restaurant.

**Impact** : Un prestataire hôtel/meublé/supermarché qui arrive sur GestionServicesSpecialises voit un écran vide car ses services ne sont pas chargés par l'endpoint `/api/specialized-services/user` ou ne sont pas mappés dans le type local.

### 🔴 CRITIQUE 2 : Hôtel/Meublé redirigé vers ImmobilierForm (formulaire de création de bien simple)

**Fichier**: `mobile/src/hooks/useDeepLinkRedirect.ts` lignes 45-46
```typescript
'hotel': 'ImmobilierForm',
'meuble': 'ImmobilierForm',
```

L'écran `ImmobilierForm` est un **formulaire de création de bien immobilier simple** (maison, appartement, terrain, bureau, local commercial, hotel, meuble). Il ne fournit AUCUNE fonctionnalité de gestion hôtelière :
- ❌ Pas de gestion des chambres/unités
- ❌ Pas de calendrier de réservations
- ❌ Pas de check-in/check-out
- ❌ Pas de QR code client
- ❌ Pas de tarification dynamique IA
- ❌ Pas de blockages manuels
- ❌ Pas d'analytics

**Pourtant le backend a 16 endpoints hôtel complets** (`hotel_room_management_routes.rs`) qui ne sont JAMAIS appelés depuis le mobile !

### 🔴 CRITIQUE 3 : Réponses IA ne s'affichent pas — Problème de format `response.data`

**Pattern récurrent dans tous les écrans IA** :
```typescript
// Mobile attend :
response.data.recommendation  // ou response.data.interaction, response.data.analysis

// Backend retourne :
{ success: true, data: { recommendations: [...] } }
// ou
{ success: true, triage: { ... } }
// ou  
{ success: true, interaction: { ... } }
```

**Problème** : `apiPost<T>()` wrappe la réponse → `response.data` contient l'objet backend complet. Donc :
- `response.data.recommendation` → `response.data.data.recommendation` (le champ est dans `data.data`)
- Certains endpoints retournent `triage` au lieu de `data` → le mobile cherche `data.triage` mais reçoit `data.data.triage` (double wrap)

**Impact** : Les écrans IA (HospitalAIRecommendations, PharmacyAIInteractions, LabAIAnalysis) montrent un spinner puis rien, ou affichent "Erreur" car le parsing échoue silencieusement.

### 🔴 CRITIQUE 4 : Beaucoup d'écrans existent mais ne sont PAS ACCESSIBLES

Écrans qui existent dans le code mais n'ont aucun chemin de navigation visible :
- `HospitalAnalyticsScreen` — Pas de bouton dans HopitalForm
- `LabAnalyticsScreen` — Pas de bouton dans LaboratoireForm
- `PharmacyAnalyticsScreen` — Pas de bouton dans PharmacieForm
- `SlotManagementScreen` — Existe mais pas de lien depuis les formulaires
- `BookAppointmentScreen` — Existe mais pas de lien
- `ServiceDetailScreen` — Existe mais pas de lien
- `ReservationScreen` — Existe mais pas de lien clair
- `BloodDonationMatchesScreen` — Existe mais pas navigable
- `MyConsultationsScreen` — Pas de lien clair depuis HopitalForm
- `MyLabExaminationsScreen` — Pas de lien clair depuis LaboratoireForm
- `MyPharmacyOrdersScreen` — Pas de lien clair depuis PharmacieForm

### 🟠 IMPORTANT 5 : "Mon compte" donne accès aux services spécialisés

**Fichier**: `mobile/src/screens/ProfileScreen.tsx` lignes 317-324
```typescript
...(user?.role === 'partenaire' ? [{
    title: 'Mes Services Spécialisés',
    icon: 'layout-grid',
    color: '#6366F1',
    route: 'SpecializedServicesHub',
    description: 'Gérer vos services de santé et transport'
}] : []),
```

**À supprimer** selon la demande : cet accès via "Mon compte" doit être retiré.

### 🟠 IMPORTANT 6 : `SpecializedServicesHubScreen` redirige vers les Form (pas les Home)

**Fichier**: `mobile/src/screens/SpecializedServicesHubScreen.tsx`

Chaque type de service dans ce hub redirige vers le **formulaire de création** (ex: `PharmacieForm`, `HopitalForm`) au lieu du **dashboard de gestion**. Pour un prestataire qui a DÉJÀ des services, cliquer devrait montrer son dashboard, pas un formulaire vierge.

---

## 3. AUDIT PAR SERVICE SPÉCIALISÉ

---

### 3.1 🏥 PHARMACIE

**Backend** : ✅ Complet
- CRUD pharmacie, produits, recherche, commandes, interactions médicamenteuses IA, dosage IA, analytics, garde
- Controllers : `pharmacy_controller`, `pharmacy_product_controller`, `specialized_services_controller`
- ~15 endpoints actifs

**Mobile Prestataire** :
- `PharmacieFormScreen` — Formulaire création/édition ✅
- **MANQUANT** : Pas de dashboard prestataire pharmacie (analytics, stock, commandes reçues, gestion garde)
- `PharmacyAnalyticsScreen` existe mais **n'est pas accessible** depuis PharmacieForm
- `SlotManagementScreen` existe mais pas lié
- `MyPharmacyOrdersScreen` existe côté utilisateur mais le prestataire n'a pas d'écran "Commandes reçues"

**Mobile Utilisateur** :
- `PharmacieHomeScreen` → `PharmacieSearchScreen` → `PharmacieListScreen` → `PharmacieDetailsScreen` ✅
- `PharmacyAIInteractionsScreen` ✅ (mais réponse IA potentiellement cassée — voir §4)

**Problèmes** :
1. ❌ Le prestataire ne voit QUE le formulaire, pas de tableau de bord
2. ❌ Pas d'écran "Commandes reçues" côté prestataire
3. ❌ Pas de gestion de garde depuis l'app (toggle is_on_duty_now)
4. ❌ PharmacyAnalytics inaccessible
5. ⚠️ Réponse IA interactions — format potentiellement incorrect

---

### 3.2 🏥 HÔPITAL

**Backend** : ✅ Très complet
- CRUD hôpital, réservation, slots, temps d'attente, urgences, analytics, IA recommandations, IA triage, autocomplete services médicaux
- ~18 endpoints actifs

**Mobile Prestataire** :
- `HopitalFormScreen` — Formulaire création/édition ✅
- **MANQUANT** : Dashboard hôpital (patients en attente, taux d'occupation, gestion slots)
- `HospitalAnalyticsScreen` existe mais **n'est pas accessible**
- `SlotManagementScreen` existe mais pas lié depuis HopitalForm

**Mobile Utilisateur** :
- `HopitalHomeScreen` → `HopitalSearchScreen` → `HopitalListScreen` → `HopitalDetailsScreen` ✅
- `BookAppointmentScreen` ✅ mais lien pas évident
- `HospitalAIRecommendationsScreen` ✅ (résultats IA potentiellement cassés)
- `MyConsultationsScreen` existe mais inaccessible

**Problèmes** :
1. ❌ Le prestataire ne voit QUE le formulaire
2. ❌ Pas de dashboard temps réel (urgences, files d'attente)
3. ❌ HospitalAnalytics inaccessible
4. ❌ Gestion des slots inaccessible
5. ⚠️ `get_hospital_ai_recommendations` retourne `data.data.recommendations` — mobile attend `data.recommendation`

---

### 3.3 🔬 LABORATOIRE

**Backend** : ✅ Complet
- CRUD laboratoire, types d'examens, réservation examen, résultats, analyse IA d'images, analytics, autocomplete
- ~14 endpoints actifs

**Mobile Prestataire** :
- `LaboratoireFormScreen` — Formulaire ✅
- **MANQUANT** : Dashboard laboratoire (examens planifiés, résultats à traiter)
- `LabAnalyticsScreen` existe mais **inaccessible**

**Mobile Utilisateur** :
- `LaboratoireHomeScreen` → `LaboratoireSearchScreen` → `LaboratoireListScreen` → `LaboratoireDetailsScreen` ✅
- `LabAIAnalysisScreen` ✅ (résultats IA potentiellement cassés)
- `MyLabExaminationsScreen` existe mais navigation incertaine

**Problèmes** :
1. ❌ Le prestataire ne voit QUE le formulaire
2. ❌ Pas d'écran "Examens planifiés" / "Résultats à traiter"
3. ❌ LabAnalytics inaccessible
4. ⚠️ IA analyse → `response.data.data.analysis` vs `response.data.analysis`

---

### 3.4 🚌 AGENCE DE VOYAGE

**Backend** : ✅ Très complet
- CRUD agence, tickets bus, réservation, paiement, validation QR, gestion sièges, horaires, retour aller-retour
- ~20 endpoints actifs (bus_ticket_*, agency_schedule_*, bus_return_trip_*, bus_seat_management_*)

**Mobile Prestataire** :
- `AgenceVoyageFormScreen` — Formulaire ✅
- `GestionServicesSpecialises` a les boutons "Gérer les tickets" et "Horaires de départ" ✅
- Bouton "Gérer les tickets" → `AgencyTicketManagement` (existence à vérifier)
- Bouton "Horaires de départ" → `ManageAgencySchedules` (existence à vérifier)

**Mobile Utilisateur** :
- `AgenceVoyageSearchScreen` → `AgenceVoyageListScreen` → `AgenceVoyageDetailsScreen` ✅
- `BusTicketSearchScreen` → `BusTicketBookingScreen` → `BusTicketPaymentScreen` → `BusTicketDetailsScreen` ✅
- `BusReturnRequestFormScreen`, `BusReturnRequestsScreen` ✅
- `TicketVoyageHomeScreen` ✅

**Problèmes** :
1. ⚠️ Les écrans `AgencyTicketManagement` et `ManageAgencySchedules` référencés dans le code — vérifier s'ils existent dans l'AppNavigator
2. ⚠️ Le formulaire de création d'agence est basique comparé aux fonctionnalités backend

---

### 3.5 🩸 BANQUE DE SANG

**Backend** : ✅ Complet
- CRUD banque de sang, stocks, statistiques, matching intelligent donneurs, groupes sanguins, compatibilité
- ~10 endpoints actifs (blood_bank_controller, blood_donation_matching_controller)

**Mobile Prestataire** :
- `BanqueSangFormScreen` — Formulaire ✅
- **MANQUANT** : Dashboard (stocks, demandes urgentes, matching en attente)

**Mobile Utilisateur** :
- `BanqueSangSearchScreen` → `BanqueSangListScreen` → `BanqueSangDetailsScreen` ✅
- `BloodDonationScreen`, `BloodDonationRequestScreen`, `BloodDonationMatchesScreen` ✅
- `MyBloodDonationsScreen` ✅

**Problèmes** :
1. ❌ Le prestataire n'a pas de dashboard de gestion des stocks
2. ❌ Pas de vue des demandes urgentes de sang côté prestataire
3. ❌ Pas de notification push quand un donneur compatible est trouvé

---

### 3.6 🚕 TAXI / CHAUFFEUR

**Backend** : ✅ Très complet
- CRUD taxi, recherche, booking, disponibilité, prix dynamique IA, optimisation routes, recommandations, analytics admin, leadership, prédiction demande, heatmap
- ~15 endpoints + 8 endpoints analytics/IA

**Mobile Prestataire** :
- `TaxiFormScreen` — Formulaire ✅
- `TaxiAvailabilityScreen` — Toggle disponibilité ✅
- `MesTaxisScreen` — Liste des taxis du prestataire ✅
- **MANQUANT** : Dashboard IA (prédiction demande, heatmap, revenus)

**Mobile Utilisateur** :
- `TaxiHomeScreen` → `TaxiSearchScreen` → `TaxiListScreen` → `TaxiDetailsScreen` → `TaxiBookingScreen` → `TaxiTrackingScreen` ✅
- `TaxiIntelligentSearchScreen` ✅

**Problèmes** :
1. ❌ Pas de dashboard chauffeur exploitant les endpoints IA (prédiction, heatmap, revenus)
2. ⚠️ Les endpoints admin analytics ne sont accessibles que par admin, pas par le chauffeur

---

### 3.7 🚗 COVOITURAGE

**Backend** : ✅ Complet
- CRUD covoiturage, recherche, booking, vérification chauffeur, trajets
- ~10 endpoints

**Mobile Prestataire** :
- `CovoiturageFormScreen` — Formulaire ✅
- Géré dans GestionServicesSpecialises ✅

**Mobile Utilisateur** :
- `CovoiturageHomeScreen` → `CovoiturageSearchScreen` → `CovoiturageListScreen` → `CovoiturageDetailsScreen` → `CovoiturageBookingScreen` ✅
- `CovoiturageIntelligentSearchScreen` ✅
- `MesReservationsCovoiturageScreen`, `MyTripsScreen` ✅

**Problèmes** :
1. ⚠️ Pas de dashboard conducteur (revenus, avis, trajets passés)
2. ⚠️ Vérification chauffeur endpoint existe mais pas de flow complet côté mobile

---

### 3.8 🏨 HÔTEL

**Backend** : ✅ Complet (16 endpoints dans `hotel_room_management_routes.rs`)
- Mes propriétés, réservations manuelles, scan QR, QR codes, check-in/check-out, QR invité, blockages manuels, IA tarification, IA insights

**Mobile Prestataire** :
- `ImmobilierForm` ❌ MAUVAIS ÉCRAN — C'est un formulaire de création de bien immobilier simple
- `HotelBookingPaymentScreen` — Existe mais pas lié
- `HotelQRScannerScreen` — Existe mais pas lié

**Mobile Utilisateur** :
- `ImmobilierHomeScreen` avec filtre `type_bien: 'hotel'` ✅ (partage l'écran immobilier)

**Problèmes CRITIQUES** :
1. ❌❌ Le prestataire hôtel est redirigé vers `ImmobilierForm` = un formulaire de CRÉATION de bien simple
2. ❌❌ Les 16 endpoints backend hôtel ne sont JAMAIS appelés depuis le mobile
3. ❌ Pas d'écran de gestion des réservations
4. ❌ Pas de calendrier de disponibilité
5. ❌ Pas de check-in/check-out
6. ❌ Pas de scan QR client
7. ❌ Pas de tarification dynamique IA
8. ❌ `immobilierService.ts` a les fonctions hôtel (17 fonctions) mais aucun écran ne les appelle
9. **BESOIN** : Un écran `HotelDashboardScreen` dédié avec : chambres, réservations, calendrier, check-in/out, QR, analytics IA

---

### 3.9 🛋️ MEUBLÉ

**Backend** : Partagé avec immobilier + certaines fonctions hôtel applicables

**Mobile Prestataire** :
- `ImmobilierForm` ❌ MÊME PROBLÈME QUE HÔTEL
- Pas d'écran dédié meublé

**Mobile Utilisateur** :
- `ImmobilierHomeScreen` avec filtre `type_bien: 'meuble'` ✅

**Problèmes** :
1. ❌ Le prestataire meublé est redirigé vers `ImmobilierForm` simple
2. ❌ Pas de gestion des locations (calendrier, réservations, check-in)
3. **BESOIN** : Un écran `MeubleDashboardScreen` ou réutiliser le dashboard hôtel

---

### 3.10 🛒 SUPERMARCHÉ / BAYAM SELAM

**Backend** : ❌ INCOMPLET
- Pas de controller `supermarket_controller` dans la codebase
- Les services sont basés sur `supermarketService.ts` côté mobile mais les endpoints backend sont incertains

**Mobile Prestataire** :
- `SupermarketHomeScreen` ✅ — Écran le plus complet côté prestataire (sélection, produits, comparaison, promotions)

**Mobile Utilisateur** :
- `BayamSelamSearchScreen` → `BayamSelamResultsScreen` ✅
- `SupermarketHomeScreen` partagé ✅

**Problèmes** :
1. ❌ Backend incomplet — pas de controller supermarché dédié
2. ⚠️ Les données supermarchés viennent probablement de la table `services` générique
3. ⚠️ Pas d'analytics prestataire supermarché

---

### 3.11 🚚 LIVRAISON / COURSES MARCHÉ

**Backend** : ✅ Via `delivery_routes.rs` (massif ~6500 lignes)

**Mobile Prestataire** :
- Redirigé vers `MesServicesSpecialises` (écran générique)
- Pas d'écran dédié

**Problèmes** :
1. ❌ Le prestataire livraison voit un écran sélecteur générique
2. ❌ Pas de dashboard dédié (commandes en cours, revenus, zone de couverture)

---

### 3.12 📦 DÉMÉNAGEMENT

**Backend** : 3 endpoints (quote, book, tracking) dans `specialized_services_routes.rs`

**Mobile** : Redirigé vers `MesServicesSpecialises` (générique)

**Problèmes** :
1. ❌ Pas d'écran dédié prestataire ni utilisateur
2. ❌ Les 3 endpoints ne sont pas exploités côté mobile

---

### 3.13 🛡️ ASSUREUR

**Backend** : ❌ Aucun endpoint spécifique assurance
- L'enum `assureur` existe mais aucun controller

**Mobile** :
- `InsuranceServicesSearchScreen` et `InsuranceServicesResultsScreen` existent ✅
- Prestataire redirigé vers `MesServicesSpecialises`

**Problèmes** :
1. ❌❌ Backend complètement vide pour ce type
2. ❌ Les écrans mobiles existent mais appellent probablement des endpoints inexistants

---

### 3.14 📡 TÉLÉCOM

**Backend** : ❌ Aucun endpoint
**Mobile** : ❌ Aucun écran dédié

**Problèmes** :
1. ❌❌ Type enum existe mais rien n'est implémenté

---

### 3.15 🏫 ÉTABLISSEMENT SCOLAIRE

**Backend** : ✅ `orientation_scolaire_controller` + endpoints

**Mobile** :
- `OrientationScolaireHub` côté utilisateur ✅
- `CreateEtablissementScreen` ✅
- Prestataire redirigé vers `MesServicesSpecialises` (générique)

**Problèmes** :
1. ❌ Le prestataire école n'a pas de dashboard dédié
2. ⚠️ Navigation prestataire → générique au lieu de `CreateEtablissement`

---

### 3.16 📚 BOURSE DU LIVRE SCOLAIRE

**Backend** : ✅ `livres_scolaires_controller` + `troc_livres_controller`

**Mobile** :
- `LivreScolaireHomeScreen` → Search → List → Details → Form ✅
- `MesLivresScreen` ✅
- `TrocMatchingScreen` → `TrocDetailsScreen` → `TrocLiveValidationScreen` → `MesTrocsScreen` ✅

**Problèmes** :
1. ⚠️ Pas directement lié à un type prestataire
2. ✅ Fonctionnel en tant que service utilisateur

---

### 3.17 🍽️ PLANIFICATION MENUS

**Backend** : ✅ `menu_planning_controller` (7 endpoints)

**Mobile** :
- `MenuPlanningHubScreen` → `MenuWeekCalendarScreen` → `RecipeSearchScreen` → `RecipeDetailsScreen` → `ShoppingListScreen` → `FamilyProfileScreen` ✅

**Problèmes** :
1. ✅ Bien intégré côté utilisateur
2. ⚠️ Pas de lien prestataire (restaurant/traiteur)

---

### 3.18 🚗 SERVICES AUTO

**Mobile** : `AutoServicesSearchScreen` → `AutoServicesResultsScreen` ✅

**Problèmes** :
1. ⚠️ Backend à vérifier — pas de controller `auto_services` visible
2. ⚠️ Probablement basé sur la recherche générique

---

### 3.19 💼 OFFRES D'EMPLOI

**Backend** : ✅ `offres_emploi_controller`

**Mobile** :
- `OffresEmploiFormScreen` ✅
- Écrans utilisateurs via `OffresEmploiHub`

**Problèmes** :
1. ⚠️ Un seul écran prestataire (formulaire), pas de dashboard

---

### 3.20 🏠 IMMOBILIER (Général)

**Backend** : ✅ ~20 endpoints (CRUD, favoris, comparaison, alertes prix, visites, IA recommandations, estimation prix, terrains, décoration)

**Mobile** :
- `ImmobilierHomeScreen` (recherche moderne) ✅
- `ImmobilierSearchScreen`, `ImmobilierListScreen`, `ImmobilierDetailsScreen` ✅
- `ImmobilierBookingScreen`, `ImmobilierCompareScreen`, `ImmobilierPriceAlertsScreen`, `MyFavoritesScreen` ✅
- `ImmobilierFormScreen` (création bien) ✅

**Problèmes** :
1. ⚠️ Le formulaire est bien fait mais sert aussi pour hôtel/meublé ce qui est inadapté
2. ⚠️ Pas de dashboard "Mes biens" avec analytics (vues, clics, favoris)

---

## 4. AUDIT IA — POURQUOI LES RÉSULTATS NE S'AFFICHENT PAS

### 4.1 Pattern récurrent : Double wrap `response.data.data`

Le problème vient de `apiPost<T>()` / `apiGet<T>()` qui retourne :
```typescript
{ success: boolean, data: T, error?: string }
```

Quand le backend retourne `{ success: true, data: { recommendations: [...] } }`, côté mobile :
- `response.data` = `{ recommendations: [...] }` ← c'est le bon niveau
- MAIS certains services font `response.data.data` → undefined
- OU certains services font `response.data.recommendation` quand le backend retourne `data.recommendations` (pluriel)

### 4.2 Problèmes spécifiques par écran IA

| Écran | Service mobile | Endpoint backend | Format retour backend | Accès mobile | Bug |
|-------|---------------|-----------------|----------------------|-------------|-----|
| HospitalAIRecommendations | `hospitalService.getAIRecommendations` | POST `/api/hopitaux/ai/recommendations` | `{success, data: {recommendations:[...]}}` | `response.data.recommendation` (singulier) | ❌ Clé au pluriel vs singulier |
| PharmacyAIInteractions | `pharmacyService.checkInteractions` | POST `/api/pharmacies/ai/interactions` | `{success, interaction: {...}}` | `response.data.interaction` | ⚠️ Backend retourne `interaction` pas dans `data` |
| LabAIAnalysis | `labService.analyzeExamination` | POST `/api/laboratoires/examinations/{id}/analyze` | `{success, analysis: {...}}` | `response.data.analysis` | ⚠️ Même pattern |
| HospitalTriage | via hospitalService | POST `/api/hopitaux/ai/triage` | `{success, triage: {...}}` | N/A | ⚠️ Retourne `triage` pas `data` |

### 4.3 Cause racine de l'IA

1. **Incohérence format retour** : Certains endpoints IA retournent `{success, data: {...}}`, d'autres `{success, interaction: {...}}`, d'autres `{success, triage: {...}}`
2. **Le wrap de `apiPost`** ajoute un niveau → `response.data` contient tout l'objet backend
3. **Les services mobile** (hospitalService, pharmacyService, labService) font déjà `const resData = (response?.data || response) as any` mais pas toujours correctement

**Solution** : Normaliser TOUS les endpoints IA pour retourner `{success: true, data: {...résultats...}}` et côté mobile accéder via `response.data.data` ou `(response.data as any).fieldName`.

---

## 5. AUDIT NAVIGATION PRESTATAIRE APRÈS CONNEXION

### 5.1 Flux actuel

1. Prestataire se connecte → `AuthContext` set `user.role = 'partenaire'`, `user.partner_type = 'xxx'`
2. `MainStackWithDeepLinks` détecte le partenaire → affiche "Préparation de votre espace..." pendant 300ms
3. `useDeepLinkRedirect` se déclenche → mappe `partner_type` vers un écran :

```
pharmacie → PharmacieForm (formulaire vide !)
hopital → HopitalForm (formulaire vide !)
laboratoire → LaboratoireForm (formulaire vide !)
agence de voyage → AgenceVoyageForm (formulaire vide !)
banquesang → BanqueSangForm (formulaire vide !)
hotel → ImmobilierForm (MAUVAIS !)
meuble → ImmobilierForm (MAUVAIS !)
chauffeur → TaxiForm (formulaire vide !)
supermarche → SupermarketHome (le seul correct !)
autres → MesServicesSpecialises (générique)
```

### 5.2 Problème fondamental

**Tous les partenaires sont redirigés vers un FORMULAIRE DE CRÉATION** au lieu d'un **DASHBOARD DE GESTION**.

Pour un prestataire qui a DÉJÀ créé son service, voir un formulaire vide est déroutant et non professionnel. Le flux devrait être :
1. Si le prestataire a déjà un service → **Dashboard de gestion** (analytics, réservations, commandes)
2. Si le prestataire n'a pas encore de service → **Formulaire de création** puis redirection vers Dashboard

### 5.3 `GESTION_SUPPORTED_TYPES` dans AppNavigator

Seuls 7 types sont supportés pour la détection immédiate :
```typescript
const GESTION_SUPPORTED_TYPES = ['pharmacie', 'hopital', 'laboratoire', 'agence de voyage', 'banquesang', 'covoiturage', 'taxi'];
```

**Manquants** : hotel, meuble, supermarche, demenagement, transport, assureur, telecom, etablissementscolaire, livraison, livraison_courses_marche

---

## 6. AUDIT "MON COMPTE" — ACCÈS À SUPPRIMER

### 6.1 Localisation

**Fichier**: `mobile/src/screens/ProfileScreen.tsx` lignes 317-324

```typescript
...(user?.role === 'partenaire' ? [{
    title: 'Mes Services Spécialisés',
    icon: 'layout-grid',
    color: '#6366F1',
    route: 'SpecializedServicesHub',
    description: 'Gérer vos services de santé et transport'
}] : []),
```

### 6.2 Action requise

Supprimer ce bloc pour retirer l'accès aux services spécialisés via "Mon compte". Le prestataire doit accéder à son espace UNIQUEMENT via la redirection automatique après login.

---

## 7. AUDIT UX CÔTÉ UTILISATEUR (HOMESCREEN)

### 7.1 Accès depuis HomeScreen

`YukpoServicesQuickAccess` dans `HomeScreen.tsx` (lignes 844-890) offre un accès rapide à 15 services :
- **Santé** : pharmacie, hopital, laboratoire, banque_sang ✅
- **Transport** : agence_voyage, covoiturage, taxi, automobile ✅
- **Assurance** : assurance ✅
- **Éducation** : orientation_scolaire, bourse_livre ✅
- **Emploi** : offres_emploi ✅
- **Vie quotidienne** : menu_planning, bayamselam ✅
- **Immobilier** : immo, hotel, meuble ✅

### 7.2 Problèmes UX côté utilisateur

1. **ImmobilierHomeScreen** — Bien fait avec filtres, tri, favoris, simulation prêt, IA estimation prix ✅
2. **Tous les Home screens santé** — Bonne structure mais l'IA ne retourne pas de résultats (voir §4)
3. **SupermarketHome** — Bien structuré (sélection → produits → comparaison → promos) ✅
4. **TaxiHome / CovoiturageHome** — Bonne UX ✅
5. **BusTicketSearch** — Complet (recherche, réservation, paiement, QR, validation) ✅

### 7.3 Problèmes UX détaillés

| Écran utilisateur | Score UX | Problèmes |
|-------------------|----------|-----------|
| PharmacieHome | 7/10 | IA interactions cassée, pas de résultats |
| HopitalHome | 7/10 | IA recommandations cassée, slots dispo OK |
| LaboratoireHome | 7/10 | IA analyse cassée |
| ImmobilierHome | 9/10 | Bon, filtres + favoris + simulation prêt |
| TaxiHome | 8/10 | Bon, recherche intelligente |
| CovoiturageHome | 8/10 | Bon, booking complet |
| BusTicketSearch | 8/10 | Bon, flow complet |
| BanqueSangSearch | 6/10 | Basique, pas de matching temps réel |
| SupermarketHome | 8/10 | Bon, comparaison + promos |
| InsuranceSearch | 3/10 | Backend vide, écran inutile |
| AutoServicesSearch | 4/10 | Backend minimal |

---

## 8. PLAN D'ACTION PRIORITAIRE

### 🔴 PRIORITÉ 1 — Corrections critiques

1. **Créer `HotelDashboardScreen`** — Dashboard complet exploitant les 16 endpoints backend (réservations, calendrier, check-in/out, QR, IA tarification, blockages)
2. **Créer `MeubleDashboardScreen`** (ou réutiliser le dashboard hôtel adapté)
3. **Corriger la redirection hotel/meuble** : `useDeepLinkRedirect.ts` → `HotelDashboard` / `MeubleDashboard` au lieu de `ImmobilierForm`
4. **Corriger le format retour IA** — Normaliser tous les endpoints backend pour `{success, data: {...}}` et corriger les accès mobile
5. **Créer des dashboards prestataire** pour les 6 services santé/transport (pharmacie, hôpital, labo, agence voyage, banque sang, taxi)

### 🟠 PRIORITÉ 2 — Améliorations UX prestataire

6. **Logique de redirection conditionnelle** : si le prestataire a déjà un service → Dashboard ; sinon → Formulaire
7. **Supprimer l'accès "Mon compte" → SpecializedServicesHub** dans `ProfileScreen.tsx`
8. **Enrichir `GestionServicesSpecialisesScreen`** pour supporter TOUS les types (pas seulement 6)
9. **Rendre accessibles** : PharmacyAnalytics, HospitalAnalytics, LabAnalytics, SlotManagement depuis les dashboards
10. **Créer des boutons d'action rapide** dans chaque dashboard prestataire (toggle garde/dispo, voir commandes, analytics)

### 🟡 PRIORITÉ 3 — Améliorations fonctionnelles

11. **Backend assureur** — Créer un controller et des endpoints (devis, sinistres, polices)
12. **Backend télécom** — Créer un controller (forfaits, recharges)
13. **Dashboard déménagement** — Exploiter les 3 endpoints existants
14. **Dashboard livraison** — Écran dédié au lieu du générique
15. **Notifications push** pour prestataires (nouvelle commande, demande urgente sang, etc.)

### ⚪ PRIORITÉ 4 — Polish

16. Ajouter des transitions fluides entre formulaire et dashboard
17. Ajouter des badges de comptage (ex: "3 réservations en attente")
18. Ajouter le mode sombre pour tous les écrans spécialisés
19. Ajouter des tutoriels de bienvenue pour chaque type de prestataire
20. Harmoniser les styles entre tous les écrans spécialisés

---

**Résumé** : Sur ~20 types de services spécialisés, seulement 6-7 ont un flux prestataire fonctionnel (et encore, limité au formulaire). Le backend est souvent en avance sur le mobile — beaucoup d'endpoints IA et de gestion existent mais ne sont pas exploités. Les problèmes les plus critiques sont : (1) hôtel/meublé redirigé vers le mauvais écran, (2) IA qui ne retourne pas de résultats visibles, (3) absence de dashboards prestataire, (4) écrans existants mais inaccessibles.
