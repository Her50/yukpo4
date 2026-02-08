# 🔧 Guide de Résolution : Connexion Mobile → Backend

**Date**: 2026-02-02  
**Problème**: L'application mobile n'arrive pas à se connecter au backend

## 🎯 Problème Principal Identifié

Le fichier `production.json` **n'est PAS utilisé automatiquement** par Expo/EAS. Les variables d'environnement doivent être configurées dans `eas.json` (✅ déjà fait) ou dans le fichier `.env` du mobile.

## ✅ Configuration Mobile (Déjà Correcte)

### 1. Variables dans `eas.json` ✅

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

**✅ Ces variables seront utilisées lors des builds EAS.**

### 2. Code Mobile ✅

Le code mobile utilise correctement les variables :
- `mobile/src/config/api.config.ts` : Lit `EXPO_PUBLIC_API_URL`
- `mobile/src/config/environment.ts` : Lit `EXPO_PUBLIC_API_URL`

## ⚠️ Problèmes Potentiels

### Problème 1: CORS dans le Backend

**Symptôme** : Les requêtes échouent avec une erreur CORS

**Cause** : Le backend lit `ALLOWED_ORIGINS` depuis les variables d'environnement. Si cette variable n'est pas configurée, seules les origines par défaut sont autorisées :
- `https://yukpomnang.com`
- `https://yukpomnang.onrender.com`

**Solution** : Configurer `ALLOWED_ORIGINS` dans la tâche ECS

**Action requise** :
1. Aller dans AWS ECS → Task Definition
2. Ajouter la variable d'environnement :
   ```
   ALLOWED_ORIGINS=*
   ```
   Ou pour plus de sécurité :
   ```
   ALLOWED_ORIGINS=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com,https://yukpomnang.com,capacitor://localhost,ionic://localhost
   ```

**Note** : Pour les applications mobiles React Native/Expo, il n'y a généralement pas d'en-tête `Origin`. Le backend utilisera la première origine autorisée par défaut (voir `backend/src/middlewares/cors.rs` ligne 107-117).

### Problème 2: Security Groups AWS

**Symptôme** : `Network request failed` ou `Connection refused`

**Cause** : Les Security Groups bloquent les connexions HTTPS (443) depuis Internet

**Solution** : Vérifier et configurer les Security Groups

**Action requise** :
1. Aller dans AWS EC2 → Security Groups
2. Trouver le Security Group associé à l'ALB
3. Vérifier qu'il y a une règle entrante :
   - Type: HTTPS
   - Port: 443
   - Source: 0.0.0.0/0 (ou votre plage IP)
4. Vérifier qu'il y a une règle entrante :
   - Type: HTTP
   - Port: 80
   - Source: 0.0.0.0/0 (pour redirection HTTPS)

### Problème 3: ALB Non Accessible

**Symptôme** : `Impossible de se connecter au serveur distant`

**Cause** : L'ALB n'est pas accessible depuis Internet ou le service ECS est arrêté

**Solution** : Vérifier l'état du service ECS et de l'ALB

**Action requise** :
1. Vérifier que le service ECS est en cours d'exécution :
   ```bash
   aws ecs describe-services \
     --cluster yukpomnang-cluster \
     --services yukpomnang-backend-service \
     --region us-east-1
   ```

2. Vérifier que l'ALB est accessible :
   ```bash
   curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health
   ```

3. Vérifier le Health Check de l'ALB :
   - Aller dans AWS EC2 → Load Balancers
   - Vérifier que le Health Check est "Healthy"

### Problème 4: Certificat SSL/TLS

**Symptôme** : `SSL/TLS error` ou `Certificate error`

**Cause** : Certificat SSL/TLS invalide ou non configuré sur l'ALB

**Solution** : Vérifier et configurer le certificat SSL/TLS

**Action requise** :
1. Aller dans AWS EC2 → Load Balancers
2. Vérifier que l'ALB a un listener HTTPS (443) avec un certificat SSL/TLS
3. Si pas de certificat, en créer un dans AWS Certificate Manager (ACM)

## 🔍 Diagnostic Étape par Étape

### Étape 1: Vérifier la Configuration Mobile

**Dans le mobile, ajouter des logs** :

