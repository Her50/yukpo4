#!/usr/bin/env python3
"""Vérification de la migration - Service 157"""

import psycopg2
import json

DATABASE_URL = "postgresql://user:password@host:port/database"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*80)
print("VÉRIFICATION MIGRATION - SERVICE 157")
print("="*80)

# Vérifier le service 157
cur.execute("""
    SELECT 
        s.id,
        s.data->'produits'->'valeur'->0->>'nom_produit' as nom,
        s.data->'produits'->'valeur'->0->>'description' as description,
        s.data->'produits'->'valeur'->0->>'description_produit' as description_produit
    FROM services s
    WHERE s.id = 157
""")

row = cur.fetchone()
if row:
    service_id, nom, description, description_produit = row
    print(f"\nService {service_id}:")
    print(f"  Nom: {nom}")
    print(f"  Description: {description if description else '❌ NON TROUVÉE'}")
    print(f"  Description_produit: {description_produit if description_produit else '❌ NON TROUVÉE'}")
    
    # Vérifier autocomplete_characteristics
    cur.execute("""
        SELECT ac.full_vector
        FROM autocomplete_characteristics ac
        WHERE ac.service_id = 157
        AND ac.is_real_product = TRUE
        AND ac.identifiant_base = 'produits'
        LIMIT 1
    """)
    
    ac_row = cur.fetchone()
    if ac_row:
        full_vector = ac_row[0]
        print(f"\nAutocomplete full_vector:")
        for i, val in enumerate(full_vector):
            print(f"  [{i}] {val[:80]}...")
        
        # Vérifier si description dans full_vector
        long_desc = [v for v in full_vector if len(v) > 50]
        if long_desc:
            print(f"\n✅ Description trouvée dans full_vector: {long_desc[0][:100]}...")
            if not description:
                print("  ⚠️ Mais description n'est PAS dans services.data->produits !")
        else:
            print("\n⚠️ Pas de description longue dans full_vector")
else:
    print("❌ Service 157 non trouvé")

cur.close()
conn.close()

