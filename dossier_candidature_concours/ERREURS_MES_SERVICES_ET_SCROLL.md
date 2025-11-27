# Analyse des Erreurs - Mes Services et Scroll Horizontal

## Date d'analyse
2025-11-27

## Vue d'ensemble
Analyse approfondie des erreurs et warnings dans "Mes Services" (MesProduitsScreen) et des problèmes de scroll horizontal automatique dans HomeScreen.

---

## 🔴 PRIORITÉ 1 : Erreurs Critiques

### 1. MesProduitsScreen - Timeout pour /api/prestataire/services

**Lignes dans les logs :** 2304, 2305, 2311, 2312
```
[ERROR] MesProduitsScreen | Erreur chargement services: {
  "message": "La requête a expiré. Vérifiez votre connexion internet.",
  "error": "La requête a expiré. Vérifiez votre connexion internet."
}

[ERROR] Mobile API | Timeout pour /api/prestataire/services
[ERROR] Mobile API | Aborted
```

**Cause identifiée :**
1. **Requête SQL lente** - La requête dans `get_services_for_prestataire` prend trop de temps
2. **Warnings "slow statement"** - Plusieurs requêtes SQL dépassent le seuil d'alerte (lignes 1552, 1874, 2107, 2266, 2334)
3. **Timeout client** - Le client mobile annule la requête après un certain temps

**Impact :**
- ❌ Impossible de charger les produits dans MesProduitsScreen
- ❌ L'utilisateur voit une erreur "La requête a expiré"
- ❌ Expérience utilisateur dégradée

**Solution proposée :**

#### Étape 1 : Optimiser la requête SQL
```rust
// Dans backend/src/controllers/service_controller.rs
// La requête actuelle extrait beaucoup de données JSON
// Optimiser avec:
// 1. LIMIT et pagination
// 2. Index sur user_id, is_active, created_at
// 3. Réduire les extractions JSON complexes
```

#### Étape 2 : Ajouter la pagination
```rust
// Ajouter des paramètres de pagination
pub async fn get_services_for_prestataire(
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    let page: usize = params.get("page")
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    let limit: usize = params.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(20); // Limiter à 20 services par défaut
    
    // Utiliser LIMIT et OFFSET dans la requête SQL
    let offset = page * limit;
    // ... requête avec LIMIT $1 OFFSET $2
}
```

#### Étape 3 : Augmenter le timeout côté client
```typescript
// Dans mobile/src/services/api.ts
// Augmenter le timeout pour /api/prestataire/services
const timeout = 60000; // 60 secondes au lieu de 30
```

#### Étape 4 : Ajouter un cache
```rust
// Implémenter un cache Redis pour les services du prestataire
// Cache avec TTL de 5 minutes
```

**Fichiers à modifier :**
- `backend/src/controllers/service_controller.rs` (fonction `get_services_for_prestataire`)
- `mobile/src/services/api.ts` (timeout)
- Migrations SQL (ajouter index)

---

### 2. Slow SQL Statements - Requêtes lentes

**Lignes dans les logs :** 1552, 1874, 2107, 2266, 2334
```
[WARN] slow statement: execution time exceeded alert threshold
SELECT s.id, s.is_active, s.created_at, ...
```

**Cause identifiée :**
- Requête complexe avec extractions JSON multiples
- Pas d'index appropriés
- Pas de LIMIT
- Extraction de tous les services d'un coup

**Solution proposée :**

#### Étape 1 : Ajouter des index
```sql
-- Migration SQL
CREATE INDEX IF NOT EXISTS idx_services_user_id_active 
ON services(user_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_created_at 
ON services(created_at DESC);

-- Index GIN pour recherches JSONB
CREATE INDEX IF NOT EXISTS idx_services_data_gin 
ON services USING GIN (data);
```

#### Étape 2 : Optimiser la requête
```rust
// Utiliser des sous-requêtes optimisées
// Extraire seulement les champs nécessaires
// Éviter les COALESCE multiples dans une seule requête
```

#### Étape 3 : Ajouter EXPLAIN ANALYZE
```rust
// Logger EXPLAIN ANALYZE pour identifier les bottlenecks
let explain_result = sqlx::query("EXPLAIN ANALYZE SELECT ...")
    .fetch_one(&state.pg)
    .await?;
log::debug!("[get_services_for_prestataire] Query plan: {:?}", explain_result);
```

