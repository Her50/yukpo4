# 🔴 BUG CRITIQUE : Table autocomplete_combinations vide

**Date**: 2025-11-06  
**Gravité**: CRITIQUE - Bloque la fonctionnalité autocomplete  
**Impact**: Utilisateurs ne peuvent pas bénéficier des suggestions IA

---

## 🔍 **ANALYSE DU PROBLÈME**

### **Symptôme**
Les logs Render montrent `0 produits populaires trouvés` malgré :
1. ✅ L'IA génère des dimensions et modalités (variations de prix)
2. ✅ Le code Rust appelle `save_ia_combinations_to_db()` et `save_autocomplete_combination()`
3. ✅ La table `autocomplete_combinations` existe
4. ❌ **MAIS** : La table reste vide (rows_returned: 0)

---

## 🐛 **BUGS IDENTIFIÉS**

### **Bug #1 : Contrainte ON CONFLICT incorrecte** ❌

**Fichier**: `backend/src/services/creer_service.rs` (ligne 1724)

```sql
ON CONFLICT (product_vector)  -- ❌ ERREUR: Cette contrainte n'existe pas !
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1
```

**Contrainte réelle** (dans `0000_create_all_tables.sql` ligne 246) :
```sql
CONSTRAINT unique_full_vector UNIQUE (full_vector)  -- ✅ La vraie contrainte
```

**Résultat** : L'INSERT échoue silencieusement car PostgreSQL ne trouve pas la contrainte `product_vector`.

---

### **Bug #2 : ON CONFLICT sur product_vector ligne 1785** ❌

**Fichier**: `backend/src/services/creer_service.rs` (ligne 1785)

```sql
ON CONFLICT (product_vector)  -- ❌ Même erreur
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1
```

**Même problème** : La contrainte n'existe pas → INSERT échoue.

---

### **Bug #3 : service_id = NULL dans les combinaisons IA** ⚠️

**Fichier**: `backend/src/services/creer_service.rs` (ligne 1544)

```sql
VALUES (NULL, $1, $2, '{}', '{}', $1, $3, $4, 0.7, 1)
       ^-- service_id = NULL pour les suggestions IA
```

**Impact** : Les combinaisons IA ne sont pas liées à un service spécifique (peut-être voulu, mais à vérifier).

---

## ✅ **CORRECTIONS NÉCESSAIRES**

### **Correction #1 : Remplacer ON CONFLICT (product_vector)**

```rust
// AVANT (ligne 1724) ❌
ON CONFLICT (product_vector)
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1

// APRÈS ✅
ON CONFLICT (full_vector)
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1
```

### **Correction #2 : Même chose ligne 1785**

```rust
// AVANT (ligne 1785) ❌
ON CONFLICT (product_vector)
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1

// APRÈS ✅
ON CONFLICT (full_vector)
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1
```

### **Correction #3 : Vérifier les logs pour erreurs SQL silencieuses**

Actuellement, les erreurs sont loggées avec `log::error!` mais ne bloquent pas :

```rust
// Ligne 1737-1740
if let Err(e) = result_comb {
    log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_combinations variation '{}': {}", variant_value, e);
} else {
    log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_combinations variation: {}", variant_value);
}
```

**Action** : Vérifier les logs Render pour `[save_autocomplete_combination] Erreur sauvegarde`.

---

## 🔍 **VÉRIFICATION DES LOGS RENDER**

D'après les logs fournis, on voit :

```
[PopularProductsService] ✅ 0 produits populaires trouvés
SELECT ... FROM autocomplete_combinations ac WHERE ac.usage_count >= 2
rows_returned: 0
```

**Conclusion** : Aucun produit n'a été inséré dans `autocomplete_combinations`.

---

## 📊 **IMPACT**

| Fonctionnalité | Impact | Statut |
|----------------|--------|--------|
| Autocomplete produits | ❌ Ne fonctionne pas | Table vide |
| Suggestions IA | ❌ Non sauvegardées | Bug ON CONFLICT |
| Recherche populaire | ❌ Retourne 0 résultats | Pas de données |
| Produits prestataires | ⚠️ Sauvegardés dans `autocomplete_characteristics` | OK (partiellement) |

---

## 🚀 **PLAN DE CORRECTION**

### Étape 1 : Corriger les ON CONFLICT
- [ ] Remplacer `ON CONFLICT (product_vector)` → `ON CONFLICT (full_vector)` (2 endroits)

### Étape 2 : Vérifier les logs
- [ ] Chercher les erreurs SQL dans les logs Render
- [ ] Confirmer que les INSERT fonctionnent après correction

### Étape 3 : Peupler la table
- [ ] Créer un script de migration pour réinsérer les produits existants
- [ ] Ou attendre que les nouveaux services peuplent la table

### Étape 4 : Tester
- [ ] Créer un service avec produits + variations
- [ ] Vérifier que `autocomplete_combinations` contient des données
- [ ] Tester `/api/products/popular?search=...`

---

## 📝 **CODE CORRIGÉ**

### Fichier : `backend/src/services/creer_service.rs`

**Ligne 1719-1726** (corrections ON CONFLICT #1)
```rust
// ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
let result_comb = sqlx::query(
    r#"INSERT INTO autocomplete_combinations 
       (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
        has_variant, variant_dimension, variant_value, prix, devise, stock, usage_count)
       VALUES ($1, $2, $3, '{}', '{}', $2, true, $4, $5, $6, $7, $8, 1)
       ON CONFLICT (full_vector)  -- ✅ CORRECTION: full_vector au lieu de product_vector
       DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
)
```

**Ligne 1780-1787** (corrections ON CONFLICT #2)
```rust
// ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
let result_comb = sqlx::query(
    r#"INSERT INTO autocomplete_combinations 
       (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
        has_variant, prix, usage_count)
       VALUES ($1, $2, $3, '{}', '{}', $2, false, $4, 1)
       ON CONFLICT (full_vector)  -- ✅ CORRECTION: full_vector au lieu de product_vector
       DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
)
```

---

## ✅ **VALIDATION**

Après correction, vérifier que :
1. Les INSERT ne génèrent plus d'erreurs SQL
2. La table `autocomplete_combinations` contient des données
3. `/api/products/popular?search=X` retourne des résultats
4. Les logs affichent `✅ Sauvegardé dans autocomplete_combinations`

**Requête SQL de vérification** :
```sql
SELECT COUNT(*) FROM autocomplete_combinations;
-- Devrait retourner > 0 après création de services
```

---

## 🎯 **CONCLUSION**

Le bug est **simple mais critique** :
- ✅ Le code est exécuté
- ✅ La logique est correcte
- ❌ **Mais** : La contrainte ON CONFLICT référence un champ qui n'existe pas
- ❌ **Résultat** : Les INSERT échouent silencieusement

**Solution** : Remplacer `product_vector` → `full_vector` dans les 2 clauses ON CONFLICT.

