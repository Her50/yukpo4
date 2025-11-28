# Analyse des Problèmes de Performance et Catégorie

**Date**: 2025-11-28  
**Source**: Logs backend (logbackend2.md)

## 🔴 Problème 1: Lenteur d'ouverture des services (2100ms)

### Symptômes
- Requête `GET /api/prestataire/services` prend **2100ms** (2.1 secondes)
- Seuil d'alerte dépassé (1000ms)

### Analyse des logs
```
[SlowRequest] GET /api/prestataire/services -> 200 (2100 ms)
SELECT COUNT(*) FROM services WHERE user_id = $1 -> 72.81897ms
SELECT ... FROM services ... -> 11.500955ms
```

### Causes identifiées

#### 1. **Redis indisponible** (1000ms+ de perte)
- **Problème**: Redis échoue avec `failed to lookup address information: Name or service not known`
- **Impact**: 
  - 2 tentatives de connexion × 500ms = **1000ms** perdues
  - Cache non fonctionnel → requêtes SQL à chaque fois
- **Logs**:
  ```
  ⚠️ [Redis] Impossible d'obtenir une connexion (tentative 1/3): ...
  ⚠️ [Redis] Impossible d'obtenir une connexion (tentative 2/3): ...
  [CacheService] Redis indisponible pour services:prestataire:11:page:0:limit:20
  ```

#### 2. **COUNT(*) lent** (72ms)
- **Problème**: `SELECT COUNT(*) FROM services WHERE user_id = $1` prend 72ms
- **Cause probable**: Absence d'index sur `user_id` ou index non utilisé
- **Impact**: 72ms pour un simple COUNT est anormalement lent

#### 3. **Requête principale** (11.5ms)
- Acceptable mais pourrait être optimisée
- Extraction JSONB complexe avec sous-requêtes

### Solutions proposées

#### Solution 1: Corriger Redis (PRIORITÉ HAUTE)
- **Action**: Vérifier la configuration Redis (variable d'environnement `REDIS_URL`)
- **Fallback**: Désactiver les tentatives Redis si non disponible (éviter les 1000ms de timeout)
- **Code**: Modifier `redis_helper.rs` pour timeout plus court (100ms au lieu de 500ms)

#### Solution 2: Optimiser COUNT(*)
- **Action**: Créer index sur `user_id` si absent
- **Migration SQL**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_services_user_id_count 
  ON services(user_id) WHERE user_id IS NOT NULL;
  ```
- **Alternative**: Utiliser un compteur en cache ou table de métadonnées

#### Solution 3: Optimiser la requête principale
- **Action**: Simplifier l'extraction JSONB
- **Réduire**: Sous-requêtes corrélées dans `produits_light`
- **Cache**: Mettre en cache même sans Redis (cache mémoire)

---

## 🔴 Problème 2: Catégorie manquante dans les cartes produits

### Symptômes
- La catégorie du produit n'est pas affichée dans les cartes de management
- `category_label` est `null` ou `'Non catégorisé'`

### Analyse du code

#### Backend (`service_controller.rs`)
- ✅ La catégorie du **service** est récupérée: `s.category` (ligne 1185)
- ✅ Elle est incluse dans la réponse: `"category": category` (ligne 1339)
- ❌ Mais elle n'est **pas transmise aux produits** dans `produits_light`

#### Frontend (`MesProduitsScreen.tsx`)
- ✅ La catégorie du **produit** est extraite: `normalizeCategoryKey(product)` (ligne 495)
- ❌ Mais il n'y a **pas de fallback** vers la catégorie du service
- ❌ `serviceCategory` n'est pas passé aux produits normalisés

### Code actuel (ligne 495-496)
```typescript
const categoryKey = normalizeCategoryKey(normalizedProduct);
const categoryLabel = getProductTypeLabel(categoryKey);
```

### Problème
La fonction `normalizeCategoryKey` ne cherche que dans le produit:
```typescript
const normalizeCategoryKey = (product: Record<string, any>): string | null => {
    return extractValue(product?.categorie_produit)
        ?? extractValue(product?.categorie)
        ?? extractValue(product?.category)
        // ❌ PAS de fallback vers service.category
}
```

### Solution
1. **Backend**: Inclure `service_category` dans chaque produit de `produits_light`
2. **Frontend**: Utiliser `service.category` comme fallback dans `normalizeCategoryKey`

---

## ⚠️ Problème 3: WebSocket très lent (108 secondes)

### Symptômes
```
[GET] /ws/notifications/11 -> responseTimeMS=108505 (108 secondes!)
```

### Analyse
- WebSocket reste ouvert trop longtemps
- Fermeture après 108 secondes (timeout probable)
- Impact sur les notifications en temps réel

### Solution
- Vérifier la configuration WebSocket
- Implémenter un heartbeat/ping-pong
- Réduire le timeout si nécessaire

---

## ⚠️ Problème 4: Logs mobile excessifs

### Symptômes
- Beaucoup de logs mobile envoyés en batch
- Potentiel impact sur les performances

### Solution
- Réduire la fréquence des logs
- Filtrer les logs non critiques
- Utiliser un système de log level

---

## 📋 Plan d'action

### Priorité 1 (Critique)
1. ✅ Corriger Redis (timeout + fallback)
2. ✅ Optimiser COUNT(*) avec index
3. ✅ Ajouter catégorie service aux produits

### Priorité 2 (Important)
4. ⚠️ Optimiser requête principale (simplifier JSONB)
5. ⚠️ Corriger WebSocket timeout

### Priorité 3 (Amélioration)
6. 📝 Réduire logs mobile
7. 📝 Cache mémoire si Redis indisponible

