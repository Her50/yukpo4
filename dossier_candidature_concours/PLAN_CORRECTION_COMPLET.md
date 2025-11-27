# Plan de Correction Complet - Toutes les Erreurs Identifiées

## Date de création
2025-11-27

## Vue d'ensemble
Plan d'action complet pour corriger toutes les erreurs et warnings identifiés dans les logs, incluant :
- Création de produit
- Mes Services / Mes Produits
- Scroll horizontal automatique
- Coach IA
- Requêtes SQL lentes

---

## 📋 RÉSUMÉ DES ERREURS IDENTIFIÉES

### 🔴 Erreurs Critiques (Priorité 1)
1. **CRASH : Cannot read property 'map' of undefined** - ServiceProductSelector, ProductVideoCreationModal
2. **CRASH : Text strings must be rendered within a <Text> component** - Affichage JSON brut
3. **MediaUploadManager** - ImagePicker ou MediaType undefined
4. **Produit créé sans images** - Conséquence de l'erreur MediaUploadManager
5. **Erreur génération vidéo** - Aucune image trouvée
6. **MesProduitsScreen timeout** - `/api/prestataire/services` expire
7. **Slow SQL statements** - Requêtes > 10 secondes
8. **Affichage JSON brut dans sélection produit** - ServiceProductSelector
9. **Étapes création vidéo sans contenu** - ProductVideoCreationModal

### ⚠️ Warnings (Priorité 2)
6. **Coach IA indisponible** - brief, style, plan
7. **Aucune combinaison préférée** - Warning non bloquant
8. **Scroll horizontal automatique** - Conflits potentiels

---

## 🔧 PLAN D'ACTION DÉTAILLÉ

### PHASE 0 : Corrections Crashes Critiques (URGENT - Immédiat)

#### 0.1 Corriger crashes "map of undefined" (URGENT)

**Fichiers :** 
- `mobile/src/components/ServiceProductSelector.tsx`
- `mobile/src/components/ProductVideoCreationModal.tsx`

**Actions :**
```typescript
// ✅ CORRIGÉ: Vérifier que products est défini
const safeProducts = Array.isArray(products) ? products : [];

// ✅ CORRIGÉ: Vérifier avant chaque .map()
{Array.isArray(services) && services.length > 0 ? (
    services.map((service) => {
        if (!service || !Array.isArray(service.products)) {
            return null;
        }
        return (
            // ...
            {service.products.map((product) => {
                if (!product) return null;
                // ...
            })}
        );
    })
) : (
    <View style={styles.emptyState}>
        <Text>Aucun produit disponible</Text>
    </View>
)}
```

**Status :** ✅ **CORRIGÉ** - Voir `CORRECTIONS_CRASHES_CRITIQUES.md`

---

#### 0.2 Corriger crash "Text strings must be rendered within <Text>" (URGENT)

**Fichiers :**
- `mobile/src/components/ServiceProductSelector.tsx`
- `mobile/src/components/ProductVideoCreationModal.tsx`

**Actions :**
```typescript
// ✅ CORRIGÉ: Fonction pour extraire nom depuis JSON brut
const extractProductName = (productName: any): string => {
    if (!productName) return 'Produit sans nom';
    
    if (typeof productName === 'string') {
        const trimmed = productName.trim();
        // Éviter JSON brut
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null && 'valeur' in parsed) {
                    return parsed.valeur.trim() || 'Produit sans nom';
                }
            } catch {}
        }
        return trimmed || 'Produit sans nom';
    }
    
    if (typeof productName === 'object' && productName !== null && 'valeur' in productName) {
        return productName.valeur.trim() || 'Produit sans nom';
    }
    
    return String(productName) || 'Produit sans nom';
};

// Utilisation
<Text style={styles.productName}>
    {extractProductName(product.productName)}
</Text>
```

**Status :** ✅ **CORRIGÉ** - Voir `CORRECTIONS_CRASHES_CRITIQUES.md`

---

#### 0.3 Corriger affichage étapes création vidéo (URGENT)

**Fichier :** `mobile/src/components/ProductVideoCreationModal.tsx`

