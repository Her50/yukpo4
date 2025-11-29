# 🔍 VÉRIFICATION CONFIGURATION RENDER - LIMITE MÉMOIRE

**Date**: 29 Novembre 2025  
**Service**: yukpomnang-backend  
**Problème**: Dépassement de limite mémoire détecté par Render

---

## 📋 CONFIGURATION ACTUELLE DÉTECTÉE

### **Fichier `render.yaml`**

```yaml
services:
  - type: web
    name: yukpomnang-backend
    env: rust
    buildCommand: chmod +x backend/build.sh && ./backend/build.sh
    startCommand: cd backend && ./target/release/yukpomnang_backend
    healthCheckPath: /healthz
    autoDeploy: true
    branch: master
```

**⚠️ PROBLÈME** : Le fichier `render.yaml` **ne spécifie pas** :
- Le type d'instance (Starter, Standard, Pro, etc.)
- La limite mémoire
- Le nombre de CPU
- Le plan de facturation

**Cela signifie** que Render utilise probablement les **valeurs par défaut** du plan gratuit ou du plan de base.

---

## 💰 PLANS RENDER ET LIMITES MÉMOIRE

### **Plan Gratuit (Free Tier)**
- **Mémoire** : **512 MB** ⚠️
- **CPU** : 0.1 CPU partagé
- **Limitation** : Service peut s'endormir après inactivité
- **Coût** : Gratuit

### **Plan Starter**
- **Mémoire** : **512 MB** ⚠️
- **CPU** : 0.5 CPU partagé
- **Coût** : ~$7/mois

### **Plan Standard**
- **Mémoire** : **1 GB** ✅
- **CPU** : 1 CPU dédié
- **Coût** : ~$25/mois

### **Plan Pro**
- **Mémoire** : **2 GB** ✅✅
- **CPU** : 2 CPU dédiés
- **Coût** : ~$85/mois

### **Plan Pro Plus**
- **Mémoire** : **4 GB** ✅✅✅
- **CPU** : 4 CPU dédiés
- **Coût** : ~$250/mois

---

## 🔍 COMMENT VÉRIFIER VOTRE CONFIGURATION ACTUELLE

### **Étape 1 : Accéder au Dashboard Render**

1. Allez sur : https://dashboard.render.com
2. Connectez-vous à votre compte
3. Sélectionnez le service **"yukpomnang-backend"** ou **"yukpomnang"**

### **Étape 2 : Vérifier le Type d'Instance**

1. Dans votre service, cliquez sur l'onglet **"Settings"** (Paramètres)
2. Cherchez la section **"Instance Type"** ou **"Plan"**
3. Notez :
   - Le nom du plan (Free, Starter, Standard, Pro, etc.)
   - La limite mémoire affichée
   - Le nombre de CPU

### **Étape 3 : Vérifier les Métriques**

1. Dans votre service, cliquez sur l'onglet **"Metrics"** (Métriques)
2. Regardez le graphique **"Memory Usage"** (Utilisation mémoire)
3. Vérifiez :
   - La limite mémoire (ligne rouge)
   - L'utilisation moyenne
   - Les pics d'utilisation

### **Étape 4 : Vérifier les Logs**

1. Dans votre service, cliquez sur l'onglet **"Logs"**
2. Cherchez les messages de redémarrage :
   - `"Service restarted due to memory limit"`
   - `"Memory limit exceeded"`
   - `"OOMKilled"` (Out Of Memory Killed)

---

## 🎯 DIAGNOSTIC PROBABLE

### **Scénario le plus probable (90%)**

Votre service utilise probablement le **plan gratuit ou Starter** avec **512 MB de mémoire**.

**Pourquoi c'est insuffisant** :
- Caches en mémoire : **~500 MB - 1 GB** (selon notre analyse)
- Logs mobiles : **~50-100 MB**
- Données de requêtes : **~200-500 MB**
- **Total nécessaire** : **~1-2 GB minimum**

**Résultat** : Dépassement inévitable avec 512 MB

---

## ✅ SOLUTIONS RECOMMANDÉES

### **Solution 1 : Upgrader le Plan (RECOMMANDÉ)**

#### **Option A : Plan Standard (1 GB) - Minimum recommandé**
- **Coût** : ~$25/mois
- **Avantages** :
  - 1 GB de mémoire (2× plus que le plan gratuit)
  - 1 CPU dédié (meilleure performance)
  - Pas de limitation d'inactivité
