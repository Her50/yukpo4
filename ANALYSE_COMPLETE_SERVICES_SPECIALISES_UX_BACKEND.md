# Analyse Complète : Services Spécialisés - UX & Backend

## 📋 Table des Matières
1. [État des Lieux](#état-des-lieux)
2. [Architecture Actuelle](#architecture-actuelle)
3. [Gaps Identifiés](#gaps-identifiés)
4. [Améliorations UX Innovantes](#améliorations-ux-innovantes)
5. [Améliorations Backend](#améliorations-backend)
6. [Plan d'Implémentation](#plan-dimplémentation)

---

## 🔍 État des Lieux

### Navigation & Accès
- **Point d'entrée** : `ProfileScreen` → "Mes Services Spécialisés" → `MesServicesSpecialisesScreen`
- **Recherche basique** : Bouton "specialise" dans `HomeScreen` (mentionné mais non trouvé dans le code)
- **Écran de gestion** : `GestionServicesSpecialisesScreen` pour lister/modifier/supprimer

### Services Disponibles

#### Santé (4 services)
1. **Pharmacie** (`PharmacieFormScreen`)
   - Jours de garde, horaires, services (Garde, Délivrance, Conseil, Vaccination, etc.)
   - GPS, quartier, contacts (téléphone, WhatsApp, email)
   - Planning avec `GuardDaysSelector`

2. **Hôpital/Clinique** (`HopitalFormScreen`)
   - Type d'établissement, prestations médicales
   - Urgences, RDV en ligne
   - Planning hebdomadaire

3. **Laboratoire/Imagerie** (`LaboratoireFormScreen`)
   - Type de laboratoire
   - Analyses disponibles, imagerie disponible
   - RDV requis, résultats en ligne

4. **Banque de Sang** (`BanqueSangFormScreen`)
   - Gestion stocks groupes sanguins
   - Système de matching intelligent

#### Transport (3 services)
1. **Agence de Voyage** (`AgenceVoyageFormScreen`)
   - Émission tickets bus
   - Horaires d'agence
   - Gestion places/seats

2. **Covoiturage** (`CovoiturageFormScreen`)
   - Départ/destination
   - Date/heure, places disponibles
   - Prix par place

3. **Taxi de Ville** (`TaxiFormScreen`)
   - Zone d'intervention
   - Disponibilité en temps réel
   - GPS actuel

### Backend - Architecture

#### Routes API (`specialized_services_routes.rs`)
```
GET/POST  /api/pharmacies
GET/POST  /api/hopitaux
GET/POST  /api/laboratoires
GET/POST  /api/agences-voyage
GET/POST  /api/covoiturages
GET/POST  /api/taxis
GET/POST  /api/banques-sang
```

#### Recherche Spécialisée
- **Endpoint** : `/api/search/direct` avec paramètre `specialized_type`
- **Types supportés** :
  - `pharmacie` → `SearchIntent::SpecializedPharmacy`
  - `hopital_clinique` → `SearchIntent::SpecializedHospital`
  - `laboratoire_imagerie` → `SearchIntent::SpecializedLaboratory`
  - `agence_voyage` → `SearchIntent::SpecializedTravelAgency`
  - `covoiturage` → `SearchIntent::SpecializedCovoiturage`
  - `taxi_ville` → `SearchIntent::SpecializedTaxi`
  - `banque_sang` → `SearchIntent::SpecializedBloodBank`

#### Fonctions SQL de Recherche
Chaque service utilise une fonction PostgreSQL dédiée :
- `search_pharmacies_with_moment(query, gps, radius, moment)`
- `search_hospitals_with_moment(...)`
- `search_laboratories_with_moment(...)`
- `search_travel_agencies_with_moment(...)`
- `search_covoiturages_with_moment(...)`
- `search_taxis_with_moment(...)`

#### Champ `specialized_type` dans `services`
- Identifie un service comme spécialisé
- Déclenche des triggers pour cohérence
- Index pour performance

---

## ⚠️ Gaps Identifiés

### UX - Problèmes Majeurs

#### 1. **Navigation Fragmentée**
- ❌ Pas de recherche unifiée depuis HomeScreen
- ❌ Bouton "specialise" mentionné mais introuvable
- ❌ Pas de raccourcis rapides vers services fréquents
- ❌ Navigation entre création/édition/gestion non fluide

#### 2. **Création de Service Complexe**
- ❌ Double création : service générique + service spécialisé
- ❌ Logique de création automatique dans `MesServicesSpecialisesScreen` puis formulaire
- ❌ Gestion d'erreurs basique (Alert.alert)
- ❌ Pas de prévisualisation avant sauvegarde
- ❌ Pas de brouillons/sauvegarde automatique

#### 3. **Configuration Incomplète**
- ❌ Pas de templates/pré-configurations par type
- ❌ Pas d'aide contextuelle dans les formulaires
- ❌ Validation côté client limitée
- ❌ Pas de suggestions intelligentes (ex: quartiers proches)

#### 4. **Gestion des Services**
- ❌ `GestionServicesSpecialisesScreen` fait 6 appels API séparés
- ❌ Pas de filtrage avancé (actifs/inactifs, par type, par date)
- ❌ Pas de recherche dans la liste
- ❌ Pas de tri (date, nom, statut)
- ❌ Pas de statistiques agrégées

#### 5. **Recherche Spécialisée Basique**
- ❌ `SpecializedSearchScreen` : interface basique
- ❌ Pas d'autocomplétion intelligente
- ❌ Pas de suggestions de recherche
- ❌ Pas de filtres avancés (disponibilité, prix, distance)
- ❌ Pas de sauvegarde de recherches fréquentes
- ❌ Pas d'historique de recherches

#### 6. **Expérience Utilisateur**
- ❌ Pas de feedback visuel pendant chargement
- ❌ Pas d'animations/transitions fluides
- ❌ Pas de mode hors ligne
- ❌ Pas de synchronisation automatique
- ❌ Pas de notifications pour services importants (ex: pharmacie de garde)

### Backend - Limitations

#### 1. **API Incomplète**
- ❌ `list_hospitals`, `list_laboratories`, etc. retournent des stubs vides
- ❌ Pas d'endpoint unifié pour lister tous les services spécialisés d'un user
- ❌ Pas de pagination sur les listes
- ❌ Pas de filtres dans les endpoints GET

#### 2. **Recherche**
- ❌ Pas de cache de résultats
- ❌ Pas de recherche par tags/mots-clés
- ❌ Pas de recherche par disponibilité temporelle avancée
- ❌ Pas de ranking personnalisé
- ❌ Pas de recherche multi-critères (ex: pharmacie + garde + 24h)

#### 3. **Données**
- ❌ Pas de validation stricte des champs spécialisés
- ❌ Pas de contraintes de cohérence (ex: dates covoiturage)
- ❌ Pas de gestion de versions/historique
- ❌ Pas de soft delete

#### 4. **Performance**
- ❌ 6 appels API séparés pour charger services (GestionServicesSpecialisesScreen)
- ❌ Pas d'index optimisés pour recherches fréquentes
- ❌ Pas de mise en cache des résultats de recherche

---

## 🚀 Améliorations UX Innovantes

### 1. **Hub Unifié des Services Spécialisés**

#### Écran Principal Redesigné
```
┌─────────────────────────────────────┐
│  🔍 Recherche Rapide                │
│  [Rechercher une pharmacie...]      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ⚡ Accès Rapide                     │
│  [Pharmacie] [Hôpital] [Taxi] ...   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📊 Mes Services (7)                │
│  [Voir tous] [Filtrer]              │
│  ┌─────┐ ┌─────┐ ┌─────┐            │
│  │Phar │ │Taxi │ │Covo │            │
│  └─────┘ └─────┘ └─────┘            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  💡 Suggestions Intelligentes        │
│  "Pharmacie de garde près de vous"   │
│  "Covoiturage Douala-Yaoundé"      │
└─────────────────────────────────────┘
```

**Fonctionnalités** :
- Barre de recherche globale avec autocomplétion
- Raccourcis vers services fréquents (badges avec compteurs)
- Liste unifiée avec filtres (actifs, type, date)
- Suggestions basées sur historique/localisation

### 2. **Création Assistée par IA**

#### Wizard Intelligent en 3 Étapes

**Étape 1 : Type & Nom**
- Sélection visuelle du type (cartes avec icônes)
- Suggestion de nom basée sur localisation
- Prévisualisation du formulaire

**Étape 2 : Configuration Contextuelle**
- Champs adaptés dynamiquement selon le type
- Aide contextuelle (tooltips, exemples)
- Validation en temps réel
- Suggestions intelligentes :
  - Quartiers proches
  - Horaires standards par type
  - Services courants par catégorie

**Étape 3 : Vérification & Publication**
- Résumé visuel avec prévisualisation
- Checklist de complétude
- Option "Brouillon" pour sauvegarde partielle
- Publication avec confirmation

**Améliorations** :
- Sauvegarde automatique toutes les 30s
- Récupération après crash
- Mode hors ligne avec sync différée

### 3. **Recherche Avancée & Intelligente**

#### Interface de Recherche Enrichie

```
┌─────────────────────────────────────┐
│  🔍 Recherche Pharmacie             │
│  ┌─────────────────────────────────┐│
│  │ [paracétamol 500mg...]          ││
│  │ 💡 Suggestions:                  ││
│  │ • Pharmacie de garde            ││
│  │ • Médicament contre fièvre      ││
│  └─────────────────────────────────┘│
│                                      │
│  📍 Localisation                     │
│  [Ma position] [Autre lieu]          │
│                                      │
│  ⏰ Quand ?                           │
│  [Maintenant] [Plus tard] [Date]     │
│                                      │
│  🎯 Filtres                          │
│  [Garde 24h] [Livraison] [Distance]  │
│                                      │
│  [Rechercher]                        │
└─────────────────────────────────────┘
```

**Fonctionnalités** :
- Autocomplétion intelligente avec suggestions contextuelles
- Filtres avancés (disponibilité, services, prix, distance)
- Recherche vocale
- Historique de recherches avec favoris
- Recherches sauvegardées (ex: "Pharmacie garde près de chez moi")
- Résultats en temps réel pendant la saisie (debounce)

### 4. **Gestion Unifiée & Dashboard**

#### Écran de Gestion Amélioré

```
┌─────────────────────────────────────┐
│  Mes Services Spécialisés            │
│  ┌─────────────────────────────────┐│
│  │ [Tous] [Santé] [Transport] [🔍] ││
│  └─────────────────────────────────┘│
│                                      │
│  📊 Statistiques                     │
│  7 services • 5 actifs • 12 vues     │
│                                      │
│  ┌─────────────────────────────────┐│
│  │ 🏥 Pharmacie Centrale           ││
│  │ 📍 Bonanjo • Actif • 5 vues    ││
│  │ [⚙️] [👁️] [📊] [🗑️]            ││
│  └─────────────────────────────────┘│
│                                      │
│  [➕ Créer un service]              │
└─────────────────────────────────────┘
```

**Fonctionnalités** :
- Endpoint unifié : `GET /api/specialized-services/user` (1 appel au lieu de 6)
- Filtres multiples (type, statut, date)
- Recherche dans la liste
- Tri (nom, date, vues, statut)
- Statistiques agrégées (total, actifs, vues, interactions)
- Actions rapides (activer/désactiver, voir, modifier, supprimer)
- Mode carte/liste

### 5. **Notifications & Alertes Intelligentes**

- **Pharmacie de garde** : Notification automatique si service configuré comme "de garde"
- **Covoiturage** : Alerte si trajet correspondant créé
- **Taxi** : Notification si demande dans zone d'intervention
- **Statistiques** : Résumé hebdomadaire (vues, interactions)

### 6. **Mode Hors Ligne & Sync**

- Sauvegarde locale des services créés
- Synchronisation différée automatique
- Indicateur de statut de sync
- Gestion des conflits (dernière modification gagne)

---

## 🔧 Améliorations Backend

### 1. **API Unifiée**

#### Nouvel Endpoint
```rust
// GET /api/specialized-services/user
// Retourne tous les services spécialisés de l'utilisateur en 1 appel
{
  "pharmacies": [...],
  "hopitaux": [...],
  "laboratoires": [...],
  "agences_voyage": [...],
  "covoiturages": [...],
  "taxis": [...],
  "banques_sang": [...],
  "statistics": {
    "total": 7,
    "active": 5,
    "by_type": {...}
  }
}
```

#### Endpoints Améliorés
```rust
// GET /api/specialized-services/user?type=pharmacie&status=active&page=1&limit=20
// Pagination + filtres

// GET /api/specialized-services/{id}
// Détails complets d'un service spécialisé (quel que soit le type)

// POST /api/specialized-services/{id}/duplicate
// Dupliquer un service (utile pour templates)

// GET /api/specialized-services/templates?type=pharmacie
// Templates de configuration par type
```

### 2. **Recherche Avancée**

#### Nouveaux Paramètres de Recherche
```rust
POST /api/search/specialized
{
  "specialized_type": "pharmacie",
  "query": "paracétamol",
  "gps": "4.0511,9.7044",
  "radius_km": 10,
  "filters": {
    "is_on_duty": true,
    "services": ["garde", "livraison"],
    "permanent_24h": true,
    "min_rating": 4.0
  },
  "moment": {
    "type": "now" | "later" | "specific",
    "datetime": "2025-01-15T14:00:00Z" // si specific
  },
  "sort": "distance" | "relevance" | "rating",
  "limit": 20,
  "offset": 0
}
```

#### Améliorations Recherche
- **Cache Redis** : Mettre en cache les résultats fréquents (TTL 5min)
- **Recherche par tags** : Indexer les services avec tags (ex: "garde", "24h", "livraison")
- **Ranking personnalisé** : Prendre en compte historique utilisateur
- **Recherche multi-critères** : Combiner plusieurs filtres avec scoring

### 3. **Validation & Cohérence**

#### Validation Stricte
```rust
// Exemple : Covoiturage
- date_depart > NOW()
- places_disponibles <= nombre_places
- prix_par_place > 0
- depart != destination
- gps_depart valide (format lat,lng)
```

#### Contraintes Base de Données
```sql
-- Exemple : Pharmacie
ALTER TABLE pharmacies
  ADD CONSTRAINT check_heures_valid
    CHECK (heures_ouverture < heures_fermeture OR permanent_24h = true);

-- Exemple : Covoiturage
ALTER TABLE covoiturages
  ADD CONSTRAINT check_date_future
    CHECK (date_depart > created_at);
```

### 4. **Performance & Scalabilité**

#### Optimisations
- **Index composites** : `(specialized_type, user_id, is_active)`
- **Vues matérialisées** : Pour statistiques agrégées
- **Batch loading** : Charger plusieurs services en 1 requête
- **Lazy loading** : Charger détails seulement si nécessaire

#### Cache Strategy
```rust
// Cache Redis pour :
// - Liste services user (TTL 2min)
// - Résultats recherche (TTL 5min)
// - Templates (TTL 1h)
// - Statistiques (TTL 10min)
```

### 5. **Historique & Audit**

#### Nouvelles Tables
```sql
CREATE TABLE specialized_services_history (
  id SERIAL PRIMARY KEY,
  service_type VARCHAR(50),
  service_id INTEGER,
  action VARCHAR(20), -- 'create', 'update', 'delete'
  changes JSONB,
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE specialized_services_drafts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  service_type VARCHAR(50),
  data JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📅 Plan d'Implémentation

### Phase 1 : Fondations (Semaine 1-2)
- [ ] Créer endpoint unifié `GET /api/specialized-services/user`
- [ ] Implémenter `list_*` réels (au lieu de stubs)
- [ ] Ajouter pagination et filtres
- [ ] Créer cache Redis pour listes
- [ ] Ajouter validation stricte backend

### Phase 2 : UX Hub Unifié (Semaine 3-4)
- [ ] Redesigner `MesServicesSpecialisesScreen` avec recherche globale
- [ ] Créer composant `SpecializedServicesHub` avec accès rapide
- [ ] Implémenter suggestions intelligentes
- [ ] Ajouter statistiques agrégées
- [ ] Créer mode carte/liste

### Phase 3 : Création Assistée (Semaine 5-6)
- [ ] Créer wizard en 3 étapes
- [ ] Implémenter sauvegarde automatique (brouillons)
- [ ] Ajouter aide contextuelle
- [ ] Créer templates par type
- [ ] Ajouter prévisualisation

### Phase 4 : Recherche Avancée (Semaine 7-8)
- [ ] Améliorer `SpecializedSearchScreen` avec autocomplétion
- [ ] Ajouter filtres avancés
- [ ] Implémenter recherche vocale
- [ ] Créer historique de recherches
- [ ] Ajouter recherches sauvegardées

### Phase 5 : Gestion & Dashboard (Semaine 9-10)
- [ ] Redesigner `GestionServicesSpecialisesScreen`
- [ ] Implémenter filtres multiples
- [ ] Ajouter tri et recherche dans liste
- [ ] Créer dashboard avec statistiques
- [ ] Ajouter actions rapides

### Phase 6 : Notifications & Sync (Semaine 11-12)
- [ ] Implémenter notifications intelligentes
- [ ] Créer mode hors ligne
- [ ] Ajouter synchronisation différée
- [ ] Gérer conflits de sync
- [ ] Ajouter indicateurs de statut

### Phase 7 : Optimisations & Tests (Semaine 13-14)
- [ ] Optimiser requêtes SQL (index, vues)
- [ ] Implémenter cache avancé
- [ ] Tests E2E (Playwright)
- [ ] Tests performance
- [ ] Documentation API

---

## 🎯 Objectifs Finaux

### UX Exceptionnel
✅ Navigation fluide et intuitive  
✅ Création assistée avec IA  
✅ Recherche avancée et intelligente  
✅ Gestion unifiée avec dashboard  
✅ Mode hors ligne avec sync  
✅ Notifications contextuelles  

### Backend Robuste
✅ API unifiée et performante  
✅ Recherche multi-critères optimisée  
✅ Validation stricte et cohérence  
✅ Cache et performance  
✅ Historique et audit  
✅ Scalabilité garantie  

---

## 📝 Notes Techniques

### Stack Frontend
- React Native avec TypeScript
- Navigation : React Navigation
- État : Context API + hooks personnalisés
- Cache : AsyncStorage + React Query (à ajouter)

### Stack Backend
- Rust avec Axum
- PostgreSQL avec pgvector
- Redis pour cache
- SQLx pour requêtes

### Patterns à Implémenter
- Repository pattern pour services spécialisés
- Service layer pour logique métier
- DTOs pour validation
- Error handling unifié

---

**Date de création** : 2025-01-XX  
**Version** : 1.0  
**Auteur** : Analyse complète système services spécialisés Yukpomnang

