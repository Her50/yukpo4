#!/usr/bin/env python3
"""
Analyse de la méthode de calcul de similarité
"""

import psycopg2

DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("ANALYSE DE LA MÉTHODE DE CALCUL DE SIMILARITÉ")
print("="*100)

# Test cases
test_cases = [
    ("plombier", "Services de plomberie à domicile"),
    ("photographe", "Services de photographie professionnelle"),
    ("électricien", "Services d'électricité à Douala"),
    ("restaurant", "Restaurant chinois"),
    ("chaussures", "Chaussures confortables et stylées")
]

print("\n📊 TEST DE SIMILARITÉ AVEC pg_trgm:")
print("-" * 100)

for search_term, service_title in test_cases:
    # Calculer la similarité avec pg_trgm
    cur.execute("""
        SELECT 
            similarity(LOWER(%s), LOWER(%s)) as sim_exact,
            similarity(LOWER(%s), LOWER(%s)) as sim_reverse,
            %s ILIKE '%%' || %s || '%%' as contains_search,
            %s ILIKE '%%' || %s || '%%' as contains_title
        """, (search_term, service_title, service_title, search_term, 
              service_title, search_term, search_term, service_title))
    
    result = cur.fetchone()
    sim_exact, sim_reverse, contains_search, contains_title = result
    
    print(f"\n🔍 Recherche: '{search_term}' vs Titre: '{service_title}'")
    print(f"  📊 Similarité (terme → titre): {sim_exact:.3f}")
    print(f"  📊 Similarité (titre → terme): {sim_reverse:.3f}")
    print(f"  📊 Titre contient terme: {'✅' if contains_title else '❌'}")
    print(f"  📊 Terme contient titre: {'✅' if contains_search else '❌'}")
    
    # Analyser pourquoi la similarité est faible
    if sim_exact < 0.5:
        print(f"  ⚠️  PROBLÈME: Similarité trop faible ({sim_exact:.3f} < 0.5)")
        print(f"  💡 RAISON: pg_trgm compare les chaînes COMPLÈTES")
        print(f"     - '{search_term}' vs '{service_title}' sont très différents")
        print(f"     - pg_trgm cherche des trigrammes communs entre les deux chaînes complètes")
        print(f"     - Si le terme est court et le titre long, peu de trigrammes communs")

print("\n" + "="*100)
print("SOLUTION PROPOSÉE")
print("="*100)

print("\n💡 PROBLÈME IDENTIFIÉ:")
print("  La fonction similarity() de pg_trgm compare les DEUX chaînes complètes.")
print("  Pour 'plombier' vs 'Services de plomberie à domicile':")
print("    - Les trigrammes de 'plombier' sont: plo, lom, omb, mbi, bie, ier")
print("    - Les trigrammes de 'plomberie' sont: plo, lom, omb, mbe, ber, eri, rie")
print("    - Mais la chaîne complète 'Services de plomberie à domicile' a beaucoup")
print("      d'autres trigrammes qui diluent la similarité")

print("\n✅ SOLUTION 1: Chercher d'abord si le terme est CONTENU dans le titre")
print("  Utiliser ILIKE '%terme%' AVANT de calculer la similarité")
print("  Si contenu → score élevé, sinon → calculer similarité")

print("\n✅ SOLUTION 2: Calculer la similarité avec chaque MOT du titre")
print("  Diviser le titre en mots, calculer similarity(terme, mot) pour chaque mot")
print("  Prendre le MAX des similarités")

print("\n✅ SOLUTION 3: Utiliser word_similarity() au lieu de similarity()")
print("  word_similarity() cherche le meilleur match dans la chaîne")
print("  Plus adapté pour trouver un mot dans une phrase")

# Test avec word_similarity
print("\n📊 TEST AVEC word_similarity():")
print("-" * 100)

for search_term, service_title in test_cases:
    cur.execute("""
        SELECT 
            word_similarity(LOWER(%s), LOWER(%s)) as word_sim,
            strict_word_similarity(LOWER(%s), LOWER(%s)) as strict_word_sim
        """, (search_term, service_title, search_term, service_title))
    
    result = cur.fetchone()
    word_sim, strict_word_sim = result
    
    print(f"\n🔍 '{search_term}' vs '{service_title}':")
    print(f"  📊 word_similarity: {word_sim:.3f}")
    print(f"  📊 strict_word_similarity: {strict_word_sim:.3f}")

cur.close()
conn.close()

