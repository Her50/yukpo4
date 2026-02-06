#!/usr/bin/env bash
# Script EAS Build hook qui s'exécute AVANT npm install
# Nettoie les dossiers de build pour réduire la taille de l'archive

echo "🧹 Nettoyage des dossiers de build Android..."

# Supprimer les dossiers de build Android (605 MB économisés)
if [ -d "android/app/build" ]; then
    echo "  → Suppression de android/app/build (605 MB)"
    rm -rf android/app/build
fi

if [ -d "android/build" ]; then
    echo "  → Suppression de android/build"
    rm -rf android/build
fi

if [ -d "android/.gradle" ]; then
    echo "  → Suppression de android/.gradle"
    rm -rf android/.gradle
fi

# Supprimer les dossiers Expo temporaires
if [ -d ".expo" ]; then
    echo "  → Suppression de .expo"
    rm -rf .expo
fi

if [ -d "dist" ]; then
    echo "  → Suppression de dist"
    rm -rf dist
fi

if [ -d "web-build" ]; then
    echo "  → Suppression de web-build"
    rm -rf web-build
fi

echo "✅ Nettoyage terminé - Archive réduite de ~605 MB"
exit 0

