# 🎮 Explication Complète du Fonctionnement du Service GPU

**Date**: 2026-02-14  
**Objectif**: Comprendre le fonctionnement automatique vs manuel du service GPU

---

## 🔄 Fonctionnement Automatique (100% Automatisé)

### 1. **Initialisation Automatique au Démarrage**

Quand le backend démarre (`main.rs` ligne 2418-2425) :

```rust
// ✅ Le service GPU s'initialise AUTOMATIQUEMENT si GPU_ENABLED=true
if let Some(gpu_service) = &app_state.gpu_service {
    log::info!("🚀 Démarrage du monitoring GPU automatisé...");
    gpu_service.clone().start_monitoring().await;
    log::info!("✅ Monitoring GPU démarré (scaling automatique activé)");
}
```

**Ce qui se passe automatiquement** :
- ✅ Lecture des variables d'environnement (`GPU_ENABLED`, `GPU_ENDPOINT`, etc.)
- ✅ Création du service GPU si configuré
- ✅ Démarrage du monitoring automatique
- ✅ Démarrage de 2 tâches en arrière-plan :
  - **Tâche 1** : Vérification scaling toutes les 60 secondes
  - **Tâche 2** : Vérification budget toutes les heures

### 2. **Routing Automatique des Appels IA**

Dans `orchestration_ia.rs`, le système route **automatiquement** vers GPU :

```rust
// Priorité 1: GPU GCP (si GPU_ENABLED=true)
if let Some(gpu_service) = &state.gpu_service {
    // Appel automatique vers instances GPU distantes
    gpu_service.process_ai_request(prompt, None, multimodal_data).await
}
// Priorité 2: GPU Local (si GPU_AVAILABLE=true)
else if production_config.gpu_enabled {
    // GPU local dans le conteneur
}
// Priorité 3: CPU (fallback)
else {
    // CPU uniquement
}
```

**Ce qui est automatisé** :
- ✅ Détection automatique de la disponibilité GPU
- ✅ Routing intelligent (GCP > Local > CPU)
- ✅ Fallback automatique en cas d'erreur GPU GCP
- ✅ Mise à jour automatique des métriques

### 3. **Scaling Automatique**

Le système vérifie **toutes les 60 secondes** l'utilisation GPU :

```rust
// Tâche automatique (gpu_service.rs ligne 418-426)
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(60));
    loop {
        interval.tick().await;
        service_scaling.check_and_scale().await; // ✅ AUTOMATIQUE
    }
});
```

**Ce qui est automatisé** :
- ✅ Vérification utilisation GPU toutes les 60 secondes
- ✅ **Scale UP** automatique si utilisation >= 70% (configurable)
- ✅ **Scale DOWN** automatique si utilisation < 20% (configurable)
- ✅ Respect du cooldown (5 minutes minimum entre actions)
- ✅ Respect des limites (min/max instances)
- ✅ Logging automatique dans PostgreSQL (`gpu_scale_actions`)

### 4. **Contrôle de Budget Automatique**

Le système vérifie le budget **toutes les heures** :

```rust
// Tâche automatique (gpu_service.rs ligne 429-437)
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(3600)); // 1 heure
    loop {
        interval.tick().await;
        service_budget.check_budget().await; // ✅ AUTOMATIQUE
    }
});
```

**Ce qui est automatisé** :
- ✅ Vérification budget toutes les heures
- ✅ Estimation coût mensuel automatique
- ✅ **Arrêt automatique** de toutes les instances si budget dépassé
- ✅ Alertes dans les logs

### 5. **Métriques Automatiques**

À chaque appel GPU, les métriques sont mises à jour automatiquement :

```rust
// Mise à jour automatique (gpu_service.rs ligne 342-358)
async fn update_metrics(&self, success: bool, response_time_ms: f64) {
    metrics.total_requests += 1;
    metrics.successful_requests += 1; // ou failed_requests
    metrics.average_response_time_ms = // moyenne mobile
    metrics.last_updated = Utc::now().timestamp();
}
```

**Ce qui est automatisé** :
- ✅ Comptage des requêtes (total, réussies, échouées)
- ✅ Calcul latence moyenne (moyenne mobile)
- ✅ Estimation coût mensuel
- ✅ Mise à jour timestamp

---

## 🛠️ Actions Manuelles (Optionnelles)

