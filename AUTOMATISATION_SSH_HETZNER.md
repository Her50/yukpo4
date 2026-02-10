# 🤖 Automatisation SSH Hetzner - 100% Automatique

## ✅ Solution Automatisée

J'ai créé un workflow GitHub Actions qui configure automatiquement SSH sur Hetzner **sans aucune intervention manuelle**.

## 🔧 Méthodes d'authentification supportées

Le workflow essaie automatiquement plusieurs méthodes dans l'ordre :

### 1. **Mot de passe root** (Recommandé pour bootstrap initial)
- Secret GitHub : `HETZNER_ROOT_PASSWORD`
- Utilise `sshpass` pour authentification automatique
- Configure la clé SSH GitHub Actions
- **Une seule fois nécessaire** - après, SSH fonctionne avec la clé

### 2. **Clé SSH existante** (Si vous avez déjà accès)
- Secret GitHub : `HETZNER_SSH_PRIVATE_KEY` (une autre clé qui fonctionne déjà)
- Utilise cette clé pour se connecter et configurer la nouvelle clé
- **Solution de secours** si le mot de passe n'est pas disponible

### 3. **API Hetzner Cloud** (Si vous avez un token API)
- Secret GitHub : `HETZNER_API_TOKEN`
- Utilise l'API Hetzner Cloud pour gérer le serveur
- **Optionnel** - pour gestion avancée

## 🚀 Utilisation

### Option 1 : Avec mot de passe (Plus simple)

1. **Ajouter le secret dans GitHub** :
   - https://github.com/Her50/yukpo4/settings/secrets/actions
   - Cliquez sur "New repository secret"
   - Nom : `HETZNER_ROOT_PASSWORD`
   - Valeur : Le mot de passe root de votre serveur Hetzner
   - Cliquez sur "Add secret"

2. **Déclencher le workflow** :
   - https://github.com/Her50/yukpo4/actions/workflows/setup-hetzner-ssh-auto.yml
   - Cliquez sur "Run workflow" → "Run workflow"

3. **C'est tout !** Le workflow va :
   - Se connecter avec le mot de passe
   - Ajouter automatiquement la clé SSH GitHub Actions
   - Configurer les permissions
   - Vérifier que tout fonctionne

### Option 2 : Avec clé SSH existante

Si vous avez déjà une clé SSH qui fonctionne sur Hetzner :

1. **Ajouter cette clé dans GitHub Secrets** :
   - Nom : `HETZNER_SSH_PRIVATE_KEY` (ou un autre nom)
   - Valeur : Le contenu de votre clé privée qui fonctionne déjà

2. **Déclencher le workflow** :
   - Le workflow utilisera cette clé pour se connecter et configurer la nouvelle clé GitHub Actions

## 📋 Secrets GitHub nécessaires

| Secret | Description | Obligatoire |
|--------|-------------|-------------|
| `HETZNER_ROOT_PASSWORD` | Mot de passe root Hetzner | **Oui** (pour bootstrap) |
| `HETZNER_SSH_PRIVATE_KEY` | Clé SSH GitHub Actions | Oui (pour déploiements) |
| `HETZNER_API_TOKEN` | Token API Hetzner Cloud | Non (optionnel) |

## ✅ Après exécution

Une fois le workflow exécuté avec succès :
- ✅ La clé SSH GitHub Actions est configurée sur Hetzner
- ✅ Les permissions SSH sont correctes
- ✅ Les workflows de déploiement fonctionneront automatiquement
- ✅ **Plus besoin d'intervention manuelle !**

## 🔄 Workflows qui bénéficient de cette automatisation

Après cette configuration, ces workflows fonctionneront automatiquement :
- `docker-build-optimized.yml` → Déploiement automatique sur Hetzner
- `deploy-env-hetzner.yml` → Déploiement automatique du fichier .env

## 🛡️ Sécurité

- Le mot de passe n'est utilisé **qu'une seule fois** pour configurer SSH
- Après configuration, seul SSH avec clé fonctionne
- Le mot de passe peut être supprimé des secrets GitHub après configuration
- Tous les secrets sont stockés de manière sécurisée dans GitHub Secrets

## 📝 Notes

- **Le workflow s'exécute automatiquement** lors d'un push sur main/master
- **Ou manuellement** via "Run workflow"
- **Aucune intervention manuelle** nécessaire après configuration initiale

