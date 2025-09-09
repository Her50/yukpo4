# 🔧 Guide de Dépannage Yukpo

## 🚨 Problèmes Courants et Solutions

### 1. **Erreurs de Toast/ToasterProvider**

**Symptômes :**
```
useToast must be used within a ToasterProvider
```

**Solution :**
- ✅ **Corrigé** : Le `ToasterProvider` est maintenant correctement configuré dans `App.tsx`
- Vérifiez que vous utilisez `useToast` de `@/components/ui/use-toast` et non de `react-hot-toast`

### 2. **Erreurs Réseau (SyntaxError: Unexpected token '<')**

**Symptômes :**
```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Causes possibles :**
- Backend non démarré (port 3001)
- Microservice embedding non démarré (port 8000)
- Problème de proxy Vite

**Solutions :**

#### A. Vérifier que tous les services sont démarrés
```powershell
# Démarrer tous les services
.\start-all-services.ps1

# Ou démarrer manuellement :
# Terminal 1 - Backend
cd backend
cargo run

# Terminal 2 - Microservice embedding
cd microservice_embedding
python -m uvicorn routers.embedding_router:app --host 0.0.0.0 --port 8000

# Terminal 3 - Frontend
cd frontend
npm run dev
```

#### B. Vérifier la configuration proxy Vite
Vérifiez `frontend/vite.config.ts` :
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/embedding': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

### 3. **Ports déjà utilisés**

**Symptômes :**
```
Error: Une seule utilisation de chaque adresse de socket (protocole/adresse réseau/port) est habituellement autorisée. (os error 10048)
```

**Solution :**
```powershell
# Arrêter tous les services
.\stop-all-services.ps1

# Puis redémarrer
.\start-all-services.ps1
```

### 4. **MesServices ne s'ouvre plus**

**Causes possibles :**
- Erreurs de toast (voir point 1)
- Erreurs réseau (voir point 2)
- Problème de route

**Solutions :**
1. Vérifiez la console du navigateur pour les erreurs
2. Assurez-vous que le backend répond sur `http://localhost:3001`
3. Vérifiez que l'utilisateur est connecté

### 5. **Problèmes de Performance (20 secondes)**

**Optimisations déjà implémentées :**
- ✅ Parallélisation des embeddings
- ✅ Cache de traductions
- ✅ Enrichissement multimodal asynchrone

**Pour améliorer encore :**
- Utilisez un GPU pour les embeddings (optionnel)
- Optimisez les prompts IA
- Mettez en cache les réponses IA

### 6. **Problèmes de Base de Données**

**Symptômes :**
```
database connection error
```

**Solutions :**
```bash
# Appliquer les migrations
cd backend
sqlx migrate run

# Vérifier la connexion
cargo run --bin check-db
```

### 7. **Problèmes de Redis**

**Symptômes :**
```
Redis connection failed
```

**Solutions :**
- Vérifiez que Redis est installé et démarré
- Sur Windows : `redis-server`
- Sur Linux/Mac : `sudo systemctl start redis`

## 🛠️ Commandes Utiles

### Démarrer tous les services
```powershell
.\start-all-services.ps1
```

### Arrêter tous les services
```powershell
.\stop-all-services.ps1
```

### Vérifier les ports utilisés
```powershell
netstat -ano | findstr :3001
netstat -ano | findstr :5173
netstat -ano | findstr :8000
```

### Nettoyer et redémarrer
```powershell
# Arrêter tout
.\stop-all-services.ps1

# Nettoyer les caches
cd frontend
npm run clean
cd ../backend
cargo clean

# Redémarrer
.\start-all-services.ps1
```

## 📞 Support

Si les problèmes persistent :
1. Vérifiez les logs dans la console du navigateur
2. Vérifiez les logs des services dans les terminaux
3. Consultez ce guide de dépannage
4. Redémarrez tous les services avec `.\stop-all-services.ps1` puis `.\start-all-services.ps1` 