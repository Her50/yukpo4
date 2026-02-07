#!/bin/bash
# Script bash pour obtenir le SHA-1 fingerprint Android
# Usage: ./scripts/get-sha1-fingerprint.sh [debug|release] [keystore-path] [alias] [password]

BUILD_TYPE=${1:-debug}

echo "🔍 Obtention du SHA-1 fingerprint pour Android..."
echo ""

if [ "$BUILD_TYPE" = "debug" ]; then
    # Keystore de debug par défaut
    DEBUG_KEYSTORE="$HOME/.android/debug.keystore"
    
    if [ -f "$DEBUG_KEYSTORE" ]; then
        echo "✅ Keystore de debug trouvé: $DEBUG_KEYSTORE"
        echo ""
        echo "📋 SHA-1 Fingerprint (Debug):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        keytool -list -v -keystore "$DEBUG_KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep -A 1 "SHA1:" | tail -1 | sed 's/.*SHA1: //' | tr -d ' '
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Copiez ce SHA-1 dans Google Cloud Console > OAuth 2.0 Client IDs > Android Client"
        else
            echo "❌ Erreur lors de l'exécution de keytool"
            echo "💡 Assurez-vous que Java JDK est installé et que keytool est dans votre PATH"
        fi
    else
        echo "❌ Keystore de debug introuvable: $DEBUG_KEYSTORE"
        echo ""
        echo "💡 Le keystore de debug sera créé automatiquement lors du premier build Android"
    fi
else
    # Keystore de release
    KEYSTORE_PATH=$2
    ALIAS=$3
    PASSWORD=$4
    
    if [ -z "$KEYSTORE_PATH" ] || [ -z "$ALIAS" ] || [ -z "$PASSWORD" ]; then
        echo "❌ Pour le build release, vous devez spécifier le keystore, l'alias et le mot de passe"
        echo ""
        echo "Usage: ./scripts/get-sha1-fingerprint.sh release <keystore-path> <alias> <password>"
        exit 1
    fi
    
    if [ ! -f "$KEYSTORE_PATH" ]; then
        echo "❌ Keystore introuvable: $KEYSTORE_PATH"
        exit 1
    fi
    
    echo "✅ Keystore de release trouvé: $KEYSTORE_PATH"
    echo ""
    echo "📋 SHA-1 Fingerprint (Release):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$ALIAS" -storepass "$PASSWORD" -keypass "$PASSWORD" 2>/dev/null | grep -A 1 "SHA1:" | tail -1 | sed 's/.*SHA1: //' | tr -d ' '
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Copiez ce SHA-1 dans Google Cloud Console > OAuth 2.0 Client IDs > Android Client"
    else
        echo "❌ Erreur lors de l'exécution de keytool"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation:"
echo "   Guide complet: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md"
echo "   Google Cloud Console: https://console.cloud.google.com/apis/credentials"

