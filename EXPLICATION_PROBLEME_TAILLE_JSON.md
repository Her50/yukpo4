# 📊 Explication du Problème de Taille JSON

## ❓ Question : PostgreSQL ne peut pas sauvegarder plusieurs images/vidéos ?

**Réponse : NON, ce n'est PAS le problème !** PostgreSQL peut parfaitement stocker plusieurs images et vidéos. Voici comment ça fonctionne :

## ✅ Architecture Actuelle (Correcte)

### 1. **Table `media` séparée** (pour les fichiers volumineux)
```
Table: media
- id (PK)
- service_id (FK vers services)
- product_id (optionnel)
- product_index (optionnel)
- type ('image', 'video', 'audio', 'document', 'excel')
- path (chemin du fichier sur le disque)
- uploaded_at
- image_signature, image_hash, image_metadata
```

**Les images/vidéos sont stockées :**
- ✅ Sur le **disque** (dans le dossier `uploads/`)
- ✅ Les **métadonnées** dans la table `media`
- ✅ **AUCUNE image base64** dans la table `media`

### 2. **Table `services`** (pour les données structurées)
```
Table: services
- id (PK)
- user_id
- data (JSONB) ← ICI est le problème
- is_tarissable
- gps
- auto_deactivate_at
```

## 🚨 Le VRAI Problème

### Limite PostgreSQL : 8191 bytes pour les INDEX sur JSONB

PostgreSQL a une **limite technique** :
- ✅ La colonne JSONB peut stocker **jusqu'à 1 GB** de données
- ❌ Mais les **INDEX** sur JSONB sont limités à **8191 bytes par entrée**

### Pourquoi cette limite ?

Les index PostgreSQL utilisent des pages de 8 KB. Pour créer un index efficace, chaque entrée d'index doit tenir dans une page. C'est une limitation technique de PostgreSQL, pas de votre application.

## 🔍 Ce qui se passe dans votre code

### Flux actuel (problématique) :

1. **Réception des données** (frontend → backend)
   ```
   {
     "titre_service": "...",
     "base64_image": ["data:image/jpeg;base64,/9j/4AAQ...", ...],  ← Images base64
     "video_base64": ["data:video/mp4;base64,..."],                ← Vidéos base64
     "produits": [
       {
         "nom": "...",
         "images_base64": ["...", "..."]                           ← Images produits base64
       }
     ]
   }
   ```

2. **Validation JSON** ✅
   - Le JSON est validé avec le schéma

3. **Nettoyage des médias base64** (ligne ~1099)
   ```rust
   clean_media_recursive_final(&mut data_obj, &mut removed_count);
   ```
   - Supprime les `base64_image`, `video_base64`, etc. du JSON
   - **MAIS** : Si le nettoyage n'est pas assez agressif, il reste des données volumineuses

4. **Vérification de la taille** (ligne ~1220)
   ```rust
   let json_size = serde_json::to_string(&data_obj).len();
   if json_size > 8000 {
       return Err(...); // ❌ Échec si trop volumineux
   }
   ```

5. **Insertion dans `services.data`** (ligne ~1305)
   ```sql
   INSERT INTO services (user_id, data, ...)
   VALUES ($1, $2, ...)  -- data_obj (sans base64)
   ```

6. **Sauvegarde des médias** (ligne ~1382+)
   ```sql
   INSERT INTO media (service_id, type, path, ...)
   VALUES ($1, 'image', '/uploads/...', ...)
   ```
   - Les images/vidéos sont sauvegardées sur le disque
   - Les métadonnées sont dans la table `media`

## 💡 Pourquoi le JSON peut être trop volumineux ?

Même après nettoyage des base64, le JSON peut rester trop gros à cause de :

1. **Descriptions très longues** (plusieurs milliers de caractères)
2. **Beaucoup de champs** (titre, description, produits, caractéristiques, etc.)
3. **Données enrichies** (Google Places, embeddings, etc.)
4. **Structure JSON complexe** (objets imbriqués avec métadonnées)

### Exemple concret :

```json
{
  "titre_service": {
    "type_donnee": "string",
    "valeur": "Restaurant camerounais à Douala",
    "origine_champs": "ia"
  },
  "description": {
    "type_donnee": "string",
    "valeur": "Découvrez notre restaurant camerounais situé à Douala, offrant une variété de plats traditionnels et modernes pour satisfaire toutes vos envies culinaires. Notre cuisine authentique utilise des ingrédients locaux et frais...",  ← 500+ caractères
    "origine_champs": "ia"
  },
  "produits": {
    "type_donnee": "listeproduit",
    "valeur": [
      {
        "nom": "Cuisine camerounaise",
        "description": "Profitez de notre cuisine camerounaise authentique avec des plats préparés à partir d'ingrédients locaux et frais. Nous proposons une large gamme de plats traditionnels...",  ← 300+ caractères
        "categorie": "Restauration",
        "prix": 11000,
        "lieu_produit": {
          "type_donnee": "location",
          "valeur": {
            "raw": "Cameroun",
            "place_name": "Cameroun",
            "components": {
              "pays": "Cameroun"
            }
          },
          "composants": {...},
          "filtrable": true
        }
      }
    ]
  },
  "google_place": {
    "place_id": "...",
    "formatted_address": "...",
    "location": {...},
    "rating": 4.5,
    "opening_hours": {...}
  },
  // ... beaucoup d'autres champs
}
```

**Résultat** : Même sans base64, ce JSON peut faire 9000+ bytes !

## ✅ Solutions Appliquées

### 1. **Nettoyage agressif des médias base64**
- Suppression de tous les `base64_image`, `video_base64`, etc.
- Nettoyage récursif dans tous les objets imbriqués

### 2. **Troncature des champs textuels trop longs**
- Descriptions produits : limitées à 2000 caractères
- Tous les champs textuels : limités à 1000 caractères

### 3. **Vérification de taille AVANT débit**
- Le solde n'est débité qu'après validation de la taille
- Si la taille est trop grande → pas de débit

### 4. **Remboursement automatique**
- Si l'insertion échoue après débit → remboursement automatique

## 🎯 Conclusion

**PostgreSQL PEUT stocker plusieurs images/vidéos** via la table `media`.

**Le problème est** : Le JSON `data` dans `services` ne doit pas dépasser 8191 bytes pour permettre la création d'index. Même sans base64, un JSON avec beaucoup de champs peut dépasser cette limite.

**La solution** : Nettoyer agressivement le JSON avant insertion (supprimer base64, tronquer les textes longs) et vérifier la taille avant de débiter le solde.

