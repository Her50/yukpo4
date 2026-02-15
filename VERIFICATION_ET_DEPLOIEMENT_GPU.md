# 🔍 Vérification et Déploiement Service GPU

**Date**: 2026-02-15  
**Objectif**: Vérifier l'initialisation, tester les endpoints, vérifier le monitoring et déployer les instances GPU

---

## 📋 Checklist de Vérification

### 1. ✅ Vérifier les Logs d'Initialisation GPU

**Commande** :
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND (textPayload=~'GPU' OR textPayload=~'Service GPU' OR textPayload=~'GpuService' OR textPayload=~'initialisé' OR textPayload=~'Monitoring GPU')" --limit=50 --format="table(timestamp,severity,textPayload)" --project=yukpo-project
```

**Logs Attendus** :
```
✅ Service GPU initialisé
[GpuService] ✅ Initialisé - Endpoint: http://yukpo-gpu-workers:8080, Budget: $100.0/mois
🚀 Démarrage du monitoring GPU automatisé...
✅ Monitoring GPU démarré (scaling automatique activé)
```

**Script Automatisé** :
```powershell
.\scripts\verify-gpu-service.ps1
```

---

### 2. ✅ Tester les Endpoints GPU

#### 2.1. Endpoint `/api/gpu/metrics`

**Commande** :
```bash
curl https://yukpo-backend-376093909298.europe-west1.run.app/api/gpu/metrics
```

**Réponse Attendue** :
```json
{
  "status": "ok",
  "enabled": true,
  "metrics": {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "average_response_time_ms": 0.0,
    "current_utilization": 0.0,
    "active_instances": 0,
    "monthly_cost_estimate": 0.0,
    "last_updated": 1737000000
  }
}
```

**Si désactivé** :
```json
{
  "status": "disabled",
  "message": "GPU service non configuré",
  "enabled": false
}
```

#### 2.2. Endpoint `/api/gpu/status`

**Commande** :
```bash
curl https://yukpo-backend-376093909298.europe-west1.run.app/api/gpu/status
```

**Réponse Attendue** :
```json
{
  "status": "ok",
  "enabled": true,
  "active_instances": 0,
  "current_utilization": 0.0,
  "monthly_cost_estimate": 0.0,
  "total_requests": 0,
  "successful_requests": 0,
  "failed_requests": 0,
  "average_response_time_ms": 0.0
}
```

---

### 3. ✅ Vérifier le Monitoring Automatique

#### 3.1. Vérifier les Logs de Monitoring

**Commande** :
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND (textPayload=~'Monitoring GPU' OR textPayload=~'scaling' OR textPayload=~'budget')" --limit=20 --format="table(timestamp,textPayload)" --project=yukpo-project
```

**Logs Attendus** :
```
🚀 Démarrage du monitoring GPU automatisé...
✅ Monitoring GPU démarré (scaling automatique activé)
[GpuService] Vérification budget GPU...
[GpuService] Vérification scaling GPU...
```

#### 3.2. Vérifier la Table `gpu_scale_actions`

Le monitoring enregistre les actions de scaling dans la table `gpu_scale_actions`.

**Requête SQL** :
```sql
SELECT * FROM gpu_scale_actions 
ORDER BY created_at DESC 
LIMIT 10;
```

**Colonnes** :
- `id` : ID unique
- `action_type` : `scale_up`, `scale_down`, `budget_check`
- `instances_before` : Nombre d'instances avant
- `instances_after` : Nombre d'instances après
- `reason` : Raison de l'action
- `created_at` : Timestamp

---

### 4. ✅ Déployer les Instances GPU via Terraform

#### 4.1. Vérifier les Instances Existantes

**Commande** :
```bash
gcloud compute instances list --filter="name~yukpo-gpu-worker" --format="table(name,zone,status,machineType)" --project=yukpo-project
```

**Si aucune instance** :
```
Listed 0 items.
```

