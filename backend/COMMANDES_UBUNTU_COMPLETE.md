# 🐧 Commandes COMPLÈTES pour Ubuntu - Fix SQLx définitif

## 📍 Sur Ubuntu (`root@ubuntu-4gb-fsn1-13:/opt/yukpo#`)

### ⚡ Solution rapide (copier-coller)

```bash
cd /opt/yukpo/backend

# 1. Rendre les scripts exécutables
chmod +x fix-sqlx-complete-ubuntu.sh

# 2. Régénérer le cache COMPLET
./fix-sqlx-complete-ubuntu.sh

# 3. Vérifier le résultat
find .sqlx -type f | wc -l
export SQLX_OFFLINE=true
cargo check --lib

# 4. Committer le cache
cd /opt/yukpo
git add backend/.sqlx
git commit -m "Fix SQLx cache - $(find backend/.sqlx -type f | wc -l) fichiers"

# 5. Rebuild Docker
cd backend
docker build -f Dockerfile -t yukpo-backend:latest .
```

## 🔧 Solution manuelle (étape par étape)

### Étape 1: Préparer l'environnement

```bash
cd /opt/yukpo/backend

# Exporter DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"
export SQLX_OFFLINE=false

# Vérifier la connexion
psql "$DATABASE_URL" -c "SELECT 1" || echo "⚠️  Problème de connexion à la base"
```

### Étape 2: Supprimer l'ancien cache

```bash
cd /opt/yukpo/backend
rm -rf .sqlx
echo "✅ Ancien cache supprimé"
```

### Étape 3: Régénérer le cache avec TOUTES les méthodes

```bash
cd /opt/yukpo/backend

# Méthode 1: --workspace
echo "🔄 Méthode 1: --workspace"
cargo sqlx prepare --workspace 2>&1 | tail -3
COUNT_1=$(find .sqlx -type f 2>/dev/null | wc -l)
echo "   → Cache: $COUNT_1 fichiers"

# Méthode 2: --all
echo "🔄 Méthode 2: --all"
cargo sqlx prepare --all 2>&1 | tail -3
COUNT_2=$(find .sqlx -type f 2>/dev/null | wc -l)
echo "   → Cache: $COUNT_2 fichiers"

# Méthode 3: --all-features --all
echo "🔄 Méthode 3: --all-features --all"
cargo sqlx prepare --all-features --all 2>&1 | tail -3 || echo "   ⚠️  Pas de features (normal)"
COUNT_3=$(find .sqlx -type f 2>/dev/null | wc -l)
echo "   → Cache: $COUNT_3 fichiers"

# Méthode 4: --lib
echo "🔄 Méthode 4: --lib"
cargo sqlx prepare -- --lib 2>&1 | tail -3
FINAL_COUNT=$(find .sqlx -type f 2>/dev/null | wc -l)
echo "   → Cache final: $FINAL_COUNT fichiers"
```

### Étape 4: Vérifier que le cache est complet

```bash
cd /opt/yukpo/backend

# Compter les fichiers
CACHE_COUNT=$(find .sqlx -type f | wc -l)
echo "📊 Fichiers dans le cache: $CACHE_COUNT"

# Compter les requêtes SQLx
QUERY_COUNT=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l)
QUERY_SCALAR_COUNT=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l)
QUERY_AS_COUNT=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l)
TOTAL=$((QUERY_COUNT + QUERY_SCALAR_COUNT + QUERY_AS_COUNT))
echo "📊 Requêtes dans le code: $TOTAL"

# Test de compilation offline
echo ""
echo "🧪 Test de compilation en mode offline..."
export SQLX_OFFLINE=true
if cargo check --lib 2>&1 | grep -q "error.*DATABASE_URL\|error.*sqlx prepare"; then
    echo "   ❌ ERREUR: Cache incomplet!"
    echo "   Vérifiez les erreurs ci-dessus"
    cargo check --lib 2>&1 | grep "error.*sqlx\|error.*DATABASE_URL" | head -5
    exit 1
else
    echo "   ✅ Compilation réussie!"
    echo "   → Cache complet"
fi
```

