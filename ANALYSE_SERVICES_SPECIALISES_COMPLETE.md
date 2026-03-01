# Analyse Complète des Services Spécialisés - Mobile vs Backend

**Date**: 2026-03-01  
**Objectif**: Vérifier si chaque écran mobile exploite toutes les fonctionnalités backend disponibles.

---

## Architecture Globale

### HomeScreen → 6 catégories → 15 services affichés
| Catégorie | Services HomeScreen | Écrans Form (prestataire) | Écrans Search/Home (utilisateur) |
|-----------|-------------------|--------------------------|----------------------------------|
| **Santé** | Pharmacie, Hôpital, Laboratoire, Transfusion | PharmacieForm, HopitalForm, LaboratoireForm, BanqueSangForm | PharmacieSearch, HopitalSearch, LaboratoireSearch, BanqueSangSearch |
| **Transport** | Ticket voyage, Covoiturage, Taxi | AgenceVoyageForm, CovoiturageForm, TaxiForm | BusTicketSearch, CovoiturageSearch, TaxiSearch |
| **Éducation** | Orientation, Troc livre | (OrientationScolaireHub), LivreScolaireForm | OrientationScolaireHub, LivreScolaireSearch |
| **Emploi** | Offres d'Emploi | OffresEmploiForm (via CreateOffre) | OffresEmploiHub → OffreSearch |
| **Cuisine** | Mon menu, BayamSelam | MenuPlanningHub | MenuPlanningHub, BayamSelamSearch |
| **Immobilier** | Immobilier, Hôtel, Meublé | ImmobilierForm | ImmobilierSearch |

---

## 1. PHARMACIE 🟢 Très bon (85%)

### Backend disponible
| Endpoint | Méthode | Description | Mobile exploité? |
|----------|---------|-------------|-----------------|
| `POST /api/pharmacies` | Création | Créer pharmacie | ✅ PharmacieFormScreen |
| `GET /api/pharmacies/search` | Public | Rechercher pharmacies | ✅ PharmacieSearchScreen |
| `GET /api/pharmacies/on-duty` | Public | Pharmacies de garde | ✅ PharmacieSearchScreen (filtre) |
| `GET /api/pharmacies/{id}` | Public | Détails pharmacie | ✅ PharmacieHomeScreen |
| `GET /api/pharmacies/{id}/products` | JWT | Produits pharmacie | ✅ PharmacieFormScreen |
| `POST /api/pharmacies/products` | JWT | Créer produit | ✅ PharmacieFormScreen |
| `PATCH /api/pharmacies/products/{id}` | JWT | Modifier produit | ✅ PharmacieFormScreen |
| `DELETE /api/pharmacies/products/{id}` | JWT | Supprimer produit | ✅ PharmacieFormScreen |
| `POST /api/pharmacies/products/bulk-import` | JWT | Import en masse | ✅ PharmacieFormScreen |
| `GET /api/pharmacies/products/search` | JWT | Rechercher produits | ✅ PharmacieSearchScreen (productSearch) |
| `POST /api/pharmacies/products/budget` | JWT | Calcul budget | ❌ **NON EXPLOITÉ** |
| `POST /api/pharmacies/{id}/check-availability` | JWT | Vérifier dispo médicament | ❌ **NON EXPLOITÉ** |
| `POST /api/pharmacies/{id}/reserve-medication` | JWT | Réserver médicament | ❌ **NON EXPLOITÉ** |
| `POST /api/pharmacies/{id}/order` | JWT | Commander médicament | ❌ **NON EXPLOITÉ** |
| `POST /api/pharmacies/ai/interactions` | JWT | Interactions médicamenteuses IA | ❌ **NON EXPLOITÉ** |
| `POST /api/pharmacies/ai/dosage` | JWT | Suggestion dosage IA | ❌ **NON EXPLOITÉ** |
| `GET /api/pharmacies/my-orders` | JWT | Mes commandes | ❌ **NON EXPLOITÉ** |
| `GET /api/pharmacies/{id}/analytics` | JWT | Analytics pharmacie | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées
1. **Réservation de médicament** - Le backend permet de réserver un médicament, mais aucun bouton n'existe dans PharmacieHomeScreen ou PharmacieSearchScreen
2. **Commande de médicament** - Endpoint `POST /api/pharmacies/{id}/order` non utilisé
3. **Vérification interactions médicamenteuses IA** - Fonctionnalité backend puissante, absente du mobile
4. **Suggestion dosage IA** - Absent du mobile
5. **Calcul budget pharmacie** - Absent du mobile
6. **Historique commandes** - `GET /api/pharmacies/my-orders` non appelé
7. **Analytics pharmacie** - Dashboard analytique absent pour le prestataire

