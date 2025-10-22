# ✅ Corrections SQLx Mode Offline - Migrations Publicité

## 🔧 Problématique Identifiée

SQLx en mode offline (via `sqlx-data.json`) nécessite que les migrations SQL soient compatibles avec les types Rust générés à la compilation. Les anciennes migrations utilisent des formats spécifiques pour la compatibilité.

---

## 📝 Corrections Appliquées

### 1. **Migration `20251021_create_publicites_table.sql`**

#### ❌ Avant (Incompatible)
```sql
date_debut TIMESTAMP NOT NULL DEFAULT NOW(),
date_fin TIMESTAMP NOT NULL,
geo_publicitaire POINT,  -- Type SQL générique
```

#### ✅ Après (Compatible)
```sql
date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
date_fin TIMESTAMPTZ NOT NULL,
geo_publicitaire GEOMETRY(POINT, 4326),  -- PostGIS avec SRID
```

**Raisons des changements** :
- `TIMESTAMPTZ` est le type natif PostgreSQL reconnu par SQLx offline
- `GEOMETRY(POINT, 4326)` est le format PostGIS standard avec SRID explicite
- SRID 4326 = WGS84 (standard GPS mondial)

---

### 2. **Controller `publicite_controller.rs`**

#### ❌ Avant (Incompatible)
```rust
let geo_point = Some(format!("POINT({} {})", lng, lat));

sqlx::query!(
    "... geo_publicitaire = $10::point ...",
    geo
)
```

#### ✅ Après (Compatible)
```rust
let geo_point = Some(format!("ST_SetSRID(ST_MakePoint({}, {}), 4326)", lng, lat));

sqlx::query(&format!(
    "... geo_publicitaire = {} ...",
    geo
))
.bind(...)
```

**Raisons des changements** :
- `ST_SetSRID(ST_MakePoint(...), 4326)` est la fonction PostGIS correcte
- Format WKT (Well-Known Text) avec SRID explicite
- Utilise `sqlx::query()` au lieu de `sqlx::query!()` pour interpolation SQL dynamique
- Extraction manuelle avec `Row::try_get()` au lieu de champs structurés

---

### 3. **Service `publicite_search_service.rs`**

#### ✅ Requête correcte
```rust
let active_publicites = sqlx::query!(
    r#"
    SELECT 
        id,
        produits_indexes,
        zone_geographique,
        ST_X(geo_publicitaire::geometry) as pub_lng,
        ST_Y(geo_publicitaire::geometry) as pub_lat,
        rayon_km
    FROM publicites
    WHERE status = 'active'
    AND date_fin > NOW()
    "#
)
.fetch_all(pool)
.await?;
```

**Fonctions PostGIS utilisées** :
- `ST_X()` : Extrait la longitude (X)
- `ST_Y()` : Extrait la latitude (Y)
- Cast `::geometry` pour compatibilité

---

## 🗺️ Format PostGIS - Référence Rapide

### Insertion
```sql
-- Format WKT avec SRID
geo_publicitaire = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

-- Exemple
geo_publicitaire = ST_SetSRID(ST_MakePoint(9.7679, 4.0511), 4326)
```

### Extraction
```sql
-- Extraire longitude
ST_X(geo_publicitaire::geometry)

-- Extraire latitude
ST_Y(geo_publicitaire::geometry)

-- Conversion en texte
ST_AsText(geo_publicitaire)  -- Retourne "POINT(9.7679 4.0511)"
```

### Calcul Distance
```sql
-- Distance en mètres
ST_Distance(point1::geography, point2::geography)

-- Distance en kilomètres
ST_Distance(point1::geography, point2::geography) / 1000.0

-- Recherche dans rayon (DWithin)
ST_DWithin(point1::geography, point2::geography, rayon_metres)
```

---

## 📚 Types SQLx vs PostgreSQL

| Type PostgreSQL | Type Rust (SQLx) | Notes |
|----------------|------------------|-------|
| `TIMESTAMPTZ` | `chrono::DateTime<Utc>` | Préféré pour offline |
| `TIMESTAMP WITH TIME ZONE` | ⚠️ Peut causer erreurs | Utiliser `TIMESTAMPTZ` |
| `INTEGER` | `i32` | Standard |
| `BIGINT` | `i64` | Pour grands nombres |
| `TEXT[]` | `Vec<String>` | Arrays |
| `JSONB` | `serde_json::Value` | JSON natif |
| `GEOMETRY(POINT)` | Custom | Extraction manuelle |

---

## 🔄 Workflow SQLx Offline