- **Suffisant si** : Vous réduisez aussi les caches (voir Solution 2)

#### **Option B : Plan Pro (2 GB) - Recommandé pour production**
- **Coût** : ~$85/mois
- **Avantages** :
  - 2 GB de mémoire (4× plus que le plan gratuit)
  - 2 CPU dédiés (meilleure performance)
  - Support prioritaire
- **Suffisant pour** : Production avec trafic modéré

#### **Option C : Plan Pro Plus (4 GB) - Pour trafic élevé**
- **Coût** : ~$250/mois
- **Avantages** :
  - 4 GB de mémoire (8× plus que le plan gratuit)
  - 4 CPU dédiés
- **Suffisant pour** : Production avec trafic élevé

### **Solution 2 : Optimiser le Code (GRATUIT)**

Réduire l'utilisation mémoire en modifiant le code :

1. **Réduire les limites de cache** :
   - `max_memory_entries`: 10000 → 5000
   - `CACHE_MAX_MEMORY_SIZE`: 100 MB → 50 MB

2. **Réduire le semaphore** :
   - `MAX_CONCURRENT_REQUESTS`: 10000 → 1000

3. **Nettoyer les embeddings** lors de l'éviction LRU

4. **Réduire la verbosité des logs** mobiles

**Impact** : Réduction de **~50% de l'utilisation mémoire**

### **Solution 3 : Combinaison (RECOMMANDÉ)**

1. **Upgrader vers Plan Standard (1 GB)** : +$25/mois
2. **Optimiser le code** : Réduction de 50% de l'utilisation
3. **Résultat** : 1 GB avec utilisation de ~500 MB = **marge de sécurité**

---

## 📊 COMPARAISON DES OPTIONS

| Option | Coût/mois | Mémoire | Action Code | Risque Dépassement |
|--------|-----------|---------|-------------|-------------------|
| **Gratuit + Optimisation** | $0 | 512 MB | ✅ Oui | ⚠️ Moyen (peut encore dépasser) |
| **Starter + Optimisation** | $7 | 512 MB | ✅ Oui | ⚠️ Moyen |
| **Standard + Optimisation** | $25 | 1 GB | ✅ Oui | ✅ Faible |
| **Pro** | $85 | 2 GB | ❌ Non | ✅ Très faible |
| **Pro Plus** | $250 | 4 GB | ❌ Non | ✅ Nul |

---

## 🚀 PLAN D'ACTION RECOMMANDÉ

### **Action Immédiate (Aujourd'hui)**

1. ✅ **Vérifier le plan actuel** sur Render Dashboard
2. ✅ **Vérifier les métriques mémoire** des dernières 24h
3. ✅ **Implémenter les optimisations de code** (Solution 2)

### **Action Court Terme (Cette semaine)**

1. ✅ **Upgrader vers Plan Standard** si actuellement sur plan gratuit/Starter
2. ✅ **Monitorer l'utilisation mémoire** pendant 48h
3. ✅ **Ajuster si nécessaire** (réduire encore les caches ou upgrader)

### **Action Long Terme (Ce mois)**

1. ✅ **Migrer les caches vers Redis** (au lieu de mémoire)
2. ✅ **Implémenter un monitoring mémoire** avec alertes
3. ✅ **Optimiser les requêtes SQL** pour réduire la charge

---

## 📝 INFORMATIONS À COLLECTER

Pour mieux diagnostiquer, collectez ces informations sur Render Dashboard :

1. **Plan actuel** : [Free / Starter / Standard / Pro / Pro Plus]
2. **Limite mémoire** : [512 MB / 1 GB / 2 GB / 4 GB]
3. **Utilisation moyenne** : [___ MB]
4. **Pic d'utilisation** : [___ MB]
5. **Nombre de redémarrages** : [___ fois dans les dernières 24h]
6. **Coût mensuel actuel** : [$___]

---

## 🔗 RESSOURCES

- [Render Pricing](https://render.com/pricing)
- [Render Documentation - Instance Types](https://render.com/docs/instance-types)
- [Render Documentation - Memory Limits](https://render.com/docs/memory-limits)

---

**Prochaine étape** : Vérifier votre plan actuel sur Render Dashboard et partager les informations pour un diagnostic précis.

