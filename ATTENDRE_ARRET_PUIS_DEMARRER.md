# ⏳ Attendre l'Arrêt Puis Démarrer l'Instance

**Date**: 2026-02-13  
**Instance**: `i-0b9ad404f8d738d04`  
**État actuel**: En cours d'arrêt ("stopping")

---

## ⏳ **ÉTAPE 1: Attendre que l'Instance s'Arrête**

L'instance est actuellement en train de s'arrêter. **Attendez 1-2 minutes** jusqu'à ce que le statut passe à **"stopped"**.

### Vérifier l'État

**Via AWS Console**:
1. **EC2** → **Instances**
2. **Sélectionnez l'instance**: `i-0b9ad404f8d738d04`
3. **Vérifiez le statut** en haut:
   - ⏳ **"stopping"** → Attendez encore
   - ✅ **"stopped"** → Passez à l'étape 2

---

## 🚀 **ÉTAPE 2: Démarrer l'Instance**

Une fois que le statut est **"stopped"** :

**Via AWS Console**:
1. **Sélectionnez l'instance**: `i-0b9ad404f8d738d04`
2. **Actions** → **Instance State** → **Start**
3. **Attendez 1-2 minutes** que l'instance démarre
4. Le statut devrait passer à **"running"**

---

## ⏳ **ÉTAPE 3: Attendre que l'Agent SSM se Connecte**

Après le démarrage, attendez **2-3 minutes** pour que :
1. L'instance démarre complètement
2. L'agent SSM se connecte avec les nouvelles credentials du rôle IAM
3. Le statut SSM passe à **"En ligne"** dans Session Manager

---

## 🔍 **ÉTAPE 4: Vérifier Session Manager**

1. **Retournez sur la page "Connect"** de l'instance
2. **Onglet "Session Manager"**
3. **Vérifiez le statut**:
   - ✅ **"En ligne"** (Online) avec coche verte → **Parfait !** Cliquez sur "Connect"
   - ❌ **"Hors ligne"** (Offline) → Attendez encore 1-2 minutes, puis réessayez

---

## ✅ **RÉSUMÉ**

**Ordre des actions**:
1. ⏳ **Attendre** que l'instance s'arrête (statut "stopped")
2. 🚀 **Démarrer** l'instance (Actions → Instance State → Start)
3. ⏳ **Attendre 2-3 minutes** que l'agent SSM se connecte
4. 🔍 **Vérifier Session Manager** → Devrait être "En ligne"
5. ✅ **Se connecter** et continuer les migrations

---

**Note**: C'est normal qu'on ne puisse pas redémarrer une instance qui est déjà en train de s'arrêter. Il faut attendre qu'elle s'arrête complètement, puis la démarrer à nouveau.

---

**Dites-moi quand l'instance est démarrée et je vous guiderai pour la suite !**

