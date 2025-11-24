#!/usr/bin/env python3
"""
Analyse du prompt de création de service pour estimer les tokens et identifier les optimisations
"""
import re
import sys
from pathlib import Path

def estimate_tokens(text: str) -> int:
    """
    Estimation approximative des tokens :
    - ~4 caractères par token en moyenne pour français/anglais
    - Les espaces et ponctuations comptent
    """
    # Méthode simple : division par 4
    return len(text) // 4

def count_words(text: str) -> int:
    """Compte les mots"""
    return len(re.findall(r'\w+', text))

def analyze_sections(content: str) -> dict:
    """Analyse le contenu par sections"""
    sections = {}
    
    # Diviser par les séparateurs principaux
    lines = content.split('\n')
    current_section = "Introduction"
    current_content = []
    
    for line in lines:
        # Détecter les titres de sections (##)
        if line.startswith('##'):
            if current_section:
                sections[current_section] = '\n'.join(current_content)
            current_section = line.strip()
            current_content = []
        else:
            current_content.append(line)
    
    # Dernière section
    if current_content:
        sections[current_section] = '\n'.join(current_content)
    
    return sections

def analyze_prompt(file_path: str):
    """Analyse complète du prompt"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"📊 ANALYSE DU PROMPT: {file_path}\n")
    print("=" * 80)
    
    # Métriques générales
    char_count = len(content)
    word_count = count_words(content)
    token_estimate = estimate_tokens(content)
    line_count = len(content.split('\n'))
    
    print(f"\n📏 MÉTRIQUES GLOBALES:")
    print(f"  • Caractères: {char_count:,}")
    print(f"  • Mots: {word_count:,}")
    print(f"  • Lignes: {line_count:,}")
    print(f"  • Tokens estimés: {token_estimate:,}")
    print(f"  • Coût approximatif (GPT-4o): ${token_estimate * 0.000005:.4f} par requête input")
    
    # Analyse par sections
    sections = analyze_sections(content)
    
    print(f"\n📑 ANALYSE PAR SECTIONS:")
    print("-" * 80)
    
    section_sizes = []
    for section, section_content in sections.items():
        section_tokens = estimate_tokens(section_content)
        section_chars = len(section_content)
        section_words = count_words(section_content)
        
        section_sizes.append({
            'name': section[:60],
            'tokens': section_tokens,
            'chars': section_chars,
            'words': section_words,
            'percentage': (section_tokens / token_estimate * 100) if token_estimate > 0 else 0
        })
    
    # Trier par taille décroissante
    section_sizes.sort(key=lambda x: x['tokens'], reverse=True)
    
    for i, section in enumerate(section_sizes[:15], 1):
        print(f"\n{i}. {section['name']}")
        print(f"   Tokens: {section['tokens']:,} ({section['percentage']:.1f}%)")
        print(f"   Caractères: {section['chars']:,} | Mots: {section['words']:,}")
    
    # Identifier les sections avec beaucoup d'exemples JSON
    print(f"\n🔍 IDENTIFICATION DES OPTIMISATIONS POTENTIELLES:")
    print("-" * 80)
    
    # Compter les exemples JSON
    json_examples = len(re.findall(r'```json\s*\n.*?```', content, re.DOTALL))
    print(f"  • Nombre d'exemples JSON: {json_examples}")
    
    # Compter les répétitions
    repeated_phrases = [
        ("🚨 RÈGLE", len(re.findall(r'🚨.*?RÈGLE', content))),
        ("OBLIGATOIRE", len(re.findall(r'OBLIGATOIRE', content))),
        ("INTERDIT", len(re.findall(r'INTERDIT', content))),
        ("✅", len(re.findall(r'✅', content))),
        ("❌", len(re.findall(r'❌', content))),
        ("⚠️", len(re.findall(r'⚠️', content))),
    ]
    
    print(f"\n  • Répétitions de mots-clés:")
    for phrase, count in repeated_phrases:
        if count > 0:
            print(f"    - '{phrase}': {count} fois")
    
    # Suggestions d'optimisation
    print(f"\n💡 SUGGESTIONS D'OPTIMISATION:")
    print("-" * 80)
    
    suggestions = []
    
    # Vérifier les exemples JSON volumineux
    if json_examples > 5:
        suggestions.append(f"• Réduire le nombre d'exemples JSON ({json_examples} actuellement) - garder seulement les plus représentatifs")
    
    # Vérifier les sections les plus longues
    top_sections = [s for s in section_sizes[:3] if s['percentage'] > 15]
    if top_sections:
        suggestions.append(f"• Sections les plus volumineuses (>15%): {', '.join([s['name'][:30] for s in top_sections])}")
    
    # Vérifier les répétitions
    if sum(count for _, count in repeated_phrases) > 20:
        suggestions.append(f"• Consolider les règles répétitives en une seule section de référence")
    
    # Vérifier les emojis répétés
    total_emojis = sum(count for _, count in repeated_phrases if '🚨' in _ or '✅' in _ or '❌' in _ or '⚠️' in _)
    if total_emojis > 30:
        suggestions.append(f"• Réduire le nombre d'emojis décoratifs ({total_emojis} actuellement) - ils ajoutent des tokens sans valeur fonctionnelle")
    
    # Vérifier les commentaires/explications redondantes
    if content.count('---') > 5:
        suggestions.append(f"• Réduire les séparateurs décoratifs (---)")
    
    if suggestions:
        for suggestion in suggestions:
            print(f"  {suggestion}")
    else:
        print("  ✓ Le prompt semble déjà bien optimisé")
    
    # Estimation de réduction possible
    print(f"\n🎯 ESTIMATION DE RÉDUCTION POSSIBLE:")
    print("-" * 80)
    
    reducible = 0
    reduction_sources = []
    
    # Exemples JSON volumineux (on peut réduire de ~30-40%)
    if json_examples > 5:
        json_reduction = int(token_estimate * 0.20)  # ~20% du prompt
        reducible += json_reduction
        reduction_sources.append(f"Exemples JSON: -{json_reduction} tokens (~{json_examples - 3} exemples à conserver)")
    
    # Répétitions et emojis (10-15%)
    if total_emojis > 30:
        emoji_reduction = int(token_estimate * 0.10)
        reducible += emoji_reduction
        reduction_sources.append(f"Emojis/répétitions: -{emoji_reduction} tokens")
    
    # Sections redondantes (10%)
    redundant_reduction = int(token_estimate * 0.10)
    reducible += redundant_reduction
    reduction_sources.append(f"Consolidation sections: -{redundant_reduction} tokens")
    
    if reduction_sources:
        print(f"  Réduction estimée: ~{reducible:,} tokens ({reducible/token_estimate*100:.1f}%)")
        print(f"\n  Sources de réduction:")
        for source in reduction_sources:
            print(f"    • {source}")
        
        new_total = token_estimate - reducible
        print(f"\n  Nouveau total estimé: ~{new_total:,} tokens")
        print(f"  Économie par requête: ~${reducible * 0.000005:.4f}")
        print(f"  Sur 1000 requêtes: ~${reducible * 0.000005 * 1000:.2f}")
    else:
        print("  Peu de réduction possible sans perte de qualité")

if __name__ == "__main__":
    prompt_file = Path(__file__).parent.parent / "ia_prompts" / "creation_service_prompt.md"
    
    if not prompt_file.exists():
        print(f"❌ Fichier non trouvé: {prompt_file}")
        sys.exit(1)
    
    analyze_prompt(str(prompt_file))

