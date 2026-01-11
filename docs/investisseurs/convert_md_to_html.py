#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour convertir DEMANDE_FINANCEMENT_BANQUE.md en HTML professionnel
"""

import sys
import re
from pathlib import Path

# Forcer UTF-8 pour la console
sys.stdout.reconfigure(encoding='utf-8')

def markdown_to_html(md_content):
    """Convertit le contenu Markdown en HTML avec style professionnel"""
    
    html = """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yukpomnang - Demande de Financement</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #1A1A1A;
            margin: 0;
            padding: 20pt;
            background: #FFFFFF;
        }
        h1 {
            font-size: 24pt;
            color: #2C3E50;
            margin-top: 20pt;
            margin-bottom: 10pt;
            font-weight: bold;
        }
        h2 {
            font-size: 16pt;
            color: #2C3E50;
            margin-top: 16pt;
            margin-bottom: 8pt;
            font-weight: bold;
            border-bottom: 2px solid #6366F1;
            padding-bottom: 4pt;
        }
        h3 {
            font-size: 13pt;
            color: #34495E;
            margin-top: 12pt;
            margin-bottom: 6pt;
            font-weight: bold;
        }
        p {
            margin: 6pt 0;
            text-align: justify;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        table thead {
            display: table-header-group;
            background: #6366F1;
            color: white;
        }
        table tbody {
            display: table-row-group;
        }
        table tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        table th {
            background: #6366F1;
            color: white;
            padding: 8pt;
            text-align: left;
            font-weight: bold;
            border: 1px solid #4F46E5;
        }
        table td {
            padding: 6pt 8pt;
            border: 1px solid #E5E7EB;
            text-align: left;
        }
        table tbody tr:nth-child(even) {
            background: #F9FAFB;
        }
        table tbody tr:hover {
            background: #F3F4F6;
        }
        .yukpo-brand {
            color: #F59E0B;
            font-weight: bold;
        }
        .yukpo-brand-po {
            color: #DC2626;
            font-weight: bold;
        }
        .highlight {
            background: #FEF3C7;
            padding: 2pt 4pt;
            border-radius: 3pt;
        }
        .stat-highlight {
            color: #DC2626;
            font-weight: bold;
            font-size: 12pt;
        }
        .intro-text {
            font-size: 10pt;
            font-style: italic;
            color: #4B5563;
            margin: 8pt 0;
        }
        .impact-box {
            border: 2px solid #6366F1;
            padding: 12pt;
            margin: 12pt 0;
            background: #F0F9FF;
            border-radius: 6pt;
        }
        .source-ref {
            font-size: 9pt;
            color: #6B7280;
            font-style: italic;
        }
        ul, ol {
            margin: 8pt 0;
            padding-left: 20pt;
        }
        li {
            margin: 4pt 0;
        }
        strong {
            color: #1F2937;
            font-weight: bold;
        }
        hr {
            border: none;
            border-top: 1px solid #E5E7EB;
            margin: 16pt 0;
        }
        .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .long-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    </style>
</head>
<body>
"""
    
    # Traitement du contenu Markdown
    lines = md_content.split('\n')
    in_table = False
    in_list = False
    list_type = None
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Titre H1
        if line.startswith('# ') and not line.startswith('##'):
            html += f'<h1>{line[2:]}</h1>\n'
        
        # Titre H2
        elif line.startswith('## '):
            html += f'<h2>{line[3:]}</h2>\n'
        
        # Titre H3
        elif line.startswith('### '):
            html += f'<h3>{line[4:]}</h3>\n'
        
        # Tableaux
        elif '|' in line and line.count('|') >= 2:
            if not in_table:
                in_table = True
                html += '<table class="keep-together">\n'
            
            # En-tête de tableau
            if '---' in lines[i+1] if i+1 < len(lines) else False:
                headers = [h.strip() for h in line.split('|') if h.strip()]
                html += '<thead><tr>\n'
                for header in headers:
                    html += f'<th>{header}</th>\n'
                html += '</tr></thead>\n<tbody>\n'
                i += 1  # Skip la ligne de séparation
            else:
                cells = [c.strip() for c in line.split('|') if c.strip()]
                if cells:
                    html += '<tr>\n'
                    for cell in cells:
                        # Détecter les cellules en gras
                        cell_html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', cell)
                        html += f'<td>{cell_html}</td>\n'
                    html += '</tr>\n'
        
        # Fin de tableau
        elif in_table and line == '':
            in_table = False
            html += '</tbody></table>\n'
            html += '<p></p>\n'
        
        # Liste à puces
        elif line.startswith('- ') or line.startswith('* '):
            if not in_list:
                in_list = True
                html += '<ul>\n'
            item = line[2:].strip()
            # Traiter le gras dans les items
            item = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', item)
            html += f'<li>{item}</li>\n'
        
        # Liste numérotée
        elif re.match(r'^\d+\.\s', line):
            if not in_list or list_type != 'ol':
                if in_list:
                    html += f'</{list_type}>\n'
                in_list = True
                list_type = 'ol'
                html += '<ol>\n'
            item = re.sub(r'^\d+\.\s', '', line).strip()
            item = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', item)
            html += f'<li>{item}</li>\n'
        
        # Paragraphe normal
        elif line and not line.startswith('---'):
            if in_list:
                html += f'</{list_type}>\n'
                in_list = False
                list_type = None
            
            # Traiter les styles dans le texte
            text = line
            # Gras
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            # Liens
            text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', text)
            # Yukpo branding
            text = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', text)
            text = re.sub(r'Yukpomnang', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">pomnang</span>', text)
            
            html += f'<p>{text}</p>\n'
        
        # Séparateur
        elif line.startswith('---'):
            html += '<hr>\n'
        
        # Ligne vide
        elif line == '':
            if in_list:
                html += f'</{list_type}>\n'
                in_list = False
                list_type = None
            if not in_table:
                html += '<p></p>\n'
        
        i += 1
    
    # Fermer les balises ouvertes
    if in_table:
        html += '</tbody></table>\n'
    if in_list:
        html += f'</{list_type}>\n'
    
    html += """
</body>
</html>
"""
    
    return html

def main():
    """Fonction principale"""
    md_file = Path(__file__).parent / "DEMANDE_FINANCEMENT_BANQUE.md"
    html_file = Path(__file__).parent / "DEMANDE_FINANCEMENT_BANQUE.html"
    
    if not md_file.exists():
        print(f"❌ Fichier Markdown non trouvé : {md_file}")
        return
    
    print(f"📖 Lecture du fichier Markdown : {md_file}")
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    print("🔄 Conversion Markdown → HTML...")
    html_content = markdown_to_html(md_content)
    
    print(f"💾 Écriture du fichier HTML : {html_file}")
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ Conversion terminée avec succès !")
    print(f"📄 Fichier HTML créé : {html_file}")

if __name__ == "__main__":
    main()



