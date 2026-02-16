#!/bin/bash

# 🚀 Serveur HTTP minimal pour health check Cloud Run
# Démarre AVANT l'application Rust pour répondre immédiatement aux startup probes

PORT=${PORT:-8080}

echo "🚀 [HEALTH_SERVER] Démarrage serveur HTTP minimal sur port $PORT..."

# Fonction pour répondre aux requêtes HTTP
respond_http() {
    while IFS= read -r line; do
        # Lire la requête HTTP
        if echo "$line" | grep -q "GET /health"; then
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"
        elif echo "$line" | grep -q "GET /healthz"; then
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"
        elif [ -z "$line" ]; then
            # Ligne vide = fin de requête, on peut répondre
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"
        fi
    done
}

# Utiliser socat pour écouter sur le port et répondre
socat TCP-LISTEN:$PORT,fork,reuseaddr EXEC:"bash -c 'read request; echo -e \"HTTP/1.1 200 OK\\r\\nContent-Type: text/plain\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\nOK\"'"

