# 📊 Dashboard Grafana Yukpo - Guide Complet

## ✅ Dashboard Créé avec Succès

### Informations d'Accès

- **URL Dashboard** : http://46.224.14.85:3002/d/bf4hhhohxp62ob/yukpo-backend-monitoring
- **Dashboard ID** : 1
- **Titre** : "Yukpo Backend - Monitoring"
- **Rafraîchissement** : 30 secondes

---

## 📈 Panels du Dashboard

### 1. **Backend Status** (Stat)
- **Métrique** : `up{job="yukpo-backend"}`
- **Affichage** : UP (vert) / DOWN (rouge)
- **Position** : En haut à gauche

### 2. **Video Jobs Queued** (Graphique)
- **Métrique** : `video_jobs_queued{job="yukpo-backend"}`
- **Description** : Nombre de jobs vidéo en file d'attente
- **Position** : En haut à droite

### 3. **Video Generation Duration (avg)** (Graphique)
- **Métrique** : `video_generation_duration_ms_avg{job="yukpo-backend"}`
- **Description** : Durée moyenne de génération vidéo en millisecondes
- **Position** : Milieu gauche

### 4. **Pipeline Status** (Stat)
- **Métrique** : `pipeline_status{job="yukpo-backend"}`
- **Affichage** :
  - 0 = OK (vert)
  - 1 = DEGRADED (jaune)
  - 2 = CRITICAL (rouge)
- **Position** : Milieu droite

### 5. **Delivery Matching Success/Failed** (Graphique)
- **Métriques** :
  - `rate(delivery_matching_success_total{job="yukpo-backend"}[5m])`
  - `rate(delivery_matching_failed_total{job="yukpo-backend"}[5m])`
- **Description** : Taux de matching delivery (réussi vs échoué) par seconde
- **Position** : Bas gauche

### 6. **WebSocket Connections** (Graphique)
- **Métrique** : `delivery_ws_connections_current{job="yukpo-backend"}`
- **Description** : Nombre de connexions WebSocket actives pour le tracking delivery
- **Position** : Bas droite

### 7. **HTTP Requests Rate** (Graphique)
- **Métrique** : `rate(http_requests_total{job="yukpo-backend"}[5m])`
- **Description** : Taux de requêtes HTTP par seconde (par méthode et statut)
- **Position** : Bas gauche (2ème ligne)

### 8. **HTTP Request Duration (p95/p99)** (Graphique)
- **Métriques** :
  - `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="yukpo-backend"}[5m]))`
  - `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job="yukpo-backend"}[5m]))`
- **Description** : Durée des requêtes HTTP (percentiles 95 et 99)
- **Position** : Bas droite (2ème ligne)

---

## 🔍 Utilisation du Dashboard

### Accéder au Dashboard

1. **Via navigateur** :
   ```
   http://46.224.14.85:3002/d/bf4hhhohxp62ob/yukpo-backend-monitoring
   ```

2. **Via l'interface Grafana** :
   - Se connecter à http://46.224.14.85:3002
   - Login: `admin` / Password: `admin`
   - Menu: **Dashboards** → **Yukpo Backend - Monitoring**

### Personnaliser le Dashboard

#### Ajouter un Panel

1. Cliquer sur **"Add panel"** (en haut à droite)
2. Sélectionner **"Add visualization"**
3. Choisir la source de données **"Prometheus"**
4. Entrer une requête PromQL, par exemple :
   ```
   video_jobs_completed_last_24h{job="yukpo-backend"}
   ```
5. Configurer le type de visualisation (graph, stat, gauge, etc.)
6. Cliquer **"Apply"** puis **"Save dashboard"**

#### Modifier un Panel Existant

1. Passer la souris sur le panel
2. Cliquer sur l'icône **"Edit"** (crayon)
3. Modifier la requête ou les options
4. Cliquer **"Apply"** puis **"Save dashboard"**

#### Changer la Période d'Affichage

