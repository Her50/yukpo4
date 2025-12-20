# 🔧 INSTRUCTIONS - CORRECTION PROBLÈME RECHERCHE

## ⚠️ IMPORTANT
**Ne PAS créer d'index supplémentaires** - Il y a déjà plus de 23 index pour la recherche.

Ce correctif corrige **UNIQUEMENT** la fonction GPS qui cause l'erreur de structure.

---

## 📋 Problème identifié

Erreur dans les logs :
```
[NativeSearch] ⚠️ Erreur structure requête GPS - Fallback vers recherche sans GPS. 
Erreur: error returned from database: structure of query does not match function result type
```

Cette erreur force le fallback vers la requête SQL complexe qui prend 2-4 secondes.

---

## ✅ Solution

### Script SQL créé : `backend/fix_search_performance_issues.sql`

Ce script :
- ✅ Corrige la fonction `search_services_gps_final` avec la bonne signature
- ✅ Utilise les index existants (ne crée AUCUN nouvel index)
- ✅ Version simplifiée et rapide

---

## 🚀 Action à prendre

### Appliquer la correction SQL

```bash
# Se connecter à la DB Render et exécuter
psql -h your-render-db-host.render.com \
     -U yukpo_db_user \
     -d yukpo_db \
     -f backend/fix_search_performance_issues.sql
```

**OU** via le dashboard Render :
1. Aller dans votre instance PostgreSQL
2. Onglet "Connect"
3. Copier-coller le contenu de `backend/fix_search_performance_issues.sql`
4. Exécuter

---

## ✅ Vérification après correction

```sql
-- 1. Vérifier que la fonction existe avec la bonne signature
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_services_gps_final'
AND n.nspname = 'public';

-- 2. Tester la fonction
SELECT * FROM search_services_gps_final('vêtements', '4.0301206,9.818945', 50, 20);
```

---

## 📊 Résultats attendus

- ✅ Plus d'erreur "structure mismatch"
- ✅ Recherche GPS fonctionne correctement
- ✅ Pas de fallback vers requête SQL lente
- ✅ Temps de réponse < 500ms

---

*Date : 2025-11-30*
