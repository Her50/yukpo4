#!/usr/bin/env python3
"""
Diagnostic de la table services - vérification du contenu réel
"""

import os
import psycopg2
import json
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

def diagnostic_table_services():
    print("🔍 DIAGNOSTIC DE LA TABLE SERVICES")
    print("=" * 50)
    
    # Connexion à PostgreSQL
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="yukpomnang",
            user="postgres",
            password="Hernandez87"
        )
        cursor = conn.cursor()
        print("✅ Connexion PostgreSQL réussie")
        
        # 1. Vérifier la structure de la table
        print("\n1️⃣ STRUCTURE DE LA TABLE SERVICES")
        print("-" * 40)
        
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'services'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        for col in columns:
            print(f"   - {col[0]}: {col[1]} ({'NULL' if col[2] == 'YES' else 'NOT NULL'})")
        
        # 2. Compter le nombre de services
        print("\n2️⃣ NOMBRE TOTAL DE SERVICES")
        print("-" * 40)
        
        cursor.execute("SELECT COUNT(*) FROM services")
        total_services = cursor.fetchone()[0]
        print(f"   Total: {total_services} services")
        
        # 3. Vérifier le service 559614 spécifiquement
        print("\n3️⃣ SERVICE 559614 - CONTENU RÉEL")
        print("-" * 40)
        
        cursor.execute("""
            SELECT id, user_id, data, is_active, created_at, embedding_status
            FROM services 
            WHERE id = 559614
        """)
        
        service_559614 = cursor.fetchone()
        if service_559614:
            print(f"   ✅ Service 559614 trouvé")
            print(f"   - ID: {service_559614[0]}")
            print(f"   - User ID: {service_559614[1]}")
            print(f"   - Is Active: {service_559614[3]}")
            print(f"   - Created At: {service_559614[4]}")
            print(f"   - Embedding Status: {service_559614[5]}")
            
            # Analyser le champ data
            data = service_559614[2]
            print(f"\n   📋 CONTENU DU CHAMP 'data':")
            print(f"   Type: {type(data)}")
            print(f"   Contenu brut: {json.dumps(data, indent=4, ensure_ascii=False)}")
            
            # Vérifier si c'est un service réel ou des données de recherche
            if isinstance(data, dict):
                has_titre_service = 'titre_service' in data
                has_origine_champs = any(
                    isinstance(v, dict) and 'origine_champs' in v 
                    for v in data.values() if isinstance(v, dict)
                )
                
                print(f"\n   🔍 ANALYSE:")
                print(f"   - Contient 'titre_service': {has_titre_service}")
                print(f"   - Contient 'origine_champs': {has_origine_champs}")
                
                if has_origine_champs:
                    print(f"   ⚠️  PROBLÈME DÉTECTÉ: Ce service contient des champs 'origine_champs'")
                    print(f"   🎯 CONCLUSION: Ce sont des données de recherche, pas un vrai service")
                else:
                    print(f"   ✅ Ce semble être un vrai service")
        else:
            print(f"   ❌ Service 559614 non trouvé")
        
        # 4. Vérifier d'autres services pour comparaison
        print("\n4️⃣ AUTRES SERVICES - COMPARAISON")
        print("-" * 40)
        
        cursor.execute("""
            SELECT id, data
            FROM services 
            WHERE id IN (138, 139, 753970)
            ORDER BY id
        """)
        
        other_services = cursor.fetchall()
        for service in other_services:
            service_id = service[0]
            data = service[1]
            
            print(f"\n   Service {service_id}:")
            if isinstance(data, dict):
                has_origine_champs = any(
                    isinstance(v, dict) and 'origine_champs' in v 
                    for v in data.values() if isinstance(v, dict)
                )
                print(f"   - Contient 'origine_champs': {has_origine_champs}")
                
                if has_origine_champs:
                    print(f"   ⚠️  PROBLÈME: Données de recherche")
                else:
                    print(f"   ✅ Vrai service")
            else:
                print(f"   - Type de données: {type(data)}")
        
        # 5. Statistiques des problèmes
        print("\n5️⃣ STATISTIQUES DES PROBLÈMES")
        print("-" * 40)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN data::text LIKE '%origine_champs%' THEN 1 END) as avec_origine_champs,
                COUNT(CASE WHEN data::text NOT LIKE '%origine_champs%' THEN 1 END) as sans_origine_champs
            FROM services
        """)
        
        stats = cursor.fetchone()
        print(f"   Total services: {stats[0]}")
        print(f"   Avec 'origine_champs': {stats[1]} (PROBLÉMATIQUES)")
        print(f"   Sans 'origine_champs': {stats[2]} (NORMALES)")
        
        if stats[1] > 0:
            print(f"\n   🚨 PROBLÈME MAJEUR: {stats[1]} services contiennent des données de recherche")
            print(f"   💡 SOLUTION: Nettoyer la table services ou recréer les vrais services")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    diagnostic_table_services() 