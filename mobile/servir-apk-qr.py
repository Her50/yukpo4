#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour servir l'APK via HTTP avec QR code
Usage: python servir-apk-qr.py
"""

import http.server
import socketserver
import os
import socket
import qrcode
from pathlib import Path

# Configuration
APK_PATH = "android/app/build/outputs/apk/debug/app-debug.apk"
PORT = 8080

def get_local_ip():
    """Obtenir l'adresse IP locale"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    print("=" * 50)
    print("   SERVEUR APK avec QR CODE")
    print("=" * 50)
    print()
    
    # Vérifier que l'APK existe
    if not os.path.exists(APK_PATH):
        print(f"❌ APK non trouvé : {APK_PATH}")
        print("Compilez d'abord avec BUILD-APK.bat")
        return
    
    print(f"✅ APK trouvé : {APK_PATH}")
    apk_size = os.path.getsize(APK_PATH) / (1024 * 1024)
    print(f"📦 Taille : {apk_size:.2f} MB")
    print()
    
    # Obtenir l'IP locale
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}/app-debug.apk"
    
    print(f"🌐 Adresse IP locale : {local_ip}")
    print(f"🔗 URL de téléchargement : {url}")
    print()
    
    # Créer le dossier temporaire
    temp_dir = Path("temp-apk-server")
    temp_dir.mkdir(exist_ok=True)
    
    # Copier l'APK
    import shutil
    shutil.copy(APK_PATH, temp_dir / "app-debug.apk")
    
    # Générer le QR code
    print("=" * 50)
    print("   QR CODE")
    print("=" * 50)
    print()
    
    try:
        qr = qrcode.QRCode()
        qr.add_data(url)
        qr.print_ascii()
    except ImportError:
        print("⚠️  Module 'qrcode' non installé")
        print("Installation : pip install qrcode[pil]")
        print()
    
    print()
    print("=" * 50)
    print("📱 INSTRUCTIONS")
    print("=" * 50)
    print("1. Assurez-vous que votre téléphone est sur le MÊME WIFI")
    print("2. Scannez le QR code ci-dessus")
    print("3. OU ouvrez cette URL dans votre navigateur mobile :")
    print(f"   {url}")
    print()
    print("=" * 50)
    print("🛑 Appuyez sur Ctrl+C pour arrêter le serveur")
    print("=" * 50)
    print()
    
    # Changer le répertoire de travail
    os.chdir(temp_dir)
    
    # Démarrer le serveur
    try:
        Handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"🚀 Serveur démarré sur le port {PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Serveur arrêté")
    finally:
        # Nettoyage
        os.chdir("..")
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()