### 1. **Configuration Initiale** (UNE SEULE FOIS)

Vous devez configurer les variables d'environnement dans GCP Cloud Run :

```bash
GPU_ENABLED=true
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GPU_ZONE=europe-west1-b
GCP_PROJECT_ID=yukpo-project
GPU_MONTHLY_BUDGET=100.0
# ... autres variables
```

**⚠️ IMPORTANT** : Cette configuration se fait **UNE SEULE FOIS** via :
- Console GCP Cloud Run
- gcloud CLI
- Terraform

### 2. **Déploiement Infrastructure GPU** (UNE SEULE FOIS)

Vous devez déployer l'infrastructure Terraform :

```bash
cd gcp/gpu-infrastructure/terraform
terraform init
terraform plan
terraform apply
```

**⚠️ IMPORTANT** : Cette étape crée les instances GPU sur GCP Compute Engine.

### 3. **Actions Manuelles via API REST** (Optionnel)

Si vous voulez forcer des actions, vous pouvez utiliser l'API REST :

```bash
# Forcer vérification scaling
POST /api/gpu/check-scale

# Forcer vérification budget
POST /api/gpu/check-budget

# Scaling manuel (si nécessaire)
POST /api/gpu/scale
{
  "instances": 2
}
```

**⚠️ NOTE** : Ces actions sont **optionnelles**. Le système fonctionne automatiquement sans intervention.

### 4. **Monitoring et Consultation** (Optionnel)

Vous pouvez consulter les métriques via API :

```bash
# Voir les métriques
GET /api/gpu/metrics

# Voir le statut
GET /api/gpu/status
```

**⚠️ NOTE** : Ces endpoints sont pour **consultation uniquement**. Le système fonctionne sans.

---

## 📊 Résumé : Automatique vs Manuel

| Fonctionnalité | Automatique | Manuel |
|----------------|-------------|--------|
| **Initialisation** | ✅ Au démarrage | ❌ |
| **Routing IA** | ✅ Automatique | ❌ |
| **Scaling** | ✅ Toutes les 60s | ⚠️ API optionnelle |
| **Budget** | ✅ Toutes les heures | ⚠️ API optionnelle |
| **Métriques** | ✅ Automatique | ❌ |
| **Configuration** | ❌ | ✅ Une fois dans GCP |
| **Infrastructure** | ❌ | ✅ Une fois Terraform |
| **Monitoring** | ✅ Automatique | ⚠️ API consultation |

---

## 🔍 Vérification Variables GCP

### Méthode 1: Via Console GCP

1. **Cloud Run** → Sélectionner votre service `yukpomnang-backend`
2. **REVISIONS** → Cliquer sur la dernière révision
3. **Variables & Secrets** → Vérifier les variables GPU

### Méthode 2: Via gcloud CLI

```bash
# Vérifier toutes les variables
gcloud run services describe yukpomnang-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"

# Vérifier spécifiquement GPU_ENABLED
gcloud run services describe yukpomnang-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='GPU_ENABLED')].value)"
```

### Méthode 3: Via Logs au Démarrage

Vérifier les logs Cloud Run au démarrage. Vous devriez voir :

```
✅ Service GPU initialisé
🚀 Démarrage du monitoring GPU automatisé...
✅ Monitoring GPU démarré (scaling automatique activé)
```

Si vous voyez :
```
ℹ️ Service GPU non configuré (GPU_ENABLED=false ou variables manquantes)
```

→ Les variables ne sont **pas activées**.

---

## ✅ Checklist de Vérification

- [ ] Variables GPU configurées dans Cloud Run
- [ ] Infrastructure Terraform déployée
- [ ] Logs montrent "✅ Service GPU initialisé"
- [ ] Logs montrent "✅ Monitoring GPU démarré"
- [ ] API `/api/gpu/status` retourne `"enabled": true`

---

## 🎯 Conclusion

**Le système GPU est 100% automatisé** après la configuration initiale :

1. ✅ **Configuration initiale** : Une fois dans GCP (variables d'environnement)
2. ✅ **Déploiement infrastructure** : Une fois via Terraform
3. ✅ **Tout le reste est automatique** :
   - Routing IA vers GPU
   - Scaling automatique
   - Contrôle budget
   - Métriques
   - Monitoring

**Vous n'avez RIEN à faire manuellement** après la configuration initiale ! 🎉