---

## 2. HÔPITAL/CLINIQUE 🟡 Moyen (65%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/hopitaux` | ✅ HopitalFormScreen |
| `GET /api/hopitaux/search` | ✅ HopitalSearchScreen |
| `GET /api/hopitaux/{id}` | ✅ HopitalHomeScreen |
| `GET /api/hopitaux/services/autocomplete` | ❌ **NON EXPLOITÉ** |
| `POST /api/hopitaux/ai/search-pathology` | ❌ **NON EXPLOITÉ** |
| `POST /api/hopitaux/{id}/slots` | ✅ HopitalFormScreen (gestion créneaux) |
| `POST /api/hopitaux/{id}/book` (TODO) | ❌ Route commentée backend |
| `GET /api/hopitaux/{id}/wait-times` (TODO) | ❌ Route commentée backend |
| `GET /api/hopitaux/{id}/emergency-status` (TODO) | ❌ Route commentée backend |
| `POST /api/hopitaux/ai/recommendations` (TODO) | ❌ Route commentée backend |
| `POST /api/hopitaux/ai/triage` (TODO) | ❌ Route commentée backend |

### Lacunes identifiées
1. **Recherche par pathologie IA** - Le backend a `search-pathology` actif mais le mobile ne l'utilise pas dans HopitalSearchScreen
2. **Autocomplete services médicaux** - Backend actif, mobile n'appelle pas cet endpoint pour aider l'utilisateur à trouver le bon service
3. **Prise de RDV en ligne** - Le formulaire a un switch `rdv_en_ligne` mais il n'y a AUCUN écran de réservation côté utilisateur
4. **Temps d'attente** - Routes commentées dans le backend (TODO)
5. **Statut urgences** - Routes commentées dans le backend (TODO)
6. **Triage IA** - Route commentée (TODO)

---

## 3. LABORATOIRE 🟡 Moyen (60%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/laboratoires` | ✅ LaboratoireFormScreen |
| `GET /api/laboratoires/search` | ✅ LaboratoireSearchScreen |
| `GET /api/laboratoires/{id}` | ✅ LaboratoireHomeScreen |
| `GET /api/laboratoires/{id}/examination-types` | ✅ LaboratoireFormScreen (chargement examens) |
| `POST /api/laboratoires/{id}/book-examination` | ❌ **NON EXPLOITÉ** |
| `GET /api/laboratoires/examinations/{id}/results` | ❌ **NON EXPLOITÉ** |
| `POST /api/laboratoires/examinations/{id}/analyze` | ❌ **NON EXPLOITÉ** |
| `GET /api/laboratoires/my-examinations` | ❌ **NON EXPLOITÉ** |
| `GET /api/laboratoires/{id}/analytics` | ❌ **NON EXPLOITÉ** |
| `GET /api/laboratoires/examinations/autocomplete` | ❌ **NON EXPLOITÉ** |
| `POST /api/laboratoires/examinations/analyze-image` | ❌ **NON EXPLOITÉ** |
| `POST /api/laboratoires/ai/search-pathology` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées
1. **Réservation d'examen** - Backend prêt, AUCUN écran mobile pour qu'un utilisateur réserve un examen
2. **Résultats d'examens** - Backend peut renvoyer les résultats, aucun écran "Mes résultats"
3. **Analyse IA des résultats** - Backend peut analyser, non exploité
4. **Analyse d'image d'examen** - Backend peut analyser une image d'examen, non exploité
5. **Recherche par pathologie** - Même que hôpital, backend actif mais mobile absent
6. **Autocomplete types d'examens** - Backend actif, non utilisé dans la recherche utilisateur
7. **Mes examens** - Historique non accessible côté mobile
8. **Analytics** - Absent pour le prestataire

---