```typescript
// mobile/src/config/api.config.ts
if (__DEV__) {
    console.log('📡 [API Config] API_BASE_URL:', API_BASE_URL);
    console.log('📡 [API Config] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
}
```

**Vérifier dans les logs du mobile** :
- L'URL doit être : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

### Étape 2: Tester la Connectivité Backend

**Depuis votre machine** :
```bash
# Test HTTPS
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health

# Test avec CORS (simuler une requête mobile)
curl -v -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: capacitor://localhost" \
  https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/login \
  -d '{"email":"test@test.com","password":"test"}'
```

**Résultats attendus** :
- ✅ Status 200 ou 401 (pas 403 CORS)
- ✅ Headers `access-control-allow-origin` présents

### Étape 3: Vérifier les Logs Backend

**Dans les logs du backend** (CloudWatch), vérifier :
- ✅ Pas d'erreur `[CORS] Origine non autorisée rejetée`
- ✅ Les requêtes arrivent bien au backend

### Étape 4: Vérifier les Erreurs Réseau dans le Mobile

**Erreurs possibles** :
1. `Network request failed` → Backend inaccessible (Security Groups ou ALB)
2. `Timeout` → Backend trop lent ou inaccessible
3. `SSL/TLS error` → Certificat invalide
4. `CORS error` → Headers CORS manquants (vérifier `ALLOWED_ORIGINS`)

## 🛠️ Solutions Immédiates

### Solution 1: Configurer CORS dans ECS (Priorité 1)

**Action** :
1. Aller dans AWS ECS → Task Definition → `yukpomnang-backend-task`
2. Cliquer sur "Create new revision"
3. Dans "Container definitions", ajouter/modifier :
   - Key: `ALLOWED_ORIGINS`
   - Value: `*`
4. Enregistrer et mettre à jour le service ECS

**Alternative (plus sécurisé)** :
```
ALLOWED_ORIGINS=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com,https://yukpomnang.com,capacitor://localhost,ionic://localhost,exp://localhost
```

### Solution 2: Vérifier Security Groups (Priorité 2)

**Action** :
1. Aller dans AWS EC2 → Security Groups
2. Trouver le Security Group de l'ALB
3. Vérifier les règles entrantes :
   - HTTPS (443) depuis 0.0.0.0/0 ✅
   - HTTP (80) depuis 0.0.0.0/0 ✅

### Solution 3: Vérifier l'État du Service ECS (Priorité 3)

**Action** :
```bash
aws ecs describe-services \
  --cluster yukpomnang-cluster \
  --services yukpomnang-backend-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

**Résultat attendu** :
- Status: `ACTIVE`
- Running: `1` (ou plus)
- Desired: `1` (ou plus)

## 📝 Checklist Complète

### Backend AWS
- [ ] Service ECS en cours d'exécution
- [ ] ALB accessible depuis Internet
- [ ] Security Groups autorisent HTTPS (443)
- [ ] Health Check ALB fonctionne
- [ ] Variable `ALLOWED_ORIGINS` configurée dans ECS
- [ ] Certificat SSL/TLS valide sur l'ALB
- [ ] Backend répond à `/api/health`

### Mobile
- [ ] Variables d'environnement dans `eas.json` correctes
- [ ] `API_BASE_URL` pointe vers AWS ALB (vérifier dans les logs)
- [ ] Erreurs réseau capturées et loggées

### Réseau
- [ ] DNS résout correctement l'ALB
- [ ] Pas de firewall bloquant les connexions
- [ ] Test de connectivité depuis machine locale réussit

## 🎯 Actions Immédiates (Ordre de Priorité)

1. **Configurer `ALLOWED_ORIGINS=*` dans ECS** (5 minutes)
2. **Vérifier Security Groups** (2 minutes)
3. **Tester la connectivité backend** (2 minutes)
4. **Vérifier les logs du mobile** (5 minutes)

## 📊 Résumé

**Configuration mobile** : ✅ Correcte  
**Configuration backend CORS** : ⚠️ À vérifier/configurer  
**Problème probable** : CORS (`ALLOWED_ORIGINS` non configuré) ou Security Groups

**Prochaine étape** : Configurer `ALLOWED_ORIGINS=*` dans la tâche ECS.




