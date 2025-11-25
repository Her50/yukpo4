# 🔍 Explication du Matching Google Places

## 📋 Comment ça fonctionne

### 1. **Lors de la création du service** (matching initial)

#### Étape 1 : Enrichissement Google Places
```rust
// backend/src/services/creer_service.rs ligne ~1162
enrich_service_with_google(&mut data_obj).await
```

**Ce qui se passe** :
- Le service `GooglePlacesService` recherche le lieu via l'API Google Places
- Utilise : titre, nom produit, nom prestataire, catégorie, localisation
- Retourne un objet `GooglePlaceEnriched` avec **toutes les données** :
  - `place_id` (identifiant unique)
  - `display_name`, `formatted_address`
  - `location_vector`, `coordinates`
  - `rating`, `rating_count`
  - `editorial_summary` (complet)
  - `photos` (complet)
  - `opening_hours` (complet)
  - etc.

#### Étape 2 : Sauvegarde dans `services.data`
```rust
// ligne ~1204-1215
// On garde SEULEMENT place_id dans services.data
*google_place = serde_json::json!({ "place_id": pid });
```

**Résultat** : `services.data.google_place = { "place_id": "ChIJ..." }`

#### Étape 3 : Sauvegarde complète dans `google_places_data`
```rust
// ligne ~2823-2900
INSERT INTO google_places_data (
    service_id, place_id, display_name, formatted_address, ...
)
VALUES ($1, $2, $3, ...)
ON CONFLICT (service_id, place_id) DO UPDATE SET ...
```

**Résultat** : Toutes les données complètes sont dans `google_places_data`

### 2. **Lors de la récupération du service** (matching pour affichage)

#### Problème identifié
Actuellement, quand on récupère un service :
- `services.data` contient seulement `{ "place_id": "..." }`
- Les données complètes sont dans `google_places_data`
- **MAIS** : Aucun code ne récupère les données complètes !

#### Solution créée
Nouveau service : `enrich_google_places.rs`

```rust
// Fonction pour enrichir un service avec les données Google Places complètes
enrich_service_with_google_places_data(pool, service_id, &mut service_data).await
```

**Ce qui se passe** :
1. Vérifie si `service_data.google_place.place_id` existe
2. Si oui, récupère les données complètes depuis `google_places_data` :
   ```sql
   SELECT jsonb_build_object(...) as google_place_data
   FROM google_places_data
   WHERE service_id = $1 AND place_id = $2
   ```
3. Remplace `{ "place_id": "..." }` par l'objet complet avec toutes les données

### 3. **Matching par clés**

Le matching se fait via **deux clés** :
- `service_id` : Lien vers le service
- `place_id` : Identifiant unique Google Places

**Contrainte unique** : `UNIQUE (service_id, place_id)`

Cela garantit qu'un service ne peut avoir qu'un seul lieu Google Places, et qu'un même lieu peut être associé à plusieurs services (si plusieurs prestataires sont au même endroit).

## 🔄 Flux complet

```
1. CRÉATION SERVICE
   └─> enrich_service_with_google()
       └─> GooglePlacesService.search_and_enrich()
           └─> Retourne GooglePlaceEnriched (toutes données)
   └─> Sauvegarde dans services.data : { "place_id": "..." }
   └─> Sauvegarde dans google_places_data : toutes données complètes

2. RÉCUPÉRATION SERVICE
   └─> SELECT data FROM services WHERE id = $1
       └─> Retourne : { "google_place": { "place_id": "..." } }
   └─> enrich_service_with_google_places_data()
       └─> SELECT ... FROM google_places_data WHERE service_id = $1 AND place_id = $2
           └─> Retourne : toutes données complètes
       └─> Remplace dans service_data : { "google_place": { ... données complètes ... } }
```

## ✅ Avantages

1. **services.data léger** : Seulement `place_id` (< 100 bytes)
2. **Données complètes préservées** : Dans `google_places_data`
3. **Matching fiable** : Par `service_id` + `place_id` (contrainte unique)
4. **Enrichissement à la demande** : Les données complètes sont récupérées seulement quand nécessaire

## ⚠️ À faire

Il faut maintenant **appeler** `enrich_service_with_google_places_data()` dans les endpoints qui retournent des services :
- `service_controller.rs` : `get_services()`, `get_service_by_id()`
- `native_search_service.rs` : résultats de recherche
- Tous les endpoints qui retournent `services.data`

## 📝 Exemple d'utilisation

```rust
// Dans un controller
let mut service_data: Value = row.get("data");

// Enrichir avec Google Places
enrich_google_places::enrich_service_with_google_places_data(
    &pool,
    service_id,
    &mut service_data
).await?;

// service_data.google_place contient maintenant toutes les données complètes
```

