# 🔍 Analyse des Logs - Sélection Nature de l'Activité (Création Coursier)

**Date**: 2026-01-14  
**Fichier analysé**: `CourierRegistrationScreen.tsx`  
**Endpoint concerné**: `/api/delivery/partners`

## 📋 Résumé Exécutif

Analyse des logs fournis pour détecter des anomalies lors de la sélection de la nature de l'activité dans le formulaire de création d'un coursier.

## 🔴 Problème Principal Identifié

### **ANOMALIE CRITIQUE : Vérification de Permission Manquante**

**Problème**: L'endpoint `/api/delivery/partners` nécessite le rôle **admin** (voir `backend/src/routes/delivery_routes.rs:5121`), mais est appelé par un utilisateur avec le rôle **"user"**.

**Code Backend**:
```rust
// backend/src/routes/delivery_routes.rs:5121
if user.role != "admin" {
    return Err(AppError::Forbidden("Accès réservé aux administrateurs".to_string()));
}
```

**Logs Analysés**:
- Utilisateur ID: `56`
- Rôle: `"user"` (pas "admin")
- Requêtes détectées: `/api/delivery/partners` et `/api/delivery/partners?type=livraison`

**Configuration Backend**:
- **Middleware JWT**: ✅ Appliqué à la ligne 457 (`delivery_routes.rs`)
- **Vérification d'authentification**: ✅ OK (JWT valide)
- **Vérification de rôle admin**: ⚠️ Effectuée dans la fonction `list_delivery_partners` (ligne 5121)

**Impact**:
- Les utilisateurs normaux ne devraient pas pouvoir accéder à cet endpoint
- Cela devrait retourner une erreur **403 Forbidden**
- Cependant, dans les logs fournis, aucune erreur 403 n'est visible
- Les logs montrent seulement les requêtes DEBUG (JWT valide), pas les réponses HTTP

**Hypothèses**:
1. ✅ **Les logs ne montrent pas les réponses HTTP** (seulement les requêtes DEBUG)
2. ⚠️ L'utilisateur a été promu admin entre-temps (peu probable car le JWT contient toujours "user")
3. ⚠️ Il y a un problème dans la fonction `list_delivery_partners` qui contourne la vérification
4. ⚠️ Le middleware JWT ne propage pas correctement l'Extension `AuthenticatedUser`

## 📊 Analyse Détaillée des Logs

### Requêtes Détectées

```json
{
  "timestamp": "2026-01-14T01:45:05.128460Z",
  "endpoints": [
    "/api/delivery/partners",
    "/api/delivery/partners?type=livraison"
  ],
  "user": {
    "id": 56,
    "role": "user",
    "email": "lelehernandez152007@gmail.com"
  },
  "status": "DEBUG - JWT valide"
}
```

### Points d'Attention

1. **Authentification**: ✅ JWT valide et utilisateur authentifié
2. **Permissions**: ⚠️ Utilisateur non-admin accédant à un endpoint admin
3. **Paramètres**: ✅ Paramètre `type=livraison` correctement passé
4. **Erreurs visibles**: ❌ Aucune erreur HTTP visible dans les logs fournis

## 🐛 Autres Anomalies Potentielles

### 1. Gestion d'Erreur dans le Code Mobile

**Fichier**: `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`

**Lignes 154-162**: Boucle de chargement des partenaires par type
```typescript
for (const partnerType of partnerTypesToLoad) {
    try {
        const responseType = await apiGet(`/api/delivery/partners?type=${partnerType}`);
        const typePartners = responseType.partners || responseType.data?.partners || [];
        partnersList = [...partnersList, ...typePartners];
    } catch (err) {
        console.warn(`[CourierRegistrationScreen] Erreur chargement partenaires type ${partnerType}:`, err);
    }
}
```

**Problème potentiel**: 
- Les erreurs sont capturées silencieusement avec `console.warn`
- Si l'API retourne 403, l'utilisateur ne sera pas informé clairement
- Le code continue avec une liste vide si toutes les requêtes échouent

### 2. Mapping Type de Coursier → Type Partenaire

**Lignes 132-148**: Mapping des types de coursier vers les types de partenaires

