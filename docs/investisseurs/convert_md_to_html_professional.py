#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour convertir DEMANDE_FINANCEMENT_BANQUE.md en HTML HYPER PROFESSIONNEL
Version optimisée pour Word avec style premium
"""

import sys
import re
from pathlib import Path

# Forcer UTF-8 pour la console
sys.stdout.reconfigure(encoding='utf-8')

def markdown_to_html_professional(md_content):
    """Convertit le contenu Markdown en HTML avec style HYPER PROFESSIONNEL"""
    
    html = """<!DOCTYPE html>
<html lang="fr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word 15">
    <meta name="Originator" content="Microsoft Word 15">
    <title>Yukpomnang - Demande de Financement</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 2cm 1.5cm;
        }
        
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #1A1A1A;
            margin: 0;
            padding: 0;
            background: #FFFFFF;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        /* En-tête professionnel */
        .header {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
            color: white;
            padding: 30pt 20pt;
            margin: -20pt -20pt 20pt -20pt;
            text-align: center;
            box-shadow: 0 4pt 6pt rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 32pt;
            font-weight: bold;
            margin: 0;
            padding: 0;
            color: white;
            text-shadow: 2pt 2pt 4pt rgba(0,0,0,0.2);
            letter-spacing: 1pt;
        }
        
        .header .subtitle {
            font-size: 14pt;
            margin-top: 8pt;
            opacity: 0.95;
            font-weight: 300;
        }
        
        .header .amount {
            font-size: 18pt;
            margin-top: 12pt;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            padding: 8pt 16pt;
            border-radius: 20pt;
            display: inline-block;
        }
        
        /* Titres */
        h1 {
            font-size: 24pt;
            color: #1E40AF;
            margin-top: 24pt;
            margin-bottom: 12pt;
            font-weight: bold;
            border-bottom: 3pt solid #6366F1;
            padding-bottom: 8pt;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            color: #1E3A8A;
            margin-top: 20pt;
            margin-bottom: 10pt;
            font-weight: bold;
            border-left: 5pt solid #6366F1;
            padding-left: 12pt;
            background: linear-gradient(to right, #EEF2FF 0%, transparent 100%);
            padding-top: 6pt;
            padding-bottom: 6pt;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            color: #1E40AF;
            margin-top: 16pt;
            margin-bottom: 8pt;
            font-weight: bold;
            page-break-after: avoid;
        }
        
        /* Paragraphes */
        p {
            margin: 8pt 0;
            text-align: justify;
            line-height: 1.6;
            orphans: 3;
            widows: 3;
        }
        
        p.intro {
            font-size: 12pt;
            font-style: italic;
            color: #4B5563;
            background: #F9FAFB;
            padding: 12pt;
            border-left: 4pt solid #6366F1;
            margin: 16pt 0;
            border-radius: 4pt;
        }
        
        /* Tableaux professionnels */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16pt 0;
            page-break-inside: avoid;
            break-inside: avoid;
            box-shadow: 0 2pt 4pt rgba(0,0,0,0.05);
            border-radius: 6pt;
            overflow: hidden;
        }
        
        table thead {
            display: table-header-group;
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
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
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
            padding: 10pt 12pt;
            text-align: left;
            font-weight: bold;
            font-size: 10.5pt;
            border: none;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }
        
        table td {
            padding: 8pt 12pt;
            border-bottom: 1pt solid #E5E7EB;
            text-align: left;
            font-size: 10pt;
            vertical-align: top;
        }
        
        table tbody tr:nth-child(even) {
            background: #F9FAFB;
        }
        
        table tbody tr:nth-child(odd) {
            background: #FFFFFF;
        }
        
        table tbody tr:hover {
            background: #F3F4F6;
        }
        
        table tbody tr:last-child td {
            border-bottom: none;
        }
        
        /* Branding Yukpo */
        .yukpo-brand {
            color: #F59E0B;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .yukpo-brand-po {
            color: #DC2626;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        /* Boxes d'impact */
        .impact-box {
            border: 2.5pt solid #6366F1;
            padding: 16pt;
            margin: 16pt 0;
            background: linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%);
            border-radius: 8pt;
            box-shadow: 0 4pt 6pt rgba(99, 102, 241, 0.1);
        }
        
        .impact-box h3 {
            margin-top: 0;
            color: #6366F1;
        }
        
        .highlight-box {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            padding: 12pt;
            margin: 12pt 0;
            border-left: 5pt solid #F59E0B;
            border-radius: 4pt;
        }
        
        .stat-highlight {
            color: #DC2626;
            font-weight: bold;
            font-size: 13pt;
            background: #FEE2E2;
            padding: 2pt 6pt;
            border-radius: 3pt;
        }
        
        /* Listes */
        ul, ol {
            margin: 10pt 0;
            padding-left: 24pt;
        }
        
        li {
            margin: 6pt 0;
            line-height: 1.6;
        }
        
        ul li::marker {
            color: #6366F1;
        }
        
        /* Texte en gras */
        strong {
            color: #1F2937;
            font-weight: bold;
        }
        
        /* Séparateurs */
        hr {
            border: none;
            border-top: 2pt solid #E5E7EB;
            margin: 20pt 0;
            background: linear-gradient(to right, transparent, #6366F1, transparent);
            height: 2pt;
        }
        
        /* Classes utilitaires */
        .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .long-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .source-ref {
            font-size: 9pt;
            color: #6B7280;
            font-style: italic;
            margin-top: 4pt;
        }
        
        .source-ref a {
            color: #6366F1;
            text-decoration: none;
        }
        
        .source-ref a:hover {
            text-decoration: underline;
        }
        
        /* Contact footer */
        .contact-footer {
            margin-top: 30pt;
            padding-top: 16pt;
            border-top: 2pt solid #E5E7EB;
            text-align: center;
            color: #6B7280;
            font-size: 10pt;
        }
        
        /* Notes */
        .note {
            background: #F0F9FF;
            border-left: 4pt solid #3B82F6;
            padding: 10pt 12pt;
            margin: 12pt 0;
            border-radius: 4pt;
            font-size: 10pt;
        }
        
        .note strong {
            color: #1E40AF;
        }
        
        /* Mise en page pour Word */
        .MsoNormal {
            margin: 0;
            padding: 0;
        }
        
        /* Éviter les coupures */
        .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        /* Titre long sur une ligne */
        .long-title {
            white-space: nowrap;
        }
    </style>
</head>
<body>
<div class="header">
    <h1>YUKPOMNANG</h1>
    <div class="subtitle">Plateforme Intelligente de Services Multi-Secteurs en Afrique</div>
    <div class="amount">OPPORTUNITÉ D'INVESTISSEMENT EXCEPTIONNELLE</div>
</div>
"""
    
    # Traitement du contenu Markdown
    lines = md_content.split('\n')
    in_table = False
    in_list = False
    list_type = None
    table_headers = []
    skip_next = False
    
    i = 0
    while i < len(lines):
        if skip_next:
            skip_next = False
            i += 1
            continue
            
        line = lines[i].strip()
        
        # Titre H1 (sauter le premier car déjà dans header)
        if line.startswith('# ') and not line.startswith('##'):
            if i > 5:  # Pas le premier titre
                html += f'<h1>{line[2:]}</h1>\n'
        
        # Titre H2 (sauter les doublons avec header)
        elif line.startswith('## '):
            title_text = line[3:].strip()
            # Éviter les doublons avec le header
            if title_text not in ["Plateforme Intelligente de Services Multi-Secteurs en Afrique"]:
                html += f'<h2>{title_text}</h2>\n'
        
        # Titre H3
        elif line.startswith('### '):
            html += f'<h3>{line[4:]}</h3>\n'
        
        # Tableaux
        elif '|' in line and line.count('|') >= 2:
            # Ignorer les lignes qui ne sont pas de vrais tableaux (comme les lignes de séparation avec |)
            if line.strip().startswith('|') and line.strip().endswith('|'):
                if not in_table:
                    in_table = True
                    html += '<table class="keep-together MsoNormalTable">\n'
                
                # Vérifier si c'est une ligne de séparation
                if i+1 < len(lines) and '---' in lines[i+1] and '|' in lines[i+1]:
                    headers = [h.strip() for h in line.split('|') if h.strip()]
                    table_headers = headers
                    html += '<thead><tr>\n'
                    for header in headers:
                        html += f'<th>{header}</th>\n'
                    html += '</tr></thead>\n<tbody>\n'
                    i += 1  # Skip la ligne de séparation
                    skip_next = True
                else:
                    cells = [c.strip() for c in line.split('|') if c.strip()]
                    if cells and (not table_headers or len(cells) == len(table_headers)):
                        html += '<tr>\n'
                        for cell in cells:
                            # Traiter les styles dans les cellules
                            cell_html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', cell)
                            cell_html = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', cell_html)
                            html += f'<td>{cell_html}</td>\n'
                        html += '</tr>\n'
        
        # Fin de tableau
        elif in_table and (line == '' or (i+1 < len(lines) and not ('|' in lines[i+1] and lines[i+1].strip().startswith('|') and lines[i+1].strip().endswith('|')))):
            if line == '':
                in_table = False
                html += '</tbody></table>\n'
                table_headers = []
        
        # Liste à puces
        elif (line.startswith('- ') or line.startswith('* ')) and not in_table:
            if not in_list:
                in_list = True
                list_type = 'ul'
                html += '<ul>\n'
            item = line[2:].strip()
            item = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', item)
            item = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', item)
            item = re.sub(r'Yukpomnang', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">pomnang</span>', item)
            # Traiter les liens dans les listes
            # Ne pas créer de liens, juste garder le texte de référence
            item = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', item)
            html += f'<li>{item}</li>\n'
        
        # Liste numérotée
        elif re.match(r'^\d+\.\s', line) and not in_table:
            if not in_list or list_type != 'ol':
                if in_list:
                    html += f'</{list_type}>\n'
                in_list = True
                list_type = 'ol'
                html += '<ol>\n'
            item = re.sub(r'^\d+\.\s', '', line).strip()
            item = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', item)
            item = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', item)
            # Ne pas créer de liens, juste garder le texte de référence
            item = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', item)
            html += f'<li>{item}</li>\n'
        
        # Paragraphe normal
        elif line and not line.startswith('---'):
            if in_list:
                html += f'</{list_type}>\n'
                in_list = False
                list_type = None
            
            # Ignorer les lignes qui sont des doublons du header
            if line.strip() in ["**OPPORTUNITÉ D'INVESTISSEMENT EXCEPTIONNELLE**", 
                               "Application déjà développée et opérationnelle | Financement ciblé sur croissance | ROI projeté 10-15x sur 5 ans"]:
                i += 1
                continue
            
            # Traiter le montant demandé spécialement
            if "**Montant demandé" in line:
                text = line
                text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
                html += f'<p style="text-align: center; font-size: 14pt; font-weight: bold; color: #6366F1; margin: 20pt 0; padding: 12pt; background: #EEF2FF; border-radius: 6pt;">{text}</p>\n'
                i += 1
                continue
            
            # Détecter les paragraphes intro
            if i < 15 and ('Imaginez' in line or ('En Afrique' in line and 'millions' in line)):
                text = line
                text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
                text = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', text)
                text = re.sub(r'Yukpomnang', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">pomnang</span>', text)
                # Ne pas créer de liens, juste garder le texte de référence
                text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'<span style="font-size: 9pt; color: #6B7280; font-style: italic;">(\1)</span>', text)
                html += f'<p class="intro">{text}</p>\n'
            else:
                text = line
                # Traiter les styles
                text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
                text = re.sub(r'Yukpo', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>', text)
                text = re.sub(r'Yukpomnang', r'<span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">pomnang</span>', text)
                # Ne pas créer de liens, juste garder le texte de référence de manière discrète
                text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'<span style="font-size: 9pt; color: #6B7280; font-style: italic;">(\1)</span>', text)
                # Détecter les notes importantes
                if 'Note importante' in text or ('Stratégie' in text and 'partenaires' in text):
                    html += f'<div class="note">{text}</div>\n'
                elif 'Montant demandé' in text:
                    # Mettre en évidence le montant
                    html += f'<p style="text-align: center; font-size: 14pt; font-weight: bold; color: #6366F1; margin: 16pt 0;">{text}</p>\n'
                else:
                    html += f'<p>{text}</p>\n'
        
        # Séparateur
        elif line.startswith('---'):
            html += '<hr>\n'
        
        # Ligne vide
        elif line == '':
            if in_list and (i+1 >= len(lines) or not (lines[i+1].strip().startswith('- ') or lines[i+1].strip().startswith('* ') or re.match(r'^\d+\.\s', lines[i+1].strip()))):
                html += f'</{list_type}>\n'
                in_list = False
                list_type = None
        
        i += 1
    
    # Fermer les balises ouvertes
    if in_table:
        html += '</tbody></table>\n'
    if in_list:
        html += f'</{list_type}>\n'
    
    html += """
<div class="contact-footer">
    <p><strong>Contact</strong> : Hernandez LELE | lelehernandez2007@yahoo.fr | +237 674 546895</p>
    <p><em>Document confidentiel - Propriété de <span class="yukpo-brand">Yuk</span><span class="yukpo-brand-po">po</span>mnang - Janvier 2026</em></p>
</div>
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
    
    print("🔄 Conversion Markdown → HTML Professionnel...")
    html_content = markdown_to_html_professional(md_content)
    
    print(f"💾 Écriture du fichier HTML : {html_file}")
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ Conversion terminée avec succès !")
    print(f"📄 Fichier HTML professionnel créé : {html_file}")
    print("🎨 Style : Gradients, couleurs premium, typographie optimisée")

if __name__ == "__main__":
    main()

