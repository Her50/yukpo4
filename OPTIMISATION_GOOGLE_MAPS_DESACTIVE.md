# Optimisation : Désactivation Google Maps par défaut

**Date**: 2025-11-28  
**Objectif**: Réduire le temps de recherche de 16.7s à <2s en désactivant les appels Google Maps synchrones

## Problème identifié

Les appels Google Maps Distance Matrix API étaient le **vrai goulot d'étranglement** :
- **10-15 secondes** pour calculer les distances de route précises
- Appels **séquentiels** (1 par résultat)
- Redondant : PostgreSQL calcule déjà la distance avec `ST_Distance`
- Redondant : ProductCard peut calculer la distance côté client avec Haversine

## Solution implémentée

### 1. Désactivation des appels Google Maps par défaut

Tous les appels à `SearchResult::enrich_with_google_maps()` ont été commentés dans :
- `search_specialized_services()` (ligne ~815)
- `search_services_gps_final()` (ligne ~910)
- `search_services_gps_final_with_moment()` (ligne ~1050)
- `search_services_trigram_gps_optimized()` (ligne ~1558)
- `search_services_keywords_gps_optimized()` (ligne ~1781)

### 2. Distance toujours disponible

La distance est **toujours calculée et retournée** via :

#### Backend (PostgreSQL)
- Les fonctions SQL `search_services_gps_final()` calculent `distance_km` avec `ST_Distance`
- Retourné dans le JSON via `SearchResult::to_json()` → `"distance_km": self.distance_km`

#### Frontend (ProductCard)
- **Source 1** : `product.distance_km` (depuis PostgreSQL) ✅ **PRIORITÉ**
- **Source 2** : `service?.distance_km` (fallback)
- **Source 3** : Calcul côté client avec Haversine si GPS disponible

```typescript
// ProductCard.tsx ligne 793-859
const rawDistance = product.distance_km
  ?? product.distanceKm
  ?? service?.distance_km
  ?? service?.distanceKm;

// Si pas de distance, calcul côté client
if (!distanceKm && effectiveUserLocation) {
  const serviceGPS = parseGPS(service?.gps);
  if (serviceGPS) {
    distanceKm = locationCalculateDistance(...); // Haversine
  }
}
```

### 3. Affichage dans ProductCard

La distance s'affiche toujours dans le badge (coin supérieur gauche) :
```typescript
// ProductCard.tsx ligne 1292-1297
{formattedDistance && (
  <View style={styles.distanceBadge}>
    <SafeIcon name="navigation" size={12} color="#FFF" />
    <Text style={styles.distanceText}>{formattedDistance}</Text>
  </View>
)}
```

Format : `"500m"` si <1km, sinon `"2.5km"` ou `"10km"`

## Impact attendu

### Performance
- **Avant** : 16.7s (dont 10-15s Google Maps)
- **Après** : <2s (PostgreSQL + cache Redis)
- **Gain** : **~88% de réduction** ⚡

### Précision de la distance
- **PostgreSQL ST_Distance** : Distance géodésique précise (sphère WGS84)
- **Haversine côté client** : Fallback si distance PostgreSQL manquante
- **Google Maps** : Distance de route précise (désactivée par défaut, peut être réactivée)

## Réactivation Google Maps (optionnel)

Pour réactiver Google Maps pour des cas spécifiques (navigation précise) :

1. **Via constructeur** :
```rust
let search_service = NativeSearchService::with_cache_and_geographic_matching(
    pool,
    cache_service,
    geographic_matching_service, // ✅ Réactiver ici
);
```

2. **Décommenter les appels** dans `native_search_service.rs` :
```rust
// Décommenter les blocs commentés avec "OPTIMISÉ 2025-11-28"
SearchResult::enrich_with_google_maps(...).await;
```

## Vérifications

✅ Code compile sans warnings  
✅ Distance PostgreSQL retournée dans JSON (`distance_km`)  
✅ ProductCard affiche la distance depuis `product.distance_km`  
✅ Fallback Haversine côté client si distance manquante  
✅ Tous les appels Google Maps désactivés par défaut  

## Prochaines optimisations possibles

1. **Batch Google Maps API** : Si réactivé, utiliser 1 appel au lieu de N
2. **Batch SQL Google Places** : 1 requête au lieu de N
3. **LIMIT précoce** : Limiter les résultats avant enrichissement
4. **Recherche unifiée** : Fusionner les méthodes de recherche au lieu de séquentiel

