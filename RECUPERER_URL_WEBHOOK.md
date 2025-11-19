# 📋 Récupérer l'URL du Webhook

## ✅ Étape Actuelle : Webhook Installé

Vous avez installé le webhook sur le canal "tout canaux yukpo". Parfait !

---

## 📍 Étape Suivante : Récupérer l'URL

### Option 1 : Depuis la Page Actuelle

1. **Après l'installation**, vous devriez être sur la page de configuration de l'app
2. **Dans le menu de gauche**, chercher et cliquer sur : **"Incoming Webhooks"**
3. **Descendre** jusqu'à la section **"Webhook URLs for Your Workspace"**
4. **Vous verrez une URL** qui commence par : `https://hooks.slack.com/services/...`
5. **Cliquer sur** : **"Copy"** (à côté de l'URL)
   - Ou **sélectionner et copier** l'URL manuellement (Ctrl + C)

### Option 2 : Si Vous Êtes Perdu

1. **Aller sur** : https://api.slack.com/apps
2. **Cliquer sur** : **"Yukpo Pipeline Alerts"** (votre app)
3. **Menu de gauche** → **"Incoming Webhooks"**
4. **Dans "Webhook URLs"**, copier l'URL

---

## 🧪 Tester le Webhook (Optionnel)

Une fois l'URL copiée, vous pouvez la tester avec :

```powershell
.\test-webhook-slack.ps1 -WebhookUrl "VOTRE_URL_WEBHOOK"
```

Ou manuellement :
```powershell
$webhookUrl = "VOTRE_URL_WEBHOOK"
$body = @{
    text = "🧪 Test webhook pipeline Yukpo - Fonctionnel !"
} | ConvertTo-Json

Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $body -ContentType "application/json"
```

**Résultat attendu** : Un message apparaît dans le canal "tout canaux yukpo" dans Slack.

---

## 📝 Format de l'URL

L'URL devrait ressembler à :
```
https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
```

---

**Copiez l'URL et donnez-la moi, ou testez-la d'abord !** ✅