#### 4.2. Déployer via Terraform

**Prérequis** :
- Terraform installé (`terraform --version`)
- Authentification GCP configurée (`gcloud auth application-default login`)
- Permissions nécessaires (Compute Engine Admin, Service Account User)

**Étapes** :

1. **Aller dans le répertoire Terraform** :
```bash
cd gcp/gpu-infrastructure/terraform
```

2. **Initialiser Terraform** :
```bash
terraform init
```

3. **Vérifier la configuration** :
```bash
terraform validate
```

4. **Voir le plan de déploiement** :
```bash
terraform plan
```

**Variables à configurer** (si nécessaire) :
```hcl
# Créer terraform.tfvars
project_id = "yukpo-project"
region     = "europe-west1"
zone       = "europe-west1-b"
gpu_type   = "nvidia-tesla-t4"
machine_type = "n1-standard-4"
min_instances = 0
max_instances = 3
```

5. **Déployer** :
```bash
terraform apply
```

**Confirmation** :
```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes
```

6. **Vérifier le déploiement** :
```bash
# Vérifier les instances
gcloud compute instances list --filter="name~yukpo-gpu-worker" --project=yukpo-project

# Vérifier le load balancer
gcloud compute forwarding-rules list --project=yukpo-project

# Vérifier l'instance group
gcloud compute instance-groups list --project=yukpo-project
```

---

## 🔧 Configuration Terraform

### Fichiers Terraform

- **`gcp/gpu-infrastructure/terraform/main.tf`** : Configuration principale
  - Instance templates avec GPU
  - Instance group managers
  - Autoscalers
  - Health checks
  - Budgets GCP
  - Cloud Scheduler jobs

- **`gcp/gpu-infrastructure/terraform/startup-script.sh`** : Script de démarrage
  - Installation Docker
  - Installation NVIDIA Container Toolkit
  - Service Flask pour prédictions IA

### Variables Terraform

**Variables principales** :
- `project_id` : ID du projet GCP
- `region` : Région GCP (europe-west1)
- `zone` : Zone GCP (europe-west1-b)
- `gpu_type` : Type de GPU (nvidia-tesla-t4, nvidia-tesla-v100, etc.)
- `machine_type` : Type de machine (n1-standard-4, n1-standard-8, etc.)
- `min_instances` : Nombre minimum d'instances (0)
- `max_instances` : Nombre maximum d'instances (3)
- `monthly_budget` : Budget mensuel ($100.0)

### Ressources Créées par Terraform

1. **Instance Template** : Template pour instances GPU
2. **Instance Group Manager** : Gestion du groupe d'instances
3. **Autoscaler** : Scaling automatique basé sur l'utilisation
4. **Health Check** : Vérification de santé des instances
5. **Load Balancer** : Répartition de charge (si configuré)
6. **Budget GCP** : Alerte budget mensuel
7. **Cloud Scheduler** : Job d'arrêt nocturne (si configuré)

---

## 📊 Vérification Complète

### Script Automatisé

**Exécuter le script de vérification** :
```powershell
.\scripts\verify-gpu-service.ps1
```

**Le script vérifie** :
1. ✅ Logs d'initialisation GPU
2. ✅ Endpoints `/api/gpu/metrics` et `/api/gpu/status`
3. ✅ Logs de monitoring automatique
4. ✅ Instances GPU déployées

### Vérification Manuelle

**1. Vérifier les variables d'environnement** :
```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env)" \
  --project=yukpo-project | grep GPU
```

**2. Vérifier les logs récents** :
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=100 --format="json" --project=yukpo-project | jq '.[] | select(.textPayload | contains("GPU"))'
```

**3. Tester les endpoints avec curl** :
```bash
# Métriques
curl -s https://yukpo-backend-376093909298.europe-west1.run.app/api/gpu/metrics | jq