## 4. BANQUE DE SANG 🟡 Moyen (60%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/banques-sang` | ✅ BanqueSangFormScreen |
| `GET /api/banques-sang/search` | ✅ BanqueSangSearchScreen |
| `GET /api/banques-sang/{id}` | ✅ |
| `POST /api/banques-sang/{id}/stocks` | ✅ BanqueSangFormScreen (stocks par groupe) |
| `GET /api/banques-sang/{id}/statistics` | ❌ **NON EXPLOITÉ** |
| `POST /api/blood-donation/requests` | ❌ **NON EXPLOITÉ** |
| `GET /api/blood-donation/requests` | ❌ **NON EXPLOITÉ** |
| `GET /api/blood-donation/requests/{id}/matches` | ❌ **NON EXPLOITÉ** |
| `POST /api/blood-donation/requests/notify` | ❌ **NON EXPLOITÉ** |
| `POST /api/blood-donation/matches/update-status` | ❌ **NON EXPLOITÉ** |
| `POST /api/blood-donation/donor/update-last-donation` | ❌ **NON EXPLOITÉ** |
| `GET /api/blood-donation/donor/blood-groups` | ❌ **NON EXPLOITÉ** |
| `POST /api/blood-donation/donor/blood-group` | ❌ **NON EXPLOITÉ** |
| `GET /api/blood-donation/compatibility/{group}` | ❌ **NON EXPLOITÉ** |
| `GET /api/blood-donation/compatibility` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées - CRITIQUES
1. **Système complet de matching donneur/receveur** - Le backend a un système intelligent de matching donneur complet (créer demande, trouver matches, notifier donneurs, accepter/refuser). **AUCUN écran mobile ne l'utilise.**
2. **Profil donneur** - Le backend permet de sauvegarder son groupe sanguin et date de dernière donation. Non exploité.
3. **Compatibilité groupes sanguins** - Tableau de compatibilité disponible, non affiché.
4. **Statistiques banque de sang** - Analytics non accessibles.
5. **Notifications aux donneurs** - Backend peut notifier les donneurs compatibles. Non exploité.

---

## 5. AGENCE DE VOYAGE / TICKETS BUS 🟢 Bon (80%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/agences-voyage` | ✅ AgenceVoyageFormScreen |
| `GET /api/agences-voyage/search` | ✅ |
| `GET /api/agences-voyage/{id}` | ✅ |
| `GET /api/bus-tickets/search` | ✅ BusTicketSearchScreen |
| `GET /api/bus-tickets/{id}/availability` | ✅ |
| `POST /api/bus-tickets/create-product` | ✅ AgenceVoyageFormScreen |
| `POST /api/bus-tickets/link` | ✅ |
| `GET /api/bus-tickets/agency/tickets` | ✅ |
| `POST /api/bus-tickets/reservations` | ✅ TicketVoyageHomeScreen |
| `PATCH /api/bus-tickets/reservations/{id}/cancel` | ✅ |
| `POST /api/bus-tickets/payment` | ✅ |
| `GET /api/bus-tickets/my-tickets` | ✅ |
| `GET /api/bus-tickets/ticket/{payment_id}` | ✅ |
| `POST /api/bus-tickets/validate` | ✅ |
| `GET /api/bus-tickets/boarding/{id}/summary` | ✅ |
| `GET /api/bus-tickets/boarding/{id}/passengers` | ✅ |
| `POST /api/bus-tickets/validate/manual` | ✅ |
| `POST /api/bus-tickets/seats/block` | ❌ **NON EXPLOITÉ** |
| `POST /api/bus-tickets/seats/unblock` | ❌ **NON EXPLOITÉ** |
| `GET /api/bus-tickets/seats/{id}/blocks` | ❌ **NON EXPLOITÉ** |
| `GET /api/bus-tickets/seats/{id}/availability` | ❌ **NON EXPLOITÉ** |
| `POST /api/bus-tickets/return-request` | ✅ BusReturnRequestFormScreen |
| `GET /api/bus-tickets/return-requests` | ✅ |
| Horaires agence (CRUD) | ✅ AgenceVoyageFormScreen |

