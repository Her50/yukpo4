# 🧪 Test de Connexion API

## Problème actuel
L'erreur 500 lors de la création de service n'apparaît **PAS** dans les logs backend, ce qui suggère que la requête n'atteint jamais le serveur Rust.

## Tests à effectuer

### Test 1: Vérifier la connexion à l'API (via navigateur)

Ouvrez dans votre navigateur :
```
https://yukpomnang.onrender.com/health
```

**Résultat attendu:** Une réponse JSON indiquant que le serveur est actif.

---

### Test 2: Tester l'endpoint depuis votre téléphone

Dans l'application mobile, avant de créer un service, ajoutez temporairement ce code de test dans `FormulaireYukpoIntelligentScreen.tsx` :

```typescript
// Test de connexion API - À AJOUTER TEMPORAIREMENT
const testApiConnection = async () => {
  try {
    console.log('[TEST] Test de connexion API...');
    const testResponse = await fetch('https://yukpomnang.onrender.com/health');
    console.log('[TEST] Status:', testResponse.status);
    const testData = await testResponse.text();
    console.log('[TEST] Response:', testData);
    Alert.alert('✅ API accessible', `Status: ${testResponse.status}\n${testData}`);
  } catch (error) {
    console.error('[TEST] Erreur connexion API:', error);
    Alert.alert('❌ API inaccessible', error.message);
  }
};

// Appelez cette fonction avant de créer un service
```

---

### Test 3: Vérifier l'URL utilisée

Ajoutez des logs pour vérifier quelle URL est réellement utilisée :

```typescript
// Dans mobile/src/services/api.ts, ligne 87
console.log(`[Mobile API] Making request to: ${API_BASE_URL}${endpoint}`);
console.log(`[Mobile API] Full URL: https://yukpomnang.onrender.com${endpoint}`);
```

---

### Test 4: Service minimal (sans IA ni produits)

Essayez de créer un service avec le strict minimum :

```json
{
  "user_id": 17,
  "data": {
    "titre_service": "Test Service Minimal",
    "description": "Test de création minimale",
    "category": "Services automobiles",
    "whatsapp": "+237600000000"
  }
}
```

---

## 🔍 Hypothèses possibles

### A. Problème de réseau/DNS
- L'application mobile ne peut pas résoudre `yukpomnang.onrender.com`
- **Solution**: Tester depuis le navigateur du téléphone

### B. Timeout trop court
- La requête prend trop de temps et timeout avant d'atteindre le backend
- **Solution**: Vérifier dans `mobile/src/services/api.ts` ligne 96
  ```typescript
  const timeoutDuration = endpoint.includes('/services/create') ? 180000 : 15000;
  ```

### C. Problème de token/authentification
- Le token JWT est invalide ou expiré
- **Solution**: Vérifier le token dans les logs :
  ```typescript
  console.log('[FormulaireYukpoIntelligentScreen] 🔑 Token:', user?.token?.substring(0, 20));
  ```

### D. Reverse proxy ou load balancer
- Un serveur intermédiaire (Nginx, Cloudflare, etc.) retourne l'erreur 500 avant le backend Rust
- **Solution**: Contacter l'administrateur serveur ou vérifier les logs du reverse proxy

---

## 📊 Logs à collecter

Pour identifier le problème, collectez ces informations :

1. **Depuis l'app mobile** :
   ```
   [Mobile API] Making request to: https://yukpomnang.onrender.com/api/services/create
   [Mobile API] Request headers: {...}
   [Mobile API] Response status: 500
   [Mobile API] Response text: ...
   ```

2. **Depuis le backend** :
   - AUCUN log actuellement = la requête n'arrive jamais

3. **Depuis le navigateur** :
   - Test de `https://yukpomnang.onrender.com/health`
   - Test de `https://yukpomnang.onrender.com/api/users/balance`

---

## ✅ Prochaines étapes

1. ✅ **Bug de recherche corrigé** - Testez-le !
2. 🔄 **Test connexion API** - Exécutez Test 1 et Test 2
3. 📋 **Logs détaillés** - Collectez les informations ci-dessus
4. 🔍 **Analyse** - Identifiez où la requête se perd

---

## 💡 Note importante

Le fait que les logs backend ne montrent **AUCUNE** trace de la requête est très révélateur. Cela signifie que :

- ✅ Le backend fonctionne (les CRON s'exécutent)
- ❌ La requête de création n'atteint jamais le backend
- 🤔 L'erreur 500 vient d'ailleurs (proxy, load balancer, réseau)

Il faut donc identifier **où** la requête se perd entre le mobile et le backend.

