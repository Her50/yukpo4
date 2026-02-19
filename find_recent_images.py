#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script pour trouver les images récentes"""
from pathlib import Path
from datetime import datetime, timedelta

recent = datetime.now() - timedelta(hours=2)
extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']

files = []
for ext in extensions:
    files.extend(list(Path('.').rglob(f'*{ext}')))

recent_files = [
    f for f in files 
    if f.is_file() 
    and '_processed' not in f.name 
    and f.stat().st_mtime > recent.timestamp()
]

print(f"Trouvé {len(recent_files)} image(s) récente(s) (dernières 2 heures):")
for f in recent_files[:20]:
    mod_time = datetime.fromtimestamp(f.stat().st_mtime)
    print(f"  - {f} ({f.stat().st_size} bytes, {mod_time.strftime('%Y-%m-%d %H:%M:%S')})")


