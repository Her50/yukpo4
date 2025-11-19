# ⚙️ Configuration Finale sur Render

## 📋 Variables Déjà Configurées

### ✅ Alertes SLA Delivery

Vous avez déjà configuré :
```bash
SLA_LOOKBACK_MINUTES=60
SLA_THRESHOLD_RATIO=1.10
SLA_PROMISED_MINUTES=30
SLA_MONITOR_INTERVAL_SECONDS=300
SLA_ALERT_WEBHOOK=YOUR_SLA_ALERT_WEBHOOK_URL
```

**✅ Alertes SLA Delivery : CONFIGURÉES**

---

## ⏳ Variables à Configurer

### 1. Alertes Pipeline Vidéo

**Variable manquante** :
```
PIPELINE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Action** :
1. Créer un webhook Slack pour les alertes pipeline
2. Configurer sur Render

### 2. Variables GPU

**Variables à ajouter** :
```
GPU_AVAILABLE=true
GPU_TYPE=nvidia
GPU_MEMORY_GB=16
```

---

## 🚀 Guide de Configuration Complète

### Étape 1 : Créer Webhook Slack pour Pipeline (2 minutes)

1. **Aller sur** : https://api.slack.com/apps
2. **Créer une nouvelle app** : "Yukpo Pipeline Alerts"
3. **Activer Incoming Webhooks**
4. **Créer un webhook** pour le canal `#yukpo-alerts` (ou le même canal que SLA)
5. **Copier l'URL du webhook**

### Étape 2 : Configurer sur Render (3 minutes)

1. **Aller sur** : https://dashboard.render.com
2. **Service "yukpomnang"** → **Environment**
3. **Ajouter les variables** :

#### Variables Slack

```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: [URL du webhook pipeline créé à l'étape 1]
Secret: Oui ✅
```

**Note** : Les autres variables SLA sont déjà configurées, vérifiez juste qu'elles sont bien présentes.

#### Variables GPU

```
Variable: GPU_AVAILABLE
Valeur: true
Secret: Non

Variable: GPU_TYPE
Valeur: nvidia
Secret: Non

Variable: GPU_MEMORY_GB
Valeur: 16
Secret: Non
```

### Étape 3 : Redéployer

- Render redéploiera automatiquement
- Ou cliquer "Manual Deploy" → "Deploy latest commit"

---

## ✅ Checklist Finale

### Alertes Slack
- [x] SLA_ALERT_WEBHOOK configuré
- [x] SLA_LOOKBACK_MINUTES configuré
- [x] SLA_THRESHOLD_RATIO configuré
- [x] SLA_PROMISED_MINUTES configuré
- [x] SLA_MONITOR_INTERVAL_SECONDS configuré
- [ ] **PIPELINE_ALERT_WEBHOOK à configurer** ⚠️

### Variables GPU
- [ ] GPU_AVAILABLE à configurer
- [ ] GPU_TYPE à configurer
- [ ] GPU_MEMORY_GB à configurer

---

## 🧪 Vérification Après Configuration

### Vérifier les Logs

**Sur Render** :
1. Dashboard → Service → Logs
2. Chercher :
   - `[PipelineWorker]` - Doit montrer les vérifications
   - `[DeliverySLA]` - Doit montrer les vérifications
   - Si webhooks configurés : `[PipelineWorker] Échec envoi webhook` ou succès

### Tester les Alertes

**Test Pipeline** :
- Attendre qu'un problème pipeline se produise
- Ou forcer un test (développement)

**Test SLA** :
- Créer une livraison avec SLA court
- Attendre que le délai soit dépassé
- Vérifier que l'alerte arrive dans Slack

---

## 📊 Résumé

### Déjà Configuré ✅
- Alertes SLA Delivery (5 variables)
- Code intégré et actif

### À Configurer ⏳
- **PIPELINE_ALERT_WEBHOOK** (1 variable Slack)
- **Variables GPU** (3 variables)

**Temps estimé** : 5 minutes

---

**Configuration presque terminée ! Il reste 4 variables à ajouter sur Render.** ✅

