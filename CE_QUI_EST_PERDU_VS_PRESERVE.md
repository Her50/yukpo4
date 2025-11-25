# 📊 Ce qui est Perdu vs Préservé lors du Nettoyage JSON

## ✅ DONNÉES PRÉSERVÉES (Non perdues)

### 1. **Images et Vidéos** ✅ COMPLÈTEMENT PRÉSERVÉES
- ❌ **Supprimées du JSON** `services.data`
- ✅ **Sauvegardées sur le disque** (dossier `uploads/`)
- ✅ **Métadonnées dans la table `media`** :
  - Chemin du fichier (`path`)
  - Type (`image`, `video`, `audio`, etc.)
  - Lien au service (`service_id`)
  - Lien au produit (`product_id`, `product_index`)
  - Signature, hash, métadonnées

**Résultat** : Les images/vidéos sont **100% préservées**, juste déplacées du JSON vers la table `media`.

### 2. **Données Google Places Essentielles** ✅ PARTIELLEMENT PRÉSERVÉES
**Ce qui est GARDÉ dans `services.data`** :
- ✅ `place_id` (identifiant unique Google)
- ✅ `formatted_address` (adresse formatée)
- ✅ `location` (coordonnées GPS)
- ✅ `rating` (note sur 5)
- ✅ `opening_hours` (horaires d'ouverture)

**Ce qui est SUPPRIMÉ** (pour réduire la taille) :
- ❌ `reviews` (avis détaillés - peut être très volumineux)
- ❌ `photos` (photos Google - déjà dans `media` si uploadées)
- ❌ `editorial_summary` (résumé éditorial - peut être long)
- ❌ Autres champs non essentiels

**Résultat** : Les données **essentielles** de Google Places sont préservées. Les données **volumineuses** (avis, photos) sont supprimées.

### 3. **Tous les autres champs** ✅ PRÉSERVÉS
- Titre, description, catégorie
- Produits avec leurs caractéristiques
- Prix, localisation, contact
- Tous les champs métier

## ⚠️ DONNÉES PARTIELLEMENT PERDUES

### 1. **Descriptions tronquées** ⚠️ PARTIELLEMENT PERDUES
- **Limite** : 1000 caractères maximum par champ texte
- **Ce qui est perdu** : Tout ce qui dépasse 1000 caractères
- **Exemple** :
  ```
  Avant : "Description très longue de 5000 caractères..."
  Après : "Description très longue de 1000 caractères..."
  ```

**Impact** : Les descriptions très longues sont tronquées, mais les 1000 premiers caractères sont préservés.

### 2. **Données Google Places non essentielles** ⚠️ PERDUES
- ❌ `reviews` (avis détaillés)
- ❌ `photos` (photos Google - mais vous avez vos propres photos dans `media`)
- ❌ `editorial_summary` (résumé éditorial)

**Impact** : Ces données ne sont pas critiques pour le fonctionnement. Les données essentielles (adresse, note, horaires) sont préservées.

## 📋 Résumé

| Type de Donnée | Statut | Où est stocké |
|----------------|--------|---------------|
| **Images/Vidéos base64** | ✅ **100% préservé** | Table `media` + disque |
| **Données Google Places essentielles** | ✅ **Préservé** | `services.data.google_place` |
| **Données Google Places volumineuses** | ❌ **Supprimé** | Perdu (reviews, photos Google) |
| **Descriptions > 1000 chars** | ⚠️ **Tronqué** | `services.data` (1000 premiers chars) |
| **Tous les autres champs** | ✅ **Préservé** | `services.data` |

## 💡 Recommandations

### Pour éviter la perte de données :

1. **Descriptions longues** :
   - Limiter les descriptions à 1000 caractères côté frontend
   - Ou créer un champ séparé pour les descriptions complètes

2. **Données Google Places** :
   - Les données essentielles sont suffisantes (adresse, note, horaires)
   - Les avis Google peuvent être récupérés via l'API Google Places si nécessaire

3. **Images/Vidéos** :
   - Aucun problème : elles sont toutes préservées dans `media`

## 🔍 Vérification

Pour vérifier ce qui est stocké :

```sql
-- Voir les médias sauvegardés
SELECT * FROM media WHERE service_id = X;

-- Voir le JSON final (sans base64)
SELECT data FROM services WHERE id = X;

-- Voir les données Google Places préservées
SELECT data->'google_place' FROM services WHERE id = X;
```

