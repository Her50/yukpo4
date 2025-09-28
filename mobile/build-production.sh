#!/bin/bash
# Script de build mobile pour production

echo "🚀 Building mobile app for production..."

# Vérifier que les variables d'environnement sont définies
if [ -z "$EXPO_PUBLIC_API_URL" ]; then
    echo "⚠️  EXPO_PUBLIC_API_URL not set, using default"
    export EXPO_PUBLIC_API_URL="https://yukpomnang.onrender.com"
fi

if [ -z "$EXPO_PUBLIC_ENVIRONMENT" ]; then
    echo "⚠️  EXPO_PUBLIC_ENVIRONMENT not set, using production"
    export EXPO_PUBLIC_ENVIRONMENT="production"
fi

echo "📱 API URL: $EXPO_PUBLIC_API_URL"
echo "🌍 Environment: $EXPO_PUBLIC_ENVIRONMENT"

# Installer les dépendances
echo "📦 Installing dependencies..."
npm install

# Build pour production
echo "🔨 Building for production..."
npx expo build:android --type apk --release-channel production

echo "✅ Build completed!"
echo "📱 APK location: android/app/build/outputs/apk/release/app-release.apk"
