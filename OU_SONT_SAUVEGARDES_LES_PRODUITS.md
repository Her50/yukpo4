# 📦 Où sont sauvegardés les produits ?

## 🎯 Résumé

**TOUS les produits sont sauvegardés dans la même table : `services`**

Les produits sont stockés dans le champ JSONB `services.data->'produits'` (un array JSON).

## 📝 1. Produits créés via "Formulaire d'ajout d'un produit" (AjouterProduitSimpleScreen)

### 📍 Endpoint appelé
```
POST /api/services/{service_id}/products
```

### 🔧 Controller
`backend/src/controllers/product_addition_controller.rs` → `add_product_to_service()`

### 💾 Table de sauvegarde
**Table : `services`**

**Champ : `services.data->'produits'`** (JSONB array)

### 📋 Processus de sauvegarde

1. **Récupère le service existant** :
   ```sql
   SELECT user_id, data FROM services WHERE id = $1
   ```

2. **Ajoute le nouveau produit dans `data->'produits'`** :
   ```rust
   // Structure dans data->'produits'
   {
     "type_donnee": "autocomplete",
     "valeur": [
       "nom_produit,categorie,description,prix,devise", // Produit 1 (string)
       "nom_produit,categorie,description,prix,devise"  // Produit 2 (string)
     ],
     "separateur": ",",
     "filtrable": true,
     "origine_champs": "formulaire"
   }
   ```

3. **Met à jour le service** :
   ```sql
   UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2
   ```

4. **Indexe dans `autocomplete_characteristics` et `autocomplete_combinations`** (pour la recherche)

5. **Synchronise avec `products_lifecycle`** (via le trigger `trigger_sync_products`)

### 📊 Code de sauvegarde

```rust
// backend/src/controllers/product_addition_controller.rs (ligne 210-234)
let produits_array = service_data
    .get_mut("produits")
    .and_then(|p| p.as_object_mut())
    .and_then(|obj| obj.get_mut("valeur"))
    .and_then(|v| v.as_array_mut());

let product_index = match produits_array {
    Some(arr) => {
        arr.push(json!(product_string.clone()));  // Ajoute le produit
        arr.len() - 1
    }
    None => {
        // Crée le tableau s'il n'existe pas
        service_data["produits"] = json!({...});
        0
    }
};

// Mise à jour en base
sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
    .bind(&service_data)
    .bind(service_id)
    .execute(&state.pg)
    .await;
```

---

## 📝 2. Produits créés via "FormulaireYukpoIntelligentScreen" (bloc Produits)

### 📍 Endpoint appelé
```
POST /api/services/create
```

### 🔧 Service
`backend/src/services/creer_service.rs` → `creer_service()`

### 💾 Table de sauvegarde
**Table : `services`**

**Champ : `services.data->'produits'`** (JSONB array)

### 📋 Processus de sauvegarde

1. **Réception des données** :
   ```json
   {
     "data": {
       "titre_service": {...},
       "produits": [
         {
           "nom_produit": "iPhone 15",
           "categorie_produit": "Smartphone",
           "prix_produit": 500000,
           "images": [...],
           "videos": [...],
           ...
         }
       ]
     }
   }
   ```

2. **Insère un nouveau service** avec les produits dans `data->'produits'` :
   ```sql
   INSERT INTO services (user_id, data, is_active, created_at, updated_at)
   VALUES ($1, $2, TRUE, NOW(), NOW())
   ```

3. **Sauvegarde les médias** dans la table `media` :
   ```sql
   INSERT INTO media (service_id, product_index, type, path, ...)
   VALUES (...)
   ```

4. **Synchronise avec `products_lifecycle`** (via le trigger `trigger_sync_products`)

5. **Indexe dans `autocomplete_characteristics` et `autocomplete_combinations`**

### 📊 Code de sauvegarde