**Actions :**
```typescript
// ✅ CORRIGÉ: Vérifier que selectedProduct est valide
onPress={() => {
    if (!product) {
        console.error('[ProductVideoCreationModal] Produit null/undefined');
        return;
    }
    
    const normalizedProduct = {
        ...product,
        nom: product.nom || product.nom_produit || 'Produit sans nom',
        nom_produit: product.nom_produit || product.nom || 'Produit sans nom'
    };
    
    setSelectedProduct(normalizedProduct);
}}

// ✅ CORRIGÉ: Vérifier que groupedProducts est défini
{Array.isArray(groupedProducts) && groupedProducts.length > 0 ? (
    groupedProducts.map((group) => {
        if (!group || !Array.isArray(group.items)) {
            return null;
        }
        // ...
    })
) : (
    <View style={styles.emptyState}>
        <Text>Aucun produit disponible</Text>
    </View>
)}
```

**Status :** ✅ **CORRIGÉ** - Voir `ERREURS_CREATION_VIDEO.md`

---

### PHASE 1 : Corrections Critiques Backend (Semaine 1)

#### 1.1 Optimiser `/api/prestataire/services` (URGENT)

**Fichier :** `backend/src/controllers/service_controller.rs`

**Actions :**
```rust
// 1. Ajouter pagination
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
        .unwrap_or(20); // Limiter à 20 par défaut
    
    let offset = page * limit;
    
    // Modifier la requête SQL pour ajouter LIMIT et OFFSET
    sqlx::query(
        r#"
        SELECT ...
        FROM services s
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(user.id)
    .bind(limit as i64)
    .bind(offset as i64)
    // ...
}
```

**Migration SQL :**
```sql
-- Ajouter index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_services_user_id_active_created 
ON services(user_id, is_active, created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_data_gin 
ON services USING GIN (data);

-- Index pour products_lifecycle
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product 
ON products_lifecycle(service_id, product_index);
```

**Tests :**
- [ ] Tester avec 100+ services
- [ ] Vérifier temps de réponse < 2 secondes
- [ ] Tester pagination

---

#### 1.2 Corriger Slow SQL Statements

**Fichier :** `backend/src/controllers/service_controller.rs`

**Actions :**
1. Analyser EXPLAIN ANALYZE
2. Optimiser requêtes JSONB
3. Ajouter LIMIT partout
4. Utiliser LATERAL JOIN au lieu de sous-requêtes corrélées

**Code :**
```rust
// Ajouter logging EXPLAIN ANALYZE en mode debug
#[cfg(debug_assertions)]
{
    let explain = sqlx::query("EXPLAIN ANALYZE SELECT ...")
        .fetch_one(&state.pg)
        .await?;
    log::debug!("Query plan: {:?}", explain);
}
```

**Migration SQL :**
```sql
-- Index pour recherches JSONB fréquentes
CREATE INDEX IF NOT EXISTS idx_services_data_titre_service 
ON services USING GIN ((data->'titre_service'));

CREATE INDEX IF NOT EXISTS idx_services_data_produits 
ON services USING GIN ((data->'produits'));
```

---

### PHASE 2 : Corrections Critiques Mobile (Semaine 1)

#### 2.1 Corriger MediaUploadManager

**Fichier :** `mobile/src/components/MediaUploadManager.tsx`

**Actions :**
```typescript
// Améliorer la vérification d'initialisation
const checkImagePickerAvailable = (): boolean => {
  try {
    return !!(
      ImagePicker &&
      typeof ImagePicker.requestMediaLibraryPermissionsAsync === 'function' &&
      ImagePicker.MediaType &&
      ImagePicker.MediaType.Images &&
      ImagePicker.launchImageLibraryAsync
    );
  } catch (error) {
    console.error('[MediaUploadManager] Erreur vérification ImagePicker:', error);
    return false;
  }
};

// Utiliser dans pickImages et pickVideos
const pickImages = async () => {
  if (!checkImagePickerAvailable()) {
    console.error('[MediaUploadManager] ImagePicker non disponible');
    Alert.alert(
      'Fonctionnalité indisponible',
      'L\'accès à la galerie n\'est pas disponible sur cet appareil. Veuillez mettre à jour l\'application ou contacter le support.',
      [{ text: 'OK' }]
    );
    setUploading(false);
    return;
  }
  // ... reste du code
};
```

**Vérifications :**
- [ ] Vérifier `expo-image-picker` dans `package.json`
- [ ] Vérifier permissions dans `app.json`
- [ ] Tester sur Android et iOS

---

#### 2.2 Améliorer gestion timeout MesProduitsScreen

**Fichier :** `mobile/src/screens/MesProduitsScreen.tsx`

