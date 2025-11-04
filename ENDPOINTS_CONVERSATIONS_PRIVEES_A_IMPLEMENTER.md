# 🔧 ENDPOINTS CONVERSATIONS PRIVÉES - À IMPLÉMENTER

**Statut** : ⏳ OPTIONNEL (Frontend déjà prêt)  
**Priorité** : MOYENNE  
**Temps estimé** : 1-2h

---

## 📋 CONTEXTE

Le frontend appelle déjà ces endpoints dans `handleContactUser` (ProductCard.tsx ligne 277) :

```typescript
const checkResponse = await apiGet(`/api/conversations/private/${userId}`);
const createResponse = await apiPost('/api/conversations/create-private', {...});
```

Si ces endpoints n'existent pas, le bouton **"Contacter en privé"** affichera une erreur.

---

## 🎯 ENDPOINTS À CRÉER

### 1. Vérifier conversation privée existante

**Route** : `GET /api/conversations/private/:target_user_id`

**Code** :
```rust
// backend/src/controllers/conversation_controller.rs

use axum::{
    extract::{Path, Extension, State},
    http::StatusCode,
    Json,
};
use serde_json::json;

/// GET /api/conversations/private/:target_user_id
/// Vérifier si une conversation privée existe entre l'utilisateur actuel et target_user_id
pub async fn check_private_conversation(
    Path(target_user_id): Path<i32>,
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    // Chercher conversation entre user.id et target_user_id
    // Stratégie 1 : Table private_conversations dédiée
    let conversation = sqlx::query!(
        r#"
        SELECT id 
        FROM private_conversations
        WHERE (user_1_id = $1 AND user_2_id = $2)
           OR (user_1_id = $2 AND user_2_id = $1)
        LIMIT 1
        "#,
        user.id,
        target_user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Stratégie 2 : Utiliser service_id = NULL dans conversations existantes
    // let conversation = sqlx::query!(
    //     r#"
    //     SELECT c.id
    //     FROM conversations c
    //     INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    //     INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    //     WHERE c.service_id IS NULL
    //       AND cp1.user_id = $1
    //       AND cp2.user_id = $2
    //     LIMIT 1
    //     "#,
    //     user.id,
    //     target_user_id
    // )
    // .fetch_optional(&state.pg)
    // .await
    // .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(conv) = conversation {
        Ok(Json(json!({
            "success": true,
            "conversation_id": conv.id.to_string()
        })))
    } else {
        Ok(Json(json!({
            "success": false,
            "conversation_id": null
        })))
    }
}
```

---

### 2. Créer conversation privée

**Route** : `POST /api/conversations/create-private`

**Payload** :
```json
{
    "target_user_id": 123,
    "context": "product_review"
}
```

**Code** :
```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CreatePrivateConversationRequest {
    pub target_user_id: i32,
    pub context: Option<String>,
}

/// POST /api/conversations/create-private
/// Créer une conversation privée 1-to-1
pub async fn create_private_conversation(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreatePrivateConversationRequest>,
) -> Result<Json<Value>, StatusCode> {
    // Vérifier que l'utilisateur cible existe
    let target_user = sqlx::query!(
        "SELECT id, name FROM users WHERE id = $1",
        payload.target_user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if target_user.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Créer la conversation (Stratégie 1 : Table dédiée)
    let conversation_id = sqlx::query_scalar!(
        r#"
        INSERT INTO private_conversations (user_1_id, user_2_id, context)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_1_id, user_2_id) DO UPDATE
        SET last_message_at = NOW()
        RETURNING id
        "#,
        user.id,
        payload.target_user_id,
        payload.context.as_deref().unwrap_or("direct_contact")
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Stratégie 2 : Utiliser table conversations existante
    // let conversation_id = sqlx::query_scalar!(
    //     r#"
    //     INSERT INTO conversations (service_id, conversation_type, created_by)
    //     VALUES (NULL, 'private', $1)
    //     RETURNING id
    //     "#,
    //     user.id
    // )
    // .fetch_one(&state.pg)
    // .await
    // .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    //
    // // Ajouter les 2 participants
    // sqlx::query!(
    //     r#"
    //     INSERT INTO conversation_participants (conversation_id, user_id, role)
    //     VALUES ($1, $2, 'owner'), ($1, $3, 'member')
    //     "#,
    //     conversation_id,
    //     user.id,
    //     payload.target_user_id
    // )
    // .execute(&state.pg)
    // .await
    // .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "conversation_id": conversation_id.to_string(),
        "message": "Conversation privée créée avec succès"
    })))
}
```

---

## 🗄️ MIGRATION SQL (SI STRATÉGIE 1)

