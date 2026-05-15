#!/bin/bash
set -e
WELL_KNOWN_DIR="/var/www/yukpomnang.com/.well-known"
NGINX_CONFIG="/etc/nginx/sites-available/yukpomnang.com"

echo "Creation du repertoire..."
sudo mkdir -p $WELL_KNOWN_DIR

if [ ! -f "assetlinks.json" ] || [ ! -f "apple-app-site-association" ]; then
    echo "ERREUR: Fichiers non trouves"
    exit 1
fi

echo "Copie des fichiers..."
sudo cp assetlinks.json $WELL_KNOWN_DIR/assetlinks.json
sudo cp apple-app-site-association $WELL_KNOWN_DIR/apple-app-site-association

echo "Configuration des permissions..."
sudo chmod 644 $WELL_KNOWN_DIR/*
sudo chown www-data:www-data $WELL_KNOWN_DIR/*

echo "Verification Nginx..."
if ! grep -q "location /.well-known/" $NGINX_CONFIG; then
    echo "Ajout de la configuration Nginx..."
    sudo cp $NGINX_CONFIG $NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)
    
    # Ajouter la configuration
    sudo tee -a $NGINX_CONFIG > /dev/null <<EOF

        location /.well-known/ {
            alias /var/www/yukpomnang.com/.well-known/;
            default_type application/json;
            add_header Content-Type application/json;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
            add_header Access-Control-Allow-Origin *;
        }
EOF
fi

echo "Test de la configuration Nginx..."
if sudo nginx -t; then
    echo "Redemarrage de Nginx..."
    sudo systemctl restart nginx
    echo "OK: Deploiement termine avec succes"
else
    echo "ERREUR: Configuration Nginx invalide"
    exit 1
fi