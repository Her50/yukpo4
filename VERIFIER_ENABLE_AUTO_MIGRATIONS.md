# ✅ Vérifier ENABLE_AUTO_MIGRATIONS dans AWS Console

## 📋 Instructions Pas à Pas

### Étape 1 : Aller dans les Task Definitions

1. **Ouvrez** AWS Console
2. **Allez dans** **ECS** (Elastic Container Service)
3. **Cliquez** sur **"Définitions de tâches"** (Task Definitions) dans le menu de gauche
4. **Cherchez** et **cliquez** sur **"yukpo-backend"**

### Étape 2 : Voir la Dernière Révision

1. **Cliquez** sur la **dernière révision** (probablement révision 5 ou plus)
2. **Faites défiler** jusqu'à la section **"Container Definitions"**
3. **Cliquez** sur le conteneur (probablement **"backend"**)
4. **Faites défiler** jusqu'à **"Variables d'environnement"**

### Étape 3 : Vérifier la Variable

**Cherchez** la variable `ENABLE_AUTO_MIGRATIONS` :

- ✅ **Si vous voyez** :
  - **Clé** : `ENABLE_AUTO_MIGRATIONS`
  - **Type** : `Valeur` (pas `ValueFrom`)
  - **Valeur** : `true`
  
  → ✅ **C'est correct ! Les auto-migrations sont activées.**

- ❌ **Si vous voyez** :
  - **Clé** : `ENABLE_AUTO_MIGRATIONS`
  - **Type** : `ValueFrom`
  - **Valeur** : `arn:aws:secretsmanager:...`
  
  → ⚠️ **La variable utilise Secrets Manager, pas une valeur directe.**

- ❌ **Si vous ne voyez pas** la variable :
  
  → ❌ **La variable n'existe pas, les auto-migrations sont désactivées.**

---

## 🔍 Alternative : Vérifier via AWS CLI (Si Permissions)

```bash
# Récupérer la dernière révision
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition yukpo-backend \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# Voir les variables d'environnement
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region eu-west-1 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`ENABLE_AUTO_MIGRATIONS`]' \
  --output json
```

**Résultat attendu** :
```json
[
    {
        "name": "ENABLE_AUTO_MIGRATIONS",
        "value": "true"
    }
]
```