**Actions :**
```typescript
// Augmenter timeout et ajouter retry
const loadProducts = useCallback(async (isRefresh = false) => {
  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // Ajouter timeout personnalisé
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

    try {
      const servicesResponse = await apiGet('/api/prestataire/services', {
        signal: controller.signal,
        params: {
          page: 0,
          limit: 20 // Pagination
        }
      });
      clearTimeout(timeoutId);
      // ... reste du code
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        // Retry avec exponential backoff
        await retryWithBackoff(() => apiGet('/api/prestataire/services'), 3);
      }
      throw error;
    }
  } catch (error) {
    // ... gestion erreur
  }
}, []);
```

---

### PHASE 3 : Corrections Warnings (Semaine 2)

#### 3.1 Corriger Coach IA (brief, style, plan)

**Fichier :** `mobile/src/components/ProductVideoCreationModal.tsx`

**Actions :**
```typescript
// Ajouter retry avec exponential backoff
const fetchCoachData = async (type: 'brief' | 'style' | 'plan') => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const response = await mediaApi[`generateVideo${type.charAt(0).toUpperCase() + type.slice(1)}`]({
        // ... paramètres
      });
      
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.warn(`[ProductVideoCreationModal] Coach IA: ${type} indisponible après ${maxRetries} tentatives`);
        return getDefaultCoachData(type);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
};

// Valeurs par défaut
const getDefaultCoachData = (type: 'brief' | 'style' | 'plan'): any => {
  switch (type) {
    case 'brief':
      return {
        headline: normalizeProductName(primaryProduct),
        call_to_action: 'Découvrez maintenant',
        storyboard: ['Introduction', 'Caractéristiques', 'Appel à l\'action']
      };
    case 'style':
      return { preset: 'story', transitions: 'smooth' };
    case 'plan':
      return { distribution: ['product', 'chat'], duration: 15 };
    default:
      return {};
  }
};
```

**Vérifier backend :**
- [ ] Vérifier que les routes `/api/ia/video-brief`, `/api/ia/video-style`, `/api/ia/distribution-plan` existent
- [ ] Vérifier que les handlers gèrent correctement les erreurs

---

#### 3.2 Améliorer scroll automatique HomeScreen

**Fichier :** `mobile/src/screens/HomeScreen.tsx`

**Actions :**
```typescript
// Détecter scroll utilisateur et ne pas interférer
const [hasUserScrolled, setHasUserScrolled] = useState(false);
const [contentLoaded, setContentLoaded] = useState(false);

React.useEffect(() => {
    if (CRASH_PREVENTION_CONFIG.DISABLE_HOME_AUTOSCROLL) {
        return;
    }

    if (!contentLoaded || hasUserScrolled) {
        return;
    }

    const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
            y: 100,
            animated: true,
        });
    }, 500);

    return () => clearTimeout(timer);
}, [contentLoaded, hasUserScrolled]);

// Dans ScrollView
<ScrollView
    ref={scrollViewRef}
    onScroll={(event) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        if (scrollY > 10) {
            setHasUserScrolled(true);
        }
    }}
    scrollEventThrottle={16}
>
```

---

#### 3.3 Optimiser MixedContentCarousel

**Fichier :** `mobile/src/components/MixedContentCarousel.tsx`

**Actions :**
```typescript
// Utiliser FlatList au lieu de ScrollView pour meilleure performance
import { FlatList } from 'react-native';

<FlatList
    ref={flatListRef}
    horizontal
    data={content}
    renderItem={({ item, index }) => (
        <ProductCard 
            product={item} 
            onPress={() => handleProductPress(item)}
        />
    )}
    keyExtractor={(item, index) => `${item.type}-${index}`}
    showsHorizontalScrollIndicator={false}
    pagingEnabled={false}
    snapToInterval={SNAP_INTERVAL}
    decelerationRate="fast"
    // Empêcher conflit avec scroll vertical parent
    onScrollBeginDrag={() => {
        // Optionnel: désactiver scroll vertical parent
    }}
    onScrollEndDrag={() => {
        // Optionnel: réactiver scroll vertical parent
    }}
/>
```

---

### PHASE 4 : Améliorations et Optimisations (Semaine 2-3)

#### 4.1 Ajouter warning pour produits sans images

**Fichier :** `backend/src/controllers/product_addition_controller.rs`

