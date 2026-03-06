# Configuration WhatsApp Business API

## Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env` et dans les secrets GCP :

```bash
# Activation du service WhatsApp
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio

# Configuration Twilio (déjà existante pour SMS)
TWILIO_ACCOUNT_SID=votre_account_sid
TWILIO_AUTH_TOKEN=votre_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+votre_numero_whatsapp

# Configuration webhook (optionnel)
WHATSAPP_WEBHOOK_URL=https://votre-domaine.com/api/whatsapp/webhook
WHATSAPP_DEFAULT_GROUP_ID=yukpo_main
```

## Configuration Twilio WhatsApp

1. **Créer un compte Twilio** si vous n'en avez pas déjà un
2. **Activer WhatsApp Business API** dans la console Twilio
3. **Configurer le numéro WhatsApp** :
   - Allez dans Messaging > Senders > WhatsApp Senders
   - Ajoutez votre numéro avec le format `whatsapp:+237XXXXXXXXX`

## Groupes configurés par défaut

Le système inclut 3 groupes automatiques :

### 1. Groupe Principal - YUKPO Support Client
- **ID**: `yukpo_main`
- **Mots-clés**: yukpo, support, aide, application, app, problème
- **Message de bienvenue**: "Bienvenue sur le support YUKPO ! Comment pouvons-nous vous aider ?"

### 2. Groupe Partenaires & Livreurs
- **ID**: `yukpo_partners` 
- **Mots-clés**: partenaire, livreur, livraison, devenir, collaboration, course
- **Message de bienvenue**: "Bienvenue dans l'espace partenaires YUKPO !"

### 3. Groupe Support Technique
- **ID**: `yukpo_tech`
- **Mots-clés**: bug, erreur, technique, plantage, problème technique, développeur
- **Message de bienvenue**: "Bienvenue sur le support technique YUKPO !"

## Endpoints API

### GET /api/whatsapp/status
Vérifie le statut du service WhatsApp et liste les groupes configurés.

### POST /api/whatsapp/send
Envoie un message manuellement (pour les tests).
```json
{
  "to": "+237123456789",
  "message": "Message de test"
}
```

### POST /api/whatsapp/webhook
Reçoit les webhooks de Twilio WhatsApp.

### GET /api/whatsapp/groups
Liste tous les groupes configurés.

## Configuration du Webhook Twilio

1. **Configurez le webhook** dans la console Twilio :
   - URL: `https://votre-backend-url.com/api/whatsapp/webhook`
   - Méthode: POST
   - Activer "Incoming Messages"

2. **Configurez les webhooks de statut** (optionnel) :
   - URL: `https://votre-backend-url.com/api/whatsapp/webhook`
   - Activer "Message Status"

## Test du système

### 1. Vérifier la configuration
```bash
curl -X GET https://votre-backend-url.com/api/whatsapp/status
```

### 2. Envoyer un message de test
```bash
curl -X POST https://votre-backend-url.com/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+237123456789",
    "message": "support yukpo"
  }'
```

Le message sera automatiquement routé vers le groupe "yukpo_main" et le contact recevra le message de bienvenue.

## Personnalisation des groupes

Pour ajouter ou modifier des groupes, éditez le fichier `whatsapp_service.rs` dans la fonction `WhatsAppRoutingService::new()`.

### Exemple d'ajout de groupe :
```rust
groups.insert("yukpo_ventes".to_string(), WhatsAppGroup {
    group_id: "yukpo_ventes".to_string(),
    group_name: "YUKPO - Équipe Ventes".to_string(),
    description: "Groupe pour l'équipe commerciale".to_string(),
    keywords: vec![
        "vente".to_string(), "commercial".to_string(), "prix".to_string(),
        "tarif".to_string(), "devis".to_string(), "facturation".to_string()
    ],
    auto_add_keywords: true,
    welcome_message: Some("Bienvenue dans l'espace commercial YUKPO !".to_string()),
});
```

## Déploiement

1. **Ajoutez les variables d'environnement** dans GCP Secret Manager
2. **Déployez le backend** avec les nouvelles routes WhatsApp
3. **Configurez le webhook** dans la console Twilio
4. **Testez avec un message** pour vérifier le routage automatique

## Sécurité

- Le webhook ne traite que les messages provenant de Twilio
- Les numéros sont automatiquement formatés (suppression des espaces, +, etc.)
- Les logs détaillés permettent de tracer tous les messages

## Monitoring

Les logs incluent :
- `[WhatsAppService] 📱` pour les envois
- `[WhatsAppRouting] 🎯` pour les décisions de routage
- `[WhatsAppService] 📥` pour les webhooks reçus

Consultez les logs Cloud Run pour surveiller l'activité WhatsApp.
