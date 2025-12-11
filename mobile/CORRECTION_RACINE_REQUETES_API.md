# Correction à la racine des erreurs de requêtes API

## Date: 2025-12-11

## Problème identifié à la racine

Les logs backend montrent de nombreuses requêtes avec `responseBytes=114` (erreurs 404/401) qui sont faites en boucle. Au lieu de simplement gérer les erreurs avec un backoff, nous avons identifié et corrigé les causes racines :

### Causes racines identifiées

1. **Endpoint manquant** : `/api/products/my-products` n'existait pas → 404
2. **Token JWT invalide/expiré** : Les requêtes vers `/api/chat/conversations` et `/api/notifications/user/{id}/unread-count` échouaient avec 401
3. **Pas de gestion spécifique des erreurs 401** : Les requêtes continuaient en boucle même avec un token invalide

## Corrections appliquées

### 1. Création de l'endpoint manquant `/api/products/my-products`

**Fichier:** `backend/src/controllers/service_controller.rs`

**Fonction créée:**
```rust
/// ✅ NOUVEAU 2025-12-11: Récupérer tous les produits de l'utilisateur
/// Route: GET /api/products/my-products
pub async fn get_my_products(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>>
```

**Fonctionnalités:**
- Récupère tous les produits actifs de tous les services de l'utilisateur
- Retourne les produits avec leurs métadonnées (service_id, service_title, product_index)
- Filtre uniquement les produits actifs (`is_active = true`)

**Route ajoutée:** `backend/src/routers/router_yukpo.rs`
```rust
.route(
    "/api/products/my-products",
    get(get_my_products).layer(axum::middleware::from_fn(jwt_auth)),
)
```

### 2. Gestion spécifique des erreurs 401 (Token invalide)

**Fichier:** `mobile/src/services/api.ts`

**Correction:**
```typescript
if (!response.ok) {
  // ✅ NOUVEAU 2025-12-11: Gérer les erreurs d'authentification (401) pour éviter les requêtes en boucle
  if (response.status === 401) {
    console.warn(`[Mobile API] ⚠️ Token invalide ou expiré pour ${endpoint}, suppression du token`);
    // Supprimer le token invalide pour éviter les requêtes en boucle
    try {
      await removeAuthToken();
    } catch (error) {
      console.error('[Mobile API] Erreur suppression token:', error);
    }
  }

  return {
    success: false,
    error: data?.message || data?.error || `Erreur ${response.status}`,
    data: data,
    status: response.status, // ✅ NOUVEAU: Inclure le status pour gestion spécifique
  };
}
```

### 3. Arrêt immédiat du rafraîchissement automatique en cas d'erreur 401

**Fichier:** `mobile/src/screens/HomeScreen.tsx`

**Correction:**
```typescript
catch (error: any) {
    consecutiveErrors++;
    
    // ✅ NOUVEAU 2025-12-11: Arrêter immédiatement si erreur 401 (token invalide)
    if (error?.status === 401 || error?.response?.status === 401 || (error?.message && error.message.includes('401'))) {
        console.warn('[HomeScreen] ⚠️ Token invalide (401), arrêt du rafraîchissement automatique');
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isRefreshing = false;
        return; // Arrêter immédiatement, ne pas continuer avec backoff
    }
    
    // ... reste du code de backoff exponentiel
}
```

## Résultat attendu

### Avant les corrections
- ❌ Requêtes en boucle vers `/api/products/my-products` → 404
- ❌ Requêtes en boucle avec token invalide → 401
- ❌ Backoff exponentiel mais continue quand même
- ❌ Surcharge du backend avec requêtes inutiles

### Après les corrections
- ✅ `/api/products/my-products` existe et retourne les produits
- ✅ Token invalide détecté et supprimé automatiquement
- ✅ Arrêt immédiat du rafraîchissement automatique en cas d'erreur 401
- ✅ Plus de requêtes en boucle avec token invalide
- ✅ Réduction significative des requêtes avec `responseBytes=114`

## Fichiers modifiés

### Backend
- `backend/src/controllers/service_controller.rs` : Ajout de `get_my_products()`
- `backend/src/routers/router_yukpo.rs` : Ajout de la route `/api/products/my-products`

### Mobile
- `mobile/src/services/api.ts` : Gestion spécifique des erreurs 401
- `mobile/src/screens/HomeScreen.tsx` : Arrêt immédiat en cas d'erreur 401

## Tests recommandés

1. **Test endpoint `/api/products/my-products`** :
   - Vérifier que l'endpoint retourne les produits de l'utilisateur
   - Vérifier que seuls les produits actifs sont retournés
   - Vérifier que l'authentification JWT est requise

2. **Test gestion erreur 401** :
   - Simuler un token invalide
   - Vérifier que le token est supprimé automatiquement
   - Vérifier que le rafraîchissement automatique s'arrête

3. **Test logs backend** :
   - Surveiller la réduction des requêtes avec `responseBytes=114`
   - Vérifier qu'il n'y a plus de requêtes en boucle vers des endpoints inexistants

## Notes importantes

- L'endpoint `/api/products/my-products` nécessite une authentification JWT
- En cas d'erreur 401, le token est supprimé et l'utilisateur devra se reconnecter
- Le rafraîchissement automatique des notifications s'arrête immédiatement en cas d'erreur 401 (pas de backoff)
- Les autres erreurs (réseau, timeout) continuent d'utiliser le backoff exponentiel

