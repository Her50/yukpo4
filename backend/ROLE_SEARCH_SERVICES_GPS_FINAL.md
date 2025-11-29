# 📍 Rôle de `search_services_gps_final()` - 29 Novembre 2025

## 🎯 Rôle Principal

`search_services_gps_final()` est une **fonction PostgreSQL optimisée pour la recherche avec filtrage GPS**.

### Fonctionnalités

1. **Recherche textuelle** dans les champs service :
   - `titre_service`
   - `description`
   - `category`

2. **Filtrage GPS** :
   - Calcule la distance entre le GPS utilisateur et le GPS du service
   - Filtre par rayon de recherche (ex: 50km)
   - Utilise `calculate_gps_distance_km()` pour le calcul de distance

3. **Tri et scoring** :
   - Score de pertinence basé sur correspondance textuelle
   - Tri par `relevance_score DESC, distance_km ASC`
   - Retourne les résultats les plus pertinents et les plus proches

4. **Retourne 7 colonnes** :
   - `service_id` : ID du service
   - `titre_service` : Titre du service
   - `category` : Catégorie
   - `gps_coords` : Coordonnées GPS du service
   - `distance_km` : Distance calculée en km
   - `relevance_score` : Score de pertinence
   - `gps_source` : Source du GPS (`gps_column`, `gps_fixe`, ou `no_gps`)

---

## 🔍 Utilisation dans le Code Rust

### Quand est-elle appelée ?

**Fichier** : `backend/src/services/native_search_service.rs`

**Ligne ~944** : Appelée quand :
- ✅ Un GPS est fourni (`gps_zone` n'est pas `None`)
- ✅ Recherche dans `fulltext_search_with_gps()` ou `trigram_search_with_gps()`

**Code** :
```rust
if let Some(gps_zone_val) = gps_zone {
    let radius = search_radius_km.unwrap_or(50);
    
    // Appel à search_services_gps_final()
    let sql = r#"
        SELECT 
            service_id, titre_service, category, gps_coords,
            distance_km, relevance_score, gps_source
        FROM search_services_gps_final($1, $2, $3, $4)
    "#;
    
    // $1 = search_query (ex: "avensis")
    // $2 = user_gps_zone (ex: "4.03,9.81")
    // $3 = search_radius_km (ex: 50)
    // $4 = max_results (ex: 100)
}
```

### Pourquoi est-elle utilisée ?

1. **Performance** : Calcul de distance optimisé côté PostgreSQL
2. **Filtrage GPS** : Filtre efficacement par rayon de recherche
3. **Tri géographique** : Retourne les résultats les plus proches en premier

---

## ⚠️ LIMITATION IMPORTANTE

### ❌ Problème : Ne Recherche PAS dans les Produits

**La fonction `search_services_gps_final()` ne recherche QUE dans les champs service** :
- `titre_service`
- `description`
- `category`

**Elle ne recherche PAS dans les produits** (`data->'produits'`).

### Conséquence

Si un utilisateur cherche "Toyota Avensis 2002" :
- ✅ Trouve si le service a "Toyota Avensis" dans son `titre_service` ou `description`
- ❌ **Ne trouve PAS** si seul le produit contient "Toyota Avensis 2002" mais le service ne contient pas ce terme

**Exemple** :
- Service : `titre_service = "Vente de voitures"`, `produits = [{"nom": "Toyota Avensis 2002"}]`
- Recherche : "avensis" avec GPS
- **Résultat** : ❌ **0 résultats** (car `search_services_gps_final()` ne cherche pas dans les produits)

---

## 🔄 Flux de Recherche Actuel

```
1. Utilisateur cherche "avensis" avec GPS
   ↓
2. Code Rust appelle search_services_gps_final('avensis', '4.03,9.81', 50, 100)
   ↓
3. Fonction recherche dans titre_service, description, category
   ↓
4. Filtre par distance GPS (rayon 50km)
   ↓
5. Retourne résultats triés par pertinence + distance
   ↓
6. Si 0 résultats → Fallback vers recherche sans GPS (qui utilise la logique corrigée)
```

---

## ✅ Solution : Fallback Vers Recherche Corrigée

**Bonne nouvelle** : Si `search_services_gps_final()` retourne 0 résultats, le code fait un **fallback** vers la recherche sans GPS qui :
- ✅ Extrait TOUS les produits AVANT de filtrer
- ✅ Recherche dans les produits avec `extract_all_product_text()`
- ✅ Trouve les produits même si le service ne contient pas le terme

**Code** (ligne ~1088) :
```rust
Ok(_) => {
    // Résultats vides, continuer avec fallback
    log_info("[NativeSearch] Recherche GPS retournée vide, fallback vers recherche sans GPS");
}
```

---

## 🎯 Recommandation

### Option 1 : Améliorer `search_services_gps_final()` (Recommandé)

Modifier la fonction pour qu'elle recherche aussi dans les produits :

```sql
-- Dans la fonction, ajouter recherche dans produits
WHERE (
    -- Recherche dans champs service (existant)
    COALESCE(s.data->>'titre_service', ...) ILIKE '%' || search_query || '%'
    OR ...
    -- ✅ NOUVEAU : Recherche dans produits
    OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE extract_all_product_text(product) ILIKE '%' || search_query || '%'
    )
)
```

### Option 2 : Garder le Fallback (Actuel)

- ✅ Déjà en place
- ✅ Fonctionne (fallback vers recherche corrigée)
- ⚠️ Mais moins optimal (2 requêtes au lieu d'1)

---

## 📊 Résumé

| Aspect | Détails |
|--------|---------|
| **Rôle** | Recherche optimisée avec filtrage GPS |
| **Recherche** | Dans champs service uniquement (titre, description, category) |
| **GPS** | Calcule distance et filtre par rayon |
| **Tri** | Par pertinence puis distance |
| **Limitation** | Ne recherche PAS dans les produits |
| **Fallback** | Si 0 résultats → recherche sans GPS (corrigée) |

---

## ✅ Conclusion

`search_services_gps_final()` est **utile pour les recherches avec GPS**, mais elle a une **limitation** : elle ne recherche pas dans les produits.

**Solution actuelle** : Le fallback vers la recherche corrigée permet de trouver les produits même si `search_services_gps_final()` retourne 0 résultats.

**Amélioration future** : Modifier `search_services_gps_final()` pour qu'elle recherche aussi dans les produits (comme la recherche corrigée).

