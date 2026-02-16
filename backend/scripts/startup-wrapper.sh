#!/bin/bash
# Wrapper qui démarre un serveur HTTP minimal puis Rust

set -e

PORT=${PORT:-8080}

echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# Démarrer un serveur HTTP minimal Python en arrière-plan
echo "🚀 [WRAPPER] Démarrage serveur HTTP minimal Python..."
python3 -c "
import http.server
import socketserver
import os
import threading

PORT = int(os.environ.get('PORT', 8080))

class HealthHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Content-Length', '2')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(b'OK')
    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(('0.0.0.0', PORT), HealthHandler) as httpd:
        httpd.serve_forever()

thread = threading.Thread(target=start_server, daemon=True)
thread.start()
print(f'✅ [WRAPPER] Serveur HTTP minimal démarré sur port {PORT}')
import time
time.sleep(2)
" &

HEALTH_PID=$!
echo "✅ [WRAPPER] Serveur HTTP minimal démarré (PID: $HEALTH_PID)"

# Attendre un peu
sleep 1

# Maintenant démarrer Rust
echo "🚀 [WRAPPER] Démarrage application Rust..."
exec /app/yukpomnang_backend

