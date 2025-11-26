# 🔍 Guide de Diagnostic LiveKit

## Comment savoir si le serveur LiveKit est OK ?

Ce guide vous explique comment vérifier que votre serveur LiveKit est correctement configuré et accessible.

---

## 📋 Méthodes de Diagnostic

### **Méthode 1 : Script PowerShell (Rapide)**

Exécutez le script PowerShell depuis le répertoire racine :

```powershell
.\scripts\test_livekit.ps1
```

**Ce script vérifie :**
- ✅ Présence des variables d'environnement (`LIVEKIT_API_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
- ✅ Connectivité réseau TCP vers le serveur
- ✅ Endpoint de santé `/health`
- ✅ Format de l'URL
- ✅ Accessibilité de l'API

**Résultat attendu :**
```
✅ Configuration de base: OK
✅ Serveur LiveKit accessible
✅ Endpoint API accessible
```

---

### **Méthode 2 : Binaire Rust (Complet)**

Pour un test complet avec authentification :

```bash
cd backend
cargo run --bin test_livekit
```

**Ce binaire teste :**
- ✅ Configuration complète
- ✅ Endpoint de santé
- ✅ Authentification avec génération de token JWT
- ✅ Appel API `ListRooms` (liste les rooms actives)
- ✅ Appel API `ListIngress` (liste les ingress actifs)

**Résultat attendu :**
```
✅ Configuration valide
✅ Serveur LiveKit accessible
✅ Authentification réussie
📊 Nombre de rooms actives: X
```

---

### **Méthode 3 : Vérification manuelle avec curl**

Testez directement avec curl :

```bash
# 1. Test de santé
curl -X GET https://votre-serveur.livekit.cloud/health

# 2. Test d'authentification (nécessite un token JWT)
curl -X POST https://votre-serveur.livekit.cloud/twirp/livekit.RoomService/ListRooms \
  -H "Authorization: Bearer VOTRE_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 🔍 Signes que LiveKit fonctionne

### ✅ **Dans les logs du backend :**

```
✅ LiveKit configuré et activé
✅ LiveKit: Connexion établie avec succès (tentative 1)
✅ LiveKit disponible. Nettoyage automatique activé.
✅ LiveKit disponible. Synchronisation analytics activée.
```

### ❌ **Signes de problème :**

```
⚠️ LiveKit: Connexion impossible après 3 tentatives
⚠️ LiveKit: Variables d'environnement manquantes
❌ LiveKit: Connexion refusée
```

---

## 🛠️ Résolution des Problèmes Courants

### **Problème 1 : Variables d'environnement manquantes**

**Symptôme :**
```
❌ LIVEKIT_API_URL non définie
❌ LIVEKIT_API_KEY non définie
❌ LIVEKIT_API_SECRET non définie
```

**Solution :**
1. Allez sur Render.com > Votre service > Environment
2. Ajoutez les variables :
   - `LIVEKIT_API_URL=https://votre-projet.livekit.cloud`
   - `LIVEKIT_API_KEY=votre_api_key`
   - `LIVEKIT_API_SECRET=votre_api_secret`
3. Redéployez le service

---

### **Problème 2 : Connexion refusée**

**Symptôme :**
```
❌ Erreur: Connection refused
❌ tcp connect error
```

**Causes possibles :**
- Le serveur LiveKit n'est pas démarré
- L'URL est incorrecte
- Le serveur est derrière un firewall

**Solutions :**
1. **LiveKit Cloud** : Vérifiez que votre projet est actif sur https://cloud.livekit.io
2. **LiveKit Self-hosted** : Vérifiez que le serveur est démarré :
   ```bash
   docker ps | grep livekit
   # ou
   systemctl status livekit
   ```
3. Testez l'URL manuellement :
   ```bash
   curl https://votre-serveur.livekit.cloud/health
   ```

---

### **Problème 3 : Authentification échouée (401)**

**Symptôme :**
```
❌ Authentification échouée (401 Unauthorized)
LiveKit ListRooms a renvoyé 401 Unauthorized
```

