# 🔍 Diagnostic : Application Rust Ne Démarre Pas

**Date** : 17 Février 2026  
**Révision** : `yukpo-backend-00181-7rp`  
**Problème** : L'application Rust ne démarre pas après que le wrapper libère le port

---

## 🔴 Problème Identifié

### Séquence Observée dans les Logs

1. ✅ **17:31:16** - Nouvelle instance démarrée (AUTOSCALING)
2. ✅ **17:31:16** - Wrapper Python démarre
3. ✅ **17:31:17** - Serveur HTTP minimal Python prêt
4. ✅ **17:31:26** - Healthcheck réussi
5. ✅ **17:31:26** - Wrapper arrête le serveur Python
6. ✅ **17:32:43** - **"✅ [WRAPPER] Port libéré, démarrage de Rust..."**
7. ❌ **AUCUN LOG APRÈS** - L'application Rust ne produit aucun log

### Conclusion

**L'application Rust ne démarre pas du tout** ou **crash immédiatement** sans produire de logs.

---

## 🔍 Analyse du Script Wrapper

### Script : `backend/scripts/startup-wrapper.sh`

**Ligne 122** : `exec /app/yukpomnang_backend 2>&1`

**Problème potentiel** :
- Le binaire `/app/yukpomnang_backend` n'existe peut-être pas
- Le binaire n'est peut-être pas exécutable
- Le binaire crash immédiatement au démarrage
- Le binaire ne produit pas de logs (buffering, crash silencieux)

### Vérifications dans le Script

Le script vérifie :
1. ✅ Existence du binaire (`/app/yukpomnang_backend`)
2. ✅ Exécutabilité du binaire
3. ✅ Test d'exécution (`--version`)

**Mais** : Si le test `--version` réussit mais que l'exécution normale échoue, le problème est ailleurs.

---

## 🎯 Causes Possibles

### 1. **Le Binaire N'Existe Pas dans l'Image Docker** ⚠️

**Vérification** : Le Dockerfile doit copier le binaire à `/app/yukpomnang_backend`

**Dockerfile** : `backend/Dockerfile.cloud.optimized`

**Ligne probable** : `COPY target/release/yukpomnang_backend /app/yukpomnang_backend`

**Action** : Vérifier que le build Docker inclut bien le binaire

### 2. **Le Binaire Crash Immédiatement** ⚠️

**Causes possibles** :
- Erreur de compilation non détectée
- Dépendances manquantes dans l'image Docker
- Problème avec les variables d'environnement
- Erreur au démarrage (connexion DB, etc.)

**Action** : Vérifier les logs stderr (peut-être que les erreurs ne sont pas capturées)

### 3. **Problème de Buffering des Logs** ⚠️

**Cause** : Les logs Rust sont peut-être buffered et ne s'affichent pas immédiatement

**Solution** : Forcer le flush des logs avec `RUST_LOG_STYLE=always` ou utiliser `std::io::stdout().flush()`

### 4. **Le Binaire N'est Pas au Bon Endroit** ⚠️

**Vérification** : Le script cherche `/app/yukpomnang_backend` mais le binaire est peut-être ailleurs

**Action** : Vérifier le Dockerfile pour voir où le binaire est copié

### 5. **Erreur Silencieuse au Démarrage** ⚠️

**Cause** : L'application Rust crash avant de produire des logs

**Action** : Ajouter plus de logs au tout début de `main()` dans Rust

---

## ✅ Solutions Recommandées

### Solution 1 : Vérifier le Dockerfile

```dockerfile
# Vérifier que cette ligne existe et est correcte
COPY target/release/yukpomnang_backend /app/yukpomnang_backend
RUN chmod +x /app/yukpomnang_backend
```

### Solution 2 : Ajouter Plus de Logs au Démarrage Rust

Dans `backend/src/main.rs`, ajouter des logs **très tôt** :

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ✅ CRITIQUE: Logs IMMÉDIATS sur stderr AVANT toute initialisation
    eprintln!("[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint");
    eprintln!("[MAIN] 🔍 Vérification des variables d'environnement critiques...");
    
    // ... reste du code
}
```

### Solution 3 : Vérifier que le Binaire Est Bien dans l'Image

Ajouter dans le wrapper :

```bash
echo "🔍 [WRAPPER] Vérification du binaire..."
ls -la /app/yukpomnang_backend
file /app/yukpomnang_backend
ldd /app/yukpomnang_backend || echo "ldd non disponible"
```

### Solution 4 : Capturer Toutes les Erreurs

Modifier le wrapper pour capturer les erreurs :

```bash
echo "🚀 [WRAPPER] Démarrage application Rust..."
if ! exec /app/yukpomnang_backend 2>&1; then
    EXIT_CODE=$?
    echo "❌ [WRAPPER] ERREUR: Application Rust a quitté avec le code $EXIT_CODE"
    exit $EXIT_CODE
fi
```

**Note** : Avec `exec`, le code après ne s'exécute jamais, donc cette approche ne fonctionne pas.

### Solution 5 : Ne Pas Utiliser `exec` Temporairement

Pour diagnostiquer, ne pas utiliser `exec` et capturer les erreurs :

```bash
echo "🚀 [WRAPPER] Démarrage application Rust..."
/app/yukpomnang_backend 2>&1
EXIT_CODE=$?
echo "❌ [WRAPPER] Application Rust a quitté avec le code $EXIT_CODE"
exit $EXIT_CODE
```

**⚠️ Attention** : Cela peut causer des problèmes avec Cloud Run (le processus principal doit être Rust).

---

## 🔧 Actions Immédiates

1. **Vérifier le Dockerfile** pour confirmer que le binaire est bien copié
2. **Vérifier le build Docker** pour voir si le binaire est bien inclus
3. **Ajouter des logs au tout début de `main()`** dans Rust
4. **Vérifier les logs stderr** pour voir s'il y a des erreurs non capturées
5. **Tester localement** le binaire pour voir s'il démarre

---

## 📊 État Actuel

| Élément | Statut | Détails |
|---------|--------|---------|
| **Wrapper démarre** | ✅ | Le wrapper Python fonctionne |
| **Healthcheck réussit** | ✅ | Cloud Run détecte le serveur |
| **Port libéré** | ✅ | Le wrapper libère le port |
| **Binaire existe** | ❓ | À vérifier dans les logs |
| **Binaire exécutable** | ❓ | À vérifier dans les logs |
| **Rust démarre** | ❌ | Aucun log après "Port libéré, démarrage de Rust..." |
| **Logs Rust** | ❌ | Aucun log de l'application Rust |

---

**Date d'analyse** : 17 Février 2026  
**Statut** : 🔴 Application Rust ne démarre pas - Diagnostic en cours


