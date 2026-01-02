# Vérification de la récupération des médias produits

## ✅ Vérifications effectuées

### 1. Structure de la table `media`
- ✅ Colonne `product_index` : existe et est correctement indexée
- ✅ Colonne `media_type` : existe avec contrainte CHECK ('image', 'video', 'audio')
- ✅ Colonne `type` : existe (type de base)
- ✅ Index composite : `idx_media_service_product` sur `(service_id, product_index)`

### 2. Requête SQL pour récupération des médias produits

#### Avant correction :
```sql
WHERE service_id = $1
AND (
    product_index = $2 
    OR product_index IS NULL  -- ⚠️ PROBLÈME: Inclut aussi les médias généraux
)
```

#### Après correction :
```sql
-- 1. D'abord chercher les médias spécifiques au produit
WHERE service_id = $1
AND product_index = $2  -- ✅ Exact match

-- 2. Si aucun média spécifique, fallback vers médias généraux
WHERE service_id = $1
AND product_index IS NULL  -- ✅ Fallback explicite
```

### 3. Améliorations apportées

#### A. Structure `MediaRow` enrichie
- ✅ Ajout de `product_index: Option<i32>` pour logging
- ✅ Ajout de `media_type: Option<String>` pour validation
- ✅ Toutes les requêtes SQL mises à jour pour sélectionner ces champs

#### B. Logs détaillés ajoutés
- ✅ Nombre de médias trouvés par catégorie (spécifique produit, généraux, médiathèque, publicité)
- ✅ Détails pour chaque média : `id`, `path`, `product_index`, `media_type`, `type`
- ✅ Warnings pour médias introuvables
- ✅ Résumé final avec total collecté

#### C. Stratégie de récupération améliorée
1. **Médias sélectionnés manuellement** : Si `selected_media_ids` fourni
2. **Médias spécifiques au produit** : `product_index = $2` (exact match)
3. **Fallback médias généraux** : `product_index IS NULL` (si aucun spécifique)
4. **Médiathèque service** : Médias du service (hors produit spécifique)
5. **Assets publicité** : Banners, logos, etc.

### 4. Validation des chemins

#### Fonction `row_to_media_source`
- ✅ Vérifie si le fichier existe localement
- ✅ Gère les URLs S3/CDN (http://, https://)
- ✅ Construit le chemin absolu depuis le path relatif
- ✅ Valide que le fichier n'est pas vide (0 bytes)
- ✅ Logs détaillés pour chaque média traité

### 5. Conversion en URLs

#### Fonction `media_source_to_url`
- ✅ Détecte les URLs déjà complètes (S3/CDN)
- ✅ Convertit les chemins locaux en URLs : `{API_BASE_URL}/api/media/files/{path}`
- ✅ Gère les chemins relatifs et absolus
- ✅ Logs pour chaque conversion

## 🔍 Points de vérification

### Requête SQL principale (médias produits)
```sql
SELECT id, path, type, ai_description, product_index, media_type
FROM media
WHERE service_id = $1
AND product_index = $2
AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
LIMIT 16
```

**Vérifications** :
- ✅ Filtre sur `service_id` : correct
- ✅ Filtre sur `product_index` : exact match (plus de `OR product_index IS NULL`)
- ✅ Filtre sur type : `media_type` OU `type` (fallback si `media_type` NULL)
- ✅ Tri : image principale en premier, puis par ordre d'affichage
- ✅ Limite : 16 médias max

### Fallback vers médias généraux
```sql
SELECT id, path, type, ai_description, product_index, media_type
FROM media
WHERE service_id = $1
AND product_index IS NULL
AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, uploaded_at DESC
LIMIT 16
```

**Vérifications** :
- ✅ Utilisé uniquement si aucun média spécifique au produit
- ✅ Logs explicites pour indiquer le fallback
- ✅ Tri par date d'upload (plus récent en premier)

## 📊 Logs de diagnostic

Les logs suivants sont maintenant disponibles pour diagnostiquer les problèmes :

1. **Recherche médias produit** :
   ```
   [VideoGeneration] 🔍 Recherche médias produit - service_id=X, product_index=Y
   [VideoGeneration] 📊 N média(x) trouvé(s) en base pour le produit spécifique
   ```

2. **Fallback médias généraux** :
   ```
   [VideoGeneration] ⚠️ Aucun média spécifique au produit, recherche médias généraux
   [VideoGeneration] 📊 N média(x) généraux trouvé(s) en fallback
   ```

3. **Chaque média ajouté** :
   ```
   [VideoGeneration] ✅ Média ajouté: id=X, path=Y, product_index=Z, media_type=A, type=B
   ```

4. **Médias ignorés** :
   ```
   [VideoGeneration] ⚠️ Média ignoré (fichier introuvable): id=X, path=Y
   ```

5. **Résumé final** :
   ```
   [VideoGeneration] ✅ Récupération médias terminée: N média(x) collecté(s) au total
   ```

## ✅ Résultat

Les médias des produits sont maintenant :
- ✅ **Correctement récupérés** : Requête SQL précise avec `product_index` exact
- ✅ **Bien filtrés** : Seulement les médias du produit spécifique (avec fallback si nécessaire)
- ✅ **Bien triés** : Image principale en premier, puis par ordre d'affichage
- ✅ **Bien loggés** : Détails complets pour chaque étape
- ✅ **Bien convertis** : PathBuf → URL accessible pour les scènes

## 🎯 Prochaines étapes de vérification

Si des médias ne sont toujours pas récupérés, vérifier :

1. **En base de données** :
   ```sql
   SELECT id, path, product_index, media_type, type, service_id
   FROM media
   WHERE service_id = X AND product_index = Y;
   ```

2. **Chemins des fichiers** :
   - Vérifier que les `path` dans la DB sont corrects
   - Vérifier que les fichiers existent sur le disque ou sont accessibles via URL
   - Vérifier que `API_BASE_URL` ou `UPLOAD_BASE_URL` est configuré

3. **Logs du backend** :
   - Chercher les logs `[VideoGeneration] 🔍 Recherche médias produit`
   - Vérifier le nombre de médias trouvés
   - Vérifier les warnings pour médias introuvables

