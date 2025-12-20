#!/usr/bin/env python3
"""
Script d'analyse pour comparer autocomplete vs recherche directe
Identifie pourquoi l'autocomplete trouve des résultats mais pas la recherche directe
"""

import psycopg2
import json
import sys
from typing import List, Dict, Set

# Configuration de la base de données
DATABASE_URL = "postgresql://user:password@host:port/database"

def connect_db():
    """Connexion à la base de données"""
    return psycopg2.connect(DATABASE_URL)

def test_autocomplete_search(conn, search_term: str) -> List[Dict]:
    """Test de recherche via autocomplete_characteristics"""
    cur = conn.cursor()
    
    query = """
    SELECT 
        ac.service_id,
        ac.product_id,
        ac.full_vector,
        ac.characteristic_vector as product_vector,
        ac.location_vector,
        ac.chosen_location,
        ac.usage_count,
        s.data->'titre_service'->>'valeur' as titre_service,
        s.category
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE 
        ac.is_real_product = TRUE
        AND s.is_active = TRUE
        AND ac.identifiant_base = 'produits'
        AND (
            EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE %s
            )
        )
    ORDER BY ac.usage_count DESC NULLS LAST
    LIMIT 20
    """
    
    cur.execute(query, (f'%{search_term.lower()}%',))
    results = []
    for row in cur.fetchall():
        results.append({
            'service_id': row[0],
            'product_id': row[1],
            'full_vector': row[2],
            'product_vector': row[3],
            'location_vector': row[4],
            'chosen_location': row[5],
            'usage_count': row[6],
            'titre_service': row[7],
            'category': row[8]
        })
    
    cur.close()
    return results

