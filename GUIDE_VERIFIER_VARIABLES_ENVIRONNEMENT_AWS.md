# 🔍 Guide : Vérifier les Variables d'Environnement dans AWS Console

## 📋 Méthodes pour Vérifier les Variables d'Environnement

Il existe plusieurs méthodes pour vérifier les variables d'environnement dans AWS, selon votre configuration.

---

## 🎯 Méthode 1 : Via AWS ECS Console (Recommandé)

### Étape 1 : Accéder à ECS

1. **Ouvrir la console AWS** : https://console.aws.amazon.com
2. **Aller dans ECS** : Rechercher "ECS" dans la barre de recherche ou aller dans **Services > ECS**
3. **Sélectionner votre cluster** : Cliquer sur le nom de votre cluster (ex: `yukpomnang-cluster`)

### Étape 2 : Voir les Variables d'Environnement du Service

1. **Onglet "Services"** : Dans le menu de gauche, cliquer sur **Services**
2. **Sélectionner votre service** : Cliquer sur le nom de votre service (ex: `yukpomnang-backend-service`)
3. **Onglet "Configuration and tasks"** : Cliquer sur l'onglet **Configuration and tasks**
4. **Voir la définition de tâche** : Cliquer sur le lien de la **Task definition** (ex: `yukpomnang-backend:123`)
5. **Onglet "JSON"** : Cliquer sur l'onglet **JSON** pour voir la configuration complète
6. **Section "environment"** : Chercher la section `"environment"` dans le JSON

**Exemple de ce que vous verrez** :
```json
{
  "containerDefinitions": [
    {
      "name": "yukpomnang-backend",
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://..."
        },
        {
          "name": "ENABLE_AUTO_MIGRATIONS",
          "value": "true"
        },
        {
          "name": "RUST_LOG",
          "value": "info"
        }
      ]
    }
  ]
}
```

### Étape 3 : Voir les Secrets (si utilisés)

Si vous utilisez **Secrets Manager**, les secrets apparaissent dans la section `"secrets"` :

```json
{
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:yukpomnang/database-url"
    },
    {
      "name": "ENABLE_AUTO_MIGRATIONS",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:yukpomnang/enable-auto-migrations"
    }
  ]
}
```

**Note** : Les valeurs des secrets ne sont **pas visibles** dans la console pour des raisons de sécurité. Vous devez aller dans **Secrets Manager** pour voir les valeurs.

---

## 🎯 Méthode 2 : Via AWS Secrets Manager

### Étape 1 : Accéder à Secrets Manager

1. **Ouvrir la console AWS** : https://console.aws.amazon.com
2. **Aller dans Secrets Manager** : Rechercher "Secrets Manager" dans la barre de recherche
3. **Voir les secrets** : Vous verrez la liste de tous vos secrets

### Étape 2 : Voir la Valeur d'un Secret

1. **Sélectionner un secret** : Cliquer sur le nom du secret (ex: `yukpomnang/database-url`)
2. **Onglet "Secret value"** : Cliquer sur l'onglet **Secret value**
3. **Afficher la valeur** : Cliquer sur **Retrieve secret value** pour voir la valeur

**⚠️ Attention** : Les valeurs des secrets sont sensibles. Ne les partagez pas publiquement.

---

## 🎯 Méthode 3 : Via AWS CloudWatch Logs (Variables dans les Logs)

### Étape 1 : Accéder à CloudWatch Logs

1. **Ouvrir la console AWS** : https://console.aws.amazon.com
2. **Aller dans CloudWatch** : Rechercher "CloudWatch" dans la barre de recherche
3. **Onglet "Logs"** : Cliquer sur **Logs** dans le menu de gauche
4. **Sélectionner le groupe de logs** : Cliquer sur le groupe de logs de votre application (ex: `/ecs/yukpomnang-backend`)

### Étape 2 : Chercher les Variables dans les Logs

1. **Rechercher dans les logs** : Utiliser la barre de recherche pour chercher des mots-clés comme :
   - `DATABASE_URL`
   - `ENABLE_AUTO_MIGRATIONS`
   - `RUST_LOG`
   - `Environment variables`

**Note** : Les variables d'environnement peuvent apparaître dans les logs au démarrage de l'application, mais **pas les valeurs sensibles** (comme les mots de passe).

---

## 🎯 Méthode 4 : Via AWS CLI (Ligne de Commande)

### Prérequis

- **AWS CLI installé** : https://aws.amazon.com/cli/
- **Credentials configurés** : `aws configure`

### Commande 1 : Voir la Définition de Tâche ECS

```bash
# Lister les définitions de tâches
aws ecs list-task-definitions --family-prefix yukpomnang-backend

# Voir la dernière définition de tâche
aws ecs describe-task-definition --task-definition yukpomnang-backend:latest --query 'taskDefinition.containerDefinitions[0].environment' --output json
```

### Commande 2 : Voir les Secrets

```bash
# Lister les secrets
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `yukpomnang`)].Name' --output table

# Voir la valeur d'un secret (⚠️ SENSIBLE)
aws secretsmanager get-secret-value --secret-id yukpomnang/database-url --query 'SecretString' --output text
```

### Commande 3 : Voir les Variables d'Environnement d'une Tâche en Cours