```typescript
switch (courierType) {
    case 'classic':
        partnerTypesToLoad = ['livraison'];
        break;
    case 'market_shopping':
        partnerTypesToLoad = ['livraison_courses_marche'];
        break;
    case 'taxi':
    case 'carpooling':
        partnerTypesToLoad = ['chauffeur'];
        break;
    case 'moving':
        partnerTypesToLoad = ['demenagement'];
        break;
    default:
        partnerTypesToLoad = ['livraison', 'livraison_courses_marche', 'demenagement', 'chauffeur'];
}
```

**Vérification requise**:
- Les types de partenaires dans la base de données correspondent-ils exactement ?
- `'livraison'` vs `'Livraison'` (sensibilité à la casse)
- Le backend fait-il un cast `::text` pour la comparaison (ligne 5138)

### 3. Validation du Formulaire

**Ligne 473**: Validation du champ `courierType`
```typescript
if (!courierType) {
    Alert.alert('Erreur', 'Veuillez sélectionner la nature de votre activité');
    return false;
}
```

**OK**: Validation côté client fonctionnelle

## 🔧 Recommandations

### 1. **URGENT: Créer un endpoint public pour les partenaires**

**Problème**: Les coursiers ont besoin de voir la liste des partenaires, mais l'endpoint actuel est réservé aux admins.

**Solution proposée**:
```rust
// Nouvel endpoint: GET /api/delivery/partners/public
// Ou modifier l'endpoint existant pour permettre la lecture publique avec filtres
```

**Alternative**: Créer un endpoint spécifique pour les coursiers :
```
GET /api/delivery/partners/for-courier?type=livraison
```

### 2. Améliorer la gestion d'erreur côté mobile

**Fichier**: `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`

**Ligne 159**: Remplacer `console.warn` par une gestion d'erreur plus explicite

```typescript
catch (err) {
    console.error(`[CourierRegistrationScreen] Erreur chargement partenaires type ${partnerType}:`, err);
    // Ajouter un feedback utilisateur si erreur 403
    if (err.response?.status === 403) {
        Alert.alert(
            'Accès refusé',
            'Vous n\'avez pas les permissions nécessaires. Veuillez contacter le support.'
        );
    }
}
```

### 3. Ajouter des logs côté backend

**Fichier**: `backend/src/routes/delivery_routes.rs`

**Ligne 5121**: Ajouter un log avant de refuser l'accès

```rust
if user.role != "admin" {
    warn!("[delivery/partners] Accès refusé pour utilisateur {} (rôle: {})", user.id, user.role);
    return Err(AppError::Forbidden("Accès réservé aux administrateurs".to_string()));
}
```

### 4. Vérifier la sensibilité à la casse

**Backend ligne 5138**:
```rust
WHERE partner_type::text = $1 AND is_active = TRUE
```

**Recommandation**: Utiliser `ILIKE` ou normaliser la casse

```rust
WHERE LOWER(partner_type::text) = LOWER($1) AND is_active = TRUE
```

### 5. Tester les scénarios d'erreur

- ✅ Test avec utilisateur non-admin
- ✅ Test avec types de partenaires inexistants
- ✅ Test avec paramètre `type` vide ou invalide
- ✅ Test avec base de données vide

## 📝 Logs Manquants à Analyser

Pour une analyse complète, il faudrait :
1. ✅ Logs HTTP complets (status codes, headers)
2. ✅ Logs d'erreur backend (erreurs SQL, permissions)
3. ✅ Logs frontend (console.error, console.warn)
4. ❌ Logs de validation (format des données)
5. ❌ Logs de performance (temps de réponse)

## 🎯 Actions Immédiates

1. **Vérifier si l'utilisateur ID 56 a les permissions admin** (même si le JWT indique "user")
2. **Créer un endpoint public pour les partenaires** ou modifier les permissions
3. **Ajouter des logs côté backend** pour tracer les refus d'accès
4. **Améliorer la gestion d'erreur côté mobile** avec feedback utilisateur
5. **Tester avec un utilisateur réellement non-admin** pour reproduire le problème

## 📌 Conclusion

**Anomalie principale**: L'endpoint `/api/delivery/partners` nécessite le rôle admin mais est appelé par un utilisateur normal. Cela devrait normalement retourner une erreur 403, mais aucune erreur n'est visible dans les logs fournis.

**Hypothèse**: Soit les logs ne montrent pas les erreurs HTTP, soit il y a un problème de routing/middleware qui permet l'accès, soit l'utilisateur a été promu admin.

**Priorité**: 🔴 **HAUTE** - Nécessite une investigation immédiate pour comprendre pourquoi un utilisateur non-admin peut accéder à un endpoint admin.

