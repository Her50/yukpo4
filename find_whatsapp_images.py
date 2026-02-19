#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chercher les images WhatsApp"""
from pathlib import Path
import os

# Rechercher dans le répertoire courant et image_yukpo
search_dirs = [Path('.'), Path('image_yukpo')]

patterns = [
    'WhatsApp Image 2026-02-16 at 19.15.11',
    'WhatsApp Image 2026-02-16 at 19.18.15',
    'WhatsApp Image 2026-02-16 at 19.15',
    'WhatsApp Image 2026-02-16 at 19.18'
]

found = []
for search_dir in search_dirs:
    if not search_dir.exists():
        continue
    for file_path in search_dir.iterdir():
        if file_path.is_file():
            name = file_path.name
            # Chercher les patterns dans le nom
            for pattern in patterns:
                if pattern in name:
                    found.append(file_path)
                    break

print(f"Trouvé {len(found)} fichier(s):")
for f in found:
    print(f"  - {f} ({f.stat().st_size} bytes)")

# Si trouvé, exécuter le traitement
if found:
    import subprocess
    cmd = ['python', 'process_id_images.py'] + [str(f) for f in found]
    print(f"\n🚀 Exécution: {' '.join(cmd)}")
    subprocess.run(cmd)


