# 🔧 Configuration des Intervalles de Monitoring

## 📋 Vue d'ensemble

Ce guide vous aide à configurer les variables d'environnement pour ajuster les intervalles de monitoring de votre application backend sur Render.com.

**Toutes ces variables sont optionnelles** - si elles ne sont pas définies, les valeurs par défaut seront utilisées.

---

## 🎯 Variables disponibles

### 1. **DB Health Monitor**
- **Variable**: `DB_HEALTH_CHECK_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Description**: Intervalle de vérification de la santé du pool de connexions PostgreSQL
- **Fichier**: `backend/src/utils/db_monitor.rs`

### 2. **Pipeline Health Worker**
- **Variable**: `PIPELINE_HEALTH_CHECK_INTERVAL_SECS`
- **Défaut**: `300` secondes (5 minutes)
- **Description**: Intervalle de vérification de la santé du pipeline de génération vidéo
- **Fichier**: `backend/src/tasks/pipeline_health_worker.rs`

### 3. **Delivery Matching Worker**
- **Variable**: `DELIVERY_MATCHING_WORKER_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Description**: Intervalle de traitement de la file d'attente de matching des livraisons
- **Variable**: `DELIVERY_MATCHING_WORKER_BATCH_SIZE`
- **Défaut**: `10`
- **Description**: Nombre de livraisons traitées par batch
- **Fichier**: `backend/src/tasks/delivery_matching_worker.rs`

### 4. **Global Promo Scheduler**
- **Variable**: `GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Description**: Intervalle de traitement des événements promotionnels globaux
- **Fichier**: `backend/src/tasks/global_promo_scheduler.rs`

### 5. **Order Timeout Monitor**
- **Variable**: `ORDER_TIMEOUT_MONITOR_INTERVAL_SECS`
- **Défaut**: `60` secondes
- **Description**: Intervalle de vérification des commandes expirées
- **Fichier**: `backend/src/tasks/order_timeout_monitor.rs`

### 6. **Delivery Timeout Monitor**
- **Variable**: `DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS`
- **Défaut**: `60` secondes
- **Description**: Intervalle de vérification des livraisons en timeout
- **Fichier**: `backend/src/tasks/delivery_timeout_monitor.rs`

---

## 🚀 Configuration sur Render.com

### **Méthode 1 : Via le Dashboard Render (Recommandé)**

#### Étape 1 : Accéder au Dashboard
1. Allez sur https://dashboard.render.com
2. Connectez-vous à votre compte
3. Sélectionnez votre service backend **"yukpomnang"** (ou le nom de votre service)

#### Étape 2 : Accéder aux Variables d'Environnement
1. Dans le menu latéral, cliquez sur **"Environment"**
2. Vous verrez la liste des variables d'environnement existantes

#### Étape 3 : Ajouter les Variables
Pour chaque variable que vous souhaitez configurer :

1. Cliquez sur **"Add Environment Variable"**
2. Entrez le **Key** (nom de la variable)
3. Entrez la **Value** (valeur)
4. **Ne cochez PAS "Secret"** (ces variables ne sont pas sensibles)
5. Cliquez sur **"Save Changes"**

#### Étape 4 : Redémarrer le Service
Après avoir ajouté/modifié les variables :
1. Allez dans l'onglet **"Events"** ou **"Logs"**
2. Cliquez sur **"Manual Deploy"** > **"Deploy latest commit"**
   - OU attendez le prochain déploiement automatique

---

## 📊 Valeurs Recommandées

### **Configuration Standard (Production normale)**

```bash
# Monitoring de base de données (toutes les 30s)
DB_HEALTH_CHECK_INTERVAL_SECS=30

# Monitoring pipeline vidéo (toutes les 5 minutes)
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300

# Matching livraisons (toutes les 30s, batch de 10)
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30
DELIVERY_MATCHING_WORKER_BATCH_SIZE=10

# Événements promotionnels (toutes les 30s)
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=30

# Timeouts commandes (toutes les minutes)
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=60

# Timeouts livraisons (toutes les minutes)
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=60
```

### **Configuration Charge Élevée**

Si votre base de données est sous charge importante :

```bash
# Réduire la fréquence des vérifications
DB_HEALTH_CHECK_INTERVAL_SECS=60
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=600
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=60
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=60
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=120
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=120

