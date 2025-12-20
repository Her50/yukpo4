#!/usr/bin/env python3
"""
Analyse de l'extraction des mots-clés et du matching
"""

import psycopg2
import re

DATABASE_URL = "postgresql://user:password@host:port/database"

# Simuler extract_keywords_from_text (version simplifiée)
STOP_WORDS = {
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "me", "te", "se",
    "cherche", "cherches", "cherchez", "cherchons", "recherche", "recherches", "recherchez",
    "voudrais", "veux", "souhaite", "désire", "aimerais", "aimerait",
    "un", "une", "des", "le", "la", "les", "du", "de", "d'", "ce", "cette", "ces",
    "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "leurs",
    "pour", "avec", "sans", "sur", "sous", "dans", "entre", "par", "vers", "chez",
    "et", "ou", "mais", "donc", "car", "ni", "or", "que", "qui", "quoi", "où", "quand", "comment", "pourquoi",
    "très", "trop", "peu", "beaucoup", "assez", "plus", "moins", "bien", "mal", "bon", "mauvais"
}

def extract_keywords_simulated(text):
    """Simule extract_keywords_from_text"""
    # Nettoyer et diviser en mots
    words = re.findall(r'\b\w+\b', text.lower())
    
    # Filtrer les stop words et mots courts
    keywords = [
        word for word in words 
        if word not in STOP_WORDS and len(word) >= 3
    ]
    
    return keywords

def test_keyword_extraction():
    """Teste l'extraction des mots-clés"""
    test_cases = [
        "je cherche un plombier",
        "je voudrais trouver un photographe professionnel",
        "je recherche un électricien à Douala",
        "je veux un restaurant chinois",
        "je cherche des chaussures de sport"
    ]
    
    print("="*100)
    print("ANALYSE DE L'EXTRACTION DES MOTS-CLÉS")
    print("="*100)
    
    for text in test_cases:
        keywords = extract_keywords_simulated(text)
        primary_keyword = keywords[0] if keywords else None
        print(f"\n📝 Texte: '{text}'")
        print(f"  🔑 Mots-clés extraits: {keywords}")
        print(f"  ⭐ Mot-clé principal (utilisé): '{primary_keyword}'")
        print(f"  ⚠️  Autres mots-clés (ignorés?): {keywords[1:] if len(keywords) > 1 else 'Aucun'}")

def analyze_matching_in_sql():
    """Analyse comment le matching se fait dans SQL"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*100)
    print("ANALYSE DU MATCHING DANS SQL")
    print("="*100)
    
    # Test avec "plombier"
    search_term = "plombier"
    print(f"\n🔍 Test avec terme de recherche: '{search_term}'")
    
    # Simuler string_to_array($1, ' ')
    words_array = search_term.split(' ')
    print(f"  📊 string_to_array('{search_term}', ' '): {words_array}")
    
    # Test avec "photographe professionnel"
    search_term2 = "photographe professionnel"
    print(f"\n🔍 Test avec terme de recherche: '{search_term2}'")
    words_array2 = search_term2.split(' ')
    print(f"  📊 string_to_array('{search_term2}', ' '): {words_array2}")
    
    # Vérifier comment les mots sont utilisés dans le matching
    print(f"\n💡 ANALYSE:")
    print(f"  ✅ Si on passe '{search_term}' → string_to_array donne: {words_array}")
    print(f"  ✅ Si on passe '{search_term2}' → string_to_array donne: {words_array2}")
    print(f"  ⚠️  PROBLÈME POTENTIEL: Si seulement le premier mot-clé est passé,")
    print(f"     les autres mots sont perdus dans le matching!")
    
    # Test avec un service réel
    print(f"\n" + "="*100)
    print("TEST AVEC SERVICE RÉEL")
    print("="*100)
    
    # Service 13: "Services de photographie professionnelle"
    service_id = 13
    cur.execute("""
        SELECT 
            s.id,
            s.data->'titre_service'->>'valeur' as titre,
            s.data->'category'->>'valeur' as category,
            s.data->'description'->>'valeur' as description
        FROM services s
        WHERE s.id = %s
    """, (service_id,))
    
    service = cur.fetchone()
    if service:
        print(f"\n📋 Service {service_id}:")
        print(f"  Titre: {service[1]}")
        print(f"  Category: {service[2]}")
        print(f"  Description: {service[3]}")
        
        # Test matching avec différents termes
        test_terms = ["photographe", "photographe professionnel", "professionnel"]
        for term in test_terms:
            words = term.split(' ')
            print(f"\n  🔍 Matching avec '{term}' (mots: {words}):")
            
            # Test ILIKE pour chaque mot
            for word in words:
                matches_titre = service[1] and word.lower() in (service[1] or '').lower()
                matches_category = service[2] and word.lower() in (service[2] or '').lower()
                matches_description = service[3] and word.lower() in (service[3] or '').lower()
                
                print(f"    - Mot '{word}':")
                print(f"      Titre: {'✅' if matches_titre else '❌'}")
                print(f"      Category: {'✅' if matches_category else '❌'}")
                print(f"      Description: {'✅' if matches_description else '❌'}")
    
    cur.close()
    conn.close()

def analyze_primary_keyword_usage():
    """Analyse comment le primary_keyword est utilisé"""
    print("\n" + "="*100)
    print("ANALYSE DE L'UTILISATION DU PRIMARY_KEYWORD")
    print("="*100)
    
    test_cases = [
        ("je cherche un plombier", "plombier"),
        ("je voudrais trouver un photographe professionnel", "photographe"),
        ("je recherche un électricien à Douala", "électricien"),
        ("je veux un restaurant chinois", "restaurant"),
        ("je cherche des chaussures de sport", "chaussures")
    ]
    
    print("\n💡 PROBLÈME IDENTIFIÉ:")
    print("  Dans rechercher_besoin.rs ligne 430:")
    print("  ```rust")
    print("  let primary_keyword = &keywords[0];")
    print("  ```")
    print("  ⚠️  Seul le PREMIER mot-clé est utilisé!")
    print("  ⚠️  Les autres mots-clés sont IGNORÉS dans la recherche!")
    
    print("\n📊 Impact:")
    for text, primary in test_cases:
        keywords = extract_keywords_simulated(text)
        print(f"  '{text}'")
        print(f"    → Mots-clés: {keywords}")
        print(f"    → Utilisé: '{primary}'")
        if len(keywords) > 1:
            print(f"    → ❌ Perdus: {keywords[1:]}")
    
    print("\n💡 SOLUTION:")
    print("  Option 1: Utiliser TOUS les mots-clés dans la recherche")
    print("  Option 2: Utiliser le texte complet (après extraction des stop words)")
    print("  Option 3: Combiner primary_keyword + autres mots-clés importants")

if __name__ == "__main__":
    test_keyword_extraction()
    analyze_matching_in_sql()
    analyze_primary_keyword_usage()

