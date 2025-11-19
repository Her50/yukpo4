# 🚀 Guide Rapide - Actions Prioritaires

## ⚡ Actions à Exécuter Maintenant

### 1. Changer le Mot de Passe Grafana (2 minutes)

**Option A : Via Interface (Recommandé)**
1. Aller sur http://46.224.14.85:3002
2. Se connecter (admin/admin)
3. Profil → Change Password
4. Entrer nouveau mot de passe fort

**Option B : Via Script (Automatique)**
```bash
# Sur Hetzner
ssh root@46.224.14.85
cd /opt/yukpo
GRAFANA_NEW_PASSWORD='VotreMotDePasseFort123!' bash changer-password-grafana.sh
```

### 2. Configurer Alertes Slack (10 minutes)

**Étapes** :
1. Créer webhook Slack (voir `GUIDE_CONFIGURATION_ALERTES_SLACK.md`)
2. Configurer sur Render :
   - `PIPELINE_ALERT_WEBHOOK`
   - `SLA_ALERT_WEBHOOK`
3. Redéployer le service

**Guide complet** : `GUIDE_CONFIGURATION_ALERTES_SLACK.md`

### 3. Créer Dashboards Supplémentaires (5 minutes)

**Via Script Automatique** :
```bash
# Sur Hetzner
ssh root@46.224.14.85
cd /opt/yukpo
scp create-dashboards-complets.sh root@46.224.14.85:/tmp/
ssh root@46.224.14.85 "chmod +x /tmp/create-dashboards-complets.sh && bash /tmp/create-dashboards-complets.sh"
```

**Dashboards créés** :
- Dashboard Vidéo Complet
- Dashboard Delivery Complet
- Dashboard Système

---

## 📋 Checklist Rapide

- [ ] Mot de passe Grafana changé
- [ ] Webhooks Slack créés
- [ ] Variables Slack configurées sur Render
- [ ] Service Render redéployé
- [ ] Dashboards supplémentaires créés

---

**Temps total estimé : 15-20 minutes**

