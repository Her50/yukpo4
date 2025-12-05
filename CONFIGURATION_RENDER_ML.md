# ✅ Configuration Render.com - ML_MODELS_DIR

## 🎯 **Configuration Simple**

Dans Render.com, ajoutez cette variable d'environnement:

```
ML_MODELS_DIR=models
```

### **Étapes**

1. Aller sur votre dashboard Render.com
2. Sélectionner votre service backend
3. Aller dans "Environment"
4. Cliquer "Add Environment Variable"
5. Ajouter:
   - **Key**: `ML_MODELS_DIR`
   - **Value**: `models`
6. Sauvegarder

### **C'est tout !**

Le service utilisera automatiquement le répertoire `models/` pour les modèles ONNX.

**Note**: Si la variable n'est pas définie, le service utilise `models/` par défaut de toute façon.

---

## 📁 **Structure sur Render**

Sur Render, vos fichiers seront dans:
```
/opt/render/project/src/backend/models/
```

Le service cherchera automatiquement les modèles ONNX là-bas.

---

**Statut**: ✅ Configuration simple et claire

