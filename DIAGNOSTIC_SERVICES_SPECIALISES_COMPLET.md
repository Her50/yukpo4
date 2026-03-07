# DIAGNOSTIC COMPLET DES SERVICES SPECIALISES YUKPO

> Date: 2026-03-09
> Portee: 17+ services specialises (cote partenaire + cote utilisateur)
> Fichiers analyses: ~50 fichiers (ecrans, hooks, routes backend, navigateur)

---

## TABLE DES MATIERES

1. [SYNTHESE EXECUTIVE](#1-synthese-executive)
2. [PROBLEME CENTRAL: Routage partenaire](#2-probleme-central-routage-partenaire)
3. [DIAGNOSTIC PAR SERVICE](#3-diagnostic-par-service)
   - 3.1 Pharmacie
   - 3.2 Hopital/Clinique
   - 3.3 Laboratoire/Imagerie
   - 3.4 Banque de Sang
   - 3.5 Agence de Voyage
   - 3.6 Covoiturage
   - 3.7 Taxi
   - 3.8 Hotel
   - 3.9 Meuble
   - 3.10 Supermarche
   - 3.11 Offres d'Emploi
   - 3.12 Assurance
   - 3.13 Bourse du Livre
   - 3.14 Orientation Scolaire
   - 3.15 Automobile
   - 3.16 Menu/Restaurant
   - 3.17 BayamSelam (Marche)
4. [INTEGRATION IA](#4-integration-ia)
5. [ECRANS GENERIQUES PROBLEMATIQUES](#5-ecrans-generiques-problematiques)
6. [RESUME DES ACTIONS PRIORITAIRES](#6-resume-des-actions-prioritaires)

---

## 1. SYNTHESE EXECUTIVE

### Constat global

L'application dispose d'une **architecture backend riche** avec des routes dedicees pour chaque service specialise, mais le **frontend mobile souffre de 4 problemes majeurs** :

| Probleme | Severite | Impact |
|----------|----------|--------|
| Routage partenaire incorrect (`useDeepLinkRedirect.ts`) | CRITIQUE | Partenaires envoyes vers les mauvais ecrans ou ecrans generiques vides |
| Ecran generique `GestionServicesSpecialises` = goulot d'etranglement | CRITIQUE | 6 types de partenaires arrivent sur le meme ecran sans filtrage par type |
| Ecrans IA existants mais non connectes aux dashboards | MAJEUR | Fonctionnalites IA developpees mais inaccessibles = ecrans vides ou crash |
| Types partenaires manquants dans le mapping | CRITIQUE | 7+ types (assurance, emploi, hotel, meuble, banquesang, orientation, auto) n'ont aucune destination propre |

### Chiffres cles

- **17 services specialises** identifies
- **7 types partenaires** sans destination propre dans `partnerTypeToScreen`
- **2 redirections incorrectes** (hotel/meuble → ImmobilierForm au lieu de HotelDashboard)
- **6+ ecrans IA** existants mais non connectes aux dashboards partenaires
- **1 ecran generique** (`GestionServicesSpecialises`) qui gere 6 types sans filtrage

---

## 2. PROBLEME CENTRAL: Routage partenaire

### Fichier: `mobile/src/hooks/useDeepLinkRedirect.ts` (lignes 39-56)

```typescript
const partnerTypeToScreen: Record<string, string> = {
    'pharmacie': 'GestionServicesSpecialises',      // ❌ Devrait → PharmacieForm (dashboard)
    'hopital': 'GestionServicesSpecialises',         // ❌ Devrait → HopitalForm (dashboard)
    'laboratoire': 'GestionServicesSpecialises',     // ❌ Devrait → LaboratoireForm (dashboard)
    'agence_voyage': 'GestionServicesSpecialises',   // ❌ Devrait → AgenceVoyageForm (dashboard)
    'covoiturage': 'GestionServicesSpecialises',     // ❌ Devrait → CovoiturageForm (dashboard)
    'taxi': 'GestionServicesSpecialises',            // ❌ Devrait → TaxiForm (dashboard)
    'hotel': 'ImmobilierForm',                       // ❌ CRITIQUE: Devrait → HotelDashboard
    'meuble': 'ImmobilierForm',                      // ❌ CRITIQUE: Devrait → HotelDashboard
    'chauffeur': 'TaxiForm',                         // ✅ Correct
    'supermarche': 'SupermarketHome',                // ⚠️ Pas de dashboard partenaire dedie
    'livraison_courses_marche': 'MesServicesSpecialises', // ⚠️ Generique
    'restaurant': 'MesServicesSpecialises',          // ❌ Devrait → MenuPlanningHub ou dashboard
    'ecommerce': 'MesServicesSpecialises',           // ⚠️ Generique
    'prestataire': 'MesServicesSpecialises',         // ⚠️ Generique
    'service': 'MesServicesSpecialises',             // ⚠️ Generique
};
```

### Types MANQUANTS (pas dans le mapping → fallback MesServicesSpecialises):

| Type partenaire | Ecran qui devrait etre la destination | Existe? |
|----------------|--------------------------------------|---------|
| `banquesang` | `BanqueSangForm` (dashboard mode) | ✅ Oui |
| `assurance` | Dashboard assurance (A CREER) | ❌ Non |
| `offre_emploi` / `recruteur` | `OffresEmploiHub` ou `MesOffres` | ✅ Oui |
| `etablissementscolaire` | `CreateEtablissement` ou `OrientationScolaireHub` | ✅ Oui |
| `automobile` | Dashboard auto (A CREER) | ❌ Non |
| `menu` | Dashboard menu/restaurant (A CREER) | ❌ Non |

---

## 3. DIAGNOSTIC PAR SERVICE

---

### 3.1 PHARMACIE

**Fichiers cles:**
- Partenaire: `mobile/src/screens/specialized/PharmacieFormScreen.tsx` (853 lignes)
- Utilisateur: `PharmacieHomeScreen`, `PharmacieSearchScreen`, `PharmacieListScreen`, `PharmacieDetailsScreen`
- IA: `PharmacyAIInteractionsScreen`, `PharmacyAnalyticsScreen`
- Backend: `specialized_services_routes.rs` (endpoints pharmacie CRUD, garde, produits, commandes, analytics)

**Cote partenaire:**
- ✅ Dashboard professionnel avec 4 tabs (Accueil / Mon service / Produits / Stats)
- ✅ Mode creation (formulaire guide) et mode dashboard (pharmacie existante)
- ✅ Gestion des jours de garde (`GuardDaysSelector`)
- ✅ Auto-save formulaire (`useFormAutoSave`)
- ✅ Validation formulaire (`useFormValidation`)
- ✅ Gestion des produits avec prix/stock
- ⚠️ **PROBLEME**: Le partenaire arrive sur `GestionServicesSpecialises` (ecran generique) et non directement sur `PharmacieForm`
- ⚠️ **PROBLEME**: `PharmacyAIInteractionsScreen` existe (dosage IA, interactions medicamenteuses) mais N'EST PAS accessible depuis le dashboard pharmacie
- ⚠️ **PROBLEME**: `PharmacyAnalyticsScreen` existe mais navigation vers celui-ci non integree dans le tab "Stats"

**Cote utilisateur:**
- ✅ Hub sante (`HealthServicesHubScreen`) avec acces pharmacies
- ✅ Recherche geographique avec GPS
- ✅ Liste des pharmacies avec filtre garde/disponibilite
- ✅ Detail pharmacie avec horaires
- ✅ Commande de medicaments (`MyPharmacyOrdersScreen`)
- ⚠️ **PROBLEME**: Le lien IA (verification interactions medicamenteuses) n'est pas visible dans la fiche utilisateur

**Verdict: 6/10** - Bon backend mais mauvais routage partenaire + IA non connectee

---

### 3.2 HOPITAL/CLINIQUE

**Fichiers cles:**
- Partenaire: `HopitalFormScreen.tsx` (520 lignes)
- Utilisateur: `HopitalHomeScreen`, `HopitalSearchScreen`, `HopitalListScreen`, `HopitalDetailsScreen`
- IA: `HospitalAIRecommendationsScreen`, `HospitalAnalyticsScreen`
- Backend: `specialized_services_routes.rs` (endpoints hopital CRUD, slots, consultations, wait-times, emergency, AI triage)

**Cote partenaire:**
- ✅ Dashboard avec 4 tabs (Accueil / Service / Creneaux / Stats)
- ✅ Types d'etablissement (Hopital, Clinique, Centre de sante, Dispensaire)
- ✅ 27 prestations medicales selectionnables
- ✅ Gestion creneaux avec `PrestationSelectorWithSchedule`
- ✅ Gestion urgences et RDV en ligne
- ⚠️ **PROBLEME**: Arrive via `GestionServicesSpecialises` au lieu du dashboard directement
- ⚠️ **PROBLEME**: `HospitalAIRecommendationsScreen` (triage IA) non connecte au dashboard
- ⚠️ **PROBLEME**: `HospitalAnalyticsScreen` non connecte au tab Stats
- ⚠️ **PROBLEME**: Backend supporte `wait-times` et `emergency` status mais pas exploites dans le dashboard

**Cote utilisateur:**
- ✅ Recherche par type, specialite, localisation
- ✅ Detail hopital avec disponibilite urgences
- ✅ Prise de RDV (`BookAppointmentScreen`, `SlotManagementScreen`)
- ✅ Mes consultations (`MyConsultationsScreen`)
- ⚠️ **PROBLEME**: Pas de temps d'attente affiche (endpoint existe)

**Verdict: 5/10** - Infrastructure complete mais IA et analytics non connectes

---

### 3.3 LABORATOIRE/IMAGERIE

**Fichiers cles:**
- Partenaire: `LaboratoireFormScreen.tsx` (563 lignes)
- Utilisateur: `LaboratoireHomeScreen`, `LaboratoireSearchScreen`, `LaboratoireListScreen`, `LaboratoireDetailsScreen`
- IA: `LabAIAnalysisScreen`, `LabAnalyticsScreen`
- Backend: `specialized_services_routes.rs` (endpoints labo CRUD, examination-types, book-examination, results, AI analysis, slots)

**Cote partenaire:**
- ✅ Dashboard avec 4 tabs (Accueil / Service / Examens / Stats)
- ✅ Types (Laboratoire, Centre d'imagerie, Les deux)
- ✅ Gestion des types d'examens (modal creation/edition)
- ✅ Recherche dans les examens
- ✅ 6 types d'analyses + 5 types d'imagerie selectionnables
- ⚠️ **PROBLEME**: Arrive via `GestionServicesSpecialises`
- ⚠️ **PROBLEME**: `LabAIAnalysisScreen` (analyse IA des resultats) non connecte
- ⚠️ **PROBLEME**: `LabAnalyticsScreen` non connecte au tab Stats

**Cote utilisateur:**
- ✅ Recherche par type d'examen
- ✅ Detail labo avec tarifs
- ✅ Mes examens (`MyLabExaminationsScreen`)
- ⚠️ **PROBLEME**: Reservation d'examen existe cote backend mais flow utilisateur peu clair

**Verdict: 5/10** - Meme probleme que hopital (IA non connectee)

---

### 3.4 BANQUE DE SANG

**Fichiers cles:**
- Partenaire: `BanqueSangFormScreen.tsx` (452 lignes)
- Utilisateur: `BanqueSangListScreen`, `BanqueSangSearchScreen`, `BanqueSangDetailsScreen`, `BloodDonationScreen`, `BloodDonationMatchesScreen`, `BloodDonationRequestScreen`, `MyBloodDonationsScreen`
- Backend: `specialized_services_routes.rs` (banque sang CRUD, stocks, statistics)

**Cote partenaire:**
- ✅ Dashboard avec 3 tabs (Accueil / Service / Stocks)
- ✅ Gestion stocks par groupe sanguin (8 groupes: O+, O-, A+, A-, B+, B-, AB+, AB-)
- ✅ Stats calculees (total stock, groupes avec stock)
- 🔴 **CRITIQUE**: Type `banquesang` PAS dans `partnerTypeToScreen` → le partenaire atterrit sur `MesServicesSpecialises` (ecran generique)
- 🔴 **CRITIQUE**: MesServicesSpecialises a un bouton "Banque de Sang" avec route `BanqueSangForm` mais le mapping dans useDeepLinkRedirect ne redirige pas vers ce formulaire

**Cote utilisateur:**
- ✅ Ecosysteme riche: recherche, demande de sang, matching donneurs, mes dons
- ✅ `BloodDonationMatchesScreen` pour matcher donneurs/receveurs
- ✅ `BloodGroupManagementScreen` pour gestion administrative
- ⚠️ **PROBLEME**: Le flow don/demande est probablement fonctionnel mais l'UX de decouverte est cachee (pas dans HomeScreen?)

**Verdict: 4/10** - Partenaire ne peut pas atteindre son dashboard

---

### 3.5 AGENCE DE VOYAGE

**Fichiers cles:**
- Partenaire: `AgenceVoyageFormScreen.tsx` (779 lignes)
- Utilisateur: `AgenceVoyageListScreen`, `AgenceVoyageSearchScreen`, `AgenceVoyageDetailsScreen`
- Tickets: `BusTicketSearchScreen`, `BusTicketBookingScreen`, `BusTicketDetailsScreen`, `BusTicketPaymentScreen`, `BusTicketQRScreen`, `BusTicketQRScannerScreen`, `TicketVoyageHomeScreen`
- Gestion: `AgencyTicketManagementScreen`, `ManageAgencySchedulesScreen`, `ManageBusSeatsScreen`, `AgencyAnalyticsDashboard`
- Backend: `specialized_services_routes.rs` (agence CRUD, schedules, bus-tickets, bus models)

**Cote partenaire:**
- ✅ Dashboard riche avec 5 tabs (Accueil / Service / Horaires / Bus / Tickets)
- ✅ Gestion horaires de depart par ville
- ✅ Gestion modeles de bus (`BusModelForm`)
- ✅ Selection compagnies (`CompanySelector`)
- ✅ Gestion tickets vendus
- ✅ `AgencyAnalyticsDashboard` existe
- ⚠️ **PROBLEME**: Arrive via `GestionServicesSpecialises` → clic supplementaire inutile
- ⚠️ **PROBLEME**: `AgencyTicketManagement` et `ManageAgencySchedules` sont des ecrans separes accessibles depuis `GestionServicesSpecialises` (boutons speciaux pour type `agence_voyage`) mais pas depuis le dashboard propre de l'agence
- ⚠️ **PROBLEME**: Duplication de fonctionnalites entre le dashboard et les ecrans externes

**Cote utilisateur:**
- ✅ Ecosysteme tickets bus tres complet (recherche, reservation, paiement, QR, aller-retour)
- ✅ `TicketVoyageHomeScreen` = hub dedie
- ✅ `BusReturnRequestFormScreen` pour demandes retour
- ✅ `MyBusTicketsScreen` pour mes tickets

**Verdict: 7/10** - Le plus complet mais routage partenaire indirect

---

### 3.6 COVOITURAGE

**Fichiers cles:**
- Partenaire: `CovoiturageFormScreen.tsx` (632 lignes)
- Utilisateur: `CovoiturageHomeScreen`, `CovoiturageSearchScreen`, `CovoiturageListScreen`, `CovoiturageDetailsScreen`, `CovoiturageBookingScreen`, `CovoiturageIntelligentSearchScreen`, `MesReservationsCovoiturageScreen`, `MyTripsScreen`
- Backend: `specialized_services_routes.rs` (covoiturage CRUD, my-trips, booking, search, reviews, driver verification)

**Cote partenaire:**
- ✅ Dashboard avec 3 tabs (Mes trajets / Nouveau trajet / Stats)
- ✅ Formulaire step-by-step avec `DateTimePicker`
- ✅ Trajets recurrents
- ✅ Upload photo vehicule
- ⚠️ **PROBLEME**: Arrive via `GestionServicesSpecialises`
- ⚠️ **PROBLEME**: Pas de verification conducteur dans le dashboard (endpoint backend existe)
- ⚠️ **PROBLEME**: Pas d'avis/notes visibles dans le dashboard partenaire

**Cote utilisateur:**
- ✅ Ecosysteme complet: home, recherche standard + intelligente, liste, details, reservation
- ✅ `CovoiturageIntelligentSearchScreen` (recherche IA)
- ✅ Mes reservations
- ✅ Mes trajets

**Verdict: 6/10** - Bon ecosysteme utilisateur mais partenaire indirect

---

### 3.7 TAXI

**Fichiers cles:**
- Partenaire: `TaxiFormScreen.tsx` (452 lignes)
- Utilisateur: `TaxiHomeScreen`, `TaxiSearchScreen`, `TaxiIntelligentSearchScreen`, `TaxiListScreen`, `TaxiDetailsScreen`, `TaxiBookingScreen`, `TaxiTrackingScreen`, `TaxiAvailabilityScreen`, `MesTaxisScreen`
- Backend: `specialized_services_routes.rs` (taxi CRUD, booking, availability, dynamic pricing) + `taxi_realtime_metrics_routes.rs`

**Cote partenaire:**
- ✅ Dashboard avec 3 tabs (Accueil / Service / Stats)
- ✅ Toggle disponibilite en temps reel
- ✅ Tarification dynamique
- ✅ Upload photo vehicule
- ✅ Zones d'intervention configurables
- ⚠️ **PROBLEME**: `taxi` type → `GestionServicesSpecialises`, mais `chauffeur` type → `TaxiForm` (INCOHERENCE)
- ⚠️ **PROBLEME**: `taxi_realtime_metrics_routes` existe cote backend mais pas de dashboard metrics integre

**Cote utilisateur:**
- ✅ Ecosysteme tres complet: home, recherche, recherche intelligente, liste, details, reservation, tracking
- ✅ Disponibilite en temps reel
- ✅ Comparaison taxis

**Verdict: 7/10** - Tres bon ecosysteme mais incoherence de routage taxi/chauffeur

---

### 3.8 HOTEL

**Fichiers cles:**
- Partenaire: `HotelDashboardScreen.tsx` (1052 lignes)
- Utilisateur: `ImmobilierHomeScreen`, `ImmobilierSearchScreen`, `ImmobilierListScreen`, `ImmobilierDetailsScreen`, `ImmobilierBookingScreen`, `ImmobilierCompareScreen`, `ImmobilierPriceAlertsScreen`
- Paiement: `HotelBookingPaymentScreen`, `HotelQRScannerScreen`
- Backend: `hotel_room_management_routes.rs` (16+ endpoints: proprietes, reservations, check-in/out, blockages, revenue, stats, AI)

**Cote partenaire:**
- ✅ `HotelDashboardScreen` = dashboard professionnel EXISTE avec 4 tabs (Accueil / Reservations / Proprietes / IA)
- ✅ Gestion reservations complete (creation, check-in, check-out)
- ✅ Tab IA avec insights
- 🔴 **CRITIQUE**: `hotel` type mappe vers `ImmobilierForm` au lieu de `HotelDashboard` → le partenaire hotel arrive sur un formulaire immobilier generique!
- 🔴 **CRITIQUE**: Le dashboard dedie existe mais est INACCESSIBLE via la navigation automatique
- ⚠️ **PROBLEME**: `HotelBookingPaymentScreen` et `HotelQRScannerScreen` ont eu des crashs (imports manquants fixes precedemment mais d'autres bugs possibles)

**Cote utilisateur:**
- ✅ Ecosysteme immobilier complet (recherche, liste, details, reservation, comparaison, alertes prix)
- ✅ Favoris (`MyFavoritesScreen`)
- ⚠️ **PROBLEME**: L'immobilier melange hotels, meubles et biens immobiliers classiques sans distinction claire

**Verdict: 3/10** - Dashboard existe mais partenaire ne peut JAMAIS y acceder

---

### 3.9 MEUBLE

**Meme architecture que Hotel (partage `HotelDashboardScreen`).**

- 🔴 **CRITIQUE**: `meuble` type mappe vers `ImmobilierForm` au lieu de `HotelDashboard`
- Le `HotelDashboardScreen` est concu pour gerer BOTH hotel et meuble (ligne 1: "Dashboard professionnel pour prestataires Hotel/Meuble")

**Verdict: 3/10** - Identique a Hotel

---

### 3.10 SUPERMARCHE

**Fichiers cles:**
- Partenaire + Utilisateur: `SupermarketHomeScreen.tsx` (1632 lignes)
- Backend: `specialized_services_routes.rs` (supermarche CRUD) + routes livraison

**Cote partenaire:**
- ✅ Correctement mappe dans `partnerTypeToScreen` → `SupermarketHome`
- ⚠️ **PROBLEME**: MEME ecran pour partenaire ET utilisateur - pas de dashboard partenaire dedie
- ⚠️ **PROBLEME**: Pas de gestion de catalogue/stock pour le partenaire supermarche
- ⚠️ **PROBLEME**: Pas d'analytics ou gestion de commandes pour le partenaire

**Cote utilisateur:**
- ✅ 4 modes: Magasins / Produits / Comparer / Promos
- ✅ Recherche geographique de supermarches
- ✅ Comparaison de prix
- ✅ Promotions
- ✅ Integration BayamSelam

**Verdict: 5/10** - Bon cote utilisateur, inexistant cote partenaire

---

### 3.11 OFFRES D'EMPLOI

**Fichiers cles:**
- Partenaire: `OffresEmploiFormScreen.tsx` (842 lignes, dans specialized/) + `CreateOffreScreen.tsx` (dans offres-emploi/)
- Utilisateur: `OffresEmploiHomeScreen`, `OffresEmploiHubScreen`, `OffreSearchScreen`, `OffreListScreen`, `OffreDetailsScreen`, `OffreCandidaturesScreen`, `ProfilCandidatScreen`
- IA: `AICVAnalysisScreen`, `AISalaryPredictionScreen`, `AISuggestFormationsScreen`
- Backend: `offres_emploi_routes.rs`

**Cote partenaire:**
- ✅ Formulaire complet (titre, description, contrat, salaire, competences, langues, tags)
- ✅ Validation formulaire avancee
- ✅ Auto-save
- ✅ `MesOffresScreen` pour gerer ses offres
- 🔴 **CRITIQUE**: Type `offre_emploi`/`recruteur` N'EST PAS dans `partnerTypeToScreen`
- ⚠️ **PROBLEME**: Duplication entre `OffresEmploiFormScreen` (specialized/) et `CreateOffreScreen` (offres-emploi/)
- ⚠️ **PROBLEME**: Ecrans IA (CV analysis, salaire prediction, formations suggerees) existent mais non connectes au dashboard partenaire

**Cote utilisateur:**
- ✅ Ecosysteme complet: hub, recherche, liste, details, candidatures, profil candidat
- ✅ IA: Analyse CV, prediction salaire, suggestions formations
- ⚠️ **PROBLEME**: Les ecrans IA peuvent crash si backend IA est indisponible (pas de fallback visible)

**Verdict: 4/10** - Riche ecosysteme inaccessible au partenaire via routage

---

### 3.12 ASSURANCE

**Fichiers cles:**
- Utilisateur: `InsuranceServicesSearchScreen.tsx` (676 lignes), `InsuranceServicesResultsScreen.tsx`, `InsuranceQuoteRequestScreen.tsx`
- Backend: `assurance_routes.rs` (recherche, devis IA, comparaison)

**Cote partenaire:**
- 🔴 **CRITIQUE**: AUCUN dashboard partenaire pour les compagnies d'assurance
- 🔴 **CRITIQUE**: Type `assurance` N'EST PAS dans `partnerTypeToScreen`
- ⚠️ **PROBLEME**: Le backend a des routes assurance (recherche, devis IA, comparaison) mais aucun ecran de gestion cote assureur

**Cote utilisateur:**
- ✅ Recherche par type d'assurance, compagnie, localisation
- ✅ Resultats de recherche
- ✅ Demande de devis
- ⚠️ **PROBLEME**: Pas de souscription/achat en ligne
- ⚠️ **PROBLEME**: L'IA devis semble integree cote backend mais UX non verifiee

**Verdict: 2/10** - Cote partenaire totalement absent

---

### 3.13 BOURSE DU LIVRE

**Fichiers cles:**
- Partenaire/Utilisateur: `LivreScolaireFormScreen.tsx` (1247 lignes), `LivreScolaireHomeScreen`, `LivreScolaireListScreen`, `LivreScolaireSearchScreen`, `LivreScolaireDetailsScreen`, `MesLivresScreen`, `BourseLivreScreen`
- Troc: `MesTrocsScreen`, `TrocDetailsScreen`, `TrocMatchingScreen`, `TrocLiveValidationScreen`
- IA: `useAIWithFallback` hook (analyse image livres)
- Backend: `bourse_livre_routes.rs`

**Cote partenaire (service partage):**
- ✅ Formulaire complet avec IA image analysis
- ✅ Validation formulaire
- ✅ Auto-save
- ✅ Gestion "Mes Livres" (`MesLivresScreen`)
- ⚠️ **PROBLEME**: Pas de type partenaire dedie - c'est un service partage accessible depuis HomeScreen
- ⚠️ **PROBLEME**: L'IA analyse d'image peut crash si backend IA indisponible (pas de gestion d'erreur visible)

**Cote utilisateur:**
- ✅ Hub dedie (`BourseLivreScreen`)
- ✅ Recherche et listing de livres
- ✅ Systeme de troc complet (matching, validation live, details)
- ⚠️ **PROBLEME**: Le flow troc est complexe et peut etre confus pour l'utilisateur

**Verdict: 6/10** - Bon ecosysteme mais IA fragile

---

### 3.14 ORIENTATION SCOLAIRE

**Fichiers cles:**
- Partenaire: `CreateEtablissementScreen.tsx`
- Utilisateur: `OrientationScolaireHomeScreen`, `OrientationScolaireHubScreen`, `EtablissementSearchScreen`, `EtablissementDetailsScreen`, `ProfilEtudiantScreen`, `ConcoursEntreeScreen`, `ConferencesLivesScreen`, `ExperiencesEtudiantsScreen`, `ProgrammesScolairesScreen`, `FournituresScolairesScreen`
- IA: `OrientationAIRecommendationsScreen`, `OrientationAICompareProgramsScreen`, `OrientationAIProfileAnalysisScreen`
- Backend: `orientation_scolaire_routes.rs` (61 matches - routes completes)

**Cote partenaire:**
- ✅ `CreateEtablissementScreen` existe pour enregistrer un etablissement
- 🔴 **CRITIQUE**: Type `etablissementscolaire` N'EST PAS dans `partnerTypeToScreen` → partenaire ecole atterrit sur ecran generique
- ⚠️ **PROBLEME**: Pas de dashboard de gestion pour l'etablissement (gestion etudiants, programmes, etc.)

**Cote utilisateur:**
- ✅ Ecosysteme tres riche: hub, recherche, profil etudiant, concours, conferences, experiences, programmes, fournitures
- ✅ IA: Recommandations, comparaison de programmes, analyse de profil
- ⚠️ **PROBLEME**: La connexion entre IA screens et le hub n'est pas verifiee (navigation peut etre cassee)

**Verdict: 5/10** - Riche cote utilisateur mais partenaire non route

---

### 3.15 AUTOMOBILE

**Fichiers cles:**
- Utilisateur: `AutoServicesSearchScreen.tsx` (728 lignes), `AutoServicesResultsScreen.tsx`
- Backend: `vehicle_model_routes.rs`

**Cote partenaire:**
- 🔴 **CRITIQUE**: AUCUN dashboard partenaire pour les vendeurs automobile
- 🔴 **CRITIQUE**: Type `automobile` N'EST PAS dans `partnerTypeToScreen`
- ⚠️ **PROBLEME**: Backend a des routes vehicules mais aucun ecran de gestion

**Cote utilisateur:**
- ✅ Recherche avancee (type, marque, prix, annee, occasion)
- ✅ Resultats avec geolocalisation
- ⚠️ **PROBLEME**: Pas de detail vehicule ou flow d'achat/contact

**Verdict: 2/10** - Minimal

---

### 3.16 MENU/RESTAURANT

**Fichiers cles:**
- Utilisateur: `MenuPlanningHubScreen.tsx`, `FamilyProfileScreen.tsx`, `RecipeSearchScreen.tsx`, `MenuWeekCalendarScreen.tsx`, `ShoppingListScreen.tsx`, `RecipeDetailsScreen.tsx`
- Backend: Via services generiques + IA

**Cote partenaire:**
- 🔴 **PROBLEME**: `restaurant` type mappe vers `MesServicesSpecialises` (generique) au lieu d'un dashboard restaurant
- ⚠️ **PROBLEME**: Pas de dashboard pour gerer un restaurant/menu (horaires, plats, commandes)

**Cote utilisateur:**
- ✅ Hub planification menu avec profil familial
- ✅ Recherche recettes
- ✅ Calendrier hebdomadaire
- ✅ Liste de courses
- ✅ Details recette
- ⚠️ **PROBLEME**: L'ecosysteme est oriente "planification perso" et non "restaurant" - deconnexion avec le type partenaire `restaurant`

**Verdict: 4/10** - Bon cote utilisateur (planification) mais aucun lien avec partenaires restaurant

---

### 3.17 BAYAMSELAM (MARCHE)

**Fichiers cles:**
- Utilisateur: `BayamSelamSearchScreen.tsx`, `BayamSelamResultsScreen.tsx`
- Lie a: `SupermarketHomeScreen` (meme ecran)

**Cote partenaire:**
- ⚠️ Pas de type partenaire dedie - utilise `supermarche` ou `livraison_courses_marche`
- ⚠️ Pas de dashboard specifique

**Cote utilisateur:**
- ✅ Recherche de produits au marche
- ✅ Resultats avec geolocalisation
- ✅ Connexion avec SupermarketHome

**Verdict: 5/10** - Extension de Supermarche, pas un service independant

---

## 4. INTEGRATION IA

### Ecrans IA existants mais NON CONNECTES aux dashboards:

| Ecran IA | Service | Connecte? | Probleme |
|----------|---------|-----------|----------|
| `PharmacyAIInteractionsScreen` | Pharmacie | ❌ | Pas de bouton dans dashboard PharmacieForm |
| `PharmacyAnalyticsScreen` | Pharmacie | ❌ | Tab Stats ne navigue pas vers cet ecran |
| `HospitalAIRecommendationsScreen` | Hopital | ❌ | Pas de bouton dans dashboard HopitalForm |
| `HospitalAnalyticsScreen` | Hopital | ❌ | Tab Stats ne navigue pas vers cet ecran |
| `LabAIAnalysisScreen` | Laboratoire | ❌ | Pas de bouton dans dashboard LaboratoireForm |
| `LabAnalyticsScreen` | Laboratoire | ❌ | Tab Stats ne navigue pas vers cet ecran |
| `HotelDashboard` tab IA | Hotel | ⚠️ | Dashboard existe mais partenaire n'y arrive pas |
| `AICVAnalysisScreen` | Emploi | ❌ | Non connecte au flow partenaire |
| `AISalaryPredictionScreen` | Emploi | ❌ | Non connecte au flow partenaire |
| `AISuggestFormationsScreen` | Emploi | ❌ | Non connecte au flow partenaire |
| `OrientationAIRecommendationsScreen` | Orientation | ⚠️ | Connexion depuis hub non verifiee |
| `OrientationAICompareProgramsScreen` | Orientation | ⚠️ | Connexion depuis hub non verifiee |
| `OrientationAIProfileAnalysisScreen` | Orientation | ⚠️ | Connexion depuis hub non verifiee |

### Backend IA existant mais non exploite:

| Endpoint Backend | Service | Exploite? |
|-----------------|---------|-----------|
| AI triage / recommendations | Hopital | ❌ Non connecte |
| AI analysis resultats | Laboratoire | ❌ Non connecte |
| AI dosage / interactions | Pharmacie | ❌ Non connecte |
| AI devis assurance | Assurance | ⚠️ Partiellement (backend existe, frontend possible) |
| AI image analysis livres | Bourse Livre | ✅ Connecte via `useAIWithFallback` |
| AI orientation profil | Orientation | ⚠️ Non verifie |

---

## 5. ECRANS GENERIQUES PROBLEMATIQUES

### 5.1 `GestionServicesSpecialisesScreen.tsx`

**Probleme**: 6 types de partenaires differents arrivent sur le MEME ecran.

- Interface `SpecializedService.type` limitee a: `pharmacie | hopital | laboratoire | agence_voyage | covoiturage | taxi`
- L'ecran affiche TOUS les services de TOUS les types ensemble
- Pas de filtrage automatique par `user.partner_type`
- Le partenaire pharmacie voit les taxis, le partenaire taxi voit les pharmacies
- C'est un ecran de LISTE, pas un DASHBOARD professionnel

**Impact**: Experience non professionnelle, confusion, perte de confiance du partenaire.

### 5.2 `MesServicesSpecialisesScreen.tsx`

**Probleme**: Ecran de "creation de service" qui ne couvre que 7/17 services.

- Ne liste que: Pharmacie, Hopital, Laboratoire, Banque de Sang, Agence de Voyage, Covoiturage, Taxi
- Manquent: Hotel, Meuble, Supermarche, Emploi, Assurance, Livre, Orientation, Auto, Menu
- Cree un service AVANT de naviguer vers le formulaire → cree des services orphelins en cas d'erreur
- Categories trop simples: seulement 'sante' et 'transport'
- Pas de categories pour: immobilier, emploi, education, finance, etc.

---

## 6. RESUME DES ACTIONS PRIORITAIRES

### PRIORITE 1 - CRITIQUE (Corriger le routage)

**Fichier: `mobile/src/hooks/useDeepLinkRedirect.ts`**

Corriger le mapping `partnerTypeToScreen`:

```typescript
const partnerTypeToScreen: Record<string, string> = {
    // Sante - chaque type vers son dashboard direct
    'pharmacie': 'PharmacieForm',            // dashboard mode auto-detecte
    'hopital': 'HopitalForm',                // dashboard mode auto-detecte
    'laboratoire': 'LaboratoireForm',        // dashboard mode auto-detecte
    'banquesang': 'BanqueSangForm',          // dashboard mode auto-detecte
    
    // Transport
    'agence_voyage': 'AgenceVoyageForm',     // dashboard mode auto-detecte
    'covoiturage': 'CovoiturageForm',        // dashboard mode auto-detecte
    'taxi': 'TaxiForm',                      // dashboard mode auto-detecte
    'chauffeur': 'TaxiForm',                 // OK deja correct
    
    // Hebergement - CORRIGER
    'hotel': 'HotelDashboard',              // ← PAS ImmobilierForm
    'meuble': 'HotelDashboard',             // ← PAS ImmobilierForm
    
    // Commerce
    'supermarche': 'SupermarketHome',        // OK mais ajouter dashboard partenaire
    
    // Emploi - AJOUTER
    'offre_emploi': 'OffresEmploiHub',
    'recruteur': 'OffresEmploiHub',
    
    // Education - AJOUTER
    'etablissementscolaire': 'CreateEtablissement',
    
    // Assurance - AJOUTER (dashboard a creer)
    'assurance': 'InsuranceServicesSearch',   // temporaire, creer dashboard
    
    // Generiques
    'restaurant': 'MesServicesSpecialises',
    'ecommerce': 'MesServicesSpecialises',
    'prestataire': 'MesServicesSpecialises',
    'service': 'MesServicesSpecialises',
    'livraison_courses_marche': 'MesServicesSpecialises',
};
```

### PRIORITE 2 - MAJEUR (Connecter les ecrans IA)

Pour chaque dashboard partenaire (PharmacieForm, HopitalForm, LaboratoireForm), ajouter des boutons de navigation vers les ecrans IA existants:
- `PharmacieForm` → bouton vers `PharmacyAIInteractions` + `PharmacyAnalytics`
- `HopitalForm` → bouton vers `HospitalAIRecommendations` + `HospitalAnalytics`
- `LaboratoireForm` → bouton vers `LabAIAnalysis` + `LabAnalytics`

### PRIORITE 3 - MAJEUR (Creer les dashboards manquants)

Dashboards partenaires a creer:
1. **AssuranceDashboard** - Pour les compagnies d'assurance (gestion polices, devis, clients)
2. **AutomobileDashboard** - Pour les concessionnaires/vendeurs (gestion stock vehicules)
3. **RestaurantDashboard** - Pour les restaurants (gestion menu, commandes, horaires)
4. **SupermarketPartnerDashboard** - Pour les supermarches (gestion catalogue, stocks, promos)
5. **OrientationPartnerDashboard** - Pour les etablissements (gestion programmes, inscriptions)

### PRIORITE 4 - IMPORTANT (Ameliorer GestionServicesSpecialises)

Si cet ecran est conserve comme ecran intermediaire:
- Filtrer automatiquement par `user.partner_type` (ne montrer QUE les services du type du partenaire)
- Ajouter un bouton "Acceder a mon dashboard" en haut qui redirige vers l'ecran dedie
- Ou mieux: SUPPRIMER cet ecran et rediriger directement vers le dashboard du type

### PRIORITE 5 - AMELIORATION UX

- Ajouter des ErrorBoundary autour de chaque ecran specialise
- Ajouter des fallbacks quand les endpoints IA echouent (message explicite au lieu de crash)
- Harmoniser les designs (LinearGradient, modernColors, SafeIcon) sur TOUS les ecrans
- Ajouter des tutoriels/onboarding pour les nouveaux partenaires

---

## ANNEXE: INVENTAIRE COMPLET DES FICHIERS

### Ecrans partenaires (formulaires/dashboards)
| Service | Fichier | Lignes | Etat |
|---------|---------|--------|------|
| Pharmacie | `PharmacieFormScreen.tsx` | 853 | ✅ Dashboard + Form |
| Hopital | `HopitalFormScreen.tsx` | 520 | ✅ Dashboard + Form |
| Laboratoire | `LaboratoireFormScreen.tsx` | 563 | ✅ Dashboard + Form |
| Banque Sang | `BanqueSangFormScreen.tsx` | 452 | ✅ Dashboard + Form |
| Agence Voyage | `AgenceVoyageFormScreen.tsx` | 779 | ✅ Dashboard + Form |
| Covoiturage | `CovoiturageFormScreen.tsx` | 632 | ✅ Dashboard + Form |
| Taxi | `TaxiFormScreen.tsx` | 452 | ✅ Dashboard + Form |
| Hotel/Meuble | `HotelDashboardScreen.tsx` | 1052 | ✅ Dashboard (INACCESSIBLE) |
| Supermarche | `SupermarketHomeScreen.tsx` | 1632 | ⚠️ Partage user/partner |
| Immobilier | `ImmobilierFormScreen.tsx` | 436 | ✅ Form only |
| Offres Emploi | `OffresEmploiFormScreen.tsx` | 842 | ✅ Form only (NON ROUTE) |
| Livre Scolaire | `LivreScolaireFormScreen.tsx` | 1247 | ✅ Form + IA |
| Orientation | `CreateEtablissementScreen.tsx` | ? | ✅ Form (NON ROUTE) |
| Assurance | - | - | ❌ INEXISTANT |
| Automobile | - | - | ❌ INEXISTANT |
| Menu/Restaurant | - | - | ❌ INEXISTANT |

### Routes backend
| Service | Fichier routes | Etat |
|---------|---------------|------|
| Services specialises | `specialized_services_routes.rs` | ✅ 288 matches (pharmacie, hopital, labo, agence, covoit, taxi, banque sang) |
| Hotel/Meuble | `hotel_room_management_routes.rs` | ✅ 32 matches (16+ endpoints) |
| Orientation | `orientation_scolaire_routes.rs` | ✅ 61 matches |
| Assurance | `assurance_routes.rs` | ✅ 18 matches |
| Bourse Livre | `bourse_livre_routes.rs` | ✅ 14 matches |
| Offres Emploi | `offres_emploi_routes.rs` | ✅ (existe) |
| Navigation/Taxi | `taxi_realtime_metrics_routes.rs` | ✅ 5 matches |
| Vehicules | `vehicle_model_routes.rs` | ✅ (existe) |
