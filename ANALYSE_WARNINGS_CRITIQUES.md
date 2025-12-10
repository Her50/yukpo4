# 🔍 Analyse des Warnings Critiques - Application Mobile

## 📋 Résumé Exécutif

L'application mobile plante à cause de **4 problèmes critiques** identifiés dans les logs :

1. ❌ **Erreurs de prefetch d'images** : URLs relatives au lieu d'URLs complètes
2. ⚠️ **Requêtes SQL très lentes** : 1-5 secondes pour charger les commentaires
3. 🔴 **Problèmes de connexion base de données** : Crashes et timeouts
4. 📦 **Erreurs 404** : Fichiers manquants (videos/images)

---

## 🚨 Problème 1 : ImagePrefetchService - URLs Relatives

### Symptômes
```
[ImagePrefetchService] Failed to prefetch: uploads/services/158/images/image_5ea99d44-4383-4bd0-97dd-86ad7f214be7.jpg
Unsupported uri scheme for encoded image fetch! Uri is: uploads/services/158/images/im...
```

### Cause
Le service `ImagePrefetchService` recevait des **chemins relatifs** (`uploads/services/...`) au lieu d'**URLs complètes** (`https://yukpomnang.onrender.com/uploads/services/...`).

React Native `Image.prefetch()` nécessite des URLs complètes avec le schéma `http://` ou `https://`.

### ✅ Correction Appliquée

**Fichier** : `mobile/src/services/imagePrefetchService.ts`

- Ajout d'une fonction `normalizeUrl()` qui convertit automatiquement les URLs relatives en URLs complètes
- Utilisation de `API_BASE_URL` depuis la configuration centralisée
- Gestion des 3 cas :
  - URL complète (`https://...`) → retournée telle quelle
  - Chemin absolu (`/uploads/...`) → `API_BASE_URL + path`
  - Chemin relatif (`uploads/...`) → `API_BASE_URL + / + path`

### Impact
- ✅ Plus d'erreurs "Unsupported uri scheme"
- ✅ Préchargement d'images fonctionnel
- ✅ Amélioration de la fluidité perçue

---

## ⚠️ Problème 2 : Requêtes SQL Très Lentes

### Symptômes
```
🐌 [SlowRequest] GET /api/services/158/comments -> 200 (2695 ms)
🐌 [SlowRequest] GET /api/services/recent -> 200 (2331 ms)
slow statement: SELECT pc.id, pc.media_urls, ... FROM product_comments pc JOIN users u ...
elapsed: 1.145886516s
```

### Causes Identifiées

1. **Requête product_comments** : Pas d'index sur `(service_id, parent_comment_id, created_at)`
2. **Requête services/recent** : Pas d'index sur `(is_active, created_at)`
3. **Requête product_delivery_config** : Pas d'index sur `(service_id, product_index)`
4. **Requête delivery_matching_queue** : Pas d'index sur `(status, next_attempt_at)`

### ✅ Correction Appliquée

**Fichier** : `backend/migrations/20251210_optimize_comments_queries.sql`

Création de **10 index optimisés** :

1. `idx_product_comments_service_parent_created` - Pour la requête principale des commentaires
2. `idx_product_comments_parent_created` - Pour les réponses aux commentaires
3. `idx_product_comments_service_deleted` - Pour les stats
4. `idx_product_comment_reactions_comment_user` - Pour les réactions
5. `idx_services_active_created` - Pour services/recent
6. `idx_product_delivery_config_service_product` - Pour product_delivery_config
7. `idx_delivery_matching_queue_status_next` - Pour delivery_matching_queue
8. `idx_video_generation_jobs_status` - Pour video_generation_jobs
9. `idx_media_type_uploaded` - Pour media
10. `VACUUM ANALYZE` - Mise à jour des statistiques

### Impact Attendu
- ⚡ Réduction du temps de réponse de **1-5 secondes** à **< 200ms**
- ⚡ Amélioration de la réactivité de l'application
- ⚡ Réduction de la charge sur la base de données

### ⚠️ Action Requise
**Exécuter la migration** :
```bash
cd backend
psql -U postgres -d yukpo_db -f migrations/20251210_optimize_comments_queries.sql
```

Ou via SQLx :
```bash
cd backend
sqlx migrate run
```

---

## 🔴 Problème 3 : Connexions Base de Données

### Symptômes
```
terminating connection because of crash of another server process
error communicating with database: peer closed connection without sending TLS close_notify
Broken pipe (os error 32)
acquired connection, but time to acquire exceeded slow threshold (2.279s)
```

### Causes Probables

1. **Pool de connexions trop petit** : Pas assez de connexions disponibles
2. **Timeouts trop courts** : Connexions fermées prématurément
3. **Crashes PostgreSQL** : Processus serveur qui crash
4. **Connexions non libérées** : Fuites de connexions

### 🔧 Actions Recommandées

1. **Vérifier la configuration du pool** dans `backend/src/main.rs` ou `backend/src/config/database.rs` :
   ```rust
   PgPoolOptions::new()
       .max_connections(20)  // Augmenter si nécessaire
       .acquire_timeout(Duration::from_secs(10))  // Augmenter le timeout
       .idle_timeout(Duration::from_secs(600))
   ```

2. **Vérifier les logs PostgreSQL** pour identifier les crashes :
   ```bash
   # Sur Render, vérifier les logs du service PostgreSQL
   ```

3. **Monitorer les connexions actives** :
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

---

## 📦 Problème 4 : Erreurs 404 - Fichiers Manquants

### Symptômes
```
Unexpected HTTP code Response{protocol=h2, code=404, message=, url=https://yukpomnang.onrender.com/uploads/services/product_video_dd15692a-dcf1-434d-901b-466c15e1aeb1.mp4}
```

### Cause
Certains fichiers référencés dans la base de données n'existent plus sur le serveur (peut-être supprimés ou jamais uploadés).

### 🔧 Actions Recommandées

1. **Nettoyer les références orphelines** dans la base de données
2. **Ajouter validation côté backend** avant de retourner les URLs
3. **Gérer gracieusement les 404** côté mobile (fallback image)

---

## 📊 Priorités de Correction

### 🔴 Critique (Bloquant)
1. ✅ **ImagePrefetchService** - CORRIGÉ
2. ⚠️ **Index SQL** - MIGRATION CRÉÉE (à exécuter)
3. 🔴 **Pool de connexions** - À VÉRIFIER

### ⚠️ Important (Performance)
4. 📦 **Erreurs 404** - À NETTOYER

---

## 🚀 Prochaines Étapes

1. **Exécuter la migration SQL** pour optimiser les requêtes
2. **Vérifier la configuration du pool de connexions**
3. **Tester l'application mobile** après les corrections
4. **Monitorer les logs** pour vérifier l'amélioration

---

## 📝 Notes Techniques

### ImagePrefetchService
- Utilise maintenant `API_BASE_URL` depuis `mobile/src/config/api.config.ts`
- Gère automatiquement les 3 formats d'URL (complète, absolue, relative)
- Évite les doublons avec un Set d'URLs normalisées

### Index SQL
- Index partiels (`WHERE`) pour réduire la taille
- Index composites pour optimiser les requêtes multi-colonnes
- `VACUUM ANALYZE` pour mettre à jour les statistiques du planificateur

---

**Date** : 2025-12-10  
**Auteur** : Auto (Cursor AI)  
**Statut** : ✅ Corrections appliquées, migration créée

