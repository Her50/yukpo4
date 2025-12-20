# 🚀 Guide de Build Docker - SQLx Offline Mode

## ⚡ Build Rapide

### Sur une machine avec Docker installé :

```powershell
# Depuis la racine du monorepo
cd C:\Users\23767\yukpomnang2

# Option 1: Utiliser le script automatique
.\backend\build-docker-commands.ps1

# Option 2: Commandes manuelles
docker build -f backend/Dockerfile -t yukpo-backend:latest ./backend
```

## ✅ Vérifications avant le build

1. **Cache SQLx présent** : `backend/.sqlx/` doit contenir ~212 fichiers
2. **Dockerfile présent** : `backend/Dockerfile` doit exister
3. **Docker installé** : `docker --version` doit fonctionner

## 📋 Résumé des corrections appliquées

### ✅ Corrections appliquées :

1. **Dockerfile optimisé** :
   - `SQLX_OFFLINE=true` défini dès le début (ligne 6)
   - Cache `.sqlx` copié AVANT le code source
   - Vérifications de debug ajoutées

2. **Cache SQLx généré** :
   - 212 fichiers dans `backend/.sqlx/`
   - Format JSON valide (PostgreSQL)
   - Compilation locale réussie en mode offline

3. **Documentation complète** :
   - `SQLX_OFFLINE_FIX.md` : Guide détaillé
   - `analyze-sqlx-cache.ps1` : Script d'analyse
   - `build-docker-commands.ps1` : Script de build

## 🔍 Logs attendus pendant le build

Si tout fonctionne, vous devriez voir dans les logs Docker :

```
✅ SQLX_OFFLINE=true
✅ Nombre de fichiers dans .sqlx: 212
✅ Compiling yukpomnang_backend v0.1.0
✅ Finished release profile
```

## 🐛 En cas d'erreur

### Erreur: "set DATABASE_URL to use query macros online"
**Cause** : Le cache SQLx n'est pas trouvé ou `SQLX_OFFLINE=true` n'est pas défini

**Solution** :
```powershell
cd backend
$env:DATABASE_URL="postgresql://user:password@host:port/database"
$env:SQLX_OFFLINE="false"
cargo sqlx prepare -- --lib
cd ..
git add backend/.sqlx
git commit -m "Regenerate SQLx cache"
```

### Erreur: ".sqlx directory may be empty"
**Cause** : Le cache n'a pas été copié correctement

**Solution** : Vérifier que `backend/.sqlx/` contient des fichiers et est bien dans Git

### Erreur: Erreurs de compilation Rust
**Cause** : Problèmes de code Rust, pas lié à SQLx

**Solution** : Corriger les erreurs de compilation affichées

## ✅ Prochaines étapes après un build réussi

1. **Tester l'image localement** :
```powershell
docker run --rm -p 3001:3001 `
  -e DATABASE_URL="postgresql://..." `
  -e RUST_LOG="info" `
  yukpo-backend:latest
```

2. **Utiliser docker-compose** :
```powershell
docker compose up backend
```

3. **Déployer en production** :
   - Push l'image vers un registry (Docker Hub, AWS ECR, etc.)
   - Utiliser l'image dans votre orchestrateur (Kubernetes, ECS, etc.)

## 📝 Notes importantes

- **Le cache SQLx doit être committé dans Git** pour que Docker puisse le copier
- **Régénérer le cache** si le schéma de la base de données change
- **Le build peut prendre 10-30 minutes** selon la machine (première fois plus long)


