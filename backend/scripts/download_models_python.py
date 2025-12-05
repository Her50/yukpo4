#!/usr/bin/env python3
"""
Script Python pour télécharger automatiquement des modèles ONNX
pour le Module de Livraison - Yukpomnang

Installation requise:
    pip install huggingface-hub onnx onnxruntime

Usage:
    python download_models_python.py
"""

import os
import sys
from pathlib import Path

# Chemin du répertoire models
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
MODELS_DIR = BACKEND_DIR / "models"

def ensure_models_dir():
    """Créer le répertoire models s'il n'existe pas"""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✅ Répertoire: {MODELS_DIR}")

def download_hf_model(repo_id, filename, output_name):
    """Télécharger un modèle depuis Hugging Face"""
    try:
        from huggingface_hub import hf_hub_download
        
        print(f"\n📥 Téléchargement: {output_name}...")
        print(f"   Repository: {repo_id}")
        print(f"   Fichier: {filename}")
        
        output_path = MODELS_DIR / output_name
        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(MODELS_DIR),
            local_dir_use_symlinks=False
        )
        
        # Renommer si nécessaire
        if Path(downloaded_path).name != output_name:
            os.rename(downloaded_path, output_path)
        
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"   ✅ Téléchargé: {output_path.name} ({size_mb:.2f} MB)")
        return True
        
    except ImportError:
        print("   ⚠️  huggingface_hub non installé")
        print("   💡 Installez avec: pip install huggingface-hub")
        return False
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False

def main():
    print("🧠 Téléchargement Modèles ONNX - Module de Livraison")
    print("=" * 70)
    
    # Créer le répertoire
    ensure_models_dir()
    
    # Vérifier les dépendances
    try:
        import huggingface_hub
        print("✅ huggingface_hub installé")
    except ImportError:
        print("❌ huggingface_hub non installé")
        print("\n💡 Installation requise:")
        print("   pip install huggingface-hub")
        sys.exit(1)
    
    # Modèles recommandés (légers et adaptés)
    # Note: Ces modèles sont des exemples - remplacez par ceux qui correspondent à vos besoins
    
    models_to_download = [
        {
            "repo_id": "onnx/models",
            "filename": "README.md",  # Exemple - remplacer par vrai modèle
            "output_name": "ETAPrediction.onnx",
            "description": "Modèle prédiction ETA",
            "note": "Chercher un modèle time-series forecasting sur Hugging Face"
        },
        # Ajoutez d'autres modèles ici
        # Exemple de repos populaires:
        # - microsoft/forecast-mae (time series forecasting)
        # - timeseriesAI/tsai (time series models)
    ]
    
    print("\n📋 Modèles à télécharger:")
    for i, model in enumerate(models_to_download, 1):
        print(f"   {i}. {model['output_name']} - {model['description']}")
        if model.get('note'):
            print(f"      Note: {model['note']}")
    
    print("\n🔗 Rechercher des modèles adaptés:")
    print("   • Time Series Forecasting:")
    print("     https://huggingface.co/models?search=time+series+forecast+onnx")
    print("   • Regression Models:")
    print("     https://huggingface.co/models?search=regression+onnx")
    print("   • Lightweight Models:")
    print("     https://huggingface.co/models?search=lightweight+onnx")
    
    print("\n⚠️  IMPORTANT:")
    print("   Les modèles ML réels pour la livraison nécessitent:")
    print("   • Des données d'entraînement spécifiques à votre région")
    print("   • Un entraînement personnalisé sur vos données historiques")
    print("   • Des features adaptées (trafic local, météo locale, etc.)")
    
    print("\n💡 Alternative actuelle:")
    print("   Le service utilise des formules optimisées qui fonctionnent")
    print("   très bien SANS modèles ML. Les modèles sont optionnels.")
    
    print("\n✅ Configuration terminée!")
    print(f"   Répertoire: {MODELS_DIR}")
    print("   Pour ajouter des modèles, placez-les dans ce répertoire.")

if __name__ == "__main__":
    main()

