# 🚀 Commandes Rapides pour Ubuntu

## 🔐 1. Résoudre l'Erreur d'Authentification Git

### Option A : Personal Access Token (Rapide)

```bash
cd /opt/yukpo

# Remplacer <TOKEN> par votre Personal Access Token GitHub
git remote set-url origin https://<TOKEN>@github.com/Her50/yukpo4.git

# Tester
git fetch
```

### Option B : SSH (Recommandé pour sécurité)

```bash
# Générer une clé SSH
ssh-keygen -t ed25519 -C "yukpo-server" -f ~/.ssh/yukpo_github -N ""

# Afficher la clé publique (à ajouter sur GitHub)
cat ~/.ssh/yukpo_github.pub

# Configurer SSH
cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/yukpo_github
    IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config

# Configurer Git pour utiliser SSH
cd /opt/yukpo
git remote set-url origin git@github.com:Her50/yukpo4.git

# Tester
ssh -T git@github.com
```

## 📦 2. Mettre à Jour le Cache SQLx et Push

```bash
cd /opt/yukpo/backend

# Exporter DATABASE_URL
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false

# Régénérer le cache complet
rm -rf .sqlx
cargo sqlx prepare -- --lib
cargo sqlx prepare --workspace

# Vérifier
find .sqlx -type f | wc -l
# Doit afficher ~212 fichiers

# Ajouter à Git
cd /opt/yukpo
git add backend/.sqlx/
git commit -m "chore: update sqlx cache - $(date +%Y%m%d)"
git push
```

## 🐳 3. Build Docker

```bash
cd /opt/yukpo/backend
docker build -f Dockerfile -t yukpo-backend:latest .
```

## 🔍 4. Identifier les Fichiers Obsolètes (Si Nécessaire)

```bash
cd /opt/yukpo/backend
chmod +x find-obsolete-sqlx-files.sh
./find-obsolete-sqlx-files.sh

# Voir les résultats
cat obsolete-files.txt  # Fichiers dans Git mais obsolètes
cat missing-in-git.txt  # Fichiers générés mais pas dans Git
```

