# 📝 Instructions : Exécution du Script de Mise à Jour des Variables

## 🚀 Méthode 1 : Avec Paramètre (Recommandé)

```powershell
.\scripts\update_all_env_variables_aws.ps1 -DbPassword "VOTRE_MOT_DE_PASSE"
```

**Exemple** :
```powershell
.\scripts\update_all_env_variables_aws.ps1 -DbPassword "MonMotDePasse123!"
```

---

## 🚀 Méthode 2 : Avec Variable d'Environnement

```powershell
# Définir la variable d'environnement
$env:DB_PASSWORD = "VOTRE_MOT_DE_PASSE"

# Exécuter le script
.\scripts\update_all_env_variables_aws.ps1
```

**Exemple** :
```powershell
$env:DB_PASSWORD = "MonMotDePasse123!"
.\scripts\update_all_env_variables_aws.ps1
```

---

## ✅ Ce que le Script Fait

1. **Corrige le DATABASE_URL** :
   - Remplace l'IP interne par l'endpoint RDS public
   - Format : `postgresql://yukpo_db_user:***@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require`

2. **Crée/Met à jour toutes les variables** :
   - Variables de base de données (DATABASE_TIMEOUT, DB_POOL_SIZE, etc.)
   - Variables GPU (GPU_AVAILABLE, GPU_MEMORY_GB, etc.)
   - Variables de configuration API, Cache, Recherche
   - Variables de timeouts
   - Variables Email/SMS, Video Renderer, LiveKit
   - Et toutes les autres variables manquantes

3. **Affiche le progrès** :
   - Indique chaque variable créée/mise à jour
   - Affiche les erreurs si elles se produisent

---

## ⚠️ Après l'Exécution

**IMPORTANT** : Redéployez le service ECS pour que les changements prennent effet :

```powershell
aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region us-east-1
```

Ou via Console AWS :
1. ECS → Clusters → yukpomnang-cluster
2. Services → yukpomnang-backend-service
3. Update → Force new deployment

---

## 🔍 Vérification

Après l'exécution, vérifiez que le DATABASE_URL est correct :

```powershell
aws ssm get-parameter --name "/yukpomnang/production/DATABASE_URL" --region us-east-1 --with-decryption --query "Parameter.Value" --output text
```

Le résultat doit contenir `yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com` (pas l'IP interne).

---

**Date** : 2026-01-30