- Utiliser le sélecteur de temps en haut à droite
- Options disponibles : 10s, 30s, 1m, 5m, 15m, 30m, 1h, 2h, 1d

---

## 📊 Métriques Disponibles (à Ajouter si Nécessaire)

### Vidéo
```
video_jobs_queued{job="yukpo-backend"}
video_jobs_running{job="yukpo-backend"}
video_jobs_completed_last_24h{job="yukpo-backend"}
video_generation_duration_ms_avg{job="yukpo-backend"}
video_generation_duration_ms_p95{job="yukpo-backend"}
video_generation_duration_ms_p99{job="yukpo-backend"}
pipeline_status{job="yukpo-backend"}
pipeline_errors_total{job="yukpo-backend"}
```

### Delivery
```
delivery_matching_success_total{job="yukpo-backend"}
delivery_matching_failed_total{job="yukpo-backend"}
delivery_ws_connections_current{job="yukpo-backend"}
delivery_requests_total{job="yukpo-backend"}
delivery_completed_total{job="yukpo-backend"}
delivery_avg_response_time_ms{job="yukpo-backend"}
```

### HTTP
```
http_requests_total{job="yukpo-backend"}
http_request_duration_seconds{job="yukpo-backend"}
```

### Système
```
up{job="yukpo-backend"}
```

---

## 🎨 Types de Visualisations Recommandés

### Pour les Compteurs (Counters)
- **Type** : Graphique avec `rate()`
- **Exemple** : `rate(delivery_matching_success_total[5m])`

### Pour les Gauges
- **Type** : Stat ou Graphique
- **Exemple** : `video_jobs_queued`

### Pour les Histogrammes
- **Type** : Graphique avec `histogram_quantile()`
- **Exemple** : `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`

### Pour les Statuts
- **Type** : Stat avec seuils de couleur
- **Exemple** : `up{job="yukpo-backend"}`

---

## 🔔 Créer des Alertes

### Via l'Interface Grafana

1. Cliquer sur un panel
2. Onglet **"Alert"**
3. Cliquer **"Create alert rule from this panel"**
4. Configurer :
   - **Condition** : Quand la métrique dépasse un seuil
   - **Evaluation** : Toutes les 1 minute
   - **Notification** : Email, Slack, etc.

### Exemples d'Alertes Utiles

#### Backend Down
```
Condition: up{job="yukpo-backend"} == 0
Duration: 5 minutes
```

#### Pipeline Critical
```
Condition: pipeline_status{job="yukpo-backend"} == 2
Duration: 5 minutes
```

#### Trop de Jobs en File
```
Condition: video_jobs_queued{job="yukpo-backend"} > 50
Duration: 10 minutes
```

---

## 🛠️ Maintenance

### Mettre à Jour le Dashboard

Le dashboard peut être mis à jour via l'API :

```bash
# Exporter le dashboard actuel
curl -u admin:admin http://46.224.14.85:3002/api/dashboards/uid/bf4hhhohxp62ob > dashboard.json

# Modifier dashboard.json

# Importer le dashboard modifié
curl -X POST \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d @dashboard.json \
  http://46.224.14.85:3002/api/dashboards/db
```

### Réinitialiser le Dashboard

Si vous voulez recréer le dashboard :

```bash
ssh root@46.224.14.85
cd /opt/yukpo
bash /tmp/create-grafana-dashboard.sh
```

---

## 📝 Notes

- Le dashboard se rafraîchit automatiquement toutes les 30 secondes
- Les métriques sont collectées toutes les 15 secondes par Prometheus
- Si certaines métriques n'apparaissent pas, vérifiez qu'elles sont bien exposées par le backend
- Le dashboard est sauvegardé dans Grafana et persiste après redémarrage

---

## ✅ Checklist

- [x] Dashboard créé
- [x] Source de données Prometheus configurée
- [x] 8 panels configurés
- [ ] Alertes configurées (optionnel)
- [ ] Dashboard personnalisé selon vos besoins (optionnel)

---

**Dashboard prêt à l'emploi ! 🎉**

