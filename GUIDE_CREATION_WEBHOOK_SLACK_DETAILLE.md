# 🔔 Guide Détaillé - Création Webhook Slack pour Alertes Pipeline

## 🎯 Objectif

Créer un webhook Slack pour recevoir les alertes du pipeline vidéo dans votre workspace `yukpo_Ops`.

---

## 📋 Étape par Étape

### Étape 1 : Accéder à l'API Slack

1. **Ouvrir votre navigateur**
2. **Aller sur** : https://api.slack.com/apps
3. **Se connecter** avec votre compte Slack (workspace `yukpo_Ops`)

### Étape 2 : Créer une Nouvelle App

1. **Cliquer** sur le bouton **"Create New App"** (en haut à droite)
2. **Sélectionner** : **"From scratch"**
3. **Remplir le formulaire** :
   - **App Name** : `Yukpo Pipeline Alerts`
   - **Pick a workspace** : Sélectionner `yukpo_Ops`
4. **Cliquer** sur **"Create App"**

### Étape 3 : Activer Incoming Webhooks

1. **Dans le menu de gauche**, cliquer sur **"Incoming Webhooks"**
2. **Activer** le toggle **"Activate Incoming Webhooks"** (en haut)
3. Le toggle doit passer à **"On"** (vert)

### Étape 4 : Créer le Webhook

1. **Descendre** jusqu'à la section **"Webhook URLs for Your Workspace"**
2. **Cliquer** sur le bouton **"Add New Webhook to Workspace"**
3. **Sélectionner le canal** :
   - Option A : Utiliser le canal existant `#yukpo-alerts` (si il existe)
   - Option B : Créer un nouveau canal `#yukpo-pipeline-alerts`
   - Option C : Utiliser un canal général comme `#general` ou `#ops`
4. **Cliquer** sur **"Allow"**

### Étape 5 : Copier l'URL du Webhook

1. **L'URL du webhook s'affiche** dans la section "Webhook URLs"
2. **Format** : `https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN`
3. **⚠️ IMPORTANT** : Copier cette URL complète (elle commence par `https://hooks.slack.com/services/`)

### Étape 6 : Tester le Webhook (Optionnel mais Recommandé)

**Tester avec curl** :
```bash
curl -X POST [VOTRE_URL_WEBHOOK] \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test alerte pipeline Yukpo - Webhook fonctionnel !"
  }'
```

**Ou tester depuis PowerShell** :
```powershell
$webhookUrl = "VOTRE_URL_WEBHOOK"
$body = @{
    text = "Test alerte pipeline Yukpo - Webhook fonctionnel !"
} | ConvertTo-Json

Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $body -ContentType "application/json"
```

**Résultat attendu** : Un message apparaît dans le canal Slack sélectionné.

---

## 🔧 Configuration sur Render

### Après avoir créé le webhook

1. **Aller sur** : https://dashboard.render.com
2. **Sélectionner** : Service "yukpomnang" (backend)
3. **Onglet** : **Environment**
4. **Ajouter la variable** :

```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: [COLLER L'URL DU WEBHOOK ICI]
Secret: Oui ✅
```

5. **Cliquer** sur **"Save Changes"**
6. **Render redéploiera automatiquement**

---

## 📊 Utilisation du Workspace Existant `yukpo_Ops`

### Avantages

✅ **Workspace déjà configuré** : Pas besoin de créer un nouveau workspace
✅ **Équipe déjà présente** : Les membres peuvent voir les alertes
✅ **Organisation** : Toutes les alertes Yukpo au même endroit

### Recommandation de Canaux

**Option 1 : Canal dédié** (Recommandé)
- Créer `#yukpo-pipeline-alerts` pour les alertes pipeline
- Garder `#yukpo-alerts` pour les alertes SLA delivery
- **Avantage** : Séparation claire des types d'alertes

**Option 2 : Canal unifié**
- Utiliser le même canal `#yukpo-alerts` pour toutes les alertes
- **Avantage** : Toutes les alertes au même endroit

**Option 3 : Canal général**
- Utiliser `#ops` ou `#general`
- **Avantage** : Visible par toute l'équipe

---

## 🧪 Test Complet

### Test 1 : Test du Webhook

```powershell
# Remplacer par votre URL de webhook
$webhookUrl = "https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN"

$testMessage = @{
    text = "🧪 Test webhook pipeline Yukpo"
    username = "Yukpo Pipeline Monitor"
    icon_emoji = ":warning:"
} | ConvertTo-Json

Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $testMessage -ContentType "application/json"
```

### Test 2 : Vérifier sur Render

**Après configuration** :
1. Attendre le redéploiement
2. Vérifier les logs Render
3. Chercher : `[PipelineWorker]`
4. Si un problème se produit, l'alerte devrait arriver dans Slack

---

## 📝 Format des Alertes

### Alerte Pipeline (automatique)

Quand le pipeline change de statut, vous recevrez dans Slack :

```json
{
  "type": "pipeline-alert",
  "status": "degraded|critical",
  "timestamp": "2025-11-18T...",
  "job_queue": {
    "queued": 10,
    "running": 2,
    "completed_last_24h": 50,
    "failed_last_24h": 3,
    "stale_jobs": 2
  }
}
```

### Alerte de Récupération

Quand le pipeline revient à OK :

```json
{
  "type": "pipeline-recovery",
  "status": "ok",
  "queued": 5,
  "running": 1
}
```

---

## ✅ Checklist

- [ ] App Slack créée : "Yukpo Pipeline Alerts"
- [ ] Incoming Webhooks activé
- [ ] Webhook créé pour le canal choisi
- [ ] URL du webhook copiée
- [ ] Test du webhook effectué (message reçu dans Slack)
- [ ] Variable `PIPELINE_ALERT_WEBHOOK` configurée sur Render
- [ ] Service Render redéployé
- [ ] Logs vérifiés (worker actif)

---

## 🔒 Sécurité

**⚠️ IMPORTANT** :
- L'URL du webhook est **sensible** (ne pas partager publiquement)
- Marquer comme "Secret" sur Render
- Ne pas commiter dans Git
- Si compromis, révoquer et recréer le webhook

---

## 🎯 Résultat Attendu

Une fois configuré, vous recevrez automatiquement dans Slack :

1. **Alertes Pipeline** quand :
   - Pipeline change de statut (ok → degraded → critical)
   - Jobs stale détectés
   - Échecs de jobs vidéo

2. **Alertes de Récupération** quand :
   - Pipeline revient à OK

**Canal** : Le canal que vous avez choisi dans `yukpo_Ops`

---

**Guide prêt ! Suivez les étapes ci-dessus pour créer le webhook.** ✅

