#!/usr/bin/env python3
"""
Script pour convertir tous les montants en dollars en FCFA dans les documents Markdown
Taux de change : 1 USD = 600 FCFA
"""

import re
from pathlib import Path

# Taux de change
USD_TO_FCFA = 600

def convert_dollar_amount(match):
    """Convertit un montant en dollars en FCFA"""
    dollar_str = match.group(1)
    
    # Nettoyer le montant
    dollar_str = dollar_str.replace(',', '').replace(' ', '')
    
    # Extraire le nombre
    if 'K' in dollar_str.upper():
        amount = float(dollar_str.upper().replace('K', '')) * 1000
    elif 'M' in dollar_str.upper():
        amount = float(dollar_str.upper().replace('M', '')) * 1000000
    elif 'B' in dollar_str.upper():
        amount = float(dollar_str.upper().replace('B', '')) * 1000000000
    else:
        amount = float(dollar_str)
    
    # Convertir en FCFA
    fcfa_amount = amount * USD_TO_FCFA
    
    # Formater selon la taille
    if fcfa_amount >= 1000000000:
        # Billions
        formatted = f"{fcfa_amount / 1000000000:.1f} billions FCFA"
    elif fcfa_amount >= 1000000:
        # Millions
        formatted = f"{int(fcfa_amount / 1000000)} millions FCFA"
    elif fcfa_amount >= 1000:
        # Milliers
        formatted = f"{int(fcfa_amount / 1000)}K FCFA"
    else:
        # Unités
        formatted = f"{int(fcfa_amount)} FCFA"
    
    return formatted

def convert_dollar_range(match):
    """Convertit une plage de montants en dollars"""
    min_str = match.group(1)
    max_str = match.group(2)
    
    def convert_single(amount_str):
        amount_str = amount_str.replace(',', '').replace(' ', '').strip()
        if 'K' in amount_str.upper():
            amount = float(amount_str.upper().replace('K', '')) * 1000
        elif 'M' in amount_str.upper():
            amount = float(amount_str.upper().replace('M', '')) * 1000000
        elif 'B' in amount_str.upper():
            amount = float(amount_str.upper().replace('B', '')) * 1000000000
        else:
            amount = float(amount_str)
        return amount * USD_TO_FCFA
    
    min_fcfa = convert_single(min_str)
    max_fcfa = convert_single(max_str)
    
    # Formater
    if min_fcfa >= 1000000000:
        min_formatted = f"{min_fcfa / 1000000000:.1f} billions"
        max_formatted = f"{max_fcfa / 1000000000:.1f} billions"
    elif min_fcfa >= 1000000:
        min_formatted = f"{int(min_fcfa / 1000000)} millions"
        max_formatted = f"{int(max_fcfa / 1000000)} millions"
    elif min_fcfa >= 1000:
        min_formatted = f"{int(min_fcfa / 1000)}K"
        max_formatted = f"{int(max_fcfa / 1000)}K"
    else:
        min_formatted = f"{int(min_fcfa)}"
        max_formatted = f"{int(max_fcfa)}"
    
    return f"{min_formatted}-{max_formatted} FCFA"

def convert_file(file_path):
    """Convertit tous les montants en dollars dans un fichier"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern 1: $X ou $X,XXX ou $XK ou $XM ou $XB
    pattern1 = r'\$([0-9,]+\.?[0-9]*[KMB]?)\s*(?:milliards|millions|milliard|million|milliard|billion|milliard|billion)?'
    content = re.sub(pattern1, convert_dollar_amount, content)
    
    # Pattern 2: $X-$Y (plages)
    pattern2 = r'\$([0-9,]+\.?[0-9]*[KMB]?)\s*-\s*\$([0-9,]+\.?[0-9]*[KMB]?)'
    content = re.sub(pattern2, convert_dollar_range, content)
    
    # Pattern 3: $X/Y (par unité)
    pattern3 = r'\$([0-9,]+\.?[0-9]*[KMB]?)/(mois|an|jour|heure|vidéo|utilisateur|personne|bureau)'
    def convert_with_unit(match):
        amount_str = match.group(1)
        unit = match.group(2)
        amount_str = amount_str.replace(',', '').replace(' ', '')
        if 'K' in amount_str.upper():
            amount = float(amount_str.upper().replace('K', '')) * 1000
        elif 'M' in amount_str.upper():
            amount = float(amount_str.upper().replace('M', '')) * 1000000
        else:
            amount = float(amount_str)
        fcfa = int(amount * USD_TO_FCFA)
        if fcfa >= 1000:
            return f"{int(fcfa/1000)}K FCFA/{unit}"
        return f"{fcfa} FCFA/{unit}"
    content = re.sub(pattern3, convert_with_unit, content)
    
    # Pattern 4: USD ou dollars (remplacer par FCFA)
    content = re.sub(r'\bUSD\b', 'FCFA', content)
    content = re.sub(r'\bdollars?\b', 'FCFA', content, flags=re.IGNORECASE)
    
    # Pattern 5: $X millions/milliards (avec unité)
    pattern5 = r'\$([0-9,]+\.?[0-9]*)\s*(millions?|milliards?|billion)'
    def convert_with_magnitude(match):
        amount = float(match.group(1).replace(',', ''))
        magnitude = match.group(2)
        if 'milliard' in magnitude.lower() or 'billion' in magnitude.lower():
            fcfa = amount * 1000000000 * USD_TO_FCFA
            return f"{fcfa / 1000000000:.1f} billions FCFA"
        else:
            fcfa = amount * 1000000 * USD_TO_FCFA
            return f"{int(fcfa / 1000000)} millions FCFA"
    content = re.sub(pattern5, convert_with_magnitude, content)
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    """Fonction principale"""
    current_dir = Path(__file__).parent
    
    md_files = [
        '01_EXECUTIVE_SUMMARY.md',
        '02_BUSINESS_PLAN.md',
        '03_PROJECTIONS_FINANCIERES.md',
        '04_PLAN_MARKETING.md',
        '05_ANALYSE_MARCHE.md',
        '06_PLAN_OPERATIONNEL.md',
        '07_PITCH_DECK.md',
        '08_PLAN_FINANCIER_3_ANS.md',
    ]
    
    print("=" * 60)
    print("Conversion des montants USD vers FCFA")
    print(f"Taux de change : 1 USD = {USD_TO_FCFA} FCFA")
    print("=" * 60)
    print()
    
    converted_count = 0
    
    for md_file in md_files:
        md_path = current_dir / md_file
        if md_path.exists():
            if convert_file(md_path):
                print(f"[OK] Converti : {md_file}")
                converted_count += 1
            else:
                print(f"[INFO] Aucun changement : {md_file}")
        else:
            print(f"[ATTENTION] Fichier non trouve : {md_file}")
    
    print()
    print("=" * 60)
    print(f"Conversion terminee : {converted_count} fichiers modifies")
    print("=" * 60)

if __name__ == '__main__':
    main()

