# 🚀 Actions Immédiates - Correction CI Phase 5

## 📋 Résumé du problème

Les jobs CI du backend Rust échouent dans le dépôt `Her50/yukpo4` :
- ❌ Windows-latest : Annulé
- ❌ ubuntu-latest : Échec

## ✅ Actions à effectuer MAINTENANT

### 1. Vérifier l'état local du cache SQLx

```powershell
cd backend
.\verify-ci-readiness.ps1
```

**Si le cache est manquant ou vide** :
```powershell
# Avec accès à la base Render
$env:DATABASE_URL = "postgresql://user:password@host:port/database"
cargo sqlx prepare --workspace
```

### 2. Dans le dépôt CI (Her50/yukpo4)

#### A. Vérifier la présence de `.sqlx/`

```bash
cd backend
git ls-files .sqlx/
```

**Si absent** :
1. Copier le répertoire `.sqlx/` depuis ce dépôt vers le dépôt CI
2. Commiter :
   ```bash
   git add backend/.sqlx/
   git commit -m "chore: add sqlx cache for CI Phase 5"
   git push
   ```

#### B. Vérifier/corriger le workflow GitHub Actions

1. Aller dans `.github/workflows/` du dépôt CI
2. Vérifier que le workflow définit `SQLX_OFFLINE=true`
3. Utiliser l'exemple fourni dans `.github/workflows/ci-phase5-example.yml`
4. S'assurer que :
   - ✅ `SQLX_OFFLINE=true` est défini dans `env:`
   - ✅ Les dépendances système sont installées (libpq-dev, openssl, etc.)
   - ✅ Le timeout est suffisant (minimum 30-45 minutes)
   - ✅ Le cache SQLx est vérifié avant la compilation

#### C. Vérifier les logs d'erreur détaillés

Dans GitHub Actions, cliquer sur le job échoué et examiner :
- Les logs de compilation
- Les erreurs SQLx spécifiques
- Les erreurs de dépendances système

### 3. Solutions de contournement temporaires

#### Option A : Désactiver temporairement les jobs Windows

Si Windows pose problème, modifier le workflow pour ne tester que sur Ubuntu :

```yaml
backend-windows:
  name: Interface de sécurité / Backend de Yukpo Phase 5 (Rust)
  runs-on: windows-latest
  if: false  # Désactiver temporairement
```

#### Option B : Utiliser sqlx::query() au lieu de sqlx::query!()

Si le cache SQLx pose problème, convertir les macros :

**Rechercher dans le code** :
```bash
grep -r "sqlx::query!" backend/src/
```

**Remplacer par** :
```rust
// Avant
let result = sqlx::query!("SELECT ...")?;

// Après
let row = sqlx::query("SELECT ...")
    .bind(param)
    .fetch_one(pool)
    .await?;
let field: Type = row.get("field");
```

## 🔍 Diagnostic approfondi

### Vérifier les erreurs spécifiques

1. **Erreur "SQLX_OFFLINE=true but no cached data"**
   → Cache SQLx manquant ou obsolète
   → Solution : Régénérer avec `cargo sqlx prepare --workspace`

2. **Erreur "could not find libpq"**
   → Dépendances PostgreSQL manquantes
   → Solution : Installer libpq-dev (Ubuntu) ou PostgreSQL (Windows)

3. **Erreur "timeout"**
   → Compilation trop longue
   → Solution : Augmenter `timeout-minutes` dans le workflow

4. **Erreur "cancelled"**
   → Job annulé manuellement ou par limite de ressources
   → Solution : Vérifier les limites GitHub Actions

## 📝 Checklist de résolution

- [ ] Vérifier cache SQLx local avec `verify-ci-readiness.ps1`
- [ ] Régénérer cache si nécessaire
- [ ] Vérifier présence de `.sqlx/` dans le dépôt CI
- [ ] Commiter `.sqlx/` si absent
- [ ] Vérifier/corriger le workflow GitHub Actions
- [ ] S'assurer que `SQLX_OFFLINE=true` est défini
- [ ] Vérifier installation dépendances système
- [ ] Augmenter timeout si nécessaire
- [ ] Tester localement avec `SQLX_OFFLINE=true cargo build`
- [ ] Relancer le workflow CI
- [ ] Vérifier les logs d'erreur si échec persiste

## 🔗 Fichiers de référence

- `DIAGNOSTIC_CI_PHASE5.md` - Diagnostic complet
- `.github/workflows/ci-phase5-example.yml` - Exemple de workflow
- `backend/verify-ci-readiness.ps1` - Script de vérification
- `backend/SQLX_OFFLINE_MODE.md` - Documentation SQLx offline

## 📞 Support

Si le problème persiste après ces actions :
1. Examiner les logs GitHub Actions en détail
2. Tester la compilation offline localement
3. Vérifier que toutes les migrations sont appliquées
4. Contacter l'équipe de développement

---

**Priorité** : 🔴 Haute  
**Délai estimé** : 30-60 minutes  
**Impact** : Bloque les déploiements CI/CD