```rust
// backend/src/services/creer_service.rs (ligne ~1000-1700)
// 1. Insère le service avec les produits dans data
let service_id = sqlx::query_scalar(
    r#"
    INSERT INTO services (user_id, data, is_active, created_at, updated_at, category)
    VALUES ($1, $2, $3, NOW(), NOW(), $4)
    RETURNING id
    "#
)
.bind(user_id)
.bind(&data_obj)  // Contient data->'produits'
.bind(true)
.bind(&category)
.fetch_one(&mut *tx)
.await?;

// 2. Sauvegarde les médias pour chaque produit
for (product_index, produit_value) in produits_array.iter_mut().enumerate() {
    // Sauvegarde images/videos dans table media
    // Met à jour le produit avec les chemins des fichiers
}
```

---

## 🔄 Synchronisation automatique avec `products_lifecycle`

### Trigger PostgreSQL

Quand un service est créé ou modifié, un **trigger** synchronise automatiquement :

```sql
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (jsonb_typeof(NEW.data->'produits') = 'array')
    EXECUTE FUNCTION sync_product_on_service_update();
```

### Ce que fait le trigger

Pour chaque produit dans `data->'produits'`, il crée/ met à jour une entrée dans `products_lifecycle` :

```sql
INSERT INTO products_lifecycle (
    service_id,
    product_index,        -- Position dans data->'produits'
    product_nom,          -- Nom du produit
    product_type,         -- Type du produit
    is_active,            -- TRUE par défaut
    auto_deactivate_at    -- NOW() + 30 jours
) VALUES (...)
ON CONFLICT (service_id, product_index) DO UPDATE ...
```

---

## 📊 Structure complète des données

### Dans `services.data->'produits'`

**Format 1 : Objet avec valeur array**
```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      {
        "nom_produit": "iPhone 15",
        "categorie_produit": "Smartphone",
        "prix_produit": 500000,
        "images": ["path/to/image1.jpg"],
        "videos": ["path/to/video1.mp4"],
        ...
      },
      {
        "nom_produit": "Samsung Galaxy",
        ...
      }
    ],
    "separateur": ",",
    "filtrable": true,
    "origine_champs": "formulaire"
  }
}
```

**Format 2 : Array direct** (normalisé automatiquement)
```json
{
  "produits": [
    {
      "nom_produit": "iPhone 15",
      ...
    }
  ]
}
```

### Dans `products_lifecycle` (métadonnées)

```sql
-- Pour chaque produit dans services.data->'produits'
id: 1
service_id: 2
product_index: 0          -- Index dans l'array produits
product_nom: "iPhone 15"
product_type: "Smartphone"
is_active: TRUE
created_at: 2025-11-23...
auto_deactivate_at: 2025-12-23...  -- +30 jours
```

### Dans `media` (fichiers)

```sql
-- Pour chaque image/vidéo de chaque produit
id: 1
service_id: 2
product_id: "uuid"
product_index: 0          -- Index du produit
type: "image"             -- ou "video"
path: "path/to/file.jpg"
is_main_image: TRUE
display_order: 0
```

---

## ✅ Conclusion

| Formulaire | Endpoint | Table de sauvegarde | Champ |
|------------|----------|---------------------|-------|
| **AjouterProduitSimpleScreen** | `POST /api/services/{service_id}/products` | `services` | `data->'produits'` |
| **FormulaireYukpoIntelligentScreen** | `POST /api/services/create` | `services` | `data->'produits'` |

**Les deux utilisent la même table et le même champ !**

### Différences

1. **AjouterProduitSimpleScreen** : 
   - Met à jour un service existant (`UPDATE services`)
   - Ajoute UN produit à la fin de l'array
   - Coût : 3000 FCFA

2. **FormulaireYukpoIntelligentScreen** :
   - Crée un nouveau service (`INSERT INTO services`)
   - Peut créer plusieurs produits en même temps
   - Coût : Basé sur tokens IA + 3000 FCFA par produit

### Synchronisation automatique

Les deux déclenchent automatiquement :
- ✅ Synchronisation avec `products_lifecycle` (via trigger)
- ✅ Indexation dans `autocomplete_characteristics`
- ✅ Indexation dans `autocomplete_combinations`

---

**Date de création** : 23 novembre 2025

