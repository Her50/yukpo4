# 🐧 Instructions SQLx pour Ubuntu Server

## 📋 Problème identifié

Sur le serveur Ubuntu (`root@ubuntu-4gb-fsn1-13:/opt/yukpo#`), le cache SQLx contient **212 fichiers** alors qu'il y a **289 requêtes SQLx** dans le code, soit un **gap de 77 fichiers**.

## 🔧 Solution : Régénération complète du cache

### Option 1: Script automatique (Recommandé)

```bash
cd /opt/yukpo/backend

# Rendre les scripts exécutables
chmod +x fix-sqlx-cache-ubuntu.sh
chmod +x regenerate-sqlx-complete.sh
chmod +x build-docker-ubuntu.sh

# Régénérer le cache complet
./fix-sqlx-cache-ubuntu.sh

# Ou pour une régénération encore plus complète
./regenerate-sqlx-complete.sh
```

### Option 2: Commandes manuelles

```bash
cd /opt/yukpo/backend

# Exporter la DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"
export SQLX_OFFLINE=false

# Régénérer le cache avec TOUTES les options
cargo sqlx prepare --workspace

# Si cela ne capture pas tout, essayer aussi:
cargo sqlx prepare --all
cargo sqlx prepare --all-features --all

# Pour capturer aussi les tests (si ils contiennent des requêtes)
cargo sqlx prepare --tests

# Vérifier le résultat
find .sqlx -type f | wc -l
# Devrait être proche de 289 (moins les duplications)
```

## ✅ Vérification

```bash
# 1. Compter les fichiers dans le cache
find .sqlx -type f | wc -l

# 2. Tester la compilation en mode offline
export SQLX_OFFLINE=true
cargo check --lib

# 3. Si aucune erreur SQLx n'apparaît, le cache est suffisant
```

## 🐳 Build Docker après régénération

```bash
cd /opt/yukpo/backend

# Option 1: Script automatique
./build-docker-ubuntu.sh

# Option 2: Commande directe
docker build -f Dockerfile -t yukpo-backend:latest .
```

## 🔍 Pourquoi le gap existe-t-il ?

Le gap de 77 peut être dû à :

1. **Requêtes dupliquées** : Plusieurs occurrences de la même requête SQL = 1 seul fichier de cache
   - SQLx utilise un hash SHA256 de la requête SQL
   - Même requête = même hash = même fichier de cache

2. **Requêtes dans des fichiers non compilés** :
   - Fichiers `*_backup.rs` : `publicite_search_service_backup.rs`, etc.
   - Tests conditionnels (`#[cfg(test)]`)
   - Binaires avec features conditionnelles

3. **Comptage : macros vs requêtes uniques** :
   - **289** = occurrences de macros `query!()` dans le code
   - **212** = requêtes SQL uniques (après déduplication)

## ✅ Validation finale

**Le cache est suffisant si** :
- ✅ `cargo check --lib` réussit en mode offline
- ✅ `docker build` réussit sans erreur SQLx
- ✅ Aucune erreur "set DATABASE_URL" n'apparaît

**Si ces 3 conditions sont remplies, le gap de 77 est normal et n'est pas un problème.**

## 📝 Après régénération du cache

```bash
# 1. Committez le cache (IMPORTANT pour Docker)
cd /opt/yukpo
git add backend/.sqlx
git commit -m "Update SQLx cache - $(find backend/.sqlx -type f | wc -l) fichiers"

# 2. Rebuild Docker
cd backend
docker build -f Dockerfile -t yukpo-backend:latest .
```

## 🚨 Si le build Docker échoue toujours

1. **Vérifier que le cache est bien copié** :
   ```bash
   # Dans le Dockerfile, vérifier que .sqlx est copié
   grep "COPY .sqlx" Dockerfile
   ```

2. **Vérifier que SQLX_OFFLINE est défini** :
   ```bash
   grep "SQLX_OFFLINE" Dockerfile
   # Doit afficher: ENV SQLX_OFFLINE=true
   ```

3. **Vérifier les logs Docker pour les erreurs SQLx** :
   ```bash
   docker build -f Dockerfile -t yukpo-backend:latest . 2>&1 | grep -i "sqlx\|DATABASE_URL"
   ```

## 📚 Scripts disponibles

1. **`fix-sqlx-cache-ubuntu.sh`** : Régénération simple du cache
2. **`regenerate-sqlx-complete.sh`** : Régénération complète avec toutes les méthodes
3. **`build-docker-ubuntu.sh`** : Build Docker avec vérifications

## ✅ Résultat attendu

Après régénération complète :
- Cache SQLx : **~250-280 fichiers** (selon les duplications)
- Compilation offline : ✅ Réussie
- Build Docker : ✅ Réussi
- Erreurs SQLx : ✅ 0