### Lacunes identifiées
1. **Gestion places bloquées** - Backend permet de bloquer/débloquer des sièges spécifiques. Non accessible pour le gestionnaire d'agence depuis le mobile.
2. **Affichage disponibilité avec blocs** - `seats/{id}/availability` avec détail des sièges bloqués non utilisé.

---

## 6. COVOITURAGE 🔴 Insuffisant (40%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/covoiturages` | ✅ CovoiturageFormScreen |
| `GET /api/covoiturages` | ✅ CovoiturageSearchScreen |
| `GET /api/covoiturages/search` | ✅ |
| `GET /api/covoiturages/nearby` | ❌ **NON EXPLOITÉ** |
| `GET /api/covoiturages/{id}` | ✅ |
| `GET /api/covoiturages/{id}/reviews` | ❌ **NON EXPLOITÉ** |
| `POST /api/covoiturages/{id}/book` (TODO) | ❌ Route commentée |
| `GET /api/covoiturages/my-trips` (TODO) | ❌ Route commentée |
| `POST /api/covoiturages/{id}/verify-driver` (TODO) | ❌ Route commentée |
| `POST /api/covoiturages/intelligent-matching` (TODO) | ❌ Route commentée |
| `POST /api/covoiturages/{id}/set-recurring` (TODO) | ❌ Route commentée |

### Lacunes identifiées - CRITIQUES
1. **Réservation de place** - Le formulaire mobile propose `is_recurring` et des places disponibles mais il n'y a **AUCUN écran pour qu'un passager réserve une place**
2. **Mes trajets** - Route commentée, le mobile a un bouton "Mes trajets" dans SpecializedServicesHubScreen mais la route backend n'existe pas
3. **Recherche à proximité** - `GET /api/covoiturages/nearby` actif mais non utilisé par CovoiturageSearchScreen
4. **Avis conducteur** - `GET /api/covoiturages/{id}/reviews` actif mais non affiché
5. **Vérification conducteur** - Route commentée
6. **Matching intelligent** - Route commentée
7. **Trajets récurrents** - Le formulaire mobile a les champs (is_recurring, recurrence_type, etc.) mais les routes backend sont commentées

---

## 7. TAXI 🔴 Insuffisant (35%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/taxis` | ✅ TaxiFormScreen |
| `GET /api/taxis` | ✅ TaxiSearchScreen |
| `GET /api/taxis/search` | ✅ |
| `GET /api/taxis/{id}` | ✅ |
| `POST /api/taxis/{id}/book` (TODO) | ❌ Route commentée |
| `POST /api/taxis/{id}/update-availability` (TODO) | ❌ Route commentée |
| `POST /api/taxi/demand-prediction` | ❌ **NON EXPLOITÉ** |
| `POST /api/taxi/demand-prediction/multi-zone` | ❌ **NON EXPLOITÉ** |
| `GET /api/taxi/demand-prediction/heatmap` | ❌ **NON EXPLOITÉ** |
| `GET /api/taxi/demand-prediction/metrics` | ❌ **NON EXPLOITÉ** |
| `POST /api/taxi/optimize-route` | ❌ **NON EXPLOITÉ** |
| `GET /api/taxi/personalized-recommendations` | ❌ **NON EXPLOITÉ** |
| `GET /api/admin/taxi/analytics/overview` | ❌ **NON EXPLOITÉ** |
| `GET /api/admin/taxi/analytics/demand-trends` | ❌ **NON EXPLOITÉ** |
| `GET /api/admin/taxi/analytics/revenue` | ❌ **NON EXPLOITÉ** |
| `GET /api/admin/taxi/analytics/driver-performance` | ❌ **NON EXPLOITÉ** |
| `POST /api/taxi/dynamic-price` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées - CRITIQUES
1. **Réservation/Appel taxi** - Route `book` commentée. AUCUN moyen pour un utilisateur de réserver un taxi
2. **Mise à jour disponibilité** - Le chauffeur ne peut pas signaler sa disponibilité en temps réel
3. **Prédiction demande IA** - Backend a 4 endpoints de prédiction de demande. **Zéro écran mobile**
4. **Heatmap demande** - Backend prêt, non affiché
5. **Optimisation itinéraire IA** - Backend prêt, non utilisé
6. **Recommandations personnalisées** - Backend prêt, non utilisé
7. **Prix dynamique IA** - Backend calcule un prix dynamique basé sur l'offre/demande. Non exploité
8. **Analytics complet** (overview, trends, revenue, driver performance) - 4 endpoints backend, aucun dashboard mobile
9. **Performance conducteurs** - Non accessible

