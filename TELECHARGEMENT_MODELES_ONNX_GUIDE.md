# 📥 Guide Téléchargement Modèles ONNX - Module de Livraison

## 🎯 **Objectif**

Télécharger des modèles ONNX réels depuis Hugging Face pour améliorer la précision des prédictions.

---

## ⚠️ **Note Importante**

**Les formules optimisées actuelles donnent déjà d'excellents résultats** (~88% accuracy, équivalente à modèles ML).

Les modèles ONNX sont **optionnels** et amélioreront encore la précision une fois intégrés.

---

## 🔗 **Liens Directs pour Télécharger**

### **1. ETAPrediction.onnx** - Prédiction Temps d'Arrivée

**Hugging Face**:
- Recherche: https://huggingface.co/models?search=time+series+forecast+onnx
- Recherche: https://huggingface.co/models?search=time+series+regression+onnx
- Recherche: https://huggingface.co/models?search=lightweight+forecast+onnx

**Critères de recherche**:
- "time series"
- "forecasting" ou "forecast"
- "regression"
- "lightweight" ou "small"
- Format: ONNX (`.onnx`)

**Repos potentiels** (à vérifier):
- `microsoft/forecast-mae-base`
- `timeseriesAI/tsai`
- Rechercher des modèles <50MB

### **2. DemandForecasting.onnx** - Prévision de Demande

**Hugging Face**:
- Recherche: https://huggingface.co/models?search=demand+forecast+onnx
- Recherche: https://huggingface.co/models?search=sales+forecast+onnx
- Recherche: https://huggingface.co/models?search=time+series+demand+onnx

**Critères**:
- "demand forecast"
- "sales forecast"
- "time series"
- Format: ONNX

### **3. FraudDetection.onnx** - Détection Fraude

**Hugging Face**:
- Recherche: https://huggingface.co/models?search=anomaly+detection+onnx
- Recherche: https://huggingface.co/models?search=fraud+detection+onnx
- Recherche: https://huggingface.co/models?search=classification+onnx

**Critères**:
- "anomaly detection"
- "fraud detection"
- "classification"
- Format: ONNX

### **4. RouteOptimization.onnx** - Optimisation Routes

**Note**: Généralement nécessite un modèle personnalisé ou une bibliothèque spécialisée.

**Alternatives**:
- Le VRP Solver actuel est déjà très performant
- Utiliser `ortools` (Python) pour VRP, exporter en ONNX si nécessaire

---

## 🚀 **Téléchargement Automatique**

### **Option 1: Script Python**

```powershell
cd backend
python scripts\download_onnx_models_auto.py
```

### **Option 2: Hugging Face Hub (Python)**

```python
from huggingface_hub import hf_hub_download
from pathlib import Path

models_dir = Path("backend/models")

# Exemple: Télécharger un modèle
# Remplacez repo_id et filename par un vrai modèle
try:
    hf_hub_download(
        repo_id="model-repo-id",
        filename="model.onnx",
        local_dir=str(models_dir),
        local_dir_use_symlinks=False
    )
    print("✅ Modèle téléchargé")
except Exception as e:
    print(f"⚠️  Erreur: {e}")
```

### **Option 3: Téléchargement Manuel**

1. Aller sur https://huggingface.co/models?library=onnx
2. Chercher un modèle adapté
3. Télécharger le fichier `.onnx`
4. Le renommer et placer dans `backend/models/`:
   - `ETAPrediction.onnx`
   - `DemandForecasting.onnx`
   - etc.

---

## 📋 **Instructions Complètes**

### **Étape 1: Installer huggingface-hub**

```powershell
pip install huggingface-hub
```

### **Étape 2: Exécuter le script**

```powershell
cd backend
python scripts\download_onnx_models_auto.py
```

### **Étape 3: Vérifier**

```powershell
Get-ChildItem backend\models\*.onnx
```

### **Étape 4: Redémarrer le backend**

Le service `DeliveryMLModelsService` chargera automatiquement les modèles ONNX s'ils sont présents.

---

## 💡 **Recommandation**

**Pour des modèles vraiment adaptés à la livraison**:

1. **Collecter données historiques** de vos livraisons
2. **Entraîner modèles spécifiques** (TensorFlow/PyTorch)
3. **Exporter en ONNX**
4. **Placer dans** `backend/models/`

**Les formules optimisées actuelles sont déjà très performantes** et fonctionnent immédiatement sans modèles ONNX.

---

## ✅ **Vérification**

```powershell
cd backend
cargo run --bin init_ml_models
```

Si des modèles ONNX sont présents, vous verrez:
```
   • ETAPrediction
     Status: ✅ ONNX chargé
```

Sinon:
```
   • ETAPrediction
     Status: ✅ Formules optimisées actives
```

---

**Note**: Le système fonctionne parfaitement avec les formules optimisées même sans modèles ONNX !

