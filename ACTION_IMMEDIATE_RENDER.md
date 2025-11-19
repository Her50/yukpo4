# ⚡ Action Immédiate - Configuration Render

## 🎯 Variables à Configurer sur Render

### 1. PIPELINE_ALERT_WEBHOOK (2 minutes)

**Action** :
1. Créer webhook Slack (voir guide ci-dessous)
2. Configurer sur Render

**Guide rapide** :
1. https://api.slack.com/apps → Create New App
2. Nom : "Yukpo Pipeline Alerts"
3. Activer "Incoming Webhooks"
4. Créer webhook pour canal `#yukpo-alerts`
5. Copier l'URL

**Sur Render** :
```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: [URL du webhook]
Secret: Oui
```

### 2. Variables GPU (1 minute)

**Sur Render** :
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

### 3. Redéployer (automatique)

Render redéploiera automatiquement après ajout des variables.

---

## ✅ Vérification

### Après Configuration

**Vérifier les logs Render** :
- Chercher `[PipelineWorker]` - Doit être actif
- Chercher `[DeliverySLA]` - Doit être actif
- Chercher `[GPUOptimizer]` - Doit montrer "Pipeline GPU activé"

**Temps total** : 5 minutes

