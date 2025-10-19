# ⚡ Action Rapide : Amélioration Recherche Produits

## 🎯 Résumé en 3 points

1. ✅ **Recherche GPS existe déjà** mais ne cherche que dans `product->>'name'`
2. ✨ **Notre amélioration** ajoute 12 champs supplémentaires + priorité GPS produit  
3. 🔧 **Action requise** : Choisir entre améliorer l'existant OU utiliser notre nouvelle fonction

---

## 📊 État actuel

### Fonction existante (hors migrations)
**Fichier** : `backend/enhance_search_with_products.sql`  
**Fonction** : `search_services_gps_final()`  
**Champs produits recherchés** : `name` SEULEMENT

### Notre amélioration
**Fichier** : `backend/migrations/20250119_enhance_product_search_gps.sql`  
**Fonction** : `search_services_gps_enhanced()` (nom différent, **pas de conflit**)  
**Champs produits recherchés** : **13 champs** (nom, description, type, marque, modèle, titre, quartier, ville, catégories, matière, couleur)  
**GPS** : Priorité GPS du produit

---

## ✅ Option recommandée : Utiliser les 2 approches

### Approche 1 : Améliorer la fonction existante

```bash
cd backend

# 1. Éditer enhance_search_with_products.sql
# Remplacer :
#   WHERE product->>'name' ILIKE '%' || search_query || '%'
# Par :
#   WHERE product->>'nom' ILIKE '%' || search_query || '%'
#      OR product->>'name' ILIKE '%' || search_query || '%'
#      OR product->>'description' ILIKE '%' || search_query || '%'
#      OR product->>'type' ILIKE '%' || search_query || '%'
#      OR product->>'marque' ILIKE '%' || search_query || '%'
#      OR product->>'modele' ILIKE '%' || search_query || '%'
#      OR product->>'titre' ILIKE '%' || search_query || '%'
#      OR product->>'quartier' ILIKE '%' || search_query || '%'
#      OR product->>'ville' ILIKE '%' || search_query || '%'

# 2. Appliquer le fichier manuellement
psql -U postgres -d yukpomnang -f enhance_search_with_products.sql

# 3. Tester
psql -U postgres -d yukpomnang -c "
  SELECT * FROM search_services_gps_final('iPhone', '6.3703,2.3912', 10, 20);
"
```

### Approche 2 : Ajouter notre nouvelle migration (RECOMMANDÉ ✅)

```bash
cd backend

# 1. Appliquer la migration
sqlx migrate run

# 2. Utiliser la nouvelle fonction enhanced
psql -U postgres -d yukpomnang -c "
  SELECT * FROM search_services_gps_enhanced('iPhone', '6.3703,2.3912', 10, 20);
"

# 3. Mettre à jour le code Rust pour utiliser la nouvelle fonction
# Fichier: src/services/native_search_service.rs
# Ligne ~148: Changer search_services_gps_final en search_services_gps_enhanced
```

---

## 🔧 Modifications Rust nécessaires

### Fichier : `backend/src/services/native_search_service.rs`

**Ligne ~148**, remplacer :
```rust
let sql = r#"
    SELECT 
        service_id,
        titre_service,
        category,
        gps_coords,
        distance_km,
        relevance_score,
        gps_source
    FROM search_services_gps_final($1, $2, $3, $4)  // ❌ Ancienne fonction
"#;
```

Par :
```rust
let sql = r#"
    SELECT 
        service_id,
        titre_service,
        category,
        gps_coords,
        distance_km,
        relevance_score,
        gps_source
    FROM search_services_gps_enhanced($1, $2, $3, $4)  // ✅ Nouvelle fonction
"#;
```

---

## 🎯 Workflow complet recommandé

### Étape 1 : Appliquer la migration

```powershell
cd backend

# Appliquer toutes les migrations en attente
sqlx migrate run

# Vérifier que notre migration est bien appliquée
psql -U postgres -d yukpomnang -c "
  SELECT version, description, success 
  FROM _sqlx_migrations 
  WHERE description LIKE '%product%'
  ORDER BY installed_on DESC;
"
```

### Étape 2 : Vérifier les fonctions créées

