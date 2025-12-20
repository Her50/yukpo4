#!/usr/bin/env python3
"""
Analyse du problème de scoring : pourquoi les services ne sont pas trouvés malgré leur existence
"""

import psycopg2
import time

DATABASE_URL = "postgresql://user:password@host:port/database"

SERVICES_TO_ANALYZE = [
    (5, "plombier", "Services de plomberie à domicile"),
    (13, "photographe", "Services de photographie professionnelle"),
    (155, "électricien", "Services d'électricité à Douala")
]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("ANALYSE DU PROBLÈME DE SCORING")
print("="*100)

for service_id, search_term, titre in SERVICES_TO_ANALYZE:
    print(f"\n{'='*100}")
    print(f"🔍 SERVICE {service_id}: '{titre}' (recherche: '{search_term}')")
    print(f"{'='*100}")
    
    # 1. Vérifier si le service passe le filtre WHERE
    cur.execute("""
        SELECT 
            similarity(LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')), LOWER(%s)) as sim_titre,
            similarity(LOWER(COALESCE(s.data->'description'->>'valeur', '')), LOWER(%s)) as sim_desc,
            s.data->'titre_service'->>'valeur' as titre
        FROM services s
        WHERE s.id = %s
    """, (search_term, search_term, service_id))
    
    sim_row = cur.fetchone()
    if sim_row:
        sim_titre, sim_desc, titre_actual = sim_row
        print(f"\n📊 SIMILARITÉ:")
        print(f"  Titre: {sim_titre:.3f} (seuil WHERE: 0.15, seuil SCORE: 0.6)")
        print(f"  Description: {sim_desc:.3f} (seuil WHERE: 0.15)")
        print(f"  Passe le filtre WHERE (>0.15): {'✅ OUI' if sim_titre > 0.15 or sim_desc > 0.15 else '❌ NON'}")
        print(f"  Obtient un score de similarité (>0.6): {'✅ OUI' if sim_titre > 0.6 else '❌ NON (score = 0)'}")
    
    # 2. Calculer le score complet comme dans la requête SQL
    print(f"\n📊 CALCUL DU SCORE (comme dans la requête SQL):")
    
    # Simuler le calcul du score
    score_components = []
    
    # Score ts_rank titre
    cur.execute("""
        SELECT ts_rank(
            to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')),
            plainto_tsquery('french', %s)
        ) * 1.5 as ts_score
        FROM services s
        WHERE s.id = %s
    """, (search_term, service_id))
    ts_score = cur.fetchone()[0] or 0.0
    score_components.append(("ts_rank titre", ts_score * 1.5))
    
    # Score similarité titre (seuil 0.6)
    if sim_titre > 0.6:
        sim_score_titre = sim_titre * 8.0
        score_components.append(("similarity titre (>0.6)", sim_score_titre))
    else:
        score_components.append(("similarity titre (>0.6)", 0.0))
        print(f"  ⚠️  PROBLÈME: Similarité titre {sim_titre:.3f} < 0.6 → score = 0")
    
    # Score ILIKE titre
    cur.execute("""
        SELECT 
            CASE 
                WHEN LOWER(s.data->'titre_service'->>'valeur') = LOWER(%s) THEN 20.0
                WHEN LOWER(s.data->'titre_service'->>'valeur') LIKE LOWER(%s) || '%%' THEN 10.0
                WHEN s.data->'titre_service'->>'valeur' ILIKE '%%' || %s || '%%' THEN 5.0
                ELSE 0.0
            END as ilike_score
        FROM services s
        WHERE s.id = %s
    """, (search_term, search_term, search_term, service_id))
    ilike_score = cur.fetchone()[0] or 0.0
    score_components.append(("ILIKE titre", ilike_score))
    
    # Score produits (0 car pas de produits)
    score_components.append(("produits", 0.0))
    
    # Score autocomplete (0 car pas dans autocomplete_characteristics)
    score_components.append(("autocomplete", 0.0))
    
    # Score total
    total_score = sum(score for _, score in score_components)
    
    print(f"\n  Composants du score:")
    for name, score in score_components:
        print(f"    - {name}: {score:.2f}")
    print(f"  📊 SCORE TOTAL: {total_score:.2f}")
    
    # 3. Vérifier si le service serait dans le top 100
    print(f"\n💡 ANALYSE:")
    if sim_titre > 0.15:
        print(f"  ✅ Service passe le filtre WHERE (similarité {sim_titre:.3f} > 0.15)")
        if sim_titre < 0.6:
            print(f"  ❌ MAIS n'obtient PAS de score de similarité (seuil 0.6 trop élevé)")
            print(f"  ⚠️  PROBLÈME FONDAMENTAL: Le WHERE filtre avec 0.15, mais le SCORE utilise 0.6")
            print(f"  💡 SOLUTION: Utiliser le même seuil (0.15) ou donner un score proportionnel")
        else:
            print(f"  ✅ Obtient un score de similarité")
    else:
        print(f"  ❌ Service ne passe même pas le filtre WHERE")
    
    if total_score > 0:
        print(f"  ✅ Score total > 0, devrait apparaître dans les résultats")
    else:
        print(f"  ❌ Score total = 0, ne devrait PAS apparaître dans les résultats")
        print(f"  ⚠️  PROBLÈME: Même si le service passe le WHERE, il obtient un score de 0")

cur.close()
conn.close()

