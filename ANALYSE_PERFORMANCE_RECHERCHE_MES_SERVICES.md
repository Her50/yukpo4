# 🔍 Analyse Performance - Recherche Produits & Mes Services

## ⚠️ Problèmes Identifiés

### 1. **MesServicesScreen.tsx** - Chargement Lent

#### Problèmes Majeurs :

1. **❌ Pas de Pagination** (Ligne 68)
   ```typescript
   const response = await apiGet('/api/prestataire/services');
   ```
   - Charge **TOUS** les services d'un coup
   - Si l'utilisateur a 50+ services avec 10+ produits chacun = 500+ items à parser
   - Bloque le thread principal pendant le parsing

2. **❌ Parsing Complexe et Lent** (Lignes 105-300)
   ```typescript
   data.forEach((service: any) => {
     // Vérifie 3 structures différentes pour chaque service
     // Puis pour chaque produit :
     produits.forEach((product: any, index: number) => {
       // Parsing complexe avec plusieurs if/else
       // Extraction de chaînes avec split()
       // Création d'objets complexes
     });
   });
   ```
   - **Double boucle imbriquée** : O(n × m) où n = services, m = produits
   - **Parsing de chaînes** avec `split()` et logique complexe (lignes 163-220)
   - **Création d'objets** pour chaque produit (ligne 222-258)

3. **❌ Trop de console.log en Production** (20+ logs)
   - Lignes 70, 95, 136, 154, 164, 196, 262, 274, 276, 287, 302, 310, 332, 338, 343
   - Les `console.log` sont **lents** en production React Native
   - Surtout avec des objets complexes

4. **❌ Rechargement à Chaque Focus** (Ligne 325)
   ```typescript
   useFocusEffect(
     useCallback(() => {
       loadServices(true); // Recharge TOUT à chaque fois
     }, [loadServices])
   );
   ```
   - Pas de cache
   - Recharge même si les données n'ont pas changé

5. **❌ Pas de Debounce/Throttle**
   - Si l'utilisateur navigue rapidement, plusieurs appels API simultanés

### 2. **ResultatBesoinScreen.tsx** - Recherche Lente

#### Problèmes Majeurs :

1. **❌ Pas de Debounce sur Autocomplete** (Ligne 475)
   ```typescript
   const fetchSuggestions = useCallback(async (query: string) => {
     // Appel API à chaque changement de caractère
     const response = await apiPost('/api/autocomplete/search-products', payload);
   }, [location]);
   ```
   - Si l'utilisateur tape "ordinateur portable" = **20 appels API** (1 par caractère)
   - Pas de debounce visible

2. **❌ Pas de Cache des Résultats**
   - Même recherche = même appel API
   - Pas de mise en cache locale

3. **❌ Trop de console.log** (15+ logs)
   - Lignes 502, 873, 878, 881, 889, 898, 907, 918, 922, etc.

4. **❌ Pas de Pagination des Résultats**
   - Charge tous les résultats d'un coup
   - Si 1000+ résultats = lent

---

## ✅ Solutions Proposées

### 1. **Optimiser MesServicesScreen.tsx**

#### A. Ajouter Pagination Backend
```typescript
// Backend: /api/prestataire/services?page=1&limit=20
const response = await apiGet(`/api/prestataire/services?page=${page}&limit=20`);
```

#### B. Optimiser le Parsing
```typescript
// ✅ AVANT : Double boucle avec parsing complexe
data.forEach((service) => {
  produits.forEach((product) => {
    // Parsing complexe...
  });
});

// ✅ APRÈS : Utiliser useMemo pour parser une seule fois
const parsedProducts = useMemo(() => {
  return data.flatMap((service) => {
    const produits = extractProduits(service); // Fonction optimisée
    return produits.map((product, index) => parseProduct(product, index, service));
  });
}, [data]);
```

#### C. Supprimer console.log en Production
```typescript
// ✅ Créer un helper
const debugLog = __DEV__ ? console.log : () => {};

// Utiliser partout
debugLog('[MesServicesScreen] 🔍 Réponse API:', response);
```

#### D. Ajouter Cache avec AsyncStorage
```typescript
const CACHE_KEY = 'mes_services_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const loadServices = useCallback(async (isRefresh = false) => {
  // Vérifier le cache
  if (!isRefresh) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        setServices(data);
        setLoading(false);
        return; // ✅ Retour immédiat depuis le cache
      }
    }
  }

  // Sinon, charger depuis l'API
  const response = await apiGet('/api/prestataire/services');
  
  // Sauvegarder dans le cache
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
    data: response.data,
    timestamp: Date.now()
  }));
  
  setServices(response.data);
}, []);
```

