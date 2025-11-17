#!/bin/bash
# Script pour configurer l'authentification Git sur Ubuntu

echo "=== Configuration de l'authentification Git ==="

cd /opt/yukpo

echo ""
echo "Choisissez une méthode d'authentification :"
echo "1. Personal Access Token (PAT) - Rapide"
echo "2. SSH - Plus sécurisé (recommandé)"
echo ""
read -p "Votre choix (1 ou 2): " choice

if [ "$choice" = "1" ]; then
    # Option 1 : Personal Access Token
    echo ""
    echo "=== Configuration avec Personal Access Token ==="
    echo ""
    echo "1. Créez un PAT sur GitHub :"
    echo "   https://github.com/settings/tokens"
    echo "   → Generate new token (classic)"
    echo "   → Sélectionner: repo (full control)"
    echo "   → Generate token"
    echo ""
    read -p "2. Collez votre Personal Access Token ici: " TOKEN
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Token vide. Opération annulée."
        exit 1
    fi
    
    # Configurer l'URL Git avec le token
    git remote set-url origin "https://${TOKEN}@github.com/Her50/yukpo4.git"
    
    echo ""
    echo "✅ URL Git configurée avec le PAT"
    echo ""
    echo "3. Test de la connexion..."
    if git fetch > /dev/null 2>&1; then
        echo "✅ Authentification réussie !"
        echo ""
        echo "Vous pouvez maintenant faire :"
        echo "  git push"
    else
        echo "❌ Erreur d'authentification. Vérifiez votre token."
        exit 1
    fi

elif [ "$choice" = "2" ]; then
    # Option 2 : SSH
    echo ""
    echo "=== Configuration SSH ==="
    
    # Vérifier si une clé SSH existe déjà
    if [ -f ~/.ssh/yukpo_github ]; then
        echo "⚠️ Une clé SSH existe déjà: ~/.ssh/yukpo_github"
        read -p "Voulez-vous la réutiliser ? (y/n): " reuse
        if [ "$reuse" != "y" ]; then
            exit 0
        fi
    else
        # Générer une nouvelle clé SSH
        echo "1. Génération d'une nouvelle clé SSH..."
        ssh-keygen -t ed25519 -C "yukpo-ubuntu-server" -f ~/.ssh/yukpo_github -N ""
        echo "✅ Clé SSH générée"
    fi
    
    # Afficher la clé publique
    echo ""
    echo "2. Clé publique SSH (COPIER CETTE CLÉ) :"
    echo "========================================="
    cat ~/.ssh/yukpo_github.pub
    echo "========================================="
    echo ""
    echo "3. Ajoutez cette clé sur GitHub :"
    echo "   https://github.com/settings/ssh/new"
    echo "   → Coller la clé ci-dessus"
    echo "   → Titre: yukpo-ubuntu-server"
    echo "   → Add SSH key"
    echo ""
    read -p "Appuyez sur Entrée une fois la clé ajoutée sur GitHub..."
    
    # Configurer SSH config
    echo "4. Configuration SSH..."
    if [ ! -f ~/.ssh/config ]; then
        touch ~/.ssh/config
        chmod 600 ~/.ssh/config
    fi
    
    # Vérifier si la configuration existe déjà
    if ! grep -q "Host github.com" ~/.ssh/config; then
        cat >> ~/.ssh/config << 'EOF'

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/yukpo_github
    IdentitiesOnly yes
EOF
        echo "✅ Configuration SSH ajoutée"
    else
        echo "⚠️ Configuration SSH existe déjà"
    fi
    
    # Configurer Git pour utiliser SSH
    echo "5. Configuration de l'URL Git..."
    git remote set-url origin git@github.com:Her50/yukpo4.git
    echo "✅ URL Git changée vers SSH"
    
    # Tester la connexion SSH
    echo ""
    echo "6. Test de la connexion SSH..."
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        echo "✅ Authentification SSH réussie !"
        echo ""
        echo "Vous pouvez maintenant faire :"
        echo "  git push"
    else
        echo "❌ Erreur de connexion SSH"
        echo "Vérifiez que la clé a bien été ajoutée sur GitHub"
        exit 1
    fi

else
    echo "❌ Choix invalide"
    exit 1
fi

echo ""
echo "=== Configuration terminée ==="

