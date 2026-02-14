# 🔍 Vérification Complète - Tables, Index et Fonctions

**Date**: 2026-02-13  
**Objectif**: Vérifier que TOUTES les tables, index et fonctions sont créés

---

## ✅ **VÉRIFICATION COMPLÈTE**

La vérification précédente ne montrait que les 4 tables critiques. Vérifions le nombre total :

### 1. Nombre Total de Tables

```bash
psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as total_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
"
```

### 2. Liste de Toutes les Tables (premières 50)

```bash
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
    LIMIT 50;
"
```

### 3. Nombre Total d'Index

```bash
psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as total_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public';
"
```

### 4. Nombre Total de Fonctions

```bash
psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as total_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public';
"
```

### 5. Vérifier les Extensions Installées

```bash
psql "$DATABASE_URL" -c "
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname IN ('uuid-ossp', 'pgvector', 'postgis', 'pg_trgm', 'unaccent');
"
```

---

## 📊 **RÉSULTAT ATTENDU**

D'après les migrations, vous devriez avoir :
- **Plus de 100 tables** (pas seulement 4)
- **Plusieurs centaines d'index**
- **Plusieurs dizaines de fonctions**
- **Extensions**: uuid-ossp, pgvector, postgis, pg_trgm, unaccent

---

## ⚠️ **SI LE NOMBRE EST FAIBLE**

Si le nombre total de tables est faible (moins de 50), cela signifie que certaines migrations ont échoué silencieusement.

**Solution**: Réappliquer les migrations qui ont échoué, ou appliquer la migration 0 complète.

---

**Exécutez ces commandes de vérification et dites-moi les résultats !**

