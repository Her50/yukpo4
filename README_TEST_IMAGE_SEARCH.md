# 🔍 Test de Recherche d'Images dans Yukpo

Ce dossier contient les scripts de test pour vérifier le bon fonctionnement de la création de services avec images et de la recherche par image dans Yukpo.

## 📋 Prérequis

- **Backend Yukpo** démarré et accessible
- **Base de données PostgreSQL** avec la table `media` configurée
- **Image de test** (l'image du blazer élégant fournie)
- **Python 3.7+** avec les packages `requests` et `PIL`
- **PowerShell** (pour les scripts Windows)
- **psql** (client PostgreSQL) accessible dans le PATH

## 🚀 Installation des dépendances Python

```bash
pip install requests pillow
```

## 📁 Fichiers de test

### 1. `test_image_search.py` - Script Python principal
Script de test complet qui :
- Crée un service avec l'image de test
- Effectue une recherche par image
- Vérifie que le service créé est trouvé dans les résultats

### 2. `test_image_search.ps1` - Script PowerShell de vérification
Script qui vérifie l'état de la base de données et du backend avant les tests.

### 3. `apply_image_search_migration.ps1` - Script de migration
Script qui applique automatiquement la migration de recherche d'images si nécessaire.

## 🔧 Étapes de test

### Étape 1: Préparation
1. Placez l'image de test dans le répertoire courant avec le nom `test_image.jpg`
2. Assurez-vous que le backend Yukpo est démarré
3. Vérifiez que PostgreSQL est accessible

### Étape 2: Vérification de l'état
```powershell
.\test_image_search.ps1
```

Ce script vérifie :
- ✅ Accessibilité du backend
- ✅ Connexion à la base de données
- ✅ Structure de la table `media`
- ✅ Présence des colonnes de recherche d'images
- ✅ Fonctions SQL de recherche
- ✅ Index de performance

### Étape 3: Application de la migration (si nécessaire)
Si la migration n'est pas appliquée :
```powershell
.\apply_image_search_migration.ps1
```

Ce script :
- Vérifie l'état actuel de la base
- Crée une sauvegarde de la table `media`
- Applique la migration `20250110000000_extend_media_for_image_search.sql`
- Vérifie que tout est correctement installé

### Étape 4: Test complet
```bash
python test_image_search.py
```

Ce script :
1. 🔧 Crée un service de test avec l'image
2. 🗄️ Vérifie l'état de la base de données
3. 🔍 Effectue une recherche par image
4. ✅ Vérifie que le service créé est trouvé

## 📊 Structure de la base de données

### Table `media` étendue
```sql
ALTER TABLE media
ADD COLUMN image_signature JSONB,      -- Signature vectorielle (192 valeurs float)
ADD COLUMN image_hash VARCHAR(64),      -- Hash MD5 pour détection de doublons
ADD COLUMN image_metadata JSONB;       -- Métadonnées (dimensions, format, couleurs)
```

### Fonctions SQL créées
- `calculate_image_similarity(sig1, sig2)` - Calcule la similarité entre signatures
- `search_similar_images(query_signature, threshold, max_results)` - Recherche d'images similaires
- `search_images_by_metadata(query_metadata, max_results)` - Recherche par métadonnées

### Index de performance
- `idx_media_image_signature` - Index GIN sur les signatures
- `idx_media_image_hash` - Index sur les hashes
- `idx_media_image_metadata` - Index GIN sur les métadonnées

## 🔍 Fonctionnement de la recherche

### 1. Génération de signature d'image
- Redimensionnement à 128x128 pixels
- Extraction de signatures par blocs de couleurs (16x16)
- Histogramme de couleurs global
- Détection de contours simplifiée
- Analyse de texture locale

### 2. Calcul de similarité
- Distance euclidienne entre signatures
- Score de similarité normalisé (0 = identique, 1 = très différent)
- Seuil configurable (défaut: 0.3)

### 3. Recherche optimisée
- Utilisation des index GIN pour les performances
- Limitation du nombre de résultats
- Tri par score de similarité décroissant

## 🐛 Dépannage

### Problème: "Colonnes de recherche d'images manquantes"
**Solution:** Appliquez la migration avec `.\apply_image_search_migration.ps1`

### Problème: "Fonctions de recherche manquantes"
**Solution:** Vérifiez que le fichier de migration a été exécuté complètement

### Problème: "Service créé non trouvé dans la recherche"
**Solutions possibles:**
1. Vérifiez que les signatures d'images sont générées
2. Vérifiez les logs du backend pour les erreurs
3. Vérifiez que la fonction `search_similar_images` fonctionne
4. Testez avec un seuil de similarité plus bas

### Problème: "Backend non accessible"
**Solutions:**
1. Vérifiez que le backend est démarré
2. Vérifiez l'URL dans le script (`BASE_URL`)
3. Vérifiez les paramètres de réseau/firewall

## 📝 Logs et débogage

### Vérification des logs du backend
```bash
# Dans le répertoire backend/
tail -f logs/backend.log
```

### Vérification de la base de données
```sql
-- Vérifier la structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position;

-- Vérifier les fonctions
SELECT proname FROM pg_proc 
WHERE proname LIKE '%image%';

-- Vérifier les index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'media' 
AND indexname LIKE '%image%';
```

## 🎯 Résultats attendus

### Test réussi
```
🎉 SUCCÈS: Le test de création et recherche d'images fonctionne correctement!
```

### Test échoué
```
❌ ÉCHEC: Le service créé n'a pas été trouvé dans la recherche
```

## 🔄 Réexécution des tests

Pour réexécuter les tests :
1. Supprimez le service de test créé (optionnel)
2. Relancez `python test_image_search.py`

## 📞 Support

En cas de problème :
1. Vérifiez les logs du backend
2. Vérifiez l'état de la base de données
3. Consultez la documentation de Yukpo
4. Vérifiez que toutes les migrations sont appliquées

---

**Note:** Ces scripts sont conçus pour tester l'infrastructure de recherche d'images. Ils créent des données de test qui peuvent être supprimées après utilisation. 