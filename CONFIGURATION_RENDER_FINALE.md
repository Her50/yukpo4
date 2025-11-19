# ⚙️ Configuration Finale sur Render

## ✅ Webhook Slack Récupéré

**URL du webhook** :
```
YOUR_SLACK_WEBHOOK_URL
```

**Canal** : `tout canaux yukpo`

---

## 🚀 Configuration sur Render

### Étape 1 : Aller sur Render

1. **Ouvrir** : https://dashboard.render.com
2. **Se connecter** avec votre compte
3. **Sélectionner** : Service "yukpomnang" (backend)
4. **Onglet** : **Environment** (Variables d'environnement)

### Étape 2 : Ajouter les Variables

**Ajouter les 4 variables suivantes** :

#### 1. Variable Slack Pipeline

```
Variable: PIPELINE_ALERT_WEBHOOK
Valeur: YOUR_SLACK_WEBHOOK_URL
Secret: Oui ✅
```

#### 2. Variables GPU

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

### Étape 3 : Sauvegarder

1. **Cliquer sur** : **"Save Changes"** (en bas)
2. **Render redéploiera automatiquement** le service
3. **Attendre** la fin du déploiement (2-3 minutes)

---

## ✅ Checklist

### Variables à Ajouter sur Render

- [ ] `PIPELINE_ALERT_WEBHOOK` = `YOUR_SLACK_WEBHOOK_URL` (Secret: Oui)
- [ ] `GPU_AVAILABLE` = `true` (Secret: Non)
- [ ] `GPU_TYPE` = `nvidia` (Secret: Non)
- [ ] `GPU_MEMORY_GB` = `16` (Secret: Non)

### Variables Déjà Configurées (Vérifier)

- [x] `SLA_ALERT_WEBHOOK` (déjà configuré)
- [x] `SLA_LOOKBACK_MINUTES=60`
- [x] `SLA_THRESHOLD_RATIO=1.10`
- [x] `SLA_PROMISED_MINUTES=30`
- [x] `SLA_MONITOR_INTERVAL_SECONDS=300`

---

## 🧪 Vérification Après Configuration

### 1. Vérifier les Logs Render

**Sur Render** :
1. Dashboard → Service → Logs
2. Chercher :
   - `[PipelineWorker]` - Doit montrer les vérifications
   - `[DeliverySLA]` - Doit montrer les vérifications
   - `[GPUOptimizer]` - Doit montrer "Pipeline GPU activé"

### 2. Tester les Alertes

**Test Pipeline** :
- Attendre qu'un problème pipeline se produise
- Ou vérifier les logs pour voir les vérifications automatiques

**Test SLA** :
- Créer une livraison avec SLA court
- Attendre que le délai soit dépassé
- Vérifier que l'alerte arrive dans Slack

---

## 📊 Résumé

### ✅ Terminé
- Webhook Slack créé et testé
- URL récupérée

### ⏳ À Faire (5 minutes)
- Configurer 4 variables sur Render
- Attendre le redéploiement
- Vérifier les logs

---

**Configuration presque terminée ! Ajoutez les 4 variables sur Render.** ✅

