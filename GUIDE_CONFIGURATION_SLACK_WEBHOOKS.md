# 🔗 Guide Configuration Slack Webhooks pour Alertes Métriques

## 📋 Vue d'ensemble

Ce guide explique comment configurer les webhooks Slack pour recevoir les alertes métriques depuis Prometheus/AlertManager et le backend Yukpomnang.

## 🎯 Canaux Slack Requis

Vous devez créer **3 canaux Slack** pour organiser les alertes :

1. **`#yukpo-alerts-critical`** : Alertes critiques (pipeline vidéo en panne, base de données saturée, etc.)
2. **`#yukpo-alerts`** : Alertes warning (dégradations, performances, etc.)
3. **`#yukpo-ux-metrics`** : Métriques UX (chat, scroll, navigation) - Informations, pas des alertes

## 📝 Étape 1 : Créer les Canaux Slack

1. Ouvrir Slack
2. Cliquer sur **"+"** à côté de "Channels" dans la barre latérale
3. Créer les 3 canaux :
   - `yukpo-alerts-critical`
   - `yukpo-alerts`
   - `yukpo-ux-metrics`

## 🔧 Étape 2 : Créer une App Slack

1. Aller sur https://api.slack.com/apps
2. Cliquer sur **"Create New App"**
3. Choisir **"From scratch"**
4. Remplir :
   - **App Name** : `Yukpomnang Alerts`
   - **Workspace** : Sélectionner votre workspace
5. Cliquer sur **"Create App"**

## 🔗 Étape 3 : Activer Incoming Webhooks

1. Dans la page de votre app, aller dans **"Incoming Webhooks"** (menu de gauche)
2. Activer **"Activate Incoming Webhooks"** (bouton toggle)
3. Cliquer sur **"Add New Webhook to Workspace"**
4. Sélectionner le canal **`#yukpo-alerts-critical`**
5. Cliquer sur **"Allow"**
6. **Copier l'URL du webhook** (format : `https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN`)

**Répéter pour les 2 autres canaux** :
- `#yukpo-alerts`
- `#yukpo-ux-metrics`

Vous devriez avoir **3 URLs de webhook** différentes.

## ⚙️ Étape 4 : Configurer les Variables d'Environnement

### Sur Render (Backend)

1. Aller sur https://dashboard.render.com
2. Sélectionner votre service backend
3. Aller dans **"Environment"**
4. Ajouter les variables suivantes :

```bash
# Webhook Slack pour AlertManager (utilisé par Prometheus/AlertManager)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhooks existants (déjà utilisés dans le code backend)
PIPELINE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Note** : Pour `SLACK_WEBHOOK_URL`, vous pouvez utiliser l'URL du canal `#yukpo-alerts` (canal par défaut). AlertManager utilisera les canaux spécifiques configurés dans `alertmanager.yml`.

### Sur Hetzner (AlertManager)

Si vous déployez AlertManager sur Hetzner via Docker :

1. Modifier `docker-compose.cloud.yml` pour passer la variable d'environnement :

```yaml
alertmanager:
  image: prom/alertmanager:latest
  environment:
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
  volumes:
    - ./backend/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
```

2. Ou créer un fichier `.env` sur le serveur Hetzner :

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

3. Modifier `backend/monitoring/alertmanager.yml` pour utiliser la variable :

```yaml
global:
  slack_api_url: '${SLACK_WEBHOOK_URL}'
```

**Note** : AlertManager utilise `slack_api_url` pour tous les canaux. Les canaux spécifiques sont définis dans la configuration des receivers.

## 🧪 Étape 5 : Tester les Webhooks

### Test 1 : Tester depuis Slack

1. Dans Slack, aller dans le canal `#yukpo-alerts-critical`
2. Taper `/invite @Yukpomnang Alerts` pour inviter le bot
3. Le bot devrait apparaître dans le canal

### Test 2 : Tester depuis curl

```bash
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🧪 Test webhook Slack - Yukpomnang Alerts"
  }'
```

Vous devriez voir le message apparaître dans le canal Slack.

### Test 3 : Tester depuis AlertManager

1. Accéder à AlertManager : `http://46.224.14.85:9093`
2. Aller dans **"Alerts"**
3. Cliquer sur **"Create Alert"** ou utiliser l'API pour créer une alerte de test
4. Vérifier que l'alerte arrive dans Slack

