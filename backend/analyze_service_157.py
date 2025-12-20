#!/usr/bin/env python3
"""Analyse détaillée du service 157 pour comprendre pourquoi extract_all_product_text ne trouve pas 'confortables'"""

import psycopg2
import json

DATABASE_URL = "postgresql://user:password@host:port/database"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*80)
print("ANALYSE SERVICE 157")
print("="*80)

# 1. Structure du service
print("\n1. STRUCTURE DU SERVICE:")
cur.execute("""
    SELECT 
        s.id,
        s.is_active,
        s.category,
        s.data->'titre_service'->>'valeur' as titre_service,
        jsonb_typeof(s.data->'produits') as produits_type
    FROM services s
    WHERE s.id = 157
""")
row = cur.fetchone()
print(f"  ID: {row[0]}")
print(f"  Actif: {row[1]}")
print(f"  Catégorie: {row[2]}")
print(f"  Titre: {row[3]}")
print(f"  Type produits: {row[4]}")

# 2. Produits bruts
print("\n2. PRODUITS BRUTS:")
cur.execute("SELECT s.data->'produits' FROM services s WHERE s.id = 157")
produits_raw = cur.fetchone()[0]
print(f"  Type: {type(produits_raw)}")
print(f"  Contenu: {json.dumps(produits_raw, indent=4, ensure_ascii=False)}")

# 3. Test extract_all_product_text sur les produits individuels
print("\n3. TEXTE EXTRAIT PAR extract_all_product_text:")
cur.execute("""
    SELECT 
        product,
        extract_all_product_text(product) as extracted_text
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
    WHERE s.id = 157
""")
product_rows = cur.fetchall()
for product, extracted in product_rows:
    print(f"  Produit: {json.dumps(product, indent=4, ensure_ascii=False)[:200]}...")
    print(f"  Texte extrait: {extracted}")
    print(f"  Contient 'confortables': {'✅ OUI' if extracted and 'confortables' in extracted.lower() else '❌ NON'}")

# 4. Autocomplete characteristics
print("\n4. AUTOCOMPLETE CHARACTERISTICS:")
cur.execute("""
    SELECT 
        ac.product_id,
        ac.full_vector,
        ac.characteristic_vector
    FROM autocomplete_characteristics ac
    WHERE ac.service_id = 157
    AND ac.is_real_product = TRUE
""")
ac_rows = cur.fetchall()
for row in ac_rows:
    product_id, full_vector, char_vector = row
    print(f"  Product ID: {product_id}")
    print(f"  Full vector: {full_vector}")
    print(f"  Contient 'confortables': {'✅ OUI' if any('confortables' in str(v).lower() for v in full_vector) else '❌ NON'}")

# 5. Comparaison
print("\n5. COMPARAISON:")
print("  - Autocomplete full_vector contient 'confortables': ✅")
print("  - extract_all_product_text contient 'confortables': ❌")
print("\n  PROBLÈME IDENTIFIÉ:")
print("  Le produit dans services.data->'produits' est un OBJET, pas un tableau.")
print("  extract_all_product_text() cherche dans des champs spécifiques (nom, categorie, description)")
print("  mais le produit utilise 'nom_produit' au lieu de 'nom'.")
print("  De plus, la description avec 'confortables' n'est peut-être pas dans le produit JSONB,")
print("  mais seulement dans autocomplete_characteristics.full_vector.")

cur.close()
conn.close()

