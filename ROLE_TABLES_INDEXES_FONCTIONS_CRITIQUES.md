# 📋 Rôle des Tables, Index et Fonctions Critiques

**Date**: 2026-02-08  
**Application**: Yukpomnang Backend

## 📊 Tables Critiques

### 1. `user_saved_addresses` ✅

**Rôle**: Mémoriser les adresses de livraison des utilisateurs pour éviter la ressaisie répétitive.

**Utilisation**:
- Permet aux utilisateurs de sauvegarder leurs adresses de pickup et dropoff
- Réutilisable pour les commandes futures
- Améliore l'expérience utilisateur (pas de ressaisie)

**Colonnes principales**:
- `user_id`: Lien vers l'utilisateur
- `label`: Nom de l'adresse (ex: "Domicile", "Bureau")
- `address_type`: Type ('pickup', 'dropoff', 'both')
- `address`, `latitude`, `longitude`: Coordonnées géographiques
- `location_data`: Données enrichies (quartier, ville, pays) en JSONB
- `is_default_pickup` / `is_default_dropoff`: Adresses par défaut
- `usage_count`: Nombre de fois utilisée
- `last_used_at`: Dernière utilisation

**Où utilisé**:
- Routes de livraison (`delivery_routes.rs`)
- Service de livraison (`delivery_service.rs`)
- Interface utilisateur pour sélection d'adresses

---

### 2. `courier_profiles` ✅

**Rôle**: Stocker les profils des coursiers avec leurs positions GPS en temps réel.

**Utilisation**:
- Suivi en temps réel de la position des coursiers
- Matching géographique pour assigner les livraisons
- Gestion de la disponibilité des coursiers
- Optimisation des routes de livraison

**Colonnes principales**:
- `id`: Référence vers `couriers(id)`
- `current_latitude` / `current_longitude`: Position GPS actuelle
- `last_location_update`: Dernière mise à jour de position
- `is_online`: Statut de connexion (en ligne/hors ligne)
- `current_status`: Statut actuel ('available', 'on_delivery', 'busy')
- `current_delivery_id`: Livraison en cours (si applicable)
- `metadata`: Données supplémentaires en JSONB

**Où utilisé**:
- Service de matching géographique (`geographic_matching_service.rs`)
- Service de livraison (`delivery_service.rs`)
- WebSocket pour suivi en temps réel
- Optimisation des routes (`delivery_vrp_solver.rs`)

---

## 🔍 Vues Critiques

### 1. `delivery_requests` (Vue) ✅

**Rôle**: Vue de compatibilité qui mappe la table `deliveries` vers `delivery_requests` pour le code backend.

**Utilisation**:
- Fournit une interface unifiée pour accéder aux demandes de livraison
- Renomme `creator_id` en `client_id` pour cohérence avec le code
- Simplifie les requêtes dans le code backend

**Mapping**:
- `deliveries.creator_id` → `delivery_requests.client_id`
- `deliveries.requested_at` → `delivery_requests.created_at`
- Toutes les autres colonnes sont mappées directement

**Où utilisé**:
- Routes de suggestions de livraison (`delivery_suggestions_routes.rs`)
- Routes de chat de livraison (`delivery_chat_routes.rs`)
- Service de livraison (`delivery_service.rs`)

---

## 🔧 Fonctions Critiques

### 1. `calculate_vector_match_score_optimized()` ✅

**Rôle**: Calcule le score de correspondance entre un vecteur normalisé et des mots-clés de recherche.

**Paramètres**:
- `vector_normalized TEXT[]`: Vecteur de caractéristiques normalisé
- `search_keywords_normalized TEXT[]`: Mots-clés de recherche normalisés

**Retour**: `REAL` (score en pourcentage 0-100)

**Algorithme**:
1. Compte les éléments du vecteur qui matchent avec les mots-clés
2. Calcule le pourcentage de correspondance
3. Retourne 0.0 si le vecteur est vide

**Utilisation**:
- Recherche de produits par caractéristiques
- Matching de services avec mots-clés
- Calcul de pertinence dans les résultats de recherche

**Où utilisé**:
- Service de recherche (`search_service.rs`)
- Service de création de produits (`creer_service.rs`)
- Autocomplete de produits

---

### 2. `calculate_best_vector_match_score()` ✅

**Rôle**: Calcule le meilleur score de correspondance entre deux vecteurs (characteristic et full_vector).

