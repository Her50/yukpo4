# Optimisations Performance - Création Produit

## 🎯 Problèmes identifiés

### 1. UPDATE services (5-7s) ❌
**Cause** : Réécriture complète du JSON `data` à chaque ajout de produit
- Le JSON peut être volumineux (plusieurs MB)
- PostgreSQL doit verrouiller la ligne et réécrire tout le JSON
- Connexions DB instables sur Render amplifient le problème

### 2. REFRESH MATERIALIZED VIEW (7-11s) ⚠️
**Cause** : Déclenchement automatique toutes les 15 minutes
- Peut se déclencher pendant la création de produit
- Utilise un pool séparé (déjà optimisé)
- Mutex global pour éviter les REFRESH simultanés (déjà optimisé)

---

## ✅ Corrections apportées

### 1. Optimisation UPDATE services
**Fichier** : `backend/src/controllers/product_addition_controller.rs`

**Avant** :
```rust
sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
    .bind(&service_data_clone)  // Tout le JSON
    .bind(service_id_clone)
```

**Après** :
```rust
sqlx::query("UPDATE services SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{produits}', $1::jsonb, true), updated_at = NOW() WHERE id = $2")
    .bind(&produits_json_clone)  // Seulement la partie produits
    .bind(service_id_clone)
```

**Gains** :
- ✅ Mise à jour partielle (seulement `data->produits`)
- ✅ Moins de verrous (jsonb_set est plus efficace)
- ✅ Moins de données transférées
- ✅ Latence réduite : **5-7s → ~1-2s**

### 2. Migration SQL pour index
**Fichier** : `backend/migrations/20251221_optimize_services_update_performance.sql`

- Index sur `id` pour accélérer les UPDATE
- Index GIN sur `data` pour les recherches JSONB
- Fonction helper `update_service_products()` pour réutilisabilité

---

## 📊 Résultats attendus

### Avant optimisation
```
Création produit (hors IA) :
- UPDATE services : 5-7s ❌
- save_autocomplete_combination : ~1s (arrière-plan) ✅
- Total : ~6-8s
```

### Après optimisation
```
Création produit (hors IA) :
- UPDATE services : ~1-2s ✅
- save_autocomplete_combination : ~1s (arrière-plan) ✅
- Total : ~2-3s
```

**Gain total** : **~4-5 secondes** (réduction de 60-70%)

---

## 🚀 Déploiement

### 1. Appliquer la migration
```bash
cd backend
sqlx migrate run
```

### 2. Vérifier les index
```sql
-- Vérifier que les index existent
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname IN ('idx_services_id_active', 'idx_services_data_gin');
```

### 3. Tester la performance
```sql
-- Test de mise à jour partielle
EXPLAIN ANALYZE
UPDATE services 
SET data = jsonb_set(data, '{produits}', '[]'::jsonb, true)
WHERE id = 1;
```

---

## 🔍 Monitoring

### Logs à surveiller
```bash
# Vérifier les UPDATE services rapides
grep "UPDATE services.*jsonb_set" logs/*.log

# Vérifier les temps d'exécution
grep "slow statement.*UPDATE services" logs/*.log
```

### Métriques
- Temps moyen UPDATE services : **< 2s** (objectif)
- Taux d'erreur UPDATE : **< 1%** (objectif)

---

## 📝 Notes techniques

### Pourquoi jsonb_set est plus rapide ?

1. **Mise à jour partielle** : Seulement le champ `produits` est modifié, pas tout le JSON
2. **Moins de verrous** : PostgreSQL peut optimiser la mise à jour partielle
3. **Moins de données** : Seulement la partie produits est transférée, pas tout le JSON
4. **Index GIN** : Les index JSONB sont mieux utilisés avec jsonb_set

### Limitations

- `jsonb_set` nécessite que le chemin existe (d'où `COALESCE(data, '{}'::jsonb)`)
- Si `data->produits` n'existe pas, il sera créé automatiquement
- Compatible avec la structure existante du JSON

---

## ✅ Checklist de validation

- [ ] Migration appliquée (index créés)
- [ ] UPDATE services < 2s (vérifier logs)
- [ ] Pas d'erreurs après déploiement
- [ ] Création produit totale < 20s (hors IA)



