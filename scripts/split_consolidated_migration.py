#!/usr/bin/env python3
"""
Script pour diviser le fichier consolidé 0000_create_all_tables.sql
en plusieurs fichiers de migration plus petits et logiques.
"""

import re
import os
from pathlib import Path

def read_file(filepath):
    """Lit le fichier consolidé."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def identify_sections(content):
    """Identifie les sections logiques dans le fichier."""
    sections = []
    current_section = None
    current_lines = []
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        # Détecter les sections principales
        if re.match(r'^--\s*=+\s*$', line) or re.match(r'^--\s*✅', line):
            # Nouvelle section détectée
            if current_section:
                sections.append({
                    'name': current_section['name'],
                    'start_line': current_section['start_line'],
                    'end_line': i,
                    'content': '\n'.join(current_lines)
                })
            
            # Déterminer le nom de la section
            section_name = extract_section_name(lines, i)
            current_section = {
                'name': section_name,
                'start_line': i
            }
            current_lines = [line]
        elif current_section:
            current_lines.append(line)
    
    # Ajouter la dernière section
    if current_section:
        sections.append({
            'name': current_section['name'],
            'start_line': current_section['start_line'],
            'end_line': len(lines),
            'content': '\n'.join(current_lines)
        })
    
    return sections

def extract_section_name(lines, start_idx):
    """Extrait le nom de la section à partir des lignes."""
    # Chercher dans les 5 lignes suivantes
    for i in range(start_idx, min(start_idx + 5, len(lines))):
        line = lines[i]
        # Chercher des patterns comme "-- Table", "-- ✅", etc.
        if 'Table' in line or '✅' in line:
            # Extraire le nom
            match = re.search(r'--\s*(?:✅\s*)?(?:Table\s+)?([A-Za-z_]+)', line)
            if match:
                return match.group(1).lower()
            # Sinon, extraire le texte après -- ✅
            match = re.search(r'--\s*✅\s*(.+)', line)
            if match:
                return match.group(1).strip().lower().replace(' ', '_')
    
    return f"section_{start_idx}"

def create_migration_files(sections, output_dir):
    """Crée les fichiers de migration séparés."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Ordre d'exécution logique
    execution_order = {
        'extensions': 1,
        'users': 2,
        'services': 3,
        'media': 4,
        'payment': 5,
        'delivery': 6,
        'specialized': 7,
        'functions': 8,
        'indexes': 9,
        'optimizations': 10
    }
    
    created_files = []
    
    for i, section in enumerate(sections):
        section_name = section['name']
        
        # Déterminer l'ordre d'exécution
        order = execution_order.get(section_name, 100 + i)
        
        # Créer le nom de fichier
        filename = f"{order:08d}_{section_name}.sql"
        filepath = output_dir / filename
        
        # Écrire le contenu
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(section['content'])
        
        created_files.append((filename, section_name))
        print(f"✅ Créé: {filename} ({section_name})")
    
    return created_files

def main():
    """Fonction principale."""
    # Chemins
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    consolidated_file = project_root / 'backend' / 'migrations' / '0000_create_all_tables.sql'
    output_dir = project_root / 'backend' / 'migrations' / 'split'
    
    print(f"📖 Lecture du fichier consolidé: {consolidated_file}")
    content = read_file(consolidated_file)
    
    print(f"🔍 Identification des sections...")
    sections = identify_sections(content)
    print(f"✅ {len(sections)} sections identifiées")
    
    print(f"📝 Création des fichiers de migration...")
    created_files = create_migration_files(sections, output_dir)
    
    print(f"\n✅ {len(created_files)} fichiers créés dans {output_dir}")
    print("\n📋 Fichiers créés:")
    for filename, section_name in created_files:
        print(f"  - {filename}")

if __name__ == '__main__':
    main()

