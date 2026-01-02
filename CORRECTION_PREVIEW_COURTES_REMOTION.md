# 🔧 Correction - Erreur 500 Preview Courtes (Remotion Worker Non Compilé)

**Date**: 2 Janvier 2026  
**Problème**: Erreur 500 lors de la génération de preview courtes  
**Cause**: Worker Remotion non compilé (`dist/src/index.js` absent)

---

## 🚨 **ERREUR**

```
[VideoRenderer][offline] Échec rendu Remotion local: 
Internal error: Remotion renderer non compilé (dist/src/index.js absent). 
Configurez VIDEO_RENDERER_AUTO_BUILD=true ou précompilez le worker avant le déploiement.
```

---

## ✅ **SOLUTIONS**

### **Option 1: Précompiler le Worker (RECOMMANDÉ pour Render.com)**

Sur Render.com, npm n'est pas disponible en runtime, donc il faut précompiler :

1. **Compiler localement** :
```bash
cd video-renderer
npm install
npm run build
```

2. **Vérifier que `dist/src/index.js` existe** :
```bash
ls -la video-renderer/dist/src/index.js
```

3. **Commit et push** :
```bash
git add video-renderer/dist/
git commit -m "feat: Precompile Remotion worker for production"
git push
```

4. **Render.com déploiera automatiquement** avec le worker précompilé

---

### **Option 2: Désactiver le Renderer Vidéo (TEMPORAIRE)**

Si vous ne pouvez pas compiler maintenant, désactivez temporairement :

**Sur Render.com → Environment Variables** :
```bash
VIDEO_RENDERER_ENABLED=false
```

**Note**: Les previews courtes ne fonctionneront pas, mais le reste de l'app fonctionnera.

---

### **Option 3: Utiliser un Renderer RPC Distant (AVANCÉ)**

Si vous avez un service de rendu vidéo séparé (ex: Docker GPU) :

**Sur Render.com → Environment Variables** :
```bash
VIDEO_RENDERER_RPC_URL=https://your-video-renderer-service.com
VIDEO_RENDERER_RPC_TOKEN=your_token_here  # Optionnel
```

---

### **Option 4: Activer Auto-Build (NON RECOMMANDÉ sur Render.com)**

⚠️ **Cette option ne fonctionnera PAS sur Render.com** car npm n'est pas disponible en runtime.

Si vous déployez sur une autre plateforme avec npm disponible :

**Environment Variables** :
```bash
VIDEO_RENDERER_AUTO_BUILD=true
VIDEO_RENDERER_PROJECT_ROOT=video-renderer
```

---

## 📋 **RECOMMANDATION POUR RENDER.COM**

**Solution immédiate** :
1. Compiler le worker localement
2. Commit `video-renderer/dist/`
3. Push vers GitHub
4. Render.com déploiera avec le worker précompilé

**Solution à long terme** :
- Ajouter un script de build dans le déploiement Render
- Ou utiliser un service de rendu vidéo séparé (Docker GPU, etc.)

---

## 🔍 **VÉRIFICATION**

Après compilation, vérifiez que le fichier existe :
```bash
file video-renderer/dist/src/index.js
# Doit afficher: JavaScript source, text
```

---

## 📝 **NOTES TECHNIQUES**

- Le worker Remotion doit être compilé avant le déploiement sur Render.com
- Render.com n'a pas npm disponible en runtime (contrairement à Heroku)
- La compilation locale fonctionne car vous avez npm installé
- Le dossier `dist/` doit être commité dans Git pour être déployé

---

## ✅ **STATUT**

- ✅ Solution identifiée
- ⏳ Action requise: Compiler le worker et commit
- ⏳ Déploiement Render.com après commit