```bash
# Vérifier que les 3 nouvelles fonctions existent
psql -U postgres -d yukpomnang -c "
  \df get_best_gps_for_service
  \df calculate_product_relevance_score
  \df search_services_gps_enhanced
"
```

### Étape 3 : Tester la recherche

```sql
-- Test 1 : Recherche par nom de produit
SELECT * FROM search_services_gps_enhanced(
    'iPhone',
    '6.3703,2.3912',
    10,
    20
);

-- Test 2 : Recherche par marque
SELECT * FROM search_services_gps_enhanced(
    'Samsung',
    '6.3703,2.3912',
    20,
    20
);

-- Test 3 : Recherche par type
SELECT * FROM search_services_gps_enhanced(
    'immobilier',
    '6.3703,2.3912',
    50,
    20
);

-- Test 4 : Recherche par localisation
SELECT * FROM search_services_gps_enhanced(
    'Calavi',
    '6.4476,2.3586',
    5,
    20
);
```

### Étape 4 : Mettre à jour le code Rust

```bash
# Éditer le fichier
code backend/src/services/native_search_service.rs

# Chercher "search_services_gps_final"
# Remplacer par "search_services_gps_enhanced"
```

### Étape 5 : Régénérer les métadonnées offline

```bash
cd backend

# IMPORTANT : Régénérer après modification SQL
cargo sqlx prepare

# Vérifier que de nouveaux fichiers .json sont créés dans .sqlx/
```

### Étape 6 : Recompiler en mode offline

```bash
# Tester la compilation sans la base
export SQLX_OFFLINE=true  # Linux/Mac
$env:SQLX_OFFLINE="true"  # PowerShell

cargo build --release

# Si erreur, régénérer les métadonnées (étape 5)
```

### Étape 7 : Tester le backend

```bash
# Lancer le backend
cargo run

# Dans un autre terminal, tester la recherche via l'API
curl -X POST http://localhost:3000/api/rechercher-besoin \
  -H "Content-Type: application/json" \
  -d '{
    "texte": "iPhone 14 Pro",
    "gps_zone": "6.3703,2.3912",
    "search_radius_km": 10
  }'
```

---

## 📋 Checklist finale

- [ ] Migration appliquée (`sqlx migrate run`)
- [ ] Fonctions SQL créées (vérifiées avec `\df`)
- [ ] Tests SQL réussis (4 scénarios testés)
- [ ] Code Rust mis à jour (`search_services_gps_enhanced`)
- [ ] Métadonnées offline régénérées (`cargo sqlx prepare`)
- [ ] Compilation offline réussie (`SQLX_OFFLINE=true cargo build`)
- [ ] Tests API réussis (requête curl)
- [ ] Commit des changements (migration + `.sqlx/*.json`)

---

## 🚨 En cas de problème

### "Migration already applied"
```bash
# Normal, la migration a déjà été exécutée
# Rien à faire
```

### "Function already exists"
```bash
# Supprimer l'ancienne version et réappliquer
psql -U postgres -d yukpomnang -c "
  DROP FUNCTION IF EXISTS search_services_gps_enhanced(TEXT, TEXT, INTEGER, INTEGER);
"

# Réappliquer la migration
sqlx migrate run
```

### "Query requires sqlx-data.json"
```bash
# Régénérer les métadonnées
cd backend
cargo sqlx prepare
```

### "Cannot connect to database during build"
```bash
# Activer le mode offline
export SQLX_OFFLINE=true
cargo build
```

---

## 🎉 Résultat attendu

Après toutes ces étapes, la recherche sera capable de trouver des services basés sur :

- ✅ **13 champs de produits** (au lieu de 1)
- ✅ **GPS prioritaire du produit** (immobilier géolocalisé précisément)
- ✅ **Scoring intelligent** (pertinence + proximité + récence)
- ✅ **Performance optimisée** (index GIN sur produits)

---

**Temps estimé** : 15-20 minutes  
**Difficulté** : Moyenne  
**Impact** : ⭐⭐⭐⭐⭐ Très élevé

**Questions ?** Consultez le guide complet : `GUIDE_MIGRATIONS_SQLX.md`

