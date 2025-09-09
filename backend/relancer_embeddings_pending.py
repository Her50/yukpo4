#!/usr/bin/env python3
"""
Script pour relancer les embeddings de tous les services avec le statut "pending"
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json
from dotenv import load_dotenv
import requests
import time

# Charger les variables d'environnement
load_dotenv()

def get_db_connection():
    """Établir une connexion à la base de données"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
            print("✅ Connexion PostgreSQL établie")
            return conn
        else:
            print("❌ DATABASE_URL non définie")
            return None
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return None

def get_pending_services(conn):
    """Récupérer tous les services avec le statut 'pending'"""
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT id, data, created_at, embedding_status
            FROM services 
            WHERE embedding_status = 'pending'
            ORDER BY created_at ASC
        """)
        
        services = cursor.fetchall()
        cursor.close()
        
        return services
    except Exception as e:
        print(f"❌ Erreur lors de la récupération des services: {e}")
        return []

def update_embedding_status(conn, service_id, status, error_message=None):
    """Mettre à jour le statut d'embedding d'un service"""
    try:
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE services SET 
             embedding_status = %s, 
             embedding_error = %s,
             embedding_last_attempt = NOW(),
             embedding_attempts = COALESCE(embedding_attempts, 0) + 1,
             updated_at = NOW()
             WHERE id = %s
        """, (status, error_message, service_id))
        
        conn.commit()
        cursor.close()
        
        print(f"✅ Statut mis à jour pour service {service_id}: {status}")
        return True
    except Exception as e:
        print(f"❌ Erreur mise à jour statut service {service_id}: {e}")
        return False

def process_service_embedding(conn, service_id, service_data):
    """Traiter l'embedding d'un service"""
    print(f"\n🔄 Traitement du service {service_id}...")
    
    try:
        # 1. Mettre à jour le statut à "processing"
        update_embedding_status(conn, service_id, "processing")
        
        # 2. Extraire les champs à vectoriser
        fields_to_embed = []
        if isinstance(service_data, dict):
            for field_name, field_value in service_data.items():
                if field_name == "intention":
                    continue  # Ignorer le champ intention
                
                # Extraire la valeur du champ
                if isinstance(field_value, dict) and "valeur" in field_value:
                    value = field_value["valeur"]
                else:
                    value = str(field_value)
                
                if value and value != "null" and value != "":
                    fields_to_embed.append((field_name, value))
        
        print(f"   📋 {len(fields_to_embed)} champs à vectoriser")
        
        # 3. Créer les embeddings via le microservice
        embedding_api_url = os.getenv('EMBEDDING_API_URL', 'http://localhost:8000')
        api_key = os.getenv('YUKPO_API_KEY', 'yukpo_embedding_key_2024')
        
        successful_embeddings = 0
        failed_embeddings = 0
        
        for field_name, field_value in fields_to_embed:
            try:
                # Préparer la requête d'embedding
                embedding_request = {
                    "value": str(field_value),
                    "type_donnee": "texte",
                    "service_id": service_id,
                    "gps_lat": None,
                    "gps_lon": None,
                    "langue": "fra",  # Langue par défaut
                    "active": True,
                    "type_metier": "service"
                }
                
                # Appeler le microservice
                response = requests.post(
                    f"{embedding_api_url}/add_embedding_pinecone",
                    json=embedding_request,
                    headers={"X-API-Key": api_key},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("status") == "ok" and result.get("verification") == "confirmed":
                        print(f"   ✅ {field_name}: embedding créé (ID: {result.get('pinecone_id')})")
                        successful_embeddings += 1
                    else:
                        print(f"   ❌ {field_name}: échec - {result}")
                        failed_embeddings += 1
                else:
                    print(f"   ❌ {field_name}: erreur HTTP {response.status_code}")
                    failed_embeddings += 1
                
                # Pause entre les appels pour éviter la surcharge
                time.sleep(0.5)
                
            except Exception as e:
                print(f"   ❌ {field_name}: erreur - {e}")
                failed_embeddings += 1
        
        # 4. Mettre à jour le statut final
        total_embeddings = successful_embeddings + failed_embeddings
        
        if successful_embeddings == 0 and total_embeddings > 0:
            # Aucun embedding réussi
            update_embedding_status(conn, service_id, "failed", "Aucun embedding réussi")
            print(f"   🚨 Service {service_id}: ÉCHEC complet")
            return False
        elif successful_embeddings < total_embeddings:
            # Embeddings partiels
            update_embedding_status(conn, service_id, "success", f"Partiel: {successful_embeddings}/{total_embeddings}")
            print(f"   ⚠️ Service {service_id}: Succès partiel ({successful_embeddings}/{total_embeddings})")
            return True
        else:
            # Tous les embeddings réussis
            update_embedding_status(conn, service_id, "success")
            print(f"   ✅ Service {service_id}: Succès complet ({successful_embeddings}/{total_embeddings})")
            return True
            
    except Exception as e:
        print(f"   ❌ Erreur lors du traitement du service {service_id}: {e}")
        update_embedding_status(conn, service_id, "failed", str(e))
        return False

def main():
    print("🚀 RELANCE DES EMBEDDINGS PENDING")
    print("=" * 50)
    print(f"⏰ Début: {datetime.now()}")
    
    # Établir la connexion
    conn = get_db_connection()
    if not conn:
        print("❌ Impossible de continuer sans connexion")
        return
    
    try:
        # Récupérer les services en attente
        pending_services = get_pending_services(conn)
        
        if not pending_services:
            print("✅ Aucun service en attente d'embedding")
            return
        
        print(f"\n📋 {len(pending_services)} services en attente d'embedding:")
        for service in pending_services:
            service_id = service['id']
            data = service['data']
            created = service['created_at']
            
            # Extraire le titre
            titre = "N/A"
            if data and isinstance(data, dict):
                titre_service = data.get('titre_service', {})
                if isinstance(titre_service, dict):
                    titre = titre_service.get('valeur', 'N/A')
                else:
                    titre = str(titre_service)
            
            created_str = created.strftime('%Y-%m-%d %H:%M')
            print(f"   - ID {service_id}: {titre} (créé: {created_str})")
        
        # Traiter chaque service
        print(f"\n🔄 Démarrage du traitement de {len(pending_services)} services...")
        
        successful = 0
        failed = 0
        
        for i, service in enumerate(pending_services, 1):
            service_id = service['id']
            service_data = service['data']
            
            print(f"\n[{i}/{len(pending_services)}] Traitement du service {service_id}")
            
            if process_service_embedding(conn, service_id, service_data):
                successful += 1
            else:
                failed += 1
            
            # Pause entre les services
            if i < len(pending_services):
                print("   ⏳ Pause de 2 secondes...")
                time.sleep(2)
        
        # Résumé final
        print(f"\n📊 RÉSUMÉ FINAL:")
        print(f"   ✅ Succès: {successful}")
        print(f"   ❌ Échecs: {failed}")
        print(f"   📋 Total: {len(pending_services)}")
        
        if failed == 0:
            print("🎉 Tous les embeddings ont été créés avec succès !")
        elif successful == 0:
            print("🚨 Aucun embedding n'a pu être créé !")
        else:
            print("⚠️ Certains embeddings ont échoué, vérifiez les logs")
        
    except Exception as e:
        print(f"❌ Erreur générale: {e}")
    finally:
        conn.close()
        print(f"\n✅ Connexion fermée")
    
    print(f"\n✅ Script terminé à {datetime.now()}")

if __name__ == "__main__":
    main() 