**Paramètres**:
- `characteristic_vector_normalized TEXT[]`: Vecteur de caractéristiques
- `full_vector_normalized TEXT[]`: Vecteur complet
- `search_keywords_normalized TEXT[]`: Mots-clés de recherche

**Retour**: `REAL` (meilleur score entre les deux vecteurs)

**Algorithme**:
1. Calcule le score pour `characteristic_vector`
2. Calcule le score pour `full_vector`
3. Retourne le maximum des deux scores

**Utilisation**:
- Recherche optimisée de produits
- Matching intelligent entre caractéristiques et description complète
- Améliore la précision des résultats de recherche

**Où utilisé**:
- Service de recherche avancée
- Matching de produits dans l'autocomplete
- Recherche de services par caractéristiques

---

### 3. `product_combination_exists()` ✅

**Rôle**: Vérifie si une combinaison de produits existe déjà dans `autocomplete_combinations`.

**Paramètres**:
- `p_product_vector TEXT[]`: Vecteur de produits à vérifier

**Retour**: `BOOLEAN` (true si existe, false sinon)

**Algorithme**:
1. Recherche dans `autocomplete_combinations` avec le vecteur donné
2. Retourne true si trouvé, false sinon

**Utilisation**:
- Éviter les doublons lors de la création de produits
- Vérification avant insertion dans l'autocomplete
- Optimisation de la base de données

**Où utilisé**:
- Service de création de produits (`creer_service.rs`)
- Validation avant insertion dans `autocomplete_combinations`
- Prévention des doublons

---

### 4. `refresh_services_search_optimized()` ✅

**Rôle**: Rafraîchit la vue matérialisée `services_search_optimized_v2` de manière optimisée.

**Paramètres**: Aucun

**Retour**: `VOID`

**Algorithme**:
1. Rafraîchit la vue matérialisée `services_search_optimized_v2`
2. Utilise `REFRESH CONCURRENTLY` pour éviter les verrous
3. Met à jour les données de recherche optimisées

**Utilisation**:
- Mise à jour périodique du cache de recherche
- Rafraîchissement automatique toutes les 2-3 minutes
- Optimisation des performances de recherche

**Où utilisé**:
- Tâche planifiée (cron job)
- Après modifications importantes de services
- Service de recherche (`search_service.rs`)

---

## 📑 Index Critiques

### Index pour `user_saved_addresses`

#### `idx_user_saved_addresses_user_id` ✅
- **Colonnes**: `user_id`
- **Rôle**: Recherche rapide des adresses par utilisateur
- **Type**: B-tree standard

#### `idx_user_saved_addresses_user_type` ✅
- **Colonnes**: `user_id`, `address_type`
- **Rôle**: Recherche optimisée par utilisateur et type (pickup/dropoff)
- **Type**: B-tree composite

#### `idx_user_saved_addresses_default` ✅
- **Colonnes**: `user_id`, `is_default_pickup`, `is_default_dropoff`
- **Rôle**: Recherche rapide des adresses par défaut
- **Type**: B-tree composite

#### `idx_user_saved_addresses_active` ✅
- **Colonnes**: `user_id`, `is_active`
- **Rôle**: Filtrage des adresses actives uniquement
- **Type**: B-tree composite

#### `idx_user_saved_addresses_location` ✅
- **Colonnes**: `longitude`, `latitude` (via GIST)
- **Rôle**: Recherche géographique spatiale (proximité)
- **Type**: GIST (PostGIS)
- **Condition**: Requiert l'extension PostGIS

---

### Index pour `courier_profiles`

#### `idx_courier_profiles_location` ✅
- **Colonnes**: `current_latitude`, `current_longitude`
- **Rôle**: Recherche géographique des coursiers proches
- **Type**: B-tree composite
- **Condition**: `WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL`

#### `idx_courier_profiles_online` ✅
- **Colonnes**: `is_online`
- **Rôle**: Recherche rapide des coursiers en ligne
- **Type**: B-tree partiel
- **Condition**: `WHERE is_online = TRUE`

#### `idx_courier_profiles_status` ✅
- **Colonnes**: `current_status`
- **Rôle**: Filtrage par statut (available, on_delivery, busy)
- **Type**: B-tree standard

