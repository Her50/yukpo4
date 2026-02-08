# 🔍 Script de Vérification Automatique - Accès Backend via Liens Externes

## 📋 Description

Ce script vérifie automatiquement l'état du backend pour s'assurer qu'il est accessible via les liens partagés à l'extérieur. Il effectue trois vérifications principales :

1. **AWS ECS** - Vérifie que le service backend est actif et en cours d'exécution
2. **Cloudflare DNS** - Vérifie la configuration DNS et le proxy
3. **CloudWatch Logs** - Analyse les logs récents pour détecter les erreurs

## 🚀 Utilisation

### Prérequis

1. **AWS CLI installé et configuré**
   ```powershell
   aws --version
   aws configure
   ```

2. **Permissions AWS requises** :
   - `ecs:DescribeClusters`
   - `ecs:DescribeServices`
   - `logs:DescribeLogGroups`
   - `logs:DescribeLogStreams`
   - `logs:FilterLogEvents`
   - `logs:TailLogs`

### Exécution

```powershell
# Exécution avec paramètres par défaut
.\scripts\verify-backend-access-external-links.ps1

# Avec paramètres personnalisés
.\scripts\verify-backend-access-external-links.ps1 `
    -Region "eu-west-1" `
    -ClusterName "yukpomnang-cluster" `
    -ServiceName "yukpomnang-backend-service" `
    -LogGroupName "/ecs/yukpomnang-backend" `
    -DomainName "yukpomnang.com" `
    -LogMinutes 30
```

## 📊 Ce que le script vérifie

### 1. AWS ECS

- ✅ Cluster existe et est accessible
- ✅ Service est **ACTIVE**
- ✅ **Running count > 0** (au moins une tâche en cours d'exécution)
- ✅ Running count = Desired count (idéalement)
- ⚠️ Affiche les événements récents du service

### 2. Cloudflare DNS

- ✅ Résolution DNS du domaine
- ⚠️ **IMPORTANT** : Vérifie si le proxy est activé (nuage orange)
  - Si activé → **DÉSACTIVER** (nuage gris) pour permettre l'accès direct au backend
- ✅ Test de connectivité HTTP vers `/health`

### 3. CloudWatch Logs

- ✅ Log group existe
- ✅ Analyse des logs des dernières 30 minutes (par défaut)
- ❌ Détecte les erreurs (ERROR, FAIL, PANIC, EXCEPTION)
- ⚠️ Détecte les avertissements (WARN, WARNING)
- ✅ Vérifie les logs de santé (health, listening, started)
- ✅ Liste les streams actifs

## 🎯 Résultat

Le script affiche un résumé final avec :
- ✅ **TOUTES LES VERIFICATIONS SONT PASSÉES** → Backend accessible
- ❌ **CERTAINES VERIFICATIONS ONT ÉCHOUÉ** → Actions recommandées affichées

## 🔧 Dépannage

### Problème : Service ECS non ACTIVE

```powershell
# Vérifier manuellement
aws ecs describe-services `
    --cluster yukpomnang-cluster `
    --services yukpomnang-backend-service `
    --region eu-west-1
```

### Problème : Proxy Cloudflare activé

1. Aller sur [Cloudflare Dashboard](https://dash.cloudflare.com) → DNS
2. Chercher l'enregistrement pour `yukpomnang.com`
3. Si le nuage est **orange** (proxy activé) → cliquer pour le passer en **gris** (DNS only)

### Problème : Erreurs dans les logs

```powershell
# Voir les logs détaillés
.\scripts\get-ecs-logs.ps1 -Limit 100
```

## 📝 Notes

- Le script nécessite des credentials AWS configurés (via `aws configure` ou variables d'environnement)
- Pour Cloudflare, une vérification manuelle peut être nécessaire si l'API token n'est pas configurée
- Les logs sont analysés sur les dernières 30 minutes par défaut (configurable via `-LogMinutes`)

## 🔄 Intégration CI/CD

Ce script peut être intégré dans un pipeline CI/CD pour vérifier automatiquement l'état du backend après un déploiement :

```yaml
# Exemple GitHub Actions
- name: Verify Backend Access
  run: |
    powershell -File scripts/verify-backend-access-external-links.ps1
```

## 📞 Support

En cas de problème, vérifier :
1. Les credentials AWS sont correctement configurés
2. Les permissions IAM sont suffisantes
3. Le service ECS est bien déployé
4. Le domaine DNS est correctement configuré



