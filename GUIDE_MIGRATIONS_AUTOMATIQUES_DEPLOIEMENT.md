# 🚀 Guide : Migrations Automatiques lors du Déploiement Docker/AWS

## ✅ OUI, c'est possible et déjà partiellement configuré !

Il existe **3 méthodes** pour exécuter automatiquement les migrations lors du déploiement :

## 🔄 Méthode 1 : Au Démarrage de l'Application ECS (DÉJÀ ACTIF)

**Statut** : ✅ **Déjà configuré dans `main.rs`**

Les migrations s'exécutent automatiquement **à chaque démarrage du conteneur ECS**.

### Comment ça fonctionne

Dans `backend/src/main.rs` (ligne 445) :

```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
    }
    Err(e) => {
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        // L'application continue quand même
    }
}
```

### Avantages

- ✅ **Automatique** : Aucune action manuelle requise
- ✅ **Idempotent** : Les migrations déjà appliquées sont ignorées
- ✅ **Sécurisé** : S'exécute dans le même contexte que l'application
- ✅ **Traçable** : Logs dans CloudWatch

### Inconvénients

- ⚠️ **L'application démarre même si les migrations échouent** (actuellement)
- ⚠️ **Peut ralentir le démarrage** si beaucoup de migrations

### Amélioration recommandée

Modifier `main.rs` pour **faire échouer le démarrage** si les migrations critiques échouent :

```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
    }
    Err(e) => {
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        
        // Vérifier si les tables critiques existent
        let critical_tables = vec!["users", "services", "deliveries"];
        let mut missing_tables = Vec::new();
        
        for table in critical_tables {
            let exists: bool = sqlx::query_scalar(
                &format!("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{}')", table)
            )
            .fetch_one(&pg_pool)
            .await
            .unwrap_or(false);
            
            if !exists {
                missing_tables.push(table);
            }
        }
        
        if !missing_tables.is_empty() {
            log::error!("❌ Tables critiques manquantes: {:?}", missing_tables);
            log::error!("❌ L'application ne peut pas démarrer sans ces tables");
            panic!("Migrations critiques échouées - arrêt de l'application");
        } else {
            log::warn!("⚠️ Continuation du démarrage malgré l'erreur de migration");
        }
    }
}
```

## 🔄 Méthode 2 : Dans GitHub Actions (AVANT le Build Docker)

**Statut** : ⚠️ **Partiellement configuré** (script Python existe, workflow manquant)

### Configuration requise

Créer un workflow GitHub Actions (`.github/workflows/docker-build-optimized.yml`) :

```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  run-migrations:
    name: Run Database Migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install Python dependencies
        run: |
          pip install -r scripts/requirements.txt
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Run migrations
        env:
          SSM_DATABASE_URL_PATH: /yukpomnang/production/DATABASE_URL
          AWS_REGION: us-east-1
          FAIL_ON_MIGRATION_ERROR: "false"  # Continue même si migrations échouent (VPC privé)
        run: |
          python3 scripts/run_migrations_aws.py
  
  build-and-push:
    name: Build and Push Docker Image
    needs: run-migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to AWS ECR
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./backend/Dockerfile.cloud
          push: true
          tags: |
            ${{ secrets.AWS_ECR_REGISTRY }}/yukpomnang-backend:latest
            ${{ secrets.AWS_ECR_REGISTRY }}/yukpomnang-backend:${{ github.sha }}
  
  deploy-to-ecs:
    name: Deploy to ECS
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster yukpomnang-cluster \
            --service yukpomnang-backend \
            --force-new-deployment
```

### Avantages

- ✅ **Exécution avant le build** : Les migrations sont appliquées avant de créer l'image Docker
- ✅ **Détection précoce** : Les erreurs de migration sont détectées avant le déploiement
- ✅ **Traçable** : Logs dans GitHub Actions

### Inconvénients

- ⚠️ **Nécessite un accès réseau** : GitHub Actions doit pouvoir accéder à RDS (peut échouer si VPC privé)
- ⚠️ **Nécessite Rust** : Pour installer `sqlx-cli` (peut être lent)

### Note importante

Si la base de données est dans un **VPC privé** et non accessible depuis GitHub Actions :
- Le script détecte l'erreur de connexion
- Le workflow continue normalement (ne bloque pas le build)
- **Les migrations seront exécutées au démarrage de l'application ECS** (Méthode 1)

## 🔄 Méthode 3 : Via ECS Task One-Shot (AVANT le déploiement)

**Statut** : ⚠️ **À configurer**

Exécuter les migrations via une **tâche ECS one-shot** avant de déployer le service.

### Configuration dans GitHub Actions

