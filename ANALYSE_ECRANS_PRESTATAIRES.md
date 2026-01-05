# 📋 Analyse des Écrans de Formulaire des Prestataires

## 🎯 Objectif
Vérifier l'alignement fidèle entre les écrans mobiles de création/édition des services spécialisés et la logique backend, notamment pour :
- Pharmacies (intégration API médicaments)
- Hôpitaux
- Laboratoires
- Agences de voyage (configuration tickets bus)
- Taxis
- Covoiturage
- Livres scolaires
- Immobilier
- Offres d'emploi

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. ❌ PharmacieFormScreen - API Médicaments NON INTÉGRÉE

**Problème** : L'écran `PharmacieFormScreen.tsx` ne permet PAS aux prestataires de gérer leurs médicaments/produits.

**Backend disponible** :
- `POST /api/pharmacies/products` - Créer un produit
- `GET /api/pharmacies/{id}/products` - Lister les produits d'une pharmacie
- `PATCH /api/pharmacies/products/{id}` - Modifier un produit
- `DELETE /api/pharmacies/products/{id}` - Supprimer un produit
- `POST /api/pharmacies/products/bulk-import` - Import en masse

**Ce qui manque dans l'écran mobile** :
- Section pour ajouter/gérer les médicaments
- Liste des produits existants
- Formulaire de création de produit (nom, prix, stock, unité, code-barres, catégorie)
- Import en masse de produits

**Impact** : Les pharmacies ne peuvent pas renseigner leur catalogue de médicaments depuis l'application mobile.

---

### 2. ⚠️ AgenceVoyageFormScreen - Configuration Tickets Bus

**État actuel** : ✅ Partiellement implémenté

**Ce qui fonctionne** :
- Création d'agence de voyage
- Configuration `peut_emettre_tickets_bus`
- Gestion des modèles de bus via `BusModelForm`
- Création automatique de produits bus via `/api/bus-tickets/create-product`
- Liaison produits-agence via `/api/bus-tickets/link`

**Points à vérifier** :
- Les modèles de bus sont-ils correctement sauvegardés ?
- La structure `BusModel` correspond-elle au backend ?
- Les compagnies affiliées sont-elles utilisées par le backend ?

---

## ✅ ÉCRANS BIEN ALIGNÉS

### 3. ✅ HopitalFormScreen

**Endpoints utilisés** :
- `POST /api/hopitaux` - Création
- `GET /api/hopitaux/{id}` - Édition

**Champs alignés** :
- `nom`, `type_etablissement`, `adresse`, `quartier`, `gps`
- `prestations_medicales` (avec planning via `PrestationSelectorWithSchedule`)
- `urgences_disponible`, `rdv_en_ligne`
- Coordonnées (téléphone, whatsapp, email, site_web)

**Note** : Utilise `PrestationSelectorWithSchedule` pour gérer les prestations avec horaires.

---

### 4. ✅ LaboratoireFormScreen

**Endpoints utilisés** :
- `POST /api/laboratoires` - Création
- `GET /api/laboratoires/{id}` - Édition

**Champs alignés** :
- `nom`, `type_laboratoire`, `adresse`, `quartier`, `gps`
- `analyses_disponibles`, `imagerie_disponible`
- `heures_ouverture`, `heures_fermeture`, `permanent_24h`
- `rdv_requis`, `resultats_en_ligne`
- Coordonnées

**Note** : Gestion correcte des heures d'ouverture et du flag 24h/24.

---

### 5. ✅ TaxiFormScreen

**Endpoints utilisés** :
- `POST /api/taxis` - Création
- `GET /api/taxis/{id}` - Édition

**Champs alignés** :
- `nom_chauffeur`, `telephone`, `whatsapp`
- `type_vehicule`, `marque_modele`, `immatriculation`, `couleur`, `annee`
- `zone_intervention` (array de `LocationObject`)
- `tarif_base`, `tarif_par_km`, `devise`
- Modes de paiement (cash, mobile money, carte)
- Équipements (climatisation, wifi)
- `image_vehicule` (base64)

**Note** : Devise récupérée automatiquement depuis `zone_intervention`.

---

### 6. ✅ CovoiturageFormScreen

**Endpoints utilisés** :
- `POST /api/covoiturages` - Création
- `GET /api/covoiturages/{id}` - Édition

**Champs alignés** :
- `depart`, `destination` (LocationObject)
- `date_depart`, `heure_depart`
- `type_vehicule`, `marque_modele`
- `nombre_places`, `places_disponibles`
- `prix_par_place`, `devise`
- Options (bagages, animaux, fumeur, climatisation)
- `image_vehicule` (base64)
- ✅ **NOUVEAU** : Trajets récurrents (`is_recurring`, `recurrence_type`, `recurrence_days`, `recurrence_end_date`)

**Note** : Support des trajets récurrents (daily, weekly, monthly).

---

### 7. ✅ LivreScolaireFormScreen

**Endpoints utilisés** :
- `POST /api/livres-scolaires` - Création
- `PUT /api/livres-scolaires/{id}` - Édition
- `GET /api/livres-scolaires/{id}` - Chargement

**Champs alignés** :
- `titre`, `auteur`, `editeur`, `isbn`
- `classe_actuelle`, `classe_souhaitee`
- `matiere`, `niveau`
- `etat_livre`, `description_etat`
- `ville`, `quartier`, `gps`

**Note** : Utilise `PUT` pour l'édition (conforme au backend).

---

## ⚠️ ÉCRANS MANQUANTS

### 8. ❌ ImmobilierFormScreen - N'EXISTE PAS

