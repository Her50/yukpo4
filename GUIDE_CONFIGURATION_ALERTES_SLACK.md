# 🔔 Guide de Configuration des Alertes Slack

## 📋 Vue d'Ensemble

Le backend Yukpo est déjà configuré pour envoyer des alertes Slack automatiquement. Il suffit de configurer les webhooks Slack sur Render.

---

## 🎯 Types d'Alertes

### 1. Alertes Pipeline Vidéo

**Service** : `pipeline_health_worker.rs`

**Déclencheurs** :
- Pipeline change de statut (ok → degraded → critical)
- Jobs stale détectés
- Échecs de jobs vidéo

**Variable d'environnement** : `PIPELINE_ALERT_WEBHOOK`

### 2. Alertes SLA Delivery

**Service** : `delivery_sla_monitor.rs`

**Déclencheurs** :
- Livraisons en retard (SLA non respecté)
- Délais de livraison dépassés

**Variable d'environnement** : `SLA_ALERT_WEBHOOK`

---

## 🔧 Configuration sur Render

### Étape 1 : Créer un Webhook Slack

1. **Aller sur** : https://api.slack.com/apps
2. **Créer une nouvelle app** pour votre workspace
3. **Activer "Incoming Webhooks"** :
   - Menu gauche : **Features** → **Incoming Webhooks**
   - Activer "Activate Incoming Webhooks"
4. **Créer un webhook** :
   - Cliquer "Add New Webhook to Workspace"
   - Sélectionner le canal d'alertes (ex: `#yukpo-alerts`)
   - Cliquer "Allow"
5. **Copier l'URL du webhook** :
   - Format : `https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN`

### Étape 2 : Configurer sur Render

1. **Aller sur** : https://dashboard.render.com
2. **Sélectionner** votre service backend "yukpomnang"
3. **Onglet** : **Environment**
4. **Ajouter les variables** :

#### Pour les Alertes Pipeline

```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Secret: Oui (recommandé)
```

#### Pour les Alertes SLA Delivery

```
Variable: SLA_ALERT_WEBHOOK
Valeur: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Secret: Oui (recommandé)
```

#### Configuration Optionnelle SLA Monitor

```
Variable: SLA_MONITOR_INTERVAL_SECONDS
Valeur: 300
Description: Intervalle de vérification (défaut: 300s = 5 minutes)

Variable: SLA_MONITOR_LOOKBACK_MINUTES
Valeur: 30
Description: Période de lookback (défaut: 30 minutes)
```

### Étape 3 : Redéployer le Service

Après avoir ajouté les variables :
1. Render redéploiera automatiquement le service
2. Ou cliquer manuellement sur **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🧪 Tester les Alertes

### Test 1 : Alerte Pipeline

**Méthode manuelle** (pour tester) :
```bash
# Depuis le backend (si accès SSH)
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test alerte pipeline Yukpo",
    "username": "Yukpo Pipeline Monitor"
  }'
```

**Méthode automatique** :
- Attendre qu'un problème pipeline se produise
- Ou forcer un changement de statut (développement uniquement)

### Test 2 : Alerte SLA Delivery

**Méthode automatique** :
- Créer une livraison avec un SLA court
- Attendre que le délai soit dépassé
- L'alerte devrait être envoyée automatiquement

---

## 📊 Format des Alertes Slack

### Alerte Pipeline

```json
{
  "text": "🚨 Pipeline Vidéo - Statut: CRITICAL",
  "username": "Yukpo Pipeline Monitor",
  "icon_emoji": ":warning:",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Statut",
          "value": "CRITICAL",
          "short": true
        },
        {
          "title": "Jobs en file",
          "value": "25",
          "short": true
        },
        {
          "title": "Jobs failed",
          "value": "3",
          "short": true
        }
      ]
    }
  ]
}
```

### Alerte SLA Delivery

```json
{
  "text": "⚠️ Livraison en Retard - SLA Non Respecté",
  "username": "Yukpo Delivery Monitor",
  "icon_emoji": ":package:",
  "attachments": [
    {
      "color": "warning",
      "fields": [
        {
          "title": "Delivery ID",
          "value": "12345",
          "short": true
        },
        {
          "title": "Délai dépassé",
          "value": "15 minutes",
          "short": true
        }
      ]
    }
  ]
}
```

---

## 🔍 Vérification

### Vérifier que les Variables sont Configurées

1. **Sur Render** :
   - Dashboard → Service → Environment
   - Vérifier que `PIPELINE_ALERT_WEBHOOK` et `SLA_ALERT_WEBHOOK` sont présentes

2. **Dans les Logs** :
   - Dashboard → Service → Logs
   - Chercher : "Pipeline Health Worker started" ou "SLA Monitor started"
   - Si les webhooks sont configurés, vous verrez : "Slack webhook configured"

### Vérifier que les Alertes Fonctionnent

1. **Créer un canal de test** : `#yukpo-alerts-test`
2. **Configurer un webhook de test**
3. **Envoyer un test manuel**
4. **Vérifier que le message arrive dans Slack**

---

## 🛠️ Dépannage

### Problème : Alertes ne sont pas envoyées

**Solutions** :
1. Vérifier que les variables sont bien configurées sur Render
2. Vérifier que le webhook Slack est valide (tester manuellement)
3. Vérifier les logs du backend pour erreurs
4. Vérifier que le service est redéployé après ajout des variables

### Problème : Trop d'alertes

**Solutions** :
1. Ajuster `SLA_MONITOR_INTERVAL_SECONDS` (augmenter l'intervalle)
2. Ajuster `SLA_MONITOR_LOOKBACK_MINUTES` (réduire la période)
3. Filtrer les alertes dans le code backend (si nécessaire)

### Problème : Format des alertes incorrect

**Solutions** :
1. Vérifier le format JSON dans le code backend
2. Tester avec un webhook de test
3. Ajuster le format dans `pipeline_health_worker.rs` ou `delivery_sla_monitor.rs`

---

## 📝 Checklist

- [ ] Webhook Slack créé pour alertes pipeline
- [ ] Webhook Slack créé pour alertes SLA delivery
- [ ] Variable `PIPELINE_ALERT_WEBHOOK` configurée sur Render
- [ ] Variable `SLA_ALERT_WEBHOOK` configurée sur Render
- [ ] Variables marquées comme "Secret" sur Render
- [ ] Service redéployé après ajout des variables
- [ ] Test d'alerte effectué (message reçu dans Slack)
- [ ] Canal Slack configuré pour recevoir les alertes

---

## 🎯 Résultat Attendu

Une fois configuré, vous devriez recevoir automatiquement dans Slack :

1. **Alertes Pipeline** quand le pipeline vidéo change de statut ou rencontre des problèmes
2. **Alertes SLA Delivery** quand des livraisons sont en retard

**Canal recommandé** : `#yukpo-alerts` ou `#yukpo-monitoring`

---

**Configuration terminée ! Les alertes seront envoyées automatiquement.** ✅

