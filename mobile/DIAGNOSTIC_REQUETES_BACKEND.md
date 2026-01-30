# 🔍 Diagnostic : Pourquoi le Mobile ne Peut Pas Faire des Requêtes au Backend

## 🔴 Problème Identifié

### 1. Incohérence d'URL dans le Code Mobile

**Dans `mobile/src/services/api.ts` ligne 714** :
```typescript
const response = await apiCall('/auth/register', {
  method: 'POST',
  body: JSON.stringify(payload),
});
```

**Mais `apiCall` construit l'URL avec** :
```typescript
const response = await fetch(`${API_BASE_URL}${endpoint}`, {
  ...config,
  signal: controller.signal,
});
```

**Résultat** : L'URL finale serait :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/auth/register
```

**Mais le backend attend** (après notre correction dans `backend/src/lib.rs`) :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register
```

### 2. Le Backend a été Corrigé pour Utiliser `/api/auth/register`

Dans `backend/src/lib.rs`, nous avons changé :
```rust
.merge(auth)  // ❌ Avant : /auth/register
```

En :
```rust
.nest("/api", auth)  // ✅ Après : /api/auth/register
```

## 🔧 Solutions

### Solution 1 : Corriger le Code Mobile (Recommandé)

Modifier `mobile/src/services/api.ts` pour utiliser `/api/auth/register` :

```typescript
// Ligne 714 - AVANT
const response = await apiCall('/auth/register', {

// Ligne 714 - APRÈS
const response = await apiCall('/api/auth/register', {
```

### Solution 2 : Vérifier Tous les Endpoints Auth

Vérifier que tous les endpoints auth utilisent le préfixe `/api` :

- `/auth/login` → `/api/auth/login`
- `/auth/register` → `/api/auth/register`
- `/auth/logout` → `/api/auth/logout`

## 🔍 Autres Causes Possibles

### 1. ALB Non Accessible (Le Plus Probable)

Même si l'URL est correcte, si l'ALB n'est pas accessible, les requêtes échoueront.

**Symptômes** :
- `Network request failed`
- `Failed to fetch`
- `ECONNREFUSED`
- Timeout

**Vérification** :
```powershell
# Tester depuis votre machine
curl -X POST https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test"}'
```

### 2. CORS (Cross-Origin Resource Sharing)

Si le backend ne permet pas les requêtes depuis le mobile, elles seront bloquées.

**Vérification** : Regarder les logs du backend pour des erreurs CORS.

### 3. Security Groups AWS

Les Security Groups de l'ALB peuvent bloquer les connexions.

**Vérification** :
```powershell
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(DNSName, `yukpomnang-backend`)].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}'
```

### 4. Service ECS Arrêté

Si le service ECS n'a pas de tâches en cours, l'ALB ne peut pas router les requêtes.

**Vérification** :
```powershell
aws ecs describe-services --cluster yukpomnang-cluster --services yukpomnang-backend-service --region us-east-1
```

## 🎯 Actions Immédiates

### 1. Corriger l'URL dans le Code Mobile

```typescript
// mobile/src/services/api.ts ligne 714
const response = await apiCall('/api/auth/register', {  // ✅ Ajouter /api
```

### 2. Vérifier les Logs du Mobile

Dans l'app mobile, regarder les logs :
```
[Mobile API] Making request to: https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/auth/register
```

Si vous voyez `/auth/register` au lieu de `/api/auth/register`, c'est le problème.

### 3. Tester l'Endpoint Directement

```bash
curl -X POST https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

### 4. Vérifier les Logs Backend

Pendant qu'un utilisateur essaie de créer un compte, regarder les logs ECS :
```powershell
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1 | Select-String "register_user|POST|auth"
```

## 📋 Checklist de Diagnostic

- [ ] URL dans le code mobile : `/api/auth/register` (pas `/auth/register`)
- [ ] ALB accessible depuis l'extérieur (test avec curl)
- [ ] Service ECS en cours d'exécution (au moins 1 tâche)
- [ ] Security Groups permettent HTTPS (port 443)
- [ ] CORS configuré correctement dans le backend
- [ ] Logs du mobile montrent l'URL complète utilisée
- [ ] Logs du backend montrent des requêtes entrantes

## 💡 Conclusion

**Le problème le plus probable** est une **combinaison de** :
1. URL incorrecte dans le mobile (`/auth/register` au lieu de `/api/auth/register`)
2. ALB non accessible (Security Groups ou service ECS arrêté)

**Corriger d'abord l'URL dans le mobile**, puis vérifier l'accessibilité de l'ALB.


