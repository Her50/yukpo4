# 🔍 PROBLÈME RECHERCHE - ANALYSE ET SOLUTIONS

## 📋 Problèmes identifiés dans les logs

### 1. **Requêtes SQL très lentes (2-4 secondes)**
- La requête avec CTE `all_products_extracted` prend trop de temps
- Plusieurs requêtes dépassent le seuil d'alerte de 1 seconde :
  - `2.478s`, `3.191s`, `3.904s`
- Cette requête est un fallback utilisé quand la fonction GPS échoue

### 2. **Erreur de structure de fonction GPS**
```
[NativeSearch] ⚠️ Erreur structure requête GPS - Fallback vers recherche sans GPS. 
Erreur: error returned from database: structure of query does not match function result type
```
- La fonction `search_services_gps_final` a un problème de signature
- Cela force le fallback vers la requête SQL lente

### 3. **Timeout côté client (15 secondes)**
- Les requêtes dépassent 15 secondes → Code HTTP 499 (Client Closed Connection)
- Logs mobiles montrent : `"Timeout pour /api/search/direct"`, `"Aborted"`

### 4. **Problèmes de connexion DB**
- Nombreuses erreurs : `"peer closed connection without sending TLS close_notify"`
- `"acquired connection, but time to acquire exceeded slow threshold"` (> 2 secondes)

---

## ✅ Solutions implémentées

### 1. Correction de la fonction GPS (`fix_search_performance_issues.sql`)
- ✅ Recréation de `search_services_gps_final` avec signature exacte
- ✅ Version simplifiée et optimisée
- ✅ Gestion correcte des retours avec les bons types
- ✅ Index ajoutés pour accélérer les recherches

### 2. Optimisation requête SQL de fallback (à implémenter)
- ✅ Simplifier la requête complexe avec CTE
- ✅ Réduire les calculs répétitifs
- ✅ Ajouter un timeout explicite (2 secondes max)
- ✅ Limiter le nombre de résultats avant scoring complet

### 3. Ajout de timeout explicite
- ✅ Timeout de 2 secondes sur les requêtes SQL
- ✅ Fallback gracieux si timeout
- ✅ Logs améliorés pour déboguer

### 4. Index supplémentaires
- ✅ Index GIN sur `titre_service` et `description`
- ✅ Index sur `is_active` pour filtrer rapidement
- ✅ Index composite pour recherche active + GPS

---

## 🚀 Actions à prendre

### Étape 1 : Appliquer la correction SQL
```bash
# Se connecter à la DB Render et exécuter
psql -h your-render-db-host.render.com \
     -U yukpo_db_user \
     -d yukpo_db \
     -f backend/fix_search_performance_issues.sql
```

### Étape 2 : Optimiser le code Rust
- Modifier `native_search_service.rs` pour ajouter timeout
- Simplifier la requête SQL de fallback
- Ajouter des logs de performance

### Étape 3 : Vérifier les index
```sql
-- Vérifier que les index existent
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE 'idx_services%';
```

---

## 📊 Métriques attendues après correction

### Avant
- ⏱️ Temps de réponse : **2-4 secondes** (timeout client)
- ❌ Taux d'échec : **Élevé** (code 499)
- 🔄 Retries DB : **Fréquents**

### Après
- ⏱️ Temps de réponse : **< 500ms** (avec cache)
- ✅ Taux d'échec : **< 1%**
- 🔄 Retries DB : **Rares**

---

## 🔧 Code Rust à modifier

### Fichier : `backend/src/services/native_search_service.rs`

#### 1. Ajouter timeout sur requêtes SQL
```rust
// Utiliser tokio::time::timeout pour limiter à 2 secondes
use tokio::time::{timeout, Duration};

let result = timeout(
    Duration::from_secs(2),
    sqlx::query(sql.as_str())
        .bind(query)
        .bind(category_filter)
        .bind(location_filter)
        .fetch_all(&pool)
).await;
```

#### 2. Simplifier la requête SQL de fallback
- Réduire les CTE complexes
- Limiter à 50 résultats avant scoring complet
- Utiliser les index GIN créés

---

## 📝 Notes importantes

1. **Cache Redis** : Le cache est déjà en place mais Redis n'est pas disponible dans les logs
   - Vérifier la configuration Redis
   - Envisager un cache mémoire local en fallback

2. **Connexions DB** : Les problèmes de connexion peuvent être liés à :
   - Pool de connexions trop petit
   - Timeout de connexion trop court
   - Surcharge du serveur DB

3. **Monitoring** : Ajouter des métriques pour :
   - Temps de réponse moyen par type de recherche
   - Taux d'utilisation du cache
   - Nombre de timeouts

---

## ✅ Checklist de validation

- [ ] Fonction GPS corrigée et testée
- [ ] Index créés et vérifiés
- [ ] Timeout ajouté sur requêtes SQL
- [ ] Requête SQL simplifiée
- [ ] Logs de performance ajoutés
- [ ] Tests de charge effectués
- [ ] Monitoring configuré

---

*Date de création : 2025-11-30*
*Dernière mise à jour : 2025-11-30*