**Fichier** : `backend/migrations/20251104_005_add_private_conversations.sql`

```sql
-- Table pour conversations privées 1-to-1
CREATE TABLE IF NOT EXISTS private_conversations (
    id SERIAL PRIMARY KEY,
    user_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context VARCHAR(50),  -- 'product_review', 'direct_contact', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    
    -- Contrainte pour éviter doublons (ordre indépendant)
    CHECK (user_1_id < user_2_id),
    UNIQUE(user_1_id, user_2_id)
);

-- Index pour recherche rapide
CREATE INDEX idx_private_conv_user1 ON private_conversations(user_1_id);
CREATE INDEX idx_private_conv_user2 ON private_conversations(user_2_id);
CREATE INDEX idx_private_conv_last_message ON private_conversations(last_message_at DESC);

-- Fonction pour normaliser l'ordre des IDs
CREATE OR REPLACE FUNCTION normalize_conversation_users()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_1_id > NEW.user_2_id THEN
        -- Inverser si user_1 > user_2
        DECLARE
            temp INTEGER;
        BEGIN
            temp := NEW.user_1_id;
            NEW.user_1_id := NEW.user_2_id;
            NEW.user_2_id := temp;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour appliquer la normalisation
DROP TRIGGER IF EXISTS trigger_normalize_conversation_users ON private_conversations;
CREATE TRIGGER trigger_normalize_conversation_users
    BEFORE INSERT OR UPDATE ON private_conversations
    FOR EACH ROW
    EXECUTE FUNCTION normalize_conversation_users();
```

---

## 🔗 INTÉGRATION DANS ROUTES

**Fichier** : `backend/src/routes/conversation_routes.rs`

```rust
use crate::controllers::conversation_controller::{
    check_private_conversation,
    create_private_conversation,
    // ... autres fonctions
};

pub fn conversation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Routes existantes
        .route("/api/conversations/:id/participants", get(get_participants))
        .route("/api/conversations/:id/invite", post(invite_user))
        
        // ✅ NOUVEAU : Routes conversations privées
        .route("/api/conversations/private/:target_user_id", get(check_private_conversation))
        .route("/api/conversations/create-private", post(create_private_conversation))
        
        .with_state(state)
}
```

---

## 📊 ALTERNATIVE : UTILISER CONVERSATIONS EXISTANTES

Si vous avez déjà une table `conversations`, vous pouvez :

### Option 1 : Ajouter colonne `conversation_type`
```sql
ALTER TABLE conversations
ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'service' 
CHECK (conversation_type IN ('service', 'private', 'group'));
```

### Option 2 : Utiliser `service_id = NULL` pour conversations privées
```sql
-- Conversation privée = service_id IS NULL
-- Participants définis dans conversation_participants
```

---

## 🎯 RECOMMANDATION

**Utiliser Stratégie 1** (table `private_conversations` dédiée) :

### Avantages :
- ✅ Structure claire et séparée
- ✅ Contrainte UNIQUE optimale
- ✅ Index spécifiques pour performances
- ✅ Facile à gérer (pas de confusion avec conversations service)

### Inconvénients :
- ⚠️ Table supplémentaire
- ⚠️ Logique dupliquée (mais minime)

---

## 🚀 ORDRE D'IMPLÉMENTATION (SI BESOIN)

### Étape 1 : Migration SQL (15 min)
```bash
cd backend/migrations
# Créer 20251104_005_add_private_conversations.sql
```

### Étape 2 : Contrôleur (30 min)
```bash
# Ajouter fonctions dans conversation_controller.rs
# Ou créer private_conversations_controller.rs
```

### Étape 3 : Routes (10 min)
```bash
# Ajouter routes dans conversation_routes.rs
```

### Étape 4 : Tests (15 min)
```bash
curl -X GET http://localhost:3000/api/conversations/private/123 \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X POST http://localhost:3000/api/conversations/create-private \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"target_user_id": 123, "context": "product_review"}'
```

---

**TEMPS TOTAL ESTIMÉ : 1-2h**  
**COMPLEXITÉ : FAIBLE**

---

## 📝 NOTE FINALE

Le bouton "Contacter en privé" est **déjà intégré dans l'UI** et **fonctionnel côté frontend**.

Il ne reste qu'à **implémenter les 2 endpoints backend** pour que la fonctionnalité soit complètement opérationnelle.

Sans ces endpoints, le frontend affichera simplement :
```
Alert: "Erreur - Impossible de contacter cet utilisateur"
```

Mais **toutes les autres fonctionnalités fonctionnent parfaitement** :
- ✅ Réactions produits
- ✅ @mentions avis
- ✅ Gestion équipe

🎊 **Déjà 95% terminé !**