**Actions :**
```rust
// Ajouter warning dans la réponse
Ok(Json(json!({
    "success": true,
    "service_id": service_id,
    "product_index": product_index,
    "cost": cout_ajout,
    "message": format!("Produit ajouté avec succès (coût: {} FCFA)", cout_ajout),
    "new_balance": new_balance,
    "warning": if saved_media_paths.images.is_none() {
        Some("Aucune image ajoutée. La génération de vidéo nécessite au moins une image.")
    } else {
        None
    }
})))
```

---

#### 4.2 Réduire niveau de log combinaisons préférées

**Fichier :** Composant mobile `AjouterProduitSimple` (à identifier)

**Actions :**
```typescript
// Changer de WARN à DEBUG
console.debug('[AjouterProduitSimple] Aucune combinaison préférée trouvée, utilisation objet vide');
```

---

## 📊 CHECKLIST COMPLÈTE D'IMPLÉMENTATION

### Crashes Critiques (URGENT - DÉJÀ CORRIGÉ)
- [x] **0.1.1** Vérifier products avant .reduce() dans ServiceProductSelector
- [x] **0.1.2** Vérifier services avant .map() dans ServiceProductSelector
- [x] **0.1.3** Vérifier service.products avant .map() dans ServiceProductSelector
- [x] **0.1.4** Vérifier groupedProducts avant .map() dans ProductVideoCreationModal
- [x] **0.1.5** Vérifier group.items avant .map() dans ProductVideoCreationModal
- [x] **0.1.6** Vérifier styleSuggestion.* avant .map() dans ProductVideoCreationModal
- [x] **0.1.7** Vérifier distributionPlan.* avant .map() dans ProductVideoCreationModal
- [x] **0.1.8** Vérifier variant.* avant .map() dans ProductVideoCreationModal
- [x] **0.2.1** Créer fonction extractProductName pour éviter JSON brut
- [x] **0.2.2** Appliquer extractProductName dans ServiceProductSelector
- [x] **0.2.3** Normaliser produit avant définition dans ProductVideoCreationModal
- [x] **0.3.1** Vérifier selectedProduct valide avant affichage sections
- [x] **0.3.2** Ajouter états vides avec messages

### Backend
- [ ] **1.1.1** Ajouter pagination à `get_services_for_prestataire`
- [ ] **1.1.2** Créer migration SQL avec index
- [ ] **1.1.3** Optimiser requête SQL (réduire extractions JSON)
- [ ] **1.1.4** Implémenter cache Redis (optionnel)
- [ ] **1.2.1** Analyser EXPLAIN ANALYZE pour slow statements
- [ ] **1.2.2** Ajouter index GIN pour JSONB
- [ ] **1.2.3** Optimiser requêtes avec LIMIT
- [ ] **4.1.1** Ajouter warning produits sans images

### Mobile
- [ ] **2.1.1** Améliorer vérification ImagePicker
- [ ] **2.1.2** Vérifier dépendances et permissions
- [ ] **2.1.3** Tester sur Android et iOS
- [ ] **2.2.1** Augmenter timeout MesProduitsScreen
- [ ] **2.2.2** Ajouter retry avec backoff
- [ ] **2.2.3** Implémenter pagination côté client
- [ ] **3.1.1** Ajouter retry Coach IA
- [ ] **3.1.2** Implémenter valeurs par défaut
- [ ] **3.1.3** Vérifier routes backend
- [ ] **3.2.1** Améliorer détection scroll utilisateur
- [ ] **3.2.2** Ajouter option désactivation
- [ ] **3.3.1** Remplacer ScrollView par FlatList
- [ ] **3.3.2** Améliorer gestion gestes
- [ ] **4.2.1** Réduire niveau log combinaisons

### Tests
- [ ] Tests de charge pour `/api/prestataire/services`
- [ ] Tests de performance SQL
- [ ] Tests UX scroll horizontal/vertical
- [ ] Tests upload images/vidéos
- [ ] Tests Coach IA avec retry
- [ ] Tests end-to-end complets

---

## 🎯 ORDRE D'EXÉCUTION RECOMMANDÉ

### Semaine 0 (URGENT - DÉJÀ FAIT)
0. **Jour 1 :** ✅ Corriger crashes "map of undefined"
1. **Jour 1 :** ✅ Corriger crash "Text strings must be rendered within <Text>"
2. **Jour 1 :** ✅ Corriger affichage étapes création vidéo
3. **Jour 1 :** ✅ Corriger affichage JSON brut dans sélection produit

