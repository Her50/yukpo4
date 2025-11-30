#!/usr/bin/env python3
"""
Analyse détaillée des services trouvés pour comprendre pourquoi la recherche directe ne les trouve pas
"""

import psycopg2
import json

DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Services trouvés
SERVICES_TO_ANALYZE = [
    (5, "plombier"),
    (13, "photographe"),
    (155, "électricien")
]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("ANALYSE DÉTAILLÉE DES SERVICES TROUVÉS")
print("="*100)

for service_id, search_term in SERVICES_TO_ANALYZE:
    print(f"\n{'='*100}")
    print(f"🔍 SERVICE {service_id} (recherche: '{search_term}')")
    print(f"{'='*100}")
    
    # Structure complète du service
    cur.execute("""
        SELECT 
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service,
            s.data->'description'->>'valeur' as description,
            s.data->'produits' as produits,
            jsonb_typeof(s.data->'produits') as produits_type
        FROM services s
        WHERE s.id = %s
    """, (service_id,))
    
    service_row = cur.fetchone()
    if service_row:
        print(f"\n📦 STRUCTURE DU SERVICE:")
        print(f"  ID: {service_row[0]}")
        print(f"  Actif: {service_row[1]}")
        print(f"  Catégorie: {service_row[2]}")
        print(f"  Titre: {service_row[3]}")
        print(f"  Description: {(service_row[4] or '')[:100]}...")
        print(f"  Type produits: {service_row[6]}")
        
        produits = service_row[5]
        if produits:
            print(f"  Produits: {json.dumps(produits, indent=4, ensure_ascii=False)[:500]}...")
        else:
            print(f"  Produits: ❌ NULL ou vide")
    
    # Vérifier autocomplete_characteristics
    cur.execute("""
        SELECT 
            ac.product_id,
            ac.full_vector,
            ac.characteristic_vector,
            ac.is_real_product
        FROM autocomplete_characteristics ac
        WHERE ac.service_id = %s
        LIMIT 5
    """, (service_id,))
    
    ac_rows = cur.fetchall()
    print(f"\n📋 AUTOCOMPLETE CHARACTERISTICS:")
    if ac_rows:
        for ac_row in ac_rows:
            print(f"  Product ID: {ac_row[0]}")
            print(f"  Full vector: {ac_row[1]}")
            print(f"  Is real product: {ac_row[3]}")
    else:
        print(f"  ❌ Aucune entrée dans autocomplete_characteristics")
    
    # Tester si la recherche directe devrait trouver ce service
    print(f"\n🔍 TEST RECHERCHE DIRECTE:")
    
    # Test 1: Recherche dans titre_service
    cur.execute("""
        SELECT 
            CASE 
                WHEN LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) LIKE %s 
                THEN 'TROUVÉ dans titre_service'
                ELSE 'NON TROUVÉ dans titre_service'
            END as result
        FROM services s
        WHERE s.id = %s
    """, (f'%{search_term}%', service_id))
    
    result1 = cur.fetchone()[0]
    print(f"  - {result1}")
    
    # Test 2: Recherche dans produits
    cur.execute("""
        SELECT 
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                            THEN s.data->'produits'
                            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                            THEN s.data->'produits'->'valeur'
                            ELSE '[]'::jsonb
                        END
                    ) AS product
                    WHERE extract_all_product_text(product) ILIKE %s
                )
                THEN 'TROUVÉ dans produits'
                ELSE 'NON TROUVÉ dans produits'
            END as result
        FROM services s
        WHERE s.id = %s
    """, (f'%{search_term}%', service_id))
    
    result2 = cur.fetchone()[0]
    print(f"  - {result2}")
    
    # Test 3: Recherche dans autocomplete_characteristics
    cur.execute("""
        SELECT 
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM autocomplete_characteristics ac
                    WHERE ac.service_id = %s
                    AND ac.is_real_product = TRUE
                    AND ac.identifiant_base = 'produits'
                    AND EXISTS (
                        SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                        WHERE LOWER(vec_val) LIKE %s
                    )
                )
                THEN 'TROUVÉ dans autocomplete_characteristics'
                ELSE 'NON TROUVÉ dans autocomplete_characteristics'
            END as result
    """, (service_id, f'%{search_term}%'))
    
    result3 = cur.fetchone()[0]
    print(f"  - {result3}")
    
    # Conclusion
    print(f"\n💡 CONCLUSION:")
    if "TROUVÉ" in result1:
        print(f"  ✅ Le service devrait être trouvé par la recherche dans titre_service")
    elif "TROUVÉ" in result2:
        print(f"  ✅ Le service devrait être trouvé par la recherche dans produits")
    elif "TROUVÉ" in result3:
        print(f"  ✅ Le service devrait être trouvé par la recherche dans autocomplete_characteristics")
    else:
        print(f"  ❌ Le service ne sera PAS trouvé par la recherche directe actuelle")
        print(f"  ⚠️  PROBLÈME: La recherche directe ne cherche pas dans titre_service/description du service")

cur.close()
conn.close()