### Test 4 : Tester depuis le Backend

Le backend envoie déjà des alertes via `PIPELINE_ALERT_WEBHOOK` et `SLA_ALERT_WEBHOOK`. Pour tester :

1. Déclencher manuellement une condition d'alerte (ex: simuler un échec de pipeline)
2. Vérifier que l'alerte arrive dans Slack

## 📊 Format des Messages Slack

### Alertes Critiques

```
🚨 ALERTE CRITIQUE - Yukpomnang
Le pipeline vidéo est en état critique depuis 5m. Jobs en file: 45

Instance: yukpo-backend-render
Service: video_pipeline
Environnement: production
```

### Alertes Warning

```
⚠️ ALERTE WARNING - Yukpomnang
Le pipeline vidéo est dégradé depuis 10m. Vérifier les jobs en attente.

Instance: yukpo-backend-render
Service: video_pipeline
```

### Métriques UX

```
📊 MÉTRIQUES UX - Yukpomnang
Volume élevé de scroll produits: 52 scrolls/min sur les carrousels produits

Métrique: product_carousel_scrolls_total
Valeur: 52
Seuil: 50/min
```

## 🔒 Sécurité

### Protection des Webhooks

Les webhooks Slack sont publics (pas d'authentification par défaut). Pour sécuriser :

1. **Ne pas partager les URLs publiquement**
2. **Utiliser des variables d'environnement** (jamais hardcodé dans le code)
3. **Rotater les webhooks** régulièrement (créer de nouveaux webhooks et supprimer les anciens)

### Rotation des Webhooks

1. Créer un nouveau webhook dans Slack
2. Mettre à jour la variable d'environnement
3. Redémarrer le service (Render/Hetzner)
4. Vérifier que les alertes arrivent
5. Supprimer l'ancien webhook dans Slack

## 🐛 Dépannage

### Les alertes n'arrivent pas dans Slack

1. **Vérifier que le webhook est actif** :
   - Aller dans https://api.slack.com/apps
   - Vérifier que "Incoming Webhooks" est activé
   - Vérifier que le webhook est dans le bon canal

2. **Vérifier les variables d'environnement** :
   - Sur Render : Vérifier que `SLACK_WEBHOOK_URL` est bien configuré
   - Sur Hetzner : Vérifier que la variable est passée au conteneur AlertManager

3. **Vérifier les logs** :
   - Backend : Vérifier les logs pour voir si les requêtes sont envoyées
   - AlertManager : Vérifier les logs du conteneur Docker

4. **Tester le webhook manuellement** :
   ```bash
   curl -X POST YOUR_WEBHOOK_URL -d '{"text":"test"}'
   ```

### Les alertes arrivent dans le mauvais canal

1. Vérifier la configuration dans `backend/monitoring/alertmanager.yml`
2. Vérifier que les noms de canaux correspondent exactement (sensible à la casse)
3. Vérifier que le webhook est bien configuré pour le bon canal dans Slack

### Format des messages incorrect

1. Vérifier les templates dans `backend/monitoring/alertmanager.yml`
2. Vérifier que les champs sont bien remplis dans les règles d'alertes (`prometheus_alerts.yml`)

## 📚 Ressources

- **Documentation Slack Incoming Webhooks** : https://api.slack.com/messaging/webhooks
- **Documentation AlertManager** : https://prometheus.io/docs/alerting/latest/alertmanager/
- **Configuration AlertManager** : `backend/monitoring/alertmanager.yml`
- **Règles d'alertes** : `backend/monitoring/prometheus_alerts.yml`

## ✅ Checklist de Configuration

- [ ] Canaux Slack créés (`#yukpo-alerts-critical`, `#yukpo-alerts`, `#yukpo-ux-metrics`)
- [ ] App Slack créée
- [ ] Incoming Webhooks activés
- [ ] 3 webhooks créés (un par canal)
- [ ] URLs de webhooks copiées
- [ ] Variables d'environnement configurées sur Render
- [ ] Variables d'environnement configurées sur Hetzner (si applicable)
- [ ] Webhooks testés avec curl
- [ ] AlertManager configuré et testé
- [ ] Alertes de test reçues dans Slack

---

**Document créé le** : 2025-01-17  
**Dernière mise à jour** : 2025-01-17  
**Auteur** : Équipe Technique Yukpomnang

