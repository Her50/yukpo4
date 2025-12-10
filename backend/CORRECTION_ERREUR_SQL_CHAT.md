# 🔧 Correction de l'erreur SQL: `column u_client.name does not exist`

**Date:** 2025-12-10  
**Erreur:** `column u_client.name does not exist`  
**Position:** `chat_routes.rs:229` (ligne 124 dans la requête SQL)

## 🔍 Analyse

L'erreur indique que la requête SQL essaie d'accéder à `u_client.name` mais cette colonne n'existe pas dans la table `users`. Le hint PostgreSQL suggère d'utiliser `u_client.nom` à la place.

**Requête actuelle (ligne 166):**
```sql
COALESCE(u_client.nom_complet, u_client.email, 'Client') as client_name,
```

Cette requête est **correcte** et utilise `nom_complet`, pas `name`.

## 🚨 Problème probable

L'erreur pourrait venir de :
1. **Cache SQLx obsolète** - Le cache `.sqlx/` pourrait contenir une ancienne version de la requête
2. **Requête SQL générée dynamiquement** - Une autre partie du code pourrait générer une requête avec `.name`
3. **Vue SQL ou fonction** - Une vue matérialisée ou fonction SQL pourrait utiliser `.name`

## ✅ Solutions appliquées

1. ✅ Cache SQLx régénéré avec `cargo sqlx prepare -- --lib`
2. ✅ Vérification de toutes les requêtes SQL dans `chat_routes.rs` - toutes utilisent `nom_complet`
3. ✅ Vérification des migrations - aucune référence à `u_client.name` trouvée

## 🔧 Action recommandée

Si l'erreur persiste après la régénération du cache, vérifier :

1. **Vérifier le cache SQLx:**
   ```bash
   cd backend
   $env:DATABASE_URL="postgresql://..."
   cargo sqlx prepare --check -- --lib
   ```

2. **Vérifier s'il y a une vue SQL:**
   ```sql
   SELECT definition FROM pg_views WHERE definition LIKE '%u_client.name%';
   ```

3. **Vérifier s'il y a une fonction SQL:**
   ```sql
   SELECT prosrc FROM pg_proc WHERE prosrc LIKE '%u_client.name%';
   ```

4. **Vérifier les triggers:**
   ```sql
   SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE pg_get_triggerdef(oid) LIKE '%u_client.name%';
   ```

## 📝 Note

L'erreur pourrait aussi venir d'une **requête SQL générée dynamiquement** dans un autre fichier qui n'a pas été trouvé lors de la recherche. Il faudrait vérifier tous les fichiers qui génèrent des requêtes SQL dynamiquement.