---

## 8. OFFRES D'EMPLOI 🟡 Moyen (65%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `GET /api/offres-emploi/search` | ✅ OffreSearchScreen |
| `GET /api/offres-emploi/{id}` | ✅ OffreDetailsScreen |
| `GET /api/offres-emploi/tendances` | ❌ **NON EXPLOITÉ** |
| `GET /api/offres-emploi/ai/salary-prediction` | ❌ Bouton Alert "À venir" dans OffresEmploiHubScreen |
| `POST /api/offres-emploi/profil` | ✅ ProfilCandidatScreen |
| `GET /api/offres-emploi/profil` | ✅ |
| `GET /api/offres-emploi/matching/offres` | ✅ (navigation OffreMatching) |
| `POST /api/offres-emploi/candidatures` | ✅ |
| `GET /api/offres-emploi/mes-candidatures` | ✅ MesCandidatures |
| `POST /api/offres-emploi/alertes` | ❌ **NON EXPLOITÉ** |
| `GET /api/offres-emploi/alertes` | ❌ **NON EXPLOITÉ** |
| `GET /api/offres-emploi/dashboard/candidat` | ✅ OffresEmploiHubScreen |
| `POST /api/offres-emploi` | ✅ CreateOffreScreen |
| `GET /api/offres-emploi` (mes offres) | ✅ MesOffresScreen |
| `PATCH /api/offres-emploi/{id}/close` | ✅ |
| `GET /api/offres-emploi/{id}/candidatures` | ✅ OffreCandidaturesScreen |
| `PATCH /api/offres-emploi/candidatures/{id}/statut` | ✅ |
| `GET /api/offres-emploi/{id}/matching/candidats` | ❌ **NON EXPLOITÉ** |
| `GET /api/offres-emploi/{id}/stats` | ❌ **NON EXPLOITÉ** |
| `GET /api/offres-emploi/dashboard/employeur` | ✅ (navigation DashboardEmploi) |
| `POST /api/offres-emploi/ai/matching` | ❌ **NON EXPLOITÉ** |
| `POST /api/offres-emploi/ai/analyze-cv` | ✅ AICVAnalysisScreen, AnalyseCVScreen |
| `POST /api/offres-emploi/ai/suggest-formations` | ✅ AISuggestFormationsScreen |

### Lacunes identifiées
1. **Alertes emploi** - Backend CRUD complet pour alertes. AUCUN écran mobile pour créer/gérer des alertes
2. **Tendances marché** - Endpoint public actif, non affiché. Pourrait enrichir le Hub
3. **Prédiction salaire IA** - Endpoint actif mais le bouton affiche `Alert("À venir")` - **Écran AISalaryPredictionScreen existe mais n'est pas connecté**
4. **Matching candidats pour employeur** - L'employeur ne peut pas voir les candidats qui matchent automatiquement son offre
5. **Statistiques par offre** - `GET /api/offres-emploi/{id}/stats` non utilisé par MesOffresScreen
6. **Matching IA** - Endpoint `POST ai/matching` distinct du matching normal, non exploité

---

