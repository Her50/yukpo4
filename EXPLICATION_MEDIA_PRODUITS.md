# 🖼️ EXPLICATION : Lien Média ↔ Produits

**Date** : 2025-11-02  
**Question** : Les images/vidéos sont-elles liées aux produits ?

---

## ✅ RÉPONSE : OUI, LIEN COMPLET !

Les médias sont sauvegardés dans la table `media` dédiée avec **3 types de liens** avec les produits :

---

## 📊 STRUCTURE TABLE MEDIA

```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,              -- ⬅️ Lien avec service
    
    -- ✅ LIENS AVEC PRODUITS (3 colonnes)
    product_id TEXT,                           -- ⬅️ Lien 1: ID textuel du produit
    product_index INTEGER,                     -- ⬅️ Lien 2: Position du produit (0, 1, 2...)
    
    type TEXT NOT NULL,                        -- 'image', 'video', 'audio'
    path TEXT NOT NULL,                        -- Chemin ou URL
    
    -- ✅ MÉTADONNÉES DISPLAY
    is_main_image BOOLEAN DEFAULT FALSE,       -- ⬅️ Image principale du produit
    display_order INTEGER DEFAULT 0,           -- ⬅️ Ordre d'affichage (0, 1, 2...)
    
    -- Métadonnées fichier
    media_type TEXT,
    file_size BIGINT,
    file_format TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    
    -- Analyse IA image
    image_signature JSONB,
    image_hash VARCHAR(64),
    image_metadata JSONB
);
```

---

## 🔗 LES 3 TYPES DE LIENS

### 1️⃣ `product_id` (Identifiant Textuel)
**Type** : TEXT  
**Exemple** : `"prod_0"`, `"prod_1"`, `"chaussure_nike_001"`

**Utilité** :
- Identifiant flexible défini par le frontend
- Permet de regrouper facilement tous les médias d'un produit
- Utile pour la duplication de produits

**Requête** :
```sql
-- Récupérer toutes les images du produit "prod_0"
SELECT * FROM media 
WHERE service_id = 123 
  AND product_id = 'prod_0'
ORDER BY display_order;
```

---

### 2️⃣ `product_index` (Position dans le Service)
**Type** : INTEGER  
**Exemple** : `0`, `1`, `2`

**Utilité** :
- Position du produit dans le service (0 = premier produit)
- **Index de performance** : Recherche rapide avec `(service_id, product_index)`
- Correspond à l'index dans le tableau `produits[]` du JSON

**Requête** :
```sql
-- Récupérer toutes les images du premier produit (index 0)
SELECT * FROM media 
WHERE service_id = 123 
  AND product_index = 0
ORDER BY display_order;
```

---

### 3️⃣ `is_main_image` + `display_order` (Hiérarchie Visuelle)
**Type** : BOOLEAN + INTEGER  
**Exemple** : `is_main_image=true, display_order=0`

**Utilité** :
- `is_main_image = TRUE` : Image principale du produit (affichée en premier)
- `display_order` : Ordre d'affichage des autres images (0, 1, 2...)

**Requête** :
```sql
-- Image principale d'un produit
SELECT * FROM media 
WHERE service_id = 123 
  AND product_index = 0 
  AND is_main_image = TRUE
LIMIT 1;

-- Toutes les images dans l'ordre
SELECT * FROM media 
WHERE service_id = 123 
  AND product_index = 0
ORDER BY 
  is_main_image DESC,  -- Principale en premier
  display_order ASC;    -- Puis par ordre
```

---

## 📝 EXEMPLE CONCRET

### Service Chaussures avec 2 Produits

**Service ID** : 456

**Produit 1** : Nike Air Max (product_index = 0)
- Image 1 : `is_main_image = TRUE`, `display_order = 0`
- Image 2 : `is_main_image = FALSE`, `display_order = 1`
- Image 3 : `is_main_image = FALSE`, `display_order = 2`
- Vidéo 1 : `display_order = 0`

**Produit 2** : Adidas Ultraboost (product_index = 1)
- Image 1 : `is_main_image = TRUE`, `display_order = 0`
- Image 2 : `is_main_image = FALSE`, `display_order = 1`

### Table media :

| id | service_id | product_id | product_index | type | is_main_image | display_order | path |
|----|------------|------------|---------------|------|---------------|---------------|------|
| 1  | 456        | prod_0     | 0             | image| TRUE          | 0             | nike1.jpg |
| 2  | 456        | prod_0     | 0             | image| FALSE         | 1             | nike2.jpg |
| 3  | 456        | prod_0     | 0             | image| FALSE         | 2             | nike3.jpg |
| 4  | 456        | prod_0     | 0             | video| FALSE         | 0             | nike_demo.mp4 |
| 5  | 456        | prod_1     | 1             | image| TRUE          | 0             | adidas1.jpg |
| 6  | 456        | prod_1     | 1             | image| FALSE         | 1             | adidas2.jpg |

---

## 🔍 CODE SAUVEGARDE (creer_service.rs)

### Ligne 673-691 : Insertion Images

```rust
INSERT INTO media (
    service_id, 
    product_id,           // ✅ ID textuel
    product_index,        // ✅ Position
    type, 
    path, 
    is_main_image,        // ✅ Principale ?
    display_order,        // ✅ Ordre d'affichage
    uploaded_at, 
    image_signature, 
    image_hash, 
    image_metadata
) 
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
```

