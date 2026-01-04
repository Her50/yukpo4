# PROMPT REPRISE : Migration Table Produits - Phase 4

## 📋 CONTEXTE DU PROJET

**Projet** : Yukpomnang - Migration des produits depuis JSONB vers table `service_products`  
**Repository** : `C:\Users\23767\yukpomnang2`  
**Backend** : Rust (Axum, SQLx, PostgreSQL avec pgvector)  
**Frontend** : React + TypeScript  
**Mobile** : React Native (Expo)  
**Base de données** : PostgreSQL sur Render (URL fournie)

## ✅ CE QUI A ÉTÉ FAIT

### PHASE 1 : Création table et double écriture ✅ COMPLÉTÉE

- ✅ Table `service_products` créée dans `0000_create_all_tables.sql`
- ✅ Service `ProductsService` créé (`backend/src/services/products_service.rs`)
- ✅ Modification `creer_service.rs` pour écrire dans `service_products`
- ✅ Modification `product_addition_controller.rs` pour écrire dans `service_products`
- ✅ Modification `save_autocomplete_combination` pour utiliser `product_id` depuis `service_products`
- ✅ `ProductsService` ajouté à `AppState` et `mod.rs`
- ✅ Tests SQL créés et exécutés
- ✅ Migrations appliquées

### PHASE 2 : Migration données existantes ✅ COMPLÉTÉE

- ✅ Migration de 37 produits existants depuis JSONB vers `service_products`
- ✅ Correction de 24 `product_id` invalides dans `autocomplete_characteristics`
- ✅ Correction des références `media.product_id` vers `service_products.id`
- ✅ Tests post-migration exécutés et validés

### PHASE 3 : Modification services backend ✅ COMPLÉTÉE

- ✅ **native_search_service.rs** : Recherche de produits via `service_products`
- ✅ **rechercher_besoin.rs** : Score produits via `service_products`
- ✅ **scheduling_search_service.rs** : Requêtes avec `service_products`
- ✅ **image_search_service.rs** : Recherche d'images via `service_products`
- ✅ **video_generation_service.rs** : Utilise `products_service.get_product()`
- ✅ **product_video_controller.rs** : Récupère nom depuis `service_products`
- ✅ **autocomplete_client_service.rs** : JOIN sur `service_products`
- ✅ **delivery_service.rs** : Aucune modification nécessaire (n'utilise pas JSONB)

**Endpoints API créés** :
- ✅ `GET /api/services/{service_id}/products`
- ✅ `GET /api/services/{service_id}/products/{product_index}`
- ✅ `PATCH /api/services/{service_id}/products/{product_index}`
- ✅ `DELETE /api/services/{service_id}/products/{product_index}`
- ✅ `POST /api/services/{service_id}/products/{product_index}/duplicate` (nouveau)
- ✅ `GET /api/products?user_id={user_id}`

### PHASE 4 : Migration Frontend/Mobile 🟡 EN COURS (4/14 complétés)

**Services créés** :
- ✅ `frontend/src/services/productsService.ts`
- ✅ `mobile/src/services/productsService.ts`

**Composants modifiés** :
- ✅ **MesServicesScreen** (Mobile) : Utilise `productsService.getProductsByService()`
- ✅ **MesProduitsScreen** (Mobile) : Utilise `productsService.getProductsByUser()`

**Fonctionnalités ajoutées** :
- ✅ **Duplication de produit** : Backend + Frontend/Mobile

**Composants RESTANTS à modifier** :
- ❌ **ProductCard** (Frontend) - `frontend/src/components/products/ProductCard.tsx`
- ❌ **ProductCard** (Mobile) - `mobile/src/components/ProductCard.tsx`
- ❌ **FormulaireYukpoIntelligentScreen** (Mobile) - `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`
- ❌ **FormulaireYukpoIntelligent** (Frontend) - `frontend/src/pages/FormulaireYukpoIntelligent.tsx`
- ❌ **ProductVideoCreationModal** (Mobile) - `mobile/src/components/ProductVideoCreationModal.tsx`
- ❌ **ProductDeliveryConfigModal** (Mobile) - `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx`
- ❌ **ProductDeliveryConfigModal** (Frontend) - `frontend/src/components/delivery/ProductDeliveryConfigModal.tsx`
- ❌ **ImmersiveVideoWizard** (Frontend) - `frontend/src/pages/video/ImmersiveVideoWizard.tsx`
- ❌ **ResultatBesoinScreen** (Mobile) - `mobile/src/screens/ResultatBesoinScreen.tsx`
- ❌ **ResultatBesoin** (Frontend) - `frontend/src/pages/ResultatBesoin.tsx`
- ❌ **MesProduits** (Frontend) - `frontend/src/pages/dashboard/MesProduits.tsx`

## 🎯 À FAIRE MAINTENANT : Phase 4 (Suite)

### Objectif
Modifier les composants frontend/mobile restants pour utiliser les nouveaux endpoints API au lieu d'extraire depuis `service.data.produits` JSONB.

### Instructions pour chaque composant

#### 1. ProductCard (Frontend)
**Fichier** : `frontend/src/components/products/ProductCard.tsx`

**Modifications** :
- Le produit peut maintenant venir directement de l'API (pas besoin d'extraire depuis `service.data.produits`)
- Ligne ~74-77 : Simplifier l'extraction du `productIndex` (peut venir directement du produit si c'est un objet `Product` de l'API)
- Si le produit vient de l'API, utiliser directement `product.product_data` au lieu de `product`
- Si le produit vient encore de JSONB (compatibilité), garder la logique existante