#### `idx_courier_profiles_delivery` ✅
- **Colonnes**: `current_delivery_id`
- **Rôle**: Recherche des coursiers par livraison en cours
- **Type**: B-tree partiel
- **Condition**: `WHERE current_delivery_id IS NOT NULL`

---

### Index pour Vue Matérialisée

#### `idx_services_search_optimized_v2_unique` ✅
- **Table**: `services_search_optimized_v2` (vue matérialisée)
- **Colonnes**: `service_id`
- **Rôle**: Index unique requis pour `REFRESH CONCURRENTLY`
- **Type**: B-tree unique
- **Critique**: Sans cet index, le rafraîchissement concurrent est impossible

---

## 🔄 Triggers Critiques

### 1. `trigger_update_user_saved_addresses_updated_at` ✅

**Fonction**: `update_user_saved_addresses_updated_at()`

**Rôle**: Met à jour automatiquement `updated_at` lors des modifications.

**Déclenchement**: `BEFORE UPDATE` sur `user_saved_addresses`

**Utilisation**: Maintient automatiquement la date de dernière modification

---

### 2. `trigger_update_courier_profiles_updated_at` ✅

**Fonction**: `update_courier_profiles_updated_at()`

**Rôle**: Met à jour automatiquement `updated_at` lors des modifications.

**Déclenchement**: `BEFORE UPDATE` sur `courier_profiles`

**Utilisation**: Maintient automatiquement la date de dernière modification de position

---

## 📊 Vue Matérialisée Critique

### `services_search_optimized_v2` ✅

**Rôle**: Cache optimisé pour les recherches de services.

**Contenu**:
- Données pré-calculées pour recherche rapide
- Indexation optimisée des services
- Données vectorielles pour recherche sémantique

**Rafraîchissement**:
- Automatique via `refresh_services_search_optimized()`
- Toutes les 2-3 minutes
- Utilise `REFRESH CONCURRENTLY` (nécessite l'index unique)

**Index requis**:
- `idx_services_search_optimized_v2_unique` sur `service_id`

**Utilisation**:
- Recherche de services rapide
- Autocomplete de services
- Recherche géographique de services

---

## 🎯 Résumé par Catégorie

### Tables
- ✅ `user_saved_addresses`: Mémorisation adresses utilisateurs
- ✅ `courier_profiles`: Positions GPS coursiers en temps réel

### Vues
- ✅ `delivery_requests`: Vue de compatibilité sur deliveries

### Fonctions
- ✅ `calculate_vector_match_score_optimized`: Score de correspondance vectorielle
- ✅ `calculate_best_vector_match_score`: Meilleur score entre deux vecteurs
- ✅ `product_combination_exists`: Vérification existence combinaison
- ✅ `refresh_services_search_optimized`: Rafraîchissement vue matérialisée

### Index
- ✅ 5 index pour `user_saved_addresses` (recherche utilisateur, type, défaut, actif, géographique)
- ✅ 4 index pour `courier_profiles` (localisation, en ligne, statut, livraison)
- ✅ 1 index unique pour `services_search_optimized_v2` (rafraîchissement concurrent)

### Triggers
- ✅ 2 triggers pour mise à jour automatique de `updated_at`

---

## 🔗 Interdépendances

```
user_saved_addresses
  └─> users (FK: user_id)

courier_profiles
  ├─> couriers (FK: id)
  └─> deliveries (FK: current_delivery_id)

delivery_requests (vue)
  └─> deliveries (source)

calculate_best_vector_match_score()
  └─> calculate_vector_match_score_optimized() (appelée)

product_combination_exists()
  └─> autocomplete_combinations (table)

refresh_services_search_optimized()
  └─> services_search_optimized_v2 (vue matérialisée)
      └─> idx_services_search_optimized_v2_unique (index requis)
```

---

## 📝 Notes Importantes

1. **Toutes les migrations sont idempotentes**: Utilisent `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP IF EXISTS`
2. **Index partiels**: Certains index utilisent `WHERE` pour optimiser l'espace et les performances
3. **Vue matérialisée**: Nécessite un index unique pour `REFRESH CONCURRENTLY`
4. **PostGIS requis**: L'index géographique `idx_user_saved_addresses_location` nécessite PostGIS
5. **Automatisation**: Toutes les migrations s'exécutent automatiquement au démarrage du backend

---

**Document de référence**: `backend/GUIDE_MIGRATIONS_AUTOMATIQUES.md`

