# 🔧 Correction erreur SQL recherche directe

## 🔍 Problème détecté

**Erreur SQL** : `bind message supplies 3 parameters, but prepared statement "sqlx_s_1" requires 4`

### Symptômes

1. ✅ **Autocomplete fonctionne** : 2 résultats trouvés
2. ❌ **Recherche directe échoue** : 0 résultats à cause de l'erreur SQL
3. ❌ **ResultatBesoinScreen n'affiche rien** : Pas de résultats à afficher

### Logs backend

```
[ERREUR] [NativeSearch] Erreur recherche GPS optimisée: error returned from database: 
bind message supplies 3 parameters, but prepared statement "sqlx_s_1" requires 4

[RECHERCHE_DIRECTE] Échec recherche native: ... Utilisation du fallback SQL.
[RECHERCHE_DIRECTE] Fallback SQL réussi avec 0 résultats
[RECHERCHE_DIRECTE] 0 résultats convertis
```

---

## 🔧 Correction apportée

**Fichier** : `backend/src/services/native_search_service.rs`  
**Lignes** : ~819-823, ~1286-1290, ~1506-1510

### Problème

La fonction PostgreSQL `search_services_gps_final` attend **4 paramètres** :
1. `search_query text`
2. `user_gps_zone text`
3. `radius_km integer DEFAULT 50`
4. `max_results integer DEFAULT 100`

Mais seulement **3 paramètres** étaient bindés dans le code Rust :
```rust
.bind(query)        // $1
.bind(gps_zone_val) // $2
.bind(radius)        // $3
// ❌ MANQUE : $4 (max_results)
```

### Solution

Ajout du 4ème paramètre `max_results = 100` dans tous les appels :

```rust
let results = sqlx::query(sql)
    .bind(query)
    .bind(gps_zone_val)
    .bind(radius)
    .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
    .fetch_all(&self.pool)
```

**3 occurrences corrigées** :
1. Ligne ~819 : Recherche full-text avec GPS
2. Ligne ~1286 : Recherche trigram avec GPS
3. Ligne ~1506 : Recherche mots-clés avec GPS

---

## ✅ Résultat attendu

Après correction :

1. ✅ La recherche GPS optimisée fonctionne correctement
2. ✅ Les résultats sont retournés (au lieu de 0)
3. ✅ ResultatBesoinScreen affiche les résultats
4. ✅ Pas besoin d'utiliser le fallback SQL

---

## 📊 Structure de réponse

La réponse de `/api/search/direct` est :

```json
{
  "status": "success",
  "intention": "recherche_besoin",
  "resultats": [...],
  "nombre_matchings": 2,
  "message": "Recherche directe PostgreSQL réussie",
  ...
}
```

La fonction `extractSearchResults` dans `ResultatBesoinScreen.tsx` cherche dans :
- `data?.resultats?.resultats` ✅
- `data?.resultats` ✅ (trouvera ici)
- `data?.data`
- `data?.items`

Donc la structure est **compatible** avec `extractSearchResults`.

---

## 🎯 Conclusion

**Le problème principal était l'erreur SQL** (paramètres manquants). Une fois corrigé, la recherche devrait fonctionner et ResultatBesoinScreen devrait afficher les résultats.

**Action requise** : Redémarrer le backend pour que les corrections prennent effet.

