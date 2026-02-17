# 🔴 Diagnostic : Application Rust ne démarre pas

**Date**: 2026-02-17  
**Problème**: L'application Rust ne démarre jamais après que le wrapper libère le port

---

## ❌ Observations

### Logs du wrapper
- ✅ Wrapper démarre
- ✅ Serveur Python démarre
- ✅ Cloud Run détecte le health check
- ✅ Serveur Python est arrêté
- ✅ "Attente libération du port (5 secondes)..."
- ❌ **AUCUN log après** - Pas de "Port libéré, démarrage de Rust..."
- ❌ **AUCUN log de vérification du binaire**
- ❌ **AUCUN log de l'application Rust**

### Erreurs HTTP
- **501 Not Implemented** : Le serveur Python répond mais ne peut pas gérer les requêtes API
- **502 Bad Gateway** : L'instance ne répond pas
- **503 Service Unavailable** : L'instance n'est pas prête

---

## 🔍 Hypothèses

### 1. Le wrapper crash avant d'exécuter Rust

**Cause possible** : Le script `startup-wrapper.sh` utilise `set -e` qui arrête le script à la première erreur.

**Vérification** : Les logs ne montrent pas les messages de vérification du binaire que j'ai ajoutés, ce qui suggère que le script s'arrête avant.

### 2. Le binaire n'existe pas ou n'est pas exécutable

**Cause possible** : Le binaire `/app/yukpomnang_backend` n'existe pas dans l'image Docker.

**Vérification** : Aucun log de vérification du binaire n'apparaît, donc on ne peut pas confirmer.

### 3. Le wrapper ne s'exécute pas complètement

**Cause possible** : Le script s'arrête silencieusement après le `sleep 5`.

**Vérification** : Pas de log "Port libéré, démarrage de Rust..." alors qu'il devrait apparaître.

---

## ✅ Solutions Proposées

### Solution 1 : Désactiver `set -e` temporairement

Modifier `startup-wrapper.sh` pour ne pas s'arrêter à la première erreur et capturer toutes les erreurs.

### Solution 2 : Ajouter plus de logs de debug

Ajouter des logs à chaque étape pour voir exactement où le script s'arrête.

### Solution 3 : Vérifier le Dockerfile

S'assurer que le binaire est correctement copié et que le chemin est correct.

### Solution 4 : Tester le binaire directement

Exécuter le binaire directement sans wrapper pour voir s'il démarre.

---

## 🚀 Action Immédiate

Modifier `startup-wrapper.sh` pour :
1. Désactiver `set -e` ou le remplacer par une gestion d'erreur plus fine
2. Ajouter des logs à chaque étape critique
3. Capturer et logger toutes les erreurs
4. Vérifier que le binaire existe AVANT de tenter de l'exécuter

---

**Statut** : 🔴 **CRITIQUE** - L'application ne démarre jamais