**Exemple** :
```typescript
// Si product vient de l'API (type Product)
const productData = product.product_data || product;
const productIndex = product.product_index ?? product.index ?? /* extraction depuis service.data.produits */;
```

#### 2. ProductCard (Mobile)
**Fichier** : `mobile/src/components/ProductCard.tsx`

**Même modification que Frontend**

#### 3. FormulaireYukpoIntelligentScreen (Mobile)
**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

**Modifications** :
- Ligne ~1214-1250 : Lors du chargement d'un service existant, ajouter appel à `productsService.getProductsByService(serviceId)`
- Stocker les produits dans l'état du composant
- Utiliser ces produits au lieu d'extraire depuis `service.data.produits`

**Exemple** :
```typescript
// Après chargement du service
if (serviceId) {
  try {
    const products = await productsService.getProductsByService(serviceId);
    setProducts(products.map(p => p.product_data));
  } catch (error) {
    console.warn('Erreur récupération produits, fallback JSONB:', error);
    // Fallback vers service.data.produits
  }
}
```

#### 4. FormulaireYukpoIntelligent (Frontend)
**Fichier** : `frontend/src/pages/FormulaireYukpoIntelligent.tsx`

**Même modification que Mobile**

#### 5. ProductVideoCreationModal (Mobile)
**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**Modifications** :
- Récupérer le produit depuis l'API au lieu de `service.data.produits[productIndex]`
- Utiliser `productsService.getProduct(serviceId, productIndex)`

**Exemple** :
```typescript
const loadProduct = async () => {
  if (serviceId !== undefined && productIndex !== undefined) {
    try {
      const product = await productsService.getProduct(serviceId, productIndex);
      setProduct(product.product_data);
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      // Fallback vers service.data.produits[productIndex]
    }
  }
};
```

#### 6. ProductDeliveryConfigModal (Mobile + Frontend)
**Fichiers** :
- `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx`
- `frontend/src/components/delivery/ProductDeliveryConfigModal.tsx`

**Modifications** :
- Récupérer le produit depuis l'API au lieu de `service.data.produits[productIndex]`
- Utiliser `productsService.getProduct(serviceId, productIndex)`

#### 7. ImmersiveVideoWizard (Frontend)
**Fichier** : `frontend/src/pages/video/ImmersiveVideoWizard.tsx`

**Modifications** :
- Ligne ~954 : Remplacer extraction depuis `service.data.produits` par appel API
- Utiliser `productsService.getProductsByService(serviceId)`

#### 8. ResultatBesoinScreen (Mobile)
**Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx`

**Vérifications** :
- Les produits viennent déjà de la table via l'API de recherche (backend modifié en Phase 3)
- Vérifier que les produits sont bien affichés
- S'assurer que le format des produits depuis l'API est compatible avec l'affichage

#### 9. ResultatBesoin (Frontend)
**Fichier** : `frontend/src/pages/ResultatBesoin.tsx`

**Même vérification que Mobile**

#### 10. MesProduits (Frontend)
**Fichier** : `frontend/src/pages/dashboard/MesProduits.tsx`

**Modifications** :
- Utiliser `productsService.getProductsByUser(userId)` au lieu d'extraire depuis tous les services
- Même logique que `MesProduitsScreen` (Mobile) déjà modifié

### Principes à respecter

1. **Fallback pour compatibilité** : Toujours garder un fallback vers `service.data.produits` si l'API échoue
2. **Types** : Utiliser l'interface `Product` de `productsService.ts` quand le produit vient de l'API
3. **Product data** : Si le produit vient de l'API, utiliser `product.product_data` pour les données du produit
4. **Product index** : Utiliser `product.product_index` si disponible, sinon extraire depuis JSONB
5. **Gestion d'erreurs** : Logger les erreurs mais ne pas faire échouer l'application (fallback)

### Tests à effectuer après modifications

1. ✅ Tester l'affichage des produits dans MesServices → Vérifier que les produits s'affichent correctement
2. ✅ Tester la recherche → Vérifier que les produits sont affichés dans les résultats
3. ✅ Tester la création de vidéo produit → Vérifier que le produit est récupéré correctement
4. ✅ Tester la configuration de livraison → Vérifier que le produit est accessible
5. ✅ Tester l'édition de service avec produits → Vérifier que les produits sont chargés correctement
6. ✅ Tester la duplication de produit → Vérifier que la duplication fonctionne

## 📊 PHASES SUIVANTES

### PHASE 5 : Nettoyage et Optimisation Finale (3-5 jours)

**Objectif** : Supprimer les écritures JSONB, nettoyer le code, optimiser

#### 5.1 Supprimer les écritures JSONB (optionnel mais recommandé)

**Fichiers à modifier** :
- `backend/src/controllers/products_controller.rs` :
  - `update_product()` : Supprimer l'écriture JSONB (ligne ~136-163)
  - `delete_product()` : Supprimer la suppression JSONB (ligne ~214-244)

**Décision** : Garder JSONB en lecture seule pour compatibilité ou supprimer complètement ?

#### 5.2 Créer une fonction helper pour compatibilité

**Fichier** : `backend/src/services/products_service.rs`

**Déjà créé** : `get_products_as_jsonb_format()` existe déjà (ligne 324-344)

#### 5.3 Optimiser les requêtes de recherche

**Créer une vue matérialisée** pour les recherches fréquentes :

```sql
CREATE MATERIALIZED VIEW products_search_cache AS
SELECT 
    p.id,
    p.service_id,
    p.product_index,
    p.product_name,
    p.product_type,
    p.product_price,
    p.product_data,
    s.user_id,
    s.category,
    s.gps,
    s.is_active as service_active