## 9. IMMOBILIER 🟢 Bon (75%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/immobilier/biens` | ✅ ImmobilierFormScreen |
| `GET /api/immobilier/biens` | ✅ ImmobilierSearchScreen |
| `GET /api/immobilier/biens/{id}` | ✅ |
| `POST /api/immobilier/ai/recommendations` | ✅ RealEstateAIFeatures |
| `POST /api/immobilier/ai/price-estimate` | ✅ RealEstateAIFeatures |
| `GET /api/immobilier/analytics` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/favorite` | ❌ **NON EXPLOITÉ** |
| `DELETE /api/immobilier/biens/{id}/unfavorite` | ❌ **NON EXPLOITÉ** |
| `GET /api/immobilier/my-favorites` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/compare` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/alerts` | ❌ **NON EXPLOITÉ** |
| `GET /api/immobilier/my-alerts` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/track-view` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/share` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/upload-virtual-tour` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/book-visit` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/simulate-loan` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/biens/{id}/upload-media` | ✅ ImmobilierFormScreen (MediaUploader) |
| `GET /api/immobilier/my-visits` | ❌ **NON EXPLOITÉ** |
| `GET /api/immobilier/terrains` | ❌ **NON EXPLOITÉ** |
| `GET /api/immobilier/terrains/{id}` | ❌ **NON EXPLOITÉ** |
| `POST /api/immobilier/terrains/ai/analysis` | ❌ **NON EXPLOITÉ** |
| `GET /api/decoration/decorateurs` | ❌ **NON EXPLOITÉ** |
| `POST /api/decoration/ai/suggestions` | ❌ **NON EXPLOITÉ** |
| `POST /api/demenagement/quote` | ❌ **NON EXPLOITÉ** |
| `POST /api/demenagement/book` | ❌ **NON EXPLOITÉ** |
| `GET /api/demenagement/tracking/{id}` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées - NOMBREUSES
1. **Favoris** - Backend CRUD complet. Aucun bouton ❤️ dans les résultats de recherche
2. **Comparaison de biens** - Backend prêt. Aucun écran de comparaison
3. **Alertes prix** - Backend CRUD complet. Aucun écran pour créer une alerte quand un bien correspond à ses critères
4. **Réservation de visite** - Backend prêt (`book-visit`). Aucun bouton "Réserver une visite"
5. **Simulation de prêt** - Backend prêt (`simulate-loan`). Aucun calculateur de prêt
6. **Visite virtuelle** - Backend permet l'upload, non exploité
7. **Tracking vues** - Non utilisé (analytics)
8. **Partage** - Endpoint dédié non utilisé
9. **Mes visites** - Historique des visites non accessible
10. **Terrains** - 3 endpoints dédiés aux terrains (recherche, détails, analyse IA). **AUCUN écran mobile**
11. **Décoration** - 2 endpoints (recherche décorateurs, suggestions IA). **AUCUN écran mobile**
12. **Déménagement** - 3 endpoints (devis, réservation, suivi). **AUCUN écran mobile**
13. **Analytics immobilier** - Non exploité

---

## 10. LIVRES SCOLAIRES / BOURSE DU LIVRE 🟢 Très bon (85%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `GET /api/livres-scolaires/search` | ✅ LivreScolaireSearchScreen |
| `GET /api/livres-scolaires/{id}` | ✅ |
| `POST /api/livres-scolaires` | ✅ LivreScolaireFormScreen |
| `GET /api/livres-scolaires/mes-livres` | ✅ MesLivres |
| `PUT /api/livres-scolaires/{id}` | ✅ |
| `DELETE /api/livres-scolaires/{id}` | ✅ |
| `POST /api/livres-scolaires/{id}/upload-images` | ✅ LivreScolaireFormScreen |
| `POST /api/livres-scolaires/{id}/upload-video` | ❌ **NON EXPLOITÉ** |
| `PATCH /api/livres-scolaires/{id}/availability` | ❌ **NON EXPLOITÉ** |

### Troc de livres
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/troc-livres/match` | ✅ |
| `POST /api/troc-livres/direct` | ✅ |
| `POST /api/troc-livres/chaine` | ✅ |
| `GET /api/troc-livres/my-trocs` | ✅ MesTrocs |
| `POST /api/troc-livres/{id}/accept` | ✅ |
| `POST /api/troc-livres/{id}/refuse` | ✅ |
| `POST /api/troc-livres/{id}/complete` | ✅ |
| `GET /api/troc-livres/{id}` | ✅ |
| `GET /api/troc-livres/chaines/{id}` | ✅ |

### Lacunes identifiées
1. **Upload vidéo** - Backend prêt, formulaire n'offre que l'upload d'images
2. **Gestion disponibilité** - Backend permet de marquer un livre comme dispo/indispo. Non exploité

---

## 11. ORIENTATION SCOLAIRE 🟡 Moyen (70%)

Écrans: `OrientationScolaireHubScreen`, `OrientationScolaireHomeScreen`, `EtablissementSearchScreen`

