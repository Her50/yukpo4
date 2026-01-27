# 🔧 Correction Health Check ALB - Backend AWS

## 🔍 Problème Identifié

Les health checks de l'ALB échouaient car :
- **ALB cherche** : `/health`
- **Application expose** : `/healthz` uniquement
- **Résultat** : 502 Bad Gateway (ALB ne trouve aucun backend sain)

## ✅ Correction Appliquée

### Modification du Code

**Fichier** : `backend/src/lib.rs`

Ajout de la route `/health` qui pointe vers la même fonction `healthz` :

```327:328:backend/src/lib.rs
        .route("/healthz", get(healthz))
        .route("/health", get(healthz)) // ✅ Route pour ALB health checks
```

### Configuration Vérifiée

✅ **Port Container** : `3001` (correct)
✅ **Variable PORT** : `3001` (correct)
✅ **Variable HOST** : `0.0.0.0` (correct)
✅ **ALB Health Check Path** : `/health` (maintenant disponible)

---

## 🚀 Prochaines Étapes

### 1. Commiter et Pousser les Changements

```powershell
git add backend/src/lib.rs
git commit -m "fix: Ajouter route /health pour ALB health checks"
git push origin main
```

### 2. Attendre le Déploiement Automatique

Le workflow GitHub Actions va automatiquement :
1. Build l'image Docker
2. Push vers AWS ECR
3. Déployer sur ECS

**Temps estimé** : 5-10 minutes

### 3. Vérifier les Health Checks

Après le déploiement (2-3 minutes après la fin du workflow) :

```powershell
# Vérifier le statut des health checks
aws elbv2 describe-target-health `
    --target-group-arn arn:aws:elasticloadbalancing:us-east-1:846505724644:targetgroup/yukpomnang-backend-tg/8c7f21b97e823eff `
    --region us-east-1 `
    --query 'TargetHealthDescriptions[*].{Health:TargetHealth.State,Reason:TargetHealth.Reason}' `
    --output json

# Tester l'endpoint
try { 
    $response = Invoke-WebRequest -Uri "http://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ SUCCESS - Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch { 
    Write-Host "❌ FAILED - $($_.Exception.Message)"
}
```

### 4. Vérifier les Logs

```powershell
# Voir les logs en temps réel
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1
```

---

## 📊 Résultat Attendu

Après le déploiement :
- ✅ Health checks ALB : `healthy` (au lieu de `unhealthy`)
- ✅ Endpoint `/health` : Retourne `200 OK` avec `"OK"`
- ✅ Backend accessible via l'ALB

---

## 🔍 Diagnostic en Cas de Problème

Si les health checks échouent toujours après le déploiement :

1. **Vérifier que l'application démarre** :
   ```powershell
   aws logs filter-log-events --log-group-name /ecs/yukpomnang-backend --region us-east-1 --start-time $((Get-Date).AddMinutes(-10).ToUniversalTime() | Get-Date -UFormat %s) --max-items 50
   ```

2. **Vérifier que le port est correct** :
   ```powershell
   aws ecs describe-task-definition --task-definition yukpomnang-backend --region us-east-1 --query 'taskDefinition.containerDefinitions[0].portMappings'
   ```

3. **Vérifier les Security Groups** :
   ```powershell
   aws ec2 describe-security-groups --group-ids sg-0f9210abfa33d52d4 --region us-east-1 --query 'SecurityGroups[0].IpPermissions[?FromPort==`3001`]'
   ```

---

**Date** : 2026-01-27
**Statut** : ✅ Correction appliquée, en attente de déploiement

