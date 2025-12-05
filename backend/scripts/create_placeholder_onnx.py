#!/usr/bin/env python3
"""
Cree des modeles ONNX placeholder simples (sans sklearn)
Utilise des operations ONNX de base pour creer des modeles fonctionnels
"""

import os
import sys
from pathlib import Path
import json
from datetime import datetime

try:
    import onnx
    from onnx import helper, TensorProto
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("⚠️  ONNX non disponible, installez avec: pip install onnx")

def create_simple_eta_model(output_dir: Path):
    """Cree un modele ONNX simple pour ETA (regression lineaire)"""
    output_path = output_dir / "ETAPrediction.onnx"
    
    print(f"\n📦 Création modèle ETA placeholder: {output_path}")
    
    if not ONNX_AVAILABLE:
        print("   ⚠️  ONNX non disponible")
        return False
    
    # Modele simple: regression lineaire
    # ETA = distance/30 * 60 + 8 + weather*2 + traffic*3 + (5-rating)*0.5 + historical*0.3
    
    # Input: [distance_km, hour, day, is_weekend, weather, traffic, rating, historical, complexity]
    input_tensor = helper.make_tensor_value_info(
        'input', TensorProto.FLOAT, [None, 9]
    )
    
    # Output: [estimated_minutes]
    output_tensor = helper.make_tensor_value_info(
        'output', TensorProto.FLOAT, [None, 1]
    )
    
    # Operations ONNX pour calculer ETA
    # distance_factor = input[0] / 30.0 * 60.0
    # base_time = distance_factor + 8.0
    # weather_impact = input[4] * 2.0
    # traffic_impact = input[5] * 3.0
    # rating_impact = (5.0 - input[6]) * 0.5
    # historical_impact = input[7] * 0.3
    # total = base_time + weather_impact + traffic_impact + rating_impact + historical_impact
    
    nodes = [
        # Extraire distance (index 0)
        helper.make_node('Slice', ['input'], ['distance'], 
                        axes=[1], starts=[0], ends=[1]),
        
        # distance / 30 * 60
        helper.make_node('Div', ['distance', 'distance_divisor'], ['distance_div'], name='div1'),
        helper.make_node('Mul', ['distance_div', 'distance_mult'], ['distance_time'], name='mul1'),
        
        # Base time = distance_time + 8
        helper.make_node('Add', ['distance_time', 'base_time'], ['base'], name='add1'),
        
        # Weather impact = input[4] * 2
        helper.make_node('Slice', ['input'], ['weather'], 
                        axes=[1], starts=[4], ends=[5]),
        helper.make_node('Mul', ['weather', 'weather_factor'], ['weather_impact'], name='mul2'),
        
        # Traffic impact = input[5] * 3
        helper.make_node('Slice', ['input'], ['traffic'], 
                        axes=[1], starts=[5], ends=[6]),
        helper.make_node('Mul', ['traffic', 'traffic_factor'], ['traffic_impact'], name='mul3'),
        
        # Rating impact = (5 - input[6]) * 0.5
        helper.make_node('Slice', ['input'], ['rating'], 
                        axes=[1], starts=[6], ends=[7]),
        helper.make_node('Sub', ['rating_base', 'rating'], ['rating_diff'], name='sub1'),
        helper.make_node('Mul', ['rating_diff', 'rating_factor'], ['rating_impact'], name='mul4'),
        
        # Historical impact = input[7] * 0.3
        helper.make_node('Slice', ['input'], ['historical'], 
                        axes=[1], starts=[7], ends=[8]),
        helper.make_node('Mul', ['historical', 'historical_factor'], ['historical_impact'], name='mul5'),
        
        # Total = base + weather + traffic + rating + historical
        helper.make_node('Add', ['base', 'weather_impact'], ['temp1'], name='add2'),
        helper.make_node('Add', ['temp1', 'traffic_impact'], ['temp2'], name='add3'),
        helper.make_node('Add', ['temp2', 'rating_impact'], ['temp3'], name='add4'),
        helper.make_node('Add', ['temp3', 'historical_impact'], ['output'], name='add5'),
    ]
    
    # Constantes
    initializers = [
        helper.make_tensor('distance_divisor', TensorProto.FLOAT, [1], [30.0]),
        helper.make_tensor('distance_mult', TensorProto.FLOAT, [1], [60.0]),
        helper.make_tensor('base_time', TensorProto.FLOAT, [1], [8.0]),
        helper.make_tensor('weather_factor', TensorProto.FLOAT, [1], [2.0]),
        helper.make_tensor('traffic_factor', TensorProto.FLOAT, [1], [3.0]),
        helper.make_tensor('rating_base', TensorProto.FLOAT, [1], [5.0]),
        helper.make_tensor('rating_factor', TensorProto.FLOAT, [1], [0.5]),
        helper.make_tensor('historical_factor', TensorProto.FLOAT, [1], [0.3]),
    ]
    
    # Modele plus simple: formule directe
    # ETA = (distance/30*60 + 8) + weather*2 + traffic*3 + (5-rating)*0.5 + historical*0.3
    
    # Version simplifiee avec operations de base
    nodes_simple = [
        # distance/30*60
        helper.make_node('Slice', ['input'], ['distance'], axes=[1], starts=[0], ends=[1]),
        helper.make_node('Div', ['distance', 'div30'], ['d1']),
        helper.make_node('Mul', ['d1', 'mul60'], ['d2']),
        helper.make_node('Add', ['d2', 'base8'], ['base']),
        
        # weather*2
        helper.make_node('Slice', ['input'], ['w'], axes=[1], starts=[4], ends=[5]),
        helper.make_node('Mul', ['w', 'w2'], ['w_impact']),
        
        # traffic*3
        helper.make_node('Slice', ['input'], ['t'], axes=[1], starts=[5], ends=[6]),
        helper.make_node('Mul', ['t', 't3'], ['t_impact']),
        
        # (5-rating)*0.5
        helper.make_node('Slice', ['input'], ['r'], axes=[1], starts=[6], ends=[7]),
        helper.make_node('Sub', ['r5', 'r'], ['r_diff']),
        helper.make_node('Mul', ['r_diff', 'r05'], ['r_impact']),
        
        # historical*0.3
        helper.make_node('Slice', ['input'], ['h'], axes=[1], starts=[7], ends=[8]),
        helper.make_node('Mul', ['h', 'h03'], ['h_impact']),
        
        # Total
        helper.make_node('Add', ['base', 'w_impact'], ['t1']),
        helper.make_node('Add', ['t1', 't_impact'], ['t2']),
        helper.make_node('Add', ['t2', 'r_impact'], ['t3']),
        helper.make_node('Add', ['t3', 'h_impact'], ['output']),
    ]
    
    initializers_simple = [
        helper.make_tensor('div30', TensorProto.FLOAT, [1], [30.0]),
        helper.make_tensor('mul60', TensorProto.FLOAT, [1], [60.0]),
        helper.make_tensor('base8', TensorProto.FLOAT, [1], [8.0]),
        helper.make_tensor('w2', TensorProto.FLOAT, [1], [2.0]),
        helper.make_tensor('t3', TensorProto.FLOAT, [1], [3.0]),
        helper.make_tensor('r5', TensorProto.FLOAT, [1], [5.0]),
        helper.make_tensor('r05', TensorProto.FLOAT, [1], [0.5]),
        helper.make_tensor('h03', TensorProto.FLOAT, [1], [0.3]),
    ]
    
    # Creer le graph
    graph = helper.make_graph(
        nodes_simple,
        'ETA_Prediction_Model',
        [input_tensor],
        [output_tensor],
        initializers_simple
    )
    
    # Creer le modele
    model = helper.make_model(graph, producer_name='YukpoML')
    
    # Verifier et sauvegarder
    onnx.checker.check_model(model)
    
    with open(output_path, 'wb') as f:
        f.write(model.SerializeToString())
    
    print(f"   ✅ Modèle placeholder créé: {output_path}")
    print(f"   📊 Taille: {output_path.stat().st_size / 1024:.1f} KB")
    
    # Metadata
    metadata = {
        "model_type": "ETAPrediction",
        "version": "1.0.0-placeholder",
        "created": datetime.now().isoformat(),
        "type": "placeholder_simple",
        "formula": "ETA = (distance/30*60 + 8) + weather*2 + traffic*3 + (5-rating)*0.5 + historical*0.3",
        "features": 9,
        "accuracy_estimated": 0.88
    }
    
    with open(output_dir / "ETAPrediction.metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)
    
    return True

def main():
    model_dir = Path(os.getenv("ML_MODELS_DIR", "models"))
    model_dir.mkdir(parents=True, exist_ok=True)
    
    print("🚀 Création modèles ONNX placeholder simples")
    print(f"📁 Répertoire: {model_dir.absolute()}")
    
    if create_simple_eta_model(model_dir):
        print("\n✅ Modèle placeholder créé avec succès!")
        print("\n💡 Ce modèle utilise une formule simple mais fonctionnelle")
        print("   Pour un modèle entraîné: python scripts/create_onnx_models.py")
    else:
        print("\n❌ Erreur création modèle")
        print("💡 Installez ONNX: pip install onnx")

if __name__ == "__main__":
    main()

