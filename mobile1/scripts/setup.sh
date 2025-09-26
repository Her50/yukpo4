#!/bin/bash

# Script de configuration pour Yukpomnang Mobile
# Ce script configure l'environnement de développement

echo "🚀 Configuration de Yukpomnang Mobile..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js v16 ou plus récent."
    exit 1
fi

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé."
    exit 1
fi

# Vérifier Expo CLI
if ! command -v expo &> /dev/null; then
    echo "📦 Installation d'Expo CLI..."
    npm install -g @expo/cli
fi

# Vérifier EAS CLI
if ! command -v eas &> /dev/null; then
    echo "📦 Installation d'EAS CLI..."
    npm install -g @expo/eas-cli
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp env.example .env
    echo "⚠️  Veuillez configurer vos clés API dans le fichier .env"
fi

# Vérifier la configuration
echo "🔍 Vérification de la configuration..."

# Vérifier app.json
if [ ! -f app.json ]; then
    echo "❌ Fichier app.json manquant"
    exit 1
fi

# Vérifier eas.json
if [ ! -f eas.json ]; then
    echo "❌ Fichier eas.json manquant"
    exit 1
fi

echo "✅ Configuration terminée !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Configurez vos clés API dans le fichier .env"
echo "2. Connectez-vous à Expo : eas login"
echo "3. Configurez EAS : eas build:configure"
echo "4. Lancez l'application : npm start"
echo ""
echo "📚 Documentation :"
echo "- README.md : Guide d'utilisation"
echo "- DEPLOYMENT.md : Guide de déploiement"
echo ""
echo "🎉 Bon développement !"

