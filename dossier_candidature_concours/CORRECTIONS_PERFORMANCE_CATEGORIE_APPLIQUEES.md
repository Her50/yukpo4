# Corrections Appliquées - Performance et Catégorie

**Date**: 2025-11-28  
**Fichiers modifiés**: 4 fichiers + 1 migration

## ✅ Correction 1: Timeout Redis réduit (100ms au lieu de 500ms)

### Problème
- Redis indisponible causait 2 tentatives × 500ms = **1000ms** de perte
- Impact direct sur la lenteur de `/api/prestataire/services` (2100ms)

### Solution appliquée
**Fichier**: `backend/src/utils/redis_helper.rs`
- Timeout réduit à **100ms maximum** (au lieu de 500ms)
- Si `retry_delay_ms > 100`, utiliser 100ms
- Réduction de **80% du temps perdu** (1000ms → 200ms)

### Code modifié
```rust
// Avant: sleep(Duration::from_millis(retry_delay_ms)).await;
// Après:
let fast_retry_delay = if retry_delay_ms > 100 { 100 } else { retry_delay_ms };
sleep(Duration::from_millis(fast_retry_delay)).await;
```

### Impact attendu
- **Gain**: ~800ms sur les requêtes avec Redis indisponible
- **Nouveau temps**: ~1300ms au lieu de 2100ms (amélioration de 38%)

---

## ✅ Correction 2: Index pour optimiser COUNT(*)

### Problème
- `SELECT COUNT(*) FROM services WHERE user_id = $1` prenait **72ms**
- Absence d'index optimisé pour cette requête

### Solution appliquée
**Fichier**: `backend/migrations/20251128_006_optimize_services_count_performance.sql`
- Création de 2 index:
  1. `idx_services_user_id_count` - Index simple sur `user_id`
  2. `idx_services_user_id_created_at_desc_count` - Index composite pour la requête principale

### Migration SQL
```sql
CREATE INDEX IF NOT EXISTS idx_services_user_id_count 
ON services(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc_count
ON services(user_id, created_at DESC)
WHERE user_id IS NOT NULL;
```

### Impact attendu
- **Gain**: ~60ms (72ms → ~12ms)
- **Amélioration**: 83% plus rapide

---

## ✅ Correction 3: Catégorie service dans produits

### Problème
- La catégorie du service n'était pas transmise aux produits
- Les cartes produits affichaient "Non catégorisé" même si le service avait une catégorie

### Solution appliquée

#### Backend
**Fichier**: `backend/src/controllers/service_controller.rs`
- Ajout de `service_category` et `serviceCategorie` dans chaque produit de `produits_light`
- Les produits héritent maintenant de la catégorie du service

**Code modifié** (ligne ~1207):
```sql
jsonb_build_object(
    'nom', ...,
    'prix', ...,
    'devise', ...,
    'is_active', ...,
    -- ✅ NOUVEAU
    'service_category', s.category,
    'serviceCategorie', s.category
)
```

#### Frontend
**Fichier**: `mobile/src/screens/MesProduitsScreen.tsx`
- Ajout de `service_category` dans `normalizeCategoryKey` comme fallback
- Support des deux formats: `service_category` (nouveau) et `serviceCategorie` (ancien)

**Code modifié** (ligne ~52):
```typescript
const normalizeCategoryKey = (product: Record<string, any>): string | null => {
    const raw = extractValue(product?.categorie_produit)
        ?? extractValue(product?.categorie)
        ?? extractValue(product?.category)
        ?? extractValue(product?.type)
        ?? extractValue(product?.service_category)  // ✅ NOUVEAU
        ?? extractValue(product?.serviceCategorie);
    return raw ? raw.toLowerCase() : null;
};
```

### Impact attendu
- ✅ Les produits affichent maintenant la catégorie du service si le produit n'en a pas
- ✅ Plus de "Non catégorisé" pour les produits sans catégorie propre

---

## 📊 Résumé des gains de performance

| Problème | Avant | Après | Gain |
|----------|-------|-------|------|
| Timeout Redis | 1000ms | 200ms | **-800ms** |
| COUNT(*) | 72ms | ~12ms | **-60ms** |
| **TOTAL** | **2100ms** | **~1300ms** | **-860ms (41%)** |

---

## 🚀 Prochaines étapes recommandées

### Priorité 1 (Critique)
1. ✅ **FAIT**: Timeout Redis réduit
2. ✅ **FAIT**: Index COUNT(*) créé
3. ✅ **FAIT**: Catégorie service dans produits

### Priorité 2 (Important)
4. ⚠️ **À FAIRE**: Vérifier configuration Redis (variable `REDIS_URL`)
5. ⚠️ **À FAIRE**: Appliquer la migration SQL (`sqlx migrate run`)
6. ⚠️ **À FAIRE**: Tester l'affichage des catégories dans MesProduitsScreen

### Priorité 3 (Amélioration)
7. 📝 Optimiser la requête principale (simplifier extraction JSONB)
8. 📝 Implémenter cache mémoire si Redis indisponible
9. 📝 Corriger WebSocket timeout (108 secondes)

---

## 📝 Notes techniques

### Migration SQL
Pour appliquer la migration:
```bash
cd backend
sqlx migrate run
```

### Vérification Redis
Vérifier que `REDIS_URL` est correctement configuré dans les variables d'environnement Render.

### Test des catégories
1. Ouvrir MesProduitsScreen
2. Vérifier que les produits affichent la catégorie du service si le produit n'a pas de catégorie
3. Vérifier que les produits avec catégorie propre affichent toujours leur catégorie

---

## ✅ Validation

- [x] Code compilé sans erreurs
- [x] Pas d'erreurs de linter
- [x] Migration SQL créée
- [ ] Migration appliquée (à faire manuellement)
- [ ] Tests fonctionnels (à faire)