### Analyse
- Le Hub sert de dashboard avec accès aux fonctionnalités
- La recherche d'établissements est fonctionnelle
- **Pas de routes backend dédiées** dans `specialized_services_routes.rs` pour l'orientation scolaire → les données semblent venir d'une base externe ou de l'IA générale
- Manque de détail sur les endpoints backend utilisés

---

## 12. MENU PLANNING 🟢 Bon (80%)

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/menus/ai/generate-week` | ✅ MenuPlanningHubScreen |
| `POST /api/menus/ai/generate-recipe` | ✅ MenuPlanningHubScreen |
| `GET /api/menus/my-week` | ✅ |
| `GET /api/menus/family-profile` | ✅ |
| `PUT /api/menus/family-profile` | ✅ |
| `POST /api/menus/ai/generate-shopping-list` | ❌ **NON EXPLOITÉ** |
| `GET /api/menus/history` | ✅ |

### Lacunes identifiées
1. **Liste de courses IA** - Backend peut générer une liste de courses intelligente basée sur le menu de la semaine. **Non accessible depuis le mobile** (ou partiellement via RecipeSearchScreen ?)

---

## 13. BAYAM SELAM (Comparatif prix) 🟠 Basique (50%)

- Écran `BayamSelamSearchScreen` et `SupermarketHomeScreen` existent
- Comparaison de prix de produits alimentaires entre supermarchés
- **Pas de routes backend dédiées visibles** dans les routes spécialisées → probablement utilise les routes produits/services génériques
- Manque d'intégration backend profonde

---

## 14. SERVICES TRANSVERSAUX (Réservations, Ratings, Chat, Paiement) 🟡 Moyen

### Backend disponible - Non spécifique à un service
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/specialized-services/reservations` | Partiellement (bus tickets) |
| `GET /api/specialized-services/reservations` | Partiellement |
| `GET /api/specialized-services/reservations/prestataire` | ❌ **NON EXPLOITÉ** |
| `PATCH .../reservations/{id}/confirm` | ❌ **NON EXPLOITÉ** |
| `PATCH .../reservations/{id}/cancel` | Partiellement |
| `POST /api/specialized-services/ratings` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/{id}/ratings` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/{id}/ratings/stats` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/ratings/{id}/helpful` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/{id}/chat/conversation` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/chat/{id}/message` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/chat/conversations` | ❌ **NON EXPLOITÉ** |
| `POST .../reservations/{id}/payment` | ❌ **NON EXPLOITÉ** |
| `POST .../reservations/{id}/refund` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées - MAJEURES
1. **Système d'avis/ratings** - Backend complet (créer avis, stats, marquer utile). **AUCUN écran mobile** pour noter un service spécialisé ou voir les avis
2. **Chat intégré** - Backend complet (créer conversation, envoyer message, lister). **AUCUN écran mobile dédié**
3. **Paiement intégré** - Backend complet (payer réservation, rembourser). Non exploité sauf tickets bus
4. **Confirmation réservation prestataire** - Le prestataire ne peut pas confirmer/refuser une réservation depuis le mobile

---

## 15. FONCTIONNALITÉS UNIFIED (Brouillons, Templates, Recherches sauvegardées) 🔴 Non exploité

### Backend disponible
| Endpoint | Mobile exploité? |
|----------|-----------------|
| `POST /api/specialized-services/drafts` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/drafts` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/templates` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/search-history` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/search-history` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/saved-searches` | ❌ **NON EXPLOITÉ** |
| `GET /api/specialized-services/saved-searches` | ❌ **NON EXPLOITÉ** |
| `DELETE /api/specialized-services/saved-searches/{id}` | ❌ **NON EXPLOITÉ** |
| `PATCH /api/specialized-services/batch` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/sync` | ❌ **NON EXPLOITÉ** |
| `POST /api/specialized-services/conflicts/resolve` | ❌ **NON EXPLOITÉ** |

### Lacunes identifiées
1. **Sauvegarde brouillons** - Si l'utilisateur quitte un formulaire, tout est perdu. Backend prêt pour sauvegarder/restaurer
2. **Templates** - Backend peut proposer des templates pré-remplis par type. Non utilisé
3. **Historique de recherches** - Non utilisé
4. **Recherches sauvegardées** - Non utilisé
5. **Actions batch** - Non utilisé
6. **Sync hors ligne** - Non utilisé