**Paramètres bindés** :
- `service_id` : ID du service parent
- `product_id` : ID textuel du produit (ex: "prod_0")
- `product_index` : Position numérique (0, 1, 2...)
- `type` : "image"
- `path` : URL ou chemin fichier
- `is_main_image` : true pour la première image
- `display_order` : Index de l'image (0, 1, 2...)

---

## 🎯 AVANTAGES DE CE SYSTÈME

### ✅ Récupération Flexible

**Par service** (toutes les images) :
```sql
SELECT * FROM media WHERE service_id = 456 AND type = 'image';
```

**Par produit** (index numérique) :
```sql
SELECT * FROM media 
WHERE service_id = 456 AND product_index = 0
ORDER BY is_main_image DESC, display_order ASC;
```

**Par produit** (ID textuel) :
```sql
SELECT * FROM media WHERE product_id = 'prod_0';
```

**Image principale** (pour ProductCard) :
```sql
SELECT path FROM media 
WHERE service_id = 456 
  AND product_index = 0 
  AND is_main_image = TRUE
LIMIT 1;
```

### ✅ Performance

**Index optimisés** :
- `idx_media_service_id` : Recherche par service
- `idx_media_product_index` : Recherche par produit (position)
- `idx_media_product_id` : Recherche par ID textuel
- `idx_media_is_main` : Image principale uniquement
- `idx_media_display_order` : Tri rapide

### ✅ Migration Progressive

Si la table `media` existe déjà **SANS** les colonnes produit :

```sql
-- Ajout automatique des colonnes (données préservées ✅)
ALTER TABLE media ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS product_index INTEGER;
ALTER TABLE media ADD COLUMN IF NOT EXISTS is_main_image BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
```

**Résultat** :
- ✅ Anciennes lignes conservées (colonnes = NULL)
- ✅ Nouvelles lignes avec liens produits complets

---

## 🔧 CODE BACKEND ACTUEL

### Ligne 567-823 : Boucle par Produit

```rust
for (product_index, produit) in produits_array.iter().enumerate() {
    let product_id = produit.get("id")
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("prod_{}", product_index))  // ⬅️ ID par défaut
        .to_string();
    
    // Traiter images du produit
    for (image_index, img_url) in images_to_process.iter().enumerate() {
        let is_main = image_index == 0;  // ⬅️ Première = principale
        
        sqlx::query(
            "INSERT INTO media (
                service_id, 
                product_id,        // ⬅️ LIEN 1
                product_index,     // ⬅️ LIEN 2
                type, 
                path, 
                is_main_image,     // ⬅️ Flag principale
                display_order,     // ⬅️ Ordre
                ...
            ) VALUES (...)"
        )
        .bind(service_id)
        .bind(&product_id)           // ✅
        .bind(product_index as i32)  // ✅
        .bind("image")
        .bind(&file_path)
        .bind(is_main)               // ✅
        .bind(image_index as i32)    // ✅
        ...
        .execute(&mut *tx)
        .await?;
    }
    
    // Traiter vidéos du produit
    for (video_index, vid_url) in product_videos.iter().enumerate() {
        sqlx::query(
            "INSERT INTO media (
                service_id, 
                product_id,        // ⬅️ LIEN 1
                product_index,     // ⬅️ LIEN 2
                ...
            ) VALUES (...)"
        )
        .bind(service_id)
        .bind(&product_id)           // ✅
        .bind(product_index as i32)  // ✅
        .bind("video")
        ...
        .execute(&mut *tx)
        .await?;
    }
}
```

---

## ✅ CONFIRMATION FINALE

### Question 1 : Images/audios vont dans table `media` ?
**✅ OUI** - Ligne 673 et 797 : `INSERT INTO media`

### Question 2 : Lien avec les produits ?
**✅ OUI** - 3 colonnes dédiées :
- `product_id` (TEXT) : ID textuel
- `product_index` (INTEGER) : Position numérique
- Combinaison `(service_id, product_index)` : Index composite performant

### Question 3 : Données préservées si migration ?
**✅ OUI** - `ALTER TABLE ADD COLUMN` préserve toutes les données  
Les anciennes lignes auront juste `product_id = NULL` jusqu'à mise à jour

---

## 🎯 UTILISATION DANS ProductCard

```typescript
// Récupérer image principale du produit
const getMainImage = async (serviceId: number, productIndex: number) => {
  const response = await apiGet(
    `/api/services/${serviceId}/media?product_index=${productIndex}&main_only=true`
  );
  return response.data?.[0]?.path;
};

// Récupérer toutes les images d'un produit
const getProductImages = async (serviceId: number, productIndex: number) => {
  const response = await apiGet(
    `/api/services/${serviceId}/media?product_index=${productIndex}&type=image`
  );
  return response.data; // Déjà triées par display_order
};
```

---

## 📋 CHECKLIST COMPLÈTE

- ✅ Table `media` avec colonnes `product_id` et `product_index`
- ✅ Index `idx_media_product_index` pour performance
- ✅ Index `idx_media_product_id` pour recherche textuelle
- ✅ Migration progressive (ALTER TABLE si table existe)
- ✅ Code backend sauvegarde avec liens (ligne 673-823)
- ✅ Flag `is_main_image` pour image principale
- ✅ `display_order` pour tri visuel

**Tout est en place ! Les médias sont correctement liés aux produits** 🎉



