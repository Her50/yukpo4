# 🔧 Guide : Modifier les Variables d'Environnement dans ECS

**Important** : Les variables d'environnement ne sont PAS dans la page "Mettre à jour le service". Elles sont dans la **Task Definition** !

---

## ✅ MÉTHODE 1 : Modifier la Task Definition (Recommandé)

### Étape 1 : Aller dans les Task Definitions

1. Dans la console AWS ECS, **cliquez sur "Définitions de tâches"** dans le menu de gauche
2. **Cherchez** `yukpo-backend` dans la liste
3. **Cliquez** sur `yukpo-backend` (pas sur une révision spécifique)

### Étape 2 : Créer une Nouvelle Révision

1. **Cliquez** sur le bouton **"Créer une nouvelle révision"** (ou "Create new revision")
2. **Faites défiler** jusqu'à la section **"Container Definitions"**
3. **Cliquez** sur le conteneur (probablement `yukpo-backend`)
4. **Faites défiler** jusqu'à la section **"Environment"** ou **"Variables d'environnement"**
5. **Ajoutez** ou **modifiez** la variable :
   - **Key**: `ENABLE_AUTO_MIGRATIONS`
   - **Value**: `true`
6. **Cliquez** sur **"Mettre à jour"** (Update) en bas de la page du conteneur
7. **Cliquez** sur **"Créer"** (Create) en bas de la page de la task definition

### Étape 3 : Mettre à Jour le Service pour Utiliser la Nouvelle Révision

1. **Retournez** dans **Clusters** → **yukpo-cluster** → **Services** → **yukpo-backend-service**
2. **Cliquez** sur **"Mettre à jour"** (Update)
3. Dans **"Révision de la définition de tâche"**, **sélectionnez** la nouvelle révision (ou laissez "Dernier" si c'est la dernière)
4. **Cochez** "Forcer un nouveau déploiement" (Force a new deployment)
5. **Cliquez** sur **"Mettre à jour"** (Update)

---

## ✅ MÉTHODE 2 : Via la Page de Mise à Jour (Si Visible)

Si vous voyez une section **"Container Definitions"** dans la page de mise à jour :

1. **Développez** la section **"Container Definitions"** (cliquez sur la flèche)
2. **Cliquez** sur le conteneur pour le modifier
3. **Faites défiler** jusqu'à **"Environment"** ou **"Variables d'environnement"**
4. **Ajoutez** la variable :
   - **Key**: `ENABLE_AUTO_MIGRATIONS`
   - **Value**: `true`
5. **Sauvegardez** et **mettez à jour** le service

---

## 📋 ÉTAPES DÉTAILLÉES AVEC SCREENSHOTS

### Option A : Depuis les Task Definitions

```
1. Menu gauche → "Définitions de tâches"
2. Cliquez sur "yukpo-backend"
3. Cliquez sur "Créer une nouvelle révision"
4. Container Definitions → Cliquez sur le conteneur
5. Environment → Ajoutez ENABLE_AUTO_MIGRATIONS=true
6. Créez la nouvelle révision
7. Retournez au service → Mettre à jour → Sélectionnez la nouvelle révision
```

### Option B : Depuis le Service (Si Possible)

```
1. Service → Mettre à jour
2. Développez "Container Definitions" (si visible)
3. Cliquez sur le conteneur
4. Environment → Ajoutez ENABLE_AUTO_MIGRATIONS=true
5. Mettez à jour le service
```

---

## 🔍 COMMENT TROUVER LA SECTION ENVIRONMENT

La section **Environment** se trouve généralement :
- **Dans la Task Definition** (pas dans le service)
- **Après avoir cliqué sur le conteneur** dans Container Definitions
- **Après les sections** : Image, Port mappings, Health check
- **Avant les sections** : Storage, Logging

---

## ⚠️ IMPORTANT

1. **Les variables d'environnement sont dans la Task Definition**, pas dans le service
2. **Il faut créer une nouvelle révision** de la task definition
3. **Puis mettre à jour le service** pour utiliser cette nouvelle révision
4. **Cocher "Forcer un nouveau déploiement"** pour que les changements prennent effet immédiatement

---

## ✅ VÉRIFICATION APRÈS MODIFICATION

Attendre 5-10 minutes, puis vérifier dans les logs :

```bash
aws logs tail /ecs/yukpo-backend-service --since 10m --region eu-west-1 --filter-pattern "ENABLE_AUTO_MIGRATIONS" --format short
```

Vous devriez voir dans les logs :
```
🔍 ENABLE_AUTO_MIGRATIONS: raw='true', parsed=true
✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...
```



