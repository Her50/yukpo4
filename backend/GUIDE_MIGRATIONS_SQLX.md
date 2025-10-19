# 📚 Guide des Migrations SQLx

## 🎯 Qu'est-ce qu'une migration ?

Une migration est un fichier SQL qui modifie la structure de votre base de données de manière **versionnée** et **traçable**.

### Avantages
✅ **Historique** : Toutes les modifications sont enregistrées  
✅ **Reproductible** : Même base de données sur dev, staging, production  
✅ **Reversible** : Possibilité de revenir en arrière  
✅ **Collaborative** : L'équipe travaille avec la même structure

---

## 📁 Structure des migrations

```
backend/migrations/
├── 0000_create_all_tables.sql          # Migration initiale
├── 20250830_002_add_postgis_geospatial.sql  # PostGIS + GPS
├── 20250119_enhance_product_search_gps.sql  # Notre nouvelle migration
└── ...
```

### Format du nom de fichier
```
YYYYMMDD_NNN_description.sql
│        │   └─ Description claire
│        └─ Numéro séquentiel (001, 002...)
└─ Date (pour l'ordre chronologique)
```

---

## 🔧 Comment SQLx gère les migrations

### 1. Table de suivi : `_sqlx_migrations`

SQLx crée automatiquement cette table pour tracer les migrations appliquées :

```sql
CREATE TABLE _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);
```

### 2. Processus d'exécution

```bash
# 1. SQLx lit tous les fichiers .sql dans migrations/
# 2. Calcule un checksum (hash) pour chaque fichier
# 3. Compare avec _sqlx_migrations
# 4. Exécute UNIQUEMENT les nouvelles migrations
# 5. Enregistre le résultat dans _sqlx_migrations
```

---

## 🚀 Commandes SQLx

### Appliquer les migrations

```bash
# Méthode 1 : Via sqlx-cli
cd backend
sqlx migrate run

# Méthode 2 : Via notre script PowerShell
.\reset_sqlx_migrations.ps1
```

### Créer une nouvelle migration

```bash
# Méthode manuelle (recommandée pour nous)
# Créer un fichier : migrations/YYYYMMDD_NNN_description.sql

# Méthode automatique (sqlx-cli)
sqlx migrate add nom_de_la_migration
```

### Vérifier l'état

```bash
# Voir quelles migrations sont appliquées
sqlx migrate info

# Voir le contenu de _sqlx_migrations
psql -U postgres -d yukpomnang -c "SELECT * FROM _sqlx_migrations ORDER BY version;"
```

---

## ⚡ Mode OFFLINE de SQLx

### Problème
Rust avec SQLx vérifie les requêtes SQL **au moment de la compilation**. Cela nécessite :
- ❌ Une connexion à la base de données pendant `cargo build`
- ❌ Que la base soit à jour avec toutes les migrations

### Solution : Mode Offline

SQLx peut générer des **métadonnées** (fichiers `.json` dans `.sqlx/`) qui contiennent les informations de typage **sans avoir besoin de la base de données**.

#### Étape 1 : Préparer les métadonnées

```bash
cd backend

# Appliquer toutes les migrations à la base
sqlx migrate run

# Générer les métadonnées offline
cargo sqlx prepare

# Cela crée des fichiers .json dans .sqlx/ pour chaque requête SQL
```

#### Étape 2 : Compiler en mode offline

```bash
# Définir la variable d'environnement
export SQLX_OFFLINE=true  # Linux/Mac
$env:SQLX_OFFLINE="true"  # PowerShell

# Compiler sans connexion à la base
cargo build --release
```

#### Notre configuration (build.sh)

```bash
# Fichier: backend/build.sh
export SQLX_OFFLINE=true
echo "Mode SQLx: OFFLINE (utilisation des métadonnées .sqlx)"
cargo build --release
```

---

## 🔄 Workflow complet

### Scénario : Ajouter une nouvelle migration

#### 1. Créer la migration

```bash
cd backend/migrations
# Créer le fichier avec la date du jour
nano 20250119_001_ma_nouvelle_feature.sql
```

```sql
-- Contenu de la migration
CREATE TABLE IF NOT EXISTS ma_table (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL
);

CREATE INDEX idx_ma_table_nom ON ma_table(nom);
```

#### 2. Tester localement

```bash
cd backend

# Appliquer la migration
sqlx migrate run

# Vérifier qu'elle est enregistrée
psql -U postgres -d yukpomnang -c "
  SELECT version, description, success 
  FROM _sqlx_migrations 
  ORDER BY installed_on DESC 
  LIMIT 5;
"
```

#### 3. Mettre à jour les métadonnées offline

```bash
# Régénérer les métadonnées avec la nouvelle structure
cargo sqlx prepare

# Cela met à jour les fichiers .sqlx/*.json
```

#### 4. Tester la compilation offline

```bash
# S'assurer que ça compile sans la base
export SQLX_OFFLINE=true
cargo build

# Si erreur : certaines requêtes SQL utilisent la nouvelle structure
# Il faut régénérer les métadonnées (étape 3)
```

