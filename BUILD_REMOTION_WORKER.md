# 🔧 Build du Worker Remotion pour Production

**Date**: 2 Janvier 2026

---

## 🎯 **Objectif**

Compiler le worker Remotion et le commiter pour que Render.com puisse l'utiliser.

---

## 📋 **Instructions**

### **1. Compiler le Worker**

```bash
cd video-renderer
npm install
npm run build
```

### **2. Vérifier la Compilation**

```bash
# Vérifier que dist/src/index.js existe
ls -la video-renderer/dist/src/index.js
```

### **3. Commiter le Dossier dist/**

Le `.gitignore` a été mis à jour pour autoriser `video-renderer/dist/` :

```bash
git add video-renderer/dist/
git commit -m "feat: Add precompiled Remotion worker for production deployment"
git push
```

### **4. Render.com Déploiera Automatiquement**

Une fois le commit pushé, Render.com :
- Récupérera le dossier `video-renderer/dist/`
- Le worker sera disponible pour les previews courtes
- Plus besoin de `VIDEO_RENDERER_AUTO_BUILD=true`

---

## ✅ **Vérification après Déploiement**

Les previews courtes devraient maintenant fonctionner sans erreur 500.

---

## 📝 **Notes**

- `video-renderer/dist/` est maintenant exceptionné dans `.gitignore`
- Le worker doit être recompilé et recommité si le code source change
- Sur Render.com, npm n'est pas disponible, donc la précompilation est obligatoire