### Semaine 1 (Critique)
1. **Jour 1-2 :** Optimiser `/api/prestataire/services` (pagination + index)
2. **Jour 3 :** Corriger MediaUploadManager
3. **Jour 4 :** Améliorer timeout MesProduitsScreen
4. **Jour 5 :** Tests et validation

### Semaine 2 (Important)
5. **Jour 1-2 :** Corriger Coach IA (retry + valeurs par défaut)
6. **Jour 3 :** Améliorer scroll automatique
7. **Jour 4 :** Optimiser MixedContentCarousel
8. **Jour 5 :** Tests et validation

### Semaine 3 (Améliorations)
9. **Jour 1-2 :** Ajouter warnings et améliorer logs
10. **Jour 3-4 :** Optimisations supplémentaires
11. **Jour 5 :** Tests finaux et déploiement

---

## 📈 MÉTRIQUES DE SUCCÈS

### Performance
- **Temps de réponse `/api/prestataire/services` :** < 2 secondes (actuellement > 30s)
- **Taux de succès upload images :** > 95% (actuellement ~0%)
- **Taux de succès génération vidéo :** > 70% (actuellement 0%)

### Disponibilité
- **Disponibilité Coach IA :** > 90% (actuellement ~0%)
- **Taux d'échec MesProduitsScreen :** < 5% (actuellement ~20%)

### UX
- **Réduction warnings :** > 50%
- **Satisfaction utilisateur :** Amélioration mesurable

---

## 🔍 FICHIERS À MODIFIER (RÉCAPITULATIF)

### Backend
1. `backend/src/controllers/service_controller.rs` - `get_services_for_prestataire`
2. `backend/src/controllers/product_addition_controller.rs` - Warning produits sans images
3. `backend/src/services/video_generation_service.rs` - Améliorer messages
4. Nouvelle migration SQL - Index et optimisations
5. `backend/src/routers/router_yukpo.rs` - Vérifier routes Coach IA

### Mobile
1. `mobile/src/components/MediaUploadManager.tsx` - Vérification ImagePicker
2. `mobile/src/screens/MesProduitsScreen.tsx` - Timeout et pagination
3. `mobile/src/components/ProductVideoCreationModal.tsx` - Coach IA retry
4. `mobile/src/screens/HomeScreen.tsx` - Scroll automatique
5. `mobile/src/components/MixedContentCarousel.tsx` - FlatList
6. `mobile/src/services/api.ts` - Configuration timeout
7. Composant `AjouterProduitSimple` - Réduire logs

---

## 📚 DOCUMENTS DE RÉFÉRENCE

- `CORRECTIONS_CRASHES_CRITIQUES.md` - ✅ Corrections crashes critiques appliquées
- `ERREURS_CREATION_VIDEO.md` - Analyse problèmes création vidéo
- `ERREURS_AFFICHAGE_PRODUITS_MES_SERVICES.md` - Analyse problèmes affichage Mes Services
- `CORRECTIONS_AFFICHAGE_APPLIQUEES.md` - Corrections affichage appliquées
- `ERREURS_CREATION_PRODUIT.md` - Détails erreurs création produit
- `ERREURS_MES_SERVICES_ET_SCROLL.md` - Détails erreurs Mes Services et scroll
- `PLAN_CORRECTION_CREATION_PRODUIT.md` - Plan détaillé création produit
- Logs : `dossier_candidature_concours/logbackend1.md`

---

## 🚀 PROCHAINES ÉTAPES IMMÉDIATES

1. **Commencer par les corrections backend** (Priorité 1)
   - Optimiser `/api/prestataire/services`
   - Ajouter index SQL
   
2. **Puis corrections mobile critiques** (Priorité 1)
   - Corriger MediaUploadManager
   - Améliorer timeout MesProduitsScreen

3. **Ensuite corrections warnings** (Priorité 2)
   - Coach IA
   - Scroll automatique

4. **Enfin optimisations** (Priorité 3)
   - Warnings et logs
   - Améliorations UX

---

## ⚠️ NOTES IMPORTANTES

- **Tester chaque correction individuellement** avant de passer à la suivante
- **Valider avec les utilisateurs** pour les changements UX
- **Monitorer les métriques** après chaque déploiement
- **Documenter les changements** dans les commits

---

## 📞 SUPPORT

En cas de problème lors de l'implémentation :
1. Consulter les documents d'analyse détaillés
2. Vérifier les logs pour identifier la cause exacte
3. Tester sur différents environnements (dev, staging, prod)

