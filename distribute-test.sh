#!/bin/bash

# Script de distribution de test pour Yukpo Mobile
# Usage: ./distribute-test.sh [build|upload|deploy]

set -e

BACKEND_URL="https://yukpo-backend-376093909298.europe-west1.run.app"
PROJECT_NAME="yukpomnang-mobile"
VERSION="1.0.0-test"

echo "🚀 Yukpo Mobile - Distribution Test"
echo "=================================="

case "$1" in
    "build")
        echo "📱 Build APK de test..."
        
        # Build avec EAS (profile preview = APK pour test interne)
        npx eas build --platform android --profile preview --non-interactive
        
        echo "✅ Build terminé!"
        echo "📋 L'APK sera disponible dans votre dossier builds/"
        
        ;;
    
    "upload")
        echo "📤 Upload de l'APK vers le backend..."
        
        # Trouver le dernier APK build
        APK_PATH=$(find . -name "*.apk" -type f | head -1)
        
        if [ -z "$APK_PATH" ]; then
            echo "❌ Aucun APK trouvé. Lancez d'abord: ./distribute-test.sh build"
            exit 1
        fi
        
        echo "📁 APK trouvé: $APK_PATH"
        
        # Upload vers GCP (si vous avez gcloud CLI)
        if command -v gcloud &> /dev/null; then
            gsutil cp "$APK_PATH" "gs://yukpo-project-yukpo-backend-media/uploads/yukpo-mobile-test.apk"
            echo "✅ APK uploadé sur GCP Storage!"
        else
            echo "⚠️  gcloud CLI non trouvé. Upload manuel requis:"
            echo "   1. Allez sur: https://console.cloud.google.com/storage/browser/yukpo-project-yukpo-backend-media/uploads"
            echo "   2. Uploadez votre APK: $APK_PATH"
            echo "   3. Renommez-le en: yukpo-mobile-test.apk"
        fi
        
        ;;
    
    "deploy")
        echo "🚀 Déploiement du backend avec les nouvelles routes..."
        
        # Déployer le backend (met à jour les routes de test)
        cd backend
        
        # Build Docker image
        docker build -t yukpo-backend:test .
        
        # Push et déployer sur GCP
        if command -v gcloud &> /dev/null; then
            # Tag pour GCP Artifact Registry
            docker tag yukpo-backend:test europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:test
            
            # Push
            docker push europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:test
            
            # Déployer sur Cloud Run
            gcloud run services update yukpo-backend \
                --region=europe-west1 \
                --image=europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:test \
                --set-env-vars="GOOGLE_MAPS_API_KEY=google-maps-api-key:latest"
            
            echo "✅ Backend déployé!"
        else
            echo "⚠️  gcloud CLI non trouvé. Déploiement manuel requis via GitHub Actions"
        fi
        
        cd ..
        
        ;;
    
    "link")
        echo "🔗 Génération des liens de test..."
        
        echo ""
        echo "📱 Lien direct de téléchargement:"
        echo "   $BACKEND_URL/test-download"
        echo ""
        echo "📱 Lien de l'APK (pour QR code):"
        echo "   $BACKEND_URL/downloads/yukpo-mobile-test.apk"
        echo ""
        echo "📱 Page de test complète:"
        echo "   $BACKEND_URL/test-download"
        echo ""
        
        # Générer QR code si qrencode est disponible
        if command -v qrencode &> /dev/null; then
            echo "📱 Génération du QR code..."
            echo "$BACKEND_URL/test-download" | qrencode -t ANSI -o -
        fi
        
        ;;
    
    "eas-submit")
        echo "📤 Soumission à Google Play Console (Test Interne)..."
        
        # Build et soumission en une commande
        npx eas build --platform android --profile preview --non-interactive
        npx eas submit --platform android --profile preview
        
        echo "✅ Soumis à Google Play Console!"
        echo "📋 Prochaines étapes:"
        echo "   1. Allez sur Google Play Console"
        echo "   2. Section 'Distribution → Tests internes'"
        echo "   3. Ajoutez les emails des testeurs"
        echo "   4. Générez le lien d'invitation opt-in"
        
        ;;
    
    "help"|*)
        echo "Usage: $0 [build|upload|deploy|link|eas-submit|help]"
        echo ""
        echo "Commandes:"
        echo "  build       - Build l'APK de test (EAS preview)"
        echo "  upload      - Upload l'APK vers le backend"
        echo "  deploy      - Déploie le backend avec les routes de test"
        echo "  link        - Affiche les liens de test"
        echo "  eas-submit  - Build et soumet à Google Play Console"
        echo "  help        - Affiche cette aide"
        echo ""
        echo "Recommandation pour test rapide:"
        echo "  1. ./distribute-test.sh build"
        echo "  2. ./distribute-test.sh upload"
        echo "  3. ./distribute-test.sh link"
        echo ""
        echo "Recommandation pour Google Play:"
        echo "  1. ./distribute-test.sh eas-submit"
        echo ""
        ;;
esac

echo ""
echo "✅ Terminé!"