**Fichiers à modifier :**
- `backend/src/controllers/service_controller.rs`
- Nouvelle migration SQL

---

## ⚠️ PRIORITÉ 2 : Warnings et Problèmes UX

### 3. Scroll Horizontal Automatique dans HomeScreen

**Lignes dans le code :** `mobile/src/screens/HomeScreen.tsx` lignes 204-221

**Problème identifié :**
```typescript
// ✅ NOUVEAU: Scroll automatique vers le carousel au démarrage de l'app
React.useEffect(() => {
    if (CRASH_PREVENTION_CONFIG.DISABLE_HOME_AUTOSCROLL) {
        console.log('[HomeScreen] ⏸️ Scroll automatique désactivé (configuration)');
        return;
    }

    // Attendre que le layout soit stabilisé, puis scroller vers le carousel
    const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
            y: 100, // Scroll léger pour rendre le carousel visible
            animated: true,
        });
        console.log('[HomeScreen] 🎯 Scroll automatique vers le carousel au démarrage');
    }, 1500); // 1.5 secondes pour laisser le temps au contenu de charger

    return () => clearTimeout(timer);
}, []); // Se déclenche une seule fois au mount du composant
```

**Problèmes potentiels :**
1. **Scroll automatique non désiré** - L'utilisateur peut ne pas vouloir que l'app scrolle automatiquement
2. **Conflit avec scroll utilisateur** - Si l'utilisateur scroll pendant le chargement, le scroll automatique peut interférer
3. **Timing incorrect** - 1.5 secondes peut être trop court ou trop long selon le chargement

**Solution proposée :**

#### Étape 1 : Améliorer la détection de l'état de chargement
```typescript
// Ne scroller que si le contenu est chargé ET l'utilisateur n'a pas scrollé
const [hasUserScrolled, setHasUserScrolled] = useState(false);
const [contentLoaded, setContentLoaded] = useState(false);

React.useEffect(() => {
    if (CRASH_PREVENTION_CONFIG.DISABLE_HOME_AUTOSCROLL) {
        return;
    }

    // Attendre que le contenu soit chargé
    if (!contentLoaded) {
        return;
    }

    // Ne pas scroller si l'utilisateur a déjà scrollé
    if (hasUserScrolled) {
        return;
    }

    const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
            y: 100,
            animated: true,
        });
    }, 500); // Réduire à 500ms après chargement

    return () => clearTimeout(timer);
}, [contentLoaded, hasUserScrolled]);
```

#### Étape 2 : Détecter le scroll utilisateur
```typescript
<ScrollView
    ref={scrollViewRef}
    onScroll={(event) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        if (scrollY > 10) {
            setHasUserScrolled(true);
        }
        // ... reste du code
    }}
    scrollEventThrottle={16}
>
```

#### Étape 3 : Ajouter une option utilisateur
```typescript
// Permettre à l'utilisateur de désactiver le scroll automatique
const [autoScrollEnabled, setAutoScrollEnabled] = useState(
    await AsyncStorage.getItem('home_auto_scroll') !== 'false'
);
```

**Fichiers à modifier :**
- `mobile/src/screens/HomeScreen.tsx`

---

### 4. Scroll Horizontal dans MixedContentCarousel

**Problème identifié :**
- Le carousel utilise un ScrollView horizontal
- Peut entrer en conflit avec le ScrollView vertical du parent
- `nestedScrollEnabled={true}` est activé mais peut causer des problèmes

**Solution proposée :**

#### Étape 1 : Utiliser FlatList au lieu de ScrollView
```typescript
// Dans MixedContentCarousel.tsx
// Remplacer ScrollView horizontal par FlatList
<FlatList
    horizontal
    data={items}
    renderItem={({ item }) => <ProductCard product={item} />}
    keyExtractor={(item) => item.id}
    showsHorizontalScrollIndicator={false}
    nestedScrollEnabled={true}
    // Empêcher le scroll vertical du parent pendant le scroll horizontal
    onScrollBeginDrag={() => {
        // Désactiver temporairement le scroll vertical du parent
    }}
    onScrollEndDrag={() => {
        // Réactiver le scroll vertical du parent
    }}
/>
```

