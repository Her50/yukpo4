#!/usr/bin/env python3
"""
Script pour ajouter du contenu de test aux services existants
"""

import os
import psycopg2
import json
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le backend
load_dotenv('backend/.env')

def add_test_content():
    """Ajoute du contenu de test aux services"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL non configurée")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Contenu de test pour différents types de services
        test_services = [
            {
                "id": 1,
                "titre_service": "Service de plomberie professionnel",
                "description_service": "Plombier qualifié pour réparations et installations. Spécialisé dans la réparation de fuites, installation de chauffe-eau, et maintenance générale.",
                "category": "Plomberie",
                "competences": ["Réparation fuites", "Installation chauffe-eau", "Maintenance plomberie"]
            },
            {
                "id": 4,
                "titre_service": "Cours de français pour étrangers",
                "description_service": "Professeur expérimenté propose des cours de français adaptés aux étrangers. Grammaire, conversation, préparation aux examens.",
                "category": "Éducation",
                "competences": ["Français langue étrangère", "Grammaire", "Conversation", "Préparation examens"]
            },
            {
                "id": 5,
                "titre_service": "Service informatique et réparation PC",
                "description_service": "Technicien informatique pour réparation et maintenance d'ordinateurs. Diagnostic, réparation hardware et software, nettoyage.",
                "category": "Informatique",
                "competences": ["Réparation PC", "Maintenance informatique", "Diagnostic", "Nettoyage"]
            },
            {
                "id": 6,
                "titre_service": "Réparation automobile",
                "description_service": "Mécanicien automobile pour réparations et entretien. Diagnostic électronique, réparation moteur, freinage, climatisation.",
                "category": "Automobile",
                "competences": ["Réparation moteur", "Diagnostic électronique", "Freinage", "Climatisation"]
            },
            {
                "id": 7,
                "titre_service": "Service de nettoyage professionnel",
                "description_service": "Service de nettoyage pour bureaux, maisons et locaux commerciaux. Nettoyage régulier et ponctuel, désinfection.",
                "category": "Nettoyage",
                "competences": ["Nettoyage bureaux", "Nettoyage maisons", "Désinfection", "Nettoyage ponctuel"]
            }
        ]
        
        updated_count = 0
        
        for test_service in test_services:
            service_id = test_service["id"]
            
            # Vérifier si le service existe
            cursor.execute("SELECT id FROM services WHERE id = %s", (service_id,))
            if cursor.fetchone():
                # Mettre à jour le service avec le contenu de test
                cursor.execute("""
                    UPDATE services 
                    SET data = %s,
                        embedding_status = 'pending',
                        updated_at = NOW()
                    WHERE id = %s
                """, (json.dumps(test_service), service_id))
                
                updated_count += 1
                print(f"✅ Service {service_id} mis à jour avec contenu de test")
            else:
                print(f"⚠️ Service {service_id} non trouvé")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\n📊 {updated_count} services mis à jour avec du contenu de test")
        
        if updated_count > 0:
            print("🔄 Les services doivent être re-vectorisés pour être trouvables")
        
    except Exception as e:
        print(f"❌ Erreur mise à jour: {e}")

def main():
    """Fonction principale"""
    print("🔧 Ajout de contenu de test aux services")
    print("=" * 50)
    
    add_test_content()

if __name__ == "__main__":
    main() 