# Configuration INSTANCE_ID - Scaling Horizontal

## 📋 Utilisation

La variable d'environnement `INSTANCE_ID` est **optionnelle** mais **recommandée** pour le scaling horizontal.

### ✅ Format

```bash
INSTANCE_ID=backend-1
```

**Oui, vous pouvez charger cette variable telle quelle dans le backend.**

### 🔧 Comment ça fonctionne

1. **Si `INSTANCE_ID` est défini** :
   - Le backend utilise cette valeur pour identifier l'instance
   - Utilisé dans les locks Redis pour éviter les conflits entre instances
   - Loggé au démarrage : `✅ DeliveryStateSharing configuré - Instance ID: backend-1`

2. **Si `INSTANCE_ID` n'est pas défini** :
   - Le backend génère automatiquement un ID unique : `backend-{UUID}`
   - Exemple : `backend-550e8400-e29b-41d4-a716-446655440000`
   - Fonctionne mais moins lisible pour le debugging

### 📝 Exemples de Configuration

#### Docker Compose

```yaml
services:
  backend-1:
    environment:
      - INSTANCE_ID=backend-1
      - REDIS_URL=redis://redis:6379
  
  backend-2:
    environment:
      - INSTANCE_ID=backend-2
      - REDIS_URL=redis://redis:6379
  
  backend-3:
    environment:
      - INSTANCE_ID=backend-3
      - REDIS_URL=redis://redis:6379
```

#### Fichier .env

```bash
# .env
INSTANCE_ID=backend-1
REDIS_URL=redis://localhost:6379
```

#### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yukpo-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name  # Utilise le nom du pod
```

#### Docker Run

```bash
docker run -e INSTANCE_ID=backend-1 -e REDIS_URL=redis://localhost:6379 yukpo-backend
```

### 🎯 Utilisation dans le Code

L'`instance_id` est automatiquement utilisé par le service `DeliveryStateSharing` :

```rust
// Dans delivery_service.rs
if let Some(state_sharing) = &state.delivery_state_sharing {
    // Verrouiller avant matching (utilise automatiquement l'instance_id)
    if !state_sharing.lock_matching_attempt(delivery_id).await? {
        // Déjà verrouillé par une autre instance
        return Err(AppError::Conflict("Delivery already being matched"));
    }
    
    // Faire le matching...
    
    // Libérer le lock (utilise automatiquement l'instance_id)
    state_sharing.unlock_delivery_auto(delivery_id).await?;
}
```

### ⚠️ Important

- **Chaque instance doit avoir un `INSTANCE_ID` unique**
- Si vous utilisez plusieurs instances, donnez des IDs différents : `backend-1`, `backend-2`, `backend-3`
- L'ID est utilisé pour les locks Redis, donc il doit être stable (pas changer à chaque redémarrage)

### 🔍 Vérification

Au démarrage du backend, vous devriez voir dans les logs :

```
✅ DeliveryStateSharing configuré - Instance ID: backend-1
```

Si vous ne voyez pas ce message, vérifiez que :
1. Redis est configuré (`REDIS_URL`)
2. Redis est accessible
3. La variable `INSTANCE_ID` est bien chargée (optionnel)

---

**Résumé** : Oui, chargez `INSTANCE_ID=backend-1` tel quel dans votre fichier `.env` ou variables d'environnement. C'est optionnel mais recommandé pour un meilleur debugging et monitoring.

