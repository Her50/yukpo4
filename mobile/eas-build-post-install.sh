#!/usr/bin/env bash
# Script EAS Build hook qui s'exécute APRÈS npm install

set -e

echo "🔧 EAS Build post-install: Fixing Metro exports and worklets..."

# Fix react-native-worklets-core plugin.js FIRST (CRITICAL)
echo "🔧 Fixing react-native-worklets-core plugin.js..."
if [ -f "fix-worklets-core-plugin.js" ]; then
    node fix-worklets-core-plugin.js || {
        echo "❌ Worklets fix failed!"
        exit 1
    }
else
    echo "❌ fix-worklets-core-plugin.js not found!"
    exit 1
fi

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