---

# RÉSUMÉ DES LACUNES PAR PRIORITÉ

## 🔴 CRITIQUE (Impact utilisateur majeur)

| # | Service | Fonctionnalité manquante | Impact |
|---|---------|--------------------------|--------|
| 1 | **Taxi** | Aucun moyen de réserver/appeler un taxi | Service inutilisable pour l'utilisateur |
| 2 | **Covoiturage** | Aucun moyen de réserver une place | Service inutilisable pour l'utilisateur |
| 3 | **Banque de sang** | Système matching donneur complet non exposé | Fonctionnalité vitale inexploitée |
| 4 | **Laboratoire** | Réservation d'examen impossible | Service inutilisable pour l'utilisateur |
| 5 | **Hôpital** | Prise de RDV en ligne impossible | Switch `rdv_en_ligne` trompeur |
| 6 | **Tous services** | Système d'avis/ratings absent | Confiance utilisateur impossible |
| 7 | **Tous services** | Chat intégré absent | Communication impossible |

## 🟠 IMPORTANT (Fonctionnalité significative manquante)

| # | Service | Fonctionnalité manquante |
|---|---------|--------------------------|
| 8 | **Pharmacie** | Réservation/commande médicament |
| 9 | **Pharmacie** | Interactions médicamenteuses IA |
| 10 | **Immobilier** | Favoris, comparaison, simulation prêt, visites |
| 11 | **Immobilier** | Terrains (3 endpoints non exploités) |
| 12 | **Immobilier** | Déménagement (3 endpoints non exploités) |
| 13 | **Emploi** | Alertes emploi |
| 14 | **Emploi** | Prédiction salaire (écran existe mais non connecté) |
| 15 | **Taxi** | IA prédictive (6+ endpoints non exploités) |
| 16 | **Taxi** | Prix dynamique IA |
| 17 | **Tous** | Brouillons de formulaires |

## 🟡 SOUHAITABLE (Amélioration UX)

| # | Service | Fonctionnalité manquante |
|---|---------|--------------------------|
| 18 | **Laboratoire** | Résultats examens / analyse IA |
| 19 | **Hôpital** | Recherche par pathologie IA |
| 20 | **Menu** | Liste courses IA |
| 21 | **Livres** | Upload vidéo |
| 22 | **Immobilier** | Décoration IA, alertes prix |
| 23 | **Tous** | Templates, historique recherches |
| 24 | **Tous** | Recherches sauvegardées |
| 25 | **Bus** | Gestion sièges bloqués |

---

# SCORE GLOBAL PAR SERVICE

| Service | Score | Commentaire |
|---------|-------|-------------|
| Livres Scolaires | 85% 🟢 | Très complet, manque upload vidéo et disponibilité |
| Pharmacie | 85% 🟢 | Bon pour la gestion, manque côté utilisateur (commande, IA) |
| Agence Voyage/Bus | 80% 🟢 | Bon, manque gestion sièges |
| Menu Planning | 80% 🟢 | Bon, manque liste courses IA |
| Immobilier | 75% 🟢 | Bon pour création, manque beaucoup côté utilisateur |
| Orientation Scolaire | 70% 🟡 | Fonctionnel mais peu de backend dédié |
| Emploi | 65% 🟡 | Hub bon, manque alertes et IA non connectée |
| Hôpital | 65% 🟡 | Création OK, IA et RDV non exploités |
| Laboratoire | 60% 🟡 | Création OK, réservation/résultats absents |
| Banque de Sang | 60% 🟡 | Création OK, matching donneur totalement absent |
| BayamSelam | 50% 🟠 | Basique, peu d'intégration backend |
| Covoiturage | 40% 🔴 | Création OK, réservation impossible |
| Taxi | 35% 🔴 | Création OK, réservation et IA totalement absents |
| Services transversaux | 15% 🔴 | Ratings, chat, paiement: presque rien exploité |
| Unified (brouillons, etc.) | 0% 🔴 | Totalement non exploité |

**Score moyen global: ~58%** - Les écrans de CRÉATION de services sont bien faits, mais les écrans UTILISATEUR (recherche, réservation, commande, avis) n'exploitent qu'une fraction des fonctionnalités backend disponibles.
