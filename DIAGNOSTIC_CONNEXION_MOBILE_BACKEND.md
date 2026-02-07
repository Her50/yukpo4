# 🔍 Diagnostic Connexion Mobile → Backend

**Date**: 2026-02-02  
**Problème**: L'application mobile n'arrive pas à se connecter au backend malgré la configuration dans `production.json`

## 📋 Configuration Actuelle

### 1. Variables d'environnement dans `production.json`

```json
{
  "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
  "EXPO_PUBLIC_WS_URL": "wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
  "EXPO_PUBLIC_ENVIRONMENT": "production"
}
```

### 2. Configuration dans `eas.json`

```json
{
  "production": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
      "EXPO_PUBLIC_WS_URL": "wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
    }
  }
}
```

## ⚠️ Problèmes Identifiés

### Problème 1: `production.json` n'est pas utilisé automatiquement par Expo/EAS

**Explication** :
- Le fichier `production.json` n'est **PAS** chargé automatiquement par Expo/EAS
- Expo/EAS utilise uniquement :
  1. Les variables dans `eas.json` (pour les builds EAS)
  2. Le fichier `.env` (pour le développement local)
  3. Les variables d'environnement système

**Solution** :
- ✅ Les variables dans `eas.json` sont correctes
- ⚠️ Le fichier `production.json` doit être utilisé avec `--env-file` ou chargé manuellement

### Problème 2: CORS peut bloquer les requêtes du mobile

**Configuration CORS actuelle** :
- Le backend lit `ALLOWED_ORIGINS` depuis les variables d'environnement
- Format: `ALLOWED_ORIGINS=https://domain1.com,https://domain2.com`
- Si `ALLOWED_ORIGINS` n'est pas défini, le backend peut bloquer les requêtes

**Vérification requise** :
1. Vérifier que `ALLOWED_ORIGINS` est configuré dans le backend
2. Ajouter `*` ou les origines spécifiques pour le mobile

### Problème 3: Backend peut ne pas être accessible depuis l'extérieur

**Vérifications requises** :
1. ✅ Backend opérationnel (confirmé par logs)
2. ⚠️ ALB accessible depuis Internet
3. ⚠️ Security Groups autorisent les connexions HTTPS (443) et HTTP (80)
4. ⚠️ Health check ALB fonctionne

## 🔧 Solutions

### Solution 1: Utiliser `eas.json` pour les builds (✅ Déjà fait)

Les variables dans `eas.json` sont correctes et seront utilisées lors des builds EAS.

### Solution 2: Vérifier et configurer CORS dans le backend

**Action requise** : Vérifier la variable d'environnement `ALLOWED_ORIGINS` dans le backend AWS ECS.

**Configuration recommandée** :
```bash
ALLOWED_ORIGINS=*
```

Ou pour plus de sécurité :
```bash
ALLOWED_ORIGINS=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com,https://yukpomnang.com,https://app.yukpomnang.com
```

**Où configurer** :
- Dans la définition de la tâche ECS
- Dans les variables d'environnement du service ECS

### Solution 3: Vérifier l'accessibilité du backend

**Test de connectivité** :
```bash
# Test HTTPS
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health

# Test avec headers CORS
curl -v -H "Origin: https://yukpomnang.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/login
```

**Vérifications AWS** :
1. ✅ Service ECS en cours d'exécution
2. ⚠️ Security Groups autorisent HTTPS (443) depuis Internet (0.0.0.0/0)
3. ⚠️ ALB Health Check fonctionne
4. ⚠️ Target Group contient des instances saines

### Solution 4: Ajouter des logs de diagnostic dans le mobile

**Fichier à modifier** : `mobile/src/config/api.config.ts`

```typescript
// Ajouter des logs pour vérifier la configuration
if (__DEV__) {
    console.log('📡 [API Config] API_BASE_URL:', API_BASE_URL);
    console.log('📡 [API Config] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    console.log('📡 [API Config] Environment:', EXPO_ENV);
}
```

**Fichier à modifier** : `mobile/src/services/api.ts`

```typescript
// Ajouter des logs pour chaque requête
console.log(`[Mobile API] Making request to: ${API_BASE_URL}${endpoint}`);
console.log(`[Mobile API] Headers:`, headers);
```

### Solution 5: Vérifier les erreurs réseau dans le mobile

**Erreurs possibles** :
1. `Network request failed` → Backend inaccessible ou CORS bloqué
2. `Timeout` → Backend trop lent ou inaccessible
3. `SSL/TLS error` → Certificat invalide ou non configuré
4. `CORS error` → Headers CORS manquants ou incorrects

## 📝 Checklist de Diagnostic

### Backend
- [ ] Service ECS en cours d'exécution
- [ ] ALB accessible depuis Internet
- [ ] Security Groups autorisent HTTPS (443)
- [ ] Health check ALB fonctionne
- [ ] Variable `ALLOWED_ORIGINS` configurée dans ECS
- [ ] Backend répond à `/api/health`

### Mobile
- [ ] Variables d'environnement chargées (`EXPO_PUBLIC_API_URL`)
- [ ] `API_BASE_URL` pointe vers AWS ALB
- [ ] Logs de requêtes montrent l'URL correcte
- [ ] Erreurs réseau capturées et loggées

### Réseau
- [ ] DNS résout correctement l'ALB
- [ ] Certificat SSL/TLS valide
- [ ] Pas de firewall bloquant les connexions

## 🎯 Actions Immédiates

1. **Vérifier CORS dans le backend** :
   ```bash
   # Dans AWS ECS Task Definition, vérifier :
   ALLOWED_ORIGINS=*
   ```

2. **Tester la connectivité** :
   ```bash
   curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health
   ```

3. **Vérifier les logs du mobile** :
   - Ouvrir les DevTools React Native
   - Vérifier les logs `📡 [API Config]`
   - Vérifier les erreurs réseau

4. **Vérifier les Security Groups AWS** :
   - Autoriser HTTPS (443) depuis 0.0.0.0/0
   - Autoriser HTTP (80) depuis 0.0.0.0/0

## 📊 Résumé

**Configuration mobile** : ✅ Correcte (AWS ALB dans `eas.json`)  
**Configuration backend** : ⚠️ À vérifier (CORS, Security Groups)  
**Problème probable** : CORS ou Security Groups bloquant les connexions

**Prochaine étape** : Vérifier et configurer `ALLOWED_ORIGINS` dans le backend ECS.


