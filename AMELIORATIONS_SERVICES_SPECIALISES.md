# 🚀 Améliorations des Services Spécialisés - Plan d'Action

## 📋 Vue d'ensemble

Amélioration des écrans de formulaire des prestataires pour les services spécialisés avec des fonctionnalités avancées similaires à celles ajoutées pour les pharmacies.

---

## ✅ 1. PharmacieFormScreen - TERMINÉ

**Fonctionnalités ajoutées** :
- ✅ Gestion complète des médicaments (CRUD)
- ✅ Import en masse (JSON/CSV)
- ✅ Export des produits
- ✅ Recherche/filtrage en temps réel
- ✅ Statistiques (total produits, stock, valeur)

---

## 🔄 2. LaboratoireFormScreen - À AMÉLIORER

### Fonctionnalités à ajouter :

1. **Gestion des types d'examens**
   - Liste des examens disponibles
   - Ajouter/modifier/supprimer un type d'examen
   - Champs : nom, catégorie (analyse/imagerie), prix, durée estimée, préparation requise
   - Modal de création/édition

2. **Statistiques**
   - Nombre total d'examens disponibles
   - Répartition par catégorie (analyses vs imagerie)
   - Prix moyen des examens

3. **Recherche/filtrage**
   - Recherche dans les types d'examens
   - Filtre par catégorie

4. **Export/Import**
   - Export de la liste des examens
   - Import en masse (JSON/CSV)

**Backend disponible** :
- `GET /api/laboratoires/{id}/examination-types` - Liste des types d'examens
- `POST /api/laboratoires/{id}/book-examination` - Réservation (pour clients)
- `GET /api/laboratoires/{id}/analytics` - Analytics

**Note** : L'endpoint `examination-types` retourne actuellement des données vides. Il faudra peut-être créer une table dédiée ou utiliser le champ `analyses_disponibles` existant.

---

## 🔄 3. HopitalFormScreen - À AMÉLIORER

### Fonctionnalités à ajouter :

1. **Gestion des créneaux (slots)**
   - Liste des créneaux disponibles par prestation
   - Ajouter/modifier/supprimer des créneaux
   - Gestion des horaires par jour et par prestation
   - Modal de gestion des créneaux

2. **Statistiques**
   - Nombre de prestations médicales
   - Nombre de créneaux disponibles
   - Taux de disponibilité

3. **Recherche/filtrage**
   - Recherche dans les prestations
   - Filtre par type de prestation

**Backend disponible** :
- `POST /api/hopitaux/{id}/slots` - Gestion des créneaux
- `GET /api/hopitaux/{id}` - Détails avec planning_prestations

**Note** : Le backend utilise déjà `planning_prestations` avec structure `scheduleByDay`.

---

## 🔄 4. AgenceVoyageFormScreen - À VÉRIFIER/AMÉLIORER

### État actuel :
- ✅ Gestion des modèles de bus
- ✅ Création automatique de produits bus
- ✅ Liaison produits-agence

### Fonctionnalités à ajouter :

1. **Statistiques**
   - Nombre de modèles de bus
   - Nombre de destinations
   - Nombre de compagnies affiliées

2. **Gestion des horaires de départ**
   - Liste des horaires par destination
   - Ajouter/modifier/supprimer des horaires
   - Gestion par jour de la semaine

3. **Recherche/filtrage**
   - Recherche dans les destinations
   - Filtre par compagnie

**Backend disponible** :
- `POST /api/bus-tickets/create-product` - Créer produit bus
- `POST /api/bus-tickets/link` - Lier produit à agence
- `GET /api/agences-voyage/{id}` - Détails agence

---

## 🔄 5. TaxiFormScreen - À AMÉLIORER

### Fonctionnalités à ajouter :

1. **Statistiques**
   - Nombre de zones d'intervention
   - Tarifs moyens (base et par km)
   - Disponibilité actuelle

2. **Gestion des zones**
   - Liste des zones d'intervention
   - Ajouter/modifier/supprimer une zone
   - Visualisation sur carte

3. **Recherche/filtrage**
   - Recherche dans les zones

**Backend disponible** :
- `POST /api/taxis` - Création
- `GET /api/taxis/{id}` - Détails
- `POST /api/taxi/demand-prediction` - Prédiction demande (IA)

---

## 🔄 6. CovoiturageFormScreen - À AMÉLIORER

### État actuel :
- ✅ Trajets récurrents (daily, weekly, monthly)

