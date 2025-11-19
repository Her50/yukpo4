# 🔑 Guide: Configuration SSH Sans Mot de Passe pour Hetzner

## 🎯 Objectif

Éviter de saisir le mot de passe à chaque connexion SSH à Hetzner en utilisant une clé SSH.

---

## 📋 MÉTHODE 1 : Génération et Configuration Manuelle (Recommandée)

### Étape 1 : Générer une clé SSH sur Windows

```powershell
# Ouvrir PowerShell sur Windows

# 1. Générer une clé SSH ED25519 (plus sécurisée que RSA)
ssh-keygen -t ed25519 -C "yukpo-hetzner" -f $HOME\.ssh\id_ed25519_hetzner

# Si le répertoire .ssh n'existe pas, il sera créé automatiquement
```

**Réponses aux questions**:
- **Passphrase**: Entrer un mot de passe fort (ou laisser vide pour aucune passphrase)
- Confirmer le passphrase

### Étape 2 : Afficher la clé publique

```powershell
# Afficher la clé publique à copier
cat $HOME\.ssh\id_ed25519_hetzner.pub

# OU ouvrir dans Notepad
notepad $HOME\.ssh\id_ed25519_hetzner.pub
```

**📋 Copier TOUT le contenu** (commence par `ssh-ed25519 ...`)

### Étape 3 : Ajouter la clé publique sur Hetzner

```bash
# 1. Se connecter à Hetzner (avec mot de passe cette fois)
ssh root@46.224.14.85

# 2. Créer le répertoire .ssh s'il n'existe pas
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 3. Ajouter la clé publique dans authorized_keys
echo "[COLLER LA CLÉ PUBLIQUE ICI]" >> ~/.ssh/authorized_keys

# OU utiliser nano pour éditer
nano ~/.ssh/authorized_keys
# Coller la clé publique, sauvegarder (Ctrl+O, Enter, Ctrl+X)

# 4. Définir les permissions correctes
chmod 600 ~/.ssh/authorized_keys

# 5. Vérifier
cat ~/.ssh/authorized_keys

# 6. Se déconnecter
exit
```

### Étape 4 : Tester la connexion sans mot de passe

```powershell
# Sur Windows, tester avec la clé privée
ssh -i $HOME\.ssh\id_ed25519_hetzner root@46.224.14.85

# Si tout fonctionne, vous ne devriez PAS être demandé le mot de passe
```

---

## 📋 MÉTHODE 2 : Utiliser SSH-Config pour Simplifier (Recommandée)

### Étape 1 : Créer/Mettre à jour ~/.ssh/config

```powershell
# Sur Windows, éditer le fichier config
notepad $HOME\.ssh\config
```

**Ajouter ce contenu** (créer le fichier s'il n'existe pas):

```
Host hetzner-yukpo
    HostName 46.224.14.85
    User root
    IdentityFile ~/.ssh/id_ed25519_hetzner
    StrictHostKeyChecking no
    UserKnownHostsFile ~/.ssh/known_hosts
```

### Étape 2 : Utiliser l'alias

```powershell
# Maintenant, connectez-vous simplement avec:
ssh hetzner-yukpo

# Plus besoin de spécifier l'utilisateur, l'IP, ou la clé !
```

---

## 📋 MÉTHODE 3 : Utiliser ssh-copy-id (si disponible)

Si vous avez `ssh-copy-id` installé (sur WSL ou Git Bash):

```bash
# Installer ssh-copy-id sur WSL Ubuntu
sudo apt install openssh-client

# Copier automatiquement la clé
ssh-copy-id -i ~/.ssh/id_ed25519_hetzner.pub root@46.224.14.85

# Tester
ssh root@46.224.14.85
```

---

## 🔧 Dépannage

### Problème 1 : "Permission denied (publickey)"

