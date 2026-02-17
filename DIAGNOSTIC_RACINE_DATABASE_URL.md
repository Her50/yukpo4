# 🔍 Diagnostic Racine : Problème de Connexion DATABASE_URL

**Date** : 2026-02-17  
**Fichier analysé** : `downloaded-logs-20260217-111228.csv`

---

## 🔴 PROBLÈME IDENTIFIÉ À LA RACINE

### Symptômes dans les Logs

1. **DATABASE_URL contient des retours à la ligne** :
   ```
   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\r)!
   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\n)!
   ```

2. **Erreur de parsing** :
   ```
   Error: Configuration(EmptyHost)
   [MAIN] ❌ ERREUR: Impossible de créer le pool PostgreSQL (Cloud SQL Unix socket): error with configuration: empty host
   ```

3. **Rust démarre mais crash** :
   - ✅ Rust démarre correctement
   - ✅ DATABASE_URL est présente (longueur: 123)
   - ❌ Le parsing de l'URL échoue à cause des retours à la ligne
   - ❌ L'application crash avec code 1

---

## 🎯 CAUSE RACINE

### Le Problème

**DATABASE_URL contient des retours à la ligne (`\r\n` ou `\n`) à la fin ou dans le milieu de l'URL.**

Quand Rust parse l'URL avec :
```rust
let (auth, query) = auth_and_path.split_once('?').unwrap_or((auth_and_path, ""));
let (user_pass, db_name) = auth.split_once("@/").ok_or_else(...)?;
let socket_path = query.split('&').find(|p| p.starts_with("host=/cloudsql/"))...
```

Les retours à la ligne cassent le parsing :
- `split_once('?')` peut échouer si `?` est suivi d'un `\r\n`
- `split_once("@/")` peut échouer si `@/` est précédé d'un `\r\n`
- Le socket path peut contenir `\r\n` à la fin, ce qui produit "empty host"

### Format Attendu vs Format Réel

**Attendu** :
```
postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Réel (avec retours à la ligne)** :
```
postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres\r\n
```

---

## ✅ SOLUTION

### Solution 1 : Nettoyer DATABASE_URL dans Rust (IMMÉDIAT)

Modifier `backend/src/main.rs` pour nettoyer DATABASE_URL des retours à la ligne **AVANT** de la parser :

```rust
let mut db_url = env::var("DATABASE_URL")?;

// ✅ CRITIQUE: Nettoyer les retours à la ligne qui cassent le parsing
db_url = db_url.trim().to_string();  // Supprime les espaces et retours à la ligne en début/fin
db_url = db_url.replace("\r\n", "").replace("\n", "").replace("\r", "");
```

### Solution 2 : Nettoyer le Secret GitHub (DÉFINITIF)

Le secret `GCP_DATABASE_URL` dans GitHub contient des retours à la ligne. Il faut :

1. Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Trouver `GCP_DATABASE_URL`
3. **Copier la valeur**
4. **Supprimer tous les retours à la ligne** (utiliser un éditeur de texte)
5. **Recoller la valeur nettoyée**

Format correct (sans retours à la ligne) :
```
postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

### Solution 3 : Nettoyer dans le Wrapper (COMPLÉMENTAIRE)

Le wrapper détecte déjà les retours à la ligne mais ne les nettoie pas. Ajouter un nettoyage :

```bash
# Nettoyer DATABASE_URL des retours à la ligne
if [ -n "$DATABASE_URL" ]; then
    DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '\r\n' | tr -d '\n' | tr -d '\r')
    export DATABASE_URL
fi
```

---

## 🔧 CORRECTION À APPLIQUER

**Priorité 1** : Nettoyer DATABASE_URL dans Rust (solution immédiate)
**Priorité 2** : Nettoyer le secret GitHub (solution définitive)
**Priorité 3** : Nettoyer dans le wrapper (défense en profondeur)

---

**Date d'analyse** : 2026-02-17

