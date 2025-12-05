# ✅ Redis Pub/Sub pour WebSocket Scaling Horizontal - IMPLÉMENTÉ

**Date** : 2025-01-27  
**Statut** : ✅ **COMPLET**

---

## 🎯 Objectif

Implémenter Redis Pub/Sub pour permettre le scaling horizontal des WebSockets de chat. Cela permet de distribuer les messages entre plusieurs instances backend.

---

## 📋 Architecture

### 1. **ChatWebSocketManager**

Manager centralisé pour gérer les connexions WebSocket de chat avec Redis pub/sub.

**Fichier** : `backend/src/websocket/chat_websocket.rs`

**Fonctionnalités** :
- ✅ Gestion des connexions WebSocket par conversation
- ✅ Broadcast local via `tokio::broadcast`
- ✅ Publication Redis pub/sub pour scaling horizontal
- ✅ Écoute Redis pub/sub pour recevoir les messages d'autres instances
- ✅ Protection contre les boucles (ignore les messages de sa propre instance)

### 2. **Routes WebSocket**

**Endpoint** : `/ws/chat/:service_id/:prestataire_id/:user_id`

**Fonctionnalités** :
- ✅ Connexion WebSocket par conversation
- ✅ Authentification via message `auth`
- ✅ Heartbeat (ping/pong)
- ✅ Distribution des messages en temps réel

### 3. **Intégration avec les réactions**

Les routes de réactions (`chat_reactions_routes.rs`) publient maintenant via Redis pub/sub :

- ✅ `reaction_added` : Publie via WebSocket quand une réaction est ajoutée
- ✅ `reaction_removed` : Publie via WebSocket quand une réaction est supprimée

---

## 🔧 Configuration

### Variables d'environnement

```bash
# ID unique de l'instance (généré automatiquement si non défini)
INSTANCE_ID=backend-12345

# URL Redis (requis pour pub/sub)
REDIS_URL=redis://localhost:6379/0
```

### Initialisation

Le `ChatWebSocketManager` est automatiquement initialisé dans `AppState::new()` :

```rust
chat_ws_manager: Some(Arc::new(
    ChatWebSocketManager::new(
        64, // Buffer size
        Some(redis_client.clone()), // Redis client
    )
))
```

---

## 📡 Flux de messages

### 1. **Message local (même instance)**

```
Client A → Instance 1 → ChatWebSocketManager → Broadcast local → Client B
```

### 2. **Message cross-instance (scaling horizontal)**

```
Client A → Instance 1 → ChatWebSocketManager → Redis PUBLISH
                                                      ↓
                                              Redis Channel
                                                      ↓
Instance 2 → Redis SUBSCRIBE → ChatWebSocketManager → Broadcast local → Client B
```

### 3. **Protection contre les boucles**

Chaque message contient un `instance_id`. Les instances ignorent les messages de leur propre instance :

```rust
if let Some(ref msg_instance_id) = message.instance_id {
    if msg_instance_id == &instance_id {
        continue; // Ignorer
    }
}
```

---

## 🚀 Utilisation

### 1. **Publier un message**

```rust
if let Some(chat_manager) = &state.chat_ws_manager {
    let ws_message = ChatWsMessage {
        message_type: "reaction_added".to_string(),
        conversation_id: message_id.clone(),
        user_id: user.id,
        data: json!({...}),
        timestamp: chrono::Utc::now(),
        instance_id: None, // Ajouté automatiquement
    };
    chat_manager.broadcast_message(&message_id, ws_message).await;
}
```

### 2. **Types de messages**

- `reaction_added` : Réaction ajoutée à un message
- `reaction_removed` : Réaction supprimée d'un message
- `message` : Nouveau message de chat
- `typing` : Indicateur de frappe
- `read` : Message lu

---

## 📊 Métriques

Le système expose des métriques globales :

```rust
pub fn get_chat_ws_metrics_snapshot() -> ChatWsMetricsSnapshot {
    ChatWsMetricsSnapshot {
        connections_current: CHAT_WS_CONNECTIONS_CURRENT.load(Ordering::Relaxed),
        messages_sent_total: CHAT_WS_MESSAGES_SENT_TOTAL.load(Ordering::Relaxed),
        errors_total: CHAT_WS_ERRORS_TOTAL.load(Ordering::Relaxed),
    }
}
```

---

## ✅ Avantages

1. **Scaling horizontal** : Supporte plusieurs instances backend
2. **Haute disponibilité** : Si une instance tombe, les autres continuent
3. **Performance** : Broadcast local + Redis pub/sub pour distribution
4. **Sécurité** : Protection contre les boucles de messages
5. **Métriques** : Suivi des connexions et messages

---

## 🔍 Tests

### Test avec 2 instances

1. **Instance 1** : Démarrer sur port 3001
2. **Instance 2** : Démarrer sur port 3002
3. **Client A** : Se connecter à Instance 1
4. **Client B** : Se connecter à Instance 2
5. **Envoyer une réaction** : Client A ajoute une réaction
6. **Vérifier** : Client B reçoit la réaction via Redis pub/sub

### Vérification Redis

```bash
# Monitorer les publications Redis
redis-cli MONITOR

# Vérifier les abonnements
redis-cli PUBSUB CHANNELS "chat.messages.*"
```

---

## 📝 Notes

- **Channel Redis** : `chat.messages.{conversation_id}`
- **Pattern Redis** : `chat.messages.*` (pour psubscribe)
- **Buffer size** : 64 messages par défaut
- **Instance ID** : Généré automatiquement (UUID) si non défini

---

## 🎉 Résultat

✅ **Redis Pub/Sub implémenté et fonctionnel**  
✅ **Scaling horizontal prêt**  
✅ **Intégré avec les réactions**  
✅ **Protection contre les boucles**  
✅ **Métriques disponibles**

**Le système est maintenant prêt pour déployer plusieurs instances backend avec un load balancer !**

