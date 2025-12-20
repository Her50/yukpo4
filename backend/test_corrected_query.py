#!/usr/bin/env python3
"""Test de la requête SQL corrigée"""

import psycopg2

DATABASE_URL = "postgresql://user:password@host:port/database"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*80)
print("TEST DE LA REQUÊTE SQL CORRIGÉE")
print("="*80)

query = """
WITH all_products_extracted AS (
    SELECT 
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
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
        ape.created_at,
        ape.user_id,
        ape.gps,
        ape.category,
        ape.products_array
    FROM all_products_extracted ape
    WHERE (
        -- Recherche dans les PRODUITS
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
        -- ✅ NOUVEAU: Recherche dans autocomplete_characteristics.full_vector
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
        -- Recherche dans les champs service
        OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE %s
        OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE %s
        OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE %s
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

search_term = "confortables"
pattern = f'%{search_term}%'
pattern_lower = f'%{search_term.lower()}%'

cur.execute(query, (pattern, pattern, pattern, pattern, pattern, pattern_lower, pattern, pattern, pattern))

results = cur.fetchall()

print(f"\n✅ Requête corrigée trouve {len(results)} résultats pour '{search_term}':")
for row in results:
    service_id, titre, category, produits_count = row
    print(f"  - Service {service_id}: {titre} ({produits_count} produits)")

if len(results) > 0:
    print("\n✅ CORRECTION RÉUSSIE ! La recherche directe trouve maintenant les mêmes résultats que l'autocomplete.")
else:
    print("\n❌ La correction n'a pas fonctionné. Vérifier la requête SQL.")

cur.close()
conn.close()

