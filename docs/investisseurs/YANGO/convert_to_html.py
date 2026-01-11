#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script pour convertir les fichiers Markdown en HTML avec style pour Word"""

import re
import os

def markdown_to_html_table(md_table):
    """Convertit une table Markdown en HTML"""
    lines = md_table.strip().split('\n')
    if len(lines) < 3:
        return md_table
    
    header = lines[0].strip().split('|')[1:-1]
    separator = lines[1]
    rows = [line.strip().split('|')[1:-1] for line in lines[2:]]
    
    html = '<table>\n<thead>\n<tr>\n'
    for h in header:
        html += f'<th>{h.strip()}</th>\n'
    html += '</tr>\n</thead>\n<tbody>\n'
    
    for row in rows:
        html += '<tr>\n'
        for cell in row:
            cell = cell.strip()
            # Convertir <br> en HTML
            cell = cell.replace('<br>', '<br>')
            # Gérer le gras
            cell = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', cell)
            html += f'<td>{cell}</td>\n'
        html += '</tr>\n'
    
    html += '</tbody>\n</table>\n'
    return html

def markdown_to_html(md_text):
    """Convertit Markdown en HTML"""
    html = md_text
    
    # Tables
    table_pattern = r'\|[^\n]+\n\|[-\s\|:]+\n(?:\|[^\n]+\n?)+'
    tables = re.findall(table_pattern, html)
    for table in tables:
        html_table = markdown_to_html_table(table)
        html = html.replace(table, html_table)
    
    # Titres
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    
    # Liste à puces
    html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    
    # Liste numérotée
    html = re.sub(r'^\d+\. (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    
    # Gras
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    
    # Italique
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
    
    # Code inline
    html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)
    
    # Lignes de séparation
    html = re.sub(r'^---$', r'<hr>', html, flags=re.MULTILINE)
    
    # Paragraphes (lignes non vides qui ne sont pas des balises)
    lines = html.split('\n')
    result = []
    in_list = False
    for line in lines:
        if line.strip().startswith('<'):
            if in_list and not line.strip().startswith('<li'):
                result.append('</ul>' if in_list else '')
                in_list = False
            result.append(line)
        elif line.strip().startswith('-') or re.match(r'^\d+\.', line.strip()):
            if not in_list:
                result.append('<ul>')
                in_list = True
            if not line.strip().startswith('<li'):
                result.append(f'<li>{line.strip()[2:] if line.strip().startswith("-") else re.sub(r"^\d+\.\s*", "", line.strip())}</li>')
        elif line.strip():
            if in_list:
                result.append('</ul>')
                in_list = False
            result.append(f'<p>{line.strip()}</p>')
        else:
            if in_list:
                result.append('</ul>')
                in_list = False
            result.append(line)
    
    if in_list:
        result.append('</ul>')
    
    return '\n'.join(result)

# Style CSS commun
CSS_STYLE = """<style>
        body {
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #1A1A1A;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
            background: #ffffff;
        }
        h1 {
            color: #6366F1;
            font-size: 24pt;
            margin-bottom: 10px;
            border-bottom: 3px solid #6366F1;
            padding-bottom: 10px;
        }
        h2 {
            color: #374151;
            font-size: 18pt;
            margin-top: 25px;
            margin-bottom: 15px;
            border-left: 4px solid #6366F1;
            padding-left: 10px;
        }
        h3 {
            color: #4B5563;
            font-size: 14pt;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10pt;
        }
        th {
            background-color: #6366F1;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 8px;
            border: 1px solid #E5E7EB;
        }
        tr:nth-child(even) {
            background-color: #F9FAFB;
        }
        ul, ol {
            margin: 10px 0;
            padding-left: 25px;
        }
        li {
            margin: 5px 0;
        }
        strong {
            color: #6366F1;
        }
        .highlight {
            background-color: #EEF2FF;
            padding: 15px;
            border-left: 4px solid #6366F1;
            margin: 15px 0;
        }
        .contact-info {
            background-color: #F3F4F6;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        hr {
            border: none;
            border-top: 2px solid #E5E7EB;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            color: #6B7280;
            font-style: italic;
        }
    </style>"""

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {css}
</head>
<body>
{content}
</body>
</html>"""

if __name__ == '__main__':
    print("Script de conversion Markdown → HTML")
    print("Note: Ce script est un exemple. Les fichiers HTML seront créés manuellement pour un meilleur contrôle.")

