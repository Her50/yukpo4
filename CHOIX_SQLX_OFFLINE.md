# 🎯 CHOIX : Comment gérer SQLx Offline Mode ?

## Date : 2025-11-01

---

## 🚨 PROBLÈME

Mon code utilise `sqlx::query!()` (macro) dans :
- `backend/src/middlewares/check_tokens.rs` ligne 323
- `backend/src/routes/token_stats_routes.rs` lignes 62, 86, 123, 158, 226

**Impact avec `SQLX_OFFLINE=true`** :
```
error: SQLX_OFFLINE=true but no cached data for query:
INSERT INTO token_usage_logs ...
```

---

## ✅ OPTION A : Générer les métadonnées (RECOMMANDÉ)

### Avantages
- ✅ **Cohérent** avec le reste du projet (93 metadata existants)
- ✅ **Vérification types** à la compilation
- ✅ **Auto-complétion** dans l'IDE
- ✅ **Détection erreurs SQL** avant runtime

### Inconvénients
- ⚠️ Nécessite `cargo sqlx prepare` après chaque modification de requête
- ⚠️ Fichiers `.sqlx/query-*.json` à commit (mais automatique)

### Commandes
```bash
cd backend

# 1. Appliquer la migration
sqlx migrate run

# 2. Générer les métadonnées
cargo sqlx prepare --workspace

# 3. Commit (si besoin)
git add .sqlx/
git commit -m "Add SQLx metadata for token_usage_logs"

# 4. Build offline
export SQLX_OFFLINE=true
cargo build
```

**Script automatique créé** : `backend/COMMANDES_SQLX.ps1` ou `.sh`

---

## ✅ OPTION B : Convertir en `sqlx::query()` (ALTERNATIVE)

### Avantages
- ✅ **Pas besoin** de métadonnées
- ✅ **Build immédiat** même si table n'existe pas
- ✅ **Compatible offline** sans génération

### Inconvénients
- ❌ **Pas de vérification types** à la compilation
- ❌ **Plus verbeux** (`.bind()` et `.get()`)
- ❌ **Erreurs SQL** détectées au runtime seulement

### Exemple de conversion

**AVANT (macro)** :
```rust
let stats = sqlx::query!(
    "SELECT COUNT(*) as count FROM token_usage_logs WHERE user_id = $1",
    user_id
)
.fetch_one(&state.pg)
.await?;

let count = stats.count.unwrap_or(0);
```

**APRÈS (runtime)** :
```rust
let row = sqlx::query(
    "SELECT COUNT(*) as count FROM token_usage_logs WHERE user_id = $1"
)
.bind(user_id)
.fetch_one(&state.pg)
.await?;

let count = row.get::<i64, _>("count");
```

**Fichier alternatif créé** : `backend/src/middlewares/check_tokens_runtime.rs.alternative`

---

## 🎯 MA RECOMMANDATION

### **OPTION A** (Générer métadonnées) 👍

**Pourquoi** :
1. Projet utilise déjà 93 fichiers metadata
2. Cohérence avec l'architecture existante
3. Meilleure qualité de code (type-safe)
4. Détection erreurs SQL à la compilation

**Action** : Exécuter `COMMANDES_SQLX.ps1` après avoir appliqué la migration

---

## 📋 DÉCISION À PRENDRE

### **Si vous choisissez OPTION A** :
✅ Je laisse le code tel quel  
✅ Vous exécutez `./COMMANDES_SQLX.ps1`  
✅ Vous commitez les `.sqlx/query-*.json` générés

### **Si vous choisissez OPTION B** :
✅ Je convertis TOUS les `sqlx::query!()` en `sqlx::query()`  
✅ Pas besoin de générer de métadonnées  
✅ Build fonctionne immédiatement

---

## ❓ QUELLE OPTION PRÉFÉREZ-VOUS ?

**Ma suggestion** : **OPTION A** pour maintenir la cohérence et la qualité du code.

Dites-moi et je finalise ! 🚀

---

*Document créé le 2025-11-01*

