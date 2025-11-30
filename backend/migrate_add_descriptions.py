#!/usr/bin/env python3
"""
Script de migration pour ajouter les descriptions manquantes dans services.data->'produits'
Extrait les descriptions depuis autocomplete_characteristics.full_vector
"""

import psycopg2
import json
import sys

DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

def extract_description_from_full_vector(full_vector):
    """Extrait la description depuis full_vector (3ème élément ou élément long)"""
    if not full_vector or len(full_vector) < 3:
        return None
    
    # Chercher un élément long (> 50 caractères) après les 2 premiers
    for desc_candidate in full_vector[2:]:
        if len(desc_candidate) > 50:
            return desc_candidate
    
    # Sinon prendre le 3ème élément
    return full_vector[2] if len(full_vector) >= 3 else None

def main():
    print("="*80)
    print("MIGRATION: Ajout descriptions manquantes dans services.data->produits")
    print("="*80)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # 1. Compter les services à mettre à jour
        cur.execute("""
            SELECT COUNT(*)
            FROM services s
            WHERE s.is_active = true
            AND s.data->'produits' IS NOT NULL
            AND jsonb_typeof(s.data->'produits') = 'object'
            AND s.data->'produits'->>'type_donnee' = 'listeproduit'
            AND s.data->'produits'->'valeur' IS NOT NULL
            AND jsonb_array_length(s.data->'produits'->'valeur') > 0
            AND (
                s.data->'produits'->'valeur'->0->>'description' IS NULL 
                OR s.data->'produits'->'valeur'->0->>'description' = ''
            )
            AND (
                s.data->'produits'->'valeur'->0->>'description_produit' IS NULL 
                OR s.data->'produits'->'valeur'->0->>'description_produit' = ''
            )
        """)
        total_to_update = cur.fetchone()[0]
        print(f"\n📊 Services à mettre à jour: {total_to_update}")
        
        if total_to_update == 0:
            print("✅ Aucun service à mettre à jour !")
            return
        
        # 2. Récupérer les services à mettre à jour
        cur.execute("""
            SELECT 
                s.id as service_id,
                s.data as service_data
            FROM services s
            WHERE s.is_active = true
            AND s.data->'produits' IS NOT NULL
            AND jsonb_typeof(s.data->'produits') = 'object'
            AND s.data->'produits'->>'type_donnee' = 'listeproduit'
            AND s.data->'produits'->'valeur' IS NOT NULL
            AND jsonb_array_length(s.data->'produits'->'valeur') > 0
            AND (
                s.data->'produits'->'valeur'->0->>'description' IS NULL 
                OR s.data->'produits'->'valeur'->0->>'description' = ''
            )
            AND (
                s.data->'produits'->'valeur'->0->>'description_produit' IS NULL 
                OR s.data->'produits'->'valeur'->0->>'description_produit' = ''
            )
            ORDER BY s.id
        """)
        
        services = cur.fetchall()
        updated_count = 0
        skipped_count = 0
        
        print(f"\n🔄 Traitement de {len(services)} services...")
        
        for service_id, service_data in services:
            try:
                # Extraire le premier produit
                produits = service_data.get('produits', {})
                if produits.get('type_donnee') != 'listeproduit':
                    continue
                
                valeur_array = produits.get('valeur', [])
                if not valeur_array or len(valeur_array) == 0:
                    continue
                
                first_product = valeur_array[0]
                
                # Vérifier si description déjà présente
                if first_product.get('description') or first_product.get('description_produit'):
                    continue
                
                # Chercher la description dans autocomplete_characteristics
                cur.execute("""
                    SELECT ac.full_vector
                    FROM autocomplete_characteristics ac
                    WHERE ac.service_id = %s
                    AND ac.is_real_product = TRUE
                    AND ac.identifiant_base = 'produits'
                    AND ac.full_vector IS NOT NULL
                    AND array_length(ac.full_vector, 1) >= 3
                    ORDER BY ac.usage_count DESC NULLS LAST
                    LIMIT 1
                """, (service_id,))
                
                ac_row = cur.fetchone()
                if not ac_row:
                    skipped_count += 1
                    continue
                
                full_vector = ac_row[0]
                description = extract_description_from_full_vector(full_vector)
                
                if not description or len(description) < 10:
                    skipped_count += 1
                    continue
                
                # Mettre à jour le produit avec la description
                first_product['description'] = description
                valeur_array[0] = first_product
                produits['valeur'] = valeur_array
                service_data['produits'] = produits
                
                # Sauvegarder
                cur.execute("""
                    UPDATE services
                    SET data = %s::jsonb,
                        updated_at = NOW()
                    WHERE id = %s
                """, (json.dumps(service_data), service_id))
                
                updated_count += 1
                
                if updated_count % 10 == 0:
                    conn.commit()
                    print(f"  ✅ {updated_count} services mis à jour...")
                
            except Exception as e:
                print(f"  ❌ Erreur service {service_id}: {e}")
                conn.rollback()
                continue
        
        # Commit final
        conn.commit()
        
        print(f"\n✅ Migration terminée !")
        print(f"  - Services mis à jour: {updated_count}")
        print(f"  - Services ignorés (pas de description dans autocomplete): {skipped_count}")
        
        # Vérification
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (
                    WHERE data->'produits'->'valeur'->0->>'description' IS NOT NULL 
                    AND data->'produits'->'valeur'->0->>'description' != ''
                ) as avec_description
            FROM services
            WHERE is_active = true
            AND data->'produits' IS NOT NULL
            AND jsonb_typeof(data->'produits') = 'object'
            AND data->'produits'->>'type_donnee' = 'listeproduit'
            AND jsonb_array_length(data->'produits'->'valeur') > 0
        """)
        
        result = cur.fetchone()
        total, avec_description = result
        print(f"\n📊 Statistiques finales:")
        print(f"  - Total services avec produits: {total}")
        print(f"  - Services avec description: {avec_description} ({avec_description*100//total if total > 0 else 0}%)")
        
    except Exception as e:
        print(f"\n❌ Erreur lors de la migration: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

