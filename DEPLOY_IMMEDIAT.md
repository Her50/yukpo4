# 🚀 Déploiement Immédiat .env sur Hetzner

## ✅ Solution : GitHub Actions (1 clic)

Les connexions SSH depuis Windows se bloquent. La solution est d'utiliser **GitHub Actions** qui fonctionne avec Ubuntu (comme tous vos autres déploiements).

## 🎯 Déploiement en 1 clic

### Étape 1 : Ouvrir la page

Le script a ouvert cette page dans votre navigateur :
**https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml**

### Étape 2 : Cliquer sur "Run workflow"

1. Cliquez sur le bouton **"Run workflow"** (en haut à droite, à côté de "Actions")
2. Cliquez sur le bouton vert **"Run workflow"** dans le menu déroulant
3. Attendez 2-3 minutes

## ✅ Ce qui se passe automatiquement

Le workflow GitHub Actions va :

1. ✅ Se connecter à AWS pour récupérer toutes les variables
2. ✅ Les adapter pour Hetzner :
   - `DATABASE_URL` → `postgresql://user:pass@postgres:5432/dbname`
   - `REDIS_URL` → `redis://redis:6379/0`
   - S3 → Wasabi
   - URLs → Hetzner (LiveKit, SRS, Video Renderer)
3. ✅ Copier le fichier `.env` sur Hetzner via SSH (Ubuntu)
4. ✅ Vérifier que le fichier est bien créé

## 🔍 Vérification

Après 2-3 minutes, vous verrez dans GitHub Actions :
- ✅ Nombre de lignes dans le fichier `.env`
- ✅ Statut de déploiement
- ✅ Premières lignes (valeurs masquées)

## 📝 Note

C'est la méthode la plus fiable car :
- ✅ Utilise Ubuntu (comme vos autres workflows)
- ✅ Pas de blocage SSH
- ✅ 100% automatique
- ✅ Vérifié et sécurisé

---

**Temps total : 2-3 minutes** ⏱️

