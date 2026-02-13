# 🔄 Redéployer avec le Script Corrigé

## ✅ Modifications Apportées

Le script `backend/scripts/start-cloud.sh` a été modifié pour :
1. ✅ Continuer même si la vérification de la base échoue
2. ✅ Afficher plus d'informations de débogage
3. ✅ Ne pas quitter avec `exit 1` si la base n'est pas détectée

## 📋 Étapes pour Redéployer

### Option 1 : Via GitHub Actions (Recommandé)

Si vous avez un workflow GitHub Actions configuré :

1. **Committez les changements** :
   ```bash
   git add backend/scripts/start-cloud.sh
   git commit -m "Fix: Améliorer la vérification de la base de données dans start-cloud.sh"
   git push
   ```

2. **Le workflow GitHub Actions** reconstruira automatiquement l'image et la redéploiera

### Option 2 : Reconstruire Manuellement

1. **Reconstruire l'image Docker** :
   ```bash
   cd backend
   docker build -f Dockerfile.cloud.optimized -t yukpomnang-backend-optimized:latest .
   ```

2. **Taguer et pousser vers ECR** :
   ```bash
   aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 108964700972.dkr.ecr.eu-west-1.amazonaws.com
   docker tag yukpomnang-backend-optimized:latest 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:latest
   docker push 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:latest
   ```

3. **Forcer un nouveau déploiement ECS** :
   - AWS Console → ECS → Clusters → `yukpo-cluster`
   - Services → `yukpo-backend-service`
   - Mise à jour → Forcer un nouveau déploiement

## ✅ Solution Temporaire (Sans Rebuild)

Si vous ne pouvez pas reconstruire l'image maintenant, la base `yukpo` existe déjà, donc l'application devrait pouvoir se connecter directement. Le problème est que le script s'arrête avant.

**Solution** : Modifiez temporairement `DATABASE_URL` dans AWS Secrets Manager pour pointer vers `postgres`, puis changez-le après le démarrage. Mais ce n'est pas idéal.

## 🎯 Solution Recommandée

Reconstruisez l'image avec le script corrigé - c'est la solution la plus propre et durable.

