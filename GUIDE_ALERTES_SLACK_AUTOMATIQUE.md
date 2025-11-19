# 🔔 Guide Automatique - Configuration Alertes Slack

## ⚠️ Note Importante

**Je ne peux pas créer automatiquement les webhooks Slack** car cela nécessite :
- Accès à votre compte Slack
- Création d'une app Slack
- Autorisation du workspace

**Mais je peux vous guider étape par étape !**

---

## 🚀 Guide Étape par Étape (5 minutes)

### Étape 1 : Créer le Webhook Pipeline (2 minutes)

1. **Aller sur** : https://api.slack.com/apps
2. **Cliquer** : "Create New App" → "From scratch"
3. **Remplir** :
   - App Name: `Yukpo Pipeline Alerts`
   - Workspace: [Votre workspace]
   - Cliquer "Create App"

4. **Activer Incoming Webhooks** :
   - Menu gauche : **Features** → **Incoming Webhooks**
   - Activer "Activate Incoming Webhooks" (bouton toggle)

5. **Créer le webhook** :
   - Cliquer "Add New Webhook to Workspace"
   - Sélectionner le canal : `#yukpo-alerts` (ou créer le canal)
   - Cliquer "Allow"

6. **Copier l'URL du webhook** :
   - Format : `https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN`
   - **⚠️ SAUVEGARDER CETTE URL**

### Étape 2 : Créer le Webhook SLA Delivery (2 minutes)

**Répéter les étapes 1-6** pour créer un deuxième webhook :
- App Name: `Yukpo SLA Delivery Alerts`
- Même canal ou canal différent
- **⚠️ SAUVEGARDER CETTE URL**

### Étape 3 : Configurer sur Render (1 minute)

1. **Aller sur** : https://dashboard.render.com
2. **Sélectionner** : Service "yukpomnang" (backend)
3. **Onglet** : **Environment**
4. **Ajouter les variables** :

```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: [URL du webhook pipeline]
Secret: Oui ✅

Variable: SLA_ALERT_WEBHOOK
Valeur: [URL du webhook SLA delivery]
Secret: Oui ✅
```

5. **Redéployer** :
   - Render redéploiera automatiquement
   - Ou cliquer "Manual Deploy" → "Deploy latest commit"

### Étape 4 : Tester (Optionnel)

**Tester le webhook manuellement** :
```bash
curl -X POST [URL_DU_WEBHOOK] \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test alerte Yukpo - Pipeline"
  }'
```

Vous devriez voir le message dans Slack !

---

## 📝 Checklist

- [ ] Webhook Pipeline créé
- [ ] Webhook SLA Delivery créé
- [ ] URLs sauvegardées en sécurité
- [ ] Variables configurées sur Render
- [ ] Service redéployé
- [ ] Test effectué (optionnel)

---

## 🔒 Sécurité

**⚠️ IMPORTANT** :
- Les URLs de webhooks sont **sensibles** (ne pas partager publiquement)
- Marquer comme "Secret" sur Render
- Ne pas commiter dans Git

---

## 🎯 Résultat Attendu

Une fois configuré, vous recevrez automatiquement dans Slack :

1. **Alertes Pipeline** quand :
   - Pipeline change de statut (ok → degraded → critical)
   - Jobs stale détectés
   - Échecs de jobs vidéo

2. **Alertes SLA Delivery** quand :
   - Livraisons en retard
   - Délais de livraison dépassés

---

**Temps total : 5 minutes** ⏱️

