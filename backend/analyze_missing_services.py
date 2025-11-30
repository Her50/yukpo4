#!/usr/bin/env python3
"""
Analyse pourquoi certains services ne sont pas trouvés par la recherche
"""

import psycopg2
import json

DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

SEARCH_TERMS = ["chaussures", "plombier", "photographe", "restaurant", "électricien"]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("ANALYSE DES SERVICES MANQUANTS")
print("="*100)

for search_term in SEARCH_TERMS:
    print(f"\n{'='*100}")
    print(f"🔍 TERME: '{search_term}'")
    print(f"{'='*100}")
    
    # 1. Chercher dans services.data (titre_service, description, category)
    cur.execute("""
        SELECT 
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service,
            s.data->'titre_service'->>'valeur' as titre_service_alt,
            s.data->>'titre_service' as titre_service_raw,
            s.data->'description'->>'valeur' as description,
            s.data->>'description' as description_raw,
            jsonb_typeof(s.data->'produits') as produits_type
        FROM services s
        WHERE s.is_active = true
        AND (
            LOWER(s.category) LIKE %s
            OR LOWER(s.data->'titre_service'->>'valeur') LIKE %s
            OR LOWER(s.data->>'titre_service') LIKE %s
            OR LOWER(s.data->'description'->>'valeur') LIKE %s
            OR LOWER(s.data->>'description') LIKE %s
            OR LOWER(s.data->'category'->>'valeur') LIKE %s
        )
        ORDER BY s.id
    """, (f'%{search_term}%',) * 6)
    
    services_by_title = cur.fetchall()
    
    # 2. Chercher dans services.data->produits
    cur.execute("""
        SELECT DISTINCT
            s.id,
            s.data->'titre_service'->>'valeur' as titre_service
        FROM services s,
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
        AND (
            extract_all_product_text(product) ILIKE %s
            OR product->>'nom' ILIKE %s
            OR product->>'nom_produit' ILIKE %s
            OR product->>'categorie' ILIKE %s
            OR product->>'description' ILIKE %s
        )
    """, (f'%{search_term}%',) * 5)
    
    services_by_product = cur.fetchall()
    
    # 3. Chercher dans autocomplete_characteristics
    cur.execute("""
        SELECT DISTINCT
            ac.service_id,
            s.data->'titre_service'->>'valeur' as titre_service
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE ac.is_real_product = TRUE
        AND s.is_active = TRUE
        AND (
            EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE %s
            )
            OR EXISTS (
                SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE %s
            )
        )
    """, (f'%{search_term}%',) * 2)
    
    services_by_autocomplete = cur.fetchall()
    
    # Afficher les résultats
    print(f"\n📊 Services trouvés par titre/description/category: {len(services_by_title)}")
    for s in services_by_title[:5]:
        print(f"  - Service {s[0]}: {s[3] or s[4] or s[5] or 'N/A'} (cat: {s[2]})")
    
    print(f"\n📊 Services trouvés par produits: {len(services_by_product)}")
    for s in services_by_product[:5]:
        print(f"  - Service {s[0]}: {s[1] or 'N/A'}")
    
    print(f"\n📊 Services trouvés par autocomplete: {len(services_by_autocomplete)}")
    for s in services_by_autocomplete[:5]:
        print(f"  - Service {s[0]}: {s[1] or 'N/A'}")
    
    # Analyser un service spécifique si trouvé
    if services_by_title:
        service_id = services_by_title[0][0]
        print(f"\n🔬 ANALYSE DÉTAILLÉE SERVICE {service_id}:")
        
        cur.execute("""
            SELECT 
                s.id,
                s.is_active,
                s.category,
                s.data->'titre_service'->>'valeur' as titre_service,
                s.data->'produits' as produits,
                jsonb_typeof(s.data->'produits') as produits_type
            FROM services s
            WHERE s.id = %s
        """, (service_id,))
        
        service_row = cur.fetchone()
        if service_row:
            print(f"  Titre: {service_row[3]}")
            print(f"  Catégorie: {service_row[2]}")
            print(f"  Type produits: {service_row[5]}")
            if service_row[4]:
                produits = service_row[4]
                print(f"  Produits: {json.dumps(produits, indent=4, ensure_ascii=False)[:300]}...")
        
        # Vérifier autocomplete_characteristics
        cur.execute("""
            SELECT 
                ac.full_vector,
                ac.characteristic_vector
            FROM autocomplete_characteristics ac
            WHERE ac.service_id = %s
            AND ac.is_real_product = TRUE
            LIMIT 1
        """, (service_id,))
        
        ac_row = cur.fetchone()
        if ac_row:
            print(f"  Autocomplete full_vector: {ac_row[0]}")
        else:
            print(f"  ⚠️ Pas d'entrée dans autocomplete_characteristics")

cur.close()
conn.close()

