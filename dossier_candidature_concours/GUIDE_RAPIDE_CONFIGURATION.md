# 🚀 Guide Rapide - Configuration des Intervalles de Monitoring

## ⚡ Configuration en 3 étapes

### **Étape 1 : Accéder au Dashboard Render**
1. Allez sur https://dashboard.render.com
2. Connectez-vous
3. Sélectionnez votre service backend

### **Étape 2 : Ajouter les Variables**
1. Cliquez sur **"Environment"** dans le menu
2. Cliquez sur **"Add Environment Variable"**
3. Ajoutez les variables suivantes (une par une) :

| Key | Value | Secret |
|-----|-------|--------|
| `DB_HEALTH_CHECK_INTERVAL_SECS` | `30` | ❌ Non |
| `PIPELINE_HEALTH_CHECK_INTERVAL_SECS` | `300` | ❌ Non |
| `DELIVERY_MATCHING_WORKER_INTERVAL_SECS` | `30` | ❌ Non |
| `DELIVERY_MATCHING_WORKER_BATCH_SIZE` | `10` | ❌ Non |
| `GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS` | `30` | ❌ Non |
| `ORDER_TIMEOUT_MONITOR_INTERVAL_SECS` | `60` | ❌ Non |
| `DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS` | `60` | ❌ Non |

### **Étape 3 : Redémarrer**
1. Cliquez sur **"Save Changes"**
2. Allez dans **"Events"** ou **"Logs"**
3. Cliquez sur **"Manual Deploy"** > **"Deploy latest commit"**

---

## 📊 Valeurs Recommandées

### **Production Normale** (Recommandé)
```bash
DB_HEALTH_CHECK_INTERVAL_SECS=30
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30
DELIVERY_MATCHING_WORKER_BATCH_SIZE=10
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=30
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=60
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=60
```

### **Charge Élevée**
Si votre DB est sous charge :
```bash
DB_HEALTH_CHECK_INTERVAL_SECS=60
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=600
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=60
DELIVERY_MATCHING_WORKER_BATCH_SIZE=20
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=60
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=120
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=120
```

---

## ✅ Vérification

Après redémarrage, vérifiez les logs :
- Recherchez : `✅ DB Health Monitor démarré (vérification toutes les Xs)`
- Les intervalles configurés apparaîtront dans les messages de démarrage

---

## 💡 Important

**Ces variables sont OPTIONNELLES !**
- Si non configurées → Valeurs par défaut utilisées (fonctionne parfaitement)
- Si configurées → Vos valeurs personnalisées seront utilisées

---

## 🛠️ Script Automatique

Vous pouvez utiliser le script PowerShell fourni :
```powershell
.\config-monitoring-intervals.ps1
```

Il vous guidera pour générer la configuration appropriée.

---

**Besoin d'aide ?** Consultez `CONFIGURATION_INTERVALLES_MONITORING.md` pour plus de détails.