FROM service_products p
INNER JOIN services s ON s.id = p.service_id
WHERE p.is_active = true AND s.is_active = true;

CREATE INDEX idx_products_search_cache_name ON products_search_cache USING GIN(to_tsvector('french', product_name));
CREATE INDEX idx_products_search_cache_service ON products_search_cache(service_id);
CREATE INDEX idx_products_search_cache_user ON products_search_cache(user_id);

-- Rafraîchir périodiquement (cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY products_search_cache;
```

#### 5.4 Nettoyer le code obsolète

- Supprimer les fonctions helper qui extraient depuis JSONB (si plus utilisées)
- Nettoyer les commentaires `TODO Phase 5`
- Documenter les changements dans README

#### 5.5 Tests finaux

- Tests d'intégration complets
- Tests de performance (comparer avant/après)
- Tests de charge

## 📝 NOTES IMPORTANTES

1. **Structure de la table `service_products`** :
   - `id` : SERIAL (primary key)
   - `service_id` : INTEGER (foreign key vers services)
   - `product_index` : INTEGER (index du produit dans le service)
   - `product_data` : JSONB (données du produit)
   - `product_name` : TEXT (généré depuis product_data)
   - `product_type` : TEXT (généré depuis product_data)
   - `product_price` : DECIMAL (généré depuis product_data)
   - `is_active` : BOOLEAN
   - `created_at`, `updated_at`, `auto_deactivate_at` : TIMESTAMP

2. **Interface Product (TypeScript)** :
```typescript
interface Product {
  id: number;
  service_id: number;
  product_index: number;
  product_data: any;
  product_name: string;
  product_type: string;
  product_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auto_deactivate_at: string | null;
}
```

3. **Services API disponibles** :
   - `productsService.getProductsByService(serviceId)`
   - `productsService.getProduct(serviceId, productIndex)`
   - `productsService.updateProduct(serviceId, productIndex, productData)`
   - `productsService.deleteProduct(serviceId, productIndex)`
   - `productsService.duplicateProduct(serviceId, productIndex)` (nouveau)
   - `productsService.getProductsByUser(userId)`

4. **Format des produits** :
   - Depuis l'API : Objet `Product` avec `product_data` contenant les données JSON
   - Depuis JSONB (fallback) : Données JSON directement dans `service.data.produits.valeur[index]`

5. **Migration complète** :
   - Phase 1 : ✅ Table créée, écriture double
   - Phase 2 : ✅ Migration données existantes
   - Phase 3 : ✅ Backend utilise `service_products`
   - Phase 4 : 🟡 Frontend/Mobile en cours (4/14 composants)
   - Phase 5 : ⏳ Nettoyage et optimisation

## 🚀 COMMANDES UTILES

```bash
# Backend
cd backend
cargo check
cargo build
cargo test
cargo fmt

# Frontend
cd frontend
npm run dev
npm run build

# Mobile
cd mobile
npm run dev
npm run build

# Base de données (Render)
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com -U yukpo_db_user -d yukpo_db
```

## ✅ CHECKLIST PHASE 4

- [ ] ProductCard (Frontend)
- [ ] ProductCard (Mobile)
- [ ] FormulaireYukpoIntelligentScreen (Mobile)
- [ ] FormulaireYukpoIntelligent (Frontend)
- [ ] ProductVideoCreationModal (Mobile)
- [ ] ProductDeliveryConfigModal (Mobile)
- [ ] ProductDeliveryConfigModal (Frontend)
- [ ] ImmersiveVideoWizard (Frontend)
- [ ] ResultatBesoinScreen (Mobile) - Vérification seulement
- [ ] ResultatBesoin (Frontend) - Vérification seulement
- [ ] MesProduits (Frontend)
- [ ] Tests complets de tous les composants modifiés

## 🎯 OBJECTIF FINAL

À la fin de la Phase 4, tous les composants frontend/mobile doivent utiliser les endpoints API pour récupérer les produits depuis la table `service_products`, avec fallback vers JSONB pour compatibilité.

