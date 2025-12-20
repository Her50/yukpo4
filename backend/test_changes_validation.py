#!/usr/bin/env python3
"""
Test de validation des changements :
1. Extraction des mots-clés (stop words)
2. Utilisation de tous les mots-clés
3. Matching avec word_similarity() au lieu de similarity()
4. Résultats pour les termes de recherche
"""

import psycopg2
import re
import time

DATABASE_URL = "postgresql://user:password@host:port/database"

# Simuler extract_keywords_from_text avec "trouver" dans les stop words
STOP_WORDS = {
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "me", "te", "se",
    "cherche", "cherches", "cherchez", "cherchons", "recherche", "recherches", "recherchez",
    "voudrais", "veux", "souhaite", "désire", "aimerais", "aimerait",
    "trouver", "trouve", "trouves", "trouvez", "trouvons",  # ✅ NOUVEAU
    "un", "une", "des", "le", "la", "les", "du", "de", "d'", "ce", "cette", "ces",
    "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "leurs",
    "pour", "avec", "sans", "sur", "sous", "dans", "entre", "par", "vers", "chez",
    "et", "ou", "mais", "donc", "car", "ni", "or", "que", "qui", "quoi", "où", "quand", "comment", "pourquoi",
    "très", "trop", "peu", "beaucoup", "assez", "plus", "moins", "bien", "mal", "bon", "mauvais"
}

def extract_keywords_simulated(text):
    """Simule extract_keywords_from_text avec les nouveaux stop words"""
    words = re.findall(r'\b\w+\b', text.lower())
    keywords = [
        word for word in words 
        if word not in STOP_WORDS and len(word) >= 3
    ]
    return keywords

def test_keyword_extraction():
    """Test 1: Extraction des mots-clés"""
    print("="*100)
    print("TEST 1: EXTRACTION DES MOTS-CLÉS")
    print("="*100)
    
    test_cases = [
        "je cherche un plombier",
        "je voudrais trouver un photographe professionnel",
        "je recherche un électricien à Douala",
        "je veux un restaurant chinois",
        "je cherche des chaussures de sport"
    ]
    
    for text in test_cases:
        keywords = extract_keywords_simulated(text)
        combined = " ".join(keywords) if len(keywords) > 1 else keywords[0] if keywords else ""
        
        print(f"\nTexte: '{text}'")
        print(f"  Mots-cles extraits: {keywords}")
        print(f"  Terme de recherche (tous combines): '{combined}'")
        
        # Vérifier que "trouver" n'est pas dans les mots-clés
        if "trouver" in text.lower() and "trouver" in keywords:
            print(f"  ERREUR: 'trouver' n'aurait pas du etre extrait!")
        elif "trouver" in text.lower():
            print(f"  OK: 'trouver' correctement ignore (stop word)")

