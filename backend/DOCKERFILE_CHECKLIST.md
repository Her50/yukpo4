# ✅ Checklist Dockerfile - Fichiers à copier

## 📋 Principe de base

**RÈGLE D'OR** : Si le code Rust lit un fichier, ce fichier DOIT être copié dans le Dockerfile !

---

## 🔍 Comment détecter les fichiers manquants ?

### Méthode 1 : Script automatique
```bash
cd backend
bash verify_dockerfile_completeness.sh
```

### Méthode 2 : Recherche manuelle
```bash
# Chercher toutes les lectures de fichiers dans le code
grep -rE 'read_to_string|include_str!|File::open' src/ | grep -oP '["](.*?)["]'
```

---

## 📂 Fichiers ACTUELLEMENT copiés (Dockerfile)

```dockerfile
COPY Cargo.toml Cargo.lock ./          # Dépendances Rust
COPY src ./src                          # Code source
COPY ia_prompts ./ia_prompts            # Prompts IA (6100 tokens)
COPY config ./config                    # Configuration runtime
COPY ia_intentions_instructions.md ./   # Instructions IA orchestration
RUN mkdir -p ./data                     # Dossier pour context_enricher.rs
```

---

## ⚠️ Fichiers à VÉRIFIER si vous ajoutez du code

| Type de fichier | Exemple | À copier si... |
|----------------|---------|----------------|
| **Prompts IA** | `ia_prompts/*.md` | Lecture via `read_to_string()` |
| **Schémas JSON** | `src/schemas/*.json` | Validation de données |
| **Config** | `config/*.toml` | Paramètres runtime |
| **Instructions** | `*.md` racine | Lecture dynamique |
| **Données statiques** | `data/*.json` | Utilisé par le code |
| **Migrations SQL** | `migrations/*.sql` | Si non intégrées au binaire |

---

## 🚨 Erreurs courantes

### Erreur 1 : "No such file or directory"
```
[ERROR] Erreur lecture prompt: No such file or directory (os error 2)
```
**Cause** : Fichier non copié dans Dockerfile
**Solution** : Ajouter `COPY chemin/fichier ./chemin/`

### Erreur 2 : Chemin incorrect
```rust
// ❌ MAUVAIS (ajoute "backend/" en trop)
tokio::fs::read_to_string("backend/ia_prompts/prompt.md")

// ✅ CORRECT (WORKDIR = /app/)
tokio::fs::read_to_string("ia_prompts/prompt.md")
```

### Erreur 3 : Oubli de créer un dossier
```dockerfile
# ❌ Fichier sera créé, mais dossier parent n'existe pas
COPY data/input.json ./data/

# ✅ Créer le dossier d'abord
RUN mkdir -p ./data
COPY data/input.json ./data/
```

---

## 🔧 Workflow de développement

### 1. Avant d'ajouter une lecture de fichier
```rust
// Dans votre code Rust
let content = std::fs::read_to_string("nouveau_fichier.txt")?;
```

### 2. Vérifier que le fichier existe localement
```bash
ls -la backend/nouveau_fichier.txt
```

### 3. Ajouter au Dockerfile
```dockerfile
COPY nouveau_fichier.txt ./
```

### 4. Vérifier avec le script
```bash
bash verify_dockerfile_completeness.sh
```

### 5. Tester en local avec Docker
```bash
docker build -t test-yukpo .
docker run test-yukpo
```

---

## 📊 Différence Local vs Production

| Environnement | Chemin de base | Fichiers disponibles |
|--------------|----------------|---------------------|
| **Local** | `C:/Users/.../yukpomnang2/backend/` | TOUS les fichiers du repo |
| **Docker** | `/app/` | SEULEMENT les fichiers COPY |

**PIÈGE** : Ça marche en local ≠ Ça marche en production !

---

## ✅ Test final avant déploiement

```bash
# 1. Build local avec Docker (simule Render)
cd backend
docker build -t yukpo-test .

# 2. Lancer et vérifier les logs
docker run --rm yukpo-test

# 3. Si erreur "No such file", ajouter COPY dans Dockerfile
# 4. Rebuild et retester
```

---

## 📚 Ressources

- Documentation Docker COPY : https://docs.docker.com/engine/reference/builder/#copy
- Best practices Dockerfile : https://docs.docker.com/develop/develop-images/dockerfile_best-practices/

---

**Dernière mise à jour** : 2025-11-06
**Auteur** : Équipe Yukpomnang