**Backend disponible** :
- `GET /api/immobilier/biens` - Rechercher des biens (avec filtres)
- `GET /api/immobilier/biens/{id}` - Détails d'un bien
- `POST /api/immobilier/biens/{id}/upload-media` - Upload médias
- `POST /api/immobilier/biens/{id}/upload-virtual-tour` - Visite virtuelle
- `POST /api/immobilier/biens/{id}/book-visit` - Réserver une visite
- `POST /api/immobilier/biens/{id}/simulate-loan` - Simuler un prêt

**⚠️ IMPORTANT** : Il n'existe **PAS** d'endpoint `POST /api/immobilier/biens` pour créer un bien.

**Hypothèse** : Les biens immobiliers sont créés via le système générique `/api/services/create` avec `specialized_type = 'immobilier'`, puis les détails sont ajoutés dans la table `real_estate_properties`.

**Structure table `real_estate_properties`** (d'après `search_properties`) :
- `service_id` (référence à `services`)
- `user_id`
- `titre`, `description`
- `type_bien` (maison, appartement, terrain, etc.)
- `statut` (vente, location, les deux)
- `adresse`, `quartier`, `ville`, `gps`
- `superficie_m2`, `nb_chambres`, `nb_salles_bain`
- `standing`, `etat_general`
- `prix_vente`, `prix_location_mensuel`
- `photos` (array)
- `is_available_now`

**Impact** : Les prestataires immobiliers ne peuvent pas créer/modifier leurs biens depuis l'application mobile. Il faudrait soit :
1. Créer un endpoint `POST /api/immobilier/biens` qui crée le service ET le bien
2. Ou créer un écran qui utilise `/api/services/create` puis met à jour `real_estate_properties`

---

### 9. ❌ OffresEmploiFormScreen - N'EXISTE PAS

**Backend disponible** :
- ❌ **AUCUN endpoint trouvé** dans `specialized_services_controller.rs` pour les offres d'emploi
- Vérifier si les offres d'emploi utilisent le système générique `/api/services/create`

**Impact** : Les recruteurs ne peuvent pas créer/modifier leurs offres d'emploi depuis l'application mobile.

**Note** : Si les offres d'emploi utilisent le système générique, il faudrait créer un écran similaire aux autres services spécialisés.

---

## 📊 RÉSUMÉ DES PROBLÈMES

| Écran | Statut | Problème Principal |
|-------|-------|-------------------|
| **PharmacieFormScreen** | 🔴 Critique | API médicaments non intégrée |
| **AgenceVoyageFormScreen** | 🟡 À vérifier | Configuration tickets bus (partiellement implémenté) |
| **HopitalFormScreen** | ✅ OK | Aligné avec backend |
| **LaboratoireFormScreen** | ✅ OK | Aligné avec backend |
| **TaxiFormScreen** | ✅ OK | Aligné avec backend |
| **CovoiturageFormScreen** | ✅ OK | Aligné avec backend (trajets récurrents inclus) |
| **LivreScolaireFormScreen** | ✅ OK | Aligné avec backend |
| **ImmobilierFormScreen** | ❌ Manquant | Écran à créer |
| **OffresEmploiFormScreen** | ❌ Manquant | Écran à créer (si backend existe) |

---

## 🔧 ACTIONS RECOMMANDÉES

### Priorité 1 (Critique)
1. **Intégrer API médicaments dans PharmacieFormScreen**
   - Ajouter section "Gérer mes médicaments"
   - Liste des produits existants
   - Formulaire création/édition produit
   - Import en masse (optionnel)

### Priorité 2 (Important)
2. **Vérifier AgenceVoyageFormScreen**
   - Tester création produits bus
   - Vérifier structure `BusModel` vs backend
   - Confirmer utilisation `compagnies_affiliees`

3. **Créer ImmobilierFormScreen**
   - Analyser structure backend (`CreatePropertyRequest`)
   - Créer écran formulaire complet
   - Intégrer upload médias et visite virtuelle

### Priorité 3 (Optionnel)
4. **Créer OffresEmploiFormScreen** (si backend existe)
   - Vérifier endpoints backend
   - Créer écran formulaire

---

## 📝 NOTES TECHNIQUES

### Structure commune des écrans
Tous les écrans suivent le même pattern :
1. Création automatique de `service` si `serviceId` manquant
2. Chargement données existantes si `mode='edit'`
3. Utilisation de `LocationSelector` pour quartier/ville
4. Utilisation de `ModernGPSModal` pour GPS
5. Envoi payload via `apiPost` vers endpoint spécialisé

### Endpoints backend spécialisés
- `/api/pharmacies` - Pharmacies
- `/api/hopitaux` - Hôpitaux
- `/api/laboratoires` - Laboratoires
- `/api/agences-voyage` - Agences de voyage
- `/api/taxis` - Taxis
- `/api/covoiturages` - Covoiturage
- `/api/livres-scolaires` - Livres scolaires
- `/api/immobilier/biens` - Immobilier
- `/api/offres-emploi` - Offres d'emploi (à vérifier)

---

## ✅ PROCHAINES ÉTAPES

1. ✅ Analyser `PharmacieFormScreen` - **FAIT**
2. ⏳ Intégrer API médicaments dans `PharmacieFormScreen`
3. ⏳ Vérifier `AgenceVoyageFormScreen` avec backend
4. ⏳ Analyser structure backend Immobilier
5. ⏳ Créer `ImmobilierFormScreen`
6. ⏳ Vérifier si backend OffresEmploi existe
7. ⏳ Créer `OffresEmploiFormScreen` si nécessaire

