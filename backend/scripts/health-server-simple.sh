#!/bin/bash
# Serveur HTTP minimal ultra-simple pour health check Cloud Run
# Utilise netcat (nc) ou socat pour répondre immédiatement

PORT=${PORT:-8080}

# Créer un script qui répond HTTP 200 OK
HTTP_RESPONSE="HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"

# Utiliser socat si disponible
if command -v socat >/dev/null 2>&1; then
    echo "🚀 [HEALTH] Démarrage serveur HTTP minimal avec socat sur port $PORT..."
    # Créer un script temporaire pour socat
    cat > /tmp/health-responder.sh << 'EOF'
#!/bin/bash
echo -en "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK"
EOF
    chmod +x /tmp/health-responder.sh
    exec socat TCP-LISTEN:$PORT,fork,reuseaddr EXEC:/tmp/health-responder.sh
# Sinon utiliser netcat si disponible
elif command -v nc >/dev/null 2>&1; then
    echo "🚀 [HEALTH] Démarrage serveur HTTP minimal avec netcat sur port $PORT..."
    while true; do
        echo -en "$HTTP_RESPONSE" | nc -l -p $PORT -q 1
    done
else
    echo "❌ [HEALTH] Erreur: ni socat ni netcat disponibles"
    exit 1
fi

