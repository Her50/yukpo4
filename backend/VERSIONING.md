# 📋 Guide de Versioning - Yukpomnang Backend

## 🎯 Vue d'ensemble

Le backend utilise le **versioning sémantique (SemVer)** : `MAJOR.MINOR.PATCH[-PRE-RELEASE]`

### Format de version

```
MAJOR.MINOR.PATCH[-PRE-RELEASE]
```

Exemples :
- `0.1.0` - Version initiale
- `0.1.1` - Patch (correction de bug)
- `0.2.0` - Minor (nouvelle fonctionnalité)
- `1.0.0` - Major (changement incompatible)
- `1.0.1-alpha.1` - Pre-release (version de test)

## 📊 Règles d'incrémentation

### MAJOR (X.0.0)
Incrémenter quand :
- ✅ Changements incompatibles avec l'API (breaking changes)
- ✅ Suppression d'endpoints
- ✅ Changements majeurs de structure de données
- ✅ Migration majeure de base de données

**Exemple** : `0.1.0` → `1.0.0`

### MINOR (0.X.0)
Incrémenter quand :
- ✅ Nouvelles fonctionnalités (backward compatible)
- ✅ Nouveaux endpoints
- ✅ Nouvelles routes
- ✅ Nouvelles tables (sans migration destructive)

**Exemple** : `0.1.0` → `0.2.0`

### PATCH (0.0.X)
Incrémenter quand :
- ✅ Corrections de bugs
- ✅ Améliorations de performance
- ✅ Corrections de sécurité
- ✅ Améliorations de documentation
- ✅ Refactoring interne

**Exemple** : `0.1.0` → `0.1.1`

### PRE-RELEASE (-alpha.X, -beta.X, -rc.X)
Utiliser pour :
- ✅ Versions de test avant release
- ✅ Versions de développement
- ✅ Versions de staging

**Exemples** :
- `0.1.1-alpha.1` → `0.1.1-alpha.2`
- `0.1.1-beta.1` → `0.1.1-beta.2`
- `0.1.1-rc.1` → `0.1.1-rc.2`

## 🚀 Comment incrémenter la version

### Méthode 1 : Script PowerShell (Recommandé)

```powershell
# Depuis la racine du projet
.\scripts\bump-version.ps1 -Type patch      # 0.1.0 → 0.1.1
.\scripts\bump-version.ps1 -Type minor      # 0.1.0 → 0.2.0
.\scripts\bump-version.ps1 -Type major      # 0.1.0 → 1.0.0
.\scripts\bump-version.ps1 -Type pre-release # 0.1.0 → 0.1.1-alpha.1
```

### Méthode 2 : Modification manuelle

1. Ouvrir `backend/Cargo.toml`
2. Modifier la ligne `version = "0.1.0"`
3. Sauvegarder

### Méthode 3 : Via Git tags (pour releases)

```bash
# Créer un tag de version
git tag -a v0.1.1 -m "Version 0.1.1 - Corrections de bugs"

# Push le tag
git push origin v0.1.1
```

## 📍 Où la version est utilisée

### 1. Cargo.toml
```toml
[package]
name = "yukpomnang_backend"
version = "0.1.0"
```

### 2. API Endpoint `/api/health/version`
```bash
curl http://localhost:3000/api/health/version
```

Réponse :
```json
{
  "version": "0.1.0",
  "app_name": "yukpomnang_backend",
  "build_date": "2026-01-28T10:30:00Z",
  "git_commit": "a1b2c3d",
  "git_branch": "master"
}
```

### 3. Logs au démarrage
La version est automatiquement loggée au démarrage de l'application.

## 🔄 Workflow recommandé

### Pour une nouvelle fonctionnalité (MINOR)

```bash
# 1. Incrémenter la version
.\scripts\bump-version.ps1 -Type minor

# 2. Vérifier les changements
git diff backend/Cargo.toml

# 3. Commit
git add backend/Cargo.toml
git commit -m "chore: bump version to 0.2.0"

# 4. Créer un tag (optionnel mais recommandé)
git tag -a v0.2.0 -m "Version 0.2.0 - Nouvelles fonctionnalités"

# 5. Push
git push origin master
git push origin v0.2.0
```

### Pour une correction de bug (PATCH)

```bash
# 1. Incrémenter la version
.\scripts\bump-version.ps1 -Type patch

# 2. Commit avec le fix
git add backend/Cargo.toml backend/src/...
git commit -m "fix: correction du bug X (version 0.1.1)"

# 3. Créer un tag
git tag -a v0.1.1 -m "Version 0.1.1 - Corrections de bugs"

# 4. Push
git push origin master
git push origin v0.1.1
```

### Pour un changement majeur (MAJOR)

```bash
# 1. Incrémenter la version
.\scripts\bump-version.ps1 -Type major

# 2. Commit avec les breaking changes
git add backend/Cargo.toml backend/src/...
git commit -m "feat!: breaking changes - nouvelle architecture API (version 1.0.0)"

# 3. Créer un tag
git tag -a v1.0.0 -m "Version 1.0.0 - Breaking changes"

# 4. Push
git push origin master
git push origin v1.0.0
```

## 📝 Bonnes pratiques

1. **Incrémenter AVANT de push** : Toujours incrémenter la version avant de push les changements
2. **Taguer les releases** : Créer un tag Git pour chaque version release
3. **Documenter les changements** : Utiliser des messages de commit clairs
4. **Version stable** : Quand l'application est stable, passer à `1.0.0`
5. **Pre-releases** : Utiliser `-alpha.X`, `-beta.X`, `-rc.X` pour les versions de test

## 🔍 Vérifier la version actuelle

### Via l'API
```bash
curl http://localhost:3000/api/health/version
```

### Via Cargo
```bash
cd backend
cargo pkgid | Select-String -Pattern "(\d+\.\d+\.\d+)"
```

### Via Git tags
```bash
git tag -l "v*" | Sort-Object -Version
```

## 📚 Références

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Cargo Versioning](https://doc.rust-lang.org/cargo/reference/manifest.html#the-version-field)







