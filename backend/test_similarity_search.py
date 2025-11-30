#!/usr/bin/env python3
"""Test de la recherche avec similarité pour trouver les services manquants"""

import psycopg2
import time

DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

SEARCH_TERMS = {
    "plombier": 5,  # Service 5: "Services de plomberie à domicile"
    "photographe": 13,  # Service 13: "Services de photographie professionnelle"
    "électricien": 155  # Service 155: "Services d'électricité à Douala"
}

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("TEST RECHERCHE AVEC SIMILARITÉ (seuil 0.15)")
print("="*100)

for search_term, expected_service_id in SEARCH_TERMS.items():
    print(f"\n{'='*100}")
    print(f"🔍 TERME: '{search_term}' (Service attendu: {expected_service_id})")
    print(f"{'='*100}")
    
    start_time = time.time()
    
    # Test avec similarité seuil 0.3
    query = """
    WITH all_products_extracted AS (
        SELECT 
            s.id as service_id,
            s.data,
            s.category,
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END as products_array
        FROM services s
        WHERE s.is_active = true
    ),
    products_extracted AS (
        SELECT DISTINCT
            ape.service_id,
            ape.data,
            ape.category,
            ape.products_array
        FROM all_products_extracted ape
        WHERE (
            EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(ape.products_array) AS product
                WHERE (
                    extract_all_product_text(product) ILIKE %s
                    OR product->>'nom' ILIKE %s
                    OR product->>'nom_produit' ILIKE %s
                    OR product->>'categorie' ILIKE %s
                    OR product->>'description' ILIKE %s
                )
            )
            OR EXISTS (
                SELECT 1 
                FROM autocomplete_characteristics ac
                WHERE ac.service_id = ape.service_id
                AND ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND EXISTS (
                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                    WHERE LOWER(vec_val) LIKE %s
                )
            )
            OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE %s
            OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE %s
            OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE %s
            OR similarity(LOWER(COALESCE(ape.data->'titre_service'->>'valeur', ape.data->>'titre_service', '')), LOWER(%s)) > 0.15
            OR similarity(LOWER(COALESCE(ape.data->'description'->>'valeur', ape.data->>'description', '')), LOWER(%s)) > 0.15
            OR similarity(LOWER(COALESCE(ape.data->'category'->>'valeur', ape.data->>'category', ape.category, '')), LOWER(%s)) > 0.15
        )
    )
    SELECT 
        pe.service_id,
        pe.data->'titre_service'->>'valeur' as titre_service,
        pe.category,
        jsonb_array_length(pe.products_array) as produits_count
    FROM products_extracted pe
    ORDER BY pe.service_id
    """
    
    pattern = f'%{search_term.lower()}%'
    cur.execute(query, (pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, search_term, search_term, search_term))
    
    results = cur.fetchall()
    elapsed_time = (time.time() - start_time) * 1000
    
    print(f"\n⏱️  Temps d'exécution: {elapsed_time:.2f} ms")
    print(f"{'✅' if results else '❌'} Résultats trouvés: {len(results)}")
    
    found_expected = any(r[0] == expected_service_id for r in results)
    
    if results:
        print(f"\nServices trouvés:")
        for r in results:
            service_id, titre, category, produits_count = r
            is_expected = "⭐ ATTENDU" if service_id == expected_service_id else ""
            print(f"  - Service {service_id}: {titre} ({produits_count} produits) {is_expected}")
    
    if found_expected:
        print(f"\n✅ SUCCÈS: Le service {expected_service_id} est trouvé !")
    else:
        print(f"\n❌ ÉCHEC: Le service {expected_service_id} n'est PAS trouvé")
        
        # Vérifier la similarité manuellement
        cur.execute("""
            SELECT 
                similarity(LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')), LOWER(%s)) as sim_titre,
                similarity(LOWER(COALESCE(s.data->'description'->>'valeur', '')), LOWER(%s)) as sim_desc,
                s.data->'titre_service'->>'valeur' as titre
            FROM services s
            WHERE s.id = %s
        """, (search_term, search_term, expected_service_id))
        
        sim_row = cur.fetchone()
        if sim_row:
            sim_titre, sim_desc, titre = sim_row
            print(f"\n  Similarité titre: {sim_titre:.3f} (seuil: 0.15)")
            print(f"  Similarité description: {sim_desc:.3f} (seuil: 0.15)")
            print(f"  Titre: {titre}")
            if sim_titre < 0.15 and sim_desc < 0.15:
                print(f"  ⚠️  Similarité trop faible, besoin d'un seuil plus bas ou d'enrichissement")
            elif sim_titre >= 0.15 or sim_desc >= 0.15:
                print(f"  ✅ Similarité suffisante avec seuil 0.15")

cur.close()
conn.close()