### Étape 5: Committer le cache (IMPORTANT pour Docker)

```bash
cd /opt/yukpo

# Vérifier que .sqlx n'est pas dans .gitignore
if grep -q "^\.sqlx" .gitignore 2>/dev/null; then
    echo "⚠️  .sqlx est dans .gitignore!"
    echo "   Retirez-le de .gitignore pour que Docker puisse le copier"
    exit 1
fi

# Ajouter le cache
git add backend/.sqlx

# Vérifier ce qui sera committé
git status backend/.sqlx

# Committer
CACHE_COUNT=$(find backend/.sqlx -type f | wc -l)
git commit -m "Fix SQLx cache - $CACHE_COUNT fichiers"
```

### Étape 6: Vérifier le Dockerfile

```bash
cd /opt/yukpo/backend

# Vérifier que .sqlx est copié AVANT src
if grep -B 5 "COPY src" Dockerfile | grep -q "COPY .sqlx"; then
    echo "✅ Dockerfile copie .sqlx AVANT src"
else
    echo "❌ ERREUR: Dockerfile doit copier .sqlx AVANT src"
    exit 1
fi

# Vérifier que SQLX_OFFLINE=true est défini
if grep -q "ENV SQLX_OFFLINE=true" Dockerfile; then
    echo "✅ Dockerfile définit SQLX_OFFLINE=true"
else
    echo "❌ ERREUR: Dockerfile doit définir SQLX_OFFLINE=true"
    exit 1
fi
```

### Étape 7: Rebuild Docker

```bash
cd /opt/yukpo/backend

echo "🐳 Build Docker..."
docker build -f Dockerfile -t yukpo-backend:latest . 2>&1 | tee docker-build.log

# Vérifier les erreurs SQLx
if grep -q "error.*DATABASE_URL\|error.*sqlx prepare" docker-build.log; then
    echo "❌ ERREUR: Des erreurs SQLx persistent"
    grep "error.*sqlx\|error.*DATABASE_URL" docker-build.log | head -10
    exit 1
else
    echo "✅ Build Docker réussi!"
fi
```

## 🔍 Diagnostic si ça ne marche toujours pas

### Vérifier que le cache est bien dans Git

```bash
cd /opt/yukpo
git ls-files backend/.sqlx | wc -l
# Doit être > 200

# Si 0, le cache n'est pas dans Git
git add backend/.sqlx
git commit -m "Add SQLx cache"
```

### Vérifier les logs Docker pour voir si le cache est copié

```bash
cd /opt/yukpo/backend
docker build -f Dockerfile -t yukpo-backend:test . 2>&1 | grep -A 5 "COPY .sqlx"
# Doit afficher les fichiers .sqlx

docker build -f Dockerfile -t yukpo-backend:test . 2>&1 | grep "Nombre de fichiers"
# Doit afficher un nombre > 200
```

### Vérifier SQLX_OFFLINE dans Docker

```bash
cd /opt/yukpo/backend
docker build -f Dockerfile -t yukpo-backend:test . 2>&1 | grep "SQLX_OFFLINE"
# Doit afficher: SQLX_OFFLINE=true
```

### Si le cache n'est toujours pas complet

```bash
cd /opt/yukpo/backend

# Compiler TOUT le projet avec DATABASE_URL pour forcer la génération du cache
export DATABASE_URL="postgresql://user:password@host:port/database"
export SQLX_OFFLINE=false

# Compiler pour générer le cache
cargo build --lib 2>&1 | tail -20

# Vérifier le cache après compilation
find .sqlx -type f | wc -l
```

## ✅ Résultat attendu

Après ces étapes :
- Cache SQLx : **~250-289 fichiers**
- Compilation offline : **✅ Réussie** (0 erreur SQLx)
- Build Docker : **✅ Réussi**
- Erreurs SQLx : **0**


