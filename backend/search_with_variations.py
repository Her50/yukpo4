#!/usr/bin/env python3
"""
Recherche avec variations et similarité pour trouver les services
"""

import psycopg2
import json

DATABASE_URL = "postgresql://user:password@host:port/database"

SEARCH_TERMS = {
    "plombier": ["plomberie", "plombier", "plomber", "tuyau", "canalisation"],
    "photographe": ["photographe", "photographie", "photo", "photographe", "photographe"],
    "restaurant": ["restaurant", "restauration", "resto", "cuisine", "repas"],
    "électricien": ["électricien", "électricité", "électrique", "électricien", "électricien"]
}

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("="*100)
print("RECHERCHE AVEC VARIATIONS ET SIMILARITÉ")
print("="*100)

for search_term, variations in SEARCH_TERMS.items():
    print(f"\n{'='*100}")
    print(f"🔍 TERME: '{search_term}' (variations: {', '.join(variations)})")
    print(f"{'='*100}")
    
    # Recherche avec similarité PostgreSQL (pg_trgm)
    cur.execute("""
        SELECT 
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service,
            GREATEST(
                similarity(LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')), LOWER(%s)),
                similarity(LOWER(COALESCE(s.category, '')), LOWER(%s))
            ) as sim_score
        FROM services s
        WHERE s.is_active = true
        AND (
            similarity(LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')), LOWER(%s)) > 0.3
            OR similarity(LOWER(COALESCE(s.category, '')), LOWER(%s)) > 0.3
            OR LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) LIKE %s
            OR LOWER(COALESCE(s.category, '')) LIKE %s
        )
        ORDER BY sim_score DESC
        LIMIT 10
    """, (search_term, search_term, search_term, search_term, f'%{search_term}%', f'%{search_term}%'))
    
    services_similarity = cur.fetchall()
    
    # Recherche avec variations
    all_variations = [search_term] + variations
    variation_patterns = [f'%{v}%' for v in all_variations]
    
    cur.execute(f"""
        SELECT DISTINCT
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service
        FROM services s
        WHERE s.is_active = true
        AND (
            {' OR '.join([f"LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) LIKE %s"] * len(variation_patterns))}
            OR {' OR '.join([f"LOWER(COALESCE(s.category, '')) LIKE %s"] * len(variation_patterns))}
        )
        ORDER BY s.id
        LIMIT 10
    """, variation_patterns * 2)
    
    services_variations = cur.fetchall()
    
    # Recherche dans tous les services actifs (pour voir ce qui existe)
    cur.execute("""
        SELECT 
            s.id,
            s.is_active,
            s.category,
            s.data->'titre_service'->>'valeur' as titre_service,
            s.data->'description'->>'valeur' as description
        FROM services s
        WHERE s.is_active = true
        ORDER BY s.id
        LIMIT 50
    """)
    
    all_services = cur.fetchall()
    
    print(f"\n📊 Services trouvés par similarité (>0.3): {len(services_similarity)}")
    for s in services_similarity[:5]:
        print(f"  - Service {s[0]}: {s[3] or 'N/A'} (cat: {s[2]}, sim: {s[4]:.2f})")
    
    print(f"\n📊 Services trouvés par variations: {len(services_variations)}")
    for s in services_variations[:5]:
        print(f"  - Service {s[0]}: {s[3] or 'N/A'} (cat: {s[2]})")
    
    # Afficher quelques services pour voir ce qui existe
    print(f"\n📋 Échantillon de services actifs (pour référence):")
    for s in all_services[:10]:
        titre = s[3] or 'N/A'
        cat = s[2] or 'N/A'
        desc = (s[4] or '')[:50] if s[4] else ''
        print(f"  - Service {s[0]}: {titre} (cat: {cat}) {desc}")

cur.close()
conn.close()

