# 🔑 Comment Obtenir le Mot de Passe Root Hetzner

## 📋 Méthodes pour Obtenir/Réinitialiser le Mot de Passe

### Méthode 1 : Email de Création (Si serveur récent)

Si vous avez créé le serveur récemment :
1. **Vérifiez votre email** (celui utilisé pour créer le compte Hetzner)
2. **Cherchez l'email** de Hetzner avec le sujet "Your server is ready" ou "Server credentials"
3. Le mot de passe root est généralement dans cet email

### Méthode 2 : Panel Hetzner Cloud (Recommandé)

1. **Connectez-vous au panel Hetzner** :
   - https://console.hetzner.cloud/
   - Connectez-vous avec vos identifiants

2. **Trouvez votre serveur** :
   - Cliquez sur "Servers" dans le menu
   - Trouvez le serveur avec l'IP `46.224.14.85`
   - Cliquez sur le nom du serveur

3. **Réinitialiser le mot de passe** :
   - Allez dans l'onglet "Rescue" ou "Reset"
   - Cliquez sur "Reset root password" ou "Enable rescue system"
   - Hetzner va générer un nouveau mot de passe
   - **Le mot de passe sera affiché dans le panel** (copiez-le immédiatement !)
   - Il peut aussi être envoyé par email

### Méthode 3 : Via l'API Hetzner Cloud (Automatique)

Si vous avez un token API Hetzner :

```bash
# Installer Hetzner CLI
curl -fsSL https://github.com/hetznercloud/cli/releases/latest/download/hcloud-linux-amd64.tar.gz | tar -xz
sudo mv hcloud /usr/local/bin/

# Configurer avec votre token API
hcloud context create my-context
# Entrez votre token API quand demandé

# Réinitialiser le mot de passe pour le serveur
hcloud server reset-password --name "votre-serveur" --output json
```

### Méthode 4 : Si vous avez déjà accès SSH

Si vous pouvez vous connecter avec une clé SSH existante :

```bash
# Se connecter au serveur
ssh root@46.224.14.85

# Changer le mot de passe root
passwd root
# Entrez le nouveau mot de passe deux fois
```

### Méthode 5 : Via Rescue Mode (Si accès perdu)

1. **Dans le panel Hetzner** :
   - Allez sur votre serveur
   - Cliquez sur "Rescue" dans le menu
   - Activez le mode Rescue
   - Redémarrez le serveur

2. **Connectez-vous en Rescue** :
   - Hetzner vous donnera un mot de passe temporaire
   - Connectez-vous via SSH avec ce mot de passe

3. **Réinitialiser le mot de passe root** :
   ```bash
   mount /dev/sda1 /mnt
   chroot /mnt
   passwd root
   # Entrez le nouveau mot de passe
   exit
   reboot
   ```

## 🚀 Solution Automatique : Créer un Token API Hetzner

**Alternative recommandée** : Utiliser un token API au lieu du mot de passe :

1. **Créer un token API** :
   - https://console.hetzner.cloud/
   - Allez dans "Security" → "API Tokens"
   - Cliquez sur "Generate API token"
   - Donnez-lui un nom (ex: "github-actions")
   - Copiez le token (affiché une seule fois !)

2. **Ajouter dans GitHub Secrets** :
   - Nom : `HETZNER_API_TOKEN`
   - Valeur : Le token API que vous venez de créer

3. **Le workflow utilisera l'API** au lieu du mot de passe

## 📝 Où Trouver les Informations

### Panel Hetzner Cloud
- URL : https://console.hetzner.cloud/
- Section : "Servers" → Votre serveur → "Reset" ou "Rescue"

### Email Hetzner
- Vérifiez votre boîte email (spam aussi)
- Recherchez : "Hetzner", "server", "credentials", "password"

### Support Hetzner
- Si vous ne trouvez pas : https://console.hetzner.cloud/support
- Ils peuvent vous aider à réinitialiser le mot de passe

## ✅ Après Avoir Obtenu le Mot de Passe

1. **Ajoutez-le dans GitHub Secrets** :
   - https://github.com/Her50/yukpo4/settings/secrets/actions
   - Nom : `HETZNER_ROOT_PASSWORD`
   - Valeur : Le mot de passe root

2. **Déclenchez le workflow** :
   - https://github.com/Her50/yukpo4/actions/workflows/setup-hetzner-ssh-auto.yml
   - Cliquez sur "Run workflow"

## 🔒 Sécurité

⚠️ **Important** :
- Le mot de passe ne sera utilisé **qu'une seule fois** pour configurer SSH
- Après configuration, seul SSH avec clé fonctionnera
- Vous pouvez supprimer le secret `HETZNER_ROOT_PASSWORD` après la première exécution réussie

## 💡 Alternative : Utiliser une Clé SSH Existante

Si vous avez déjà une clé SSH qui fonctionne sur Hetzner :
- Ajoutez-la dans GitHub Secrets comme `HETZNER_SSH_PRIVATE_KEY`
- Le workflow l'utilisera pour configurer la nouvelle clé GitHub Actions
- **Pas besoin de mot de passe !**

