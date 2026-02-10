# 🚀 Déploiement Automatique .env sur Hetzner - Solution Finale

## ✅ Solution Recommandée : GitHub Actions (Automatique)

Le workflow GitHub Actions utilise **Ubuntu** (comme tous vos autres déploiements) et fonctionne parfaitement sans blocage SSH.

### Option 1 : Déclencher via Script PowerShell (Automatique)

```powershell
# Définir votre token GitHub (une seule fois)
$env:GITHUB_TOKEN = "votre_token_github"

# Lancer le déploiement
.\scripts\trigger-github-deploy.ps1
```

### Option 2 : Déclencher via GitHub CLI (Automatique)

```powershell
# Installer GitHub CLI si nécessaire
# winget install GitHub.cli

# Se connecter (une seule fois)
gh auth login

# Lancer le workflow
gh workflow run deploy-env-hetzner.yml
```

### Option 3 : Déclencher Manuellement (1 clic)

1. Aller sur : https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml
2. Cliquer sur **"Run workflow"** (bouton en haut à droite)
3. Cliquer sur **"Run workflow"** (bouton vert)
4. Attendre 2-3 minutes

## 📋 Ce que fait le Workflow

Le workflow GitHub Actions va automatiquement :

1. ✅ **Se connecter à AWS** pour récupérer toutes les variables d'environnement
2. ✅ **Adapter les variables** pour Hetzner :
   - `DATABASE_URL` → `postgresql://user:pass@postgres:5432/dbname`
   - `REDIS_URL` → `redis://redis:6379/0`
   - S3 → Wasabi (endpoint, clés, bucket)
   - URLs → Hetzner (LiveKit, SRS, Video Renderer)
3. ✅ **Copier le fichier `.env`** sur Hetzner via SSH (Ubuntu - pas de blocage)
4. ✅ **Vérifier** que le fichier est bien créé avec toutes les variables

## 🔍 Vérification

Après le déploiement, le workflow affiche :
- ✅ Nombre de lignes dans le fichier `.env`
- ✅ Premières lignes (valeurs masquées pour sécurité)
- ✅ Statut de déploiement

## 🎯 Avantages

- ✅ **Pas de blocage SSH** : Utilise Ubuntu (comme les autres workflows)
- ✅ **100% Automatique** : Récupère directement depuis AWS
- ✅ **Sécurisé** : Utilise les secrets GitHub
- ✅ **Vérifié** : Vérifie que le fichier est bien créé
- ✅ **Rapide** : 2-3 minutes seulement

## 📝 Note

Le workflow est déjà configuré et prêt. Il suffit de le déclencher une fois et le fichier `.env` sera créé sur Hetzner avec toutes les variables nécessaires.

---

**Temps total : 2-3 minutes** ⏱️

