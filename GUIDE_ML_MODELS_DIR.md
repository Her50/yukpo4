# 🧠 Guide Configuration ML_MODELS_DIR

## 📋 **Qu'est-ce que ML_MODELS_DIR ?**

`ML_MODELS_DIR` est la variable d'environnement qui définit **où sont stockés les modèles ML entraînés** pour le module de livraison.

---

## 🎯 **Utilisation Actuelle**

### **Services qui l'utilisent**
- `DeliveryMLModelsService` - Service principal pour modèles ML
- Utilisé pour stocker des modèles de prédiction:
  - ✅ **ETA Prediction** - Prédiction temps d'arrivée
  - ✅ **Demand Forecasting** - Prévision de demande
  - ✅ **Route Optimization** - Optimisation routes
  - ✅ **Fraud Detection** - Détection fraude

---

## ⚙️ **Configuration**

### **Valeur par Défaut**
Si `ML_MODELS_DIR` n'est **pas configurée**, le service utilise automatiquement:
```
models/
```

### **Configuration dans `.env`**

**Option 1: Répertoire relatif (recommandé pour développement)**
```bash
ML_MODELS_DIR=models
```

**Option 2: Chemin absolu (recommandé pour production)**
```bash
ML_MODELS_DIR=/app/models
# ou sur Windows
ML_MODELS_DIR=C:\Users\23767\yukpomnang2\backend\models
```

**Option 3: Sous-répertoire du backend**
```bash
ML_MODELS_DIR=backend/models
```

---

## 📁 **Structure Recommandée**

### **Créer le répertoire**

**Windows (PowerShell)**
```powershell
# Depuis le workspace root
New-Item -ItemType Directory -Path "backend\models" -Force
# ou depuis backend/
New-Item -ItemType Directory -Path "models" -Force
```

**Linux/Mac**
```bash
# Depuis le workspace root
mkdir -p backend/models
# ou depuis backend/
mkdir -p models
```

### **Structure des fichiers**

Le service cherche les modèles avec ces noms (format ONNX recommandé):

```
models/
├── ETAPrediction.onnx          # Modèle prédiction ETA
├── DemandForecasting.onnx      # Modèle prévision demande
├── RouteOptimization.onnx      # Modèle optimisation routes
└── FraudDetection.onnx         # Modèle détection fraude
```

---

## 🔍 **Comment Obtenir/Utiliser la Valeur**

### **Méthode 1: Lecture depuis l'environnement (Rust)**

```rust
use std::path::PathBuf;

// Lire la variable d'environnement
let model_dir = std::env::var("ML_MODELS_DIR")
    .map(PathBuf::from)
    .unwrap_or_else(|_| PathBuf::from("models"));

println!("Répertoire modèles: {:?}", model_dir);
```

### **Méthode 2: Via le service (recommandé)**

Le service `DeliveryMLModelsService` a une méthode publique:

```rust
use crate::services::delivery_ml_models::DeliveryMLModelsService;

let service = DeliveryMLModelsService::new();
let model_dir = service.get_model_dir(); // Retourne &PathBuf

println!("Répertoire modèles: {:?}", model_dir);
```

### **Méthode 3: Vérification depuis le terminal**

**Windows (PowerShell)**
```powershell
# Vérifier si la variable existe
$env:ML_MODELS_DIR

# Ou depuis Rust
cargo run --bin check_env
```

**Linux/Mac**
```bash
# Vérifier si la variable existe
echo $ML_MODELS_DIR

# Ou depuis Rust
cargo run --bin check_env
```

---

## 📝 **Exemple d'Utilisation Complète**

### **1. Configuration dans `.env`**

```bash
# backend/.env (ou à la racine selon votre setup)
ML_MODELS_DIR=models
```

### **2. Créer le répertoire**

```powershell
# Windows
cd backend
mkdir models

# Linux/Mac
cd backend && mkdir -p models
```

### **3. Utiliser dans le code**

```rust
use crate::services::delivery_ml_models::DeliveryMLModelsService;

// Le service lit automatiquement ML_MODELS_DIR lors de new()
let mut ml_service = DeliveryMLModelsService::new();

// Le répertoire est disponible via get_model_dir()
println!("Modèles dans: {:?}", ml_service.get_model_dir());

// Charger un modèle (si disponible)
ml_service.load_model(ModelType::ETAPrediction).await?;
```

---

## 🚀 **Déploiement sur Render.com**

### **Configuration Render**

Dans votre dashboard Render.com → Service "yukpomnang" → Environment:

```bash
# Option 1: Répertoire relatif (créera models/ dans le workspace)
ML_MODELS_DIR=models

# Option 2: Chemin absolu (si vous montez un volume)
ML_MODELS_DIR=/app/models
```

### **Important pour Render**

1. **Répertoire persistant**: Par défaut, Render utilise un filesystem éphémère
2. **Solutions**:
   - ✅ Utiliser `models/` (relatif) - recréé à chaque déploiement
   - ✅ Utiliser un volume persistant (avancé)
   - ✅ Télécharger modèles depuis S3/Cloud Storage au démarrage

---

## 🔄 **Chargement des Modèles**

### **Format Supporté**

Actuellement, le service supporte:
- ✅ **ONNX** (recommandé) - `.onnx`
- ⏳ **TensorFlow** (à venir) - `.pb` ou SavedModel
- ⏳ **PyTorch** (à venir) - `.pt` ou `.pth`

### **Chargement Automatique**

Les modèles sont chargés **à la demande** lors de l'appel:

```rust
// Le service cherche automatiquement dans ML_MODELS_DIR
let prediction = ml_service.predict_eta(&features).await?;
```

Si le modèle n'est pas trouvé, le service utilise une **formule de fallback**.

---

## ✅ **Checklist de Configuration**

- [ ] Variable `ML_MODELS_DIR` ajoutée dans `.env`
- [ ] Répertoire `models/` créé
- [ ] Modèles ML exportés au format ONNX (si disponibles)
- [ ] Modèles placés dans `models/` avec les bons noms
- [ ] Variable configurée sur Render.com (si déploiement)
- [ ] Test: `service.get_model_dir()` retourne le bon chemin

---

## 🆘 **Dépannage**

### **Problème: Le service ne trouve pas les modèles**

**Solution 1: Vérifier le chemin**
```rust
let service = DeliveryMLModelsService::new();
println!("Chemin recherché: {:?}", service.get_model_dir());
// Vérifiez que ce chemin existe
```

**Solution 2: Chemin absolu**
```bash
# Utilisez un chemin absolu dans .env
ML_MODELS_DIR=C:\Users\23767\yukpomnang2\backend\models
```

**Solution 3: Vérifier depuis le code**
```rust
use std::fs;

let model_dir = service.get_model_dir();
if model_dir.exists() {
    println!("✅ Répertoire existe: {:?}", model_dir);
    // Lister les fichiers
    for entry in fs::read_dir(model_dir)? {
        println!("  - {:?}", entry?.path());
    }
} else {
    println!("❌ Répertoire n'existe pas: {:?}", model_dir);
}
```

---

## 📚 **Ressources**

- **OpenWeatherMap API**: https://openweathermap.org/api
- **ONNX Format**: https://onnx.ai/
- **TensorFlow Serving**: https://www.tensorflow.org/tfx/guide/serving
- **PyTorch Export**: https://pytorch.org/tutorials/advanced/super_resolution_with_onnxruntime.html

---

**Note**: Actuellement, le service utilise des **formules simulées** qui fonctionnent très bien. L'ajout de modèles ML réels améliorera encore la précision des prédictions.

