# 🔧 CLÉS I18N MANQUANTES - en.json

## ✅ ÉTAT ACTUEL

**Les clés de coaching trial ont été ajoutées avec succès** ✅
- `coachingSubscription`
- `coachingInsufficientMsg` 
- `coachingTrialEnded`
- `coachingTrialEndedMsg`
- `coachingTrialWelcome`
- `coachingTrialWelcomeMsg`

## ❌ CLÉS MANQUANTES - communityAlert

Les clés suivantes doivent être ajoutées dans la section `navPayment` après les clés de coaching :

```json
"communityAlert": {
    "newCheckpointTitle": "🚨 New checkpoint reported",
    "newCheckpointBody": "A user reported a checkpoint {{distance}}m away\n{{description}}",
    "speedAlertTitle": "⚡ Speed alert",
    "speedAlertBody": "Speed camera or police control {{distance}}m away\nSpeed limit: {{limit}} km/h",
    "dangerZoneTitle": "⚠️ Danger zone",
    "dangerZoneBody": "Hazardous area reported {{distance}}m away\n{{description}}",
    "trafficJamTitle": "🚗 Traffic jam",
    "trafficJamBody": "Heavy traffic {{distance}}m away\n{{description}}",
    "accidentTitle": "💥 Accident reported",
    "accidentBody": "Accident reported {{distance}}m away\n{{description}}",
    "policeTitle": "👮 Police control",
    "policeBody": "Police control {{distance}}m away\n{{description}}",
    "roadWorkTitle": "🚧 Road works",
    "roadWorkBody": "Road construction {{distance}}m away\n{{description}}",
    "weatherTitle": "🌧️ Weather alert",
    "weatherBody": "Dangerous weather conditions {{distance}}m away\n{{description}}",
    "soundCost": "Sound notification cost: {{cost}}",
    "soundInsufficient": "Insufficient balance for sound alert ({{cost}})",
    "soundPaymentFailed": "Sound alert payment failed"
}
```

## 📍 EMPLACEMENT EXACT

Dans `mobile/src/i18n/locales/en.json`, ajouter les clés ci-dessus après cette ligne :

```json
"coachingTrialWelcomeMsg": "Enjoy 7 days of free coaching!\n\nYou'll automatically receive:\n🌅 Morning motivation at 7am\n🏃 Activity reminder at 12:30pm\n🌙 Evening summary at 7pm\n📊 Weekly recap\n\nAfter the trial: only {{cost}}/month."
```

## 🔧 STRUCTURE FINALE ATTENDUE

```json
{
  "navPayment": {
    // ... autres clés existantes ...
    "coachingTrialWelcomeMsg": "Enjoy 7 days of free coaching!\n\nYou'll automatically receive:\n🌅 Morning motivation at 7am\n🏃 Activity reminder at 12:30pm\n🌙 Evening summary at 7pm\n📊 Weekly recap\n\nAfter the trial: only {{cost}}/month.",
    "communityAlert": {
        "newCheckpointTitle": "🚨 New checkpoint reported",
        "newCheckpointBody": "A user reported a checkpoint {{distance}}m away\n{{description}}",
        "speedAlertTitle": "⚡ Speed alert",
        "speedAlertBody": "Speed camera or police control {{distance}}m away\nSpeed limit: {{limit}} km/h",
        "dangerZoneTitle": "⚠️ Danger zone",
        "dangerZoneBody": "Hazardous area reported {{distance}}m away\n{{description}}",
        "trafficJamTitle": "🚗 Traffic jam",
        "trafficJamBody": "Heavy traffic {{distance}}m away\n{{description}}",
        "accidentTitle": "💥 Accident reported",
        "accidentBody": "Accident reported {{distance}}m away\n{{description}}",
        "policeTitle": "👮 Police control",
        "policeBody": "Police control {{distance}}m away\n{{description}}",
        "roadWorkTitle": "🚧 Road works",
        "roadWorkBody": "Road construction {{distance}}m away\n{{description}}",
        "weatherTitle": "🌧️ Weather alert",
        "weatherBody": "Dangerous weather conditions {{distance}}m away\n{{description}}",
        "soundCost": "Sound notification cost: {{cost}}",
        "soundInsufficient": "Insufficient balance for sound alert ({{cost}})",
        "soundPaymentFailed": "Sound alert payment failed"
    }
  },
  // ... autres sections ...
}
```

## ✅ VÉRIFICATION

Une fois ajoutées, les clés seront utilisées par :
- `CommunityAlertSoundService.ts` pour les messages d'alertes sonores
- Système de facturation pour les messages d'erreur
- Interface utilisateur pour l'affichage des coûts

## 🚀 ALTERNATIVE

Si le fichier en.json continue d'avoir des problèmes de sauvegarde, nous pouvons :
1. Créer un nouveau fichier `en_community_alerts.json` 
2. Importer dynamiquement ces clés dans le service
3. Ou utiliser les clés françaises comme fallback

---

**Le problème principal du fichier en.json semble être des conflits de sauvegarde. Les clés de coaching sont bien ajoutées, il ne manque que les clés communityAlert.**
