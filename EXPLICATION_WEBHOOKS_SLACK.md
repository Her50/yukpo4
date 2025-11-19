# 🔔 Explication : Deux Webhooks Slack Distincts

## ✅ Pas de Confusion !

Vous avez **deux webhooks Slack différents** pour **deux types d'alertes différents**. C'est normal et correct !

---

## 📊 Les Deux Webhooks

### 1. SLA_ALERT_WEBHOOK (Déjà Configuré ✅)

**Variable** : `SLA_ALERT_WEBHOOK`
**URL** : `YOUR_SLA_ALERT_WEBHOOK_URL`
**Utilisé par** : `delivery_sla_monitor.rs` (ligne 37)
**Type d'alertes** : **Alertes de livraison (SLA)**
- Livraisons en retard
- SLA non respecté
- Problèmes de délais de livraison

**Canal Slack** : Probablement `#yukpo-alerts` ou le canal que vous avez configuré

---

### 2. PIPELINE_ALERT_WEBHOOK (À Configurer ⏳)

**Variable** : `PIPELINE_ALERT_WEBHOOK`
**URL** : `YOUR_PIPELINE_ALERT_WEBHOOK_URL`
**Utilisé par** : `pipeline_health_worker.rs` (ligne 23)
**Type d'alertes** : **Alertes du pipeline vidéo**
- Pipeline degraded/critical
- Jobs stale (bloqués)
- Échecs de traitement vidéo
- Problèmes de queue de jobs

**Canal Slack** : `tout canaux yukpo` (celui que vous venez de créer)

---

## 🔍 Vérification dans le Code

### Code 1 : Delivery SLA Monitor

```37:37:backend/src/tasks/delivery_sla_monitor.rs
            webhook: std::env::var("SLA_ALERT_WEBHOOK").ok(),
```

**Service** : Surveille les livraisons et envoie des alertes si SLA non respecté

### Code 2 : Pipeline Health Worker

```23:23:backend/src/tasks/pipeline_health_worker.rs
    let webhook_url = std::env::var("PIPELINE_ALERT_WEBHOOK").ok();
```

**Service** : Surveille le pipeline vidéo et envoie des alertes si problèmes

---

## ✅ Pourquoi Deux Webhooks ?

### Avantages

1. **Séparation des préoccupations** :
   - Alertes livraison → Canal dédié aux livraisons
   - Alertes pipeline → Canal dédié au pipeline

2. **Flexibilité** :
   - Vous pouvez envoyer les alertes dans des canaux différents
   - Vous pouvez désactiver un type d'alerte sans affecter l'autre

3. **Organisation** :
   - Équipe livraison → Voit seulement les alertes livraison
   - Équipe technique → Voit seulement les alertes pipeline
   - Ou tout le monde voit tout dans le même canal

---

## 📋 Configuration Finale sur Render

### Variables à Configurer

**Déjà configuré** ✅ :
- `SLA_ALERT_WEBHOOK` = `YOUR_SLA_ALERT_WEBHOOK_URL`

**À configurer** ⏳ :
- `PIPELINE_ALERT_WEBHOOK` = `YOUR_PIPELINE_ALERT_WEBHOOK_URL`

**Plus les variables GPU** :
- `GPU_AVAILABLE` = `true`
- `GPU_TYPE` = `nvidia`
- `GPU_MEMORY_GB` = `16`

---

## 🎯 Résumé

| Variable | Service | Type d'Alertes | Canal Slack |
|----------|---------|----------------|-------------|
| `SLA_ALERT_WEBHOOK` | Delivery SLA Monitor | Livraisons en retard | Votre canal SLA |
| `PIPELINE_ALERT_WEBHOOK` | Pipeline Health Worker | Pipeline vidéo | `tout canaux yukpo` |

**Aucune confusion possible** : Chaque service lit sa propre variable d'environnement ! ✅

---

**Vous pouvez configurer `PIPELINE_ALERT_WEBHOOK` sans problème, il n'y aura aucune confusion !** ✅

