# 🔍 Explication du Matching Google Places lors de la Création

## 📋 Comment on identifie le bon lieu Google Places

### 1. **Construction de la requête de recherche**

#### Étape 1 : Extraction des informations du service/produit
```rust
// backend/src/services/creer_service.rs ligne ~417-423
let titre = extract_string_field(map, "titre_service");
let nom_produit = extract_string_field(map, "nom_produit");
let nom_prestataire = extract_string_field(map, "nom_prestataire");
let categorie = extract_string_field(map, "categorie_produit");
```

**Sources de données** :
- `titre_service` : Titre du service (ex: "Restaurant camerounais")
- `nom_produit` : Nom du produit (ex: "Poulet DG")
- `nom_prestataire` : Nom du prestataire (ex: "Chez Marie")
- `categorie_produit` : Catégorie (ex: "Restauration")

#### Étape 2 : Construction de la requête textuelle
```rust
// ligne ~424-448
let mut query_parts: Vec<String> = Vec::new();
if let Some(titre) = titre.clone() {
    query_parts.push(titre);  // "Restaurant camerounais"
}
if let Some(nom_produit) = nom_produit.clone() {
    if !query_parts.iter().any(|q| q.eq_ignore_ascii_case(&nom_produit)) {
        query_parts.push(nom_produit);  // "Poulet DG"
    }
}
if let Some(nom_prestataire) = nom_prestataire.clone() {
    if !query_parts.iter().any(|q| q.eq_ignore_ascii_case(&nom_prestataire)) {
        query_parts.push(nom_prestataire);  // "Chez Marie"
    }
}
if query_parts.is_empty() {
    if let Some(categorie) = categorie.clone() {
        query_parts.push(categorie);  // Fallback: "Restauration"
    }
}

let base_query = query_parts.join(" ");  // "Restaurant camerounais Poulet DG Chez Marie"
```

**Résultat** : `base_query = "Restaurant camerounais Poulet DG Chez Marie"`

#### Étape 3 : Extraction de la localisation
```rust
// ligne ~450-463
let lieu_value = map
    .get("lieu_produit")
    .or_else(|| map.get("lieu_commercial"))
    .or_else(|| map.get("lieu_service"))
    .or_else(|| map.get("lieu"));

let location_label = lieu_value.and_then(|value| build_location_label(value));
// Exemple: "Douala, Cameroun"

let country = lieu_value
    .and_then(|value| extract_country(value))
    .or_else(|| map.get("location_vector").and_then(|vec| extract_value_string(vec)));
// Exemple: "Cameroun"

let coordinates = lieu_value.and_then(|value| extract_coordinates_from_value(value));
// Exemple: (4.0487, 9.7044) pour Douala
```

**Sources de localisation** :
- `lieu_produit` : Lieu du produit
- `lieu_commercial` : Lieu commercial
- `lieu_service` : Lieu du service
- `location_vector` : Vecteur de localisation (quartier, ville, pays)

#### Étape 4 : Construction de la requête finale
```rust
// ligne ~465-472
let final_query = match (base_query.is_empty(), location_label.clone()) {
    (true, Some(location)) => location,  // Seulement localisation
    (false, Some(location)) => format!("{} {}", base_query, location),  // Requête + localisation
    (false, None) => base_query,  // Seulement requête
    (true, None) => return Ok(()),  // Rien → pas de recherche
};

// Résultat: "Restaurant camerounais Poulet DG Chez Marie Douala, Cameroun"
```

**Exemples de requêtes finales** :
- `"Restaurant camerounais Douala, Cameroun"`
- `"Pharmacie de garde Yaoundé, Cameroun"`
- `"Hôpital Général Douala, Cameroun"`

### 2. **Appel à l'API Google Places**

#### Étape 1 : Requête de recherche (Search API)
```rust
// backend/src/services/google_places_service.rs ligne ~184-205
let mut body = serde_json::json!({
    "textQuery": final_query,  // "Restaurant camerounais Douala, Cameroun"
    "languageCode": "fr",
});

// Ajout du hint pays (optionnel)
if let Some(country) = country_hint {
    if let Some(code) = infer_country_code(country) {
        body["regionCode"] = serde_json::Value::String(code.to_string());
        // Exemple: "CM" pour Cameroun
    }
}

// Ajout du biais de localisation (optionnel mais important)
if let Some((lat, lng)) = coordinates {
    body["locationBias"] = serde_json::json!({
        "circle": {
            "center": {
                "latitude": lat,  // 4.0487
                "longitude": lng  // 9.7044
            },
            "radius": 8000.0  // 8 km de rayon
        }
    });
}
```

**Critères de matching Google Places** :
1. **textQuery** : Recherche textuelle dans le nom, l'adresse, les types de lieu
2. **regionCode** : Restriction géographique (ex: "CM" = Cameroun)
3. **locationBias** : Priorité aux lieux proches des coordonnées (rayon 8 km)

#### Étape 2 : Récupération du premier résultat
```rust
// ligne ~267-286
let search_payload: PlacesSearchResponse = search_response.json().await?;

let first_place = match search_payload.places.and_then(|mut p| p.pop()) {
    Some(place) => place,  // ✅ Premier résultat
    None => {
        info!("[Places] Aucun résultat pour '{}'", query);
        return Ok(None);  // ❌ Pas de résultat
    }
};

let place_id = match first_place.id {
    Some(id) => id,  // ✅ ID unique du lieu
    None => {
        warn!("[Places] Résultat sans ID pour '{}'", query);
        return Ok(None);  // ❌ Pas d'ID
    }
};
```

