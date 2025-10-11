#!/usr/bin/env bash
# Script EAS Build hook qui s'exécute APRÈS npm install

set -e

echo "🔧 EAS Build post-install: Fixing Metro exports, worklets and Kotlin version..."

# Note: Kotlin version is now managed automatically by React Native
echo "ℹ️  Kotlin version will be determined automatically by React Native/Expo"

# Note: Reanimated 3.x doesn't need worklets fixes
echo "ℹ️  Using react-native-reanimated 3.x (no worklets dependency needed)"

# Forcer l'exécution des scripts de correction Metro
echo "📦 Running Metro exports fix..."
if [ -f "fix-metro-exports-comprehensive.js" ]; then
    node fix-metro-exports-comprehensive.js || {
        echo "❌ Metro fix failed!"
        exit 1
    }
else
    echo "❌ fix-metro-exports-comprehensive.js not found!"
    exit 1
fi

echo "🔗 Creating Metro private symlinks..."
if [ -f "create-metro-private-links.js" ]; then
    node create-metro-private-links.js || echo "⚠️ Symlinks creation failed (may not be critical)"
fi

echo "✅ EAS Build post-install completed successfully"
exit 0

