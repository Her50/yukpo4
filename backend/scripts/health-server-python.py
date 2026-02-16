#!/usr/bin/env python3
"""
Serveur HTTP minimal ultra-simple pour health check Cloud Run
Utilise Python3 http.server pour répondre immédiatement
"""
import http.server
import socketserver
import os
import sys

PORT = int(os.environ.get('PORT', 8080))

class HealthHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ['/health', '/healthz', '/']:
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', '2')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', '2')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(b'OK')
    
    def log_message(self, format, *args):
        # Log minimal pour éviter le spam
        # ✅ CORRIGÉ Python 3.13: args[0] peut être HTTPStatus, convertir en string
        try:
            first_arg = str(args[0]) if args else ""
            if '/health' in first_arg or '/healthz' in first_arg:
                sys.stderr.write(f"[HEALTH] {first_arg}\n")
        except Exception:
            # Ignorer les erreurs de logging
            pass

if __name__ == '__main__':
    sys.stderr.write(f"🚀 [HEALTH] Démarrage serveur HTTP minimal Python sur port {PORT}...\n")
    with socketserver.TCPServer(("0.0.0.0", PORT), HealthHandler) as httpd:
        sys.stderr.write(f"✅ [HEALTH] Serveur HTTP minimal prêt sur port {PORT}\n")
        httpd.serve_forever()

