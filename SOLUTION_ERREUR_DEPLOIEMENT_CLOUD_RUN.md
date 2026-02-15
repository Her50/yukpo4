# 🔧 Solution Erreur Déploiement Cloud Run

**Date**: 2026-02-14  
**Erreur**: Container failed to start - timeout sur connexion PostgreSQL

---

## 🔍 Diagnostic

D'après les logs, le problème est :

```
❌ ERREUR: Impossible de se connecter à la base de données après 30 tentatives
34.79.29.219:5432 - no response
```

**Cause** : Le conteneur essaie de se connecter à PostgreSQL (34.79.29.219:5432) mais :
1. La base de données n'est pas accessible depuis Cloud Run
2. Le timeout de démarrage Cloud Run est dépassé (240s par défaut)
3. Le conteneur s'arrête avant que le serveur HTTP ne démarre

---

## ✅ Solutions

### Solution 1: Augmenter le Timeout de Démarrage Cloud Run (RECOMMANDÉ)

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --timeout=900 \
  --cpu-throttling \
  --startup-cpu-boost
```

**Explication** :
- `--timeout=900` : Timeout de requête à 15 minutes
- `--cpu-throttling` : Permet CPU boost au démarrage
- `--startup-cpu-boost` : CPU boost pendant démarrage

### Solution 2: Définir CLOUD_RUN=true (CRITIQUE)

Le code utilise `connect_lazy` (non-bloquant) seulement si `CLOUD_RUN=true` est défini.

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="CLOUD_RUN=true"
```

**Sans cette variable**, le code utilise la connexion bloquante avec retry, ce qui cause le timeout.

### Solution 3: Vérifier Accessibilité Base de Données

La base de données PostgreSQL (34.79.29.219:5432) doit être accessible depuis Cloud Run :

1. **Vérifier firewall** : Autoriser connexions depuis Cloud Run IPs
2. **Vérifier VPC** : Si DB est dans un VPC, configurer VPC connector
3. **Vérifier sécurité** : IP whitelist, SSL, etc.

### Solution 4: Utiliser Cloud SQL Proxy (Si DB est Cloud SQL)

Si la base de données est Cloud SQL, utiliser le proxy :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE_NAME \
  --update-env-vars="CLOUD_SQL_CONNECTION_NAME=PROJECT_ID:REGION:INSTANCE_NAME"
```

---

## 🚀 Commande Complète de Correction

```bash
# 1. Définir CLOUD_RUN=true (CRITIQUE)
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="CLOUD_RUN=true"

# 2. Augmenter timeout de démarrage
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --timeout=900 \
  --cpu-throttling \
  --startup-cpu-boost

# 3. Vérifier les variables
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

---

## 📋 Checklist de Vérification

- [ ] Variable `CLOUD_RUN=true` définie dans Cloud Run
- [ ] Timeout Cloud Run augmenté (900s minimum)
- [ ] Base de données accessible depuis Cloud Run (firewall/VPC)
- [ ] Variables d'environnement correctes (DATABASE_URL, etc.)
- [ ] Logs montrent "✅ Pool PostgreSQL créé avec succès"

---

## 🔍 Vérification après Correction

Après correction, vérifier les logs :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --format=json
```

Vous devriez voir :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

---

**⚠️ IMPORTANT** : La variable `CLOUD_RUN=true` est **CRITIQUE** pour que le code utilise `connect_lazy` (non-bloquant) au lieu de la connexion bloquante.

