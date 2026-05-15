#!/bin/bash
set -e

echo "========================================"
echo "DEPLOIEMENT .well-known"
echo "========================================"

# Créer le répertoire
sudo mkdir -p /var/www/yukpomnang.com/.well-known

# Créer assetlinks.json
sudo tee /var/www/yukpomnang.com/.well-known/assetlinks.json > /dev/null << 'EOF'
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yukpomnang.mobile",
    "sha256_cert_fingerprints": [
      "7C:4F:6C:46:D0:59:C9:D1:BC:D0:FE:95:C9:6C:41:ED:19:EC:61:98:1B:5A:81:8E:FA:7F:EF:7C:50:91:7C:1E",
      "SHA256_FINGERPRINT_RELEASE"
    ]
  }
}]
EOF

# Créer apple-app-site-association
sudo tee /var/www/yukpomnang.com/.well-known/apple-app-site-association > /dev/null << 'EOF'
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.yukpomnang.mobile",
        "paths": [
          "/product/*",
          "/service/*"
        ]
      }
    ]
  }
}
EOF

# Permissions
sudo chmod 644 /var/www/yukpomnang.com/.well-known/*
sudo chown www-data:www-data /var/www/yukpomnang.com/.well-known/*

# Configurer Nginx
NGINX_CONFIG="/etc/nginx/sites-available/yukpomnang.com"
if [ -f "$NGINX_CONFIG" ]; then
    if ! grep -q "location /.well-known/" "$NGINX_CONFIG"; then
        echo "Ajout de la configuration Nginx..."
        sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Ajouter la configuration avant "Fichiers statiques"
        sudo sed -i '/# Fichiers statiques avec cache/i\
        # ✅ CRITIQUE : Servir les fichiers .well-known pour Universal Links / App Links\
        location /.well-known/ {\
            alias /var/www/yukpomnang.com/.well-known/;\
            default_type application/json;\
            add_header Content-Type application/json;\
            add_header Cache-Control "no-cache, no-store, must-revalidate";\
            add_header Pragma "no-cache";\
            add_header Expires "0";\
            add_header Access-Control-Allow-Origin *;\
            access_log /var/log/nginx/well-known-access.log;\
        }\
' "$NGINX_CONFIG"
        echo "✅ Configuration Nginx ajoutée"
    else
        echo "✅ Configuration Nginx déjà présente"
    fi
else
    echo "⚠️  Fichier Nginx non trouvé: $NGINX_CONFIG"
    echo "   Vous devrez configurer Nginx manuellement"
fi

# Tester et redémarrer Nginx
if sudo nginx -t; then
    echo "✅ Configuration Nginx valide"
    sudo systemctl restart nginx
    echo "✅ Nginx redémarré"
else
    echo "❌ ERREUR: Configuration Nginx invalide"
    exit 1
fi

echo ""
echo "========================================"
echo "DEPLOIEMENT TERMINE !"
echo "========================================"
echo ""
echo "Fichiers créés :"
ls -la /var/www/yukpomnang.com/.well-known/
echo ""
echo "Vérification :"
echo "  curl https://yukpomnang.com/.well-known/assetlinks.json"
echo "  curl https://yukpomnang.com/.well-known/apple-app-site-association"

