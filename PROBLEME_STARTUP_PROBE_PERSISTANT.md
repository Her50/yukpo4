# 🔴 Problème Startup Probe Persistant

**Date**: 2026-02-18  
**Statut**: ❌ Startup probe échoue toujours

---

## 🎯 Problème Identifié

Le startup probe échoue même après les corrections. Analyse des logs montre :

1. **Premier déploiement réussit** (revision 00248) ✅
2. **Nettoyage échoue** (revisions 00249-00251) ❌
3. **Déploiement final échoue** (revision 00253) ❌

**Erreur constante**:
```
ERROR: (gcloud.run.deploy) The user-provided container failed the configured startup probe checks.
```

---

## 🔍 Cause Racine

### Problème 1: Wrapper tue Python trop tôt

**Séquence actuelle**:
1. Python démarre → répond aux health checks ✅
2. Attente 5s → Cloud Run commence les health checks
3. **Python est tué** → Cloud Run ne peut plus valider le startup probe ❌
4. Rust démarre → mais Cloud Run a déjà échoué le probe

**Problème**: Le wrapper tue Python **avant** que Cloud Run n'ait validé le startup probe (qui prend 60s initial + jusqu'à 300s).

### Problème 2: Trop de mises à jour successives

Le workflow fait **7 étapes de nettoyage** qui créent chacune une nouvelle revision :
- Étape 1: Suppression secrets comme env vars → **réussit** (00248)
- Étape 2-7: Chaque étape crée une revision qui **échoue** (00249-00251)
- Déploiement final → **échoue** (00253)

Chaque échec consomme du temps et complique le diagnostic.

---

## ✅ Solutions

### Solution 1: Garder Python en vie jusqu'à ce que Rust soit prêt

**Changement**: Ne pas tuer Python immédiatement. Démarrer Rust en arrière-plan et laisser Python répondre jusqu'à ce que Rust prenne le relais.

**Avantage**: Cloud Run peut toujours valider le startup probe pendant que Rust s'initialise.

### Solution 2: Simplifier le processus de nettoyage

**Changement**: Faire le nettoyage en **une seule étape** au lieu de 7 étapes séparées.

**Avantage**: Moins de revisions créées, moins d'échecs.

### Solution 3: Augmenter encore le startup probe

**Changement**: Augmenter `initialDelaySeconds` à 120s pour laisser plus de temps au wrapper.

**Avantage**: Plus de temps pour que Python démarre et que Cloud Run le détecte.

---

## 🔧 Corrections à Appliquer

1. **Modifier startup-wrapper.sh** : Garder Python en vie jusqu'à ce que Rust soit prêt
2. **Simplifier le workflow** : Réduire les étapes de nettoyage
3. **Augmenter startup probe** : `initialDelaySeconds=120` au lieu de 60

