#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour traiter les images WhatsApp de pièce d'identité
Cherche automatiquement les fichiers avec les noms spécifiés
"""
from pathlib import Path
import subprocess
import sys
import io

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Noms des fichiers WhatsApp
whatsapp_files = [
    "WhatsApp Image 2026-02-16 at 19.15.11",
    "WhatsApp Image 2026-02-16 at 19.18.15"
]

# Extensions possibles
extensions = ['', '.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']

# Dossiers à chercher
search_dirs = [
    Path('image_yukpo'),
    Path('.'),
    Path.home() / 'Downloads',
    Path.home() / 'Documents'
]

print("=" * 60)
print("🔍 RECHERCHE DES IMAGES WHATSAPP")
print("=" * 60)

found_files = []

# Chercher les fichiers
for search_dir in search_dirs:
    if not search_dir.exists():
        continue
    
    print(f"\n📁 Recherche dans: {search_dir}")
    
    for file_path in search_dir.iterdir():
        if not file_path.is_file():
            continue
        
        name_without_ext = file_path.stem
        # Vérifier si le nom correspond à un des fichiers WhatsApp
        for whatsapp_name in whatsapp_files:
            # Comparer avec et sans extension
            if whatsapp_name in name_without_ext or whatsapp_name in file_path.name:
                found_files.append(file_path)
                print(f"   ✅ Trouvé: {file_path.name}")

# Si aucun fichier trouvé, essayer de construire les chemins
if not found_files:
    print("\n⚠️  Aucun fichier trouvé automatiquement.")
    print("📋 Tentative avec chemins construits...")
    
    for whatsapp_name in whatsapp_files:
        for ext in extensions:
            # Essayer dans image_yukpo
            test_path = Path('image_yukpo') / (whatsapp_name + ext)
            if test_path.exists():
                found_files.append(test_path)
                print(f"   ✅ Trouvé: {test_path}")
                break
            
            # Essayer dans le répertoire courant
            test_path = Path('.') / (whatsapp_name + ext)
            if test_path.exists():
                found_files.append(test_path)
                print(f"   ✅ Trouvé: {test_path}")
                break

# Traiter les fichiers trouvés
if found_files:
    print(f"\n✅ {len(found_files)} fichier(s) trouvé(s)")
    print("\n🚀 Traitement en cours...\n")
    
    # Exécuter le script de traitement
    cmd = [sys.executable, 'process_id_images.py'] + [str(f) for f in found_files]
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("\n✅ Traitement terminé avec succès!")
    else:
        print("\n❌ Erreur lors du traitement")
else:
    print("\n❌ Aucun fichier trouvé.")
    print("\n💡 Vérifiez que:")
    print("   1. Les images sont dans le dossier 'image_yukpo'")
    print("   2. Les noms des fichiers contiennent:")
    print("      - 'WhatsApp Image 2026-02-16 at 19.15.11'")
    print("      - 'WhatsApp Image 2026-02-16 at 19.18.15'")
    print("   3. Les fichiers ont une extension (.jpg, .jpeg, .png)")

