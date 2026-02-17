# 🔴 PROBLÈME CRITIQUE : Rust ne démarre jamais

**Date** : 2026-02-17  
**Fichier analysé** : `downloaded-logs-20260217-114954.json`

---

## 🔍 DIAGNOSTIC

### Constat dans les logs

1. **Le wrapper démarre correctement** :
   - ✅ Serveur Python démarre
   - ✅ Cloud Run détecte le health check
   - ✅ Serveur Python est tué
   - ✅ Port est libéré

2. **Rust ne démarre JAMAIS** :
   - ❌ Aucun log `🚀 [WRAPPER] Démarrage application Rust...`
   - ❌ Aucun log `[MAIN]` de Rust
   - ❌ Aucun log d'erreur Rust

3. **Tentatives de connexion échouent** :
   - 2 tentatives `/api/auth/login` → Status 503
   - 25 tentatives `/api/mobile-logs` → Status 501/502/503
   - Toutes échouent car Rust n'est pas démarré

### Séquence observée dans les logs

```
10:48:08 - 🛑 [WRAPPER] Arrêt du serveur Python
10:48:08 - ⏳ [WRAPPER] Attente libération du port (5 secondes)
10:48:13 - ✅ [WRAPPER] Port libéré, démarrage de Rust...
10:48:13 - (RIEN - le wrapper s'arrête ici)
```

**Le wrapper s'arrête après "Port libéré, démarrage de Rust..." sans jamais atteindre la ligne 104 du script.**

---

## 🎯 CAUSE PROBABLE

Le wrapper crash silencieusement ou Cloud Run tue le processus avant qu'il n'atteigne le démarrage de Rust. Possibilités :

1. **Le binaire Rust n'existe pas** → Le wrapper devrait loguer une erreur mais ne le fait pas
2. **Le binaire Rust n'est pas exécutable** → Le wrapper devrait loguer une erreur mais ne le fait pas
3. **Le test `--version` échoue** → Le wrapper continue mais Rust crash immédiatement
4. **Cloud Run tue le processus** → Le wrapper est interrompu avant de démarrer Rust

---

## ✅ SOLUTION

### 1. Ajouter plus de logs de diagnostic

Ajouter des logs après chaque étape critique pour identifier où le wrapper s'arrête :

```bash
echo "✅ [WRAPPER] Port libéré, démarrage de Rust..."
echo "🔍 [WRAPPER] Étape 1: Vérification du binaire..."
if [ ! -f /app/yukpomnang_backend ]; then
    echo "❌ [WRAPPER] ERREUR: Le binaire /app/yukpomnang_backend n'existe pas!"
    ls -la /app/ | head -20
    exit 1
fi
echo "✅ [WRAPPER] Binaire trouvé"

echo "🔍 [WRAPPER] Étape 2: Vérification exécutabilité..."
if [ ! -x /app/yukpomnang_backend ]; then
    echo "⚠️ [WRAPPER] Le binaire n'est pas exécutable, tentative de correction..."
    chmod +x /app/yukpomnang_backend
fi
echo "✅ [WRAPPER] Binaire exécutable"

echo "🔍 [WRAPPER] Étape 3: Test d'exécution..."
if /app/yukpomnang_backend --version 2>&1; then
    echo "✅ [WRAPPER] Binaire peut s'exécuter"
else
    echo "⚠️ [WRAPPER] Binaire ne peut pas s'exécuter (code: $?)"
    exit 1
fi

echo "🚀 [WRAPPER] Étape 4: Démarrage application Rust..."
exec /app/yukpomnang_backend 2>&1
```

### 2. Utiliser `exec` pour remplacer le processus

Le wrapper doit utiliser `exec` pour que Rust devienne le processus principal (PID 1), sinon Cloud Run peut tuer le wrapper et Rust avec.

### 3. Vérifier que le binaire est bien dans l'image Docker

Vérifier que le Dockerfile copie bien le binaire Rust à `/app/yukpomnang_backend`.

---

## 🔧 CORRECTION À APPLIQUER

Modifier `backend/scripts/startup-wrapper.sh` pour ajouter plus de logs et utiliser `exec` correctement.