# Augmenter la taille des batches
DELIVERY_MATCHING_WORKER_BATCH_SIZE=20
```

### **Configuration Monitoring Intensif**

Pour un monitoring plus fréquent (si nécessaire) :

```bash
# Augmenter la fréquence
DB_HEALTH_CHECK_INTERVAL_SECS=15
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=180
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=15
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=15
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=30
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=30
```

---

## 🖥️ Configuration Locale (Développement)

Si vous testez localement, créez un fichier `.env` dans le dossier `backend/` :

```bash
# backend/.env

# Monitoring (optionnel - valeurs par défaut si non définies)
DB_HEALTH_CHECK_INTERVAL_SECS=30
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30
DELIVERY_MATCHING_WORKER_BATCH_SIZE=10
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=30
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=60
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=60
```

**Note**: Assurez-vous que `.env` est dans `.gitignore` pour ne pas commiter vos configurations locales.

---

## 📝 Exemple de Configuration Complète sur Render

### **Variables à ajouter dans Render Dashboard :**

```
Key: DB_HEALTH_CHECK_INTERVAL_SECS
Value: 30
Secret: ❌ Non

Key: PIPELINE_HEALTH_CHECK_INTERVAL_SECS
Value: 300
Secret: ❌ Non

Key: DELIVERY_MATCHING_WORKER_INTERVAL_SECS
Value: 30
Secret: ❌ Non

Key: DELIVERY_MATCHING_WORKER_BATCH_SIZE
Value: 10
Secret: ❌ Non

Key: GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS
Value: 30
Secret: ❌ Non

Key: ORDER_TIMEOUT_MONITOR_INTERVAL_SECS
Value: 60
Secret: ❌ Non

Key: DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS
Value: 60
Secret: ❌ Non
```

---

## ✅ Vérification

### **Vérifier que les variables sont appliquées**

1. **Via les logs Render** :
   - Allez dans l'onglet **"Logs"** de votre service
   - Recherchez les messages de démarrage des workers
   - Vous devriez voir des messages comme :
     ```
     ✅ DB Health Monitor démarré (vérification toutes les 30s)
     ```

2. **Via les logs de l'application** :
   - Les intervalles configurés seront visibles dans les logs de démarrage
   - Les workers utiliseront automatiquement les valeurs configurées

---

## 🔍 Dépannage

### **Problème : Les variables ne sont pas prises en compte**

**Solution** :
1. Vérifiez que vous avez bien redémarré le service après avoir ajouté les variables
2. Vérifiez l'orthographe des noms de variables (sensible à la casse)
3. Vérifiez que les valeurs sont des nombres valides (pas de guillemets, pas de lettres)

### **Problème : Le service ne démarre pas**

**Solution** :
1. Vérifiez les logs d'erreur dans Render
2. Assurez-vous que les valeurs sont des nombres entiers positifs
3. Les valeurs par défaut seront utilisées si une variable est invalide

### **Problème : Charge DB trop élevée**

**Solution** :
- Augmentez les intervalles (ex: 60s au lieu de 30s)
- Augmentez `PIPELINE_HEALTH_CHECK_INTERVAL_SECS` à 600 (10 min)
- Augmentez les intervalles des monitors de timeout à 120s

---

## 📈 Impact sur les Performances

### **Avant optimisation** (valeurs par défaut) :
- ~64-74 requêtes SQL/minute pour monitoring
- Certaines requêtes >2ms

### **Après optimisation** (avec index + intervalles ajustés) :
- Même nombre de requêtes (ou moins si intervalles augmentés)
- Toutes les requêtes <1ms (grâce aux index)
- Réduction de ~40-70% du temps total de requêtes

### **Recommandation** :
- **Production normale** : Utiliser les valeurs par défaut
- **Charge élevée** : Augmenter les intervalles de 30s à 60s
- **Monitoring intensif** : Réduire les intervalles (attention à la charge DB)

---

## 🎯 Résumé Rapide

1. **Aller sur Render Dashboard** → Votre service → **Environment**
2. **Ajouter les variables** une par une (optionnel)
3. **Redémarrer le service** pour appliquer les changements
4. **Vérifier les logs** pour confirmer l'application

**Rappel** : Toutes ces variables sont **optionnelles**. Si vous ne les configurez pas, les valeurs par défaut seront utilisées et fonctionneront parfaitement.

---

**Date**: 2025-11-28  
**Version**: 1.0