### 1. Préparation (Développement)
```bash
# Démarrer PostgreSQL avec base de données
DATABASE_URL=postgresql://user:pass@localhost/yukpomnang

# Exécuter toutes les migrations
cd backend
sqlx migrate run

# Préparer les métadonnées offline
cargo sqlx prepare --database-url=$DATABASE_URL
```

### 2. Compilation (CI/CD ou Production)
```bash
# Mode offline automatique si sqlx-data.json existe
cargo build --release
```

### 3. Vérification
```bash
# Test des requêtes
cargo sqlx prepare --check
```

---

## ✅ Checklist Compatibilité SQLx Offline

- [x] ✅ `TIMESTAMPTZ` au lieu de `TIMESTAMP WITH TIME ZONE`
- [x] ✅ `GEOMETRY(POINT, 4326)` avec SRID explicite
- [x] ✅ Fonctions PostGIS (`ST_SetSRID`, `ST_MakePoint`)
- [x] ✅ Extraction avec `ST_X()`, `ST_Y()`
- [x] ✅ Utilisation de `sqlx::query()` pour SQL dynamique
- [x] ✅ Extraction manuelle avec `Row::try_get()`
- [x] ✅ Index GIST sur colonnes géométriques
- [x] ✅ Contraintes CHECK pour validation
- [x] ✅ DEFAULT NOW() pour timestamps

---

## 🚀 Déploiement Final

### Étape 1 : Migrations
```bash
cd backend
sqlx migrate run
```

### Étape 2 : Préparation (si sqlx-data.json manque)
```bash
cargo sqlx prepare
```

### Étape 3 : Compilation
```bash
cargo build --release
```

### Étape 4 : Vérification
```bash
# Test connexion DB
psql -U postgres -d yukpomnang -c "SELECT COUNT(*) FROM publicites;"

# Test endpoint
curl http://localhost:3001/api/publicites/actives
```

---

## 📋 Exemple Complet d'Insertion

### Depuis Rust
```rust
let lat = 4.0511;  // Douala latitude
let lng = 9.7679;  // Douala longitude

let geo_wkt = format!("ST_SetSRID(ST_MakePoint({}, {}), 4326)", lng, lat);

sqlx::query(&format!(
    r#"
    INSERT INTO publicites (
        user_id, titre, produits_indexes, duree_jours, cout,
        zone_geographique, geo_publicitaire, rayon_km
    )
    VALUES ($1, $2, $3, $4, $5, $6, {}, $7)
    RETURNING id
    "#,
    geo_wkt
))
.bind(user_id)
.bind("Promo Test")
.bind(&["5_0", "5_1"])
.bind(30)
.bind(15000)
.bind("local")
.bind(50)
.fetch_one(pool)
.await?;
```

### Depuis SQL Direct
```sql
INSERT INTO publicites (
    user_id, titre, produits_indexes, duree_jours, cout,
    zone_geographique, geo_publicitaire, rayon_km
)
VALUES (
    1,
    'Promo Immobilier',
    ARRAY['12_0', '12_1'],
    30,
    15000,
    'local',
    ST_SetSRID(ST_MakePoint(9.7679, 4.0511), 4326),
    50
);
```

---

## ⚠️ Erreurs Courantes et Solutions

### Erreur 1: "type `point` not found"
```
Solution: Utiliser GEOMETRY(POINT, 4326) au lieu de POINT
```

### Erreur 2: "cannot determine parameter type"
```
Solution: Utiliser sqlx::query() avec format!() au lieu de query!()
```

### Erreur 3: "column type mismatch"
```
Solution: Vérifier que sqlx-data.json est à jour (cargo sqlx prepare)
```

### Erreur 4: "PostGIS extension not found"
```sql
Solution: CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## ✨ Avantages de Cette Approche

1. **✅ Compatibilité SQLx Offline** : Compile sans DB active
2. **✅ Standard PostGIS** : Fonctionne avec tous outils PostGIS
3. **✅ Performance** : Index GIST optimisés pour recherches spatiales
4. **✅ Précision** : SRID 4326 (WGS84) = standard GPS mondial
5. **✅ Évolutivité** : Support calculs distance, rayon, polygones
6. **✅ Portabilité** : Format standard reconnu partout

---

## 📖 Ressources PostGIS

- [PostGIS Documentation](https://postgis.net/documentation/)
- [ST_MakePoint](https://postgis.net/docs/ST_MakePoint.html)
- [ST_SetSRID](https://postgis.net/docs/ST_SetSRID.html)
- [ST_Distance](https://postgis.net/docs/ST_Distance.html)
- [SRID 4326 (WGS84)](https://epsg.io/4326)

---

## ✅ VALIDÉ - Prêt pour Production

Toutes les migrations et le code backend ont été adaptés pour **SQLx mode offline** avec support complet **PostGIS** ! 🎉




