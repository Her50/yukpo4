# 🔄 Problème Récurrent : Authentification PostgreSQL

**Date**: 2026-02-18  
**Problème**: L'erreur d'authentification revient après chaque correction  
**Cause Racine**: Désynchronisation entre GitHub Secrets et GCP Secret Manager

---

## 🔴 Cause Racine Identifiée

### Le Problème : Deux Sources de Vérité

Il y a **DEUX endroits** où `DATABASE_URL` est stockée, et ils ne sont **PAS synchronisés** :

1. **GitHub Secret** : `GCP_DATABASE_URL`
   - Utilisé par : `.github/workflows/docker-build-optimized.yml`
   - Ligne 474, 497 : `${{ secrets.GCP_DATABASE_URL }}`
   - **Problème** : Peut contenir un ancien mot de passe ou un format incorrect

2. **GCP Secret Manager** : `database-url`
   - Utilisé par : `.github/workflows/gcp-deploy.yml`
   - Ligne 251, 273, 302 : `DATABASE_URL=database-url:latest`
   - **Problème** : Peut être écrasé par un workflow qui utilise `GCP_DATABASE_URL`

### Pourquoi le Problème Revient

**Scénario typique** :

1. ✅ Vous corrigez le secret `database-url` dans GCP Secret Manager
2. ✅ Le service Cloud Run fonctionne temporairement
3. ❌ Un workflow GitHub Actions se déclenche (push, déploiement automatique, etc.)
4. ❌ Le workflow `docker-build-optimized.yml` utilise `GCP_DATABASE_URL` (GitHub Secret)
5. ❌ Si `GCP_DATABASE_URL` contient un ancien mot de passe, il écrase `database-url`
6. ❌ Le problème revient

**OU** :

1. ✅ Vous corrigez `GCP_DATABASE_URL` dans GitHub
2. ❌ Mais `database-url` dans GCP Secret Manager n'est pas mis à jour
3. ❌ Le workflow `gcp-deploy.yml` utilise `database-url:latest` (ancien)
4. ❌ Le problème persiste

---

## ✅ Solution Définitive

### Option 1: Utiliser UNIQUEMENT GCP Secret Manager (Recommandé)

**Avantage** : Une seule source de vérité, plus sécurisé

#### Étape 1: Supprimer la Dépendance à GitHub Secret

Modifier `.github/workflows/docker-build-optimized.yml` pour ne plus utiliser `GCP_DATABASE_URL` :

```yaml
# ❌ AVANT (ligne 474)
--arg db_url "${{ secrets.GCP_DATABASE_URL }}" \

# ✅ APRÈS
--arg db_url "" \  # Ne pas utiliser DATABASE_URL dans ce workflow
```

**OU** : Supprimer complètement `DATABASE_URL` de ce workflow car `gcp-deploy.yml` le gère déjà.

#### Étape 2: Synchroniser une Seule Fois

1. Mettre à jour `database-url` dans GCP Secret Manager avec le bon format
2. Supprimer ou ignorer `GCP_DATABASE_URL` dans GitHub (ne plus l'utiliser)

#### Étape 3: Vérifier que `gcp-deploy.yml` Utilise Bien Secret Manager

Le workflow `gcp-deploy.yml` utilise déjà `database-url:latest` (ligne 251), donc c'est bon.

---

### Option 2: Synchroniser les Deux Secrets (Alternative)

Si vous devez garder les deux, créer un script de synchronisation :

```powershell
# Script de synchronisation DATABASE_URL
# À exécuter après chaque changement de mot de passe

$PROJECT = "yukpo-project"
$SECRET_NAME = "database-url"

# 1. Récupérer DATABASE_URL depuis GCP Secret Manager
$DATABASE_URL = gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT

# 2. Mettre à jour GitHub Secret (nécessite GitHub CLI)
echo $DATABASE_URL | gh secret set GCP_DATABASE_URL --repo Her50/yukpo4

Write-Host "✅ Secrets synchronisés"
```

**⚠️ Problème** : Cette approche nécessite de synchroniser manuellement à chaque changement.

---

### Option 3: Utiliser UNIQUEMENT GitHub Secret (Non Recommandé)

**Inconvénient** : Moins sécurisé, GitHub Secrets sont moins adaptés pour Cloud Run

Si vous choisissez cette option :
1. Supprimer `database-url` de GCP Secret Manager
2. Modifier `gcp-deploy.yml` pour utiliser GitHub Secret au lieu de Secret Manager
3. **⚠️ Non recommandé** car moins sécurisé

---

## 🔧 Correction Immédiate

### Étape 1: Vérifier les Deux Secrets

```powershell
# Vérifier GCP Secret Manager
gcloud secrets versions access latest --secret=database-url --project=yukpo-project

# Vérifier GitHub Secret (nécessite GitHub CLI)
gh secret list --repo Her50/yukpo4 | grep GCP_DATABASE_URL
```

### Étape 2: Synchroniser les Deux

**Si GCP Secret Manager est correct** :

```powershell
# Récupérer depuis GCP
$DATABASE_URL = gcloud secrets versions access latest --secret=database-url --project=yukpo-project

# Mettre à jour GitHub Secret
echo $DATABASE_URL | gh secret set GCP_DATABASE_URL --repo Her50/yukpo4
```

**Si GitHub Secret est correct** :

```powershell
# Récupérer depuis GitHub (nécessite GitHub CLI)
$DATABASE_URL = gh secret get GCP_DATABASE_URL --repo Her50/yukpo4

# Mettre à jour GCP Secret Manager
echo $DATABASE_URL | gcloud secrets versions add database-url --data-file=- --project=yukpo-project
```

### Étape 3: Vérifier les Workflows

Vérifier que les workflows utilisent la bonne source :

- ✅ `gcp-deploy.yml` → Utilise `database-url:latest` (GCP Secret Manager)
- ⚠️ `docker-build-optimized.yml` → Utilise `GCP_DATABASE_URL` (GitHub Secret)

**Solution** : Modifier `docker-build-optimized.yml` pour ne pas utiliser `DATABASE_URL` (car `gcp-deploy.yml` le gère déjà).

---

## 📋 Checklist de Correction Définitive

- [ ] Identifier quelle source est la "source de vérité" (GCP Secret Manager recommandé)
- [ ] Synchroniser les deux secrets une dernière fois
- [ ] Modifier les workflows pour utiliser UNIQUEMENT la source choisie
- [ ] Supprimer ou ignorer l'autre source
- [ ] Documenter quelle source utiliser
- [ ] Tester un déploiement complet
- [ ] Vérifier que le problème ne revient pas

---

## 🎯 Recommandation Finale

**Utiliser UNIQUEMENT GCP Secret Manager** :

1. ✅ Plus sécurisé (intégré à GCP)
2. ✅ Meilleure gestion des versions
3. ✅ Accès contrôlé via IAM
4. ✅ Pas de dépendance à GitHub pour les secrets de production

**Actions** :
1. Mettre à jour `database-url` dans GCP Secret Manager
2. Modifier `docker-build-optimized.yml` pour ne plus utiliser `GCP_DATABASE_URL`
3. Supprimer `GCP_DATABASE_URL` de GitHub (ou le garder mais ne plus l'utiliser)

---

**Date**: 2026-02-18  
**Statut**: 🔴 **PROBLÈME IDENTIFIÉ - SOLUTION PROPOSÉE**


