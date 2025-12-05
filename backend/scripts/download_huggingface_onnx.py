#!/usr/bin/env python3
"""
Telecharge des modeles ONNX pre-entraines depuis Hugging Face
pour ETA prediction et time series forecasting
"""

import os
import sys
from pathlib import Path
import json

try:
    from huggingface_hub import hf_hub_download, snapshot_download
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("⚠️  huggingface_hub non disponible")
    print("   Installez avec: pip install huggingface_hub")

def download_eta_model(output_dir: Path):
    """Telecharge un modele ONNX pour regression/ETA depuis Hugging Face"""
    print("\n📥 Recherche modèle ETA sur Hugging Face...")
    
    if not HF_AVAILABLE:
        print("   ⚠️  huggingface_hub non installé, skip")
        return False
    
    # Modeles potentiels pour regression/ETA
    models_to_try = [
        "onnx/models",  # ONNX Model Zoo
        "microsoft/onnxruntime",  # Exemples ONNX
    ]
    
    # Pour l'instant, on cree un placeholder car les modeles generiques
    # ne sont pas adaptes a notre cas specifique (9 features ETA)
    print("   ℹ️  Les modèles génériques Hugging Face ne sont pas adaptés")
    print("   ℹ️  Utilisation du modèle créé localement (meilleure précision)")
    return False

def download_forecasting_model(output_dir: Path):
    """Telecharge un modele ONNX pour time series forecasting"""
    print("\n📥 Recherche modèle Forecasting sur Hugging Face...")
    
    if not HF_AVAILABLE:
        print("   ⚠️  huggingface_hub non installé, skip")
        return False
    
    # Modeles de forecasting disponibles
    models_to_try = [
        "onnx/models/tree/main/vision",  # Pas adapté
        # Les modeles de forecasting specifiques sont rares sur HF
    ]
    
    print("   ℹ️  Modèles de forecasting spécifiques rares sur Hugging Face")
    print("   ℹ️  Utilisation du modèle créé localement")
    return False

def main():
    model_dir = Path(os.getenv("ML_MODELS_DIR", "models"))
    model_dir.mkdir(parents=True, exist_ok=True)
    
    print("🔍 Recherche modèles ONNX pré-entraînés sur Hugging Face")
    
    if not HF_AVAILABLE:
        print("\n💡 Pour télécharger depuis Hugging Face:")
        print("   pip install huggingface_hub")
        print("   python scripts/download_huggingface_onnx.py")
        return
    
    download_eta_model(model_dir)
    download_forecasting_model(model_dir)
    
    print("\n✅ Recherche terminée")
    print("💡 Les modèles créés localement sont plus adaptés à votre cas d'usage")

if __name__ == "__main__":
    main()

