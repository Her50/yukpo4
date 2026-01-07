#!/usr/bin/env python3
"""
Script pour convertir les documents Markdown en fichiers Word (.docx)
"""

import os
import sys
import re
from pathlib import Path

try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
except ImportError:
    print("Installation de python-docx...")
    os.system(f"{sys.executable} -m pip install python-docx markdown")
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

import markdown

def markdown_to_docx(md_file, docx_file):
    """Convertit un fichier Markdown en fichier Word"""
    
    # Lire le fichier Markdown
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Créer un nouveau document Word
    doc = Document()
    
    # Configurer les styles
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    # Parser le Markdown ligne par ligne
    lines = md_content.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Titre niveau 1 (#)
        if line.startswith('# '):
            text = line[2:].strip()
            p = doc.add_heading(text, level=1)
            i += 1
        
        # Titre niveau 2 (##)
        elif line.startswith('## '):
            text = line[3:].strip()
            p = doc.add_heading(text, level=2)
            i += 1
        
        # Titre niveau 3 (###)
        elif line.startswith('### '):
            text = line[4:].strip()
            p = doc.add_heading(text, level=3)
            i += 1
        
        # Titre niveau 4 (####)
        elif line.startswith('#### '):
            text = line[5:].strip()
            p = doc.add_heading(text, level=4)
            i += 1
        
        # Ligne horizontale (---)
        elif line.startswith('---'):
            doc.add_paragraph('_' * 50)
            i += 1
        
        # Liste à puces (- ou *)
        elif line.startswith('- ') or line.startswith('* '):
            text = line[2:].strip()
            # Vérifier si c'est une liste imbriquée
            if text.startswith('**') and text.endswith('**'):
                text = text[2:-2]
                p = doc.add_paragraph(text, style='List Bullet')
                run = p.runs[0]
                run.bold = True
            else:
                doc.add_paragraph(text, style='List Bullet')
            i += 1
        
        # Tableau Markdown
        elif '|' in line and line.count('|') >= 2:
            # Détecter le début d'un tableau
            table_lines = []
            j = i
            while j < len(lines) and '|' in lines[j].strip():
                if not lines[j].strip().startswith('|---'):
                    table_lines.append(lines[j].strip())
                j += 1
            
            if table_lines:
                # Créer le tableau
                rows_data = []
                for tl in table_lines:
                    cells = [c.strip() for c in tl.split('|') if c.strip()]
                    if cells:
                        rows_data.append(cells)
                
                if rows_data:
                    num_cols = len(rows_data[0])
                    table = doc.add_table(rows=len(rows_data), cols=num_cols)
                    table.style = 'Light Grid Accent 1'
                    
                    for row_idx, row_data in enumerate(rows_data):
                        for col_idx, cell_text in enumerate(row_data):
                            if col_idx < num_cols:
                                cell = table.rows[row_idx].cells[col_idx]
                                cell.text = cell_text
                                # Mettre en gras la première ligne (en-tête)
                                if row_idx == 0:
                                    for paragraph in cell.paragraphs:
                                        for run in paragraph.runs:
                                            run.bold = True
                
                i = j
            else:
                i += 1
        
        # Code inline (`)
        elif '`' in line:
            # Traiter le texte avec code inline
            p = doc.add_paragraph()
            parts = re.split(r'`([^`]+)`', line)
            for part in parts:
                if part.startswith('`') or part in line.split('`')[1::2]:
                    run = p.add_run(part.replace('`', ''))
                    run.font.name = 'Courier New'
                else:
                    p.add_run(part)
            i += 1
        
        # Paragraphe normal
        elif line:
            # Traiter le texte en gras (**text**)
            p = doc.add_paragraph()
            parts = re.split(r'\*\*([^*]+)\*\*', line)
            for idx, part in enumerate(parts):
                if idx % 2 == 1:  # Texte en gras
                    run = p.add_run(part)
                    run.bold = True
                else:
                    p.add_run(part)
            i += 1
        
        # Ligne vide
        else:
            i += 1
    
    # Sauvegarder le document
    doc.save(docx_file)
    print(f"Converti : {md_file} -> {docx_file}")

def main():
    """Fonction principale"""
    current_dir = Path(__file__).parent
    
    # Liste des fichiers à convertir
    md_files = [
        '01_EXECUTIVE_SUMMARY.md',
        '02_BUSINESS_PLAN.md',
        '03_PROJECTIONS_FINANCIERES.md',
        '04_PLAN_MARKETING.md',
        '05_ANALYSE_MARCHE.md',
        '06_PLAN_OPERATIONNEL.md',
        '07_PITCH_DECK.md',
    ]
    
    print("Conversion des documents Markdown en Word...\n")
    
    for md_file in md_files:
        md_path = current_dir / md_file
        if md_path.exists():
            docx_file = md_path.stem + '.docx'
            docx_path = current_dir / docx_file
            try:
                markdown_to_docx(md_path, docx_path)
            except Exception as e:
                print(f"ERREUR lors de la conversion de {md_file}: {e}")
        else:
            print(f"Fichier non trouve : {md_file}")
    
    print("\nConversion terminee !")

if __name__ == '__main__':
    main()

