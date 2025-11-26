# 📋 Résumé : Comment Savoir si le Serveur LiveKit est OK

## 🚀 Méthodes Rapides

### **1. Script PowerShell (Recommandé)**
```powershell
.\scripts\test_livekit.ps1
```

### **2. Vérifier les logs du backend**
Cherchez ces messages dans les logs Render.com :

**✅ LiveKit fonctionne :**
```
✅ LiveKit configuré et activé
✅ LiveKit: Connexion établie avec succès
✅ LiveKit disponible. Nettoyage automatique activé.
```

**❌ LiveKit ne fonctionne pas :**
```
⚠️ LiveKit: Connexion impossible après 3 tentatives
⚠️ LiveKit: Variables d'environnement manquantes
```

### **3. Test manuel avec curl**
```bash
curl https://votre-serveur.livekit.cloud/health
```

---

## 🔍 Checklist Rapide

- [ ] Variables définies dans Render.com :
  - `LIVEKIT_API_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
- [ ] L'URL commence par `http://` ou `https://`
- [ ] Le serveur LiveKit est démarré (si self-hosted)
- [ ] Les logs montrent "✅ LiveKit configuré et activé"

---

## 📖 Documentation Complète

Voir le guide complet : `GUIDE_DIAGNOSTIC_LIVEKIT.md`

---

## ⚠️ Note sur Redis TLS

**Problème actuel :** La feature TLS pour Redis nécessite des dépendances supplémentaires qui ne sont pas encore configurées.

**Solution temporaire :** 
- Redis fonctionne sans TLS pour les connexions locales
- Pour Upstash, utilisez l'URL REST au lieu de l'URL Redis directe
- Ou configurez Redis sans TLS pour l'instant

**Note :** LiveKit est indépendant de Redis et fonctionne même si Redis a des problèmes.

