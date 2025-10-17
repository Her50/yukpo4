#!/bin/bash
# Script de debug forcé pour Yukpomnang Mobile

echo "🔧 NETTOYAGE COMPLET..."

# Tuer tous les processus Metro/Expo
echo "Arrêt des processus existants..."
pkill -f "expo" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

# Nettoyer le cache
echo "Nettoyage du cache..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

# Nettoyer watchman si disponible
watchman watch-del-all 2>/dev/null || true

echo "✅ Nettoyage terminé"
echo ""
echo "🚀 DÉMARRAGE EN MODE DEBUG FORCÉ..."
echo ""

# Démarrer avec toutes les options de debug
export EXPO_DEBUG=true
export DEBUG=expo:*
export REACT_DEBUGGER="unset"

npx expo start --clear --dev-client --port 8081

echo ""
echo "📱 Options de debug :"
echo "  - Appuyez sur 'd' pour ouvrir les outils de développement"
echo "  - Appuyez sur 'j' pour ouvrir le debugger"
echo "  - Appuyez sur 'r' pour recharger"
echo "  - Appuyez sur 'm' pour basculer le menu"