def test_direct_search(conn, search_term: str) -> List[Dict]:
    """Test de recherche directe via services.data->'produits'"""
    cur = conn.cursor()
    
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
                    OR product->>'categorie' ILIKE %s
                    OR product->>'description' ILIKE %s
                )
            )
            OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE %s
            OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE %s
            OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE %s
        )
    )
    SELECT 
        pe.service_id,
        pe.data->'titre_service'->>'valeur' as titre_service,
        pe.category,
        jsonb_array_length(pe.products_array) as produits_count,
        pe.products_array
    FROM products_extracted pe
    LIMIT 20
    """
    
    pattern = f'%{search_term.lower()}%'
    cur.execute(query, (pattern, pattern, pattern, pattern, pattern, pattern, pattern))
    
    results = []
    for row in cur.fetchall():
        results.append({
            'service_id': row[0],
            'titre_service': row[1],
            'category': row[2],
            'produits_count': row[3],
            'products_array': row[4]
        })
    
    cur.close()
    return results

def analyze_service_products(conn, service_id: int, search_term: str):
    """Analyse détaillée des produits d'un service spécifique"""
    cur = conn.cursor()
    
    # Récupérer les données du service
    cur.execute("""
        SELECT 
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service,
            jsonb_typeof(s.data->'produits') as produits_type,
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END as products_array
        FROM services s
        WHERE s.id = %s
    """, (service_id,))
    
    service_row = cur.fetchone()
    if not service_row:
        print(f"❌ Service {service_id} non trouvé")
        cur.close()
        return
    
    service_id, is_active, category, titre_service, produits_type, products_array = service_row
    
    print(f"\n{'='*80}")
    print(f"📦 ANALYSE SERVICE {service_id}")
    print(f"{'='*80}")
    print(f"Titre: {titre_service}")
    print(f"Catégorie: {category}")
    print(f"Actif: {is_active}")
    print(f"Type produits: {produits_type}")
    print(f"Nombre produits: {len(products_array) if products_array else 0}")
    
    # Analyser chaque produit
    if products_array and len(products_array) > 0:
        print(f"\n🔍 ANALYSE DES PRODUITS:")
        for idx, product in enumerate(products_array):
            print(f"\n  Produit {idx + 1}:")
            print(f"    Structure: {json.dumps(product, indent=6, ensure_ascii=False)[:200]}...")
            
            # Tester extract_all_product_text
            cur.execute("""
                SELECT extract_all_product_text(%s::jsonb)
            """, (json.dumps(product),))
            extracted_text = cur.fetchone()[0]
            print(f"    Texte extrait: {extracted_text[:200]}...")
            
            # Vérifier si le terme est dans le texte extrait
            found = search_term.lower() in extracted_text.lower()
            print(f"    Contient '{search_term}': {'✅ OUI' if found else '❌ NON'}")
            
            # Vérifier les champs individuels
            if isinstance(product, dict):
                nom = product.get('nom', '')
                categorie = product.get('categorie', '')
                description = product.get('description', '')
                print(f"    nom: {nom}")
                print(f"    categorie: {categorie}")
                print(f"    description: {description[:100]}...")
    
    # Vérifier autocomplete_characteristics pour ce service
    cur.execute("""
        SELECT 
            ac.product_id,
            ac.full_vector,
            ac.characteristic_vector,
            ac.location_vector,
            ac.chosen_location
        FROM autocomplete_characteristics ac
        WHERE ac.service_id = %s
        AND ac.is_real_product = TRUE
        AND ac.identifiant_base = 'produits'
    """, (service_id,))
    
    autocomplete_rows = cur.fetchall()
    if autocomplete_rows:
        print(f"\n📋 AUTOCOMPLETE CHARACTERISTICS:")
        for row in autocomplete_rows:
            product_id, full_vector, characteristic_vector, location_vector, chosen_location = row
            print(f"  Product ID: {product_id}")
            print(f"  Full vector: {full_vector[:5]}... (total: {len(full_vector)})")
            print(f"  Characteristic vector: {characteristic_vector[:5]}... (total: {len(characteristic_vector)})")
            
            # Vérifier si le terme est dans full_vector
            found_in_vector = any(search_term.lower() in str(val).lower() for val in full_vector)
            print(f"  Contient '{search_term}' dans full_vector: {'✅ OUI' if found_in_vector else '❌ NON'}")
    
    cur.close()

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_search_analysis.py <terme_recherche>")
        print("Exemple: python test_search_analysis.py confortables")
        sys.exit(1)
    
    search_term = sys.argv[1]
    print(f"🔍 ANALYSE DE RECHERCHE: '{search_term}'")
    print("="*80)
    
    conn = connect_db()
    
    try:
        # Test 1: Autocomplete
        print("\n📊 TEST 1: RECHERCHE AUTOCOMPLETE")
        print("-"*80)
        autocomplete_results = test_autocomplete_search(conn, search_term)
        print(f"✅ Autocomplete trouve {len(autocomplete_results)} résultats")
        autocomplete_service_ids = {r['service_id'] for r in autocomplete_results}
        
        if autocomplete_results:
            print("\nPremiers résultats:")
            for r in autocomplete_results[:5]:
                print(f"  - Service {r['service_id']}: {r['titre_service']} (usage: {r['usage_count']})")
        
        # Test 2: Recherche directe
        print("\n📊 TEST 2: RECHERCHE DIRECTE")
        print("-"*80)
        direct_results = test_direct_search(conn, search_term)
        print(f"{'✅' if direct_results else '❌'} Recherche directe trouve {len(direct_results)} résultats")
        direct_service_ids = {r['service_id'] for r in direct_results}
        
        if direct_results:
            print("\nPremiers résultats:")
            for r in direct_results[:5]:
                print(f"  - Service {r['service_id']}: {r['titre_service']} ({r['produits_count']} produits)")
        
        # Comparaison
        print("\n📊 COMPARAISON")
        print("-"*80)
        only_autocomplete = autocomplete_service_ids - direct_service_ids
        only_direct = direct_service_ids - autocomplete_service_ids
        both = autocomplete_service_ids & direct_service_ids
        
        print(f"✅ Dans autocomplete uniquement: {len(only_autocomplete)} services")
        if only_autocomplete:
            print(f"   Service IDs: {sorted(only_autocomplete)[:10]}")
        
        print(f"✅ Dans recherche directe uniquement: {len(only_direct)} services")
        if only_direct:
            print(f"   Service IDs: {sorted(only_direct)[:10]}")
        
        print(f"✅ Dans les deux: {len(both)} services")
        
        # Analyser un service trouvé par autocomplete mais pas par recherche directe
        if only_autocomplete:
            print(f"\n🔬 ANALYSE DÉTAILLÉE D'UN SERVICE PROBLÉMATIQUE")
            print("-"*80)
            problematic_service_id = list(only_autocomplete)[0]
            analyze_service_products(conn, problematic_service_id, search_term)
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()

