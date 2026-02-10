#!/bin/bash
# Script pour corriger SSH sur Hetzner - À exécuter directement sur le serveur

set -e

echo "🔧 Configuration SSH Hetzner pour GitHub Actions"
echo ""

# Clé publique GitHub Actions
PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKHCaVguuiUDBqYkqmv5vgve16w1LCoURMXInLYQchKb github-actions-hetzner"

# Vérifier si .ssh existe
if [ ! -d ~/.ssh ]; then
    echo "📁 Création du répertoire .ssh..."
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
fi

# Vérifier si authorized_keys existe
if [ ! -f ~/.ssh/authorized_keys ]; then
    echo "📝 Création du fichier authorized_keys..."
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi

# Vérifier si la clé existe déjà
if grep -q "github-actions-hetzner" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "⚠️ Clé 'github-actions-hetzner' existe déjà"
    echo "🔄 Suppression de l'ancienne clé..."
    grep -v "github-actions-hetzner" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp || true
    mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys
fi

# Ajouter la nouvelle clé
echo "➕ Ajout de la clé publique..."
echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys

# Vérifier les permissions
echo "🔒 Vérification des permissions..."
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Vérifier que la clé est bien ajoutée
if grep -q "github-actions-hetzner" ~/.ssh/authorized_keys; then
    echo ""
    echo "✅ Clé ajoutée avec succès!"
    echo ""
    echo "📋 Clé trouvée dans authorized_keys:"
    grep "github-actions-hetzner" ~/.ssh/authorized_keys
    echo ""
    echo "📊 Permissions:"
    ls -la ~/.ssh/authorized_keys
    ls -ld ~/.ssh
    echo ""
    echo "✅ Configuration SSH terminée!"
else
    echo "❌ Erreur: La clé n'a pas été ajoutée"
    exit 1
fi