**Solutions**:
```bash
# Sur Hetzner, vérifier les permissions
ssh root@46.224.14.85
ls -la ~/.ssh/
# authorized_keys doit être 600
# .ssh/ doit être 700

# Corriger si nécessaire
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Problème 2 : La clé n'est pas utilisée

**Solutions**:
```powershell
# Vérifier que la clé est ajoutée à l'agent SSH
ssh-add $HOME\.ssh\id_ed25519_hetzner

# Voir les clés chargées
ssh-add -l

# Tester avec verbose pour voir quelle clé est utilisée
ssh -v hetzner-yukpo
```

### Problème 3 : Toujours demandé le mot de passe

**Solutions**:
```bash
# Sur Hetzner, vérifier que la clé publique est bien dans authorized_keys
cat ~/.ssh/authorized_keys

# Vérifier les logs SSH sur Hetzner
sudo tail -f /var/log/auth.log
# Puis essayer de se connecter depuis Windows
# Regarder les messages d'erreur dans les logs
```

### Problème 4 : Erreur "host key verification failed"

**Solutions**:
```powershell
# Supprimer l'ancienne clé du known_hosts
ssh-keygen -R 46.224.14.85

# Ou dans le fichier config, ajouter:
# StrictHostKeyChecking no
# UserKnownHostsFile ~/.ssh/known_hosts
```

---

## ✅ Vérification Finale

### Sur Windows

```powershell
# 1. Vérifier que la clé existe
ls $HOME\.ssh\id_ed25519_hetzner*

# 2. Tester la connexion
ssh hetzner-yukpo

# 3. Si ça fonctionne, vous devriez être connecté sans mot de passe !
```

### Sur Hetzner

```bash
# Vérifier que la clé est bien ajoutée
cat ~/.ssh/authorized_keys

# Doit afficher votre clé publique (commence par ssh-ed25519 ...)
```

---

## 🔐 Sécurité

### Recommandations

1. **Utiliser un passphrase fort** pour la clé privée (ou utiliser un gestionnaire de mots de passe)
2. **Ne jamais partager la clé privée** (`id_ed25519_hetzner` sans `.pub`)
3. **Limiter l'accès SSH** sur Hetzner si possible (firewall, IP whitelist)
4. **Désactiver l'authentification par mot de passe** une fois la clé configurée (optionnel)

### Désactiver l'authentification par mot de passe (Optionnel - Avancé)

```bash
# Sur Hetzner, éditer /etc/ssh/sshd_config
sudo nano /etc/ssh/sshd_config

# Modifier:
PasswordAuthentication no
PubkeyAuthentication yes

# Redémarrer SSH
sudo systemctl restart sshd
```

⚠️ **ATTENTION**: Ne faites cela QUE si vous êtes sûr que la clé SSH fonctionne, sinon vous serez bloqué !

---

## 📝 Résumé des Commandes Rapides

### Windows (première fois)

```powershell
# Générer la clé
ssh-keygen -t ed25519 -C "yukpo-hetzner" -f $HOME\.ssh\id_ed25519_hetzner

# Afficher la clé publique (à copier)
cat $HOME\.ssh\id_ed25519_hetzner.pub

# Créer le fichier config
notepad $HOME\.ssh\config
# Ajouter la configuration (voir Méthode 2 ci-dessus)

# Ajouter la clé à l'agent
ssh-add $HOME\.ssh\id_ed25519_hetzner

# Tester
ssh hetzner-yukpo
```

### Hetzner (première fois)

```bash
# Se connecter avec mot de passe
ssh root@46.224.14.85

# Ajouter la clé publique
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "[COLLER LA CLÉ PUBLIQUE]" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Vérifier
cat ~/.ssh/authorized_keys

# Se déconnecter
exit
```

### Windows (utilisation quotidienne)

```powershell
# Se connecter (sans mot de passe maintenant !)
ssh hetzner-yukpo

# C'est tout ! 🎉
```

---

**Une fois configuré, vous n'aurez plus besoin de saisir le mot de passe à chaque connexion SSH.**