#### 5. Commit les changements

```bash
git add migrations/20250119_001_ma_nouvelle_feature.sql
git add .sqlx/*.json  # IMPORTANT : commiter les métadonnées
git commit -m "feat: ajout de ma_nouvelle_feature"
```

---

## ⚠️ Erreurs courantes

### Erreur 1 : "Checksum mismatch"

```
Migration 20250119 has different checksum
```

**Cause** : Le fichier de migration a été modifié APRÈS avoir été appliqué

**Solution** :
```bash
# Supprimer la migration de la table
psql -U postgres -d yukpomnang -c "
  DELETE FROM _sqlx_migrations 
  WHERE version = 20250119;
"

# Réappliquer
sqlx migrate run
```

### Erreur 2 : "Query requires offline mode"

```
error: query ... requires `sqlx-data.json`
```

**Cause** : Les métadonnées offline sont absentes ou obsolètes

**Solution** :
```bash
# Régénérer les métadonnées
cargo sqlx prepare
```

### Erreur 3 : "Cannot connect to database during build"

```
error: error connecting to database: connection refused
```

**Cause** : Mode online actif mais base de données inaccessible

**Solution** :
```bash
# Activer le mode offline
export SQLX_OFFLINE=true
cargo build
```

---

## 📊 État actuel du projet

### Migrations existantes pour GPS

| Fichier | Fonction créée | État |
|---------|----------------|------|
| `20250830_002_add_postgis_geospatial.sql` | `convert_gps_to_geometry()`, `calculate_distance_km()`, `search_services_in_radius()` | ✅ Base GPS |
| `enhance_search_with_products.sql` | `search_services_gps_final()` (basique) | ⚠️ Hors migrations |
| `20250119_enhance_product_search_gps.sql` | `get_best_gps_for_service()`, `calculate_product_relevance_score()`, `search_services_gps_enhanced()` | ✨ **NOUVELLE** |

### Conflit potentiel

Le fichier `enhance_search_with_products.sql` existe **en dehors du dossier migrations/**. Il crée une fonction `search_services_gps_final()` qui recherche seulement dans `product->>'name'`.

Notre nouvelle migration `20250119_enhance_product_search_gps.sql` :
- ✅ Crée des **fonctions helper** distinctes
- ✅ Crée `search_services_gps_enhanced()` (nom différent, pas de conflit)
- ✅ Recherche dans **tous les champs** des produits
- ✅ Ajoute la **priorité GPS du produit**

**Recommandation** : 
```sql
-- Option 1 : Utiliser notre nouvelle fonction
SELECT * FROM search_services_gps_enhanced(...);

-- Option 2 : Migrer enhance_search_with_products.sql vers migrations/
-- et supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS search_services_gps_final(...);
```

---

## 🎯 Pour notre migration spécifique

### Ce qu'elle fait

1. **`get_best_gps_for_service()`**
   - Priorité 1 : GPS des produits immobiliers
   - Priorité 2 : GPS d'autres produits
   - Priorité 3 : GPS fixe du service
   - Fallback : GPS temps réel

2. **`calculate_product_relevance_score()`**
   - Recherche dans 13 champs de produits
   - Scoring pondéré par importance

3. **`search_services_gps_enhanced()`**
   - Recherche GPS + textuelle complète
   - Utilise les 2 fonctions ci-dessus

### Comment l'appliquer

```bash
cd backend

# 1. Appliquer la migration
sqlx migrate run

# 2. Vérifier qu'elle est bien installée
psql -U postgres -d yukpomnang -c "
  SELECT * FROM _sqlx_migrations 
  WHERE description LIKE '%product_search%';
"

# 3. Tester la fonction
psql -U postgres -d yukpomnang -c "
  SELECT * FROM search_services_gps_enhanced(
    'iPhone',           -- Recherche
    '6.3703,2.3912',   -- GPS Cotonou
    10,                 -- Rayon 10km
    20                  -- Max 20 résultats
  );
"

# 4. Régénérer les métadonnées offline
cargo sqlx prepare

# 5. Compiler en mode offline
export SQLX_OFFLINE=true
cargo build
```

---

## 📝 Checklist pour ajouter une migration

- [ ] Créer le fichier avec le bon format de nom
- [ ] Tester la migration localement (`sqlx migrate run`)
- [ ] Vérifier qu'aucune erreur SQL
- [ ] Régénérer les métadonnées (`cargo sqlx prepare`)
- [ ] Tester la compilation offline (`SQLX_OFFLINE=true cargo build`)
- [ ] Commiter le fichier migration + métadonnées `.sqlx/*.json`
- [ ] Documenter dans le README si nouvelle fonctionnalité importante

---

## 🔗 Ressources

- [Documentation SQLx](https://github.com/launchbadge/sqlx)
- [Guide des migrations SQLx](https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md)
- [Mode Offline](https://github.com/launchbadge/sqlx/blob/main/FAQ.md#how-can-i-use-sqlx-without-a-database)

---

**Date de création** : 19 janvier 2025  
**Dernière mise à jour** : 19 janvier 2025