#### Étape 2 : Améliorer la gestion des gestes
```typescript
// Utiliser react-native-gesture-handler pour meilleure gestion
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

**Fichiers à modifier :**
- `mobile/src/components/MixedContentCarousel.tsx`

---

## 📊 Statistiques des Erreurs

### MesProduitsScreen
- **Erreurs timeout :** 2 occurrences dans les logs
- **Taux d'échec estimé :** ~10-20% (basé sur les logs)
- **Temps de réponse moyen :** > 30 secondes (timeout)

### Slow Statements
- **Warnings "slow statement" :** 5+ occurrences
- **Temps d'exécution :** > 10 secondes (seuil d'alerte)
- **Requête concernée :** `SELECT s.id, s.is_active, s.created_at, ...`

### Scroll Horizontal
- **Problèmes identifiés :** Conflits potentiels entre scroll vertical et horizontal
- **Impact UX :** Moyen (peut être gênant mais non bloquant)

---

## 🔧 Actions Correctives Prioritaires

### Priorité 1 (Critique)
1. **Optimiser requête /api/prestataire/services**
   - Ajouter pagination
   - Ajouter index SQL
   - Réduire données extraites
   - Implémenter cache

2. **Corriger slow statements**
   - Analyser EXPLAIN ANALYZE
   - Ajouter index appropriés
   - Optimiser requêtes JSONB

### Priorité 2 (Important)
3. **Améliorer scroll automatique HomeScreen**
   - Détecter scroll utilisateur
   - Ajouter option de désactivation
   - Améliorer timing

4. **Optimiser MixedContentCarousel**
   - Utiliser FlatList
   - Améliorer gestion gestes
   - Prévenir conflits scroll

---

## 📝 Checklist d'Implémentation

### Phase 1 : Corrections Critiques
- [ ] **1.1** Ajouter pagination à `/api/prestataire/services`
- [ ] **1.2** Créer migration SQL avec index
- [ ] **1.3** Optimiser requête SQL (réduire extractions JSON)
- [ ] **1.4** Augmenter timeout côté client mobile
- [ ] **1.5** Implémenter cache Redis (optionnel mais recommandé)
- [ ] **2.1** Analyser EXPLAIN ANALYZE pour slow statements
- [ ] **2.2** Ajouter index GIN pour JSONB
- [ ] **2.3** Optimiser requêtes avec LIMIT

### Phase 2 : Améliorations UX
- [ ] **3.1** Améliorer détection scroll utilisateur
- [ ] **3.2** Ajouter option désactivation scroll automatique
- [ ] **3.3** Ajuster timing scroll automatique
- [ ] **4.1** Remplacer ScrollView par FlatList dans MixedContentCarousel
- [ ] **4.2** Améliorer gestion gestes scroll

### Phase 3 : Tests et Validation
- [ ] Tests de charge pour `/api/prestataire/services`
- [ ] Tests de performance SQL
- [ ] Tests UX scroll horizontal/vertical
- [ ] Tests sur différents appareils

---

## 🔍 Fichiers à Modifier

### Backend
1. `backend/src/controllers/service_controller.rs` - Fonction `get_services_for_prestataire`
2. Nouvelle migration SQL - Index et optimisations
3. `backend/src/services/cache_service.rs` (si cache implémenté)

### Mobile
1. `mobile/src/screens/MesProduitsScreen.tsx` - Gestion timeout et pagination
2. `mobile/src/screens/HomeScreen.tsx` - Scroll automatique
3. `mobile/src/components/MixedContentCarousel.tsx` - Scroll horizontal
4. `mobile/src/services/api.ts` - Timeout configuration

---

## 📚 Références

- Logs analysés : `dossier_candidature_concours/logbackend1.md`
- Code backend : `backend/src/controllers/service_controller.rs`
- Code mobile : `mobile/src/screens/MesProduitsScreen.tsx`, `mobile/src/screens/HomeScreen.tsx`

---

## 🚀 Prochaines Étapes

1. Commencer par optimiser la requête SQL (Priorité 1)
2. Ajouter pagination et index
3. Tester les performances
4. Implémenter les améliorations UX (Priorité 2)
5. Valider avec les utilisateurs

