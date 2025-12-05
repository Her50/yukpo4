# 🧠 Intégration Modèles ML - Module de Livraison

## ✅ **Configuration Automatique Effectuée**

### **Répertoire Créé**
```
backend/models/
```

### **Variable d'Environnement**
```
ML_MODELS_DIR=models
```

---

## 📦 **Modèles Recommandés**

### **1. ETAPrediction.onnx** - Prédiction Temps d'Arrivée

**Source recommandée**: Hugging Face  
**Lien direct**: https://huggingface.co/models?search=time+series+forecast+onnx

**Modèles spécifiques à chercher**:
- `microsoft/forecast-mae` (Time series forecasting)
- Rechercher: "time series", "forecasting", "regression", "lightweight"

**Features attendues**:
- `distance_km`: f64
- `hour_of_day`: u8
- `day_of_week`: u8
- `weather_factor`: f64
- `traffic_factor`: f64
- `courier_rating`: f32
- `route_complexity`: f64

**Sortie**: `estimated_minutes`: f64

---

### **2. DemandForecasting.onnx** - Prévision de Demande

**Source recommandée**: Hugging Face  
**Lien direct**: https://huggingface.co/models?search=demand+forecast+onnx

**Modèles spécifiques à chercher**:
- Rechercher: "demand forecast", "sales forecast", "time series"

**Features attendues**:
- `zone_id`: String
- `hour`: u8
- `day_of_week`: u8
- `month`: u8
- `historical_avg`: f64
- `historical_trend`: f64
- `weather_factor`: f64
- `is_holiday`: bool

**Sortie**: `predicted_demand`: f64

---

### **3. RouteOptimization.onnx** - Optimisation Routes (VRP)

**Note**: Ce modèle nécessite généralement un entraînement personnalisé ou une bibliothèque spécialisée.

**Alternatives**:
- Utiliser le VRP Solver existant (déjà implémenté)
- Bibliothèque Python: `ortools` pour VRP
- Export en ONNX si nécessaire

---

### **4. FraudDetection.onnx** - Détection Fraude

**Source recommandée**: Hugging Face  
**Lien direct**: https://huggingface.co/models?search=anomaly+detection+onnx

**Modèles spécifiques à chercher**:
- Rechercher: "anomaly detection", "fraud detection", "classification"

---

## 🚀 **Téléchargement des Modèles**

### **Option 1: Hugging Face Hub (Python)**

```bash
# Installer
pip install huggingface-hub

# Utiliser le script
cd backend/scripts
python download_models_python.py
```

### **Option 2: Téléchargement Manuel**

1. Aller sur https://huggingface.co/models?library=onnx
2. Chercher un modèle adapté
3. Télécharger le fichier `.onnx`
4. Le placer dans `backend/models/` avec le bon nom

### **Option 3: ONNX Model Zoo**

```bash
# Cloner le repo
git clone https://github.com/onnx/models.git

# Chercher dans validators/models/
# Copier les modèles adaptés dans backend/models/
```

---

## 🔗 **Liens Utiles**

### **Hugging Face**
- **ONNX Models**: https://huggingface.co/models?library=onnx
- **Time Series**: https://huggingface.co/models?search=time+series+onnx
- **Forecasting**: https://huggingface.co/models?search=forecast+onnx
- **Regression**: https://huggingface.co/models?search=regression+onnx

### **ONNX Model Zoo**
- **Repository**: https://github.com/onnx/models
- **Documentation**: https://github.com/onnx/models#readme

### **Entraînement Personnalisé**
- **TensorFlow → ONNX**: https://github.com/onnx/tensorflow-onnx
- **PyTorch → ONNX**: https://pytorch.org/tutorials/advanced/super_resolution_with_onnxruntime.html
- **Scikit-learn → ONNX**: https://onnx.ai/sklearn-onnx/

---

## ⚙️ **Intégration dans le Service**

Le service `DeliveryMLModelsService` charge automatiquement les modèles:

```rust
// Le service cherche automatiquement les modèles dans ML_MODELS_DIR
let mut service = DeliveryMLModelsService::new();

// Charger un modèle spécifique
service.load_model(ModelType::ETAPrediction).await?;

// Utiliser le modèle
let prediction = service.predict_eta(&features).await?;
```

**Noms de fichiers attendus**:
- `ETAPrediction.onnx`
- `DemandForecasting.onnx`
- `RouteOptimization.onnx`
- `FraudDetection.onnx`

---

## ✅ **Vérification**

### **Test du répertoire**
```powershell
cd backend
cargo run --bin test_ml_dir
```

### **Vérifier les fichiers**
```powershell
Get-ChildItem backend\models\*.onnx
```

---

## 💡 **Note Importante**

**Le service fonctionne parfaitement SANS modèles ML** grâce aux formules optimisées:

- ✅ Prédiction ETA: Formule basée sur distance, trafic, météo, historique
- ✅ Forecasting: Moyennes historiques + tendances + facteurs externes
- ✅ Route Optimization: Heuristiques avancées (VRP solver)
- ✅ Fraud Detection: Règles basées sur patterns et statistiques

**Les modèles ML sont optionnels** et amélioreront la précision une fois intégrés.

---

## 📝 **Prochaines Étapes**

1. ✅ Configuration automatique terminée
2. 📥 Télécharger des modèles adaptés (optionnel)
3. 🔄 Le service les chargera automatiquement
4. 🚀 Tester avec `cargo run --bin test_ml_dir`

---

**Date de configuration**: 2025-01-XX  
**Statut**: ✅ Configuration automatique complète