```bash
# Lister les tâches en cours
aws ecs list-tasks --cluster yukpomnang-cluster --service-name yukpomnang-backend-service

# Voir les détails d'une tâche
aws ecs describe-tasks --cluster yukpomnang-cluster --tasks <TASK_ARN> --query 'tasks[0].containers[0].environment' --output json
```

---

## 🎯 Méthode 5 : Via AWS Systems Manager (SSM) - Si Activé

### Étape 1 : Accéder à Systems Manager

1. **Ouvrir la console AWS** : https://console.aws.amazon.com
2. **Aller dans Systems Manager** : Rechercher "Systems Manager" dans la barre de recherche
3. **Onglet "Parameter Store"** : Cliquer sur **Parameter Store** dans le menu de gauche

### Étape 2 : Voir les Paramètres

1. **Rechercher les paramètres** : Utiliser la barre de recherche pour chercher `yukpomnang`
2. **Voir la valeur** : Cliquer sur un paramètre pour voir sa valeur

**Note** : Si vous utilisez **Parameter Store** au lieu de **Secrets Manager**, les variables seront ici.

---

## 🔍 Variables d'Environnement Typiques à Vérifier

### Variables Critiques pour les Migrations

| Variable | Description | Où Vérifier |
|----------|-------------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL | Secrets Manager ou ECS Task Definition |
| `ENABLE_AUTO_MIGRATIONS` | Active les migrations automatiques | ECS Task Definition ou Secrets Manager |
| `RUST_LOG` | Niveau de log Rust | ECS Task Definition |
| `AWS_REGION` | Région AWS | ECS Task Definition (généralement automatique) |

### Variables pour le Backend

| Variable | Description | Où Vérifier |
|----------|-------------|-------------|
| `PORT` | Port d'écoute du serveur | ECS Task Definition |
| `CORS_ORIGINS` | Origines CORS autorisées | ECS Task Definition ou Secrets Manager |
| `JWT_SECRET` | Secret pour les tokens JWT | Secrets Manager (⚠️ SENSIBLE) |

---

## ⚠️ Notes Importantes

### 1. Sécurité des Secrets

- **Ne jamais partager** les valeurs des secrets publiquement
- **Ne jamais commiter** les secrets dans Git
- **Utiliser Secrets Manager** pour les valeurs sensibles

### 2. Variables d'Environnement vs Secrets

- **Variables d'Environnement** : Visibles dans ECS Task Definition (pas de chiffrement)
- **Secrets Manager** : Chiffrés, valeurs non visibles dans la console ECS

### 3. Mise à Jour des Variables

- **Modifier la Task Definition** : Créer une nouvelle révision avec les nouvelles variables
- **Mettre à jour le Service** : Le service doit être mis à jour pour utiliser la nouvelle révision
- **Redéployer** : Les nouvelles variables prendront effet au prochain redéploiement

---

## 🎯 Checklist de Vérification

### ✅ Vérifications Essentielles

- [ ] `DATABASE_URL` est correctement configuré
- [ ] `ENABLE_AUTO_MIGRATIONS` est défini à `"true"`
- [ ] `RUST_LOG` est défini (ex: `"info"` ou `"debug"`)
- [ ] Les secrets sont correctement référencés dans la Task Definition
- [ ] Les secrets existent dans Secrets Manager
- [ ] Les valeurs des secrets sont correctes

### ✅ Vérifications Supplémentaires

- [ ] `AWS_REGION` est défini
- [ ] `PORT` est défini (généralement `8080`)
- [ ] `CORS_ORIGINS` est défini si nécessaire
- [ ] Les variables d'environnement sont présentes dans la dernière révision de la Task Definition

---

## 📝 Exemple de Vérification Complète

### 1. Vérifier ECS Task Definition

```bash
# Via AWS CLI
aws ecs describe-task-definition \
  --task-definition yukpomnang-backend:latest \
  --query 'taskDefinition.containerDefinitions[0].{environment:environment,secrets:secrets}' \
  --output json
```

### 2. Vérifier Secrets Manager

```bash
# Lister tous les secrets
aws secretsmanager list-secrets \
  --query 'SecretList[?contains(Name, `yukpomnang`)].{Name:Name,ARN:ARN}' \
  --output table
```

### 3. Vérifier les Logs pour Confirmer

```bash
# Voir les logs récents
aws logs tail /ecs/yukpomnang-backend --follow
```

---

## 🆘 Problèmes Courants

### Problème 1 : Variables Non Visibles dans ECS

**Cause** : Les variables sont peut-être dans Secrets Manager, pas dans `environment`.

**Solution** : Vérifier la section `secrets` dans la Task Definition.

### Problème 2 : Secrets Non Accessibles

**Cause** : Le rôle IAM de la tâche ECS n'a pas les permissions pour accéder à Secrets Manager.

**Solution** : Vérifier les politiques IAM attachées au rôle de la tâche ECS.

### Problème 3 : Variables Non Mises à Jour

**Cause** : Le service ECS utilise une ancienne révision de la Task Definition.

**Solution** : Mettre à jour le service pour utiliser la dernière révision.

---

**Date** : 2026-01-30  
**Statut** : ✅ Guide complet pour vérifier les variables d'environnement dans AWS