### Fonctionnalités à ajouter :

1. **Statistiques**
   - Nombre de trajets actifs
   - Nombre de places disponibles
   - Revenus estimés

2. **Gestion des trajets récurrents**
   - Liste des trajets récurrents
   - Activer/désactiver un trajet récurrent
   - Visualisation du calendrier

3. **Recherche/filtrage**
   - Recherche dans les trajets

**Backend disponible** :
- `POST /api/covoiturages` - Création
- `GET /api/covoiturages/{id}` - Détails
- Endpoints commentés pour trajets récurrents (à implémenter)

---

## 🔄 7. LivreScolaireFormScreen - À AMÉLIORER

### Fonctionnalités à ajouter :

1. **Statistiques**
   - Nombre de livres enregistrés
   - Répartition par niveau
   - Répartition par matière

2. **Recherche/filtrage**
   - Recherche dans les livres
   - Filtre par niveau, matière, état

3. **Gestion des trocs**
   - Liste des demandes de troc
   - Matching intelligent

**Backend disponible** :
- `POST /api/livres-scolaires` - Création
- `PUT /api/livres-scolaires/{id}` - Modification
- `GET /api/livres-scolaires/{id}` - Détails
- Routes troc disponibles

---

## ❌ 8. ImmobilierFormScreen - À CRÉER

### Fonctionnalités à implémenter :

1. **Formulaire complet**
   - Type de bien (maison, appartement, terrain, etc.)
   - Statut (vente, location, les deux)
   - Caractéristiques (surface, chambres, salles de bain, standing, etc.)
   - Prix (vente et/ou location)
   - Photos (upload multiple)
   - Visite virtuelle (optionnel)

2. **Statistiques**
   - Nombre de biens
   - Valeur totale du portefeuille
   - Répartition par type

3. **Gestion des biens**
   - Liste des biens
   - Modifier/supprimer un bien
   - Upload médias

**Backend disponible** :
- `GET /api/immobilier/biens` - Recherche (pas de POST trouvé)
- `POST /api/immobilier/biens/{id}/upload-media` - Upload médias
- `POST /api/immobilier/biens/{id}/upload-virtual-tour` - Visite virtuelle

**Note** : Il n'existe pas d'endpoint `POST /api/immobilier/biens`. Les biens sont probablement créés via `/api/services/create` puis détails dans `real_estate_properties`.

---

## ❌ 9. OffresEmploiFormScreen - À VÉRIFIER/CRÉER

### État :
- ❌ Aucun endpoint backend trouvé

### Si backend existe :
1. **Formulaire complet**
   - Titre du poste
   - Description
   - Type de contrat
   - Salaire
   - Localisation
   - Compétences requises
   - Date limite

2. **Statistiques**
   - Nombre d'offres actives
   - Nombre de candidatures

---

## 📊 Priorités d'implémentation

### Priorité 1 (Critique)
1. ✅ PharmacieFormScreen - TERMINÉ
2. 🔄 LaboratoireFormScreen - Gestion types d'examens
3. 🔄 HopitalFormScreen - Gestion créneaux

### Priorité 2 (Important)
4. 🔄 AgenceVoyageFormScreen - Vérifier tickets bus
5. 🔄 TaxiFormScreen - Statistiques et zones
6. 🔄 CovoiturageFormScreen - Statistiques

### Priorité 3 (Optionnel)
7. 🔄 LivreScolaireFormScreen - Statistiques et recherche
8. ❌ ImmobilierFormScreen - Créer écran complet
9. ❌ OffresEmploiFormScreen - Vérifier backend puis créer

---

## 🎯 Fonctionnalités communes à tous les écrans

1. **Statistiques rapides**
   - Cartes avec métriques clés
   - Design cohérent

2. **Recherche/filtrage**
   - Barre de recherche en temps réel
   - Filtres contextuels

3. **Export/Import** (si applicable)
   - Export JSON
   - Import en masse

4. **Gestion d'erreurs**
   - Messages clairs
   - Validation côté client

5. **UI/UX cohérente**
   - Design moderne
   - Animations fluides
   - Feedback utilisateur

---

## 📝 Notes techniques

- Tous les écrans utilisent le pattern : création automatique de `service` si `serviceId` manquant
- Utilisation de `LocationSelector` pour la géolocalisation
- Utilisation de `ModernGPSModal` pour sélection GPS
- Gestion des états de chargement
- Validation des données avant envoi