# Statut
curl -s https://yukpo-backend-376093909298.europe-west1.run.app/api/gpu/status | jq
```

**4. Vérifier les instances GPU** :
```bash
gcloud compute instances list --filter="name~yukpo-gpu-worker" --format="table(name,zone,status,machineType,creationTimestamp)" --project=yukpo-project
```

---

## 🚀 Déploiement via Cloud Build (Alternative)

Si Terraform n'est pas disponible, utiliser Cloud Build :

**Commande** :
```bash
gcloud builds submit --config=gcp/gpu-infrastructure/cloudbuild.yaml \
  --project=yukpo-project
```

**Fichier** : `gcp/gpu-infrastructure/cloudbuild.yaml`

---

## ⚠️ Dépannage

### Si les endpoints retournent "disabled"

1. **Vérifier les variables d'environnement** :
   ```bash
   gcloud run services describe yukpo-backend \
     --region=europe-west1 \
     --format="value(spec.template.spec.containers[0].env[?(@.name=='GPU_ENABLED')].value)" \
     --project=yukpo-project
   ```
   **Doit retourner** : `true`

2. **Vérifier toutes les variables GPU** :
   ```bash
   gcloud run services describe yukpo-backend \
     --region=europe-west1 \
     --format="get(spec.template.spec.containers[0].env)" \
     --project=yukpo-project | grep GPU
   ```

3. **Redéployer avec les variables** :
   ```bash
   gcloud run services update yukpo-backend \
     --region=europe-west1 \
     --update-env-vars="GPU_ENABLED=true,GPU_ENDPOINT=http://yukpo-gpu-workers:8080,GPU_ZONE=europe-west1-b,GPU_INSTANCE_NAME=yukpo-gpu-worker,GCP_PROJECT_ID=yukpo-project,GPU_MONTHLY_BUDGET=100.0,GPU_SCALE_UP_THRESHOLD=70.0,GPU_SCALE_DOWN_THRESHOLD=20.0,GPU_MAX_INSTANCES=3,GPU_MIN_INSTANCES=0" \
     --project=yukpo-project
   ```

### Si les instances GPU ne sont pas accessibles

1. **Vérifier que les instances sont démarrées** :
   ```bash
   gcloud compute instances list --filter="name~yukpo-gpu-worker AND status=RUNNING" --project=yukpo-project
   ```

2. **Vérifier le firewall** :
   ```bash
   gcloud compute firewall-rules list --filter="name~gpu" --project=yukpo-project
   ```

3. **Vérifier le load balancer** :
   ```bash
   gcloud compute forwarding-rules list --project=yukpo-project
   ```

4. **Tester la connectivité** :
   ```bash
   # Depuis une instance Cloud Run (via VPC connector)
   curl http://yukpo-gpu-workers:8080/health
   ```

### Si le monitoring ne démarre pas

1. **Vérifier les logs d'erreur** :
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND severity>=ERROR" --limit=50 --project=yukpo-project
   ```

2. **Vérifier la base de données** :
   - La table `gpu_scale_actions` doit exister
   - Les permissions de connexion doivent être correctes

3. **Vérifier les permissions GCP** :
   - Le service account doit avoir les permissions Compute Engine Admin
   - Vérifier : `gcloud projects get-iam-policy yukpo-project`

---

## 📋 Résumé

- ✅ **Logs vérifiés** : Initialisation GPU et monitoring
- ✅ **Endpoints testés** : `/api/gpu/metrics` et `/api/gpu/status`
- ✅ **Monitoring vérifié** : Logs et table `gpu_scale_actions`
- ✅ **Instances déployées** : Via Terraform ou Cloud Build

**Prochaines Étapes** :
1. Vérifier que les instances GPU répondent aux requêtes
2. Tester une requête IA pour vérifier le routing GPU
3. Surveiller les métriques et le scaling automatique

---

**✅ Une fois toutes les vérifications passées, le service GPU est opérationnel !**

