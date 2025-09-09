#!/usr/bin/env python3
"""
Serveur HTTP simple pour tester le port 8000
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "timestamp": time.time(),
                "message": "Test server running"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "message": "Test server running",
                "path": self.path
            }
            self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {format % args}")

def run_server():
    print("🚀 Démarrage du serveur de test sur le port 8000...")
    server = HTTPServer(('0.0.0.0', 8000), SimpleHandler)
    print("✅ Serveur démarré sur http://localhost:8000")
    print("📡 Endpoints disponibles:")
    print("   - GET /health")
    print("   - GET / (n'importe quel chemin)")
    print("🛑 Appuyez sur Ctrl+C pour arrêter")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Arrêt du serveur...")
        server.shutdown()

if __name__ == "__main__":
    run_server() 