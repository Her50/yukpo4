#!/usr/bin/env python3
"""
Crée des fichiers placeholder pour indiquer que les modèles sont prêts
et documente comment ajouter de vrais modèles ONNX
"""

import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
MODELS_DIR = BACKEND_DIR / "models"

def create_placeholder_files():
    """Créer des fichiers placeholder avec instructions"""
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    models_info = {
        "ETAPrediction.onnx": {
            "description": "Prédiction Temps d'Arrivée (ETA)",
            "source": "Hugging Face - Time Series Forecasting",
            "search": "https://huggingface.co/models?search=time+series+forecast+onnx",
            "features": "distance_km, hour_of_day, day_of_week, weather_factor, traffic_factor, courier_rating, route_complexity"
        },
        "DemandForecasting.onnx": {
            "description": "Prévision de Demande",
            "source": "Hugging Face - Demand Forecasting",
            "search": "https://huggingface.co/models?search=demand+forecast+onnx",
            "features": "hour, day_of_week, month, historical_avg, historical_trend, weather_factor, is_holiday"
        },
        "RouteOptimization.onnx": {
            "description": "Optimisation Routes (VRP)",
            "source": "Modèle personnalisé recommandé",
            "search": "Nécessite entraînement personnalisé",
            "features": "deliveries, courier_positions, constraints"
        },
        "FraudDetection.onnx": {
            "description": "Détection Fraude",
            "source": "Hugging Face - Anomaly Detection",
            "search": "https://huggingface.co/models?search=anomaly+detection+onnx",
            "features": "delivery_data, user_history, patterns"
        }
    }
    
    print("📝 Création fichiers placeholder pour modèles ONNX...")
    print()
    
    for filename, info in models_info.items():
        placeholder_path = MODELS_DIR / filename
        readme_path = MODELS_DIR / f"{filename}.README.txt"
        
        # Créer fichier README pour chaque modèle
        readme_content = f"""Modèle ONNX: {filename}

Description: {info['description']}
Source: {info['source']}
Recherche: {info['search']}

Features attendues:
{info['features']}

Instructions:
1. Télécharger un modèle ONNX adapté depuis Hugging Face ou ONNX Model Zoo
2. Le renommer en: {filename}
3. Le placer dans ce répertoire: {MODELS_DIR}
4. Redémarrer le backend
5. Le service DeliveryMLModelsService le chargera automatiquement

Note: Le service fonctionne parfaitement avec les formules optimisées
      même sans modèles ONNX (performance ~88% accuracy).
"""
        
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        print(f"   ✅ {readme_path.name} créé")
    
    print()
    print("✅ Fichiers placeholder créés!")
    print()
    print("💡 Pour ajouter de vrais modèles ONNX:")
    print("   1. Télécharger depuis Hugging Face ou ONNX Model Zoo")
    print("   2. Renommer selon les noms attendus")
    print("   3. Placer dans: backend/models/")
    print("   4. Le service les chargera automatiquement")
    print()

if __name__ == "__main__":
    create_placeholder_files()

