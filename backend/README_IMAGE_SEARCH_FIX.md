# CORRECTION DE LA RECHERCHE D'IMAGES

## Problème identifié
La recherche d'images ne fonctionne pas car la table `media` n'a pas les colonnes nécessaires :
- `image_signature` (JSONB) - Signature vectorielle de l'image
- `image_hash` (VARCHAR) - Hash MD5 de l'image
- `image_metadata` (JSONB) - Métadonnées de l'image

## Solution

### 1. Appliquer les corrections SQL
Exécutez le script `simple_fix.sql` dans votre base de données `yukpo_db` :

**Option A: Avec psql (ligne de commande)**
```bash
psql -h localhost -U postgres -d yukpo_db -f simple_fix.sql
```

**Option B: Avec pgAdmin**
- Ouvrez pgAdmin
- Connectez-vous à votre base de données `yukpo_db`
- Ouvrez l'éditeur SQL
- Copiez-collez le contenu de `simple_fix.sql`
- Exécutez le script

**Option C: Avec DBeaver ou autre client SQL**
- Ouvrez votre client SQL
- Connectez-vous à `yukpo_db`
- Exécutez le contenu de `simple_fix.sql`

### 2. Vérifier les corrections
Exécutez le script de test `test_simple.sql` pour vérifier que tout fonctionne :

```bash
psql -h localhost -U postgres -d yukpo_db -f test_simple.sql
```

### 3. Redémarrer le serveur
Après avoir appliqué les corrections SQL, redémarrez votre serveur Rust :

```bash
cargo run --features image_search
```

## Fichiers fournis

- `simple_fix.sql` - Script SQL pour corriger la table media
- `test_simple.sql` - Script de test pour vérifier les corrections
- `apply_simple_fix.ps1` - Script PowerShell avec instructions
- `fix_image_search.ps1` - Script PowerShell principal

## Vérification

Après les corrections, vous devriez voir :
- 3 nouvelles colonnes dans la table `media`
- La fonction `search_images_by_metadata` fonctionnelle
- L'endpoint `/api/image-search/search` qui retourne des résultats

## Structure finale de la table media

```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    media_type TEXT,
    file_size BIGINT,
    file_format TEXT,
    image_signature JSONB,        -- NOUVEAU
    image_hash VARCHAR(64),       -- NOUVEAU
    image_metadata JSONB          -- NOUVEAU
);
```

## Index créés

- `idx_media_image_signature` - Index GIN sur image_signature
- `idx_media_image_hash` - Index sur image_hash
- `idx_media_image_metadata` - Index GIN sur image_metadata
- `idx_media_type_image` - Index partiel sur type = 'image'

## Fonctions PostgreSQL

- `calculate_image_similarity(sig1, sig2)` - Calcule la similarité entre signatures
- `search_images_by_metadata(metadata, max_results)` - Recherche par métadonnées

## Test de la fonctionnalité

1. **Upload d'image** : `/api/image-search/upload` ✅ (fonctionne déjà)
2. **Recherche par métadonnées** : `/api/image-search/search` 🔧 (à corriger)
3. **Traitement des images existantes** : `/api/image-search/process-existing` 🔧 (à corriger)

## Dépannage

Si vous rencontrez des erreurs :

1. **Vérifiez que les colonnes existent** :
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'media' AND column_name LIKE 'image_%';
```

2. **Vérifiez que les fonctions existent** :
```sql
SELECT proname FROM pg_proc 
WHERE proname IN ('search_images_by_metadata', 'calculate_image_similarity');
```

3. **Testez la fonction directement** :
```sql
SELECT * FROM search_images_by_metadata(
    '{"format": "jpeg", "width": 800, "height": 600, "file_size": 102400}',
    5
);
```

## Support

Si vous avez des questions ou des problèmes, vérifiez :
1. Que le script SQL s'est exécuté sans erreur
2. Que toutes les colonnes et fonctions ont été créées
3. Que le serveur a été redémarré avec la feature `image_search` 