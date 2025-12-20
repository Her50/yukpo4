#!/usr/bin/env python3
"""
Test complet de recherche : Autocomplete vs Recherche directe
Analyse le comportement, temps d'exécution et résultats pour plusieurs termes
"""

import psycopg2
import json
import time
from typing import Dict, List, Tuple

DATABASE_URL = "postgresql://user:password@host:port/database"

# Termes de recherche à tester
SEARCH_TERMS = ["chaussures", "plombier", "photographe", "restaurant", "électricien"]

def test_autocomplete_search(conn, search_term: str) -> Tuple[List[Dict], float]:
    """Test de recherche via autocomplete_characteristics avec mesure du temps"""
    cur = conn.cursor()
    
    start_time = time.time()
    
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
        s.category,
        s.is_active
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
            'category': row[8],
            'is_active': row[9]
        })
    
    elapsed_time = (time.time() - start_time) * 1000  # en millisecondes
    
    cur.close()
    return results, elapsed_time

def test_direct_search(conn, search_term: str) -> Tuple[List[Dict], float]:
    """Test de recherche directe via services.data->'produits' avec mesure du temps"""
    cur = conn.cursor()
    
    start_time = time.time()
    
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
        )
    )
    SELECT 
        pe.service_id,
        pe.data->'titre_service'->>'valeur' as titre_service,
        pe.category,
        jsonb_array_length(pe.products_array) as produits_count,
        pe.products_array
    FROM products_extracted pe
    ORDER BY pe.service_id
    LIMIT 20
    """
    
    pattern = f'%{search_term.lower()}%'
    cur.execute(query, (pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern))
    
    results = []
    for row in cur.fetchall():
        results.append({
            'service_id': row[0],
            'titre_service': row[1],
            'category': row[2],
            'produits_count': row[3],
            'products_array': row[4]
        })
    
    elapsed_time = (time.time() - start_time) * 1000  # en millisecondes
    
    cur.close()
    return results, elapsed_time

def analyze_results(autocomplete_results: List[Dict], direct_results: List[Dict], search_term: str):
    """Analyse et compare les résultats"""
    autocomplete_ids = {r['service_id'] for r in autocomplete_results}
    direct_ids = {r['service_id'] for r in direct_results}
    
    only_autocomplete = autocomplete_ids - direct_ids
    only_direct = direct_ids - autocomplete_ids
    both = autocomplete_ids & direct_ids
    
    return {
        'autocomplete_count': len(autocomplete_results),
        'direct_count': len(direct_results),
        'only_autocomplete': len(only_autocomplete),
        'only_direct': len(only_direct),
        'both': len(both),
        'only_autocomplete_ids': sorted(only_autocomplete),
        'only_direct_ids': sorted(only_direct),
        'both_ids': sorted(both)
    }

def main():
    print("="*100)
    print("TEST COMPLET DE RECHERCHE : AUTOCOMPLETE vs RECHERCHE DIRECTE")
    print("="*100)
    
    conn = psycopg2.connect(DATABASE_URL)
    
    all_results = []
    
    for search_term in SEARCH_TERMS:
        print(f"\n{'='*100}")
        print(f"🔍 TERME DE RECHERCHE: '{search_term}'")
        print(f"{'='*100}")
        
        # Test Autocomplete
        print(f"\n📊 TEST 1: AUTOCOMPLETE (suggestions lors de la saisie)")
        print("-"*100)
        autocomplete_results, autocomplete_time = test_autocomplete_search(conn, search_term)
        print(f"⏱️  Temps d'exécution: {autocomplete_time:.2f} ms")
        print(f"✅ Résultats trouvés: {len(autocomplete_results)}")
        
        if autocomplete_results:
            print(f"\nPremiers résultats autocomplete:")
            for i, r in enumerate(autocomplete_results[:5], 1):
                print(f"  {i}. Service {r['service_id']}: {r['titre_service']} (usage: {r['usage_count']})")
                # Afficher les éléments de full_vector qui matchent
                matching_elements = [v for v in r['full_vector'] if search_term.lower() in v.lower()]
                if matching_elements:
                    print(f"     → Match: {matching_elements[0][:80]}...")
        
        # Test Recherche Directe
        print(f"\n📊 TEST 2: RECHERCHE DIRECTE (bouton envoyer)")
        print("-"*100)
        direct_results, direct_time = test_direct_search(conn, search_term)
        print(f"⏱️  Temps d'exécution: {direct_time:.2f} ms")
        print(f"{'✅' if direct_results else '❌'} Résultats trouvés: {len(direct_results)}")
        
        if direct_results:
            print(f"\nPremiers résultats recherche directe:")
            for i, r in enumerate(direct_results[:5], 1):
                print(f"  {i}. Service {r['service_id']}: {r['titre_service']} ({r['produits_count']} produits)")
        
        # Analyse comparative
        print(f"\n📊 COMPARAISON")
        print("-"*100)
        analysis = analyze_results(autocomplete_results, direct_results, search_term)
        print(f"  Autocomplete uniquement: {analysis['only_autocomplete']} services")
        if analysis['only_autocomplete_ids']:
            print(f"    IDs: {analysis['only_autocomplete_ids'][:5]}")
        print(f"  Recherche directe uniquement: {analysis['only_direct']} services")
        if analysis['only_direct_ids']:
            print(f"    IDs: {analysis['only_direct_ids'][:5]}")
        print(f"  Dans les deux: {analysis['both']} services")
        
        # Performance
        print(f"\n⚡ PERFORMANCE")
        print("-"*100)
        print(f"  Autocomplete: {autocomplete_time:.2f} ms")
        print(f"  Recherche directe: {direct_time:.2f} ms")
        speed_ratio = autocomplete_time / direct_time if direct_time > 0 else 0
        print(f"  Ratio vitesse: {speed_ratio:.2f}x ({'Autocomplete plus rapide' if speed_ratio < 1 else 'Recherche directe plus rapide'})")
        
        # Stocker les résultats
        all_results.append({
            'search_term': search_term,
            'autocomplete': {
                'count': len(autocomplete_results),
                'time_ms': autocomplete_time,
                'results': autocomplete_results[:3]  # Garder seulement les 3 premiers pour le résumé
            },
            'direct': {
                'count': len(direct_results),
                'time_ms': direct_time,
                'results': direct_results[:3]
            },
            'analysis': analysis
        })
    
    # Résumé global
    print(f"\n{'='*100}")
    print("📊 RÉSUMÉ GLOBAL")
    print(f"{'='*100}")
    print(f"{'Terme':<15} {'Autocomplete':<20} {'Directe':<20} {'Ratio':<15} {'Différence':<15}")
    print("-"*100)
    
    for result in all_results:
        term = result['search_term']
        ac_count = result['autocomplete']['count']
        dir_count = result['direct']['count']
        ac_time = result['autocomplete']['time_ms']
        dir_time = result['direct']['time_ms']
        ratio = ac_time / dir_time if dir_time > 0 else 0
        diff = abs(ac_count - dir_count)
        
        print(f"{term:<15} {ac_count:>3} ({ac_time:>6.1f}ms) {dir_count:>3} ({dir_time:>6.1f}ms) {ratio:>6.2f}x {diff:>3} services")
    
    # Statistiques moyennes
    avg_autocomplete_time = sum(r['autocomplete']['time_ms'] for r in all_results) / len(all_results)
    avg_direct_time = sum(r['direct']['time_ms'] for r in all_results) / len(all_results)
    total_autocomplete = sum(r['autocomplete']['count'] for r in all_results)
    total_direct = sum(r['direct']['count'] for r in all_results)
    
    print(f"\n📈 STATISTIQUES MOYENNES")
    print("-"*100)
    print(f"  Temps moyen autocomplete: {avg_autocomplete_time:.2f} ms")
    print(f"  Temps moyen recherche directe: {avg_direct_time:.2f} ms")
    print(f"  Total résultats autocomplete: {total_autocomplete}")
    print(f"  Total résultats recherche directe: {total_direct}")
    print(f"  Différence totale: {abs(total_autocomplete - total_direct)} services")
    
    conn.close()
    
    print(f"\n{'='*100}")
    print("✅ TESTS TERMINÉS")
    print(f"{'='*100}")

if __name__ == "__main__":
    main()