```yaml
run-migrations-ecs:
  name: Run Migrations via ECS Task
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Run migrations via ECS task
      run: |
        # Créer une tâche ECS one-shot pour exécuter les migrations
        TASK_ARN=$(aws ecs run-task \
          --cluster yukpomnang-cluster \
          --task-definition yukpomnang-backend \
          --launch-type FARGATE \
          --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
          --overrides '{
            "containerOverrides": [{
              "name": "backend",
              "command": ["bash", "-c", "cd /app/backend && export DATABASE_URL=$(aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1 --with-decryption --query Parameter.Value --output text) && sqlx migrate run"]
            }]
          }' \
          --query 'tasks[0].taskArn' \
          --output text)
        
        # Attendre que la tâche se termine
        aws ecs wait tasks-stopped \
          --cluster yukpomnang-cluster \
          --tasks "$TASK_ARN"
        
        # Vérifier le statut de sortie
        EXIT_CODE=$(aws ecs describe-tasks \
          --cluster yukpomnang-cluster \
          --tasks "$TASK_ARN" \
          --query 'tasks[0].containers[0].exitCode' \
          --output text)
        
        if [ "$EXIT_CODE" != "0" ]; then
          echo "❌ Les migrations ont échoué (exit code: $EXIT_CODE)"
          exit 1
        fi
```

### Avantages

- ✅ **Accès VPC** : La tâche ECS a accès à la base de données dans le VPC privé
- ✅ **Isolé** : Les migrations s'exécutent dans un conteneur séparé
- ✅ **Contrôle** : On peut faire échouer le déploiement si les migrations échouent

### Inconvénients

- ⚠️ **Nécessite sqlx-cli** : Doit être installé dans l'image Docker
- ⚠️ **Plus complexe** : Nécessite une configuration ECS supplémentaire

### Modification du Dockerfile

Ajouter `sqlx-cli` dans le Dockerfile :

```dockerfile
# Dans le stage builder
RUN cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features postgres

# Dans le stage runtime
COPY --from=builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx
```

## 🎯 Recommandation : Méthode 1 + Amélioration

**La meilleure approche** est d'utiliser la **Méthode 1 (démarrage automatique)** avec une amélioration pour faire échouer le démarrage si les tables critiques sont manquantes.

### Pourquoi ?

1. ✅ **Simple** : Aucune configuration supplémentaire requise
2. ✅ **Fiable** : S'exécute toujours au démarrage
3. ✅ **Sécurisé** : Dans le même contexte que l'application
4. ✅ **Idempotent** : Les migrations déjà appliquées sont ignorées

### Action immédiate

1. **Modifier `main.rs`** pour faire échouer le démarrage si les tables critiques sont manquantes (code fourni ci-dessus)
2. **Tester** : Déployer et vérifier que les migrations s'exécutent correctement
3. **Optionnel** : Ajouter la Méthode 2 (GitHub Actions) pour détection précoce

## 📋 Checklist de Déploiement

### Avant de push sur Git

- [ ] Vérifier que toutes les migrations sont dans `backend/migrations/`
- [ ] Vérifier que les migrations utilisent `CREATE TABLE IF NOT EXISTS`
- [ ] Tester les migrations localement : `cargo sqlx migrate run`

### Après le push

- [ ] Vérifier les logs GitHub Actions (si Méthode 2 configurée)
- [ ] Vérifier les logs ECS au démarrage (CloudWatch)
- [ ] Vérifier que les tables existent dans la base de données

### Vérification post-déploiement

```sql
-- Vérifier que toutes les tables critiques existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users',
    'services',
    'deliveries',
    'product_creation_queue',
    'live_flash_sales',
    'global_promo_events',
    'delivery_matching_queue',
    'product_orders'
)
ORDER BY table_name;
```

## 🔍 Dépannage

### Les migrations ne s'exécutent pas

1. **Vérifier les logs CloudWatch** : Chercher "Application des migrations SQLx standard"
2. **Vérifier DATABASE_URL** : Doit être accessible depuis ECS
3. **Vérifier les permissions** : L'utilisateur DB doit avoir les droits CREATE TABLE

### Les migrations échouent

1. **Vérifier les logs détaillés** : CloudWatch affiche l'erreur SQL exacte
2. **Vérifier les dépendances** : Les tables référencées doivent exister
3. **Vérifier les ENUMs** : Les types ENUM doivent être créés avant les tables

### L'application démarre mais les tables manquent

1. **Vérifier que les migrations sont dans le conteneur** : `/app/migrations/`
2. **Vérifier que sqlx::migrate!() trouve le dossier** : Logs affichent le chemin
3. **Vérifier les erreurs silencieuses** : Les migrations peuvent échouer sans bloquer le démarrage

## 📝 Résumé

| Méthode | Statut | Quand | Avantages | Inconvénients |
|---------|--------|-------|-----------|---------------|
| **1. Au démarrage ECS** | ✅ Actif | Chaque démarrage | Simple, automatique | Peut ralentir le démarrage |
| **2. GitHub Actions** | ⚠️ À configurer | Avant build | Détection précoce | Nécessite accès réseau |
| **3. ECS Task One-Shot** | ⚠️ À configurer | Avant déploiement | Accès VPC, isolé | Plus complexe |

**Recommandation** : Utiliser la **Méthode 1 avec amélioration** pour faire échouer le démarrage si les tables critiques sont manquantes.