**Causes possibles :**
- `LIVEKIT_API_KEY` incorrecte
- `LIVEKIT_API_SECRET` incorrecte
- Les credentials ne correspondent pas au projet

**Solutions :**
1. Vérifiez les credentials sur https://cloud.livekit.io
2. Régénérez les clés API si nécessaire
3. Vérifiez qu'il n'y a pas d'espaces dans les variables d'environnement

---

### **Problème 4 : URL non résolvable (DNS)**

**Symptôme :**
```
❌ Name or service not known
❌ failed to lookup address
```

**Solutions :**
1. Vérifiez que l'URL est correcte (sans typo)
2. Testez la résolution DNS :
   ```bash
   nslookup votre-serveur.livekit.cloud
   ```
3. Pour LiveKit Cloud, utilisez l'URL fournie dans le dashboard

---

## 📊 Checklist de Vérification

Utilisez cette checklist pour diagnostiquer rapidement :

- [ ] Variables d'environnement définies dans Render.com
- [ ] `LIVEKIT_API_URL` commence par `http://` ou `https://`
- [ ] `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` sont présents
- [ ] Le serveur LiveKit est démarré (si self-hosted)
- [ ] L'endpoint `/health` répond avec curl
- [ ] Les logs du backend montrent "✅ LiveKit configuré et activé"
- [ ] Pas d'erreurs de connexion dans les logs

---

## 🎯 Configuration Recommandée

### **Pour LiveKit Cloud (Recommandé)**

```env
LIVEKIT_API_URL=https://votre-projet.livekit.cloud
LIVEKIT_WS_URL=wss://votre-projet.livekit.cloud
LIVEKIT_API_KEY=APxxxxxxxxxxxx
LIVEKIT_API_SECRET=votre_secret_ici
LIVEKIT_HLS_URL=https://votre-projet.livekit.cloud/hls
```

### **Pour LiveKit Self-hosted**

```env
LIVEKIT_API_URL=http://votre-serveur:7880
LIVEKIT_WS_URL=ws://votre-serveur:7880
LIVEKIT_API_KEY=APxxxxxxxxxxxx
LIVEKIT_API_SECRET=votre_secret_ici
LIVEKIT_HLS_URL=http://votre-serveur:7880/hls
```

---

## 📝 Logs à Surveiller

### **Au démarrage du backend :**

```
✅ LiveKit configuré et activé
⏳ LiveKit: Attente de 10 secondes avant la première tentative de connexion...
✅ LiveKit: Connexion établie avec succès (tentative 1)
```

### **Pendant le fonctionnement :**

```
✅ LiveKit disponible. Nettoyage automatique activé.
✅ LiveKit disponible. Synchronisation analytics activée.
```

### **En cas d'erreur :**

```
⚠️ LiveKit: Connexion impossible après 3 tentatives
ℹ️ LiveKit non disponible (service optionnel). Nettoyage automatique désactivé.
```

---

## 🚀 Prochaines Étapes

Une fois que LiveKit est opérationnel :

1. ✅ Testez la création d'une session live
2. ✅ Vérifiez que les rooms sont créées correctement
3. ✅ Testez l'ingress RTMP/WebRTC
4. ✅ Vérifiez la synchronisation des analytics

---

## 💡 Notes Importantes

- **LiveKit est optionnel** : Le backend fonctionne sans LiveKit, mais les fonctionnalités de streaming live seront désactivées
- **Retry automatique** : Le backend essaie de se reconnecter automatiquement toutes les 15 minutes
- **Logs silencieux** : Après la première erreur, les erreurs répétées ne sont plus loggées pour éviter le spam

---

## 📞 Support

Si les problèmes persistent :
1. Vérifiez les logs complets du backend
2. Testez avec le script PowerShell `test_livekit.ps1`
3. Vérifiez la documentation LiveKit : https://docs.livekit.io
4. Pour LiveKit Cloud : https://cloud.livekit.io/support

