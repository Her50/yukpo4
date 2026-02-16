#!/bin/bash
# Serveur HTTP minimal ultra-simple pour health check Cloud Run
# Utilise netcat (nc) ou socat pour répondre immédiatement

PORT=${PORT:-8080}

# Fonction pour répondre HTTP 200 OK
respond_ok() {
    echo -en "HTTP/1.1 200 OK\r\n"
    echo -en "Content-Type: text/plain\r\n"
    echo -en "Content-Length: 2\r\n"
    echo -en "Connection: close\r\n"
    echo -en "\r\n"
    echo -en "OK"
}

# Utiliser socat si disponible
if command -v socat >/dev/null 2>&1; then
    echo "🚀 [HEALTH] Démarrage serveur HTTP minimal avec socat sur port $PORT..."
    exec socat TCP-LISTEN:$PORT,fork,reuseaddr SYSTEM:"echo -en 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK'"
# Sinon utiliser netcat si disponible
elif command -v nc >/dev/null 2>&1; then
    echo "🚀 [HEALTH] Démarrage serveur HTTP minimal avec netcat sur port $PORT..."
    while true; do
        echo -en "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK" | nc -l -p $PORT
    done
else
    echo "❌ [HEALTH] Erreur: ni socat ni netcat disponibles"
    exit 1
fi

