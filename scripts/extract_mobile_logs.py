#!/usr/bin/env python3
"""
Script Python pour extraire uniquement les logs mobiles des logs backend
Usage: 
    python extract_mobile_logs.py [fichier_log] [output_file]
    ou: cat log.txt | python extract_mobile_logs.py
"""

import sys
import re
from pathlib import Path

def extract_mobile_logs(input_file=None, output_file="mobile_logs.txt"):
    """
    Extrait les logs mobiles des logs backend
    """
    # Pattern pour identifier les logs mobiles
    mobile_pattern = re.compile(r'📱\[MOBILE|MobileLog|MobileLogs')
    
    mobile_logs = []
    
    # Lire depuis stdin ou fichier
    if input_file is None or input_file == '-':
        # Lire depuis stdin
        for line in sys.stdin:
            if mobile_pattern.search(line):
                mobile_logs.append(line.rstrip())
    else:
        # Lire depuis fichier
        input_path = Path(input_file)
        if not input_path.exists():
            print(f"❌ Fichier non trouvé: {input_file}")
            return
        
        with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if mobile_pattern.search(line):
                    mobile_logs.append(line.rstrip())
    
    # Écrire dans le fichier de sortie
    if mobile_logs:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(mobile_logs))
        
        print(f"✅ Logs mobiles extraits dans: {output_file}")
        print(f"📊 Nombre de lignes: {len(mobile_logs)}")
        
        # Afficher un échantillon
        print("\n📋 Échantillon (5 premières lignes):")
        for i, log in enumerate(mobile_logs[:5], 1):
            print(f"  {i}. {log[:100]}...")
    else:
        print("⚠️  Aucun log mobile trouvé")

if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else None
    output_file = sys.argv[2] if len(sys.argv) > 2 else "mobile_logs.txt"
    
    extract_mobile_logs(input_file, output_file)

