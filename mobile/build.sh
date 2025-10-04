#!/bin/bash

echo "🚀 Building Yukpomnang Mobile App..."

# Vérifier les variables d'environnement
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env manquant. Création depuis .env.example..."
    cp .env.example .env
fi

# Nettoyer le cache
echo "🧹 Nettoyage du cache..."
npx expo start --clear-cache &
sleep 5
kill $!

# Lancer le build
echo "🏗️  Lancement du build Android..."
npx eas build --platform android --profile preview --clear-cache

echo "✅ Build lancé ! Consultez les logs sur Expo.dev"