#### E. Optimiser le Parsing avec Fonction Dédiée
```typescript
// ✅ Fonction optimisée pour parser un produit
const parseProduct = useCallback((product: any, index: number, service: any) => {
  // Version optimisée sans console.log
  if (typeof product === 'string') {
    const parts = product.split(',');
    return {
      title: parts[0]?.trim() || `Produit ${index + 1}`,
      description: parts.slice(2, -1).join(', ').trim() || 'Aucune description',
      // ... autres champs
    };
  }
  
  // Objet
  return {
    title: product.nom || product.titre || product.title || `Produit ${index + 1}`,
    description: product.description || product.desc || 'Aucune description',
    // ... autres champs
  };
}, []);
```

### 2. **Optimiser ResultatBesoinScreen.tsx**

#### A. Ajouter Debounce sur Autocomplete
```typescript
import { debounce } from 'lodash';

// ✅ Debounce de 300ms
const debouncedFetchSuggestions = useMemo(
  () => debounce(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const response = await apiPost('/api/autocomplete/search-products', {
      query,
      limit: 10,
    });
    
    if (response.success) {
      setSuggestions(normalizeAutocompleteResponse(response));
    }
  }, 300),
  [location]
);

// Utiliser dans useEffect
useEffect(() => {
  if (searchQuery.length >= 2) {
    debouncedFetchSuggestions(searchQuery);
  }
  
  return () => {
    debouncedFetchSuggestions.cancel(); // Annuler si le composant se démonte
  };
}, [searchQuery, debouncedFetchSuggestions]);
```

#### B. Ajouter Cache des Résultats de Recherche
```typescript
const SEARCH_CACHE_KEY = 'search_results_cache';
const MAX_CACHE_SIZE = 50; // Max 50 recherches en cache

const searchFinal = useCallback(async (query: string) => {
  // Vérifier le cache
  const cacheKey = `${SEARCH_CACHE_KEY}_${query}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 10 * 60 * 1000) { // 10 minutes
      setResults(data);
      return; // ✅ Retour immédiat
    }
  }

  // Sinon, rechercher
  const response = await apiPost('/api/search/direct', payload);
  const results = extractSearchResults(response);
  
  // Sauvegarder dans le cache
  await AsyncStorage.setItem(cacheKey, JSON.stringify({
    data: results,
    timestamp: Date.now()
  }));
  
  setResults(results);
}, []);
```

#### C. Supprimer console.log en Production
```typescript
const debugLog = __DEV__ ? console.log : () => {};
```

### 3. **Optimisations Backend (si possible)**

#### A. Pagination
```rust
// backend/src/controllers/prestataire_controller.rs
pub async fn get_my_services(
    Query(params): Query<HashMap<String, String>>,
    // ...
) -> Result<Json<Vec<Service>>, AppError> {
    let page: i64 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let offset = (page - 1) * limit;
    
    let services = sqlx::query_as::<_, Service>(
        "SELECT * FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await?;
    
    Ok(Json(services))
}
```

#### B. Index Database
```sql
-- Ajouter des index pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id);
```

#### C. Optimiser la Requête SQL
```rust
// Au lieu de charger tous les services puis parser les produits,
// Charger directement les produits avec JOIN
let products = sqlx::query_as::<_, Product>(
    r#"
    SELECT 
        p.*,
        s.id as service_id,
        s.data->>'titre_service' as service_title
    FROM products p
    JOIN services s ON p.service_id = s.id
    WHERE s.user_id = $1
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
    "#
)
.bind(user_id)
.bind(limit)
.bind(offset)
.fetch_all(&pool)
.await?;
```

---

## 📊 Impact Attendu

### Avant Optimisations :
- **MesServicesScreen** : 2-5 secondes (50 services × 10 produits = 500 items)
- **ResultatBesoinScreen** : 500ms-2s par recherche
- **Autocomplete** : 20 appels API pour "ordinateur portable"

### Après Optimisations :
- **MesServicesScreen** : **< 500ms** (cache) ou **< 1s** (première charge avec pagination)
- **ResultatBesoinScreen** : **< 300ms** (cache) ou **< 800ms** (première recherche)
- **Autocomplete** : **1 appel API** (debounce 300ms)

---

## 🚀 Plan d'Implémentation

### Phase 1 : Quick Wins (1-2h)
1. ✅ Supprimer tous les `console.log` en production
2. ✅ Ajouter debounce sur autocomplete
3. ✅ Ajouter cache simple avec AsyncStorage

### Phase 2 : Optimisations Frontend (2-3h)
4. ✅ Optimiser le parsing avec `useMemo`
5. ✅ Ajouter pagination frontend (si backend supporte)
6. ✅ Optimiser les re-renders avec `React.memo`

### Phase 3 : Optimisations Backend (si possible) (3-4h)
7. ✅ Ajouter pagination backend
8. ✅ Optimiser requêtes SQL avec JOIN
9. ✅ Ajouter index database

---

## 🔧 Code à Implémenter

Voir les fichiers suivants pour les implémentations détaillées :
- `mobile/src/screens/MesServicesScreen.optimized.tsx` (à créer)
- `mobile/src/screens/ResultatBesoinScreen.optimized.tsx` (à créer)
- `mobile/src/utils/cache.ts` (helper cache)
- `mobile/src/utils/debounce.ts` (helper debounce)

