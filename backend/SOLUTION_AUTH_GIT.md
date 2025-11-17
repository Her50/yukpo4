# 🔐 Solution pour l'Erreur d'Authentification Git

## ❌ Erreur

```
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/Her50/yukpo4.git/'
```

## 🔍 Cause

GitHub n'accepte plus l'authentification par mot de passe. Il faut utiliser un **Personal Access Token (PAT)** ou configurer SSH.

## ✅ Solution : Utiliser un Personal Access Token (PAT)

### Étape 1 : Créer un PAT sur GitHub

1. Aller sur GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Cliquer sur "Generate new token (classic)"
3. Nommer le token (ex: "yukpo-ubuntu-server")
4. Sélectionner les permissions : `repo` (full control of private repositories)
5. Cliquer sur "Generate token"
6. **COPIER LE TOKEN** (il ne sera affiché qu'une seule fois !)

### Étape 2 : Configurer Git sur Ubuntu

```bash
# Méthode 1 : Utiliser le PAT dans l'URL (simple mais moins sécurisé)
cd /opt/yukpo
git remote set-url origin https://<TOKEN>@github.com/Her50/yukpo4.git

# Méthode 2 : Utiliser git credential helper (recommandé)
git config --global credential.helper store
# Puis au prochain push, Git demandera username/password
# Username: Her50
# Password: <votre_PAT>

# Méthode 3 : Utiliser SSH (le plus sécurisé - voir section suivante)
```

### Étape 3 : Push avec le PAT

```bash
cd /opt/yukpo
git add backend/.sqlx/
git commit -m "chore: update sqlx cache"
git push
# Username: Her50
# Password: <votre_PAT>
```

## 🔐 Solution Alternative : Configuration SSH (Recommandé)

### Étape 1 : Générer une clé SSH

```bash
ssh-keygen -t ed25519 -C "yukpo-ubuntu-server" -f ~/.ssh/yukpo_github
# Appuyer sur Entrée pour accepter le chemin par défaut
# Optionnel: Entrer une passphrase
```

### Étape 2 : Afficher la clé publique

```bash
cat ~/.ssh/yukpo_github.pub
# Copier cette clé
```

### Étape 3 : Ajouter la clé sur GitHub

1. Aller sur GitHub → Settings → SSH and GPG keys
2. Cliquer sur "New SSH key"
3. Titre: "yukpo-ubuntu-server"
4. Coller la clé publique
5. Cliquer sur "Add SSH key"

### Étape 4 : Configurer Git pour utiliser SSH

```bash
cd /opt/yukpo
git remote set-url origin git@github.com:Her50/yukpo4.git

# Tester la connexion
ssh -T git@github.com
# Devrait afficher: "Hi Her50! You've successfully authenticated..."
```

### Étape 5 : Configurer SSH pour utiliser la clé

```bash
# Créer/modifier ~/.ssh/config
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/yukpo_github
    IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

## 🚀 Après Configuration : Push le Cache SQLx

Une fois l'authentification configurée :

```bash
cd /opt/yukpo/backend

# 1. Identifier les fichiers obsolètes (si nécessaire)
chmod +x find-obsolete-sqlx-files.sh
./find-obsolete-sqlx-files.sh

# 2. Ajouter les nouveaux fichiers
git add backend/.sqlx/

# 3. Commiter
git commit -m "chore: update sqlx cache"

# 4. Push (avec authentification configurée)
git push
```

## 🔍 Vérification

```bash
# Vérifier la configuration Git
git remote -v
# Doit afficher l'URL correcte

# Vérifier les fichiers dans Git
git ls-files backend/.sqlx | wc -l
# Doit afficher le nombre de fichiers attendu
```

