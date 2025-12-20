# 📋 APPLICATION MANUELLE DE LA MIGRATION SQL

## Date : 2025-11-30

---

## ✅ CODE RUST MODIFIÉ

Tous les appels à `search_services_gps_final()` utilisent maintenant la requête enrichie :
1. ✅ `fulltext_search_with_gps()` - ligne ~957
2. ✅ `trigram_search_with_gps()` - ligne ~1533
3. ✅ `keyword_search_with_gps()` - ligne ~1767

---

## ⏳ MIGRATION SQL À APPLIQUER

**Fichier** : `backend/migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql`

### Option 1 : Via psql (recommandé)

```bash
cd backend
psql "postgresql://user:password@host:port/database" -f migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql
```

### Option 2 : Via sqlx migrate (si pas de conflit)

```bash
cd backend
export DATABASE_URL="postgresql://user:password@host:port/database"
export SQLX_OFFLINE=true
sqlx migrate run
```

### Option 3 : Copier-coller dans psql interactif

1. Ouvrir psql :
```bash
psql "postgresql://user:password@host:port/database"
```

2. Copier le contenu de `migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql`
3. Coller dans psql
4. Vérifier avec :
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'search_services_gps_final';
```

---

## ✅ VÉRIFICATION

Après application, vérifier que la fonction existe :

```sql
-- Vérifier que la fonction existe
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname = 'search_services_gps_final';

-- Tester avec une variation
SELECT * FROM search_services_gps_final('plombier', NULL, 50, 5);
-- Devrait trouver des services avec "plomberie"
```

---

## 📊 RÉSULTAT ATTENDU

Après application complète :
- ✅ "plombier" trouvera "plomberie"
- ✅ "plomberie" trouvera "plombier"
- ✅ "électricien" trouvera "électricité"
- ✅ Fautes de frappe détectées (similarity > 0.6)
- ✅ Troncatures fonctionnelles (ILIKE)
- ✅ Casse ignorée (LOWER)

---

*Guide créé le : 2025-11-30*