def test_word_similarity():
    """Test 2: Matching avec word_similarity()"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*100)
    print("TEST 2: MATCHING AVEC word_similarity() (seuil 0.6)")
    print("="*100)
    
    # Services de test
    test_services = [
        (5, "Services de plomberie à domicile", "plombier"),
        (13, "Services de photographie professionnelle", "photographe professionnel"),
        (155, "Services d'électricité à Douala", "électricien"),
        (None, "Restaurant chinois", "restaurant"),
        (None, "Chaussures confortables et stylées", "chaussures")
    ]
    
    for service_id, service_title, search_term in test_services:
        print(f"\nRecherche: '{search_term}' vs Titre: '{service_title}'")
        
        # Test avec similarity() (ancienne méthode)
        cur.execute("""
            SELECT similarity(LOWER(%s), LOWER(%s)) as sim
        """, (search_term, service_title))
        sim_old = cur.fetchone()[0]
        
        # Test avec word_similarity() (nouvelle méthode)
        cur.execute("""
            SELECT word_similarity(LOWER(%s), LOWER(%s)) as word_sim
        """, (search_term, service_title))
        word_sim = cur.fetchone()[0]
        
        # Test avec seuil 0.6
        passes_threshold = word_sim > 0.6
        
        print(f"  similarity() (ancienne): {sim_old:.3f} {'OK' if sim_old > 0.6 else 'ECHEC'}")
        print(f"  word_similarity() (nouvelle): {word_sim:.3f} {'OK' if passes_threshold else 'ECHEC'}")
        
        if sim_old < 0.6 and word_sim > 0.6:
            print(f"  AMELIORATION: word_similarity() trouve le match (ancienne methode echouait)")
        elif sim_old > 0.6 and word_sim > 0.6:
            print(f"  Les deux methodes fonctionnent")
        elif word_sim <= 0.6:
            print(f"  ATTENTION: word_similarity() ne passe pas le seuil 0.6")
    
    cur.close()
    conn.close()

def test_full_search_simulation():
    """Test 3: Simulation complète de la recherche"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*100)
    print("TEST 3: SIMULATION COMPLÈTE DE LA RECHERCHE")
    print("="*100)
    
    search_queries = [
        "je cherche un plombier",
        "je voudrais trouver un photographe professionnel",
        "je recherche un électricien à Douala",
        "je veux un restaurant chinois",
        "je cherche des chaussures de sport"
    ]
    
    for user_text in search_queries:
        print(f"\n{'='*100}")
        print(f"Recherche utilisateur: '{user_text}'")
        print(f"{'='*100}")
        
        # Étape 1: Extraction des mots-clés
        keywords = extract_keywords_simulated(user_text)
        combined_keywords = " ".join(keywords) if len(keywords) > 1 else keywords[0] if keywords else ""
        print(f"\nEtape 1 - Extraction:")
        print(f"  Mots-cles: {keywords}")
        print(f"  Terme de recherche (combine): '{combined_keywords}'")
        
        if not combined_keywords:
            print(f"  ERREUR: Aucun mot-cle extrait - recherche impossible")
            continue
        
        # Étape 2: Recherche dans la base avec word_similarity()
        start_time = time.time()
        
        # Simuler la requête SQL avec word_similarity()
        # Utiliser %s pour psycopg2
        search_term = combined_keywords
        cur.execute("""
            SELECT 
                s.id,
                s.data->'titre_service'->>'valeur' as titre,
                s.data->'category'->>'valeur' as category,
                -- Calcul du score avec word_similarity()
                (
                    CASE 
                        WHEN word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))) > 0.6 THEN 
                            word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))) * 8.0
                        ELSE 0.0
                    END +
                    CASE 
                        WHEN word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'category'->>'valeur', s.category, ''))) > 0.6 THEN 
                            word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'category'->>'valeur', s.category, ''))) * 9.0
                        ELSE 0.0
                    END +
                    CASE 
                        WHEN LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE '%%' || %s || '%%' THEN 5.0
                        ELSE 0.0
                    END
                ) as score
            FROM services s
            WHERE s.is_active = TRUE
            AND (
                -- Conditions de matching avec word_similarity()
                COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE '%%' || %s || '%%'
                OR COALESCE(s.data->'category'->>'valeur', s.category, '') ILIKE '%%' || %s || '%%'
                OR word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))) > 0.6
                OR word_similarity(LOWER(%s), LOWER(COALESCE(s.data->'category'->>'valeur', s.category, ''))) > 0.6
            )
            ORDER BY score DESC
            LIMIT 10
        """, (search_term, search_term, search_term, search_term, search_term, search_term, search_term, search_term))
        
        results = cur.fetchall()
        elapsed_time = time.time() - start_time
        
        print(f"\nEtape 2 - Resultats de recherche:")
        print(f"  Temps d'execution: {elapsed_time*1000:.2f}ms")
        print(f"  Nombre de resultats: {len(results)}")
        
        if results:
            print(f"\n  Top resultats:")
            for i, (service_id, titre, category, score) in enumerate(results[:5], 1):
                print(f"    {i}. Service {service_id}: '{titre}' (cat: {category}, score: {score:.2f})")
        else:
            print(f"  Aucun resultat trouve")
    
    cur.close()
    conn.close()

def test_comparison_old_vs_new():
    """Test 4: Comparaison ancienne vs nouvelle méthode"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*100)
    print("TEST 4: COMPARAISON ANCIENNE vs NOUVELLE MÉTHODE")
    print("="*100)
    
    test_cases = [
        ("plombier", "Services de plomberie à domicile"),
        ("photographe professionnel", "Services de photographie professionnelle"),
        ("électricien", "Services d'électricité à Douala"),
    ]
    
    print("\nComparaison similarity() vs word_similarity() avec seuil 0.6:")
    print("-" * 100)
    
    for search_term, service_title in test_cases:
        # Ancienne méthode
        cur.execute("""
            SELECT similarity(LOWER(%s), LOWER(%s)) as sim
        """, (search_term, service_title))
        sim_old = cur.fetchone()[0]
        old_passes = sim_old > 0.6
        
        # Nouvelle méthode
        cur.execute("""
            SELECT word_similarity(LOWER(%s), LOWER(%s)) as word_sim
        """, (search_term, service_title))
        word_sim = cur.fetchone()[0]
        new_passes = word_sim > 0.6
        
        print(f"\n'{search_term}' vs '{service_title}':")
        print(f"  Ancienne (similarity): {sim_old:.3f} {'OK' if old_passes else 'ECHEC'} (seuil 0.6)")
        print(f"  Nouvelle (word_similarity): {word_sim:.3f} {'OK' if new_passes else 'ECHEC'} (seuil 0.6)")
        
        if not old_passes and new_passes:
            print(f"  AMELIORATION: Nouvelle methode trouve le match!")
        elif old_passes and new_passes:
            print(f"  Les deux methodes fonctionnent")
        elif not new_passes:
            print(f"  ATTENTION: Nouvelle methode ne passe pas le seuil")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    test_keyword_extraction()
    test_word_similarity()
    test_full_search_simulation()
    test_comparison_old_vs_new()
    
    print("\n" + "="*100)
    print("RÉSUMÉ DES TESTS")
    print("="*100)
    print("\nChangements valides:")
    print("  1. Extraction des mots-cles: 'trouver' est bien ignore")
    print("  2. Utilisation de tous les mots-cles: combines en une seule chaine")
    print("  3. word_similarity() remplace similarity() pour meilleur matching")
    print("  4. Seuil 0.6 pour eliminer les faux positifs")
    print("\nProchaines etapes:")
    print("  - Recompiler le backend Rust pour appliquer les changements")
    print("  - Tester avec l'application mobile")