**⚠️ IMPORTANT** : On prend **toujours le premier résultat** retourné par Google Places.
- Google Places classe les résultats par pertinence
- Le premier résultat est considéré comme le plus pertinent
- Pas de validation supplémentaire (nom exact, distance, etc.)

#### Étape 3 : Récupération des détails complets
```rust
// ligne ~288-300
let detail_url = format!(
    "{}/{}?languageCode={}",
    PLACES_URL,  // "https://places.googleapis.com/v1/places"
    place_id,    // "ChIJ..."
    "fr"
);

let details_response = self
    .client
    .get(&detail_url)
    .header("X-Goog-FieldMask", "id,displayName,formattedAddress,location,types,primaryType,primaryTypeDisplayName,googleMapsUri,websiteUri,rating,userRatingCount,priceLevel,businessStatus,editorialSummary,currentOpeningHours,regularOpeningHours,nationalPhoneNumber,internationalPhoneNumber,addressComponents,photos")
    .send()
    .await?;
```

**Données récupérées** :
- Informations de base : `displayName`, `formattedAddress`, `location`
- Types : `types`, `primaryType`, `primaryTypeDisplayName`
- Évaluations : `rating`, `userRatingCount`, `priceLevel`
- Contact : `websiteUri`, `nationalPhoneNumber`, `internationalPhoneNumber`
- Horaires : `currentOpeningHours`, `regularOpeningHours`
- Contenu : `editorialSummary`, `photos`
- Adresse : `addressComponents` (pour `location_vector`)

### 3. **Algorithme de matching Google Places**

Google Places utilise un algorithme de **recherche textuelle + géolocalisation** :

1. **Recherche textuelle** :
   - Compare `textQuery` avec : nom du lieu, adresse, types de lieu
   - Score de pertinence basé sur :
     - Correspondance exacte du nom
     - Correspondance partielle
     - Types de lieu pertinents

2. **Filtrage géographique** :
   - `regionCode` : Restriction au pays (ex: seulement Cameroun)
   - `locationBias` : Boost pour les lieux proches des coordonnées

3. **Classement** :
   - Google Places classe les résultats par pertinence
   - Le premier résultat est le plus pertinent selon Google

### 4. **Exemple concret**

**Service créé** :
```json
{
  "titre_service": "Restaurant camerounais",
  "nom_produit": "Poulet DG",
  "nom_prestataire": "Chez Marie",
  "lieu_produit": {
    "valeur": {
      "raw": "Douala, Cameroun",
      "components": {
        "ville": "Douala",
        "pays": "Cameroun"
      }
    }
  },
  "gps": { "lat": 4.0487, "lon": 9.7044 }
}
```

**Requête construite** :
```
textQuery: "Restaurant camerounais Poulet DG Chez Marie Douala, Cameroun"
regionCode: "CM"
locationBias: { center: { lat: 4.0487, lng: 9.7044 }, radius: 8000 }
```

**Résultat Google Places** :
```json
{
  "place_id": "ChIJ...",
  "displayName": "Chez Marie - Restaurant Camerounais",
  "formattedAddress": "Douala, Cameroun",
  "rating": 4.5,
  "types": ["restaurant", "food", "establishment"],
  ...
}
```

**✅ Matching réussi** : Le premier résultat correspond bien au restaurant "Chez Marie" à Douala.

### 5. **Limitations et risques**

#### ⚠️ Problèmes potentiels

1. **Mauvais matching** :
   - Si plusieurs lieux correspondent, Google peut retourner le mauvais
   - Exemple : "Restaurant Douala" peut matcher plusieurs restaurants

2. **Pas de validation** :
   - On ne vérifie pas si le nom correspond exactement
   - On ne vérifie pas la distance
   - On fait confiance au classement Google

3. **Absence de résultat** :
   - Si le lieu n'existe pas dans Google Places, pas de matching
   - Exemple : Petits commerces non référencés

#### ✅ Améliorations possibles

1. **Validation du nom** :
   ```rust
   // Vérifier si le nom du lieu contient le nom du prestataire
   if !google_place.display_name.contains(&nom_prestataire) {
       warn!("Nom prestataire non trouvé dans le lieu Google");
   }
   ```

2. **Validation de la distance** :
   ```rust
   // Vérifier si le lieu est proche des coordonnées fournies
   let distance = calculate_distance(coordinates, google_place.coordinates);
   if distance > 5000.0 {  // Plus de 5 km
       warn!("Lieu Google Places trop éloigné");
   }
   ```

3. **Choix parmi plusieurs résultats** :
   ```rust
   // Au lieu de prendre seulement le premier, comparer plusieurs résultats
   for place in search_payload.places {
       let score = calculate_matching_score(&place, &nom_prestataire, &coordinates);
       if score > best_score {
           best_place = place;
       }
   }
   ```

## 📊 Résumé

**Matching lors de la création** :
1. ✅ Construction de la requête : titre + produit + prestataire + localisation
2. ✅ Appel Google Places Search API avec `textQuery` + `regionCode` + `locationBias`
3. ✅ Sélection du **premier résultat** (le plus pertinent selon Google)
4. ✅ Récupération des détails complets via Places Details API
5. ✅ Sauvegarde dans `google_places_data` avec `service_id` + `place_id`

**Critères de matching** :
- Recherche textuelle dans nom/adresse/types
- Filtrage géographique (pays + rayon 8 km)
- Classement par pertinence Google

**⚠️ Point d'attention** : On fait confiance au classement Google sans validation supplémentaire.

