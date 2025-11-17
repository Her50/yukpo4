# 🐧 Commandes pour Ubuntu Server

## 📍 Contexte
Serveur: `root@ubuntu-4gb-fsn1-13:/opt/yukpo#`
Problème: Gap de 77 fichiers dans le cache SQLx (212 fichiers vs 289 requêtes)

## 🚀 Solution rapide (3 commandes)

```bash
# 1. Aller dans le dossier backend
cd /opt/yukpo/backend

# 2. Rendre les scripts exécutables
chmod +x fix-sqlx-cache-ubuntu.sh regenerate-sqlx-complete.sh build-docker-ubuntu.sh

# 3. Régénérer le cache complet
./fix-sqlx-cache-ubuntu.sh
```

## 🔧 Solution complète (étape par étape)

### Étape 1: Vérifier l'état actuel

```bash
cd /opt/yukpo/backend

# Vérifier le cache actuel
find .sqlx -type f | wc -l
# Résultat attendu: 212

# Compter les requêtes dans le code
grep -r "sqlx::query!" src/ | wc -l
grep -r "sqlx::query_scalar!" src/ | wc -l
grep -r "sqlx::query_as!" src/ | wc -l
# Total attendu: ~289
```

### Étape 2: Régénérer le cache avec TOUTES les méthodes

```bash
cd /opt/yukpo/backend

# Exporter DATABASE_URL
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false

# Méthode 1: --workspace (recommandé)
cargo sqlx prepare --workspace

# Méthode 2: --all (inclut binaires et tests)
cargo sqlx prepare --all

# Méthode 3: --all-features --all (si features conditionnelles)
cargo sqlx prepare --all-features --all || echo "Pas de features, c'est normal"

# Vérifier le nouveau nombre de fichiers
NEW_COUNT=$(find .sqlx -type f | wc -l)
echo "Fichiers dans le cache: $NEW_COUNT"
```

### Étape 3: Tester que tout fonctionne

```bash
cd /opt/yukpo/backend

# Tester la compilation en mode offline
export SQLX_OFFLINE=true
cargo check --lib

# Si aucune erreur SQLx n'apparaît, le cache est suffisant
# Erreurs attendues: AUCUNE
```

### Étape 4: Committer le cache

```bash
cd /opt/yukpo

# Ajouter le cache au git
git add backend/.sqlx

# Committer
git commit -m "Update SQLx cache - $(find backend/.sqlx -type f | wc -l) fichiers"
```

### Étape 5: Rebuild Docker

```bash
cd /opt/yukpo/backend

# Build Docker
docker build -f Dockerfile -t yukpo-backend:latest .
```

## 📋 Scripts disponibles

### 1. `fix-sqlx-cache-ubuntu.sh`
Régénération simple du cache avec toutes les méthodes.

```bash
cd /opt/yukpo/backend
chmod +x fix-sqlx-cache-ubuntu.sh
./fix-sqlx-cache-ubuntu.sh
```

### 2. `regenerate-sqlx-complete.sh`
Régénération complète avec analyse détaillée du gap.

```bash
cd /opt/yukpo/backend
chmod +x regenerate-sqlx-complete.sh
./regenerate-sqlx-complete.sh
```

### 3. `build-docker-ubuntu.sh`
Build Docker avec vérifications automatiques.

```bash
cd /opt/yukpo/backend
chmod +x build-docker-ubuntu.sh
./build-docker-ubuntu.sh
```

## 🔍 Vérification du problème des 77 fichiers

### Pourquoi le gap existe ?

1. **Requêtes dupliquées** : 
   - SQLx génère 1 fichier par requête SQL unique (hash SHA256)
   - Plusieurs occurrences d'une même requête = 1 fichier
   - Exemple: `SELECT id FROM services WHERE id = $1` utilisé 5 fois = 1 fichier

2. **Requêtes dans fichiers non compilés** :
   - Fichiers `*_backup.rs` : non compilés avec `--lib`
   - Tests conditionnels `#[cfg(test)]`
   - Binaires avec features conditionnelles

3. **Comptage macros vs requêtes uniques** :
   - 289 = occurrences de macros dans le code
   - 212 = requêtes SQL uniques (après déduplication)

### Comment vérifier si c'est un problème ?

```bash
cd /opt/yukpo/backend

# Si cette commande réussit SANS erreur SQLx, le cache est suffisant
export SQLX_OFFLINE=true
cargo check --lib 2>&1 | grep -i "sqlx\|DATABASE_URL"

# Résultat attendu: RIEN (aucune erreur)
# Si erreurs: le cache est incomplet → régénérer avec les scripts
```

## ✅ Validation finale

Le cache est **suffisant** si :
- ✅ `cargo check --lib` réussit en mode offline (pas d'erreur SQLx)
- ✅ `docker build` réussit sans erreur SQLx
- ✅ Aucune erreur "set DATABASE_URL" n'apparaît

**Si ces 3 conditions sont remplies, le gap de 77 est normal (déduplication) et n'est pas un problème.**

## 🚨 En cas d'erreurs persistantes

Si le build Docker échoue toujours avec des erreurs SQLx :

```bash
cd /opt/yukpo/backend

# 1. Vérifier que le cache est présent
ls -la .sqlx | head -10

# 2. Vérifier que SQLX_OFFLINE=true est dans le Dockerfile
grep SQLX_OFFLINE Dockerfile

# 3. Vérifier que .sqlx est copié dans le Dockerfile
grep "COPY .sqlx" Dockerfile

# 4. Rebuild avec logs détaillés
docker build -f Dockerfile -t yukpo-backend:latest . 2>&1 | tee build.log
grep -i "sqlx\|DATABASE_URL" build.log
```

## 📝 Résumé des commandes essentielles

```bash
# Depuis /opt/yukpo/backend

# 1. Régénérer le cache
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false
cargo sqlx prepare --workspace
cargo sqlx prepare --all

# 2. Vérifier
export SQLX_OFFLINE=true
cargo check --lib

# 3. Committer
cd /opt/yukpo
git add backend/.sqlx
git commit -m "Update SQLx cache"

# 4. Rebuild Docker
cd backend
docker build -f Dockerfile -t yukpo-backend:latest .
```


