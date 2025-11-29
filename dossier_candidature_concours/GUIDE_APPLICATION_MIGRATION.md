# Guide d'Application de la Migration - Index tsvector

## 📋 Contexte

Vous avez mentionné qu'il y a déjà beaucoup d'index créés pour régler le problème de performance. Ce guide vous permet de :
1. ✅ Vérifier les index existants AVANT d'appliquer la migration
2. ✅ Appliquer la migration de manière sécurisée (évite les doublons)
3. ✅ Comprendre quels index seront créés

---

## 🔍 Étape 1 : Vérifier les Index Existants

### Option A : Via SQL direct

Connectez-vous à votre base de données et exécutez :

```sql
-- Voir tous les index sur services
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
ORDER BY indexname;
```

### Option B : Via le script fourni

```bash
# Linux/Mac
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com \
     -U yukpo_db_user \
     -d yukpo_db \
     -f backend/scripts/check_existing_indexes.sql
```

```powershell
# Windows PowerShell
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com `
     -U yukpo_db_user `
     -d yukpo_db `
     -f backend/scripts/check_existing_indexes.sql
```

---

## ✅ Étape 2 : Comprendre la Migration

### Index qui seront créés (si n'existent pas déjà)

La migration `20251129_001_optimize_search_tsvector_performance.sql` crée **5 nouveaux index tsvector** :

1. **`idx_services_titre_service_tsvector`**
   - Type : GIN tsvector
   - Sur : `data->'titre_service'->>'valeur'` et `data->>'titre_service'`
   - Objectif : Recherche rapide dans les titres

2. **`idx_services_description_tsvector`**
   - Type : GIN tsvector
   - Sur : `data->'description'->>'valeur'`, `data->>'description'`, `data->'description_service'->>'valeur'`
   - Objectif : Recherche rapide dans les descriptions

3. **`idx_services_category_tsvector`**
   - Type : GIN tsvector
   - Sur : `category`, `data->'category'->>'valeur'`, `data->>'category'`
   - Objectif : Recherche rapide dans les catégories

4. **`idx_services_search_combined_tsvector`**
   - Type : GIN tsvector (conditionné `WHERE is_active = true`)
   - Sur : Titre + Description + Category combinés
   - Objectif : Recherche globale rapide

5. **`idx_services_products_tsvector`**
   - Type : GIN tsvector (conditionné `WHERE is_active = true`)
   - Sur : Produits extraits via fonction `extract_product_search_text()`
   - Objectif : Recherche rapide dans les produits

### Sécurité : Vérification d'existence

**✅ La migration vérifie l'existence de chaque index AVANT de le créer.**

Si un index existe déjà, il sera **ignoré** (pas d'erreur, pas de doublon).

Exemple dans la migration :
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_titre_service_tsvector'
    ) THEN
        CREATE INDEX idx_services_titre_service_tsvector ...
    ELSE
        RAISE NOTICE 'Index existe déjà, ignoré';
    END IF;
END $$;
```

---

## 🚀 Étape 3 : Appliquer la Migration

### Option A : Via sqlx migrate (recommandé)

```bash
cd backend
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
sqlx migrate run
```

### Option B : Via script sécurisé

```bash
# Linux/Mac
cd backend/scripts
chmod +x apply_migration_safe.sh
./apply_migration_safe.sh
```

```powershell
# Windows PowerShell
cd backend/scripts
.\apply_migration_safe.ps1
```

### Option C : Via psql direct

```bash
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com \
     -U yukpo_db_user \
     -d yukpo_db \
     -f backend/migrations/20251129_001_optimize_search_tsvector_performance.sql
```

```powershell
# Windows PowerShell
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com `
     -U yukpo_db_user `
     -d yukpo_db `
     -f backend/migrations/20251129_001_optimize_search_tsvector_performance.sql
```

---

## 📊 Étape 4 : Vérifier les Résultats

Après application, vérifiez que les index ont été créés :

```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexname LIKE '%tsvector%'
ORDER BY indexname;
```

Vous devriez voir les 5 index listés ci-dessus.

---

## ⚠️ Index Existants vs Nouveaux

### Index tsvector existants possibles

Si vous avez déjà des index tsvector, ils peuvent être :
- **Complémentaires** : Différents champs → Pas de conflit
- **Similaires** : Mêmes champs mais structure différente → La migration vérifie et ignore si existe déjà

### Index trigram existants

Les index trigram (pg_trgm) sont **différents** des index tsvector :
- **Trigram** : Pour fautes de frappe, similarité de chaînes
- **tsvector** : Pour recherche full-text avec stemming, variantes

**Ils sont complémentaires et peuvent coexister !**

---

## 🔧 Dépannage

### Erreur : "Index already exists"

**Solution** : C'est normal, la migration vérifie et ignore. Vérifiez les logs pour voir quels index ont été ignorés.

### Erreur : "Permission denied"

**Solution** : Vérifiez que l'utilisateur `yukpo_db_user` a les permissions `CREATE INDEX`.

### Erreur : "Extension pg_trgm not found"

**Solution** : Les index tsvector n'utilisent PAS pg_trgm, ils utilisent le full-text search natif PostgreSQL. Pas besoin de pg_trgm pour cette migration.

### Migration prend trop de temps

**Solution** : La création d'index GIN peut prendre du temps sur une grande table. C'est normal. Surveillez les logs PostgreSQL.

---

## 📈 Performance Attendue

Après application de la migration :

- **Recherche Full-Text** : < 500ms (objectif)
- **Utilisation index tsvector** : Automatique via `to_tsvector()` dans les requêtes
- **Pas d'impact négatif** : Les index existants restent actifs

---

## ✅ Checklist Finale

- [ ] Vérifié les index existants
- [ ] Appliqué la migration
- [ ] Vérifié que les 5 nouveaux index tsvector existent
- [ ] Testé une recherche pour vérifier performance
- [ ] Vérifié les logs backend pour confirmer utilisation des index

---

**Questions ?** Consultez `CLARIFICATION_CORRESPONDANCES_EXACTES.md` pour comprendre comment les correspondances exactes s'intègrent avec la gestion des erreurs de frappe.

