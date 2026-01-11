#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour convertir tous les montants FCFA en USD dans le document HTML
Taux de change: 1 USD = 600 FCFA
"""

import re

USD_TO_FCFA = 600

def convert_amount(match):
    """Convertit un montant FCFA trouvé par regex"""
    full_match = match.group(0)
    number_str = match.group(1).replace(',', '').replace(' ', '')
    
    try:
        # Détecter le format (M, K, billions, etc.)
        if 'M' in full_match or 'millions' in full_match.lower():
            value = float(number_str) * 1000000
            usd = value / USD_TO_FCFA
            if usd >= 1000:
                return f"{number_str}M FCFA (≈ {usd/1000000:.2f}M USD)"
            else:
                return f"{number_str}M FCFA (≈ {usd/1000:.1f}K USD)"
        elif 'K' in full_match or 'milliers' in full_match.lower():
            value = float(number_str) * 1000
            usd = value / USD_TO_FCFA
            return f"{number_str}K FCFA (≈ {usd:.2f} USD)"
        elif 'billion' in full_match.lower() or 'milliards' in full_match.lower():
            # En français, 1 billion = 1 000 000 000 000
            value = float(number_str) * 1000000000000
            usd = value / USD_TO_FCFA
            return f"{number_str} billions FCFA (≈ {usd/1000000000:.2f} milliards USD)"
        else:
            # Montant simple
            value = float(number_str)
            usd = value / USD_TO_FCFA
            if usd >= 1000000:
                return f"{number_str} FCFA (≈ {usd/1000000:.2f}M USD)"
            elif usd >= 1000:
                return f"{number_str} FCFA (≈ {usd/1000:.1f}K USD)"
            else:
                return f"{number_str} FCFA (≈ {usd:.2f} USD)"
    except:
        return full_match

# Lire le fichier
with open('docs/investisseurs/DEMANDE_FINANCEMENT_BANQUE_NEW.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Patterns pour trouver les montants
patterns_replacements = [
    # Montants avec M (millions)
    (r'(\d+(?:[,\s]?\d+)*)\s*M\s*FCFA', lambda m: f"{m.group(1)}M FCFA"),
    # Montants avec K
    (r'(\d+(?:[,\s]?\d+)*)\s*K\s*FCFA', lambda m: f"{m.group(1)}K FCFA"),
    # Billions
    (r'(\d+(?:[,\s]?\d+)*)\s*billions\s*FCFA', lambda m: f"{m.group(1)} billions FCFA"),
]

print("Fichier chargé, conversion à faire manuellement avec search_replace")
print(f"Taille du fichier: {len(content)} caractères")

